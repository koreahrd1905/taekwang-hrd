import crypto from 'node:crypto';

const active = application => ['신청완료', '승인'].includes(application.status);
const phoneOf = value => String(value || '').replace(/[\s()-]/g, '');
const seoulDay = now => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(now);

export function cancellationDeadline(course) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(course?.date || '')) return '';
  const date = new Date(course.date + 'T00:00:00Z');
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() - 2);
  return date.toISOString().slice(0, 10);
}

export function canManageApplication(course, now = new Date()) {
  return Boolean(course && !course.archived && cancellationDeadline(course) &&
    seoulDay(now) <= cancellationDeadline(course));
}

export function reviewCancellation(latest, applicationId, decision, now = new Date()) {
  const application = latest.apps.find(a => a.id === applicationId);
  if (!application) throw Object.assign(Error('신청내역을 찾을 수 없습니다.'), {status: 404});
  const request = application.cancellationRequest;
  if (!request) throw Object.assign(Error('취소신청 내역이 없습니다.'), {status: 409});
  if (request.state === 'completed' && decision === 'complete' || request.state === 'rejected' && decision === 'reject') return latest;
  if (request.state !== 'pending' || !active(application)) throw Object.assign(Error('이미 처리된 취소신청입니다. 최신 내역을 확인하세요.'), {status: 409});
  const state = structuredClone(latest), original = state.apps.find(a => a.id === applicationId);
  original.cancellationRequest.state = decision === 'complete' ? 'completed' : 'rejected';
  original.cancellationRequest.reviewedAt = now.toISOString();
  original.cancellationRequest.reviewedBy = 'admin';
  if (decision === 'reject') return state;
  if (request.targetCourseId) {
    const target = state.courses.find(c => c.id === request.targetCourseId);
    const enrolled = state.apps.filter(a => a.courseId === request.targetCourseId && active(a));
    if (!target || target.archived || target.closed || target.date < seoulDay(now) || enrolled.length >= target.capacity) {
      throw Object.assign(Error('변경할 과정이 마감되었습니다. 기존 신청과 취소신청은 유지됩니다.'), {status: 409});
    }
    if (enrolled.some(a => a.employeeId.toLowerCase() === application.employeeId.toLowerCase())) {
      throw Object.assign(Error('변경할 과정에 이미 신청되어 있습니다.'), {status: 409});
    }
    if (state.apps.some(a => a.id === request.requestId)) throw Object.assign(Error('변경 신청 식별자가 중복됩니다.'), {status: 409});
    const replacement = Object.fromEntries(['name','employeeId','company','department','jobGrade','email','phone','reason'].map(key => [key, application[key] || '']));
    state.apps.push({...replacement, id: request.requestId, courseId: target.id, status: '신청완료',
      created: seoulDay(now), createdAt: now.toISOString(), createdTime: new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now), replacesApplicationId: application.id});
    original.replacementApplicationId = request.requestId;
  }
  original.status = '취소'; original.cancelledAt = now.toISOString(); original.cancelledBy = 'admin';
  const source = state.courses.find(c => c.id === application.courseId);
  state.cancellationHistory ||= [];
  state.cancellationHistory.push({...structuredClone(original), courseTitle: source?.title || application.courseTitle || '삭제된 과정', courseDate: source?.date || '', completedAt: now.toISOString()});
  return state;
}

