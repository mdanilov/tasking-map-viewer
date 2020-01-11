export interface File {
  name: string;
  archiveName?: string;
  extactSymbol?: string;
}

export interface LinkerMap {
  processedFiles: File[];
}
