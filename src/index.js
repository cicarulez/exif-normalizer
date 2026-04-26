#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { scanImages, parseExtensions } from './scanner.js';
import { fixFileDates } from './writer.js';
import { closeExifTool } from './exif.service.js';
import { listSessions, loadSession, saveSession } from './session-store.js';

async function main() {
  let options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (options.listSessions) {
    await printSessions();
    return;
  }

  let session = null;
  if (options.resume) {
    session = await loadSession(options.resume);
    options = mergeResumeOptions(options, session.options);
  }

  if (!options.input && !session) {
    throw new Error('Missing required option: --input <path>');
  }

  if (options.mode !== 'fix-dates') {
    throw new Error(`Unsupported mode: ${options.mode}`);
  }

  const inputPath = session ? session.inputPath : path.resolve(options.input);
  const files = session
    ? session.candidates.map((candidate) => candidate.file)
    : await scanImages(inputPath, {
      recursive: options.recursive,
      extensions: parseExtensions(options.extensions)
    });
  const displayRoot = session?.displayRoot ?? (files.length === 1 && files[0] === inputPath ? path.dirname(inputPath) : inputPath);

  const results = [];
  if (!options.json) {
    printReportHeader(inputPath, files.length, options, session);
  }

  for (const [index, file] of files.entries()) {
    try {
      const result = await fixFileDates(file, {
        write: options.write,
        force: options.force,
        fileTime: options.fileTime,
        compatTags: options.compatTags,
        cleanXp: options.cleanXp,
        renameV2: options.renameV2,
        metadata: options.metadata
      });
      results.push(result);
      if (!options.json) {
        printResult(displayRoot, result, index + 1, files.length, options);
      }
    } catch (error) {
      const result = {
        file,
        action: 'error',
        error: error.message
      };
      results.push(result);
      if (!options.json) {
        printResult(displayRoot, result, index + 1, files.length, options);
      }
    }
  }

  if (!options.json && options.compact && files.length > 0) {
    process.stdout.write('\n');
  }

  if (options.json) {
    console.log(JSON.stringify({ input: inputPath, dryRun: !options.write, results }, null, 2));
    return;
  }

  if (!options.write && !options.resume && !options.noSession) {
    const savedSession = await saveSession({
      inputPath,
      displayRoot,
      filesCount: files.length,
      options,
      results
    });
    console.log(`Session: ${savedSession.id} (${savedSession.candidateCount} candidates saved)`);
  }
}

