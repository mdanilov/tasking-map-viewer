import { Component, OnInit } from '@angular/core';
import * as Handsontable from 'handsontable';

import { FileService } from './file.service';
import { LinkerMap } from '../../common/interfaces/linkermap';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'map-viewer';
  filePath: string;
  linkerMap: LinkerMap;
  dataset = [];

  tableSettings: Handsontable.default.GridSettings = {
    rowHeaders: false,
    colHeaders: true,
    columnSorting: true,
    currentRowClassName: 'currentRow',
    manualColumnResize: true,
    stretchH: 'all',
    minRows: 30,
    preventOverflow: 'horizontal',
    readOnly: true,
    licenseKey: 'non-commercial-and-evaluation',
    disableVisualSelection: true,
    fragmentSelection: true, // enable text selection within table
    dataSchema: { name: null, archiveName: null, extractSymbol: null }
  };

  constructor(private fileService: FileService) {}

  onSelect() {
    this.loadFile();
  }

  onEnter(value: string) {
    this.loadFile(value);
  }

  loadFile(path?: string) {
    this.fileService.loadFile(path).then(fileInfo => {
      this.filePath = fileInfo.path;
      this.linkerMap = fileInfo.payload as LinkerMap;
      this.dataset = this.linkerMap.processedFiles;
    });
  }
}
