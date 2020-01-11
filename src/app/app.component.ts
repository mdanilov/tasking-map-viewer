import { Component, OnInit } from '@angular/core';

import { FileService } from './file.service';
import { LinkerMap } from '../../common/interfaces/linkermap';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'map-viewer';
  filePath: string;
  linkerMap: LinkerMap;

  constructor(private fileService: FileService) {}

  ngOnInit() {
    this.loadFile();
  }

  loadFile() {
    this.fileService.loadFile().then(fileInfo => {
      this.filePath = fileInfo.path;
      this.linkerMap = fileInfo.payload as LinkerMap;
    });
  }
}
