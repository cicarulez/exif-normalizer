import path from 'node:path';
import { access, rename, stat } from 'node:fs/promises';
import { formatExifDate, formatExifOffset, resolveDate } from './date-resolver.js';
import { readMetadata, writeDateMetadata } from './exif.service.js';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.3gp', '.3g2']);

export async function fixFileDates(filePath, options = {}) {
  const fileStats = await stat(filePath);
  const meta = await readMetadata(filePath);
  const mediaType = getMediaType(filePath);
  const resolution = resolveDate(meta, fileStats, path.basename(filePath), {
    preferFilename: options.preferFilename
  });
  const exifDate = formatExifDate(resolution.date);
  const exifOffset = formatExifOffset(resolution.date);
  const compatibilityIssues = getCompatibilityIssues(meta, options, exifOffset, mediaType);

  const result = {
    file: filePath,
    mediaType,
    source: resolution.source,
    replacedSource: resolution.replacedSource,
    exifDate,
    exifOffset,
    issues: compatibilityIssues,
    action: getPlannedAction(resolution, options, compatibilityIssues)
  };

  if (options.renameV2 && result.action !== 'skip') {
    result.renameTo = buildV2Path(filePath);
  }

  if (options.metadata) {
    result.metadataBefore = serializeMetadata(meta);
  }

  if (!resolution.shouldWrite && !options.force && compatibilityIssues.length === 0) {
    return result;
  }

  if (options.write) {
    if (options.renameV2) {
      await ensureRenameTargetIsAvailable(filePath, result.renameTo);
    }

    await writeDateMetadata(filePath, exifDate, {
      fileTime: options.fileTime,
      offset: options.compatTags ? exifOffset : null,
      cleanXp: options.cleanXp,
      mediaType
    });

    let metadataPath = filePath;
    if (options.renameV2) {
      await rename(filePath, result.renameTo);
      metadataPath = result.renameTo;
    }

    result.action = resolution.shouldWrite ? 'written' : 'rewritten';

    if (options.metadata) {
      result.metadataAfter = serializeMetadata(await readMetadata(metadataPath));
    }
  }

  return result;
}

export function buildV2Path(filePath) {
  const parsed = path.parse(filePath);

  if (parsed.name.endsWith('_V2')) {
    return filePath;
  }

  return path.join(parsed.dir, `${parsed.name}_V2${parsed.ext}`);
}

async function ensureRenameTargetIsAvailable(filePath, targetPath) {
  if (filePath === targetPath) {
    return;
  }

  try {
    await access(targetPath);
  } catch {
    return;
  }

  throw new Error(`Rename target already exists: ${targetPath}`);
}

export function getCompatibilityIssues(meta, options = {}, expectedOffset = null, mediaType = 'image') {
  const issues = [];

  if (options.compatTags && expectedOffset && mediaType === 'image' && hasMissingOrDifferentOffsetTags(meta, expectedOffset)) {
    issues.push('missing-offset-tags');
  }

  if (options.compatTags && mediaType === 'video' && !meta?.CreationDate) {
    issues.push('missing-creationdate-tag');
  }

  if (options.cleanXp && hasWindowsXpTags(meta)) {
    issues.push('xp-tags-present');
  }

  return issues;
}

export function getMediaType(filePath) {
  return VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase()) ? 'video' : 'image';
}

function getPlannedAction(resolution, options, compatibilityIssues) {
  if (resolution.shouldWrite) {
    return 'write';
  }

  return options.force || compatibilityIssues.length > 0 ? 'rewrite' : 'skip';
}

function hasMissingOrDifferentOffsetTags(meta, expectedOffset) {
  return ['OffsetTime', 'OffsetTimeOriginal', 'OffsetTimeDigitized'].some((tag) => meta?.[tag] !== expectedOffset);
}

function hasWindowsXpTags(meta) {
  return ['XPTitle', 'XPComment', 'XPAuthor', 'XPKeywords', 'XPSubject'].some((tag) => {
    const value = meta?.[tag];
    return value !== undefined && value !== null && value !== '';
  });
}

function serializeMetadata(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeMetadata(item));
  }

  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype && prototype !== Object.prototype) {
      return String(value);
    }

    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, serializeMetadata(item)])
    );
  }

  return value;
}
