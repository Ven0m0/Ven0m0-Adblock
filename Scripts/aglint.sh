#!/bin/bash
# https://github.com/AdguardTeam/AGLint
# Exit immediately if a command exits with a non-zero status
set -e

npm init -y
npm install -D @adguard/aglint
npx aglint init
npm pkg set scripts.lint="aglint"
npm run lint
