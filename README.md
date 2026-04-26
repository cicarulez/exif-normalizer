# exif-normalizer

Small Node.js CLI for fixing wrong or missing capture dates in photo and video metadata.

It supports JPEG/TIFF/HEIC images through EXIF tags and MP4/MOV/3GP videos through QuickTime/MP4 date tags.

The default mode is safe: it scans files and prints the changes it would make. Use `--write` only when the output looks correct.

## Install

```bash
npm install
```

## Usage

```bash
npm start -- --input ./photos
npm start -- --input ./photos --write
npm start -- --input "/mnt/c/Documents and Settings/cappa/OneDrive/Immagini/Samsung Gallery"
npm start -- --input ./photos/IMG_20230715_143011.jpg
npm start -- --input ./photos/IMG_20230715_143011.jpg --force --file-time --write
npm start -- --input ./photos/IMG_20230715_143011.jpg --force --compat-tags --clean-xp --file-time --write
npm start -- --input ./photos/IMG_20230715_143011.jpg --force --compat-tags --clean-xp --file-time --rename-v2 --write
npm start -- --input ./photos --compat-tags --clean-xp --file-time --rename-v2
npm start -- --input ./videos --extensions mp4 --prefer-filename --compat-tags --file-time --rename-v2
npm start -- --resume latest --write
npm start -- --list-sessions
npm start -- --input ./photos/IMG_20230715_143011.jpg --metadata
npm start -- --input ./photos/IMG_20230715_143011.jpg --force --file-time --write --metadata
```

Options:

- `--input <path>`: directory to scan or single file to process.
- `--mode fix-dates`: currently the only supported mode.
- `--write`: actually update files. Without this flag the command runs as a dry run.
- `--force`: rewrite date tags even when `DateTimeOriginal` already exists.
- `--file-time`: also set the filesystem modification time.
- `--compat-tags`: also write compatibility date tags. For images this adds `OffsetTime*`; for videos this adds `CreationDate`.
- `--clean-xp`: remove Windows `XP*` text fields, useful when `XPComment` is corrupted.
- `--rename-v2`: rename written files by adding `_V2` before the extension.
- `--metadata`: print full metadata before processing, and after processing when used with `--write`.
- `--no-recursive`: scan only the input directory.
- `--extensions jpg,jpeg,tif,tiff,heic,mp4,mov,3gp,3g2`: file extensions to include.
- `--json`: print a JSON report instead of human-readable lines.
- `--verbose`: print every file, including skipped files. By default, skipped files only update the progress line.
- `--prefer-filename`: use the date parsed from the filename even when metadata already contains a date. Useful for videos incorrectly dated as today.
- `--resume <id|latest>`: process candidates saved by a previous dry-run without scanning the whole input again.
- `--list-sessions`: list saved dry-run sessions.
- `--no-session`: do not save a dry-run session.

## Sessions

Every normal dry-run stores a local session in `.exif-normalizer/sessions.json` with only actionable files (`write` and `rewrite`). To apply the latest dry-run without rescanning all media files:

```bash
npm start -- --resume latest --write
```

## Date resolution

For each photo or video, the CLI:

1. Keeps existing metadata dates if they already exist and look valid.
2. Tries to parse a date from the filename.
3. Falls back to the file modification time.

With `--prefer-filename`, step 2 wins over existing metadata. This is useful when videos have been imported with today's date but the filename still contains the real capture date.

When writing images, it updates `DateTimeOriginal`, `CreateDate`, and `ModifyDate`.
For videos, it writes QuickTime/MP4 date tags such as `CreateDate`, `TrackCreateDate`, `MediaCreateDate`, and `CreationDate`.
