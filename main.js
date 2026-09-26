const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { exec, spawn, execSync } = require('child_process');
const http = require('http');
const https = require('https');
const net = require('net');
const fs = require('fs');
const forge = require('node-forge');
const extract = require('extract-zip');
const AdmZip = require('adm-zip');
const axios = require('axios');
const crypto = require('crypto');
const si = require('systeminformation');

// ---------------------------------------------------------
// 🔒 ป้องกันการเปิดโปรแกรมซ้ำ 2 หน้าต่าง
// ---------------------------------------------------------
let mainWindow;
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ---------------------------------------------------------
// 📂 กำหนด Path สำหรับการเก็บ Mod (AppData)
// ---------------------------------------------------------
const MOD_STORAGE_DIR = path.join(app.getPath('appData'), 'hsho-private-launcher', 'HSHO', 'Content');

// สร้างโฟลเดอร์ AppData หากยังไม่มี
if (!fs.existsSync(MOD_STORAGE_DIR)) {
  fs.mkdirSync(MOD_STORAGE_DIR, { recursive: true });
}

// 🚫 เอาแถบเมนูด้านบนออกถาวร
Menu.setApplicationMenu(null);

// ตั้งค่า Auto Updater
autoUpdater.autoDownload = true;

process.on('uncaughtException', (error) => {
  if (error.code === 'ECONNABORTED' || error.code === 'ECONNRESET' || error.code === 'EADDRINUSE') return;
  console.error('Uncaught Exception:', error);
});

const PROXY_PORT = 8888;
const SSL_PORT = 8443;

// 🟢 เพิ่ม boatltpk เข้าระดับ Domain Target
const TARGET_DOMAINS = [
  'api.homesweethomegame.com',
  'hshsapi.homesweethomegame.com',
  'homesweethomegame.com',
  'hshoapi.homesweethomegame.com',
  'hsho-api.homesweethomegame.com',
  'hsh-api.homesweethomegame.com',
  'boatltpk'
];

const HOST_SERVER_IP = '127.0.0.1';
const BOAT_SERVER_IP = '216.24.57.15';

// 🟢 เพิ่มสวิตช์เลือกเซิร์ฟเวอร์ boatltpk
const SERVERS_HOSTS = {
  lywp: HOST_SERVER_IP,
  hsh: HOST_SERVER_IP,
  boatltpk: BOAT_SERVER_IP
};

let serverProcess = null;
let selectedGameFolder = 'C:\\';

// ================== FUNCTION ZONE ==================

// ไดเรกทอรีมอดต้นทางที่อยู่ในโปรเจกต์ Launcher
function getSourceModsDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'mods')
    : path.join(__dirname, 'mods');
}

// ลบเฉพาะโฟลเดอร์ Launcher และ Game ใน HSHO/Content
function cleanTargetModFolders(gameFolderPath) {
  if (!gameFolderPath) return;
  const contentDir = path.join(gameFolderPath, 'HSHO', 'Content');
  
  const foldersToDelete = ['Launcher', 'Game'];
  foldersToDelete.forEach(folderName => {
    const targetPath = path.join(contentDir, folderName);
    if (fs.existsSync(targetPath)) {
      try {
        fs.rmSync(targetPath, { recursive: true, force: true });
        console.log(`✅ ลบโฟลเดอร์สำเร็จ: ${targetPath}`);
      } catch (err) {
        console.error(`❌ ไม่สามารถลบโฟลเดอร์ ${targetPath} ได้:`, err.message);
      }
    }
  });
}

// คำนวณขนาดไฟล์ทั้งหมดล่วงหน้าเพื่อนำไปคำนวณ %
function getDirectorySize(dirPath) {
  let size = 0;
  if (!fs.existsSync(dirPath)) return size;
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      size += getDirectorySize(filePath);
    } else {
      size += stats.size;
    }
  }
  return size;
}

