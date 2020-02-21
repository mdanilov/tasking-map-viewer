import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HotTableRegisterer } from '@handsontable/angular';
import * as Handsontable from 'handsontable';

import { FileService, FileProgressCallback } from './file.service';
import { LinkerMap, LinkRecord, SectionType, LocateRecord } from '../../common/interfaces/linkermap';

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
  bssSectionNames = '.bss';
  dataSectionNames = '.data';
  textSectionNames = '.text';

  displayedColumns: string[] = ['name', 'data', 'free', 'total'];
  usedResources = [];

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

  locationTableDataset = [];
  locationTableId = 'location-table-id';
  locationTableSettings: Handsontable.default.GridSettings = {
    rowHeaders: false,
    colHeaders: true,
    colWidths: [20, 10],
    currentRowClassName: 'currentRow',
    manualColumnResize: true,
    stretchH: 'all',
    minRows: 30,
    preventOverflow: 'horizontal',
    readOnly: true,
    licenseKey: 'non-commercial-and-evaluation',
    disableVisualSelection: 'area',
    fragmentSelection: true, // enable text selection within table
    dataSchema: { name: null, chip: null, size: null },
    wordWrap: true, // the text of the cell content is wrapped if it does not fit in the fixed column width
    autoColumnSize: false, // disable setting column widths based on their widest cells
    nestedRows: false,
    filters: true,
    columnSorting: false,
    multiColumnSorting: {
      initialConfig: [{
        column: 0,
        sortOrder: 'asc'
      }, {
        column: 1,
        sortOrder: 'desc'
      }]
    }
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
    for (const tableId of [this.modulesTableId, this.locationTableId]) {
      const table = this.hotRegisterer.getInstance(tableId);
      const filtersPlugin = table.getPlugin('filters');
      const moduleColumn = table.getColHeader().findIndex((col) => col === 'Module');
      if (moduleColumn) {
        filtersPlugin.clearConditions(moduleColumn);
        filtersPlugin.addCondition(moduleColumn, 'contains', [filterValue], 'conjunction');
        filtersPlugin.filter();
      }
    }
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
    const sectionLocationMapping = new Map<string, LocateRecord>();

    linkerMap.locateResult.forEach((locationRecord) => {
      sectionLocationMapping.set(locationRecord.section, locationRecord);
    });

    linkerMap.processedFiles.forEach((file) => {
      if (file.archiveName) {
        fileToArchive.set(file.name, file.archiveName);
      }
    });

    const dataset = [];
    const locationDataset = [];
    linkerMap.linkResult.forEach((record) => {
      const archiveName = fileToArchive.get(record.fileName);
      const totalSize = this.calcTotalSectionSizes(record);
      const name = archiveName ? archiveName + '(' + record.fileName + ')' : record.fileName;
      dataset.push({
        name,
        bssSize: totalSize.get(SectionType.Bss),
        dataSize: totalSize.get(SectionType.Data),
        textSize: totalSize.get(SectionType.Text),
        otherSize: totalSize.get(SectionType.Other),
      });

      // chip <-> size
      const fileChipSizeStats = new Map<string, number>();
      record.sections.forEach((section) => {
        const location = sectionLocationMapping.get(section.out.section);
        if (location) {
          if (!fileChipSizeStats.has(location.chip)) {
            fileChipSizeStats.set(location.chip, location.size);
          } else {
            fileChipSizeStats[location.chip] += location.size;
          }
        }
      });

      fileChipSizeStats.forEach((value, key) => {
        locationDataset.push({ name, chip: key, size: value });
      });
    });

    this.locationTableDataset = locationDataset;

    return dataset;
  }

  loadFile(path?: string) {
    this.fileService.loadFile(path,
      (percent) => {
        this.showProgressBar = true;
        this.cd.detectChanges(); // notify angular about view changes
      }).then(fileInfo => {
        this.filePath = fileInfo.path;
        this.linkerMap = fileInfo.payload as LinkerMap;
        this.dataset = this.prepareDataset(this.linkerMap);
        this.showProgressBar = false;
        this.usedResources = this.linkerMap.usedResources.memory;
        this.cd.detectChanges(); // notify angular about view changes

        const multiColumnSortingPlugin = this.hotRegisterer.getInstance(this.locationTableId).getPlugin('multiColumnSorting');
        multiColumnSortingPlugin.sort([{
          column: 0, sortOrder: 'asc'
        }, {
          column: 1, sortOrder: 'desc'
        }]);
      });
  }
}
