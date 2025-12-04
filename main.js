  const { app, BrowserWindow, ipcMain, session } = require('electron');
  const path = require('path');

  // Обработчик для electron-builder
  try {
    if (require('electron-squirrel-startup')) app.quit();
  } catch (error) {
    console.log('electron-squirrel-startup not available in dev mode');
  }

  let mainWindow;

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
    
    // Разрешаем доступ к файловой системе для главного окна
    mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
      return true;
    });
    
    // Разрешаем запросы разрешений
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      callback(true);
    });
    
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  // Функция для создания окна браузера
  function createBrowserWindow(url, title) {
    const browserWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      title: title,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: false,
        webSecurity: false,
        allowRunningInsecureContent: true
      }
    });

    // Разрешаем доступ к файловой системе
    browserWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
      return true;
    });

    // Все ссылки открываем в этом же окне
    browserWindow.webContents.setWindowOpenHandler(() => {
      return { action: 'allow' };
    });

    // Разрешаем всё что можно
    browserWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      callback(true);
    });

    browserWindow.loadURL(url);
    
    return browserWindow;
  }

  // Функция для очистки кэша
  async function clearAllCache() {
    try {
      const ses = session.defaultSession;
      await ses.clearCache();
      await ses.clearStorageData();
      console.log('Cache cleared successfully');
      return true;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  }

  app.whenReady().then(() => {
    createMainWindow();

    ipcMain.handle('open-browser', async (event, { url, title }) => {
      createBrowserWindow(url, title);
      return { success: true };
    });

    ipcMain.handle('clear-cache', async (event) => {
      const success = await clearAllCache();
      return { success: success, message: success ? 'Cache cleared successfully' : 'Failed to clear cache' };
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });