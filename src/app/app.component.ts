import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HotTableRegisterer } from '@handsontable/angular';
import * as Handsontable from 'handsontable';

import { FileService, FileProgressCallback } from './file.service';
import { LinkerMap, LinkRecord, SectionType } from '../../common/interfaces/linkermap';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'map-viewer';
  filePath: string;
  linkerMap: LinkerMap;
  dataset = [];
  showProgressBar: boolean;
  currentView: string;
  bssSectionNames: string = '.bss';
  dataSectionNames: string = '.data';
  textSectionNames: string = '.text';

  private hotRegisterer = new HotTableRegisterer();
  modulesTableId = 'modules-table-id';
  tableSettings: Handsontable.default.GridSettings = {
    rowHeaders: false,
    colHeaders: true,
    columnSorting: true,
    colWidths: [10, 10, 10],
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
    nestedRows: false,
    filters: true
  };

  constructor(private fileService: FileService, private cd: ChangeDetectorRef) {
    this.showProgressBar = false;
    this.currentView = 'main';
  }

  ngOnInit() {
    //
  }

  onSelect() {
    this.loadFile();
  }

  onSettings() {
    this.currentView = 'settings';
  }

  onClose() {
    if (this.linkerMap) {
      this.dataset = this.prepareDataset(this.linkerMap);
    }
    this.currentView = 'main';
  }

  onEnter(value: string) {
    this.loadFile(value);
  }

  applyFilter(filterValue: string) {
    const filtersPlugin = this.hotRegisterer.getInstance(this.modulesTableId).getPlugin('filters');
    filtersPlugin.clearConditions(3);
    filtersPlugin.addCondition(3, 'contains', [filterValue], 'conjunction');
    filtersPlugin.filter();
  }

  getSectionType(section: string): SectionType {
    const name = section.substring(0, section.indexOf('.', 1));
    if (this.bssSectionNames.split(/\s*,\s*/).includes(name)) {
      return SectionType.Bss;
    } else if (this.dataSectionNames.split(/\s*,\s*/).includes(name)) {
      return SectionType.Data;
    } else if (this.textSectionNames.split(/\s*,\s*/).includes(name)) {
      return SectionType.Text;
    } else {
      return SectionType.Other;
    }
  }

  calcTotalSectionSizes(record: LinkRecord): Map<SectionType, number> {
    const result = new Map([
      [SectionType.Bss, 0],
      [SectionType.Data, 0],
      [SectionType.Text, 0],
      [SectionType.Other, 0],
    ]);

    record.sections.forEach((section) => {
      section.type = this.getSectionType(section.in.section);
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
    linkerMap.linkResult.forEach((record) => {
      const archiveName = fileToArchive.get(record.fileName);
      const totalSize = this.calcTotalSectionSizes(record);
      dataset.push({
        name: archiveName ? archiveName + '(' + record.fileName + ')' : record.fileName,
        bssSize: totalSize.get(SectionType.Bss),
        dataSize: totalSize.get(SectionType.Data),
        textSize: totalSize.get(SectionType.Text),
        otherSize: totalSize.get(SectionType.Other),
      });
    });

    return dataset;
  }

  loadFile(path?: string) {
    this.fileService.loadFile(path,
      (percent) => {
        this.showProgressBar = true;
        this.cd.detectChanges();      // notify angular about view changes
      }).then(fileInfo => {
        this.filePath = fileInfo.path;
        this.linkerMap = fileInfo.payload as LinkerMap;
        this.dataset = this.prepareDataset(this.linkerMap);
        this.showProgressBar = false;
      });
  }
}
