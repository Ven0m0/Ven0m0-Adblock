#!/usr/bin/env bun
/**
 * Advanced userscript build system with TypeScript support
 * Adapted from bun-ts-userscript-starter for Ven0m0-Adblock
 */

import { watch as fswatch } from "fs";
import { glob } from "glob";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

interface UserScriptMetadata {
  header: string;
  code: string;
}

interface BuildOptions {
  dev?: boolean;
  watch?: boolean;
  minify?: boolean;
  sourcemap?: boolean | "inline";
  scripts?: string[];
}

interface BuildResult {
  outputPath: string;
  success: boolean;
  error?: string;
}

const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
  success: (msg: string) => console.log(`[SUCCESS] ${msg}`),
};

/**
 * Extract userscript metadata block from source code
 */
function extractMetadata(content: string): UserScriptMetadata {
  const headerMatch = content.match(/\/\/\s*==UserScript==[\s\S]*?\/\/\s*==\/UserScript==/);

  if (!headerMatch) {
    return {
      header: "",
      code: content,
    };
  }

  const header = headerMatch[0];
  const code = content.replace(header, "").trim();

  return { header, code };
}

/**
 * Update metadata URLs for distribution
 */
function updateMetadataURLs(
  header: string,
  scriptName: string,
  repoURL: string = "https://github.com/Ven0m0/Ven0m0-Adblock"
): string {
  const distName = scriptName.replace(/\.(user\.)?(js|ts)$/, ".user.js");
  const updateURL = `${repoURL}/raw/main/userscripts/dist/${distName}`;
  const downloadURL = updateURL;

  let updatedHeader = header;

  // Add or update @updateURL
  if (!updatedHeader.includes("@updateURL")) {
    updatedHeader = updatedHeader.replace(
      /\/\/\s*==\/UserScript==/,
      `// @updateURL      ${updateURL}\n// ==/UserScript==`
    );
  } else {
    updatedHeader = updatedHeader.replace(
      /\/\/\s*@updateURL\s+.*/,
      `// @updateURL      ${updateURL}`
    );
  }

  // Add or update @downloadURL
  if (!updatedHeader.includes("@downloadURL")) {
    updatedHeader = updatedHeader.replace(
      /\/\/\s*==\/UserScript==/,
      `// @downloadURL    ${downloadURL}\n// ==/UserScript==`
    );
  } else {
    updatedHeader = updatedHeader.replace(
      /\/\/\s*@downloadURL\s+.*/,
      `// @downloadURL    ${downloadURL}`
    );
  }

  return updatedHeader;
}

/**
 * Build a single userscript
 */
