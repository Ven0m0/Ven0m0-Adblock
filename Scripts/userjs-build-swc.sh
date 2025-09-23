#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# --- Configuration ---
# The repository slug is used to build the final URLs in the userscript meta blocks.
# It should be in the format 'owner/repository'.
readonly REPOSITORY_SLUG="YourGitHubUsername/YourRepositoryName"

# --- Main Script ---

# 1. Install dependencies (SWC for minification, wget for downloading, GNU Parallel for speed)
#    This assumes you're on a system with 'npm'. 'parallel' might need to be installed via your package manager.
echo "Installing dependencies (SWC, wget, GNU Parallel)..."
npm install --save-exact --save-dev @swc/cli @swc/core > /dev/null 2>&1

# 2. Set up the directory structure
echo "Creating directories..."
mkdir -p download pr-js meta js release

# 3. Download all userscripts listed in the 'List' file
echo "Downloading userscripts..."
while read -r line; do
  # Process only lines that start with '#' which contain the URLs
  if [[ $line == \#* ]]; then
    # Extract the first .user.js URL from the line
    urls=($(echo "$line" | grep -oP 'https://\S+?\.user\.js'))
    if [[ ${#urls[@]} -ge 1 ]]; then
      url=${urls[0]}
      file=$(basename "$url")

      # Sanitize filename and handle potential name collisions
      file=$(echo "$file" | tr -cd '[:alnum:]._-')
      if [[ -f "download/$file" ]]; then
        suffix="A"
        while [[ -f "download/$suffix-$file" ]]; do
          suffix=$(echo "$suffix" | tr "0-9A-Z" "1-9A-Z_")
        done
        file="$suffix-$file"
      fi

      echo "  -> Downloading $file"
      wget -q --header="User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0" \
           --timeout=30 "$url" -O "download/$file"
      
      # Update the 'List' file to point to your repository's future release URL
      # This is for the final README that will be generated
      sed -i "s|$url|https://raw.githubusercontent.com/$REPOSITORY_SLUG/main/release/$file|g" List
    fi
  fi
done < List

# 4. Split each downloaded userscript into its metadata block and its JavaScript code
echo "Splitting userscripts into meta and JS files..."
for file in download/*.user.js; do
  base=$(basename "$file" .user.js)
  # Extract the ==UserScript== block
  sed -n '/\/\/ ==UserScript==/,/\/\/ ==\/UserScript==/p' "$file" > "meta/$base.meta.js"
  # Extract everything after the ==/UserScript== block
  sed -n '/\/\/ ==\/UserScript==/,$p' "$file" | tail -n +2 > "pr-js/$base.js"
done

# 5. Modify the metadata files to point to your new repository URLs
echo "Updating metadata..."
for file in meta/*.meta.js; do
  base=$(basename "$file" .meta.js)
  
  # Remove non-English @name and all @description tags for cleaner meta blocks
  sed -i '/^\/\/ @name:/ { /^\/\/ @name:en/!d }' "$file"
  sed -i '/^\/\/ @description/d' "$file"

  # Update download and update URLs to point to your repository
  sed -i "s|// @downloadURL .*|// @downloadURL https://raw.githubusercontent.com/$REPOSITORY_SLUG/main/release/$base.user.js|" "$file"
  sed -i "s|// @updateURL .*|// @updateURL https://raw.githubusercontent.com/$REPOSITORY_SLUG/main/release/$base.meta.js|" "$file"
done

# 6. Compile/minify the JavaScript files in parallel for performance
echo "Compiling JavaScript files with SWC..."
compile_js() {
  local file=$1
  local base
  base=$(basename "$file" .js)
  # Use SWC for minification. The -C flags enable compression and mangling.
  npx swc "$file" -o "js/$base.js" -C minify=true -C jsc.minify.mangle=true -C jsc.minify.compress=true
}
export -f compile_js
# Find all JS files in pr-js and pipe them to GNU Parallel
find pr-js -name "*.js" | parallel -j "$(nproc)" compile_js

# 7. Merge the modified metadata and the minified JS back into final userscript files
echo "Merging meta and minified JS..."
for file in js/*.js; do
  base=$(basename "$file" .js)
  
  # Extract the userscript name for logging purposes
  userscript_name=$(grep -m 1 -oP '^// @name:en\s+\K.*' "meta/$base.meta.js" || \
                   grep -m 1 -oP '^// @name\s+\K.*' "meta/$base.meta.js")
  userscript_name=$(echo "$userscript_name" | tr -d '\r\n')

  if [[ -z "$userscript_name" ]]; then
    echo -e "\e[31mError: Missing or empty meta file for '$base.meta.js'. Skipping.\e[0m"
    rm -f "meta/$base.meta.js" "release/$base.user.js"
    continue
  fi
  
  js_file_content=$(cat "js/$base.js")
  js_file_length=${#js_file_content}

  # Sanity check: if the compiled file is very small, something probably went wrong.
  if [[ $js_file_length -lt 100 ]]; then
    echo -e "\e[31mFailed to convert userscript: \"$userscript_name\". Output was too small.\e[0m"
    rm -f "meta/$base.meta.js" "release/$base.user.js"
  else
    cat "meta/$base.meta.js" "js/$base.js" > "release/$base.user.js"
    echo -e "  \e[32m-> Successfully converted:\e[0m \"$userscript_name\""
  fi
done

# 8. Finalize the release directory
echo "Finalizing release directory..."
mv meta/*.meta.js release/
# The 'List' file, now with updated URLs, becomes the README for the release branch.
mv List release/README.md

echo -e "\n\e[1;32mCompilation complete. Files are in the 'release' directory.\e[0m"

