import http from 'node:http';
import {createLearnerRoutes} from './learner-selfservice.mjs';
import {createStorageRoutes} from './sheets-store.mjs';
import {createAdminAuth} from './admin-auth.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
export function authHeader(key,secret,date=new Date().toISOString(),salt=crypto.randomBytes(16).toString('hex')){const signature=crypto.createHmac('sha256',secret).update(date+salt).digest('hex');return `HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${signature}`}
export function validateMessages(input,from){
 if(!Array.isArray(input)||input.length<1||input.length>1000)throw Error('발송 대상은 1~1,000건이어야 합니다.');
 const seen=new Set();return input.map(m=>{if(!m||typeof m.to!=='string'||!/^010\d{8}$/.test(m.to)||typeof m.text!=='string'||!m.text.trim()||m.text.length>1800||/\{[^{}]+\}/.test(m.text))throw Error('연락처 또는 문자 본문이 올바르지 않습니다.');return {to:m.to,from,text:m.text,autoTypeDetect:true}}).filter(m=>{const key=m.to+'\n'+m.text;if(seen.has(key))return false;seen.add(key);return true});
}
export function createApprovalNotifier({env,fetcher,ledger,persist}){
 return async(application,course)=>{
 const key='approval-'+crypto.createHash('sha256').update(application.id).digest('hex');
 if(ledger[key])return ledger[key].state==='complete'&&ledger[key].result?.accepted===1?'':application.name+'님 승인 문자: 이전 발송 결과를 SOLAPI에서 확인하세요. 자동 재발송하지 않습니다.';
 const fail=message=>application.name+'님 승인 완료 / 문자 미발송: '+message;
 if(!env.SOLAPI_API_KEY||!env.SOLAPI_API_SECRET||!/^0\d{8,10}$/.test(env.SOLAPI_FROM||''))return fail('문자 연동 설정을 확인하세요.');
 const to=String(application.phone||'').replace(/[\s()-]/g,'');if(!/^010\d{8}$/.test(to))return fail('휴대폰 번호를 확인하세요.');
 const contacts=(course.educationContacts||[]).filter(x=>x.name||x.phone).map(x=>[x.company,[x.name,x.position].filter(Boolean).join(' '),x.phone].filter(Boolean).join(' · ')).join(' / ')||'교육 담당자 문의';
 const date=value=>String(value||'').replaceAll('-','. '),day=date(course.date)+(course.endDate&&course.endDate!==course.date?' ~ '+date(course.endDate):'');
 const text='[태광러닝센터 | 교육신청 승인 안내]\n'+application.name+'님, 「'+course.title+'」 신청이 정상 승인 되었습니다.\n• 교육일: '+day+'\n• 교육시간: '+(course.startTime||'담당자 문의')+(course.endTime?'~'+course.endTime:'')+'\n• 교육장소: '+(course.place||'담당자 문의')+'\n문의: '+contacts;
 let messages;try{messages=validateMessages([{to,text}],env.SOLAPI_FROM)}catch{return fail('문자 내용 또는 연락처를 확인하세요.')}
 ledger[key]={state:'pending',created:new Date().toISOString()};persist();
 try{const response=await fetcher('https://api.solapi.com/messages/v4/send-many/detail',{method:'POST',headers:{'Content-Type':'application/json',Authorization:authHeader(env.SOLAPI_API_KEY,env.SOLAPI_API_SECRET)},body:JSON.stringify({messages,allowDuplicates:true,showMessageList:true}),signal:AbortSignal.timeout(25000)});const data=await response.json(),count=data.groupInfo?.count;
 if(!response.ok||count?.registeredSuccess!==1||count?.registeredFailed!==0){ledger[key]={...ledger[key],state:response.status>=500?'unknown':'complete',result:{accepted:0}};persist();return fail('발송 접수 실패 또는 결과 확인 필요. SOLAPI 내역을 확인하세요.');}
 ledger[key]={...ledger[key],state:'complete',result:{accepted:1,groupId:data.groupInfo.groupId||''}};persist();return '';
 }catch{ledger[key]={...ledger[key],state:'unknown'};persist();return fail('접수 여부가 불명확하여 자동 재발송하지 않습니다. SOLAPI 내역을 확인하세요.');}
 }
}
export function createServer({env=process.env,fetcher=fetch,root=ROOT}={}){
 const dataRoot=env.DATA_DIR||root;fs.mkdirSync(dataRoot,{recursive:true});
 const ledgerPath=env.SMS_LEDGER_FILE||path.join(dataRoot,'sms-ledger.json');let ledger={};if(fs.existsSync(ledgerPath)){ledger=JSON.parse(fs.readFileSync(ledgerPath,'utf8'));for(const item of Object.values(ledger))if(item.state==='pending')item.state='unknown'}
 const persist=()=>{const temp=ledgerPath+'.tmp';fs.writeFileSync(temp,JSON.stringify(ledger),{mode:0o600});fs.renameSync(temp,ledgerPath)};
 const reply=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))};
 const adminAuth=createAdminAuth(dataRoot,env,reply);
 const storageRoutes=createStorageRoutes({env,fetcher,adminAuth,reply,onApproved:createApprovalNotifier({env,fetcher,ledger,persist})});
 if(storageRoutes.store.configured)adminAuth.setPersistence(storageRoutes.authPersistence);
 const learnerRoutes=createLearnerRoutes({store:storageRoutes.store,reply,adminAuth,readForWrite:()=>storageRoutes.readForWrite(),remember:state=>storageRoutes.remember(state),origin:env.RENDER_EXTERNAL_URL?new URL(env.RENDER_EXTERNAL_URL).origin:undefined,invalidate:()=>storageRoutes.invalidate(),sendCode:async(phone,code)=>{
  if(!env.SOLAPI_API_KEY||!env.SOLAPI_API_SECRET||!/^0\d{8,10}$/.test(env.SOLAPI_FROM||''))throw Error('휴대폰 인증 문자 설정을 확인할 수 없습니다. 교육 담당자에게 문의하세요.');
  const messages=validateMessages([{to:phone,text:'[태광러닝센터] 내 신청 조회 인증번호 ['+code+']를 5분 안에 입력해 주세요.'}],env.SOLAPI_FROM);
  const response=await fetcher('https://api.solapi.com/messages/v4/send-many/detail',{method:'POST',headers:{'Content-Type':'application/json',Authorization:authHeader(env.SOLAPI_API_KEY,env.SOLAPI_API_SECRET)},body:JSON.stringify({messages,allowDuplicates:true,showMessageList:true}),signal:AbortSignal.timeout(25000)});
  const data=await response.json();if(!response.ok||data.groupInfo?.count?.registeredSuccess!==1||data.groupInfo?.count?.registeredFailed!==0)throw Error('인증 문자를 보내지 못했습니다. 잠시 후 다시 시도하세요.');
 }});
 return http.createServer(async(req,res)=>{
 try{
 if(req.method==='GET'&&req.url==='/health'){reply(res,200,{ok:true});return}
 const expectedHost=env.HOST_HEADER||(env.RENDER_EXTERNAL_URL?new URL(env.RENDER_EXTERNAL_URL).host:'127.0.0.1:'+String(env.PORT||8787));if(req.headers.host!==expectedHost)return reply(res,403,{error:'허용되지 않은 호스트입니다.'});
 const url=new URL(req.url,'http://'+expectedHost);
 if(await adminAuth.handle(req,res,url.pathname))return;
 if(await learnerRoutes.handle(req,res,url))return;
 if(await storageRoutes.handle(req,res,url))return;
 if(req.method==='GET'&&url.pathname==='/assets/taekwang-ci.png'){res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=86400'});fs.createReadStream(path.join(root,'assets','taekwang-ci.png')).pipe(res);return}
 if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/education_portal_v3_1.html')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});fs.createReadStream(path.join(root,'education_portal_v3_1.html')).pipe(res);return}
 if(req.method!=='POST'||url.pathname!=='/api/sms/send')return reply(res,404,{error:'요청 경로를 찾지 못했습니다.'});
 if(!adminAuth.authenticated(req))return reply(res,401,{error:'관리자 로그인 시간이 만료되었습니다. 다시 로그인하세요.'});
 if(req.headers.origin&&req.headers.origin!==(env.RENDER_EXTERNAL_URL?new URL(env.RENDER_EXTERNAL_URL).origin:'http://'+expectedHost))return reply(res,403,{error:'동일한 서버 화면에서 요청하세요.'});
 if(!env.SOLAPI_API_KEY||!env.SOLAPI_API_SECRET||!/^0\d{8,10}$/.test(env.SOLAPI_FROM||''))return reply(res,503,{error:'서버에 SOLAPI API Key, Secret, 등록 발신번호를 설정하세요.'});
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return reply(res,415,{error:'JSON 요청만 허용합니다.'});
 const id=req.headers['idempotency-key'];if(typeof id!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(id))return reply(res,400,{error:'요청 식별자가 올바르지 않습니다.'});
 const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8*1024*1024)return reply(res,413,{error:'요청이 너무 큽니다.'});chunks.push(chunk)}const raw=Buffer.concat(chunks).toString('utf8');
 let messages;try{messages=validateMessages(JSON.parse(raw).messages,env.SOLAPI_FROM)}catch(error){return reply(res,400,{error:error.message})}
 const hash=crypto.createHash('sha256').update(JSON.stringify(messages)).digest('hex');
 if(ledger[id]){const old=ledger[id];if(old.hash!==hash)return reply(res,409,{error:'같은 요청 식별자로 내용을 바꿀 수 없습니다.'});if(old.state==='complete')return reply(res,old.httpStatus,old.result);return reply(res,409,{error:'이 요청은 이미 처리 중이거나 접수 결과가 불명확합니다. SOLAPI 발송 내역을 확인하세요.',uncertain:true})}
 // 실제 요청 전에 디스크에 기록해 중복 클릭·재시작·통신 오류로 인한 재발송을 방지합니다.
 ledger[id]={hash,state:'pending',created:new Date().toISOString()};persist();
 try{
 const upstream=await fetcher('https://api.solapi.com/messages/v4/send-many/detail',{method:'POST',headers:{'Content-Type':'application/json','Authorization':authHeader(env.SOLAPI_API_KEY,env.SOLAPI_API_SECRET)},body:JSON.stringify({messages,allowDuplicates:true,showMessageList:true}),signal:AbortSignal.timeout(25000)});
 const data=await upstream.json();if(upstream.status>=500)throw Error('SOLAPI 서버 응답 오류');
 let result,status;if(!upstream.ok){status=502;result={error:'SOLAPI가 요청을 거절했습니다. '+String(data.errorCode||'')+' '+String(data.errorMessage||data.message||'발신번호·계정 상태를 확인하세요.').slice(0,250)}}else{
 const count=data.groupInfo?.count,accepted=count?.registeredSuccess,failed=count?.registeredFailed;
 if(!Number.isInteger(accepted)||!Number.isInteger(failed)||accepted+failed!==messages.length)throw Error('접수 건수를 확인할 수 없습니다.');
 status=200;result={accepted,failed,groupId:data.groupInfo.groupId||'',failures:(data.failedMessageList||[]).map(m=>({to:m.to,reason:m.statusMessage||m.statusCode||'접수 실패'}))};
 }
 ledger[id]={...ledger[id],state:'complete',httpStatus:status,result};persist();return reply(res,status,result);
 }catch(error){ledger[id]={...ledger[id],state:'unknown'};persist();return reply(res,502,{error:'접수 여부가 불명확합니다. 자동 재발송하지 않습니다. SOLAPI 발송 내역을 먼저 확인하세요.',uncertain:true})}
 }catch(error){if(!res.headersSent)reply(res,500,{error:'서버 처리 오류입니다. 발송 요청을 했다면 SOLAPI 발송 내역을 확인하세요.',uncertain:true});else res.end()}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const port=Number(process.env.PORT||8787);createServer().listen(port,process.env.RENDER?'0.0.0.0':'127.0.0.1',()=>console.log('교육 포털: http://127.0.0.1:'+port))}

