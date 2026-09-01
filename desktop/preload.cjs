/* oxlint-disable typescript/no-require-imports -- Electron sandboxed preloads use CommonJS. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('schwankDesktop', {
  isDesktop: true,
  platform: process.platform,
  getState: () => ipcRenderer.invoke('desktop:get-state'),
  connect: (serverUrl) => ipcRenderer.invoke('desktop:connect', serverUrl),
  notify: (title, body, target) =>
    ipcRenderer.invoke('desktop:notify', title, body, target),
  setBadge: (count) => ipcRenderer.invoke('desktop:set-badge', count),
  onNotificationClick: (callback) => {
    const listener = (_event, target) => callback(String(target || ''));
    ipcRenderer.on('desktop:notification-click', listener);
    return () =>
      ipcRenderer.removeListener('desktop:notification-click', listener);
  },
  openSettings: () => ipcRenderer.invoke('desktop:open-settings'),
});
