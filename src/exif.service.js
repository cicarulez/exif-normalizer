import { exiftool } from 'exiftool-vendored';

export async function readMetadata(filePath) {
  return exiftool.read(filePath);
}

export async function writeDateMetadata(filePath, exifDate, options = {}) {
  const tags = options.mediaType === 'video' ? buildVideoTags(exifDate, options) : buildImageTags(exifDate, options);

  if (options.fileTime) {
    tags.FileModifyDate = exifDate;
  }

  return exiftool.write(
    filePath,
    tags,
    ['-overwrite_original']
  );
}

function buildImageTags(exifDate, options) {
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

  return tags;
}

function buildVideoTags(exifDate, options) {
  const creationDate = options.offset ? `${exifDate}${options.offset}` : exifDate;

  return {
    'QuickTime:CreateDate': exifDate,
    'QuickTime:ModifyDate': exifDate,
    'TrackCreateDate': exifDate,
    'TrackModifyDate': exifDate,
    'MediaCreateDate': exifDate,
    'MediaModifyDate': exifDate,
    'Keys:CreationDate': creationDate
  };
}

export async function closeExifTool() {
  await exiftool.end();
}
