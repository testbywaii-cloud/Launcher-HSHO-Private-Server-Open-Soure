const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  
  // SERVER ASS
  installCert: () => ipcRenderer.invoke('install-ca-cert'),
  fixHosts: (serverKey) => ipcRenderer.invoke('fix-hosts', serverKey),
  switchServer: (serverKey) => ipcRenderer.invoke('switch-server', serverKey),

  // 🎮 ระบบเปิดเกมและโฟลเดอร์
  selectGameFile: () => ipcRenderer.invoke('select-game-file'),
  getCurrentGamePath: () => ipcRenderer.invoke('get-current-game-path'),
  launchGame: (path) => ipcRenderer.invoke('launch-game', path),
  openFolder: () => ipcRenderer.send('open-game-folder'),

  // 🔄 ระบบ Sync มอดและแสดงเปอร์เซ็นต์
  startSyncMods: (gamePath) => ipcRenderer.invoke('start-sync-mods', gamePath),
  onSyncProgress: (callback) => ipcRenderer.on('sync-progress', (_event, data) => callback(data)),

  // 🪟 การควบคุมหน้าต่าง
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  maximize: () => ipcRenderer.send('window-maximize'),

  // 🔒 Certificate & Network
  installCert: () => ipcRenderer.invoke('install-ca-cert'),
  switchServer: (serverKey) => ipcRenderer.invoke('switch-server', serverKey),
  checkServerPing: (host, port) => ipcRenderer.invoke('check-server-ping', host, port),

  // 🔄 Auto-Updater
  restartAndInstall: () => ipcRenderer.send('restart-to-update'),
  onUpdaterMessage: (callback) => ipcRenderer.on('updater-message', (_event, data) => callback(data)),
  onUpdaterProgress: (callback) => ipcRenderer.on('updater-progress', (_event, data) => callback(data)),

  // 📁 Project Version Management
  selectGameFolder: () => ipcRenderer.invoke('select-game-folder'),
  selectMobwFolder: () => ipcRenderer.invoke('select-mobw-folder'),
  getProjectVersion: (folderPath) => ipcRenderer.invoke('get-project-version', folderPath),
  saveProjectVersion: (folderPath, version) => ipcRenderer.invoke('save-project-version', { folderPath, version }),
  saveVersion: (data) => ipcRenderer.invoke('save-version', data),

  // 💻 System & Custom Background
  getSystemSpecs: () => ipcRenderer.invoke('get-system-specs'),
  selectCustomBackground: () => ipcRenderer.invoke('select-custom-bg')
});