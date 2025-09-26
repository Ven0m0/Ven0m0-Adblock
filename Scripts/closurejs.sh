#!/usr/bin/env bash
#
# Compiles JavaScript using Google Closure Compiler.
#
LC_ALL=C
# --- Configuration ---
# Path to the Closure Compiler .jar file
# Download from: https://dl.google.com/closure-compiler/compiler-latest.zip
#declare -r CLOSURE_JAR="$HOME/bin/closure-compiler.jar"
declare -r CLOSURE_JAR="closure-compiler"

# Input and Output files
declare -r INPUT_FILE="src.js"
declare -r OUTPUT_FILE="app.min.js"

# --- Main Logic ---
# Check for Java
if ! command -v java &>/dev/null; then
  echo "Error: Java is not installed. Please install Java (JRE) to run the Closure Compiler." >&2
  exit 1
fi

# Check for Compiler JAR
if [[ ! -f "$CLOSURE_JAR" ]]; then
  echo "Error: Closure Compiler JAR not found at '$CLOSURE_JAR'." >&2
  echo "Download it from https://dl.google.com/closure-compiler/compiler-latest.zip" >&2
  exit 1
fi

# Check for Input file
if [[ ! -f "$INPUT_FILE" ]]; then
  echo "Error: Input file not found at '$INPUT_FILE'." >&2
  exit 1
fi

# Run the compiler
"$CLOSURE_JAR" \
  --js "$INPUT_FILE" \
  --js_output_file "$OUTPUT_FILE" \
  --compilation_level SIMPLE_OPTIMIZATIONS \
  --language_in ECMASCRIPT_2020 \
  --language_out ECMASCRIPT_2015 \
  --warning_level DEFAULT

echo "Compilation complete: '$INPUT_FILE' -> '$OUTPUT_FILE'"
