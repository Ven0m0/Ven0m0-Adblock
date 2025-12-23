#!/usr/bin/env python3
"""
Automated AdList Downloader & Mirror
Downloads adblock lists from Brave's catalog, validates checksums, and stores them. 
Based on brave/adblock-lists-mirror with Ven0m0 standards applied.
"""

import argparse
import asyncio
import base64
import hashlib
import json
import logging
import re
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Final
import aiohttp

# ============================================================================
# CONFIGURATION
# ============================================================================
CATALOG_URL: Final[str] = (
  "https://raw.githubusercontent.com/brave/adblock-resources/"
  "master/filter_lists/list_catalog.json"
)
DEFAULT_OUTPUT: Final[str] = "lists/mirror"
TIMEOUT: Final[int] = 60
CHUNK_SIZE: Final[int] = 8192

# ============================================================================
# LOGGING
# ============================================================================
logging. basicConfig(
  level=logging.INFO,
  format="[%(asctime)s] %(levelname)s [%(funcName)s] %(message)s",
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

  # Extract checksum line
  pattern = re.compile(
    r"^\s*!\s*checksum[\s\-:]+([\w\+\/=]+).*\n",
    re.MULTILINE | re.IGNORECASE,
  )
  match = pattern.search(data)

  if not match:
    logger.warning(f"No checksum found in {filepath.name}")
    return False

  declared_checksum = match.group(1)
  data_no_checksum = pattern.sub("", data, 1)

  # Normalize (Adblock Plus spec)
  normalized = data_no_checksum.replace("\r", "").rstrip("\n") + "\n"

  # Compute MD5 (base64, no padding)
  computed_hash = hashlib.md5(normalized.encode("utf-8")).digest()
  computed_checksum = base64.b64encode(computed_hash).decode().rstrip("=")

  if declared_checksum == computed_checksum:
    logger.info(f"✓ Checksum valid:  {filepath.name}")
    return True
  else:
    logger.error(
      f"✗ Checksum mismatch in {filepath.name}:  "
      f"expected {computed_checksum}, got {declared_checksum}"
    )
    return False

# ============================================================================
# FILE OPERATIONS
# ============================================================================

def move_downloaded_file(
  temp_path: Path,
  url: str,
  output_dir: Path,
) -> Path | None:
  """Move temp file to final destination with URL-based hash naming."""
  url_hash = hashlib.md5(url.encode("utf-8")).hexdigest()
  dest_path = output_dir / f"{url_hash}.txt"

  try:
    # Skip checksum for known-problematic domains
    if "easylist-downloads.adblockplus.org" not in url:
      if not validate_checksum(temp_path):
        logger.warning(f"Skipping {url} due to checksum failure")
        temp_path.unlink()
        return None

    shutil.move(str(temp_path), dest_path)
    logger.info(f"→ {dest_path.name}")
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
  output_dir: Path,
) -> bool:
  """Download a single adlist with streaming."""
  try:
    async with session.get(url, timeout=TIMEOUT) as resp:
      resp.raise_for_status()

      with tempfile.NamedTemporaryFile(
        mode="wb",
        delete=False,
        suffix=".txt",
      ) as tmp: 
        tmp_path = Path(tmp.name)

        async for chunk in resp. content.iter_chunked(CHUNK_SIZE):
          tmp. write(chunk)

      logger.info(f"✓ Downloaded {url}")
      return move_downloaded_file(tmp_path, url, output_dir) is not None

  except asyncio.TimeoutError:
    logger.error(f"✗ Timeout:  {url}")
  except aiohttp.ClientError as e:
    logger.error(f"✗ HTTP error for {url}: {e}")
  except Exception as e:
    logger.exception(f"✗ Unexpected error for {url}: {e}")

  return False

# ============================================================================
# CATALOG PROCESSING
# ============================================================================

async def fetch_catalog(catalog_url: str) -> list[str]:
  """Download and parse the Brave adblock catalog."""
  async with aiohttp.ClientSession() as session:
    async with session.get(catalog_url, timeout=TIMEOUT) as resp:
      resp.raise_for_status()
      catalog = await resp.json()

  urls:  list[str] = []
  for entry in catalog:
    for source in entry.get("sources", []):
      if url := source.get("url"):
        urls.append(url)

  logger.info(f"Found {len(urls)} lists in catalog")
  return urls

def save_metadata(urls: list[str], output_dir: Path) -> None:
  """Save URL→hash mapping as JSON."""
  metadata = {
    hashlib.md5(url.encode("utf-8")).hexdigest(): url
    for url in urls
  }

  metadata_file = output_dir / "metadata. json"
  metadata_file. write_text(
    json.dumps(metadata, indent=2, sort_keys=True) + "\n",
    encoding="utf-8",
  )
  logger.info(f"Saved metadata:  {metadata_file}")

# ============================================================================
# MAIN PIPELINE
# ============================================================================

async def main() -> int:
  """Main async execution flow."""
  parser = argparse. ArgumentParser(
    description="Download and mirror Brave adblock filter lists"
  )
  parser.add_argument(
    "--catalog",
    default=CATALOG_URL,
    help="Catalog JSON URL",
  )
  parser.add_argument(
    "--output-dir",
    default=DEFAULT_OUTPUT,
    help="Output directory for downloaded lists",
  )
  parser.add_argument(
    "--max-concurrent",
    type=int,
    default=10,
    help="Max concurrent downloads",
  )
  args = parser.parse_args()

  output_dir = Path(args.output_dir)
  output_dir.mkdir(parents=True, exist_ok=True)

  logger.info("Fetching catalog...")
  urls = await fetch_catalog(args.catalog)

  save_metadata(urls, output_dir)

  logger.info(f"Downloading {len(urls)} lists...")
  connector = aiohttp.TCPConnector(limit=args.max_concurrent)
  async with aiohttp.ClientSession(connector=connector) as session:
    tasks = [fetch_list(session, url, output_dir) for url in urls]
    results = await asyncio.gather(*tasks, return_exceptions=False)

  success_count = sum(1 for r in results if r)
  logger.info(f"Downloaded {success_count}/{len(urls)} lists successfully")

  return 0 if success_count == len(urls) else 1

if __name__ == "__main__": 
  sys.exit(asyncio.run(main()))
