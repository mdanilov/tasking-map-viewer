import * as fs from 'fs';
import * as readline from 'readline';

import * as lm from '../common/interfaces/linkermap';

enum FilePart {
  ProcessedFilePaths,
  LinkPart,
  UnknownPart
}

const FilePartKeywords = new Map();
FilePartKeywords.set(FilePart.ProcessedFilePaths, /^[\*]* Processed Files Part [\*]*$/);
FilePartKeywords.set(FilePart.LinkPart, /^[\*]* Link Part [\*]*$/);
FilePartKeywords.set(FilePart.UnknownPart, /^[\*]* .* [\*]*$/);

export async function parseMapFile(path: string): Promise<lm.LinkerMap> {
  return new Promise<lm.LinkerMap>((resolve, reject) => {
    const linkerMap: lm.LinkerMap = { processedFiles: [] };
    let linesCount = 0;
    let filePart: FilePart | undefined = null;

    const readInterface = readline.createInterface({
      input: fs.createReadStream(path),
      output: process.stdout
    });

    readInterface.on('line', (line: string) => {
      linesCount++;

      for (const [key, value] of FilePartKeywords) {
        if (value.test(line)) {
          filePart = key;
          break;
        }
      }

      if (filePart === FilePart.ProcessedFilePaths) {
        const found = line.match(/^\|\s*(\S*)\s*\|\s*(\S*)\s*\|\s*(\S*)\s*\|$/);
        if (found && found[1] !== 'File') {
          const file: lm.File = { name: found[1] };
          if (found.length > 2) {
            file.archiveName = found[2];
          }
          if (found.length > 3) {
            file.extractSymbol = found[3];
          }
          linkerMap.processedFiles.push(file);
        }
      }
    });

    readInterface.on('close', () => {
      resolve(linkerMap);
    });
  });
}
