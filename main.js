const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true
  });

  // Set menu to null to completely hide it
  Menu.setApplicationMenu(null);

  mainWindow.loadFile('index.html');

  // Log console messages from renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer]: ${message}`);
  });
}

// Get default save directory
function getDefaultSaveDirectory() {
  const documentsPath = app.getPath('documents');
  const savePath = path.join(documentsPath, 'PromptManager');

  // Create directory if it doesn't exist
  if (!fs.existsSync(savePath)) {
    fs.mkdirSync(savePath, { recursive: true });
  }

  return savePath;
}

// IPC Handlers
ipcMain.handle('get-default-save-directory', () => {
  return getDefaultSaveDirectory();
});

ipcMain.handle('get-save-directory', () => {
  const configPath = path.join(app.getPath('userData'), 'config.json');

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return config.saveDirectory || getDefaultSaveDirectory();
    } catch (error) {
      console.error('Error reading config:', error);
      return getDefaultSaveDirectory();
    }
  }

  return getDefaultSaveDirectory();
});

ipcMain.handle('set-save-directory', (event, directory) => {
  const configPath = path.join(app.getPath('userData'), 'config.json');

  try {
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    config.saveDirectory = directory;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Create directory if it doesn't exist
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving config:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('choose-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }

  return null;
});

ipcMain.handle('save-plans', async (event, plans, saveDirectory) => {
  try {
    const filePath = path.join(saveDirectory, 'plans.json');
    fs.writeFileSync(filePath, JSON.stringify(plans, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error saving plans:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-plans', async (event, saveDirectory) => {
  try {
    const filePath = path.join(saveDirectory, 'plans.json');

    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return { success: true, plans: JSON.parse(data) };
    }

    return { success: true, plans: null };
  } catch (error) {
    console.error('Error loading plans:', error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});