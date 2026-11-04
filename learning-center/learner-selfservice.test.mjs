import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLearnerRoutes, canManageApplication, cancellationDeadline, reviewCancellation} from './learner-selfservice.mjs';
import {createServer} from './server.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function fixture() {
  let clock = new Date('2026-11-19T14:59:59Z');
  let state = {revision: 1, courses: [
    {id: 'c1', title: '바이브코딩 1차', date: '2026-11-21', capacity: 2},
    {id: 'c2', title: '파이썬 2차', date: '2026-11-28', capacity: 2}
  ], apps: [
    {id: 'a1', courseId: 'c1', name: '교육생', employeeId: 'E1', phone: '01012345678', company: '회사', department: '팀', email: 'test@example.com', status: '승인', approvalSmsRequestedAt: 'old'},
    {id: 'other', courseId: 'c2', name: '다른사람', employeeId: 'E2', phone: '01022223333', status: '신청완료'}
  ], instructors: [], _adminAuth: {private: true}};
  let code, invalidations = 0, conflict;
  const store = {async call(action, payload) {
    if (action === 'admin') return structuredClone(state);
    assert.equal(action, 'save');
    if (conflict) {
      const callback = conflict; conflict = null; callback(state); state.revision++;
      throw Object.assign(Error('동시 신청'), {status: 409});
    }
    assert.equal(payload.revision, state.revision);
    state = {...structuredClone(payload.state), revision: state.revision + 1};
    return {revision: state.revision};
  }};
  let result;
  const routes = createLearnerRoutes({store, adminAuth:{authenticated:req=>req.headers['x-test-admin']==='yes'}, now: () => clock, origin: 'https://learning.example',
    sendCode: async (_phone, sent) => { code = sent; }, invalidate: () => { invalidations++; },
    reply: (_res, status, body) => {result = {status, body};}});
  const request = async (action, body, extra = {}) => {
    await routes.handle({method: 'POST', socket: {remoteAddress: '127.0.0.1'},
      headers: {'content-type': 'application/json', origin: 'https://learning.example', ...extra},
      async *[Symbol.asyncIterator]() {yield Buffer.from(JSON.stringify(body));}}, {}, new URL('http://learning.example/api/learner/' + action));
    return result;
  };
  const login = async () => {
    const sent = await request('request-code', {name: '교육생', employeeId: 'e1', phone: '010-1234-5678'});
    assert.equal(sent.status, 200);
    assert(!JSON.stringify(sent.body).includes(code));
    const verified = await request('verify', {challengeId: sent.body.challengeId, code});
    assert.equal(verified.status, 200);
    assert.equal(verified.body.applications.length, 1);
    assert(!JSON.stringify(verified.body).includes('private'));
    assert(!JSON.stringify(verified.body).includes('다른사람'));
    return verified.body.token;
  };
  return {request, login, store, getState: () => state, setTime: value => {clock = new Date(value);},
    conflict: callback => {conflict = callback;}, invalidations: () => invalidations};
}

test('마감은 한국시간 교육일 2일 전 마지막 초까지이며 보관 과정은 차단', () => {
  const c = {date: '2026-11-21'};
  assert.equal(cancellationDeadline(c), '2026-11-19');
  assert(canManageApplication(c, new Date('2026-11-19T14:59:59.999Z')));
  assert(!canManageApplication(c, new Date('2026-11-19T15:00:00Z')));
  assert.equal(cancellationDeadline({date: '2027-01-01'}), '2026-12-30');
  assert(!canManageApplication({...c, archived: true}, new Date('2026-11-18')));
});

test('취소신청은 승인 상태와 정원을 유지하고 재요청은 중복 저장하지 않음', async () => {
  const f = fixture(), token = await f.login();
  const result = await f.request('cancel', {token, applicationId: 'a1'});
  assert.equal(result.status, 200);
  assert.equal(f.getState().apps.find(a => a.id === 'a1').status, '승인');
  assert.equal(result.body.applications[0].status,'취소신청');
  assert.equal(f.getState().apps.filter(a => a.courseId === 'c1' && ['승인','신청완료'].includes(a.status)).length, 1);
  assert.deepEqual(f.getState()._adminAuth, {private: true});
  const revision = f.getState().revision;
  assert.equal((await f.request('cancel', {token, applicationId: 'a1'})).status, 200);
  assert.equal(f.getState().revision, revision);
  assert.equal(f.invalidations(), 1);
});

