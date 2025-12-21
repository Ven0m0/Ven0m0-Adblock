#!/usr/bin/env bash
# JS/TS Quality & High-Performance Enforcer
# Scope: Scan, Format, Lint, Report, CI Gate
# Architecture: Biome (format/lint) + Oxlint (deep static analysis)

set -Eeuo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# File patterns
readonly FILE_EXTENSIONS=(-e js -e jsx -e ts -e tsx -e mjs -e cjs)
readonly EXCLUDE_DIRS=(-E node_modules -E .git -E dist -E build -E coverage)

# Determine fd binary (fallback to find if not available)
_FD_BIN="${FD_BIN:-fd}"
if ! command -v fd &> /dev/null && ! command -v fdfind &> /dev/null; then
  _FD_BIN="find"
fi

# Tool binaries
readonly BIOME_BIN="${BIOME_BIN:-bunx biome}"
readonly OXLINT_BIN="${OXLINT_BIN:-bunx oxlint}"
readonly FD_BIN="$_FD_BIN"

# Output control
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly BOLD='\033[1m'
readonly NC='\033[0m' # No Color

# Tracking arrays
declare -a SCANNED_FILES=()
declare -a BIOME_ERRORS=()
declare -a OXLINT_ERRORS=()
declare -i TOTAL_FILES=0
declare -i TOTAL_ERRORS=0
declare -i EXIT_CODE=0

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

log_info() {
  echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $*" >&2
}

log_header() {
  echo -e "\n${BOLD}$*${NC}"
}

check_command() {
  local cmd="$1"
  local install_hint="$2"

  # Handle multi-word commands (e.g., "bunx biome")
  local first_word="${cmd%% *}"

  if ! command -v "$first_word" &> /dev/null; then
    log_error "Required tool '$cmd' not found (runner '$first_word' missing)"
    log_info "Install hint: $install_hint"
    return 1
  fi

  # For bunx commands, verify the package works
  if [[ "$cmd" == bunx* ]]; then
    if ! "$cmd" --version &> /dev/null 2>&1; then
      log_error "Required tool '$cmd' not found (package may not be installed)"
      log_info "Install hint: $install_hint"
      return 1
    fi
    log_success "$cmd found: $("$cmd" --version 2>&1 | head -n1)"
  else
    log_success "$cmd found: $(command -v "$cmd")"
  fi

  return 0
}

# ============================================================================
# TOOL VERIFICATION
# ============================================================================

verify_tools() {
  log_header "🔍 Verifying Required Tools"

  local all_ok=true

  # Check fd (or find fallback)
  if [ "$FD_BIN" = "find" ]; then
    log_success "Using find as fallback (fd not found)"
  elif ! check_command "$FD_BIN" "mise install fd@latest OR cargo install fd-find"; then
    all_ok=false
  fi

  # Check biome
  if ! check_command "$BIOME_BIN" "bun add -D @biomejs/biome OR npm install -g @biomejs/biome"; then
    all_ok=false
  fi

  # Check oxlint
  if ! check_command "$OXLINT_BIN" "bun add -D oxlint OR npm install -g oxlint"; then
    all_ok=false
  fi

  if [ "$all_ok" = false ]; then
    log_error "Missing required tools. Please install them and try again."
    return 1
  fi

  return 0
}

# ============================================================================
# FILE DISCOVERY
# ============================================================================

discover_files() {
  log_header "📂 Discovering JS/TS Files"

  cd "$PROJECT_ROOT" || return 1

  # Use fd for fast file discovery, fallback to find
  if [ "$FD_BIN" = "find" ]; then
    mapfile -t SCANNED_FILES < <(
      find . -type f \
        \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -o -name "*.mjs" -o -name "*.cjs" \) \
        ! -path "*/node_modules/*" \
        ! -path "*/.git/*" \
        ! -path "*/dist/*" \
        ! -path "*/build/*" \
        ! -path "*/coverage/*" \
        2>/dev/null || true
    )
  else
    mapfile -t SCANNED_FILES < <(
      "$FD_BIN" -tf \
        "${FILE_EXTENSIONS[@]}" \
        "${EXCLUDE_DIRS[@]}" \
        . 2>/dev/null || true
    )
  fi

  TOTAL_FILES=${#SCANNED_FILES[@]}

  if [ "$TOTAL_FILES" -eq 0 ]; then
    log_warning "No JS/TS files found matching criteria"
    return 1
  fi

  log_success "Found $TOTAL_FILES files to process"

  # Show sample files (first 5)
  local -i display_count=$((TOTAL_FILES < 5 ? TOTAL_FILES : 5))
  for ((i=0; i<display_count; i++)); do
    echo "  - ${SCANNED_FILES[$i]}"
  done

  if [ "$TOTAL_FILES" -gt 5 ]; then
    echo "  ... and $((TOTAL_FILES - 5)) more"
  fi

  return 0
}