// คัดลอกโฟลเดอร์มอดพร้อมรายงานเปอร์เซ็นต์
async function syncModsWithProgress(gameFolderPath, webContents) {
  const sourceDir = getSourceModsDir();
  const targetContentDir = path.join(gameFolderPath, 'HSHO', 'Content');

  if (!fs.existsSync(sourceDir)) {
    webContents.send('sync-progress', { percent: 100, status: 'ไม่พบโฟลเดอร์มอดต้นทาง' });
    return;
  }

  // 1. ลบโฟลเดอร์ Launcher และ Game ก่อน
  cleanTargetModFolders(gameFolderPath);

  const totalBytes = getDirectorySize(sourceDir);
  let copiedBytes = 0;

  function copyRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        copyRecursive(srcPath, destPath);
      } else {
        const fileStats = fs.statSync(srcPath);
        const readStream = fs.createReadStream(srcPath);
        const writeStream = fs.createWriteStream(destPath);

        readStream.on('data', (chunk) => {
          copiedBytes += chunk.length;
          const percent = totalBytes > 0 ? Math.floor((copiedBytes / totalBytes) * 100) : 100;
          webContents.send('sync-progress', {
            percent,
            status: `กำลังคัดลอกไฟล์: ${entry.name}`
          });
        });

        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  try {
    copyRecursive(sourceDir, targetContentDir);
    webContents.send('sync-progress', { percent: 100, status: 'พร้อมเล่นเกม' });
  } catch (err) {
    console.error('Copy mods error:', err);
    webContents.send('sync-progress', { percent: 0, status: 'เกิดข้อผิดพลาดในการติดตั้งมอด' });
  }
}

// IPC Handlers สำหรับเรียก Sync มอดเมื่อเปิด Launcher
ipcMain.removeHandler('start-sync-mods');
ipcMain.handle('start-sync-mods', async (event, gameFolderPath) => {
  await syncModsWithProgress(gameFolderPath, event.sender);
  return true;
});

// เมื่อปิดโปรแกรม (will-quit) ให้ลบโฟลเดอร์ Launcher และ Game ออก
app.on('will-quit', () => {
  stopPrivateServer();
  disableSystemProxy();
  
  if (selectedGameFolder) {
    cleanTargetModFolders(selectedGameFolder);
  }
});

// =========================================================
// 🔑 1. ระบบจัดการ Certs & Hosts
// =========================================================
let certs = null;

function getCertsDir() {
  const isPackaged = app.isPackaged;
  return isPackaged
    ? path.join(process.resourcesPath, 'certs')
    : path.join(__dirname, 'certs');
}

