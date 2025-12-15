const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openBrowser: (url, title) => ipcRenderer.invoke('open-browser', { url, title }),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  toggleServer: (enable) => ipcRenderer.invoke('toggle-server', enable),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  onServerStatus: (callback) => {
    const listener = (_, status) => {
      if (typeof status === 'object') {
        callback(status.active);
      } else {
        callback(status);
      }
    };
    ipcRenderer.on('server-status', listener);
    return () => ipcRenderer.removeListener('server-status', listener);
  },
  onServerError: (callback) => {
    const listener = (_, error) => callback(error);
    ipcRenderer.on('server-error', listener);
    return () => ipcRenderer.removeListener('server-error', listener);
  },
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

console.log('[Preload] Script loaded successfully');