# ============================================================================
# FORMATTING (BIOME)
# ============================================================================

run_biome_format() {
  log_header "🎨 Running Biome Formatter"

  if [ "$TOTAL_FILES" -eq 0 ]; then
    log_warning "No files to format"
    return 0
  fi

  cd "$PROJECT_ROOT" || return 1

  local format_output
  local format_exit=0

  # Biome can handle multiple files efficiently
  format_output=$("$BIOME_BIN" format --write "${SCANNED_FILES[@]}" 2>&1) || format_exit=$?

  if [ "$format_exit" -eq 0 ]; then
    log_success "Formatting completed successfully"
  else
    log_warning "Formatting completed with warnings"
    echo "$format_output" | head -n 20
  fi

  return 0
}

# ============================================================================
# LINTING WITH AUTO-FIX (BIOME)
# ============================================================================

run_biome_lint() {
  log_header "🔧 Running Biome Linter (with auto-fix)"

  if [ "$TOTAL_FILES" -eq 0 ]; then
    log_warning "No files to lint"
    return 0
  fi

  cd "$PROJECT_ROOT" || return 1

  local lint_output
  local lint_exit=0

  # Run biome check with auto-fix (safe fixes only)
  lint_output=$("$BIOME_BIN" check --write "${SCANNED_FILES[@]}" 2>&1) || lint_exit=$?

  if [ "$lint_exit" -eq 0 ]; then
    log_success "Linting completed with no errors"
  else
    log_warning "Linting found issues (some may have been auto-fixed)"

    # Parse errors for reporting
    local error_count
    error_count=$(echo "$lint_output" | grep -c "error" || echo "0")

    if [ "$error_count" -gt 0 ]; then
      BIOME_ERRORS+=("$error_count errors found")
      TOTAL_ERRORS=$((TOTAL_ERRORS + error_count))
    fi

    # Show first 30 lines of output
    echo "$lint_output" | head -n 30

    if [ "$(echo "$lint_output" | wc -l)" -gt 30 ]; then
      echo "... (output truncated)"
    fi
  fi

  return 0
}

# ============================================================================
# DEEP STATIC ANALYSIS (OXLINT)
# ============================================================================

run_oxlint() {
  log_header "🔬 Running Oxlint Deep Static Analysis"

  if [ "$TOTAL_FILES" -eq 0 ]; then
    log_warning "No files to analyze"
    return 0
  fi

  cd "$PROJECT_ROOT" || return 1

  local oxlint_output
  local oxlint_exit=0

  # Run oxlint with all rules and treat warnings as errors for CI
  oxlint_output=$(
    "$OXLINT_BIN" \
      -D all \
      --deny-warnings \
      "${SCANNED_FILES[@]}" \
      2>&1
  ) || oxlint_exit=$?

  if [ "$oxlint_exit" -eq 0 ]; then
    log_success "Deep static analysis passed with no issues"
  else
    log_error "Deep static analysis found issues"

    # Parse errors for reporting
    local error_count
    error_count=$(echo "$oxlint_output" | grep -E "(error|warning)" | wc -l || echo "0")

    if [ "$error_count" -gt 0 ]; then
      OXLINT_ERRORS+=("$error_count issues found")
      TOTAL_ERRORS=$((TOTAL_ERRORS + error_count))
      EXIT_CODE=1
    fi

    # Show first 40 lines of output
    echo "$oxlint_output" | head -n 40

    if [ "$(echo "$oxlint_output" | wc -l)" -gt 40 ]; then
      echo "... (output truncated)"
    fi
  fi

  return 0
}

