import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// ==============================================================================
// [CoolSMS (Solapi) 최신 REST API v4 연동 설정]
// 안내: 발신에 필요한 API_KEY, API_SECRET, 발신번호를 아래에 직접 입력하거나,
// 웹 관리자 화면의 [API 설정] 모달에서 입력하여 즉시 운영 모드로 가동할 수 있습니다.
// ==============================================================================
export const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY || 'NCSDEBO3KXBWFDKB';
export const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET || 'O86UJ7Z38YEQLJPZXYPBDG6S3IHQHBL5';
export const SOLAPI_SENDER_PHONE = process.env.SOLAPI_SENDER_PHONE || '01096581905'; // 등록된 발신번호

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// Enable CORS and body parser
app.use(cors());
app.use(express.json());

// JSON Parsing Error Handler to prevent server crash
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('[Server Error] 잘못된 JSON 요청 방어:', err.message);
    return res.status(400).send({ error: 'Invalid JSON payload' });
  }
  next();
});

// Path to data files
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'submissions.json');
const SMS_CONFIG_FILE = path.join(DATA_DIR, 'sms-config.json');
const GITHUB_CONFIG_FILE = path.join(DATA_DIR, 'github-config.json');

// ==============================================================================
// Database URL (파이어베이스 미사용 시 빈 문자열로 유지)
// ==============================================================================
const FIREBASE_RTDB_URL = process.env.FIREBASE_RTDB_URL || '';

// ==============================================================================
// GitHub Auto-Sync Configuration (실시간 GitHub Push 설정)
// ==============================================================================
const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'koreahrd1905';
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'taekwang-hrd';
const GITHUB_FILE_PATH = 'server/data/submissions.json';
let activeGithubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

// Load GitHub token from github-config.json if available
const loadGithubConfig = () => {
  try {
    if (fs.existsSync(GITHUB_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(GITHUB_CONFIG_FILE, 'utf-8'));
      if (data.githubToken) activeGithubToken = data.githubToken;
      console.log('[GitHub Auto-Sync] 저장된 GitHub 토큰 설정을 로드했습니다.');
    }
  } catch (err) {
    console.error('Failed to load github-config.json:', err);
  }
};
loadGithubConfig();

/**
 * GitHub REST API를 통해 server/data/submissions.json 파일을 실시간 Commit & Push
 */
const syncToGitHub = async (data, commitMessage = 'Auto-backup: 과제 제출 실시간 자동 저장') => {
  if (!activeGithubToken) {
    return false;
  }

  try {
    const apiUrl = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${GITHUB_FILE_PATH}`;
    const headers = {
      'Authorization': `Bearer ${activeGithubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Taekwang-HRD-App'
    };

    // 1. 기존 파일의 SHA 조회
    let sha = null;
    try {
      const getRes = await fetch(apiUrl, { method: 'GET', headers });
      if (getRes.ok) {
        const fileInfo = await getRes.json();
        sha = fileInfo.sha;
      }
    } catch (e) {
      console.warn('[GitHub Auto-Sync] 기존 파일 SHA 조회 실패 (신규 커밋 시도):', e.message);
    }

    // 2. 파일 내용 Base64 인코딩
    const contentStr = JSON.stringify(data, null, 2);
    const contentBase64 = Buffer.from(contentStr, 'utf-8').toString('base64');

    // 3. GitHub API로 파일 커밋 & 푸시
    const putPayload = {
      message: commitMessage,
      content: contentBase64,
      ...(sha ? { sha } : {})
    };

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(putPayload)
    });

    if (putRes.ok) {
      const result = await putRes.json();
      console.log(`[GitHub Auto-Sync] 성공적으로 GitHub에 자동 푸시 완료! (Commit: ${result.commit?.sha?.substring(0, 7)})`);
      return true;
    } else {
      const errData = await putRes.json();
      console.error('[GitHub Auto-Sync] GitHub 푸시 실패:', putRes.status, errData.message);
      return false;
    }
  } catch (err) {
    console.error('[GitHub Auto-Sync] 네트워크 오류 발생:', err.message);
    return false;
  }
};

// Active SMS credentials
let activeApiKey = SOLAPI_API_KEY;
let activeApiSecret = SOLAPI_API_SECRET;
let activeSenderPhone = SOLAPI_SENDER_PHONE;

// Load SMS credentials from sms-config.json if available
const loadSMSConfig = () => {
  try {
    if (fs.existsSync(SMS_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(SMS_CONFIG_FILE, 'utf-8'));
      if (data.apiKey && data.apiKey !== 'YOUR_SOLAPI_API_KEY') activeApiKey = data.apiKey;
      if (data.apiSecret && data.apiSecret !== 'YOUR_SOLAPI_API_SECRET') activeApiSecret = data.apiSecret;
      if (data.senderPhone && data.senderPhone !== '01000000000') activeSenderPhone = data.senderPhone;
      console.log('[Solapi SMS] 저장된 외부 설정 파일(sms-config.json)을 로드했습니다.');
    }
  } catch (err) {
    console.error('Failed to load sms-config.json:', err);
  }
};
loadSMSConfig();

// Ensure data directory and file exist
const initDataStore = () => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
      console.log('Initialized empty database file:', DATA_FILE);
    }
  } catch (err) {
    console.error('Failed to initialize database folder/file:', err);
  }
};
initDataStore();

// Read data helper
const readSubmissions = async () => {
  // 1. Firebase 연동이 설정된 경우 먼저 원격 DB 조회를 시도
  if (FIREBASE_RTDB_URL) {
    try {
      const res = await fetch(`${FIREBASE_RTDB_URL}/submissions.json`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          const list = Array.isArray(data) ? data : Object.values(data);
          // Firebase에 데이터가 있는 경우 로컬 파일에도 최신 데이터 백업 저장
          try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
          } catch (writeErr) {
            console.error('[Backup Error] 로컬 파일 백업 실패:', writeErr);
          }
          return list;
        }
      } else {
        console.warn(`[Firebase DB] 응답 오류 (HTTP ${res.status}): 로컬 저장소로 자동 폴백합니다.`);
      }
    } catch (err) {
      console.warn('[Firebase DB] 네트워크/권한 오류:', err.message, '-> 로컬 저장소로 자동 폴백합니다.');
    }
  }

  // 2. Firebase가 실패하거나 데이터가 없을 때 로컬 파일에서 안전하게 복구 로드
  try {
    if (fs.existsSync(DATA_FILE)) {
      const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
      const localData = JSON.parse(rawData);
      if (Array.isArray(localData)) {
        return localData;
      }
    }
  } catch (err) {
    console.error('Error reading local submissions file:', err);
  }
  return [];
};

