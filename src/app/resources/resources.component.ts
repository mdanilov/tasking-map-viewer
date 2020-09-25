import { Component, OnInit } from '@angular/core';

import { StatsService, ResourceStats } from './../stats.service';

@Component({
  selector: 'app-resources',
  templateUrl: './resources.component.html',
  styleUrls: ['./resources.component.css']
})
export class ResourcesComponent implements OnInit {

  displayedColumns = ['name', 'data', 'free', 'chipData', 'chipFree', 'total'];
  usedResources: ResourceStats[];

  getColor(value: number): string {
    // value from 0 to 1
    const hue = ((1 - value) * 120).toString(10);
    return ['hsl(', hue, ',50%,50%)'].join('');
  }

  getElementColor(stat: ResourceStats): string {
    return this.getColor(stat.chipData / stat.total);
  }

  constructor(private statsService: StatsService) {
    statsService.resourceStats.subscribe(
      resources => {
        this.usedResources = resources;
      });
  }

  ngOnInit(): void {
  }

}
