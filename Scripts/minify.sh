#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob globstar
LC_ALL=C IFS=$'\n\t'

# TODO: finish
npx uglifyjs --compress --mangle --toplevel
npx html-minifier --collapse-whitespace --remove-comments --remove-script-type-attributes --remove-tag-whitespace --minify-css true --minify-js true
npx minify-json
