import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

import { Memory, LinkerMap, LocateRecord } from '../../common/interfaces/linkermap';

export interface ResourceStats extends Memory {
  chipData: number;
  chipFree: number;
}

@Injectable({
  providedIn: 'root'
})
export class StatsService {

  private usedResourcesSource = new Subject<ResourceStats[]>();

  resourceStats = this.usedResourcesSource.asObservable();

  calcActualSize(location: LocateRecord): number {
    let size = location.size;
    if (location.size < location.alignment) {
      size = location.alignment;
    } else if ((location.size % location.alignment) !== 0) {
      size = location.size + (location.alignment - location.size % location.alignment);
    }
    return size;
  }

  analyze(map: LinkerMap) {
    const usedResources = map.usedResources.memory as ResourceStats[];
    usedResources.forEach((resource) => {
      resource.chipData = 0;
      resource.chipFree = resource.total - resource.reserved;
    });

    // calc actual sizes
    const sectionLocationMapping = new Map<string, LocateRecord>();
    map.locateResult.forEach((locationRecord) => {
      sectionLocationMapping.set(locationRecord.section, locationRecord);
    });
    map.linkResult.forEach((record) => {
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
  }
}
