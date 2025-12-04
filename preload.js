const { contextBridge, ipcRenderer } = require('electron');

// Предоставляем безопасные API для рендерера
contextBridge.exposeInMainWorld('electronAPI', {
  // Открыть браузер с Construct 3
  openBrowser: (url, title) => {
    return ipcRenderer.invoke('open-browser', { url, title });
  },
  
  // Очистить кэш
  clearCache: () => {
    return ipcRenderer.invoke('clear-cache');
  },
  
  // Получить информацию о приложении
  getAppInfo: () => {
    return ipcRenderer.invoke('get-app-info');
  },
  
  // Слушатели событий (для будущего использования)
  onWindowFocus: (callback) => {
    ipcRenderer.on('window-focus', callback);
  },
  
  onWindowBlur: (callback) => {
    ipcRenderer.on('window-blur', callback);
  },
  
  // Удалить слушатели
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Логирование для отладки
console.log('Preload script loaded successfully');  