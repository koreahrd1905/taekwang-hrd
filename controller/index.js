import express from 'express';
import cors from 'cors';
import { spawn, exec } from 'child_process';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 9000;

app.use(cors());
app.use(express.json());

const CONFIG_FILE = path.join(__dirname, 'services-config.json');

// Default initial service configuration
const DEFAULT_SERVICES = [
  {
    id: 'philosophy',
    name: '창업주 경영철학 선행학습 포털 (Portal)',
    cwd: 'c:\\실습\\DEV\\경영철학서',
    command: 'node',
    args: 'server/index.js',
    port: 5001
  },
  {
    id: 'flight',
    name: '항공 스케쥴 추적기 (Flight Tracker)',
    cwd: 'c:\\실습\\DEV\\FlightTracker',
    command: 'python',
    args: 'app.py',
    port: 5000
  }
];

// In-memory status store
let services = [];
const runningProcesses = new Map(); // id -> ChildProcess
const serviceLogs = new Map(); // id -> string[]

// Load config from file
const loadConfig = () => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const loaded = JSON.parse(data);
      // Ensure all loaded services have logs initialized
      loaded.forEach(s => {
        if (!serviceLogs.has(s.id)) serviceLogs.set(s.id, [`[시스템] 서비스 '${s.name}' 로드됨.`]);
      });
      services = loaded;
    } else {
      services = JSON.parse(JSON.stringify(DEFAULT_SERVICES));
      saveConfig();
    }
  } catch (err) {
    console.error('Failed to load services configuration:', err);
    services = JSON.parse(JSON.stringify(DEFAULT_SERVICES));
  }
};

// Save config to file
const saveConfig = () => {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(services, null, 2), 'utf-8');
    services.forEach(s => {
      if (!serviceLogs.has(s.id)) serviceLogs.set(s.id, [`[시스템] 서비스 '${s.name}' 등록됨.`]);
    });
  } catch (err) {
    console.error('Failed to save services configuration:', err);
  }
};

// Helper to check if a port is active
const isPortActive = (port) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800); // 800ms timeout
    
    socket.on('connect', () => {
      socket.destroy();
      resolve(true); // Port is occupied (service is running)
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false); // Port is free
    });
    
    socket.on('error', () => {
      socket.destroy();
      resolve(false); // Port is free (connection refused)
    });
    
    socket.connect(port, '127.0.0.1');
  });
};

// Helper to kill process by port (bulletproof Windows command)
const killProcessOnPort = (port) => {
  return new Promise((resolve) => {
    // Find PID on port and kill it using taskkill
    const cmd = `for /f "tokens=5" %a in ('netstat -aon ^| findstr :${port} ^| findstr LISTENING') do taskkill /F /PID %a`;
    exec(cmd, (err, stdout, stderr) => {
      console.log(`Port ${port} cleanup command run. Output:`, stdout || stderr || 'None');
      resolve(true);
    });
  });
};

// Append logs helper
const addLog = (serviceId, text) => {
  if (!serviceLogs.has(serviceId)) {
    serviceLogs.set(serviceId, []);
  }
  const logsArr = serviceLogs.get(serviceId);
  
  // Format with current timestamp
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  
  logsArr.push(`[${timeStr}] ${text}`);
  
  // Keep only the last 100 log lines
  if (logsArr.length > 100) {
    logsArr.shift();
  }
};

// Load initial config
loadConfig();

/**
 * REST API Endpoints
 */

// 1. Get all services with status checks
app.get('/api/services', async (req, res) => {
  const serviceListWithStatus = await Promise.all(
    services.map(async (s) => {
      const portActive = await isPortActive(s.port);
      const isProcessRegistered = runningProcesses.has(s.id);
      
      let status = 'STOPPED';
      if (portActive) {
        status = 'RUNNING';
      } else if (isProcessRegistered) {
        // Process is spawned but port isn't open yet or crashed
        status = 'STARTING';
      }

      return {
        ...s,
        status
      };
    })
  );
  res.json(serviceListWithStatus);
});

// 2. Add custom service
app.post('/api/services', (req, res) => {
  const { name, cwd, command, args, port } = req.body;
  
  if (!name || !cwd || !command || !port) {
    return res.status(400).json({ error: 'Name, cwd, command, and port are required.' });
  }

  const id = 'custom_' + Math.random().toString(36).substr(2, 9);
  const newService = {
    id,
    name,
    cwd,
    command,
    args: args || '',
    port: parseInt(port, 10)
  };

  services.push(newService);
  saveConfig();
  res.status(201).json(newService);
});

