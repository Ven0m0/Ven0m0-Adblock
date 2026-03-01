#!/usr/bin/env python3
"""
Automated Blocklist Updater for Ven0m0-Adblock
Downloads and updates filter lists from remote URLs, validates checksums,
and maintains source tracking metadata.
"""

import argparse
import asyncio
import base64
import hashlib
import io
import json
import logging
import re
import sys
import tempfile
from pathlib import Path
from typing import Final
import aiohttp
import aiofiles

# Import common utilities
if str(Path(__file__).parent) not in sys.path:
    sys.path.append(str(Path(__file__).parent))

from common import sanitize_filename

# ============================================================================
# CONFIGURATION
# ============================================================================
SOURCES_CONFIG: Final[str] = "lists/sources-urls.json"
DEFAULT_OUTPUT: Final[str] = "lists/sources"
METADATA_FILE: Final[str] = "lists/sources-metadata.json"
TIMEOUT: Final[int] = 60
CHUNK_SIZE: Final[int] = 65536
MAX_CONCURRENT: Final[int] = 10

# ============================================================================
# LOGGING
# ============================================================================
logging.basicConfig(
  level=logging.INFO,
  format="[%(asctime)s] %(levelname)s %(message)s",
  datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ============================================================================
# CHECKSUM VALIDATION
# ============================================================================

def validate_checksum(content: str, name: str = "unknown") -> bool:
  """Validate Adblock Plus checksum header."""
  pattern = re.compile(
    r"^\s*!\s*checksum[\s\-:]+([\w\+\/=]+).*\n",
    re.MULTILINE | re.IGNORECASE,
  )
  match = pattern.search(content)

  if not match:
    logger.debug(f"No checksum in {name} (optional)")
    return True

  declared_checksum = match.group(1)
  data_no_checksum = pattern.sub("", content, 1)
  normalized = data_no_checksum.replace("\r", "").rstrip("\n") + "\n"
  computed_hash = hashlib.sha256(normalized.encode("utf-8")).digest()
  computed_checksum = base64.b64encode(computed_hash).decode().rstrip("=")

  if declared_checksum == computed_checksum:
    logger.info(f"✓ Checksum valid: {name}")
    return True

  logger.error(
    f"✗ Checksum mismatch in {name}: "
    f"expected {computed_checksum}, got {declared_checksum}"
  )
  return False

# ============================================================================
# FILE OPERATIONS
# ============================================================================

def count_rules(content: str) -> int:
  """Count active rules in the content."""
  return sum(
    1
    for line in io.StringIO(content)
    if (stripped := line.strip())
    and not stripped.startswith(("! ", "#", "["))
  )

async def process_downloaded_file(
  temp_path: Path,
  url: str,
  filename: str,
  output_dir: Path,
  skip_checksum: bool = False,
) -> Path | None:
  """Process and move temp file to final destination."""
  dest_path = output_dir / filename

  try:
    async with aiofiles.open(temp_path, mode="r", encoding="utf-8") as f:
      content = await f.read()

    if not skip_checksum:
      # Offload CPU-bound checksum validation to a thread
      is_valid = await asyncio.to_thread(validate_checksum, content, filename)
      if not is_valid:
        logger.warning(f"Checksum validation failed for {url}")
        # Do not delete temp_path here; the caller's finally block is responsible for cleanup.
        return None
    
    if len(content) < 100:
      logger.error(f"Downloaded file suspiciously small ({len(content)} bytes): {url}")
      return None
    
    # Offload CPU-bound rule counting to a thread
    rule_count = await asyncio.to_thread(count_rules, content)
    
    async with aiofiles.open(dest_path, mode="w", encoding="utf-8") as f:
      await f.write(content)

    logger.info(f"✓ {filename} ({rule_count} rules)")
    return dest_path

  except Exception as e:
    logger.exception(f"Error processing {url}: {e}")
    if temp_path.exists():
      temp_path.unlink()
    return None

# ============================================================================
# ASYNC DOWNLOAD
# ============================================================================

async def fetch_list(
  session: aiohttp.ClientSession,
  url: str,
  filename: str,
  output_dir: Path,
  skip_checksum: bool = False,
) -> tuple[str, bool]:
  """Download a single filter list."""
  try:
    headers = {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      "Accept": "text/plain,*/*",
    }
    
    async with session.get(url, timeout=TIMEOUT, headers=headers) as resp:
      resp.raise_for_status()

      tmp_path = None
      with tempfile.NamedTemporaryFile(
        mode="wb",
        delete=False,
        suffix=".txt",
      ) as tmp:
        tmp_path = Path(tmp.name)
        # Close immediately, re-open async below

      try:
        async with aiofiles.open(tmp_path, mode="wb") as f:
          async for chunk in resp.content.iter_chunked(CHUNK_SIZE):
            await f.write(chunk)

        # Only call process once with the correct filename
        result = await process_downloaded_file(tmp_path, url, filename, output_dir, skip_checksum)
        return (url, result is not None)
      finally:
        # Ensure cleanup always
        if tmp_path:
          try:
            await asyncio.to_thread(tmp_path.unlink)
          except FileNotFoundError:
            pass

  except asyncio.TimeoutError:
    logger.error(f"✗ Timeout: {url}")
  except aiohttp.ClientError as e:
    logger.error(f"✗ HTTP error for {url}: {e}")
  except Exception as e:
    logger.exception(f"✗ Unexpected error for {url}: {e}")

  return (url, False)

# ============================================================================
# SOURCE CONFIGURATION
# ============================================================================

def load_sources(config_path: Path) -> dict[str, dict]:
  """Load source URLs configuration."""
  if not config_path.exists():
    logger.warning(f"Config not found: {config_path}, creating template")
    template = {
      "sources": [
        {
          "url": "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt",
          "filename": "uBlock-Filters.txt",
          "skip_checksum": False,
          "enabled": True
        },
        {
          "url": "https://easylist.to/easylist/easylist.txt",
          "filename": "EasyList.txt",
          "skip_checksum": False,
          "enabled": True
        }
      ]
    }
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(template, indent=2) + "\n", encoding="utf-8")
    logger.info(f"Created template config: {config_path}")
  
  data = json.loads(config_path.read_text(encoding="utf-8"))
  return {
    src["url"]: {
      "filename": src.get("filename") or sanitize_filename(src["url"]),
      "skip_checksum": src.get("skip_checksum", False),
      "enabled": src.get("enabled", True),
    }
    for src in data.get("sources", [])
    if src.get("enabled", True)
  }

