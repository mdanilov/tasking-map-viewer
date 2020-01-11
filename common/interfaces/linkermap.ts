export interface File {
  name: string;
  archiveName?: string;
  extractSymbol?: string;
}

export interface LinkerMap {
  processedFiles: File[];
}
