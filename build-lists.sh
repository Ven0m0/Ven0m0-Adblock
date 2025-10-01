#!/usr/bin/env bash
#
# build-lists.sh
# A high-performance build script for Adblock and Host lists using
# professional, compiled tools.

set -euo pipefail

# --- Configuration ---
declare -r BIN_DIR="${HOME}/.local/bin"
declare -r LISTS_SRC_DIR="lists/sources"
declare -r LISTS_OUT_DIR="lists/releases"

declare -A TOOLS=(
  [aglint]="https://github.com/AdguardTeam/AGLint/releases/latest/download/aglint-linux-amd64"
  [hostlist-compiler]="https://github.com/AdguardTeam/HostlistCompiler/releases/latest/download/HostlistCompiler-linux-amd64"
  [kompressor]="https://github.com/m0zgen/kompressor/releases/latest/download/kompressor-x86_64-unknown-linux-musl"
)

# --- Helper Functions ---

# Downloads and installs a tool if it's not already present.
# Makes the script portable and easy to run locally or in CI.
ensure_tool() {
  local -r name="$1"
  local -r url="$2"
  local -r dest="${BIN_DIR}/${name}"

  if [[ -f "$dest" ]]; then
    return 0 # Tool exists
  fi

  echo "  -> Tool '${name}' not found. Downloading from GitHub..."
  mkdir -p "$BIN_DIR"
  # Use curl with -L to follow redirects, -s for silent, -o for output file.
  curl -sL "$url" -o "$dest"
  chmod +x "$dest"
  echo "  -> Installed '${name}' to ${dest}"
}

# Sets the PATH to include our local binaries directory.
setup_env() {
  export PATH="${BIN_DIR}:${PATH}"
  mkdir -p "$LISTS_OUT_DIR"
}

# --- Main Logic ---

build_adblock_list() {
  echo "[1/2] Building Adblock List..."
  local -r temp_file=$(mktemp)
  local -r out_file="${LISTS_OUT_DIR}/adblock.txt"

  # Concatenate all source files into a single temporary file.
  cat "${LISTS_SRC_DIR}"/*.txt > "$temp_file"

  echo "  -> Linting combined sources with AGLint..."
  aglint "$temp_file"

  echo "  -> Compressing with Kompressor..."
  # Kompressor reads from stdin and writes to stdout.
  kompressor < "$temp_file" > "$out_file"

  # Clean up the temporary file.
  rm "$temp_file"
  echo "  -> Adblock list built: ${out_file}"
}

build_host_list() {
  echo "[2/2] Building Hostlist..."
  local -r out_file="${LISTS_OUT_DIR}/hosts.txt"

  echo "  -> Compiling with HostlistCompiler..."
  hostlist-compiler -c "hostlist-config.json"

  echo "  -> Hostlist built: ${out_file}"
}

main() {
  # Download any missing tools.
  for tool in "${!TOOLS[@]}"; do
    ensure_tool "$tool" "${TOOLS[$tool]}"
  done

  setup_env
  build_adblock_list
  build_host_list

  echo "All lists built successfully."
}

# --- Entrypoint ---
main
