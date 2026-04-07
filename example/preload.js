const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('spacesAPI', {
  saveState: () => ipcRenderer.invoke('save-state'),
  encodeState: () => ipcRenderer.invoke('encode-state'),
  getStatePath: () => ipcRenderer.invoke('get-state-path'),
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (_event, data) => callback(data));
  },
});