# ============================================================================
# REPORTING
# ============================================================================

generate_summary_table() {
  log_header "📊 Quality Check Summary"

  # Print table header
  printf "\n"
  printf "┌─────────────────────────────────┬──────────────┬───────────────┬──────────────┐\n"
  printf "│ %-31s │ %-12s │ %-13s │ %-12s │\n" "Metric" "Value" "Biome Issues" "Oxc Issues"
  printf "├─────────────────────────────────┼──────────────┼───────────────┼──────────────┤\n"

  # Files scanned
  printf "│ %-31s │ %12d │ %13s │ %12s │\n" \
    "Total Files Scanned" \
    "$TOTAL_FILES" \
    "-" \
    "-"

  # Biome errors
  local biome_count=${#BIOME_ERRORS[@]}
  local biome_display="-"
  if [ "$biome_count" -gt 0 ]; then
    biome_display="${BIOME_ERRORS[0]}"
  fi

  printf "│ %-31s │ %12s │ %13s │ %12s │\n" \
    "Biome Check Results" \
    "-" \
    "$biome_display" \
    "-"

  # Oxlint errors
  local oxlint_count=${#OXLINT_ERRORS[@]}
  local oxlint_display="-"
  if [ "$oxlint_count" -gt 0 ]; then
    oxlint_display="${OXLINT_ERRORS[0]}"
  fi

  printf "│ %-31s │ %12s │ %13s │ %12s │\n" \
    "Oxlint Analysis Results" \
    "-" \
    "-" \
    "$oxlint_display"

  # Total errors
  printf "├─────────────────────────────────┼──────────────┼───────────────┼──────────────┤\n"
  printf "│ %-31s │ %12d │ %13s │ %12s │\n" \
    "Total Issues Found" \
    "$TOTAL_ERRORS" \
    "-" \
    "-"

  printf "└─────────────────────────────────┴──────────────┴───────────────┴──────────────┘\n"
  printf "\n"

  # Overall status
  if [ "$TOTAL_ERRORS" -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✓ All quality checks passed!${NC}"
  else
    echo -e "${RED}${BOLD}✗ Quality checks failed with $TOTAL_ERRORS total issues${NC}"
  fi
}

generate_json_report() {
  if [ "${CI:-false}" != "true" ]; then
    return 0
  fi

  log_header "📄 Generating CI JSON Report"

  local json_file="$PROJECT_ROOT/quality-report.json"

  # Build JSON structure
  cat > "$json_file" <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "total_files": $TOTAL_FILES,
  "total_errors": $TOTAL_ERRORS,
  "exit_code": $EXIT_CODE,
  "checks": {
    "biome": {
      "status": "${#BIOME_ERRORS[@]}",
      "errors": [
        $(printf '"%s"' "${BIOME_ERRORS[@]}" | paste -sd,)
      ]
    },
    "oxlint": {
      "status": "${#OXLINT_ERRORS[@]}",
      "errors": [
        $(printf '"%s"' "${OXLINT_ERRORS[@]}" | paste -sd,)
      ]
    }
  },
  "files": [
$(printf '    "%s"' "${SCANNED_FILES[@]}" | paste -sd,)
  ]
}
EOF

  log_success "JSON report saved to: $json_file"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
  log_header "🚀 JS/TS Quality & High-Performance Enforcer"
  echo "Project: $PROJECT_ROOT"
  echo ""

  # Step 1: Verify all required tools
  if ! verify_tools; then
    exit 1
  fi

  # Step 2: Discover files
  if ! discover_files; then
    log_warning "No files to process. Exiting."
    exit 0
  fi

  # Step 3: Format (Write)
  run_biome_format

  # Step 4: Lint with auto-fix (Fix)
  run_biome_lint

  # Step 5: Deep static analysis (Check)
  run_oxlint

  # Step 6: Generate reports
  generate_summary_table
  generate_json_report

  # Step 7: Exit with appropriate code
  if [ "$EXIT_CODE" -ne 0 ]; then
    log_error "Quality checks failed. Please fix the issues above."
    exit 1
  else
    log_success "All quality checks completed successfully!"
    exit 0
  fi
}

# Run main function
main "$@"
