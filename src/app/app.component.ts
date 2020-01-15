import { Component, OnInit } from '@angular/core';
import * as Handsontable from 'handsontable';

import { FileService } from './file.service';
import { LinkerMap, LinkRecord, SectionType } from '../../common/interfaces/linkermap';

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
    rowHeaders: true,
    colHeaders: true,
    columnSorting: true,
    currentRowClassName: 'currentRow',
    manualColumnResize: true,
    stretchH: 'all',
    minRows: 30,
    preventOverflow: 'horizontal',
    readOnly: true,
    licenseKey: 'non-commercial-and-evaluation',
    disableVisualSelection: 'area',
    fragmentSelection: true, // enable text selection within table
    dataSchema: { name: null, bssSize: null, dataSize: null, textSize: null },
    wordWrap: true, // the text of the cell content is wrapped if it does not fit in the fixed column width
    autoColumnSize: false, // disable setting column widths based on their widest cells
    nestedRows: true,
  };

  constructor(private fileService: FileService) {}

  onSelect() {
    this.loadFile();
  }

  onEnter(value: string) {
    this.loadFile(value);
  }

  calcTotalSectionSizes(record: LinkRecord): Map<SectionType, number> {
    const result = new Map([
      [SectionType.Bss,   0],
      [SectionType.Data,  0],
      [SectionType.Text,  0],
      [SectionType.Other, 0],
    ]);

    record.sections.forEach((section) => {
      result.set(section.type, result.get(section.type) + section.in.size);
    });

    return result;
  }

  prepareDataset(linkerMap: LinkerMap) {
    const fileToArchive = new Map<string, string>();

    linkerMap.processedFiles.forEach((file) => {
      if (file.archiveName) {
        fileToArchive.set(file.name, file.archiveName);
      }
    });

    const dataset = [];
    const archiveRefs = new Map<string, any>();

    linkerMap.linkResult.forEach((record) => {
      // the file is from archive
      if (fileToArchive.has(record.fileName)) {
        const archiveName = fileToArchive.get(record.fileName);

        // this archive was not created yet
        if (!archiveRefs.has(archiveName)) {
          const newArchive = {
            name: archiveName,
            bssSize: 0,
            dataSize: 0,
            textSize: 0,
            otherSize: 0,
            __children: []
          };
          archiveRefs.set(archiveName, newArchive);
          dataset.push(newArchive);
        }

        const totalSize = this.calcTotalSectionSizes(record);
        const archiveRef = archiveRefs.get(archiveName);

        // add file to the archive children property
        archiveRef.__children.push({
          name: record.fileName,
          bssSize: totalSize.get(SectionType.Bss),
          dataSize: totalSize.get(SectionType.Data),
          textSize: totalSize.get(SectionType.Text),
          otherSize: totalSize.get(SectionType.Other),
        });

        // updates sum sizes for archive
        archiveRef.bssSize += totalSize.get(SectionType.Bss);
        archiveRef.dataSize += totalSize.get(SectionType.Data);
        archiveRef.textSize += totalSize.get(SectionType.Text);
        archiveRef.otherSize += totalSize.get(SectionType.Other);
      // the file has linked directly (obj file)
      } else {
        const totalSize = this.calcTotalSectionSizes(record);
        dataset.push({
          name: record.fileName,
          bssSize: totalSize.get(SectionType.Bss),
          dataSize: totalSize.get(SectionType.Data),
          textSize: totalSize.get(SectionType.Text),
          otherSize: totalSize.get(SectionType.Other),
        });
      }
    });

    return dataset;
  }

  loadFile(path?: string) {
    this.fileService.loadFile(path).then(fileInfo => {
      this.filePath = fileInfo.path;
      this.dataset = this.prepareDataset(fileInfo.payload as LinkerMap);
    });
  }
}
