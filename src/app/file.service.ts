import { Injectable } from '@angular/core';
import { IpcRenderer } from 'electron';

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

  async getFiles() {
    return new Promise<string[]>((resolve, reject) => {
      this.ipc.once('getFilesResponse', (event, arg) => {
        resolve(arg);
      });
      this.ipc.send('getFiles');
    });
  }
}
