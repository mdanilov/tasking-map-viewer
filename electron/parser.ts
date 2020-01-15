import * as fs from 'fs';
import * as readline from 'readline';

import * as lm from '../common/interfaces/linkermap';

enum FilePart {
  ProcessedFilePaths,
  LinkPart,
  UnknownPart
}

const FilePartKeywords = new Map();
FilePartKeywords.set(FilePart.ProcessedFilePaths, /^[\*]+\s*Processed Files\s*[\*]+$/);
FilePartKeywords.set(FilePart.LinkPart, /^[\*]+\s*Link Result\s*[\*]+$/);
FilePartKeywords.set(FilePart.UnknownPart, /^[\*]* .* [\*]*$/);

function getSectionType(section: string): lm.SectionType {
  if (section.startsWith('.bss')) {
    return lm.SectionType.Bss;
  } else if (section.startsWith('.data')) {
    return lm.SectionType.Data;
  } else if (section.startsWith('.text')) {
    return lm.SectionType.Text;
  } else {
    return lm.SectionType.Other;
  }
}

export async function parseMapFile(path: string): Promise<lm.LinkerMap> {
  return new Promise<lm.LinkerMap>((resolve, reject) => {
    const linkerMap: lm.LinkerMap = {
      processedFiles: [],
      linkResult: []
    };
    let linesCount = 0;
    let filePart: FilePart | undefined = null;
    let previous: object = null; // temporary object to handle multiline cases
    const linkResult = new Map<string, lm.LinkRecord>();

    const readInterface = readline.createInterface({
      input: fs.createReadStream(path),
    });

    readInterface.on('line', (line: string) => {
      linesCount++;

      if (line.startsWith('*')) {
        for (const [key, value] of FilePartKeywords) {
          if (value.test(line)) {
            filePart = key;
            previous = null;
            break;
          }
        }
      }

      // parse Processed Files Part
      if (filePart === FilePart.ProcessedFilePaths) {
        const found = line.match(/^\|\s+(\S.*\S|)\s+\|\s+(\S.*\S|)\s+\|\s+(\S.*\S|)\s+\|$/);
        // skip table header started with 'File' column
        if (found && found[1] !== 'File') {
          const file: lm.File = { name: found[1] };
          if (found.length > 2) {
            file.archiveName = found[2];
            file.extractSymbol = found[3];
          }

          // handle multiline case
          if (found[1].length === 0) {
            const previousFile = previous as lm.File;
            if (previousFile.archiveName && file.archiveName) { previousFile.archiveName += file.archiveName; }
            if (previousFile.extractSymbol && file.extractSymbol) { previousFile.extractSymbol += file.extractSymbol; }
          } else {
            previous = file;
            linkerMap.processedFiles.push(file);
          }
        }
      // parse Linker Result Part
      } else if (filePart === FilePart.LinkPart) {
        // check for records delimiter
        const delimeterRegEx = /^\|-+\|$/;
        if (delimeterRegEx.test(line)) {
          previous = null;
        }

        const regex = new RegExp(''
          + /^\|\s+(\S.*\S|)\s+/.source     // [in] File
          + /\|\s+(\S.*\S|)\s+/.source      // [in] Section
          + /\|\s+(\S.*\S|)\s+/.source      // [in] Size (MAU)
          + /\|\s+(\S.*\S|)\s+/.source      // [out] Offset
          + /\|\s+(\S.*\S|)\s+/.source      // [out] Section
          + /\|\s+(\S.*\S|)\s+\|$/.source   // [out] Size (MAU)
        );
        const found = line.match(regex);
        // skip table header started with '[in] File' column
        if (found && found[1] !== '[in] File') {
          // handle multiline case
          if (previous && found[1].length === 0) {
            const previousRecord = previous as lm.LinkRecord;
            // concat string fields in 'previous' record
            previousRecord.sections[previousRecord.sections.length - 1].in.section += found[2];
            previousRecord.sections[previousRecord.sections.length - 1].out.section += found[5];
          } else {
            const filename = found[1];

            // add new file to the map if not yet exist
            if (!linkResult.has(filename)) {
              linkResult.set(filename, { fileName: filename, sections: []});
            }

            // save ref to the 'previous' var for multiline case
            const record = linkResult.get(filename);
            previous = record;

            // add new section to file record
            record.sections.push({
              type: getSectionType(found[2]),
              in: { section: found[2], size: parseInt(found[3], 16) },
              out: { offset: parseInt(found[4], 16), section: found[5], size: parseInt(found[6], 16) }
            });
          }
        }
      }
    });

    readInterface.on('close', () => {
      linkResult.forEach((value) => {
        linkerMap.linkResult.push(value);
      });

      resolve(linkerMap);
    });
  });
}
