import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  session,
  Tray,
} from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  healthEndpoint,
  isAllowedApplicationUrl,
  normalizeServerUrl,
} from './server-url.mjs';
import {
  attentionLabel,
  normalizeAttentionCount,
  shouldHideWindowOnClose,
} from './background-state.mjs';

const rootDirectory = import.meta.dirname;
const setupPath = join(rootDirectory, 'setup', 'index.html');
const setupUrl = pathToFileURL(setupPath).toString();
const iconPath = app.isPackaged
  ? join(process.resourcesPath, 'icon.png')
  : join(rootDirectory, 'assets', 'icon.png');
const cliServerUrl = process.argv
  .find((argument) => argument.startsWith('--server-url='))
  ?.slice('--server-url='.length);

let mainWindow = null;
let serverUrl = null;
let tray = null;
let isQuitting = false;

app.enableSandbox();

function configPath() {
  return join(app.getPath('userData'), 'config.json');
}

async function readSavedServerUrl() {
  const override = cliServerUrl || process.env.SCHWANK_SERVER_URL;
  if (override) return normalizeServerUrl(override);
  try {
    const config = JSON.parse(await readFile(configPath(), 'utf8'));
    return normalizeServerUrl(config.serverUrl);
  } catch {
    return null;
  }
}

async function saveServerUrl(nextServerUrl) {
  await writeFile(
    configPath(),
    `${JSON.stringify({ serverUrl: nextServerUrl }, null, 2)}\n`,
    { mode: 0o600 },
  );
}

async function checkServer(candidate) {
  const normalized = normalizeServerUrl(candidate);
  const response = await fetch(healthEndpoint(normalized), {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok)
    throw new Error(`The server returned HTTP ${response.status}.`);
  const body = await response.json();
  if (
    body?.ok !== true ||
    body?.service !== 'schwank-server' ||
    body?.apiVersion !== 1
  )
    throw new Error('That address is not a compatible schwank server.');
  return normalized;
}

function senderUrl(event) {
  return event.senderFrame?.url || '';
}

function isSetupSender(event) {
  return senderUrl(event) === setupUrl;
}

function isRemoteSender(event) {
  if (!serverUrl) return false;
  try {
    return new URL(senderUrl(event)).origin === serverUrl;
  } catch {
    return false;
  }
}

async function showSetup() {
  if (!mainWindow) return;
  await mainWindow.loadFile(setupPath);
}

async function showApplication() {
  if (!mainWindow || !serverUrl) return;
  await mainWindow.loadURL(`${serverUrl}/`);
}

function showMainWindow() {
  if (!mainWindow) {
    void createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function installTray() {
  const trayImage = nativeImage.createFromPath(iconPath).resize({
    width: 20,
    height: 20,
  });
  tray = new Tray(trayImage);
  tray.setToolTip('schwank');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open schwank', click: showMainWindow },
      { label: 'Server Settings…', click: () => void showSetup() },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('click', showMainWindow);
}

function installIpcHandlers() {
  ipcMain.handle('desktop:get-state', (event) => {
    if (!isSetupSender(event) && !isRemoteSender(event))
      throw new Error('Untrusted desktop request.');
    return {
      serverUrl,
      version: app.getVersion(),
      platform: process.platform,
    };
  });

  ipcMain.handle('desktop:connect', async (event, candidate) => {
    if (!isSetupSender(event)) throw new Error('Untrusted connection request.');
    try {
      const nextServerUrl = await checkServer(candidate);
      serverUrl = nextServerUrl;
      await saveServerUrl(nextServerUrl);
      setImmediate(() => void showApplication());
      return { ok: true, serverUrl: nextServerUrl };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'The schwank server could not be reached.',
      };
    }
  });

  ipcMain.handle('desktop:notify', (event, title, body, target) => {
    if (!isRemoteSender(event))
      throw new Error('Untrusted notification request.');
    if (mainWindow?.isFocused() || !Notification.isSupported()) return false;
    const safeTitle =
      String(title ?? '')
        .trim()
        .slice(0, 80) || 'schwank';
    const safeBody = String(body ?? '')
      .trim()
      .slice(0, 240);
    if (!safeBody) return false;
    const notification = new Notification({
      title: safeTitle,
      body: safeBody,
      icon: iconPath,
    });
    notification.on('click', () => {
      if (!mainWindow) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send(
        'desktop:notification-click',
        String(target ?? '').slice(0, 120),
      );
    });
    notification.show();
    return true;
  });

  ipcMain.handle('desktop:set-badge', (event, value) => {
    if (!isRemoteSender(event))
      throw new Error('Untrusted badge update request.');
    const count = normalizeAttentionCount(value);
    tray?.setToolTip(attentionLabel(count));
    app.setBadgeCount(count);
    return count;
  });

  ipcMain.handle('desktop:open-settings', async (event) => {
    if (!isRemoteSender(event)) throw new Error('Untrusted settings request.');
    await showSetup();
    return true;
  });
}

function installMenu() {
  const settingsItem = {
    label: 'Server Settings…',
    accelerator: 'CmdOrCtrl+,',
    click: () => void showSetup(),
  };
  const template =
    process.platform === 'darwin'
      ? [
          {
            label: 'schwank',
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              settingsItem,
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
          { role: 'editMenu' },
          {
            label: 'View',
            submenu: [
              { role: 'reload' },
              { type: 'separator' },
              { role: 'resetZoom' },
              { role: 'zoomIn' },
              { role: 'zoomOut' },
              { type: 'separator' },
              { role: 'togglefullscreen' },
            ],
          },
          { role: 'windowMenu' },
        ]
      : [
          {
            label: 'File',
            submenu: [settingsItem, { type: 'separator' }, { role: 'quit' }],
          },
          { role: 'editMenu' },
          {
            label: 'View',
            submenu: [
              { role: 'reload' },
              { type: 'separator' },
              { role: 'resetZoom' },
              { role: 'zoomIn' },
              { role: 'zoomOut' },
              { type: 'separator' },
              { role: 'togglefullscreen' },
            ],
          },
          { role: 'windowMenu' },
        ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 650,
    show: false,
    backgroundColor: '#f7f5f0',
    title: 'schwank',
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: join(rootDirectory, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const restrictNavigation = (event, targetUrl) => {
    if (
      !isAllowedApplicationUrl(
        targetUrl,
        serverUrl || 'http://localhost',
        setupUrl,
      )
    )
      event.preventDefault();
  };
  mainWindow.webContents.on('will-navigate', restrictNavigation);
  mainWindow.webContents.on('will-redirect', restrictNavigation);
  mainWindow.webContents.on('will-attach-webview', (event) =>
    event.preventDefault(),
  );
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('close', (event) => {
    if (!shouldHideWindowOnClose(isQuitting)) return;
    event.preventDefault();
    mainWindow?.hide();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const savedServerUrl = await readSavedServerUrl();
  if (savedServerUrl) {
    try {
      serverUrl = await checkServer(savedServerUrl);
      await showApplication();
      return;
    } catch {
      serverUrl = savedServerUrl;
    }
  }
  await showSetup();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });
  void app.whenReady().then(async () => {
    app.setName('schwank');
    session.defaultSession.setPermissionRequestHandler(
      (_webContents, _permission, callback) => callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.on('will-download', (event) =>
      event.preventDefault(),
    );
    installIpcHandlers();
    installMenu();
    installTray();
    await createWindow();
  });
  app.on('before-quit', () => {
    isQuitting = true;
  });
  app.on('activate', () => {
    showMainWindow();
  });
}
