/* oxlint-disable typescript/no-require-imports -- Electron sandboxed preloads use CommonJS. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('schwankDesktop', {
  isDesktop: true,
  platform: process.platform,
  getState: () => ipcRenderer.invoke('desktop:get-state'),
  connect: (serverUrl) => ipcRenderer.invoke('desktop:connect', serverUrl),
  notify: (title, body) => ipcRenderer.invoke('desktop:notify', title, body),
  openSettings: () => ipcRenderer.invoke('desktop:open-settings'),
});
