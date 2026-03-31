const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const os = require('os');
const { createStore } = require('./store.js');
const { readCredentials, fetchClaudeUsage } = require('./claude-api.js');
const { parseCodexUsage } = require('./codex-parser.js');
const { createPoller } = require('./data-poller.js');
const { createTrayManager } = require('./tray-manager.js');

const MINI_SIZE = { width: 300, height: 60 };
const CARD_SIZE = { width: 340, height: 320 };

let win;
let tray;
let poller;
let store;

function clampPosition(x, y, width, height) {
  const displays = screen.getAllDisplays();
  for (const display of displays) {
    const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
    if (x >= dx && x + width <= dx + dw && y >= dy && y + height <= dy + dh) {
      return { x, y }; // Already visible
    }
  }
  // Clamp to primary display
  const primary = screen.getPrimaryDisplay().workArea;
  return {
    x: Math.max(primary.x, Math.min(x, primary.x + primary.width - width)),
    y: Math.max(primary.y, Math.min(y, primary.y + primary.height - height)),
  };
}

function createWindow() {
  const pos = store.get('windowPosition');
  const mode = store.get('mode');
  const size = mode === 'card' ? CARD_SIZE : MINI_SIZE;
  const clamped = clampPosition(pos.x, pos.y, size.width, size.height);

  win = new BrowserWindow({
    width: size.width,
    height: size.height,
    x: clamped.x,
    y: clamped.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
    // Tell renderer the initial mode
    if (mode === 'card') {
      win.webContents.executeJavaScript(
        "document.getElementById('widget').classList.remove('mini'); document.getElementById('widget').classList.add('card');"
      );
    }
  });

  // Save position on move
  win.on('moved', () => {
    const [x, y] = win.getPosition();
    store.set('windowPosition', { x, y });
  });

  // Minimize to tray instead of closing
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  // Handle display changes
  screen.on('display-removed', () => {
    const [x, y] = win.getPosition();
    const [w, h] = win.getSize();
    const clamped = clampPosition(x, y, w, h);
    win.setPosition(clamped.x, clamped.y);
  });

  screen.on('display-metrics-changed', () => {
    const [x, y] = win.getPosition();
    const [w, h] = win.getSize();
    const clamped = clampPosition(x, y, w, h);
    win.setPosition(clamped.x, clamped.y);
  });
}

function setupIPC() {
  ipcMain.on('refresh', () => {
    poller.refresh();
  });

  ipcMain.on('toggle-mode', () => {
    const currentMode = store.get('mode');
    if (currentMode === 'mini') {
      store.set('mode', 'card');
      win.setSize(CARD_SIZE.width, CARD_SIZE.height);
    } else {
      store.set('mode', 'mini');
      win.setSize(MINI_SIZE.width, MINI_SIZE.height);
    }
  });

  ipcMain.on('hide', () => {
    win.hide();
  });

  ipcMain.on('set-position', (_event, pos) => {
    store.set('windowPosition', pos);
  });
}

async function fetchAllData() {
  const homeDir = os.homedir();
  const result = { claude: null, codex: null };

  // Fetch Claude
  const token = readCredentials(homeDir);
  if (!token) {
    win.webContents.send('fetch-error', { source: 'claude', message: 'NO_CREDENTIALS' });
  } else {
    try {
      result.claude = await fetchClaudeUsage(token);
    } catch (err) {
      win.webContents.send('fetch-error', { source: 'claude', message: err.message });
      throw err; // Propagate for backoff
    }
  }

  // Fetch Codex
  const codex = parseCodexUsage(homeDir);
  if (codex === null) {
    const codexDir = path.join(homeDir, '.codex', 'sessions');
    const fs = require('fs');
    if (!fs.existsSync(codexDir)) {
      win.webContents.send('fetch-error', { source: 'codex', message: 'CODEX_NOT_INSTALLED' });
    } else {
      win.webContents.send('fetch-error', { source: 'codex', message: 'CODEX_NO_DATA' });
    }
  } else {
    result.codex = codex;
  }

  return result;
}

app.whenReady().then(() => {
  store = createStore(app.getPath('userData'));
  createWindow();

  poller = createPoller({
    fetcher: fetchAllData,
    onData: (data) => {
      win.webContents.send('usage-data', data);
    },
    onError: (message, lastData, lastUpdatedAt) => {
      // Errors already sent per-source in fetchAllData
    },
    interval: store.get('pollInterval'),
  });

  setupIPC();
  tray = createTrayManager({ win, onRefresh: () => poller.refresh(), store });
  poller.start();
});

app.on('window-all-closed', () => {
  // Don't quit on window close — tray keeps running
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
