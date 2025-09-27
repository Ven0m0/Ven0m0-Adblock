#!/usr/bin/env bash
#
# A minimal script to optimize JS files using the native 'closure-compiler' binary.
# Defaults to processing all .js files in the current directory (non-recursively)
# if no arguments are given.

set -o errexit
set -o nounset
set -o pipefail

# --- MAIN LOGIC ---

# Ensure the native binary is available.
check_deps() {
  if ! command -v closure-compiler &>/dev/null; then
    echo "Error: 'closure-compiler' command not found in your PATH." >&2
    exit 1
  fi
}

# The core optimization function for a single file.
process_file() {
  local input_file="$1"
  local output_file="${input_file%.js}.min.js"

  echo "Processing: ${input_file} -> ${output_file}"

  closure-compiler \
    --compilation_level SIMPLE_OPTIMIZATIONS \
    --language_in ECMASCRIPT_NEXT \
    --language_out ECMASCRIPT_2020 \
    --js_output_file "$output_file" \
    --js "$input_file"
}

main() {
  local target
  # Use arrays to hold optional command-line flags for find/fd.
  local -a depth_flags_fd=()
  local -a depth_flags_find=()

  if [[ $# -eq 0 ]]; then
    # If no args, default to current directory, non-recursive.
    # A "depth of 0" in user terms translates to a max-depth of 1 for find/fd tools.
    target="."
    depth_flags_fd=("--max-depth" "1")
    depth_flags_find=("-maxdepth" "1")
  else
    # If args are present, use the first as the target with no depth limit.
    target="$1"
  fi

  check_deps

  if [[ ! -e "$target" ]]; then
    echo "Error: Target '$target' not found." >&2
    exit 1
  fi

  if [[ -f "$target" ]]; then
    process_file "$target"
  elif [[ -d "$target" ]]; then
    local -a files_to_process
    # Use 'fd' if available (preferred), otherwise fall back to 'find'.
    if command -v fd &>/dev/null; then
      mapfile -t files_to_process < <(fd --type f --extension js "${depth_flags_fd[@]}" . "$target")
    else
      mapfile -t files_to_process < <(find "$target" "${depth_flags_find[@]}" -type f -name "*.js")
    fi

    if ((${#files_to_process[@]} == 0)); then
      echo "No .js files found matching criteria in '$target'."
      exit 0
    fi

    for file in "${files_to_process[@]}"; do
      process_file "$file"
    done
  fi

  echo "Optimization complete."
}

# --- SCRIPT ENTRYPOINT ---
main "$@"