async function buildScript(
  inputPath: string,
  options: BuildOptions
): Promise<BuildResult> {
  const { dev = false, minify = !dev, sourcemap = dev ? "inline" : false } = options;

  try {
    const fileName = path.basename(inputPath);
    const scriptName = fileName.replace(/\.(user\.)?(js|ts)$/, "");
    const outputFileName = `${scriptName}.user.js`;
    const outputDir = path.join(import.meta.dir, "dist");
    const outputPath = path.join(outputDir, outputFileName);
    const metaOutputPath = path.join(outputDir, `${scriptName}.meta.js`);

    logger.info(`Building ${fileName}...`);

    // Read source file
    const sourceContent = await Bun.file(inputPath).text();
    const { header, code } = extractMetadata(sourceContent);

    // Check if we need to compile TypeScript or bundle
    const needsCompilation = inputPath.endsWith(".ts") || code.includes("import") || code.includes("export");

    let compiledCode = code;

    if (needsCompilation) {
      // Use Bun.build for TypeScript compilation and bundling
      const buildResult = await Bun.build({
        entrypoints: [inputPath],
        target: "browser",
        format: "iife",
        minify,
        sourcemap: sourcemap as any,
        define: {
          "process.env.NODE_ENV": dev ? '"development"' : '"production"',
        },
      });

      if (!buildResult.success) {
        throw new Error(`Build failed: ${buildResult.logs.join("\n")}`);
      }

      const output = buildResult.outputs[0];
      compiledCode = await output.text();

      // Remove sourceMappingURL comment if present (we'll handle sourcemaps separately)
      compiledCode = compiledCode.replace(/\/\/# sourceMappingURL=.*/g, "");
    } else if (minify) {
      // For pure JS files, just minify
      const buildResult = await Bun.build({
        entrypoints: [inputPath],
        target: "browser",
        format: "iife",
        minify: true,
      });

      if (!buildResult.success) {
        throw new Error(`Minification failed`);
      }

      compiledCode = await buildResult.outputs[0].text();
    }

    // Update metadata URLs
    const updatedHeader = header ? updateMetadataURLs(header, fileName) : "";

    // Combine header and code
    const finalOutput = header
      ? `${updatedHeader}\n\n${compiledCode}`
      : compiledCode;

    // Ensure output directory exists
    await Bun.write(outputPath, finalOutput);

    // Generate .meta.js file (metadata only)
    if (header) {
      await Bun.write(metaOutputPath, updatedHeader);
    }

    logger.success(`Built ${outputFileName}`);

    return {
      outputPath,
      success: true,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to build ${inputPath}: ${errorMsg}`);
    return {
      outputPath: "",
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Find all userscript files
 */
async function findUserscripts(patterns?: string[]): Promise<string[]> {
  const srcDir = path.join(import.meta.dir, "src");

  if (patterns && patterns.length > 0) {
    // Build specific scripts
    return patterns.map((p) => path.join(srcDir, p));
  }

  // Find all .user.js and .user.ts files
  const scripts = await glob("**/*.user.{js,ts}", {
    cwd: srcDir,
    absolute: true,
  });

  return scripts;
}

/**
 * Build all userscripts
 */
async function buildAll(options: BuildOptions): Promise<void> {
  const scripts = await findUserscripts(options.scripts);

  if (scripts.length === 0) {
    logger.warn("No userscripts found to build");
    return;
  }

  logger.info(`Found ${scripts.length} userscript(s) to build`);

  const results = await Promise.all(
    scripts.map((script) => buildScript(script, options))
  );

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  logger.info(`\nBuild complete: ${successful} successful, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

/**
 * Watch mode
 */
function watchMode(options: BuildOptions): void {
  const srcDir = path.join(import.meta.dir, "src");
  let isBuilding = false;

  const watcher = fswatch(
    srcDir,
    { recursive: true },
    async (event, filename) => {
      if (!filename || isBuilding) return;

      // Only rebuild if it's a userscript file
      if (!filename.match(/\.user\.(js|ts)$/)) {
        return;
      }

      const fullPath = path.join(srcDir, filename);
      logger.info(`Detected ${event} in ${filename}`);

      isBuilding = true;
      try {
        await buildScript(fullPath, options);
      } finally {
        isBuilding = false;
      }
    }
  );

  logger.info(`Watching ${srcDir} for changes...`);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    logger.info("\nStopping watcher...");
    watcher.close();
    process.exit(0);
  });
}

/**
 * Main entry point
 */
async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("dev", {
      type: "boolean",
      description: "Build in development mode (no minification, inline sourcemaps)",
      default: false,
    })
    .option("watch", {
      type: "boolean",
      description: "Watch for file changes and rebuild automatically",
      default: false,
    })
    .option("minify", {
      type: "boolean",
      description: "Minify output (overrides dev mode)",
    })
    .option("scripts", {
      type: "array",
      description: "Specific scripts to build (default: all)",
      string: true,
    })
    .help()
    .alias("help", "h")
    .parse();

  const options: BuildOptions = {
    dev: argv.dev,
    watch: argv.watch,
    minify: argv.minify !== undefined ? argv.minify : !argv.dev,
    scripts: argv.scripts as string[] | undefined,
  };

  // Initial build
  await buildAll(options);

  // Watch mode
  if (options.watch) {
    watchMode(options);
  }
}

// Run if called directly
if (import.meta.main) {
  await main();
}

export { buildScript, buildAll, findUserscripts };
