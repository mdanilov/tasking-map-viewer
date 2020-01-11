import { Injectable } from '@angular/core';
import { IpcRenderer } from 'electron';

import { FileLoadResponse } from '../../common/ipc/file.load.response';

export interface FileInfo {
  payload: any;
  path: string | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class FileService {
  private ipc: IpcRenderer | undefined;

  constructor() {
    if ((window as any).require) {
      this.ipc = (window as any).require('electron').ipcRenderer;
    } else {
      console.warn('Electron\'s IPC was not loaded');
    }
  }

  async loadFile(): Promise<FileInfo> {
    return new Promise<FileInfo>((resolve, reject) => {
      this.ipc.on('loadFileResponse', (event, arg) => {
        const response: FileLoadResponse = arg;
        if (response.progress === 100) {
          this.ipc.removeAllListeners('loadFileResponse');
          return resolve(response as FileInfo);
        }
      });
      this.ipc.send('loadFile');
    });
  }
}