test('본인 확인 없는 요청과 다른 사람의 신청 취소는 거부', async () => {
  const f = fixture();
  assert.equal((await f.request('cancel', {applicationId: 'a1'})).status, 401);
  const token = await f.login();
  assert.equal((await f.request('cancel', {token, applicationId: 'other'})).status, 404);
  assert.equal((await f.request('list', {token}, {origin: 'https://other.example'})).status, 403);
  f.setTime('2026-11-19T15:16:00Z');
  assert.equal((await f.request('list', {token})).status, 401);
});

test('마감일 다음날에는 승인·신청완료 취소와 변경 모두 거부', async () => {
  const f = fixture(), token = await f.login();
  f.setTime('2026-11-19T15:00:00Z');
  assert.equal((await f.request('cancel', {token, applicationId: 'a1'})).status, 409);
  assert.equal((await f.request('change', {token, applicationId: 'a1', courseId: 'c2', requestId: 'new'})).status, 409);
  assert.equal(f.getState().revision, 1);
});

test('과정 변경은 관리자 검토 후 기존 취소와 새 신청을 함께 저장', async () => {
  const f = fixture(), token = await f.login();
  const body = {token, applicationId: 'a1', courseId: 'c2', requestId: 'new-request'};
  assert.equal((await f.request('change', body)).status, 200);
  assert.equal(f.getState().apps.length,2);
  assert.equal(f.getState().apps[0].status,'승인');
  assert.equal((await f.request('review-cancellation',{applicationId:'a1',decision:'complete'},{'x-test-admin':'yes'})).status,200);
  const state = f.getState(), replacement = state.apps.find(a => a.id === 'new-request');
  assert.equal(state.apps.find(a => a.id === 'a1').status, '취소');
  assert.equal(replacement.status, '신청완료');
  assert.equal(replacement.replacesApplicationId, 'a1');
  assert(!replacement.approvalSmsRequestedAt);
  assert.equal((await f.request('change', body)).status, 200);
  assert.equal(f.getState().revision, 3);
  assert.equal(f.getState().apps.length, 3);
});

test('정원 마감과 중복 신청 시 원래 신청을 보존', async () => {
  const f = fixture(), token = await f.login();
  f.getState().courses[1].capacity = 1;
  assert.equal((await f.request('change', {token, applicationId: 'a1', courseId: 'c2', requestId: 'new'})).status, 409);
  assert.equal(f.getState().apps[0].status, '승인');
  f.getState().courses[1].capacity = 3;
  f.getState().apps[1].employeeId = 'E1';
  assert.equal((await f.request('change', {token, applicationId: 'a1', courseId: 'c2', requestId: 'new'})).status, 409);
  assert.equal(f.getState().revision, 1);
});

test('동시 접수 충돌 뒤 최신 정원을 다시 검증하여 기존 신청 보존', async () => {
  const f = fixture(), token = await f.login();
  f.conflict(state => state.apps.push({...state.apps[1], id: 'concurrent', employeeId: 'E3'}));
  const result = await f.request('change', {token, applicationId: 'a1', courseId: 'c2', requestId: 'new'});
  assert.equal(result.status, 409);
  assert.equal(f.getState().apps[0].status, '승인');
  assert(f.getState().apps.some(a => a.id === 'concurrent'));
});

test('인증번호 오입력은 5회로 제한하고 재발송 간격을 적용', async () => {
  const f = fixture();
  const data = {name: '교육생', employeeId: 'E1', phone: '01012345678'};
  const sent = await f.request('request-code', data);
  assert.equal((await f.request('request-code', data)).status, 429);
  for (let i = 0; i < 6; i++) assert.equal((await f.request('verify', {challengeId: sent.body.challengeId, code: '000000'})).status, 401);
});

