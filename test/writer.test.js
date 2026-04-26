import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { buildV2Path, getCompatibilityIssues } from '../src/writer.js';

test('builds a V2 filename before the extension', () => {
  assert.equal(
    buildV2Path('/tmp/photos/IMG_20191225_171247.jpg'),
    path.join('/tmp/photos', 'IMG_20191225_171247_V2.jpg')
  );
});

test('does not append V2 twice', () => {
  assert.equal(
    buildV2Path('/tmp/photos/IMG_20191225_171247_V2.jpg'),
    '/tmp/photos/IMG_20191225_171247_V2.jpg'
  );
});

test('detects missing offset compatibility tags', () => {
  assert.deepEqual(
    getCompatibilityIssues({}, { compatTags: true }, '+01:00'),
    ['missing-offset-tags']
  );
});

test('does not flag matching offset compatibility tags', () => {
  assert.deepEqual(
    getCompatibilityIssues(
      {
        OffsetTime: '+01:00',
        OffsetTimeOriginal: '+01:00',
        OffsetTimeDigitized: '+01:00'
      },
      { compatTags: true },
      '+01:00'
    ),
    []
  );
});

test('detects Windows XP tags when cleanup is enabled', () => {
  assert.deepEqual(
    getCompatibilityIssues({ XPComment: 'corrupted text' }, { cleanXp: true }, '+01:00'),
    ['xp-tags-present']
  );
});
