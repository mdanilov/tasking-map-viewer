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
  showObjectFiles = false;
  groupByGroup = true;
  groupByModule = true;
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
    colWidths: [20, 10, 20],
    currentRowClassName: 'currentRow',
    manualColumnResize: true,
    stretchH: 'all',
    minRows: 30,
    preventOverflow: 'horizontal',
    readOnly: true,
    licenseKey: 'non-commercial-and-evaluation',
    disableVisualSelection: 'area',
    fragmentSelection: true, // enable text selection within table
    dataSchema: { name: null, chip: null, group: null, size: null },
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
        const values = filterValue.split('|').filter(v => v.length > 0);
        values.forEach((value) => {
          filtersPlugin.addCondition(moduleColumn, 'contains', [value], 'disjunction');
        });
        filtersPlugin.filter();
      }
    }
  }

  toggleShowObjectFilesCheckbox(checked: boolean) {
    this.showObjectFiles = checked;
    if (this.linkerMap) {
      this.dataset = this.prepareDataset(this.linkerMap);
    }
  }

  checkGroupByGroup(checked: boolean) {
    this.groupByGroup = checked;
    if (this.linkerMap) {
      this.dataset = this.prepareDataset(this.linkerMap);
    }
  }

  checkGroupByModule(checked: boolean) {
    this.groupByModule = checked;
    if (this.linkerMap) {
      this.dataset = this.prepareDataset(this.linkerMap);
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

    const dataset = new Map();
    const locationDataset = new Map();
    linkerMap.linkResult.forEach((record) => {
      const archiveName = fileToArchive.get(record.fileName);
      const totalSize = this.calcTotalSectionSizes(record);
      const name = archiveName ? (this.showObjectFiles ? archiveName + '(' + record.fileName + ')' : archiveName) : record.fileName;

      if (!dataset.has(name)) {
        dataset.set(name, {
          name,
          bssSize: totalSize.get(SectionType.Bss),
          dataSize: totalSize.get(SectionType.Data),
          textSize: totalSize.get(SectionType.Text),
          otherSize: totalSize.get(SectionType.Other),
        });
      } else {
        dataset.get(name).bssSize += totalSize.get(SectionType.Bss);
        dataset.get(name).dataSize += totalSize.get(SectionType.Data);
        dataset.get(name).textSize += totalSize.get(SectionType.Text);
        dataset.get(name).otherSize += totalSize.get(SectionType.Other);
      }

      // chip <-> size
      record.sections.forEach((section) => {
        const location = sectionLocationMapping.get(section.out.section);
        if (location) {
          let key = location.chip;
          if (this.groupByGroup) {
            key += location.group;
          }
          if (this.groupByModule) {
            key += name;
          }
          if (!locationDataset.has(key)) {
            locationDataset.set(key, { name: new Set(), chip: location.chip, group: new Set(), size: location.size });
            locationDataset.get(key).name.add(name);
            locationDataset.get(key).group.add(location.group);
          } else {
            locationDataset.get(key).size += location.size;
            if (!this.groupByGroup) {
              locationDataset.get(key).group.add(location.group);
            }
            if (!this.groupByModule) {
              locationDataset.get(key).name.add(name);
            }
          }
        }
      });
    });

    this.locationTableDataset = Array.from(locationDataset.values()).map(loc => {
      loc.group = Array.from(loc.group.values()).join(', ');
      loc.name = Array.from(loc.name.values()).join(', ');
      return loc;
    });

    return Array.from(dataset.values());
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
