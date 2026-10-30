import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(crypto.scrypt);
export function createAdminAuth(root,env,reply){
 const file=env.ADMIN_PASSWORD_FILE||path.join(root,'admin-password.json'),attempts=new Map(),revoked=new Map();let changing=false;
 const keyFile=path.join(root,'admin-session-key');let signingKey=env.ADMIN_SESSION_SECRET||env.GOOGLE_SHEETS_SHARED_SECRET||env.ADMIN_INITIAL_PASSWORD;
 if(!signingKey){if(!fs.existsSync(keyFile))fs.writeFileSync(keyFile,crypto.randomBytes(48).toString('hex'),{mode:0o600});signingKey=fs.readFileSync(keyFile,'utf8')}
 const sign=text=>crypto.createHmac('sha256',signingKey).update(text).digest('base64url');
 const readRecord=()=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
 const version=record=>record?.sessionVersion||record?.hash||'';
 const cookie=req=>{const raw=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('hrd_admin='));return raw?.slice(10)||''};
 const authenticated=req=>{try{const token=cookie(req);if(revoked.has(token))return false;const [body,signature,...extra]=token.split('.');if(!body||!signature||extra.length)return false;const actual=Buffer.from(signature),expected=Buffer.from(sign(body));if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))return false;const data=JSON.parse(Buffer.from(body,'base64url').toString());return data.exp>Date.now()&&data.version===version(readRecord())}catch{return false}};
 const setSession=res=>{const body=Buffer.from(JSON.stringify({exp:Date.now()+7*24*60*60*1000,version:version(readRecord()),nonce:crypto.randomBytes(24).toString('hex')})).toString('base64url');res.setHeader('Set-Cookie',`hrd_admin=${body}.${sign(body)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${env.RENDER_EXTERNAL_URL?.startsWith('https:')?'; Secure':''}`)};
 const verify=async(password,record)=>{if(typeof password!=='string'||!record)return false;const actual=await derive(password,record.salt,64),expected=Buffer.from(record.hash,'hex');return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected)};
 const save=async password=>{const salt=crypto.randomBytes(16).toString('hex'),hash=(await derive(password,salt,64)).toString('hex');const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify({salt,hash,sessionVersion:sign(password)}),{mode:0o600});fs.renameSync(tmp,file)};
 return {authenticated,async handle(req,res,pathname){
 if(!pathname.startsWith('/api/admin/'))return false;
 const action=pathname.slice('/api/admin/'.length);
 if(env.RENDER&&!readRecord()&&!env.ADMIN_INITIAL_PASSWORD){reply(res,503,{error:'공개 서버의 관리자 초기 비밀번호를 Render 환경변수 ADMIN_INITIAL_PASSWORD에 먼저 설정하세요.'});return true}
 if(env.ADMIN_INITIAL_PASSWORD&&!readRecord()){if(env.ADMIN_INITIAL_PASSWORD.length<8){reply(res,503,{error:'ADMIN_INITIAL_PASSWORD는 8자 이상으로 설정하세요.'});return true}if(changing){reply(res,503,{error:'관리자 초기 설정 중입니다. 잠시 후 다시 시도하세요.'});return true}changing=true;try{await save(env.ADMIN_INITIAL_PASSWORD)}finally{changing=false}}
 if(action==='status'&&req.method==='GET'){reply(res,200,{initialized:!!readRecord(),authenticated:authenticated(req)});return true}
 if(req.method!=='POST'){reply(res,405,{error:'지원하지 않는 요청입니다.'});return true}
 const expectedOrigin=env.RENDER_EXTERNAL_URL?new URL(env.RENDER_EXTERNAL_URL).origin:'http://'+(env.HOST_HEADER||'127.0.0.1:'+String(env.PORT||8787));if(req.headers.origin&&req.headers.origin!==expectedOrigin){reply(res,403,{error:'같은 서버 화면에서 요청하세요.'});return true}
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')){reply(res,415,{error:'JSON 요청만 허용합니다.'});return true}
 const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4096){reply(res,413,{error:'요청이 너무 큽니다.'});return true}chunks.push(chunk)}let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{reply(res,400,{error:'올바르지 않은 요청입니다.'});return true}
 if(action==='logout'){for(const [token,expiry] of revoked)if(expiry<Date.now())revoked.delete(token);revoked.set(cookie(req),Date.now()+7*24*60*60*1000);res.setHeader('Set-Cookie','hrd_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');reply(res,200,{ok:true});return true}
 const addr=req.socket.remoteAddress||'local',now=Date.now(),rate=attempts.get(addr)||{count:0,until:now+60000};if(now>rate.until){rate.count=0;rate.until=now+60000}if(rate.count>=10){reply(res,429,{error:'인증 시도가 많습니다. 1분 후 다시 시도하세요.'});return true}rate.count++;attempts.set(addr,rate);
 if(action==='login'){if(!await verify(data.password,readRecord())){reply(res,401,{error:'비밀번호가 일치하지 않습니다.'});return true}setSession(res);reply(res,200,{authenticated:true});return true}
 if(action!=='setup'&&action!=='change'){reply(res,404,{error:'요청을 찾지 못했습니다.'});return true}
 if(changing){reply(res,409,{error:'비밀번호 변경을 처리 중입니다. 다시 시도하세요.'});return true}changing=true;
 try{const record=readRecord();if(action==='setup'&&record){reply(res,409,{error:'이미 비밀번호가 설정되어 있습니다.'});return true}if(action==='change'&&(!authenticated(req)||!await verify(data.currentPassword,record))){reply(res,401,{error:'로그인 상태와 현재 비밀번호를 확인하세요.'});return true}if(typeof data.password!=='string'||data.password.length<8||data.password.length>128){reply(res,400,{error:'비밀번호는 8~128자로 입력하세요.'});return true}await save(data.password);revoked.clear();setSession(res);reply(res,200,{ok:true,authenticated:true});return true}finally{changing=false}
 }};
}

