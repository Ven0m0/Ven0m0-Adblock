# Userscripts

Advanced userscript development with TypeScript support, powered by Bun.

## Features

- **TypeScript Support** - Write userscripts in TypeScript with full type checking
- **Hot Reload** - Watch mode for rapid development
- **Modern Build System** - Fast builds with Bun and esbuild
- **Automatic Metadata** - Userscript headers automatically updated with URLs
- **Multiple Formats** - Support for both `.user.js` and `.user.ts` files
- **Source Maps** - Inline source maps in development mode
- **Minification** - Optimized production builds

## Quick Start

### Development Mode (Recommended)

Start the development server with watch mode:

```bash
bun run dev:userscripts
```

This will:
- Build all userscripts in development mode (no minification)
- Watch for file changes and rebuild automatically
- Include inline source maps for debugging

### Production Build

Build optimized userscripts for production:

```bash
bun run build:userscripts:new
```

Or use the legacy bash build script:

```bash
bun run build:userscripts
```

## Project Structure

```
userscripts/
├── src/                    # Source userscripts
│   ├── yt-pro.user.js     # JavaScript userscript
│   └── example.user.ts    # TypeScript userscript (future)
├── dist/                   # Built userscripts (auto-generated)
│   ├── *.user.js          # Full userscripts
│   └── *.meta.js          # Metadata only (for updates)
├── build.ts               # TypeScript build script
└── README.md              # This file
```

## Creating a Userscript

### JavaScript Userscript

Create a file in `src/` with `.user.js` extension:

```javascript
// ==UserScript==
// @name         My Awesome Script
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Does something cool
// @author       Ven0m0
// @match        https://example.com/*
// @grant        none
// @license      GPL-3.0
// ==/UserScript==

(function() {
  "use strict";
  console.log("Hello from userscript!");
})();
```

### TypeScript Userscript

Create a file in `src/` with `.user.ts` extension:

```typescript
// ==UserScript==
// @name         My TypeScript Script
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  TypeScript-powered userscript
// @author       Ven0m0
// @match        https://example.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @license      GPL-3.0
// ==/UserScript==

interface Config {
  enabled: boolean;
  value: string;
}

const config: Config = {
  enabled: true,
  value: "TypeScript rocks!",
};

function main() {
  if (config.enabled) {
    console.log(config.value);
  }
}

main();
```

## Build Commands

| Command | Description |
|---------|-------------|
| `bun run dev:userscripts` | Development mode with watch (recommended) |
| `bun run build:userscripts:new` | Production build (minified) |
| `bun run build:userscripts:dev` | Development build (no watch) |
| `bun run build:userscripts:watch` | Watch mode only |
| `bun run build:userscripts` | Legacy bash build script |

## Build Options

The build script (`userscripts/build.ts`) supports the following options:

```bash
# Development mode (no minification, inline sourcemaps)
bun userscripts/build.ts --dev

# Watch mode (rebuild on file changes)
bun userscripts/build.ts --watch

# Both dev and watch
bun userscripts/build.ts --dev --watch

# Build specific scripts
bun userscripts/build.ts --scripts yt-pro.user.js web-pro.user.js

# Force minification (overrides --dev)
bun userscripts/build.ts --minify
```

## How It Works

### Build Process

1. **Find Userscripts** - Scans `src/` for `*.user.js` and `*.user.ts` files
2. **Extract Metadata** - Parses the `==UserScript==` header block
3. **Compile/Bundle** - Compiles TypeScript and bundles imports (if needed)
4. **Minify** - Minifies code in production mode
5. **Update URLs** - Adds/updates `@updateURL` and `@downloadURL` in metadata
6. **Generate Outputs**:
   - `{name}.user.js` - Full userscript (header + code)
   - `{name}.meta.js` - Metadata only (for update checks)

### TypeScript Compilation

- **Target**: ES2023 (modern browsers)
- **Format**: IIFE (Immediately Invoked Function Expression)
- **Bundling**: Automatic for files with `import`/`export`
- **Tree Shaking**: Removes unused code
- **Source Maps**: Inline in dev mode, none in production

### Metadata Management

The build system automatically:
- Updates `@updateURL` to point to the raw GitHub file
- Updates `@downloadURL` to the same URL
- Preserves all other metadata fields
- Generates `.meta.js` files for update checking

URLs follow this pattern:
```
https://github.com/Ven0m0/Ven0m0-Adblock/raw/main/userscripts/dist/{name}.user.js
```

## Development Workflow

### 1. Create Your Userscript

```bash
# Create new file
touch userscripts/src/my-script.user.ts

# Edit with your favorite editor
code userscripts/src/my-script.user.ts
```

### 2. Start Development Server

```bash
bun run dev:userscripts
```

### 3. Install in Browser

1. Build creates `userscripts/dist/my-script.user.js`
2. Install in Tampermonkey/Violentmonkey/Greasemonkey
3. Edit source file - changes auto-rebuild
4. Reload page in browser to see changes

### 4. Production Build

