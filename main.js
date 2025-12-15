const { app, BrowserWindow, ipcMain, session, protocol, net, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const url = require('url');

// Отключаем меню приложения полностью
Menu.setApplicationMenu(null);

// Функция для определения MIME типа файла
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Обработчик Windows installer
try {
  if (require('electron-squirrel-startup')) app.quit();
} catch (_) {}

// Подмена DNS всегда включена (для локального режима)
app.commandLine.appendSwitch('host-resolver-rules',
  'MAP editor.construct.net 127.0.0.1:4430,' +
  'MAP account.construct.net 127.0.0.1:4430,' +
  'MAP preview.construct.net 127.0.0.1:4430,' +
  'MAP stats.construct.net 127.0.0.1:4430'
);

let mainWindow = null;
let serverProcess = null;
let serverActive = false;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'Construct 3 Launcher'
  });

  mainWindow.loadFile('index.html');

  mainWindow.webContents.session.setPermissionCheckHandler(() => true);
  mainWindow.webContents.session.setPermissionRequestHandler((_, __, callback) => callback(true));

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => (mainWindow = null));
}

function createBrowserWindow(url, title) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: title || 'Construct 3',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false,
      webSecurity: false,
      allowRunningInsecureContent: false
    }
  });

  win.webContents.session.setPermissionCheckHandler(() => true);
  win.webContents.session.setPermissionRequestHandler((_, __, callback) => callback(true));

  // Отключаем контекстное меню (правый клик)
  win.webContents.on('context-menu', (event) => {
    event.preventDefault();
  });

  let finalUrl = url;

  if (!serverActive) {
    // Сервер выключен — открываем официальный онлайн-редактор (правильный URL без 404)
    finalUrl = 'https://editor.construct.net  ';

    win.webContents.once('did-finish-load', () => {
      win.webContents.executeJavaScript(`
        const banner = document.createElement('div');
        banner.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#ff5722;color:white;padding:15px 30px;border-radius:8px;z-index:999999;font-family:Arial,sans-serif;font-size:16px;box-shadow:0 4px 20px rgba(0,0,0,0.3);text-align:center;';
        banner.innerHTML = '🔴 Локальный сервер выключен<br>Открыт официальный онлайн-редактор Construct 3 (нужен интернет и аккаунт Scirra)';
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 12000);
      `);
    });
  }

  win.loadURL(finalUrl);
}

async function clearAllCache() {
  try {
    await session.defaultSession.clearCache();
    await session.defaultSession.clearStorageData();
    console.log('Cache cleared successfully');
    return true;
  } catch (err) {
    console.error('Cache clear error:', err);
    return false;
  }
}

async function startLocalServer() {
  if (serverProcess) return true;

  let nodeExecutable, serverScriptPath, resourcesPath, appDir;
  
  if (app.isPackaged) {
    // В упакованном приложении с asarUnpack:
    // process.resourcesPath = C:\...\resources
    // app.getAppPath() = C:\...\resources\app.asar
    // server.js находится в: C:\...\resources\app.asar.unpacked\server.js (благодаря asarUnpack)
    resourcesPath = process.resourcesPath;
    appDir = path.join(resourcesPath, 'app.asar.unpacked');
    nodeExecutable = process.execPath;
    serverScriptPath = path.join(appDir, 'server.js');
  } else {
    // В разработке:
    // __dirname = d:\ar458-2Local-Launcher (корень проекта)
    // server.js находится в: d:\ar458-2Local-Launcher\server.js
    resourcesPath = __dirname;
    appDir = __dirname;
    nodeExecutable = 'node';
    serverScriptPath = path.join(__dirname, 'server.js');
  }

  console.log(`[Main] app.isPackaged: ${app.isPackaged}`);
  console.log(`[Main] process.resourcesPath: ${process.resourcesPath}`);
  console.log(`[Main] app.getAppPath(): ${app.getAppPath()}`);
  console.log(`[Main] Starting server from: ${serverScriptPath}`);
  console.log(`[Main] Server script exists: ${fs.existsSync(serverScriptPath)}`);
  console.log(`[Main] Resources path for server: ${resourcesPath}`);

  // Передаем переменную окружения с путем к ресурсам
  serverProcess = spawn(nodeExecutable, [serverScriptPath], {
    stdio: 'pipe',
    cwd: resourcesPath,
    env: { 
      ...process.env,
      ELECTRON_RUN_AS_NODE: app.isPackaged ? '1' : undefined,
      RESOURCES_PATH: resourcesPath,
      IS_PACKAGED: app.isPackaged ? '1' : '0'
    },
    detached: false,
    windowsHide: true
  });

  serverProcess.stderr.on('data', data => {
    const msg = data.toString();
    console.error(`[Server ERR] ${msg}`);
    mainWindow?.webContents.send('server-error', msg);
  });

  return new Promise(resolve => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) { 
        resolved = true;
        console.error('[Main] Server startup timeout (30s)');
        resolve(false);
      }
    }, 30000);

    serverProcess.stdout.on('data', data => {
      const out = data.toString();
      process.stdout.write(out);

      if (out.includes('HTTPS server running')) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          serverActive = true;
          console.log('[Main] Server started successfully');
          mainWindow?.webContents.send('server-status', { active: true, message: 'Server running' });
          resolve(true);
        }
      }
    });

    serverProcess.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.error('[Main] Server process error:', err.message);
        mainWindow?.webContents.send('server-error', err.message);
        resolve(false);
      }
    });

    serverProcess.on('exit', (code, signal) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.log(`[Main] Server exited with code ${code}, signal ${signal}`);
        resolve(false);
      }
      serverActive = false;
      mainWindow?.webContents.send('server-status', { active: false, message: 'Server stopped' });
      serverProcess = null;
    });
  });
}

function stopLocalServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  serverActive = false;
  mainWindow?.webContents.send('server-status', false);
}

app.whenReady().then(async () => {
  // Регистрируем обработчики IPC до создания окна
  ipcMain.handle('open-browser', async (_, { url, title }) => {
    createBrowserWindow(url, title);
    return { success: true };
  });

  ipcMain.handle('clear-cache', async () => {
    const success = await clearAllCache();
    return { success, message: success ? 'Cache cleared successfully' : 'Failed to clear cache' };
  });

  ipcMain.handle('toggle-server', async (_, enable) => {
    if (enable && !serverActive) {
      return { success: await startLocalServer() };
    }
    if (!enable && serverActive) {
      stopLocalServer();
      return { success: true };
    }
    return { success: true };
  });

  ipcMain.handle('get-server-status', () => serverActive);

  createMainWindow();
  await startLocalServer();
});

app.on('before-quit', () => stopLocalServer());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});