function generateCerts() {
  if (certs) return certs;

  const certDir = getCertsDir();
  const keyPath = path.join(certDir, 'rootCA.key');
  const cPath = path.join(certDir, 'rootCA.crt');

  if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

  if (!fs.existsSync(keyPath) || !fs.existsSync(cPath)) {
    console.log('Generating new Root CA & Wildcard Certificates...');
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01' + Date.now();
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

    const attrs = [
      { name: 'commonName', value: 'api.homesweethomegame.com' },
      { name: 'countryName', value: 'TH' },
      { name: 'organizationName', value: 'HSHO Local' }
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    cert.setExtensions([
      { name: 'basicConstraints', cA: true },
      { name: 'keyUsage', keyCertSign: true, digitalSignature: true, keyEncipherment: true },
      {
        name: 'subjectAltName',
        altNames: TARGET_DOMAINS.map(d => ({ type: 2, value: d })).concat([{ type: 2, value: '*.homesweethomegame.com' }])
      }
    ]);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    fs.writeFileSync(keyPath, forge.pki.privateKeyToPem(keys.privateKey), 'utf8');
    fs.writeFileSync(cPath, forge.pki.certificateToPem(cert), 'utf8');
  }

  certs = { key: fs.readFileSync(keyPath), cert: fs.readFileSync(cPath) };
  return certs;
}

function applyHostsRedirect(targetIp = HOST_SERVER_IP) {
  const hostsPath = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
  try {
    let hostsContent = fs.readFileSync(hostsPath, 'utf8');
    let updated = false;

    TARGET_DOMAINS.forEach(domain => {
      const ip = (domain === 'boatltpk') ? BOAT_SERVER_IP : targetIp;
      const entry = `${ip} ${domain}`;
      
      if (!hostsContent.includes(domain)) {
        hostsContent += `\r\n${entry}`;
        updated = true;
      }
    });

    if (updated) {
      const tempHostsPath = path.join(app.getPath('temp'), 'hosts_temp');
      fs.writeFileSync(tempHostsPath, hostsContent, 'utf8');
      execSync(`powershell -Command "Start-Process powershell -ArgumentList '-Command Copy-Item -Path ''${tempHostsPath}'' -Destination ''${hostsPath}'' -Force' -Verb RunAs"`);
      console.log('✅ Updated Hosts file successfully');
    }
    return { success: true, message: 'อัปเดต Hosts file สำเร็จ' };
  } catch (err) {
    console.error('❌ Failed to update Hosts file:', err.message);
    return { success: false, message: 'อัปเดต Hosts file ไม่สำเร็จ (ต้องการสิทธิ์ Admin)' };
  }
}

function installCACertificate() {
  return new Promise((resolve) => {
    try { generateCerts(); } catch (err) { console.error(err); }

    const certDir = getCertsDir();
    const cPath = path.join(certDir, 'rootCA.crt');

    if (!fs.existsSync(cPath)) {
      return resolve({ success: false, message: 'ไม่พบไฟล์ rootCA.crt' });
    }

    const command = `certutil -addstore -f "Root" "${cPath}"`;
    exec(command, (error, stdout) => {
      if (error) {
        return resolve({ success: false, message: 'ติดตั้ง Certificate ล้มเหลว (กรุณารันโปรแกรมด้วย Admin)' });
      }
      resolve({ success: true, message: 'ติดตั้ง CA Certificate เข้า System Root สำเร็จ!' });
    });
  });
}

// =========================================================
// 🌐 2. ระบบ Internal Proxy & SSL Server
// =========================================================
function startInternalProxy() {
  const localCerts = generateCerts();
  if (!localCerts) return;

  const RENDER_HOST = YOUR_RENDER_LINK';

  // 1. Direct HTTPS Server (Port 443 Direct Binding)
  try {
    const directHttpsServer = https.createServer(localCerts, (req, res) => {
      const options = {
        hostname: RENDER_HOST,
        port: 443,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: RENDER_HOST }
      };

      const proxyReq = https.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        if (!res.headersSent) { 
          res.writeHead(502); 
          res.end('Cloud Backend unreachable'); 
        }
      });

      req.pipe(proxyReq);
    });

    directHttpsServer.on('error', (e) => console.log('Port 443 active or in-use:', e.message));
    directHttpsServer.listen(443, '127.0.0.1');
  } catch (err) {
    console.error('❌ Cannot bind Port 443:', err.message);
  }

  // 2. SSL Proxy Server (Port 8443 / SSL_PORT)
  try {
    const sslServer = https.createServer(localCerts, (req, res) => {
      const options = {
        hostname: RENDER_HOST,
        port: 443,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: RENDER_HOST },
        rejectUnauthorized: false
      };

      const proxyReq = https.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Cloud Backend unreachable' }));
        }
      });

      req.pipe(proxyReq);
    });

    sslServer.on('error', (e) => console.log('Port 8443 active or in-use:', e.message));
    sslServer.listen(SSL_PORT, '127.0.0.1');
  } catch (err) {
    console.error('❌ Cannot bind Port 8443:', err.message);
  }

  // 3. Main Proxy Server (รองรับ HTTP / HTTPS Dynamic Proxy)
  try {
    const mainProxy = http.createServer((req, res) => {
      try {
        const isAbsoluteUrl = req.url.startsWith('http://') || req.url.startsWith('https://');
        const parsedUrl = isAbsoluteUrl 
          ? new URL(req.url) 
          : new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

        const isTarget = TARGET_DOMAINS.some(d => parsedUrl.hostname.includes(d));

        const isHttps = isTarget || parsedUrl.protocol === 'https:';
        const targetHost = isTarget ? RENDER_HOST : parsedUrl.hostname;
        const targetPort = isTarget 
          ? 443 
          : (parsedUrl.port ? parseInt(parsedUrl.port, 10) : (isHttps ? 443 : 80));

        const options = {
          hostname: targetHost,
          port: targetPort,
          path: isAbsoluteUrl ? parsedUrl.pathname + parsedUrl.search : req.url,
          method: req.method,
          headers: {
            ...req.headers,
            host: targetHost
          },
          rejectUnauthorized: false
        };

        const requester = isHttps ? https : http;

        const proxyReq = requester.request(options, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
          console.error('Proxy Error:', err.message);
          if (!res.headersSent) { 
            res.writeHead(500); 
            res.end('Proxy Internal Error'); 
          }
        });

        req.pipe(proxyReq);
      } catch (err) {
        if (!res.headersSent) {
          res.writeHead(400); 
          res.end('Bad Request');
        }
      }
    });

    mainProxy.on('connect', (req, clientSocket, head) => {
      const [serverUrl, serverPort] = req.url.split(':');
      const isTarget = TARGET_DOMAINS.some(d => serverUrl.includes(d));

      const targetPort = isTarget ? SSL_PORT : (parseInt(serverPort, 10) || 443);
      const targetHost = isTarget ? '127.0.0.1' : serverUrl;

      const serverSocket = net.connect(targetPort, targetHost, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        serverSocket.write(head);
        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
      });

      serverSocket.on('error', () => clientSocket.destroy());
      clientSocket.on('error', () => serverSocket.destroy());
    });

    mainProxy.on('error', (e) => console.log('Port 8888 active or in-use:', e.message));
    mainProxy.listen(PROXY_PORT, '127.0.0.1', () => {
      enableSystemProxy();
    });
  } catch (err) {
    console.error('❌ Cannot bind Port 8888:', err.message);
  }
}

