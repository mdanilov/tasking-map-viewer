export interface File {
  name: string;
  archiveName?: string;
  extractSymbol?: string;
}

export enum SectionType {
  Bss,
  Data,
  Text,
  Other
}

export interface Section {
  type: SectionType;
  in: {
    section: string;
    size: number;
  };
  out: {
    offset: number;
    section: string;
    size: number;
  };
}
export interface LinkRecord {
  fileName: string;
  sections: Section[];
}

export interface LinkerMap {
  processedFiles: File[];
  linkResult: LinkRecord[];
}