test('HTTP 진입점에서 관리자 로그인 없이 SMS 본인 인증과 취소 저장 가능', async t => {
  const f = fixture();
  // Future dates keep this test independent of the execution date.
  f.getState().courses[0].date = '2099-11-21';
  let sentCode;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-http-'));
  const env = {DATA_DIR: dir, HOST_HEADER: 'test.local', GOOGLE_SHEETS_WEB_APP_URL: 'https://script.google.com/macros/s/test/exec',
    GOOGLE_SHEETS_SHARED_SECRET: 'test-secret-for-cancel-requests-12345678', SOLAPI_API_KEY: 'test', SOLAPI_API_SECRET: 'test', SOLAPI_FROM: '0220000000'};
  const server = createServer({env, fetcher: async (url, options) => {
    if (url.startsWith('https://api.solapi.com/')) {
      const sms = JSON.parse(options.body).messages[0];
      sentCode = sms.text.match(/\[(\d{6})\]/)[1];
      return Response.json({groupInfo: {count: {registeredSuccess: 1, registeredFailed: 0}}});
    }
    const envelope = JSON.parse(options.body), request = JSON.parse(Buffer.from(envelope.body, 'base64'));
    return Response.json({ok: true, data: await f.store.call(request.action, request.payload)});
  }});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  env.HOST_HEADER = '127.0.0.1:' + server.address().port;
  t.after(async () => {await new Promise(resolve => server.close(resolve)); fs.rmSync(dir, {recursive: true, force: true});});
  const call = async (action, body) => {
    const r = await fetch('http://127.0.0.1:' + server.address().port + '/api/learner/' + action, {
      method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
    assert.equal(r.status, 200);
    return r.json();
  };
  const challenge = await call('request-code', {name: '교육생', employeeId: 'E1', phone: '01012345678'});
  const verified = await call('verify', {challengeId: challenge.challengeId, code: sentCode});
  const cancelled = await call('cancel', {token: verified.token, applicationId: 'a1'});
  assert.equal(cancelled.applications[0].status, '취소신청');
  assert.equal(f.getState().apps[0].status,'승인');
});


test('관리자만 최종 취소완료 가능하며 완료 이력을 독립 스냅샷으로 보관',async()=>{
 const f=fixture(),token=await f.login();await f.request('cancel',{token,applicationId:'a1'});
 const body={applicationId:'a1',decision:'complete'};
 assert.equal((await f.request('review-cancellation',body)).status,401);
 assert.equal((await f.request('review-cancellation',body,{'x-test-admin':'yes'})).status,200);
 assert.equal(f.getState().apps[0].status,'취소');
 assert.equal(f.getState().cancellationHistory.length,1);
 assert.equal(f.getState().cancellationHistory[0].courseTitle,'바이브코딩 1차');
 assert.equal(f.getState().cancellationHistory[0].cancellationRequest.state,'completed');
 assert.equal((await f.request('review-cancellation',body,{'x-test-admin':'yes'})).status,200);
 assert.equal(f.getState().cancellationHistory.length,1);
});

test('취소신청 반려는 기존 승인·인원을 유지하고 취소완료 이력을 만들지 않음',async()=>{
 const f=fixture(),token=await f.login();await f.request('cancel',{token,applicationId:'a1'});
 assert.equal((await f.request('review-cancellation',{applicationId:'a1',decision:'reject'},{'x-test-admin':'yes'})).status,200);
 assert.equal(f.getState().apps[0].status,'승인');
 assert.equal(f.getState().apps[0].cancellationRequest.state,'rejected');
 assert.equal(f.getState().cancellationHistory?.length||0,0);
});

test('기한 내 접수된 취소신청은 마감일 이후에도 관리자가 완료할 수 있음',async()=>{
 const f=fixture(),token=await f.login();await f.request('cancel',{token,applicationId:'a1'});
 f.setTime('2026-11-21T00:00:00Z');
 assert.equal((await f.request('review-cancellation',{applicationId:'a1',decision:'complete'},{'x-test-admin':'yes'})).status,200);
});

test('변경신청 검토 중 정원이 찬 경우 원래 승인과 검토 대기를 보존',async()=>{
 const f=fixture(),token=await f.login();await f.request('change',{token,applicationId:'a1',courseId:'c2',requestId:'new'});
 f.getState().courses[1].capacity=1;
 assert.equal((await f.request('review-cancellation',{applicationId:'a1',decision:'complete'},{'x-test-admin':'yes'})).status,409);
 assert.equal(f.getState().apps[0].status,'승인');
 assert.equal(f.getState().apps[0].cancellationRequest.state,'pending');
 assert.equal(f.getState().apps.length,2);
});
