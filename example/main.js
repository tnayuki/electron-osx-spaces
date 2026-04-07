const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const spaces = require('../index');

let STATE_FILE;
let mainWindow;

function loadSavedState() {
  try {
    const json = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return {
      bounds: json.bounds,
      spaceData: json.spaceData ? Buffer.from(json.spaceData, 'base64') : null,
    };
  } catch {
    return null;
  }
}

function saveState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const bounds = mainWindow.getBounds();
  const spaceData = spaces.encodeState(mainWindow);

  const state = {
    bounds,
    spaceData: spaceData ? spaceData.toString('base64') : null,
  };

  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log('[spaces] State saved:', {
    bounds,
    spaceDataSize: spaceData ? spaceData.length : 0,
  });
}

function createWindow() {
  const saved = loadSavedState();

  const opts = {
    width: 800,
    height: 600,
    title: 'electron-osx-spaces test',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  };

  if (saved?.bounds) {
    opts.x = saved.bounds.x;
    opts.y = saved.bounds.y;
    opts.width = saved.bounds.width;
    opts.height = saved.bounds.height;
  }

  mainWindow = new BrowserWindow(opts);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  if (saved?.spaceData) {
    const ok = spaces.restoreState(mainWindow, saved.spaceData, {
      restoreSpace: true,
    });
    console.log('[spaces] restoreState result:', ok);
  } else {
    console.log('[spaces] No saved space data to restore');
  }

  const statusInterval = setInterval(() => {
    if (mainWindow.isDestroyed()) {
      clearInterval(statusInterval);
      return;
    }
    const data = spaces.encodeState(mainWindow);
    mainWindow.webContents.send('status-update', {
      bounds: mainWindow.getBounds(),
      spaceDataSize: data ? data.length : 0,
      spaceDataPreview: data ? data.subarray(0, 64).toString('hex') : null,
    });
  }, 2000);
}

app.whenReady().then(() => {
  STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');
  createWindow();

  ipcMain.handle('save-state', () => {
    saveState();
    return true;
  });

  ipcMain.handle('encode-state', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return null;
    const data = spaces.encodeState(mainWindow);
    return data
      ? { size: data.length, hex: data.subarray(0, 128).toString('hex') }
      : null;
  });

  ipcMain.handle('get-state-path', () => STATE_FILE);
});

app.on('before-quit', () => {
  saveState();
});

app.on('window-all-closed', () => {
  app.quit();
});
