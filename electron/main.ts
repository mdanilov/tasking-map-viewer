import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as url from 'url';

import { parseMapFile } from './parser';
import { FileLoadResponse } from '../common/ipc/file.load.response';
import { FileLoadRequest } from '../common/ipc/file.load.request';

let win: BrowserWindow;

app.on('ready', createWindow);

app.on('activate', () => {
  if (win === null) {
    createWindow();
  }
});

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
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

  win.on('closed', () => {
    win = null;
  });
}

ipcMain.on('loadFile', (event, arg) => {
  const response: FileLoadResponse = new FileLoadResponse();

  let fpath = (arg as FileLoadRequest).path;
  if (fpath == null) {
    const files = dialog.showOpenDialogSync({
      filters: [{ name: 'Linker Map File', extensions: ['map'] }],
      properties: ['openFile']
    });

    if (files != null && files.length > 0) {
      fpath = files[0];
    }
  }

  if (fpath) {
    response.path = fpath;
    win.webContents.send('loadFileResponse', response);

    parseMapFile(fpath).then( linkerMap => {
      response.payload = linkerMap;
      response.progress = 100;
      win.webContents.send('loadFileResponse', response);
    });
  }
});
