import * as fs from 'fs';
import * as readline from 'readline';

import * as lm from '../common/interfaces/linkermap';

enum FilePart {
  ProcessedFilePaths,
  LinkPart,
  LocateResults,
  UsedResources,
  UnknownPart
}

const FilePartKeywords = new Map();
FilePartKeywords.set(FilePart.ProcessedFilePaths, /^[\*]+\s*Processed Files\s*[\*]+$/);
FilePartKeywords.set(FilePart.LinkPart, /^[\*]+\s*Link Result\s*[\*]+$/);
FilePartKeywords.set(FilePart.LocateResults, /^[\*]+\s*Locate Result\s*[\*]+$/);
FilePartKeywords.set(FilePart.UsedResources, /^[\*]+\s*Used Resources\s*[\*]+$/);
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
      linkResult: [],
      locateResult: [],
      usedResources: { memory: [] }
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
      } else if (filePart === FilePart.UsedResources) {
        const regex = new RegExp(''
          + /^\|([^|]*)\|/.source   // Memory
          + /([^|]*)\|/.source      // Code
          + /([^|]*)\|/.source      // Data
          + /([^|]*)\|/.source      // Reserved
          + /([^|]*)\|/.source      // Free
          + /([^|]*)\|$/.source     // Total
        );
        const found = line.match(regex);
        if (found && found[1].trim() !== 'Memory' && found[1].trim() !== 'Total') {
          const record = {
            name: found[1].trim(),
            code: parseInt(found[2].trim(), 16),
            data: parseInt(found[3].trim(), 16),
            reserved: parseInt(found[4].trim(), 16),
            free: parseInt(found[5].trim(), 16),
            total: parseInt(found[6].trim(), 16)
          };
          linkerMap.usedResources.memory.push(record);
        }
      // parse Linker Result Part
      } else if (filePart === FilePart.LinkPart) {
        // check for records delimiter
        const delimeterRegEx = /^\|-+\|$/;
        if (delimeterRegEx.test(line)) {
          previous = null;
        } else {
          const regex = new RegExp(''
            + /^\|([^|]*)\|/.source   // [in] File
            + /([^|]*)\|/.source      // [in] Section
            + /([^|]*)\|/.source      // [in] Size (MAU)
            + /([^|]*)\|/.source      // [out] Offset
            + /([^|]*)\|/.source      // [out] Section
            + /([^|]*)\|$/.source     // [out] Size (MAU)
          );
          const found = line.match(regex);
          // skip table header started with '[in] File' column
          if (found && found[1].trim() !== '[in] File') {
            // handle multiline case
            if (previous && found[1].trim().length === 0) {
              const previousRecord = previous as lm.LinkRecord;
              // concat string fields in 'previous' record
              const inSection = found[2].trim();
              const outSection = found[5].trim();
              previousRecord.sections[previousRecord.sections.length - 1].in.section +=
                inSection.startsWith('(') ? ' ' + inSection : inSection;
              previousRecord.sections[previousRecord.sections.length - 1].out.section +=
                outSection.startsWith('(') ? ' ' + outSection : outSection;
            } else {
              const filename = found[1].trim();

              // add new file to the map if not yet exist
              if (!linkResult.has(filename)) {
                linkResult.set(filename, { fileName: filename, sections: [] });
              }

              // save ref to the 'previous' var for multiline case
              const record = linkResult.get(filename);
              previous = record;

              // add new section to file record
              record.sections.push({
                type: getSectionType(found[2].trim()),
                in: { section: found[2].trim(), size: parseInt(found[3].trim(), 16) },
                out: { offset: parseInt(found[4].trim(), 16), section: found[5].trim(), size: parseInt(found[6].trim(), 16) }
              });
            }
          }
        }
      } else if (filePart === FilePart.LocateResults) {
        // check for records delimiter
        const tableEntryDelimeterRegEx = /^\|-+\|$/;
        if (tableEntryDelimeterRegEx.test(line)) {
          previous = null;
        }

        const recordRegEx = new RegExp(''
          + /^\|([^|]*)\|/.source   // Chip
          + /([^|]*)\|/.source      // Group
          + /([^|]*)\|/.source      // Section
          + /([^|]*)\|/.source      // Size (MAU)
          + /([^|]*)\|/.source      // Space addr
          + /([^|]*)\|/.source      // Chip addr
          + /([^|]*)\|$/.source     // Alignment
        );
        const found = line.match(recordRegEx);
        // skip table header started with '[in] File' column
        if (found && found[1].trim() !== 'Chip') {
          // handle multiline case
          if (previous && found[1].trim().length === 0) {
            const previousRecord = previous as lm.LocateRecord;
            // concat string fields in 'previous' record
            const section = found[3].trim();
            previousRecord.section +=
              section.startsWith('(') ? ' ' + section : section;
          } else {
            const record = {
              chip: found[1].trim(),
              group: found[2].trim(),
              section: found[3].trim(),
              size: parseInt(found[4].trim(), 16),
              spaceAddr: parseInt(found[5].trim(), 16),
              chipAddr: parseInt(found[6].trim(), 16),
              alignment: parseInt(found[7].trim(), 16)
            };
            linkerMap.locateResult.push(record);
            // save ref to the 'previous' var for multiline case
            previous = record;
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