// Write data helper
const writeSubmissions = async (data, commitMsg) => {
  let localSaved = false;

  // 1. 항상 먼저 로컬 파일에 안전하게 저장 (데이터 유실 방지)
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    localSaved = true;
  } catch (err) {
    console.error('Error writing local submissions file:', err);
  }

  // 2. GitHub 저장소에 실시간 자동 Push (백그라운드 비동기)
  syncToGitHub(data, commitMsg).catch(err => {
    console.error('[GitHub Auto-Sync Error]', err.message);
  });

  // 3. Firebase RTDB에도 동기화 시도 (설정 시)
  if (FIREBASE_RTDB_URL) {
    try {
      const res = await fetch(`${FIREBASE_RTDB_URL}/submissions.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        console.log('[Firebase RTDB] 정상 동기화 완료');
      } else {
        console.warn(`[Firebase RTDB] 동기화 실패 (HTTP ${res.status}): 권한 규칙 확인 필요`);
      }
    } catch (err) {
      console.error('[Firebase RTDB] 동기화 네트워크 오류:', err.message);
    }
  }

  return localSaved;
};

/**
 * Solapi v4 HMAC-SHA256 Authorization 헤더 생성
 * 규격: HMAC-SHA256 apiKey=${API_KEY}, date=${date}, salt=${salt}, signature=${signature}
 */
const generateSolapiAuthHeader = (apiKey, apiSecret) => {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex');
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
};

/**
 * API Routes
 */

// 1. Get all submissions
app.get('/api/submissions', async (req, res) => {
  const data = await readSubmissions();
  res.json(data);
});

// 2. Add new submission
app.post('/api/submissions', async (req, res) => {
  const newSubmission = req.body;

  if (!newSubmission || !newSubmission.name || !newSubmission.department) {
    return res.status(400).json({ error: 'Name and department are required.' });
  }

  const currentData = await readSubmissions();

  // Prevent duplicate ID insertion if client sent it
  const isDuplicate = currentData.some(item => item.id === newSubmission.id);
  if (isDuplicate) {
    newSubmission.id = 'sub_' + Math.random().toString(36).substr(2, 9);
  }

  currentData.unshift(newSubmission); // Add to the top of list

  const commitMsg = `과제제출 자동저장: ${newSubmission.name} (${newSubmission.department}) [${newSubmission.cardType || ''}]`;
  const success = await writeSubmissions(currentData, commitMsg);
  if (success) {
    res.status(201).json(newSubmission);

    // ==========================================
    // 자동 과제 접수 완료 안내 문자 발송 로직 추가
    // ==========================================
    if (newSubmission.phone) {
      const targetPhone = newSubmission.phone.replace(/[^0-9]/g, '');
      const cleanSender = (activeSenderPhone || '').replace(/[^0-9]/g, '');
      const isKeyConfigured =
        Boolean(activeApiKey) && activeApiKey !== 'YOUR_SOLAPI_API_KEY' &&
        Boolean(activeApiSecret) && activeApiSecret !== 'YOUR_SOLAPI_API_SECRET' &&
        Boolean(cleanSender) && cleanSender !== '01000000000';

      if (targetPhone.length >= 10 && isKeyConfigured) {
        const authHeader = generateSolapiAuthHeader(activeApiKey, activeApiSecret);
        const payload = {
          message: {
            to: targetPhone,
            from: cleanSender,
            text: '[태광 창업주 경영철학]\n선행학습 성찰 과제가 정상적으로 접수되었습니다. 성실한 참여에 감사드립니다.'
          }
        };

        fetch('https://api.solapi.com/messages/v4/send', {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json; charset=utf-8'
          },
          body: JSON.stringify(payload)
        })
          .then(r => r.json())
          .then(data => console.log('[Auto SMS] 자동 접수 안내 문자 발송 결과:', data))
          .catch(err => console.error('[Auto SMS] 자동 접수 안내 문자 발송 오류:', err));
      }
    }
  } else {
    res.status(500).json({ error: 'Failed to write data to storage.' });
  }
});

// 3. Delete individual submission
app.delete('/api/submissions/:id', async (req, res) => {
  const idToDelete = req.params.id;
  const currentData = await readSubmissions();

  const filteredData = currentData.filter(item => item.id !== idToDelete);

  if (currentData.length === filteredData.length) {
    return res.status(404).json({ error: 'Submission not found.' });
  }

  const success = await writeSubmissions(filteredData, `과제삭제 자동저장: ${idToDelete}`);
  if (success) {
    res.json({ message: 'Submission deleted successfully.', id: idToDelete });
  } else {
    res.status(500).json({ error: 'Failed to update storage.' });
  }
});

// 4. Delete all submissions (reset)
app.delete('/api/submissions', async (req, res) => {
  const success = await writeSubmissions([]);
  if (success) {
    res.json({ message: 'All submissions cleared successfully.' });
  } else {
    res.status(500).json({ error: 'Failed to clear storage.' });
  }
});

// 5. Check SMS Service Configuration Status
app.get('/api/sms/status', (req, res) => {
  const isKeyConfigured =
    Boolean(activeApiKey) &&
    activeApiKey !== 'YOUR_SOLAPI_API_KEY' &&
    Boolean(activeApiSecret) &&
    activeApiSecret !== 'YOUR_SOLAPI_API_SECRET' &&
    Boolean(activeSenderPhone) &&
    activeSenderPhone !== '01000000000';

  const cleanSender = (activeSenderPhone || '').replace(/[^0-9]/g, '');

  res.json({
    isConfigured: isKeyConfigured,
    senderPhone: cleanSender ? cleanSender.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3') : '미설정',
    apiKeyMasked: isKeyConfigured
      ? `${activeApiKey.slice(0, 4)}****${activeApiKey.slice(-4)}`
      : '설정 필요'
  });
});

// 6. Update SMS Configuration dynamically
app.post('/api/sms/config', (req, res) => {
  const { apiKey, apiSecret, senderPhone } = req.body;

  if (!apiKey || !apiSecret || !senderPhone) {
    return res.status(400).json({ error: 'API Key, API Secret, 발신번호를 모두 입력해 주세요.' });
  }

  activeApiKey = apiKey.trim();
  activeApiSecret = apiSecret.trim();
  activeSenderPhone = senderPhone.trim().replace(/[^0-9]/g, '');

  try {
    fs.writeFileSync(SMS_CONFIG_FILE, JSON.stringify({
      apiKey: activeApiKey,
      apiSecret: activeApiSecret,
      senderPhone: activeSenderPhone
    }, null, 2), 'utf-8');

    console.log('[Solapi SMS] 새로운 SMS 연동 정보가 성공적으로 저장되었습니다. (운영 모드 활성화)');

    res.json({
      success: true,
      message: 'Solapi 설정이 성공적으로 저장되었습니다. 이제 실제 운영 모드로 발송됩니다.',
      status: {
        isConfigured: true,
        senderPhone: activeSenderPhone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3'),
        apiKeyMasked: `${activeApiKey.slice(0, 4)}****${activeApiKey.slice(-4)}`
      }
    });
  } catch (err) {
    console.error('Failed to write sms-config.json:', err);
    res.status(500).json({ error: '설정 파일 저장 중 오류가 발생했습니다.' });
  }
});

// 7. Send SMS/LMS via Solapi v4 REST API
app.post('/api/sms/send', async (req, res) => {
  try {
    const { recipients, text } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: '수신자 정보가 올바르지 않습니다.' });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: '메시지 내용을 입력해 주세요.' });
    }

    const cleanSender = (activeSenderPhone || '').replace(/[^0-9]/g, '');

    // Check if API credentials are configured
    const isKeyConfigured =
      Boolean(activeApiKey) &&
      activeApiKey !== 'YOUR_SOLAPI_API_KEY' &&
      Boolean(activeApiSecret) &&
      activeApiSecret !== 'YOUR_SOLAPI_API_SECRET' &&
      Boolean(cleanSender) &&
      cleanSender !== '01000000000';

    // Sanitize recipients: remove hyphens, filter valid numbers (10~11 digits)
    const validRecipients = recipients
      .map(r => ({
        name: r.name || '학습자',
        phone: (r.phone || '').replace(/[^0-9]/g, '')
      }))
      .filter(r => r.phone.length >= 10);

    if (validRecipients.length === 0) {
      return res.status(400).json({ error: '유효한 휴대전화 번호가 없습니다. (10자리 이상)' });
    }

    // Simulation fallback if keys are not configured yet
    if (!isKeyConfigured) {
      console.warn('[Solapi SMS] 실제 API 키가 설정되지 않아 가상 발송(시뮬레이션)으로 처리되었습니다.');
      return res.json({
        success: true,
        simulation: true,
        totalCount: validRecipients.length,
        successCount: validRecipients.length,
        failedCount: 0,
        sender: cleanSender || '010-0000-0000',
        message: 'Solapi API 키가 아직 설정되지 않아 시뮬레이션 모드로 가상 발송되었습니다. 관리자 팝업 상단의 [API 설정] 또는 server/index.js 상단에 실제 API Key와 발신번호를 등록하면 실시간 문자가 전송됩니다.',
        recipients: validRecipients
      });
    }

    // Real Solapi v4 REST API Direct Request
    const authHeader = generateSolapiAuthHeader(activeApiKey, activeApiSecret);

    if (validRecipients.length === 1) {
      // Single send: /messages/v4/send
      const payload = {
        message: {
          to: validRecipients[0].phone,
          from: cleanSender,
          text: text.trim()
        }
      };

      const response = await fetch('https://api.solapi.com/messages/v4/send', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[Solapi Error]', data);
        return res.status(response.status).json({
          error: data.errorMessage || data.message || 'Solapi 문자 발송 실패',
          details: data
        });
      }

      return res.json({
        success: true,
        simulation: false,
        totalCount: 1,
        successCount: 1,
        failedCount: 0,
        sender: cleanSender,
        data
      });
    } else {
      // Multiple send: /messages/v4/send-many
      const payload = {
        messages: validRecipients.map(r => ({
          to: r.phone,
          from: cleanSender,
          text: text.trim()
        }))
      };

      const response = await fetch('https://api.solapi.com/messages/v4/send-many', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[Solapi Error]', data);
        return res.status(response.status).json({
          error: data.errorMessage || data.message || 'Solapi 복수 문자 발송 실패',
          details: data
        });
      }

      return res.json({
        success: true,
        simulation: false,
        totalCount: validRecipients.length,
        successCount: data.count?.total || validRecipients.length,
        failedCount: 0,
        sender: cleanSender,
        data
      });
    }
  } catch (err) {
    console.error('[SMS Handler Exception]', err);
    return res.status(500).json({ error: '문자 발송 처리 중 오류가 발생했습니다: ' + err.message });
  }
});

// 8. Get GitHub Auto-Sync Status
app.get('/api/github/status', (req, res) => {
  res.json({
    isConfigured: Boolean(activeGithubToken),
    repo: `${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`,
    filePath: GITHUB_FILE_PATH,
    tokenMasked: activeGithubToken ? `${activeGithubToken.slice(0, 4)}****${activeGithubToken.slice(-4)}` : '미설정'
  });
});

// 9. Save GitHub Auto-Sync Configuration
app.post('/api/github/config', (req, res) => {
  const { githubToken } = req.body;
  if (!githubToken) {
    return res.status(400).json({ error: 'GitHub Token을 입력해 주세요.' });
  }

  activeGithubToken = githubToken.trim();

  try {
    fs.writeFileSync(GITHUB_CONFIG_FILE, JSON.stringify({
      githubToken: activeGithubToken,
      repo: `${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`,
      filePath: GITHUB_FILE_PATH
    }, null, 2), 'utf-8');

    console.log('[GitHub Auto-Sync] 새로운 GitHub 토큰이 설정되었습니다.');
    res.json({
      success: true,
      message: 'GitHub 실시간 자동 저장 설정이 완료되었습니다.',
      status: {
        isConfigured: true,
        repo: `${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`,
        filePath: GITHUB_FILE_PATH,
        tokenMasked: `${activeGithubToken.slice(0, 4)}****${activeGithubToken.slice(-4)}`
      }
    });
  } catch (err) {
    console.error('Failed to write github-config.json:', err);
    res.status(500).json({ error: '설정 저장 중 오류가 발생했습니다.' });
  }
});

// Serve frontend build artifacts in production
const DIST_PATH = path.join(__dirname, '../dist');
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
  console.log('Serving production frontend static files from:', DIST_PATH);

  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
} else {
  console.log('Build output folder (/dist) not found. Express will run API-only mode.');
}

// Start Server
app.listen(PORT, () => {
  console.log(`Pre-Learning Portal server is running on port ${PORT}`);
});
