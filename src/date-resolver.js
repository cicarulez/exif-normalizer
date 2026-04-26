const INVALID_YEARS = new Set([0, 1, 1900, 1970]);

export function resolveDate(meta, fileStats, fileName) {
  const existing = normalizeExistingExifDate(meta?.DateTimeOriginal);
  if (existing) {
    return {
      date: existing,
      source: 'exif',
      shouldWrite: false
    };
  }

  const fromName = extractDateFromFilename(fileName);
  if (fromName) {
    return {
      date: fromName,
      source: 'filename',
      shouldWrite: true
    };
  }

  return {
    date: fileStats.mtime,
    source: 'mtime',
    shouldWrite: true
  };
}

export function extractDateFromFilename(fileName) {
  const baseName = fileName.replace(/\.[^.]+$/, '');

  const compactDateTime = baseName.match(
    /(?:^|[^0-9])((?:19|20)\d{2})([01]\d)([0-3]\d)[^0-9]?([0-2]\d)([0-5]\d)([0-5]\d)(?:\d{3})?(?:[^0-9]|$)/
  );
  if (compactDateTime) {
    return buildLocalDate(
      compactDateTime[1],
      compactDateTime[2],
      compactDateTime[3],
      compactDateTime[4],
      compactDateTime[5],
      compactDateTime[6]
    );
  }

  const separatedDateTime = baseName.match(
    /(?:^|[^0-9])((?:19|20)\d{2})[-_. ]([01]\d)[-_. ]([0-3]\d)(?:[-_. T])([0-2]\d)[-_.:]([0-5]\d)(?:[-_.:]([0-5]\d))?(?:[^0-9]|$)/
  );
  if (separatedDateTime) {
    return buildLocalDate(
      separatedDateTime[1],
      separatedDateTime[2],
      separatedDateTime[3],
      separatedDateTime[4],
      separatedDateTime[5],
      separatedDateTime[6] ?? '00'
    );
  }

  const compactDate = baseName.match(/(?:^|[^0-9])((?:19|20)\d{2})([01]\d)([0-3]\d)(?:[^0-9]|$)/);
  if (compactDate) {
    return buildLocalDate(compactDate[1], compactDate[2], compactDate[3], '12', '00', '00');
  }

  const separatedDate = baseName.match(/(?:^|[^0-9])((?:19|20)\d{2})[-_. ]([01]\d)[-_. ]([0-3]\d)(?:[^0-9]|$)/);
  if (separatedDate) {
    return buildLocalDate(separatedDate[1], separatedDate[2], separatedDate[3], '12', '00', '00');
  }

  return null;
}

export function formatExifDate(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join(':') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatExifOffset(date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);

  return `${sign}${pad(Math.trunc(absMinutes / 60))}:${pad(absMinutes % 60)}`;
}

function normalizeExistingExifDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && isUsableDate(value)) {
    return value;
  }

  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const date = value.toDate();
    return isUsableDate(date) ? date : null;
  }

  if (typeof value === 'object' && typeof value.year === 'number') {
    const date = buildLocalDate(
      value.year,
      value.month ?? 1,
      value.day ?? 1,
      value.hour ?? 12,
      value.minute ?? 0,
      value.second ?? 0
    );
    return date && isUsableDate(date) ? date : null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
    const date = new Date(normalized);
    return isUsableDate(date) ? date : null;
  }

  return null;
}

function buildLocalDate(year, month, day, hour, minute, second) {
  const parts = [year, month, day, hour, minute, second].map(Number);
  if (parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const [yyyy, mm, dd, hh, min, ss] = parts;
  const date = new Date(yyyy, mm - 1, dd, hh, min, ss);
  if (
    date.getFullYear() !== yyyy ||
    date.getMonth() !== mm - 1 ||
    date.getDate() !== dd ||
    date.getHours() !== hh ||
    date.getMinutes() !== min ||
    date.getSeconds() !== ss
  ) {
    return null;
  }

  return isUsableDate(date) ? date : null;
}

function isUsableDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime()) && !INVALID_YEARS.has(date.getFullYear());
}

function pad(value) {
  return String(value).padStart(2, '0');
}
