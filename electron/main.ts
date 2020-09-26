import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';

import { parseMapFile } from './parser';
import { FileLoadResponse } from '../common/ipc/file.load.response';
import { FileLoadRequest, FileSaveRequest } from '../common/ipc/file.load.request';

let win: BrowserWindow;
let lastPath: string;

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
      pathname: path.join(__dirname, `../map-viewer/index.html`),
      protocol: 'file:',
      slashes: true,
    })
  );

  win.on('closed', () => {
    win = null;
  });
}

ipcMain.on('saveFile', (event, arg) => {
  const content = (arg as FileSaveRequest).content;
  dialog.showSaveDialog({
    title: 'Select the File Path to save',
    defaultPath: lastPath,
    buttonLabel: 'Save',
    filters: [{ name: 'CSV File', extensions: ['csv']}]
  }).then(file => {
      console.log(file.canceled);
      if (!file.canceled) {
        console.log(file.filePath.toString());
        fs.writeFile(file.filePath.toString(), content, err => {
          if (err) { throw err; }
          console.log('Saved!');
        });
      }
  }).catch(err => {
    console.log(err);
  });
});

ipcMain.on('loadFile', (event, arg) => {
  const response: FileLoadResponse = new FileLoadResponse();

  let fpath = (arg as FileLoadRequest).path;
  if (fpath == null) {
    const files = dialog.showOpenDialogSync(win, {
      filters: [{ name: 'Linker Map File', extensions: ['map'] }],
      properties: ['openFile'],
      defaultPath: lastPath
    });

    if (files != null && files.length > 0) {
      fpath = files[0];
      lastPath = fpath;
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
