/* =====================================================================
   SANITECH — Electron (main process)
   Fenêtre d'application de bureau, 100 % hors-ligne (fichiers locaux).
   ===================================================================== */
'use strict';

const { app, BrowserWindow, shell, Menu, session } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 420,
    minHeight: 620,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'www', 'assets', 'icon-512.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  Menu.setApplicationMenu(null);

  // Les liens externes s'ouvrent dans le navigateur système
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
}

app.whenReady().then(() => {
  // Autorise caméra / notifications dans la fenêtre
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media' || permission === 'notifications' || permission === 'clipboard-read');
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