```bash
bun run build:userscripts:new
```

Built files are in `userscripts/dist/` ready for distribution.

## TypeScript Benefits

### Type Safety

```typescript
// Catch errors at build time
const element: HTMLElement | null = document.querySelector(".foo");
element.click(); // Error: Object is possibly 'null'

// Correct usage
if (element) {
  element.click(); // OK
}
```

### IntelliSense & Autocomplete

Your editor will provide:
- Auto-completion for DOM APIs
- Type hints for GM_* functions
- Inline documentation
- Refactoring support

### GM Types

Install types for Greasemonkey APIs:

```bash
bun add -d @types/greasemonkey
```

Then use them:

```typescript
/// <reference types="greasemonkey" />

GM_setValue("key", "value");
const val: string = GM_getValue("key", "default");
```

## Migrating Existing Scripts

### From JavaScript to TypeScript

1. **Rename file**: `script.user.js` → `script.user.ts`
2. **Add types gradually**:
   ```typescript
   // Start with any
   let data: any = JSON.parse(response);

   // Add specific types later
   interface ApiResponse {
     status: string;
     data: unknown;
   }
   let data: ApiResponse = JSON.parse(response);
   ```
3. **Enable strict mode** (in `tsconfig.json`) when ready

### Keeping JavaScript

You can keep using `.user.js` files - they work perfectly! TypeScript is optional.

## Legacy Build System

The repository includes a bash-based build system in `Scripts/build-all.sh` for backward compatibility. It:
- Downloads external scripts from `userscripts/list.txt`
- Runs ESLint with auto-fix
- Minifies with esbuild
- Processes scripts in parallel

To use the legacy system:

```bash
bun run build:userscripts
```

The new TypeScript build system (`build.ts`) is recommended for new development.

## Troubleshooting

### Build Fails

**Check TypeScript errors:**
```bash
tsc --noEmit
```

**Check file paths:**
- Source files must be in `userscripts/src/`
- Files must end with `.user.js` or `.user.ts`

### Watch Mode Not Working

**Kill existing watchers:**
```bash
pkill -f "bun.*build.ts"
```

**Restart watch mode:**
```bash
bun run dev:userscripts
```

### Missing Metadata

Ensure your userscript has a proper header:

```javascript
// ==UserScript==
// @name         Required
// @namespace    Required
// @version      Required
// @description  Required
// @author       Required
// @match        Required
// @grant        none
// ==/UserScript==
```

### Import Errors

If using imports in JavaScript files:

```javascript
// Won't work in plain .user.js
import { foo } from "./lib.js";

// Use TypeScript instead
// my-script.user.ts
import { foo } from "./lib";
```

Or use inline bundling in build script.

## Best Practices

### 1. Use TypeScript for Complex Scripts

TypeScript helps catch bugs early and makes refactoring easier.

### 2. Keep Headers Up to Date

Update `@version` when making changes:
```
@version      1.2.3
```

### 3. Test in Multiple Browsers

Userscripts may behave differently in:
- Tampermonkey (Chrome, Firefox, Edge)
- Violentmonkey (Cross-browser)
- Greasemonkey (Firefox only)

### 4. Use Grants Sparingly

Only request permissions you need:
```
// Good
@grant        GM_getValue
@grant        GM_setValue

// Avoid
@grant        GM.*
```

### 5. Namespace Properly

Use unique namespaces to avoid conflicts:
```
@namespace    https://github.com/Ven0m0/Ven0m0-Adblock
```

### 6. Version Semantically

Follow semantic versioning:
- `1.0.0` → `1.0.1` - Bug fix
- `1.0.0` → `1.1.0` - New feature
- `1.0.0` → `2.0.0` - Breaking change

## Resources

### Documentation

- [Greasemonkey Manual](https://wiki.greasespot.net/Greasemonkey_Manual:API)
- [Tampermonkey Documentation](https://www.tampermonkey.net/documentation.php)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Bun Documentation](https://bun.sh/docs)

### Tools

- [Tampermonkey](https://www.tampermonkey.net/) - Most popular userscript manager
- [Violentmonkey](https://violentmonkey.github.io/) - Open source alternative
- [Greasemonkey](https://www.greasespot.net/) - Firefox only

### Community

- [GreasyFork](https://greasyfork.org/) - Userscript repository
- [OpenUserJS](https://openuserjs.org/) - Alternative repository

## Contributing

When adding new userscripts:

1. Follow naming convention: `{name}.user.{js|ts}`
2. Include proper metadata headers
3. Test in development mode first
4. Run linters before committing:
   ```bash
   bun run lint:fix
   ```
5. Build for production:
   ```bash
   bun run build:userscripts:new
   ```
6. Commit source files, built files are auto-generated in CI

## License

All userscripts in this repository are licensed under GPL-3.0 unless otherwise specified in the script's metadata.

---

**Built with ❤️ using [Bun](https://bun.sh) and inspired by [bun-ts-userscript-starter](https://github.com/genzj/bun-ts-userscript-starter)**
