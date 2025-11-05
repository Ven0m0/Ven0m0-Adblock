#!/bin/bash
# https://github.com/AdguardTeam/AGLint
# Exit immediately if a command exits with a non-zero status
set -e

# Only initialize if package.json doesn't exist
if [ ! -f package.json ]; then
  npm init -y
fi

# Only install if not already present
if ! npm list @adguard/aglint >/dev/null 2>&1; then
  npm install -D @adguard/aglint
fi

# Only initialize aglint if config doesn't exist
if [ ! -f .aglintrc.yaml ]; then
  npx aglint init
fi

# Set lint script if not already set
lint_script=$(npm pkg get scripts.lint 2>/dev/null || echo '""')
if [ "$lint_script" = '""' ] || [ "$lint_script" = "undefined" ]; then
  npm pkg set scripts.lint="aglint"
fi

npm run lint

# Precommit - only if not already configured
if [ ! -d .husky ]; then
  if ! npm list husky >/dev/null 2>&1; then
    npm install -D husky
  fi
  npx husky init
  echo npx aglint > .husky/pre-commit
fi
