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
import json
import logging
import re
import sys
import tempfile
from pathlib import Path
from typing import Final
import aiohttp

# ============================================================================
# CONFIGURATION
# ============================================================================
SOURCES_CONFIG: Final[str] = "lists/sources-urls.json"
DEFAULT_OUTPUT: Final[str] = "lists/sources"
METADATA_FILE: Final[str] = "lists/sources-metadata.json"
TIMEOUT: Final[int] = 60
CHUNK_SIZE: Final[int] = 8192
MAX_CONCURRENT:  Final[int] = 10

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

def validate_checksum(filepath: Path) -> bool:
  """Validate Adblock Plus checksum header."""
  try:
    data = filepath.read_text(encoding="utf-8")
  except Exception as e:
    logger.warning(f"Failed to read {filepath. name}: {e}")
    return False

  pattern = re.compile(
    r"^\s*!\s*checksum[\s\-:]+([\w\+\/=]+).*\n",
    re.MULTILINE | re.IGNORECASE,
  )
  match = pattern.search(data)

  if not match:
    logger.debug(f"No checksum in {filepath.name} (optional)")
    return True

  declared_checksum = match.group(1)
  data_no_checksum = pattern.sub("", data, 1)
  normalized = data_no_checksum.replace("\r", "").rstrip("\n") + "\n"
  computed_hash = hashlib.md5(normalized.encode("utf-8")).digest()
  computed_checksum = base64.b64encode(computed_hash).decode().rstrip("=")

  if declared_checksum == computed_checksum:
    logger.info(f"✓ Checksum valid:  {filepath.name}")
    return True

  logger.error(
    f"✗ Checksum mismatch in {filepath. name}:  "
    f"expected {computed_checksum}, got {declared_checksum}"
  )
  return False

# ============================================================================
# FILE OPERATIONS
# ============================================================================

def sanitize_filename(url: str, name: str | None = None) -> str:
  """Generate safe filename from URL or provided name."""
  if name:
    safe = re.sub(r'[^\w\-.]', '-', name)
    return f"{safe}.txt" if not safe.endswith('. txt') else safe
  
  url_hash = hashlib.md5(url.encode("utf-8")).hexdigest()[:12]
  domain = re.search(r'://([^/]+)', url)
  domain_part = domain.group(1).replace('. ', '-') if domain else 'list'
  return f"{domain_part}-{url_hash}.txt"

def process_downloaded_file(
  temp_path: Path,
  url: str,
  filename: str,
  output_dir: Path,
  skip_checksum: bool = False,
) -> Path | None:
  """Process and move temp file to final destination."""
  dest_path = output_dir / filename

  try:
    if not skip_checksum: 
      if not validate_checksum(temp_path):
        logger.warning(f"Checksum validation failed for {url}")
    
    content = temp_path.read_text(encoding="utf-8")
    
    if len(content) < 100:
      logger.error(f"Downloaded file suspiciously small ({len(content)} bytes): {url}")
      temp_path.unlink()
      return None
    
    rule_count = len([line for line in content.splitlines() if line.strip() and not line.strip().startswith(('! ', '#', '['))])
    
    dest_path.write_text(content, encoding="utf-8")
    logger.info(f"✓ {filename} ({rule_count} rules)")
    return dest_path

  except Exception as e:
    logger.exception(f"Error processing {url}:  {e}")
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

      with tempfile.NamedTemporaryFile(
        mode="wb",
        delete=False,
        suffix=".txt",
      ) as tmp: 
        tmp_path = Path(tmp.name)

        async for chunk in resp.content.iter_chunked(CHUNK_SIZE):
          tmp. write(chunk)

      result = process_downloaded_file(tmp_path, url, filename, output_dir, skip_checksum)
      return (url, result is not None)

  except asyncio.TimeoutError:
    logger.error(f"✗ Timeout:  {url}")
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
          "url":  "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt",
          "filename":  "uBlock-Filters.txt",
          "skip_checksum": False,
          "enabled": True
        },
        {
          "url": "https://easylist. to/easylist/easylist.txt",
          "filename": "EasyList.txt",
          "skip_checksum": False,
          "enabled": True
        }
      ]
    }
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(template, indent=2) + "\n", encoding="utf-8")
    logger.info(f"Created template config:  {config_path}")
  
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
  logger.info(f"Saved metadata:  {metadata_path}")

# ============================================================================
# MAIN PIPELINE
# ============================================================================

async def main() -> int:
  """Main execution flow."""
  parser = argparse. ArgumentParser(
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

  output_dir:  Path = args.output_dir
  output_dir.mkdir(parents=True, exist_ok=True)

  logger.info("Loading source configuration...")
  sources = load_sources(args.config)
  
  if args.filter:
    sources = {
      url: cfg for url, cfg in sources.items()
      if args.filter. lower() in url.lower() or args.filter. lower() in cfg["filename"].lower()
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
        ["bunx", "aglint", str(output_dir / "*. txt")],
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
