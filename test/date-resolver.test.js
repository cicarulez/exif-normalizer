import assert from 'node:assert/strict';
import test from 'node:test';
import { extractDateFromFilename, formatExifDate, resolveDate } from '../src/date-resolver.js';

test('extracts compact date and time from common camera filenames', () => {
  const date = extractDateFromFilename('IMG_20230715_143011.jpg');

  assert.equal(formatExifDate(date), '2023:07:15 14:30:11');
});

test('extracts compact date and time from Pixel filenames with milliseconds', () => {
  const date = extractDateFromFilename('PXL_20230715_143011123.jpg');

  assert.equal(formatExifDate(date), '2023:07:15 14:30:11');
});

test('extracts separated date and time with missing seconds', () => {
  const date = extractDateFromFilename('holiday_2023-07-15 14.30.jpeg');

  assert.equal(formatExifDate(date), '2023:07:15 14:30:00');
});

test('uses midday for date-only filenames', () => {
  const date = extractDateFromFilename('VID-20230715-WA0001.jpg');

  assert.equal(formatExifDate(date), '2023:07:15 12:00:00');
});

test('rejects invalid filename dates', () => {
  assert.equal(extractDateFromFilename('IMG_20230231_143011.jpg'), null);
});

test('keeps existing usable EXIF dates', () => {
  const mtime = new Date(2024, 0, 1, 8, 0, 0);
  const result = resolveDate({ DateTimeOriginal: '2023:07:15 14:30:11' }, { mtime }, 'IMG_20240101.jpg');

  assert.equal(result.source, 'DateTimeOriginal');
  assert.equal(result.shouldWrite, false);
  assert.equal(formatExifDate(result.date), '2023:07:15 14:30:11');
});

test('keeps existing usable video create dates', () => {
  const mtime = new Date(2024, 0, 1, 8, 0, 0);
  const result = resolveDate({ CreateDate: '2023:07:15 14:30:11' }, { mtime }, 'VID_20240101_080000.mp4');

  assert.equal(result.source, 'CreateDate');
  assert.equal(result.shouldWrite, false);
  assert.equal(formatExifDate(result.date), '2023:07:15 14:30:11');
});

test('can prefer filename date over existing metadata', () => {
  const mtime = new Date(2024, 0, 1, 8, 0, 0);
  const result = resolveDate(
    { CreateDate: '2026:04:26 10:00:00' },
    { mtime },
    'VID_20191225_171247.mp4',
    { preferFilename: true }
  );

  assert.equal(result.source, 'filename');
  assert.equal(result.replacedSource, 'CreateDate');
  assert.equal(result.shouldWrite, true);
  assert.equal(formatExifDate(result.date), '2019:12:25 17:12:47');
});

test('falls back to mtime when EXIF and filename are unusable', () => {
  const mtime = new Date(2024, 0, 1, 8, 0, 0);
  const result = resolveDate({ DateTimeOriginal: '1970:01:01 00:00:00' }, { mtime }, 'photo.jpg');

  assert.equal(result.source, 'mtime');
  assert.equal(result.shouldWrite, true);
  assert.equal(formatExifDate(result.date), '2024:01:01 08:00:00');
});
