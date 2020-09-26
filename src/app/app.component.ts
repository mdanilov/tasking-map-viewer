import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HotTableRegisterer } from '@handsontable/angular';
import * as Handsontable from 'handsontable';

import { FileService, FileProgressCallback } from './file.service';
import { StatsService, StatsParams } from './stats.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'map-viewer';
  filePath: string;
  showProgressBar: boolean;
  currentView: string;
  statsParams: StatsParams = new StatsParams();

  private hotRegisterer = new HotTableRegisterer();

  dataset = [];
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
    colWidths: [20, 10, 10, 20],
    currentRowClassName: 'currentRow',
    manualColumnResize: true,
    stretchH: 'all',
    minRows: 30,
    preventOverflow: 'horizontal',
    readOnly: true,
    licenseKey: 'non-commercial-and-evaluation',
    disableVisualSelection: 'area',
    fragmentSelection: true, // enable text selection within table
    dataSchema: { name: null, chip: null, group: null, size: null, actualSize: null },
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

  constructor(private fileService: FileService, private statsService: StatsService, private cd: ChangeDetectorRef) {
    this.showProgressBar = false;
    this.currentView = 'main';

    this.statsParams.showObjectFiles = false;
    this.statsParams.groupByGroup = true;
    this.statsParams.groupByModule = true;
    this.statsParams.bssSectionNames = '.bss';
    this.statsParams.dataSectionNames = '.data';
    this.statsParams.textSectionNames = '.text';
    this.statsService.setParams(this.statsParams);
  }

  ngOnInit() {
    this.statsService.locationStats.subscribe(res => {
      this.locationTableDataset = Array.from(res.values()).map(loc => {
        loc.group = Array.from(loc.group.values()).join(', ');
        loc.name = Array.from(loc.name.values()).join(', ');
        return loc;
      });
    });
    this.statsService.dataStats.subscribe(res => {
      this.dataset = Array.from(res.values());
    });
  }

  onSelect() {
    this.loadFile();
  }

  onSettings() {
    this.currentView = 'settings';
  }

  onClose() {
    // if (this.linkerMap) {
    //   this.dataset = this.prepareDataset(this.linkerMap);
    // }
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
        const values = filterValue.split('|').filter(v => v.length > 0);
        values.forEach((value) => {
          filtersPlugin.addCondition(moduleColumn, 'contains', [value], 'disjunction');
        });
        filtersPlugin.filter();
      }
    }
  }

  onExportCsvLocation() {
    const table = this.hotRegisterer.getInstance(this.locationTableId);
    if (table) {
      const exportedString = table.getPlugin('exportFile').exportAsString('csv', {
        bom: false,
        columnDelimiter: ',',
        columnHeaders: true,
        exportHiddenColumns: true,
        exportHiddenRows: true,
        mimeType: 'text/csv',
        rowDelimiter: '\r\n',
        rowHeaders: false
      });
      this.fileService.saveFile(exportedString);
    }
  }

  onExportCsvModules() {
    const table = this.hotRegisterer.getInstance(this.modulesTableId);
    if (table) {
      const exportedString = table.getPlugin('exportFile').exportAsString('csv', {
        bom: false,
        columnDelimiter: ',',
        columnHeaders: true,
        exportHiddenColumns: true,
        exportHiddenRows: true,
        mimeType: 'text/csv',
        rowDelimiter: '\r\n',
        rowHeaders: false
      });
      this.fileService.saveFile(exportedString);
    }
  }

  toggleShowObjectFilesCheckbox(checked: boolean) {
    this.statsParams.showObjectFiles = checked;
    this.statsService.setParams(this.statsParams);
  }

  checkGroupByGroup(checked: boolean) {
    this.statsParams.groupByGroup = checked;
    this.statsService.setParams(this.statsParams);
  }

  checkGroupByModule(checked: boolean) {
    this.statsParams.groupByModule = checked;
    this.statsService.setParams(this.statsParams);
  }

  loadFile(path?: string) {
    this.fileService.loadFile(path,
      (percent) => {
        this.showProgressBar = true;
        this.cd.detectChanges(); // notify angular about view changes
      }).then(fileInfo => {
        this.filePath = fileInfo.path;
        this.showProgressBar = false;

        this.statsService.analyze(fileInfo.payload);

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
