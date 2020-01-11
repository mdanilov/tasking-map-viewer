import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as url from 'url';

import { parseMapFile } from './parser';
import { FileLoadResponse } from '../common/ipc/file.load.response';

let win: BrowserWindow;

app.on('ready', createWindow);

app.on('activate', () => {
  if (win === null) {
    createWindow();
  }
});

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
    }
  });

  win.loadURL(
    url.format({
      pathname: path.join(__dirname, `../../../dist/map-viewer/index.html`),
      protocol: 'file:',
      slashes: true,
    })
  );

  win.webContents.openDevTools();

  win.on('closed', () => {
    win = null;
  });
}

ipcMain.on('loadFile', (event, arg) => {
  const response: FileLoadResponse = new FileLoadResponse();

  const file = dialog.showOpenDialogSync({
    filters: [{ name: 'Linker Map File', extensions: ['map'] }],
    properties: ['openFile']
  });

  if (file.length > 0) {

    response.path = file[0];
    win.webContents.send('loadFileResponse', response);

    parseMapFile(file[0]).then( linkerMap => {
      response.payload = linkerMap;
      response.progress = 100;
      win.webContents.send('loadFileResponse', response);
    });
  }
});
