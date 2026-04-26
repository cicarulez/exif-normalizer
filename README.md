# exif-normalizer

Small Node.js CLI for fixing missing photo dates in EXIF metadata.

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
- `--compat-tags`: also write `OffsetTime`, `OffsetTimeOriginal`, and `OffsetTimeDigitized`.
- `--clean-xp`: remove Windows `XP*` text fields, useful when `XPComment` is corrupted.
- `--rename-v2`: rename written files by adding `_V2` before the extension.
- `--metadata`: print full metadata before processing, and after processing when used with `--write`.
- `--no-recursive`: scan only the input directory.
- `--extensions jpg,jpeg,tif,tiff,heic`: file extensions to include.
- `--json`: print a JSON report instead of human-readable lines.
- `--verbose`: print every file, including skipped files. By default, skipped files only update the progress line.
- `--resume <id|latest>`: process candidates saved by a previous dry-run without scanning the whole input again.
- `--list-sessions`: list saved dry-run sessions.
- `--no-session`: do not save a dry-run session.

## Sessions

Every normal dry-run stores a local session in `.exif-normalizer/sessions.json` with only actionable files (`write` and `rewrite`). To apply the latest dry-run without rescanning all images:

```bash
npm start -- --resume latest --write
```

## Date resolution

For each image, the CLI:

1. Keeps `DateTimeOriginal` if it already exists and looks valid.
2. Tries to parse a date from the filename.
3. Falls back to the file modification time.

When writing, it updates `DateTimeOriginal`, `CreateDate`, and `ModifyDate`.
