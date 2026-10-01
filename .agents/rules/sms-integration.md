# Solapi (CoolSMS) 최신 v4 REST API 연동 가이드 및 규칙

이 프로젝트의 문자메시지(SMS/LMS) 발송 기능은 최신 **Solapi REST API v4**를 기반으로 구축되었습니다.

## 1. 아키텍처 및 핵심 파일
- **백엔드 서버**: `server/index.js`
  - 최신 Solapi v4 HMAC-SHA256 암호화 Authorization 헤더 직접 생성
  - 단건 발송: `POST https://api.solapi.com/messages/v4/send`
  - 다건 발송: `POST https://api.solapi.com/messages/v4/send-many`
  - 설정 파일 영구 보관: `server/data/sms-config.json`
- **프론트엔드 API 클라이언트**: `src/api.ts`
  - `getSMSStatus()`: 연동 상태 조회
  - `saveSMSConfig()`: 설정 동적 저장
  - `sendSMS()`: 문자 발송 요청
- **UI 컴포넌트**: `src/components/SMSModal.tsx`
  - 전체 발송 및 체크박스 다중 선택 발송 모드 지원
  - 90바이트 기준 SMS(단문) / LMS(장문) 자동 전환 및 바이트 수 실시간 계산
  - 실무용 추천 템플릿 원클릭 입력 지원
  - 웹 화면에서 즉시 API 키를 수정/저장할 수 있는 인라인 설정 폼 내장

## 2. 인증 헤더 생성 규격 (HMAC-SHA256)
```javascript
const generateSolapiAuthHeader = (apiKey, apiSecret) => {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex');
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
};
```

## 3. 운영 원칙
- 실제 키가 없을 때는 시뮬레이션 모드로 안전하게 폴백되어 시스템 오류 방지
- 전화번호는 하이픈 제거 후 숫자 10~11자리로 정제하여 전송