function enableSystemProxy() {
  const proxyServer = "127.0.0.1:8888";
  exec(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f`);
  exec(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d "${proxyServer}" /f`);
  exec(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyOverride /t REG_SZ /d "" /f`);
}

function disableSystemProxy() {
  exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f');
}

// ---------------- 3. Server Process & Mod Utilities ----------------
function startPrivateServer() {
  if (HOST_SERVER_IP !== '127.0.0.1') return;

  const isPackaged = app.isPackaged;
  const serverPath = isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'server.js')
    : path.join(__dirname, 'server.js');

  if (fs.existsSync(serverPath)) {
    serverProcess = spawn(process.execPath, [serverPath], {
      cwd: path.dirname(serverPath),
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'inherit'
    });
  }
}

function stopPrivateServer() {
  if (serverProcess) serverProcess.kill();
}

function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function installModToGame(gameExePath) {
  try {
    const gameDir = path.dirname(gameExePath);
    const targetGameFolder = path.join(gameDir, 'HSHO', 'Content', 'Game');

    if (!fs.existsSync(targetGameFolder)) {
      fs.mkdirSync(targetGameFolder, { recursive: true });
    }

    if (fs.existsSync(MOD_STORAGE_DIR)) {
      const files = fs.readdirSync(MOD_STORAGE_DIR);
      
      files.forEach(file => {
        const srcFile = path.join(MOD_STORAGE_DIR, file);
        const destFile = path.join(targetGameFolder, file);

        if (fs.lstatSync(srcFile).isFile()) {
          fs.copyFileSync(srcFile, destFile);
          console.log(`✅ Copied Mod: ${file} -> ${targetGameFolder}`);
        }
      });
    }

    return true;
  } catch (err) {
    console.error('❌ Failed to copy mod files:', err.message);
    return false;
  }
}

// ---------------- 4. Electron Window Lifecycle ----------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 520,
    icon: path.join(__dirname, 'build/icon.ico'),
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  generateCerts();
  applyHostsRedirect();
  startPrivateServer();
  startInternalProxy();
  createWindow();

  autoUpdater.checkForUpdatesAndNotify();
});

app.on('will-quit', () => {
  stopPrivateServer();
  disableSystemProxy();
});

// ---------------- 5. IPC Handlers ----------------

// ลบ Handler เก่าป้องกัน Register ซ้ำ
ipcMain.removeHandler('select-custom-bg');
ipcMain.removeHandler('get-system-specs');
ipcMain.removeHandler('select-game-folder');
ipcMain.removeHandler('select-mobw-folder');
ipcMain.removeHandler('save-version');
ipcMain.removeHandler('save-project-version');
ipcMain.removeHandler('get-project-version');
ipcMain.removeHandler('download-mod-zip');
ipcMain.removeHandler('check-server-ping');
ipcMain.removeHandler('switch-server');
ipcMain.removeHandler('install-ca-cert');
ipcMain.removeHandler('install-cert');
ipcMain.removeHandler('select-game-file');
ipcMain.removeHandler('launch-game');
ipcMain.removeHandler('verify-and-repair-mods');
ipcMain.removeHandler('get-current-game-path');
ipcMain.removeHandler('fix-hosts');

ipcMain.handle('select-custom-bg', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'webp'] }]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('get-system-specs', async () => {
  try {
    const memory = await si.mem();
    const cpu = await si.cpu();
    const graphics = await si.graphics();
    const fsSize = await si.fsSize();
    const primaryDisk = fsSize.length > 0 ? fsSize[0] : null;

    return {
      success: true,
      cpu: `${cpu.manufacturer} ${cpu.brand}`,
      ramTotalGB: (memory.total / (1024 ** 3)).toFixed(1),
      ramFreeGB: (memory.free / (1024 ** 3)).toFixed(1),
      gpu: graphics.controllers.length > 0 ? graphics.controllers[0].model : 'N/A',
      diskFreeGB: primaryDisk ? (primaryDisk.available / (1024 ** 3)).toFixed(1) : 'N/A',
      diskTotalGB: primaryDisk ? (primaryDisk.size / (1024 ** 3)).toFixed(1) : 'N/A'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ฟังก์ชันค้นหาและอัปเดต ProjectVersion
async function handleSaveVersion(event, payload) {
  try {
    const folderPath = payload?.folderPath || (typeof payload === 'string' ? payload : null);
    const newVersion = payload?.version || payload?.newVersion;

    if (!folderPath || !newVersion) {
      return { success: false, message: 'ข้อมูลไม่ครบถ้วน!' };
    }

    const baseDir = fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()
      ? folderPath
      : path.dirname(folderPath);

    const iniPath = path.join(baseDir, 'HSHO', 'Config', 'DefaultGame.ini');
    if (!fs.existsSync(iniPath)) {
      return { success: false, message: 'ไม่พบไฟล์ HSHO/Config/DefaultGame.ini ในโฟลเดอร์ที่เลือก!' };
    }

    let fileContent = fs.readFileSync(iniPath, 'utf-8');
    if (fileContent.includes('ProjectVersion=')) {
      fileContent = fileContent.replace(/ProjectVersion=.*/, `ProjectVersion=${newVersion}`);
    } else {
      fileContent = fileContent.replace(
        '[/Script/EngineSettings.GeneralProjectSettings]',
        `[/Script/EngineSettings.GeneralProjectSettings]\nProjectVersion=${newVersion}`
      );
    }

    fs.writeFileSync(iniPath, fileContent, 'utf-8');
    return { success: true, message: `อัปเดต ProjectVersion เป็น ${newVersion} เรียบร้อยแล้ว!` };
  } catch (err) {
    return { success: false, message: `เกิดข้อผิดพลาด: ${err.message}` };
  }
}

ipcMain.handle('save-version', handleSaveVersion);
ipcMain.handle('save-project-version', handleSaveVersion);

async function handleSelectGameFolder() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'เลือกโฟลเดอร์เกม (โฟลเดอร์ MOBW)'
  });

  if (canceled || filePaths.length === 0) {
    return { success: false, message: 'ยกเลิกการเลือกโฟลเดอร์' };
  }

  const selectedPath = filePaths[0];
  const iniPath = path.join(selectedPath, 'HSHO', 'Config', 'DefaultGame.ini');

  if (!fs.existsSync(iniPath)) {
    return { 
      success: false, 
      message: 'โฟลเดอร์ไม่ถูกต้อง! ไม่พบ HSHO/Config/DefaultGame.ini' 
    };
  }

  const fileContent = fs.readFileSync(iniPath, 'utf-8');
  const match = fileContent.match(/ProjectVersion=(.*)/);
  const currentVersion = match && match[1] ? match[1].trim() : 'ไม่พบเวอร์ชัน';

  return {
    success: true,
    folderPath: selectedPath,
    currentVersion: currentVersion
  };
}

ipcMain.handle('select-game-folder', handleSelectGameFolder);
ipcMain.handle('select-mobw-folder', handleSelectGameFolder);

ipcMain.handle('get-project-version', async (event, exeOrFolderPath) => {
  try {
    let targetPath = typeof exeOrFolderPath === 'object' && exeOrFolderPath !== null ? exeOrFolderPath.folderPath : exeOrFolderPath;
    if (!targetPath || typeof targetPath !== 'string') return null;

    const baseDir = fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory() 
      ? targetPath 
      : path.dirname(targetPath);

    const iniPath = path.join(baseDir, 'HSHO', 'Config', 'DefaultGame.ini');
    if (!fs.existsSync(iniPath)) return null;

    const content = fs.readFileSync(iniPath, 'utf8');
    const match = content.match(/ProjectVersion=(.*)/);
    return match ? match[1].trim() : '';
  } catch (err) {
    return null;
  }
});

ipcMain.handle('download-mod-zip', async (event, zipUrl) => {
  try {
    const tempZipPath = path.join(MOD_STORAGE_DIR, 'temp_mod.zip');
    
    const response = await axios({
      url: zipUrl,
      method: 'GET',
      responseType: 'arraybuffer'
    });

    fs.writeFileSync(tempZipPath, response.data);
    
    const zip = new AdmZip(tempZipPath);
    zip.extractAllTo(MOD_STORAGE_DIR, true);
    
    fs.unlinkSync(tempZipPath);
    return { success: true };
  } catch (error) {
    console.error('Download Mod Zip Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-server-ping', async (event, host, port) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2500);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
});

ipcMain.handle('switch-server', async (event, serverKey) => {
  try {
    const targetIp = SERVERS_HOSTS[serverKey] || HOST_SERVER_IP;
    applyHostsRedirect(targetIp);
    return true;
  } catch (err) {
    return false;
  }
});

ipcMain.handle('install-ca-cert', async () => await installCACertificate());
ipcMain.handle('install-cert', async () => await installCACertificate());

ipcMain.on('start-download-mod', (event, driveUrl) => {
  const zipTempPath = path.join(MOD_STORAGE_DIR, 'mod_temp.zip');

  const match = driveUrl.match(/[-\w]{25,}/);
  if (!match) {
    event.reply('download-error', 'ลิงก์ Google Drive ไม่ถูกต้อง');
    return;
  }
  const fileId = match[0];

  const downloadFromDrive = (id, targetPath) => {
    const initialUrl = `https://drive.google.com/uc?export=download&id=${id}`;

    const requestFile = (url, cookies = []) => {
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          ...(cookies.length > 0 && { 'Cookie': cookies.join('; ') })
        }
      };

      https.get(url, options, (res) => {
        const setCookie = res.headers['set-cookie'];
        if (setCookie) cookies = cookies.concat(setCookie);

        if (res.statusCode === 302 || res.statusCode === 303) {
          return requestFile(res.headers.location, cookies);
        }

        if (res.statusCode !== 200) {
          event.reply('download-error', `เซิร์ฟเวอร์ตอบกลับด้วยสถานะ: ${res.statusCode}`);
          return;
        }

        const contentType = res.headers['content-type'] || '';
        let bodyBuffer = [];

        if (contentType.includes('text/html')) {
          res.on('data', chunk => bodyBuffer.push(chunk));
          res.on('end', () => {
            const html = Buffer.concat(bodyBuffer).toString('utf8');
            const confirmMatch = html.match(/confirm=([a-zA-Z0-9_]+)/) || html.match(/name="confirm" value="([^"]+)"/);
            
            if (confirmMatch) {
              const confirmToken = confirmMatch[1];
              const confirmUrl = `https://drive.google.com/uc?export=download&confirm=${confirmToken}&id=${id}`;
              requestFile(confirmUrl, cookies);
            } else {
              event.reply('download-error', 'ไม่สามารถข้ามหน้ายืนยันดาวน์โหลดของ Google Drive ได้ (แนะนำให้ใช้ลิงก์ตรง)');
            }
          });
          return;
        }

        const fileStream = fs.createWriteStream(targetPath);
        const totalBytes = parseInt(res.headers['content-length'], 10) || 0;
        let downloadedBytes = 0;
        let startTime = Date.now();
        let lastTime = startTime;
        let lastDownloaded = 0;

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          fileStream.write(chunk);

          const currentTime = Date.now();
          const timeDiff = (currentTime - lastTime) / 1000;

          if (timeDiff >= 0.5) {
            const bytesSinceLast = downloadedBytes - lastDownloaded;
            const speedBytesPerSec = bytesSinceLast / timeDiff;
            const remainingBytes = totalBytes - downloadedBytes;
            const timeRemainingSec = speedBytesPerSec > 0 ? Math.ceil(remainingBytes / speedBytesPerSec) : 0;
            const percent = totalBytes > 0 ? Math.floor((downloadedBytes / totalBytes) * 100) : 0;

            event.reply('download-progress', {
              percent,
              downloadedBytes,
              totalBytes,
              speedBytesPerSec,
              timeRemainingSec
            });

            lastTime = currentTime;
            lastDownloaded = downloadedBytes;
          }
        });

        res.on('end', async () => {
          fileStream.end();
          try {
            event.reply('download-status-text', 'กำลังติดตั้งมอด...');
            await extract(targetPath, { dir: MOD_STORAGE_DIR });
            if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
            event.reply('download-complete');
          } catch (unzipErr) {
            console.error('❌ Unzip error:', unzipErr);
            event.reply('download-error', 'แตกไฟล์มอดไม่สำเร็จ: ' + unzipErr.message);
          }
        });
      }).on('error', (err) => {
        if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
        event.reply('download-error', err.message);
      });
    };

    requestFile(initialUrl);
  };

  downloadFromDrive(fileId, zipTempPath);
});