export function createLearnerRoutes({store, reply, sendCode, invalidate = () => {}, adminAuth, readForWrite, remember = () => {}, origin, now = () => new Date()}) {
  const challenges = new Map(), sessions = new Map(), rates = new Map();
  const owns = (identity, application) => application.name.trim() === identity.name &&
    application.employeeId.trim().toLowerCase() === identity.employeeId &&
    phoneOf(application.phone) === identity.phone;
  const rows = (state, identity) => state.apps.filter(a => owns(identity, a)).map(a => {
    const course = state.courses.find(c => c.id === a.courseId);
    return {id: a.id, courseId: a.courseId, title: course?.title || '삭제된 과정',
      date: course?.date || '', startTime: course?.startTime || '', endTime: course?.endTime || '',
      status: a.status === '취소' ? '취소완료' : a.cancellationRequest?.state === 'pending' ? '취소신청' : a.status, requestKind: a.cancellationRequest?.targetCourseId ? '변경' : '취소', deadline: cancellationDeadline(course),
      canManage: active(a) && a.cancellationRequest?.state !== 'pending' && canManageApplication(course, now())};
  });
  const prune = () => {
    const time = now().getTime();
    for (const map of [challenges, sessions, rates]) {
      for (const [key, value] of map) if (value.expires <= time) map.delete(key);
    }
  };
  const fail = (message, status = 400) => Object.assign(new Error(message), {status});
  return {async handle(req, res, url) {
    if (!url.pathname.startsWith('/api/learner/')) return false;
    try {
      if (req.method !== 'POST') throw fail('POST 요청만 허용합니다.', 405);
      if (req.headers.origin && req.headers.origin !== (origin || url.origin)) throw fail('같은 사이트에서 이용하세요.', 403);
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw fail('JSON 요청만 허용합니다.', 415);
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 4096) throw fail('입력 내용을 확인하세요.', 413);
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { throw fail('입력 내용을 확인하세요.'); }
      if (!body || typeof body !== 'object') throw fail('입력 내용을 확인하세요.');
      prune();
      const route = url.pathname.slice('/api/learner/'.length), time = now().getTime();
      if (route === 'request-code') {
        const identity = {name: String(body.name || '').trim(),
          employeeId: String(body.employeeId || '').trim().toLowerCase(), phone: phoneOf(body.phone)};
        if (!identity.name || identity.name.length > 30 || !identity.employeeId || identity.employeeId.length > 30 ||
            !/^010\d{8}$/.test(identity.phone)) throw fail('신청 시 입력한 성명·사번·휴대폰 번호를 확인하세요.');
        const ipKey = 'ip:' + req.socket.remoteAddress, phoneKey = 'phone:' + identity.phone;
        if ((rates.get(ipKey)?.count || 0) >= 100) throw fail('인증 요청이 많습니다. 1시간 후 다시 이용하세요.', 429);
        const rate = rates.get(phoneKey);
        if (rate && (time - rate.last < 60000 || rate.count >= 5)) throw fail('인증번호는 1분 간격, 시간당 5회까지 요청할 수 있습니다.', 429);
        for (const key of [ipKey, phoneKey]) {
          const previous = rates.get(key);
          rates.set(key, {count: (previous?.count || 0) + 1, last: time, expires: previous?.expires || time + 3600000});
        }
        const code = String(crypto.randomInt(100000, 1000000)), challengeId = crypto.randomUUID();
        await sendCode(identity.phone, code);
        challenges.set(challengeId, {identity, code, attempts: 0, expires: time + 300000});
        reply(res, 200, {challengeId, message: '입력한 휴대폰으로 인증번호를 보냈습니다. 5분 안에 입력하세요.'});
        return true;
      }
      if (route === 'verify') {
        const challenge = challenges.get(body.challengeId);
        if (!challenge || challenge.attempts >= 5) throw fail('인증번호를 다시 요청하세요.', 401);
        challenge.attempts++;
        if (String(body.code) !== challenge.code) throw fail('인증번호가 일치하지 않습니다.', 401);
        challenges.delete(body.challengeId);
        const token = crypto.randomBytes(32).toString('hex');
        const state = await store.call('admin');
        sessions.set(token, {identity: challenge.identity, expires: time + 900000});
        reply(res, 200, {token, applications: rows(state, challenge.identity)});
        return true;
      }
      if (route === 'review-cancellation') {
        if (adminAuth?.ensureReady) await adminAuth.ensureReady();
        if (!adminAuth?.authenticated(req)) throw fail('관리자 로그인 후 이용하세요.', 401);
        if (!['complete','reject'].includes(body.decision) || typeof body.applicationId !== 'string') throw fail('처리할 취소신청을 선택하세요.');
        let latest = readForWrite ? await readForWrite() : await store.call('admin');
        const responseFor = (record, warning = '') => {
          const {_adminAuth, ...state} = record;
          return {ok: true, revision: record.revision, state, warning};
        };
        for (let attempt = 0; attempt < 4; attempt++) {
          const state = reviewCancellation(latest, body.applicationId, body.decision, now());
          if (state === latest) { reply(res, 200, responseFor(latest)); return true; }
          try {
            const saved = await store.call('save', {revision: latest.revision, state}, {
              verifySaved: record => {
                const application = record.apps.find(a => a.id === body.applicationId);
                return application?.cancellationRequest?.state === (body.decision === 'complete' ? 'completed' : 'rejected') &&
                  (body.decision !== 'complete' || record.cancellationHistory?.some(a => a.id === body.applicationId));
              }
            });
            const record = saved.recoveredState || {...state, revision: saved.revision};
            invalidate(); remember(record);
            reply(res, 200, responseFor(record, saved.warning || '')); return true;
          } catch (error) {
            if (error.status !== 409 || attempt === 3) throw error;
            latest = await store.call('admin');
          }
        }
      }
      const session = sessions.get(body.token);
      if (!session) throw fail('본인 확인 시간이 만료되었습니다. 다시 인증하세요.', 401);
      if (route === 'list') {
        reply(res, 200, {applications: rows(await store.call('admin'), session.identity)});
        return true;
      }
      if (!['cancel', 'change'].includes(route)) throw fail('지원하지 않는 요청입니다.', 404);
      if (typeof body.applicationId !== 'string') throw fail('신청내역을 선택하세요.');
      if (route === 'change' && (!/^[A-Za-z0-9_-]{1,100}$/.test(body.requestId || '') || typeof body.courseId !== 'string')) {
        throw fail('변경할 과정을 선택하세요.');
      }
      for (let attempt = 0; attempt < 4; attempt++) {
        const latest = await store.call('admin');
        const application = latest.apps.find(a => a.id === body.applicationId && owns(session.identity, a));
        if (!application) throw fail('본인의 신청내역을 찾을 수 없습니다.', 404);
        if (application.cancellationRequest?.state === 'pending' || application.status === '취소') {
          reply(res, 200, {applications: rows(latest, session.identity)}); return true;
        }
        const source = latest.courses.find(c => c.id === application.courseId);
        if (!active(application)) throw fail('신청완료·승인 상태의 신청만 취소하거나 변경할 수 있습니다.', 409);
        if (!canManageApplication(source, now())) throw fail('취소·변경은 교육 시작일 2일 전까지 가능합니다. 교육 담당자에게 문의하세요.', 409);
        const state = structuredClone(latest);
        const original = state.apps.find(a => a.id === application.id);
        original.cancellationRequest = {state:'pending', requestedAt: now().toISOString(), previousStatus: application.status};
        if (route === 'change') {
          const target = state.courses.find(c => c.id === body.courseId);
          const enrolled = state.apps.filter(a => a.courseId === body.courseId && active(a));
          if (!target || target.id === source.id || target.closed || !canManageApplication(target, now()) || enrolled.length >= target.capacity) {
            throw fail('변경할 과정이 마감되었거나 변경 기한이 지났습니다. 기존 신청은 유지됩니다.', 409);
          }
          if (enrolled.some(a => a.employeeId.toLowerCase() === application.employeeId.toLowerCase())) throw fail('이미 신청한 과정입니다.',409);
          original.cancellationRequest.targetCourseId = target.id;
          original.cancellationRequest.requestId = body.requestId;
        }
        try {
          await store.call('save', {revision: latest.revision, state});
          invalidate();
          reply(res, 200, {applications: rows(state, session.identity)});
          return true;
        } catch (error) {
          if (error.status !== 409 || attempt === 3) throw error;
        }
      }
    } catch (error) { reply(res, error.status || 503, {error: error.message}); }
    return true;
  }};
}
