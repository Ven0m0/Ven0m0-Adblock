# TODO

## Maintenance Tasks

- Run `python3 Scripts/deduplicate.py` to deduplicate entries within each blocklist file
- Run `python3 Scripts/deduplicate_across_files.py` to check for duplicates across different files
- Run `npm run format` to format markdown, YAML, and JSON files
- Run `npm run lint:fix` to lint and auto-fix code style issues

## Future Improvements

- Consider consolidating cross-file duplicates into appropriate categories
- Add automated testing for blocklist validity
- Set up CI/CD for automatic list updates

## Useful Resources

- https://github.com/blocklistproject/Lists
- https://github.com/AdguardTeam/HostlistCompiler
- https://github.com/AdguardTeam/AGLint
- https://github.com/AdguardTeam/DeadDomainsLinter



### TODO: userscripts

Use bun for building/bundling

```bash
bun build --compile --bytecode --minify --sourcemap --outdir=./dist --target=bun ./src/index.ts
bun build ./index.ts --production --outfile=out.js
```


package.json:

```json
    "scripts": {
        "aglint": "aglint --cache --cache-location .aglintcache --cache-strategy content \"**/*.txt\"",
        "markdownlint": "markdownlint .",
        "lint": "npm run aglint && npm run markdownlint"
    },
    "lint-staged": {
        "*.txt": "aglint",
        "*.md": "markdownlint"
    },
```