def save_metadata(sources: dict, results: dict[str, bool], output_dir: Path) -> None:
  """Save download metadata for tracking."""
  from datetime import datetime, timezone
  
  metadata = {
    "last_updated": datetime.now(timezone.utc).isoformat(),
    "sources": {
      url: {
        "filename": config["filename"],
        "success": results.get(url, False),
        "checksum_validated": not config["skip_checksum"],
      }
      for url, config in sources.items()
    }
  }

  metadata_path = Path(METADATA_FILE)
  metadata_path.write_text(
    json.dumps(metadata, indent=2, sort_keys=True) + "\n",
    encoding="utf-8",
  )
  logger.info(f"Saved metadata: {metadata_path}")

# ============================================================================
# MAIN PIPELINE
# ============================================================================

async def main() -> int:
  """Main execution flow."""
  parser = argparse.ArgumentParser(
    description="Update Ven0m0-Adblock filter lists from remote sources"
  )
  parser.add_argument(
    "--config",
    type=Path,
    default=SOURCES_CONFIG,
    help="Source URLs configuration file (JSON)",
  )
  parser.add_argument(
    "--output-dir",
    type=Path,
    default=DEFAULT_OUTPUT,
    help="Output directory for downloaded lists",
  )
  parser.add_argument(
    "--max-concurrent",
    type=int,
    default=MAX_CONCURRENT,
    help="Max concurrent downloads",
  )
  parser.add_argument(
    "--filter",
    help="Only update sources matching this substring",
  )
  parser.add_argument(
    "--validate",
    action="store_true",
    help="Run AGLint validation after downloads",
  )
  args = parser.parse_args()

  output_dir: Path = args.output_dir
  output_dir.mkdir(parents=True, exist_ok=True)

  logger.info("Loading source configuration...")
  sources = load_sources(args.config)
  
  if args.filter:
    sources = {
      url: cfg for url, cfg in sources.items()
      if args.filter.lower() in url.lower() or args.filter.lower() in cfg["filename"].lower()
    }
    logger.info(f"Filtered to {len(sources)} sources matching '{args.filter}'")

  if not sources:
    logger.error("No sources to update")
    return 1

  logger.info(f"Updating {len(sources)} filter lists...")
  
  connector = aiohttp.TCPConnector(limit=args.max_concurrent)
  async with aiohttp.ClientSession(connector=connector) as session:
    tasks = [
      fetch_list(session, url, cfg["filename"], output_dir, cfg["skip_checksum"])
      for url, cfg in sources.items()
    ]
    results = await asyncio.gather(*tasks, return_exceptions=False)

  results_dict = dict(results)
  success_count = sum(1 for success in results_dict.values() if success)
  
  save_metadata(sources, results_dict, output_dir)
  
  logger.info(f"✓ Updated {success_count}/{len(sources)} lists successfully")

  if args.validate:
    try:
      import subprocess
      logger.info("Running AGLint validation...")
      result = subprocess.run(
        ["bun", "x", "aglint", str(output_dir / "*.txt")],
        capture_output=True,
        text=True,
        check=False,
      )
      if result.returncode != 0:
        logger.warning("AGLint found issues (non-blocking)")
    except Exception as e:
      logger.warning(f"Could not run AGLint: {e}")

  return 0 if success_count == len(sources) else 1

if __name__ == "__main__":
  sys.exit(asyncio.run(main()))