// Controls & Launch Game
ipcMain.on('window-minimize', () => BrowserWindow.getFocusedWindow()?.minimize());
ipcMain.on('window-close', () => BrowserWindow.getFocusedWindow()?.close());
ipcMain.on('window-maximize', () => BrowserWindow.getFocusedWindow()?.maximize());

ipcMain.handle('select-game-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Executable', extensions: ['exe'] }]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    selectedGameFolder = result.filePaths[0];
    return selectedGameFolder;
  }
  return null;
});

ipcMain.handle('launch-game', (event, gamePath) => {
  const targetPath = gamePath || selectedGameFolder;

  if (!targetPath || !targetPath.toLowerCase().endsWith('.exe') || !fs.existsSync(targetPath)) {
    return false;
  }

  installModToGame(targetPath);

  const gameDir = path.dirname(targetPath);
  try {
    const child = spawn(targetPath, [], {
      cwd: gameDir,
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return true;
  } catch (error) {
    return false;
  }
});

ipcMain.on('open-game-folder', () => {
  if (selectedGameFolder) {
    shell.openPath(path.dirname(selectedGameFolder));
  }
});

ipcMain.on('open-mod-folder', () => {
  shell.openPath(MOD_STORAGE_DIR);
});

// Auto-Updater Controls
ipcMain.on('restart-to-update', () => autoUpdater.quitAndInstall());

autoUpdater.on('checking-for-update', () => {
  mainWindow?.webContents.send('updater-message', { status: 'checking', text: 'กำลังตรวจสอบการอัปเดต...' });
});
autoUpdater.on('update-available', () => {
  mainWindow?.webContents.send('updater-message', { status: 'available', text: 'พบเวอร์ชันใหม่ กำลังดาวน์โหลด...' });
});
autoUpdater.on('update-not-available', () => {
  mainWindow?.webContents.send('updater-message', { status: 'not-available', text: 'เวอร์ชันปัจจุบันเป็นเวอร์ชันล่าสุดแล้ว' });
});
autoUpdater.on('download-progress', (progressObj) => {
  mainWindow?.webContents.send('updater-progress', {
    percent: progressObj.percent,
    bytesPerSecond: (progressObj.bytesPerSecond / (1024 * 1024)).toFixed(2),
    transferred: (progressObj.transferred / (1024 * 1024)).toFixed(1),
    total: (progressObj.total / (1024 * 1024)).toFixed(1)
  });
});
autoUpdater.on('update-downloaded', () => {
  mainWindow?.webContents.send('updater-message', { status: 'downloaded', text: 'ดาวน์โหลดเสร็จสิ้น พร้อมติดตั้ง' });
});

ipcMain.handle('verify-and-repair-mods', async (event, gamePath) => {
  try {
    const targetGameFolder = path.join(path.dirname(gamePath), 'HSHO', 'Content', 'Game');
    if (!fs.existsSync(targetGameFolder)) {
      fs.mkdirSync(targetGameFolder, { recursive: true });
    }

    let modifiedOrMissing = false;

    const appDataFiles = fs.readdirSync(MOD_STORAGE_DIR);
    
    for (const file of appDataFiles) {
      const appDataFilePath = path.join(MOD_STORAGE_DIR, file);
      const gameFilePath = path.join(targetGameFolder, file);

      if (fs.lstatSync(appDataFilePath).isFile()) {
        const appDataHash = getFileHash(appDataFilePath);
        const gameHash = getFileHash(gameFilePath);

        if (!gameHash || appDataHash !== gameHash) {
          modifiedOrMissing = true;
          event.reply('verify-progress-text', `กำลังซ่อมแซมไฟล์: ${file}`);
          fs.copyFileSync(appDataFilePath, gameFilePath);
        }
      }
    }

    if (fs.existsSync(targetGameFolder)) {
      const gameFiles = fs.readdirSync(targetGameFolder);
      for (const file of gameFiles) {
        const appDataFilePath = path.join(MOD_STORAGE_DIR, file);
        const gameFilePath = path.join(targetGameFolder, file);

        if (!fs.existsSync(appDataFilePath)) {
          modifiedOrMissing = true;
          fs.unlinkSync(gameFilePath);
        }
      }
    }

    return { success: true, repaired: modifiedOrMissing };
  } catch (error) {
    console.error('Verify error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-current-game-path', () => {
  return selectedGameFolder;
});

ipcMain.handle('fix-hosts', async (event, serverKey = 'lywp') => {
  const targetIp = SERVERS_HOSTS[serverKey] || HOST_SERVER_IP;
  return applyHostsRedirect(targetIp);
});
