# Scripts

Utility scripts for maintaining the Pi-hole blocklists.

## Available Scripts

### deduplicate.py

Deduplicates entries within each blocklist file.

**Usage:**

```bash
python3 Scripts/deduplicate.py
```

**Features:**

- Removes duplicate entries within each file
- Removes empty lines and whitespace-only lines
- Sorts entries alphabetically
- Preserves LF line endings

### deduplicate_across_files.py

Checks for and reports duplicate entries across different blocklist files.

**Usage:**

```bash
python3 Scripts/deduplicate_across_files.py
```

**Features:**

- Scans all `.txt` files in the `lists/` directory
- Reports entries that appear in multiple files
- Groups duplicates by file combinations
- Does not automatically remove cross-file duplicates (by design, as entries may intentionally appear in multiple
  categories)

### Minify.sh

Legacy bash script for compiling and minifying blocklists using hostlist-compiler.

**Usage:**

```bash
bash Scripts/Minify.sh
```

**Features:**

- Syncs with git repository
- Compiles blocklists using @adguard/hostlist-compiler
- Removes whitespace, comments, and duplicates
- Automatically commits and pushes changes

## Requirements

- Python 3.6+
- Node.js (for npm scripts)
- Bash (for Minify.sh)
- Optional: @adguard/hostlist-compiler (for Minify.sh)
