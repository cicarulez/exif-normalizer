import { exiftool } from 'exiftool-vendored';

export async function readMetadata(filePath) {
  return exiftool.read(filePath);
}

export async function writeDateMetadata(filePath, exifDate, options = {}) {
  const tags = {
    DateTimeOriginal: exifDate,
    CreateDate: exifDate,
    ModifyDate: exifDate
  };

  if (options.offset) {
    tags.OffsetTime = options.offset;
    tags.OffsetTimeOriginal = options.offset;
    tags.OffsetTimeDigitized = options.offset;
  }

  if (options.cleanXp) {
    tags.XPTitle = null;
    tags.XPComment = null;
    tags.XPAuthor = null;
    tags.XPKeywords = null;
    tags.XPSubject = null;
  }

  if (options.fileTime) {
    tags.FileModifyDate = exifDate;
  }

  return exiftool.write(
    filePath,
    tags,
    ['-overwrite_original']
  );
}

export async function closeExifTool() {
  await exiftool.end();
}
