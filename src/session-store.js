import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DB_DIR = '.exif-normalizer';
const DB_FILE = 'sessions.json';
const ACTIONABLE_ACTIONS = new Set(['write', 'rewrite']);

export async function saveSession({ inputPath, displayRoot, filesCount, options, results }) {
  const db = await readDatabase();
  const id = createSessionId();
  const actionable = results.filter((result) => ACTIONABLE_ACTIONS.has(result.action));
  const now = new Date().toISOString();

  const session = {
    id,
    createdAt: now,
    updatedAt: now,
    inputPath,
    displayRoot,
    filesCount,
    candidateCount: actionable.length,
    options: serializeOptions(options),
    candidates: actionable.map((result) => ({
      file: result.file,
      action: result.action,
      mediaType: result.mediaType,
      source: result.source,
      replacedSource: result.replacedSource ?? null,
      exifDate: result.exifDate,
      exifOffset: result.exifOffset,
      issues: result.issues ?? [],
      renameTo: result.renameTo ?? null
    }))
  };

  db.sessions.push(session);
  db.latestSessionId = id;
  await writeDatabase(db);

  return session;
}

export async function loadSession(idOrLatest = 'latest') {
  const db = await readDatabase();
  const id = idOrLatest === 'latest' ? db.latestSessionId : idOrLatest;
  const session = db.sessions.find((item) => item.id === id);

  if (!session) {
    throw new Error(`Session not found: ${idOrLatest}`);
  }

  return session;
}

export async function listSessions() {
  const db = await readDatabase();
  return db.sessions;
}

function serializeOptions(options) {
  return {
    mode: options.mode,
    recursive: options.recursive,
    extensions: options.extensions,
    force: options.force,
    fileTime: options.fileTime,
    compatTags: options.compatTags,
    cleanXp: options.cleanXp,
    renameV2: options.renameV2,
    preferFilename: options.preferFilename
  };
}

async function readDatabase() {
  const dbPath = getDatabasePath();

  try {
    const raw = await readFile(dbPath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      latestSessionId: parsed.latestSessionId ?? null,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        latestSessionId: null,
        sessions: []
      };
    }

    throw error;
  }
}

async function writeDatabase(db) {
  const dbPath = getDatabasePath();
  await mkdir(path.dirname(dbPath), { recursive: true });
  await writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`);
}

function getDatabasePath() {
  return path.join(process.cwd(), DB_DIR, DB_FILE);
}

function createSessionId() {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z');
  return `${timestamp}-${randomUUID().slice(0, 8)}`;
}
