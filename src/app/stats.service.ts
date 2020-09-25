import { Injectable } from '@angular/core';
import { ReplaySubject } from 'rxjs';

import { Memory, LinkerMap, LocateRecord, LinkRecord, SectionType } from '../../common/interfaces/linkermap';

export interface ResourceStats extends Memory {
  chipData: number;
  chipFree: number;
}

export class StatsParams {
  showObjectFiles: boolean;
  groupByGroup: boolean;
  groupByModule: boolean;
  bssSectionNames: string;
  dataSectionNames: string;
  textSectionNames: string;

  constructor() {
    this.showObjectFiles = false;
    this.groupByGroup = true;
    this.groupByModule = true;
    this.bssSectionNames = '.bss';
    this.dataSectionNames = '.data';
    this.textSectionNames = '.text';
  }
}

@Injectable({
  providedIn: 'root'
})
export class StatsService {

  private usedResourcesSource = new ReplaySubject<ResourceStats[]>();

  private locationSource = new ReplaySubject<Map<any, any>>();

  private dataSource = new ReplaySubject<Map<any, any>>();

  private params = new StatsParams();

  private linkerMap: LinkerMap;

  resourceStats = this.usedResourcesSource.asObservable();
  locationStats = this.locationSource.asObservable();
  dataStats = this.dataSource.asObservable();

  setParams(params: StatsParams) {
    this.params = params;
    if (this.linkerMap) {
      this.prepareDataset(this.linkerMap);
    }
  }

  getParams(): StatsParams { return this.params; }

  calcActualSize(location: LocateRecord): number {
    let size = location.size;
    if (location.size < location.alignment) {
      size = location.alignment;
    } else if ((location.size % location.alignment) !== 0) {
      size = location.size + (location.alignment - location.size % location.alignment);
    }
    return size;
  }

  getSectionType(section: string): SectionType {
    const name = section.substring(0, section.indexOf('.', 1));
    if (this.params.bssSectionNames.split(/\s*,\s*/).includes(name)) {
      return SectionType.Bss;
    } else if (this.params.dataSectionNames.split(/\s*,\s*/).includes(name)) {
      return SectionType.Data;
    } else if (this.params.textSectionNames.split(/\s*,\s*/).includes(name)) {
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
      const name = archiveName ? (this.params.showObjectFiles ? archiveName + '(' + record.fileName + ')' : archiveName) : record.fileName;

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
          if (this.params.groupByGroup) {
            key += location.group;
          }
          if (this.params.groupByModule) {
            key += name;
          }
          if (!locationDataset.has(key)) {
            locationDataset.set(key, {
              name: new Set(),
              chip: location.chip,
              group: new Set(),
              size: location.size,
              actualSize: this.calcActualSize(location)
            });
            locationDataset.get(key).name.add(name);
            locationDataset.get(key).group.add(location.group);
          } else {
            locationDataset.get(key).size += location.size;
            locationDataset.get(key).actualSize += this.calcActualSize(location);
            if (!this.params.groupByGroup) {
              locationDataset.get(key).group.add(location.group);
            }
            if (!this.params.groupByModule) {
              locationDataset.get(key).name.add(name);
            }
          }
        }
      });
    });

    this.locationSource.next(locationDataset);
    this.dataSource.next(dataset);
  }

  analyze(linkerMap: LinkerMap) {
    this.linkerMap = linkerMap;

    const usedResources = linkerMap.usedResources.memory as ResourceStats[];
    usedResources.forEach((resource) => {
      resource.chipData = 0;
      resource.chipFree = resource.total - resource.reserved;
    });

    // calc actual sizes
    const sectionLocationMapping = new Map<string, LocateRecord>();
    linkerMap.locateResult.forEach((locationRecord) => {
      sectionLocationMapping.set(locationRecord.section, locationRecord);
    });
    linkerMap.linkResult.forEach((record) => {
      record.sections.forEach((section) => {
        const location = sectionLocationMapping.get(section.out.section);
        if (location) {
          const key = location.chip;
          const resource = usedResources.find((e) => e.name === key);
          resource.chipData += this.calcActualSize(location);
        }
      });
    });

    // calculate chip free data size
    usedResources.forEach((resource) => {
      resource.chipFree = resource.total  - resource.reserved - resource.chipData;
    });

    this.usedResourcesSource.next(usedResources);

    this.prepareDataset(linkerMap);
  }
}
