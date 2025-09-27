#!/usr/bin/env bash
#
# A minimal script to optimize a single JS file or a directory of JS files
# using Google Closure Compiler.

set -o errexit
set -o nounset
set -o pipefail

# --- CONFIGURATION ---
# Adjust the path to your Closure Compiler .jar file.
# Download: https://dl.google.com/closure-compiler/compiler-latest.zip
declare -r CLOSURE_JAR="$HOME/bin/closure-compiler.jar"

# --- MAIN LOGIC ---

# Ensure dependencies are met before proceeding.
check_deps() {
  if ! command -v java &>/dev/null; then
    echo "Error: Java is not installed. Please install it to run Closure Compiler." >&2
    exit 1
  fi
  if [[ ! -f "$CLOSURE_JAR" ]]; then
    echo "Error: Closure Compiler JAR not found at '$CLOSURE_JAR'." >&2
    exit 1
  fi
}

# The core optimization function for a single file.
process_file() {
  local input_file="$1"
  # Create a `.min.js` output file in the same directory.
  local output_file="${input_file%.js}.min.js"

  echo "Processing: ${input_file} -> ${output_file}"

  java -jar "$CLOSURE_JAR" \
    --compilation_level SIMPLE_OPTIMIZATIONS \
    --language_in ECMASCRIPT_NEXT \
    --language_out ECMASCRIPT_2020 \
    --js_output_file "$output_file" \
    --js "$input_file"
}

main() {
  if [[ $# -eq 0 ]]; then
    echo "Usage: $0 <file.js|directory>" >&2
    exit 1
  fi

  check_deps
  local target="$1"

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
      mapfile -t files_to_process < <(fd --type f --extension js --base-directory "$target" . )
    else
      mapfile -t files_to_process < <(find "$target" -type f -name "*.js")
    fi

    if ((${#files_to_process[@]} == 0)); then
      echo "No .js files found in '$target'."
      exit 0
    fi
    
    # Process each file found.
    # Note: For directory processing, fd provides paths relative to the base, find provides full paths.
    # The logic here handles both cases correctly.
    for file in "${files_to_process[@]}"; do
      # If using find, 'file' is the full path already.
      # If using fd, we need to prepend the target directory.
      if command -v fd &>/dev/null; then
        process_file "$target/$file"
      else
        process_file "$file"
      fi
    done
  fi

  echo "Optimization complete."
}

# --- SCRIPT ENTRYPOINT ---
main "$@"
