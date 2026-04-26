import { opendir, stat } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_EXTENSIONS = new Set(['.jpg', '.jpeg', '.tif', '.tiff', '.heic', '.mp4', '.mov', '.3gp', '.3g2']);

export async function scanImages(inputPath, options = {}) {
  const recursive = options.recursive ?? true;
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const files = [];
  const inputStats = await stat(inputPath);

  if (inputStats.isFile()) {
    return extensions.has(path.extname(inputPath).toLowerCase()) ? [inputPath] : [];
  }

  if (!inputStats.isDirectory()) {
    return [];
  }

  await scanDirectory(inputPath, { recursive, extensions, files });

  files.sort((a, b) => a.localeCompare(b));
  return files;
}

export function parseExtensions(value) {
  if (!value) {
    return DEFAULT_EXTENSIONS;
  }

  return new Set(
    value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .map((item) => (item.startsWith('.') ? item : `.${item}`))
  );
}

async function scanDirectory(dirPath, options) {
  const dir = await opendir(dirPath);

  for await (const entry of dir) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (options.recursive) {
        await scanDirectory(fullPath, options);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (options.extensions.has(path.extname(entry.name).toLowerCase())) {
      options.files.push(fullPath);
    }
  }
}
