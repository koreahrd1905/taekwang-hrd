import crypto from 'node:crypto';
export class SheetsStoreError extends Error{constructor(message,status=503){super(message);this.status=status}}
export function createSheetsStore(env=process.env,fetcher=fetch){
 const url=env.GOOGLE_SHEETS_WEB_APP_URL,secret=env.GOOGLE_SHEETS_SHARED_SECRET;
 const configured=Boolean(url&&secret&&secret.length>=32);
 async function call(action,payload={}){if(!configured)throw new SheetsStoreError('Google Sheets 연결 설정이 필요합니다.');if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url))throw new SheetsStoreError('Google Apps Script 웹 앱 URL 형식을 확인하세요.');const body=Buffer.from(JSON.stringify({action,payload})).toString('base64'),timestamp=String(Date.now()),signature=crypto.createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex');let response;try{response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({timestamp,body,signature}),signal:AbortSignal.timeout(25000)})}catch{throw new SheetsStoreError('공용 저장소 응답을 확인하지 못했습니다. 신청한 경우 같은 화면에서 재시도하면 중복을 방지합니다.')}let data;try{data=await response.json()}catch{throw new SheetsStoreError('공용 저장소 응답 형식이 올바르지 않습니다. Apps Script 배포 권한을 확인하세요.')}if(!response.ok||data.ok!==true)throw new SheetsStoreError(data.error||'공용 저장소 요청 실패',data.status||503);return data.data}
 return {configured,call};
}
export function createStorageRoutes({env,fetcher,adminAuth,reply}){const store=createSheetsStore(env,fetcher);return {store,async handle(req,res,url){
 const route=url.pathname;if(!route.startsWith('/api/data/'))return false;
 if(route==='/api/data/status'&&req.method==='GET'){reply(res,200,{configured:store.configured,mode:store.configured?'google-sheets':'browser-local'});return true}
 const isAdmin=['/api/data/admin','/api/data/save','/api/data/reset'].includes(route);
 if(isAdmin&&!adminAuth.authenticated(req)){reply(res,401,{error:'관리자 로그인 후 이용하세요.'});return true}
 if(req.method==='GET'&&(route==='/api/data/public'||route==='/api/data/admin')){try{reply(res,200,await store.call(route.endsWith('admin')?'admin':'public'))}catch(e){reply(res,e.status||503,{error:e.message})}return true}
 if(req.method!=='POST'||!['/api/data/save','/api/data/reset','/api/data/apply'].includes(route)){reply(res,404,{error:'지원하지 않는 저장소 요청입니다.'});return true}
 const origin=env.RENDER_EXTERNAL_URL?new URL(env.RENDER_EXTERNAL_URL).origin:'http://'+req.headers.host;if(req.headers.origin&&req.headers.origin!==origin){reply(res,403,{error:'같은 사이트 화면에서 요청하세요.'});return true}
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')){reply(res,415,{error:'JSON 요청만 허용합니다.'});return true}
 const chunks=[];let total=0;for await(const chunk of req){total+=chunk.length;if(total>8*1024*1024){reply(res,413,{error:'저장할 데이터가 너무 큽니다. 사진을 줄이거나 자료를 나눠 저장하세요.'});return true}chunks.push(chunk)}let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{reply(res,400,{error:'요청 형식이 올바르지 않습니다.'});return true}
 try{let action,payload;if(route==='/api/data/apply'){const input=body.application||{},allowed=['id','courseId','name','employeeId','company','department','email','phone','reason'];payload={application:Object.fromEntries(allowed.map(k=>[k,input[k]]))};action='apply'}else if(route==='/api/data/reset'){payload={revision:body.revision};action='reset'}else{payload={revision:body.revision,state:body.state};action='save'}reply(res,200,await store.call(action,payload))}catch(e){reply(res,e.status||503,{error:e.message})}return true
 }};}
