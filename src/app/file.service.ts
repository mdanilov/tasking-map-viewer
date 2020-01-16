import { Injectable } from '@angular/core';
import { IpcRenderer } from 'electron';

import { FileLoadResponse } from '../../common/ipc/file.load.response';
import { FileLoadRequest } from '../../common/ipc/file.load.request';

export interface FileInfo {
  payload: any;
  path: string | undefined;
}

export type FileProgressCallback = (percent?: number) => void;

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

  async loadFile(path?: string, progressCallback?: FileProgressCallback): Promise<FileInfo> {
    return new Promise<FileInfo>((resolve, reject) => {
      this.ipc.on('loadFileResponse', (event, arg) => {
        const response: FileLoadResponse = arg;
        if (progressCallback != null) {
          progressCallback(response.progress);
        }
        if (response.progress === 100) {
          this.ipc.removeAllListeners('loadFileResponse');
          return resolve(response as FileInfo);
        }
      });
      this.ipc.send('loadFile', { path });
    });
  }
}