function parseArgs(args) {
  const options = {
    mode: 'fix-dates',
    recursive: true,
    write: false,
    json: false,
    compact: true,
    force: false,
    fileTime: false,
    compatTags: false,
    cleanXp: false,
    renameV2: false,
    metadata: false,
    resume: null,
    listSessions: false,
    noSession: false,
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--write') {
      options.write = true;
      continue;
    }

    if (arg === '--force') {
      options.force = true;
      continue;
    }

    if (arg === '--file-time') {
      options.fileTime = true;
      continue;
    }

    if (arg === '--compat-tags') {
      options.compatTags = true;
      continue;
    }

    if (arg === '--clean-xp') {
      options.cleanXp = true;
      continue;
    }

    if (arg === '--rename-v2') {
      options.renameV2 = true;
      continue;
    }

    if (arg === '--metadata') {
      options.metadata = true;
      options.compact = false;
      continue;
    }

    if (arg === '--resume') {
      options.resume = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--list-sessions') {
      options.listSessions = true;
      continue;
    }

    if (arg === '--no-session') {
      options.noSession = true;
      continue;
    }

    if (arg === '--dry-run') {
      options.write = false;
      continue;
    }

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg === '--verbose') {
      options.compact = false;
      continue;
    }

    if (arg === '--no-recursive') {
      options.recursive = false;
      continue;
    }

    if (arg === '--input' || arg === '-i') {
      const pathValue = readPathValue(args, index, arg);
      options.input = pathValue.value;
      index = pathValue.nextIndex;
      continue;
    }

    if (arg === '--mode') {
      options.mode = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--extensions') {
      options.extensions = readValue(args, index, arg);
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function mergeResumeOptions(options, sessionOptions) {
  return {
    ...options,
    mode: sessionOptions.mode ?? options.mode,
    recursive: sessionOptions.recursive ?? options.recursive,
    extensions: sessionOptions.extensions ?? options.extensions,
    force: options.force || Boolean(sessionOptions.force),
    fileTime: options.fileTime || Boolean(sessionOptions.fileTime),
    compatTags: options.compatTags || Boolean(sessionOptions.compatTags),
    cleanXp: options.cleanXp || Boolean(sessionOptions.cleanXp),
    renameV2: options.renameV2 || Boolean(sessionOptions.renameV2)
  };
}

function readValue(args, index, optionName) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${optionName}`);
  }
  return value;
}

function readPathValue(args, index, optionName) {
  const parts = [];
  let nextIndex = index + 1;

  while (nextIndex < args.length && !args[nextIndex].startsWith('--')) {
    parts.push(args[nextIndex]);
    nextIndex += 1;
  }

  if (parts.length === 0) {
    throw new Error(`Missing value for ${optionName}`);
  }

  return {
    value: parts.join(' '),
    nextIndex: nextIndex - 1
  };
}

function printReportHeader(inputPath, totalFiles, options, session) {
  const dryRunLabel = options.write ? 'WRITE' : 'DRY RUN';

  console.log(`Mode: ${options.mode}`);
  console.log(`Input: ${inputPath}`);
  if (session) {
    console.log(`Session: ${session.id}`);
  }
  console.log(`Run: ${dryRunLabel}`);
  console.log(`Files: ${totalFiles}`);
}

function printResult(inputDir, result, current, total, options) {
  const relative = path.relative(inputDir, result.file);
  const progress = `[${String(current).padStart(String(total).length, ' ')}/${total}]`;

  if (options.compact && result.action === 'skip') {
    process.stdout.write(`\r${progress} skip    ${result.exifDate} ${result.source.padEnd(8)} ${relative}`);
    return;
  }

  if (options.compact) {
    process.stdout.write('\r\x1b[K');
  }

  if (result.action === 'error') {
    console.log(`${progress} ${result.action.padEnd(7)} ${relative}: ${result.error}`);
    return;
  }

  const offset = result.exifOffset ? ` ${result.exifOffset}` : '';
  const issues = result.issues?.length ? ` ${result.issues.join(',')}` : '';
  const renameTo = result.renameTo ? ` -> ${path.relative(inputDir, result.renameTo)}` : '';
  console.log(`${progress} ${result.action.padEnd(7)} ${result.exifDate}${offset} ${result.source.padEnd(8)} ${relative}${issues}${renameTo}`);

  if (result.metadataBefore) {
    printMetadataBlock('metadata before', result.metadataBefore);
  }

  if (result.metadataAfter) {
    printMetadataBlock('metadata after', result.metadataAfter);
  }
}

function printMetadataBlock(label, metadata) {
  console.log(`--- ${label} ---`);
  console.log(JSON.stringify(metadata, null, 2));
}

async function printSessions() {
  const sessions = await listSessions();

  if (sessions.length === 0) {
    console.log('No sessions found.');
    return;
  }

  for (const session of sessions) {
    console.log(`${session.id} candidates=${session.candidateCount} files=${session.filesCount} created=${session.createdAt} input=${session.inputPath}`);
  }
}

function printHelp() {
  console.log(`Usage: exif-normalizer --input <path> [options]

Options:
  -i, --input <path>      Directory to scan or single file to process
      --mode fix-dates    Operation mode
      --write             Write metadata changes
      --force             Rewrite dates even when DateTimeOriginal exists
      --file-time         Also set the filesystem modification time
      --compat-tags       Also write OffsetTime EXIF tags for Windows/phones
      --clean-xp          Remove Windows XP* text tags
      --rename-v2         Rename written files by adding _V2 before extension
      --metadata          Print full metadata before, and after when writing
      --dry-run           Preview only, default
      --no-recursive      Scan only the input directory
      --extensions <list> Comma-separated extensions
      --json              Print JSON report
      --verbose           Print one line for every file, including skips
      --resume <id|latest> Process candidates saved from a previous dry-run
      --list-sessions     List saved dry-run sessions
      --no-session        Do not save a dry-run session
  -h, --help              Show this help
`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeExifTool();
  });