// 3. Delete custom service
app.delete('/api/services/:id', async (req, res) => {
  const { id } = req.params;
  
  if (id === 'philosophy' || id === 'flight') {
    return res.status(403).json({ error: 'Default services cannot be deleted.' });
  }

  // Stop process if running
  if (runningProcesses.has(id)) {
    const proc = runningProcesses.get(id);
    try {
      exec(`taskkill /F /T /PID ${proc.pid}`);
    } catch(e){}
    runningProcesses.delete(id);
  }

  services = services.filter(s => s.id !== id);
  saveConfig();
  serviceLogs.delete(id);

  res.json({ message: 'Service removed successfully.' });
});

// 4. Start service
app.post('/api/services/:id/start', async (req, res) => {
  const { id } = req.params;
  const service = services.find(s => s.id === id);

  if (!service) {
    return res.status(404).json({ error: 'Service not found.' });
  }

  // Check if port is already active
  const portActive = await isPortActive(service.port);
  if (portActive) {
    addLog(id, `[경고] 포트 ${service.port}번이 이미 사용 중입니다. 기존 프로세스에 링크를 시도합니다.`);
    return res.json({ message: 'Service is already running (Port active).', alreadyRunning: true });
  }

  addLog(id, `[시스템] 서비스 구동 시작: '${service.command} ${service.args}'`);
  
  // Format args
  const commandArgs = service.args ? service.args.split(' ') : [];

  // Spawn process with shell wrapper (necessary for cmd/python/node on Windows)
  const child = spawn(service.command, commandArgs, {
    cwd: service.cwd,
    shell: true,
    env: { ...process.env, PATH: "C:\\Program Files (x86)\\HncTools\\McpServers\\Node;" + process.env.PATH }
  });

  child.stdout.on('data', (data) => {
    const text = data.toString().trim();
    if (text) {
      text.split('\n').forEach(line => addLog(id, line.trim()));
    }
  });

  child.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) {
      text.split('\n').forEach(line => addLog(id, `[에러] ${line.trim()}`));
    }
  });

  child.on('close', (code) => {
    addLog(id, `[시스템] 서비스가 종료되었습니다. (종료 코드: ${code})`);
    runningProcesses.delete(id);
  });

  child.on('error', (err) => {
    addLog(id, `[오류] 프로세스 실행 에러: ${err.message}`);
    runningProcesses.delete(id);
  });

  runningProcesses.set(id, child);
  res.json({ message: 'Service started.', pid: child.pid });
});

// 5. Stop service
app.post('/api/services/:id/stop', async (req, res) => {
  const { id } = req.params;
  const service = services.find(s => s.id === id);

  if (!service) {
    return res.status(404).json({ error: 'Service not found.' });
  }

  addLog(id, `[시스템] 서비스 강제 종료 요청 수신.`);

  let stopped = false;

  // Kill registered process tree
  if (runningProcesses.has(id)) {
    const proc = runningProcesses.get(id);
    addLog(id, `[시스템] 프로세스 트리(PID: ${proc.pid}) 종료 중...`);
    
    // Windows taskkill /T /F forces child tree termination
    exec(`taskkill /F /T /PID ${proc.pid}`, (err) => {
      if (err) {
        console.warn(`PID kill warning for ${proc.pid}:`, err.message);
      }
    });
    
    runningProcesses.delete(id);
    stopped = true;
  }

  // Double check and kill port process
  addLog(id, `[시스템] 포트 ${service.port} 점유 프로세스 클린업 실행...`);
  await killProcessOnPort(service.port);
  stopped = true;

  addLog(id, `[시스템] 서비스가 성공적으로 중지되었습니다.`);
  res.json({ message: 'Service stopped successfully.', stopped });
});

// 6. Get service logs
app.get('/api/services/:id/logs', (req, res) => {
  const { id } = req.params;
  const logsArr = serviceLogs.get(id) || [];
  res.json({ logs: logsArr });
});

// Serve frontend Control Panel files
const PUBLIC_PATH = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_PATH));

app.listen(PORT, () => {
  console.log(`Development Service Controller is running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser to manage local services.`);
});
