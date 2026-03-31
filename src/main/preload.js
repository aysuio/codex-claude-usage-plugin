const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  onUsageData: (callback) => {
    ipcRenderer.on('usage-data', (_event, data) => callback(data));
  },
  onFetchError: (callback) => {
    ipcRenderer.on('fetch-error', (_event, err) => callback(err));
  },
  refresh: () => {
    ipcRenderer.send('refresh');
  },
  toggleMode: () => {
    ipcRenderer.send('toggle-mode');
  },
  hide: () => {
    ipcRenderer.send('hide');
  },
  setPosition: (pos) => {
    ipcRenderer.send('set-position', pos);
  },
});
