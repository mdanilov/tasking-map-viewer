import { Component, OnInit } from '@angular/core';
import { FileService } from './file.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'map-viewer';
  files: string[];

  constructor(private fileService: FileService) {}

  ngOnInit() {
    this.getFiles();
  }

  getFiles() {
    this.fileService.getFiles().then(files => this.files = files);
  }
}
