#!/usr/bin/env bun
/**
 * Automated Blocklist Updater for Ven0m0-Adblock
 * Downloads and updates filter lists from remote URLs, validates checksums,
 * and maintains source tracking metadata.
 */

import { parseArgs } from "util";
import { createHash } from "node:crypto";
import { mkdir, rm, rename, mkdtemp, unlink } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { sanitizeFilename } from "./common.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================
const SOURCES_CONFIG = "lists/sources-urls.json";
const DEFAULT_OUTPUT = "lists/sources";
const METADATA_FILE = "lists/sources-metadata.json";
const HEADER_PREFIXES = ["! ", "#", "["];
const TIMEOUT_MS = 60000;
const MAX_CONCURRENT = 10;

// ============================================================================
// LOGGING
// ============================================================================
const logger = {
    info: (msg: string) => console.log(`[${new Date().toLocaleTimeString('en-US', { hour12: false })}] INFO ${msg}`),
    warning: (msg: string) => console.warn(`[${new Date().toLocaleTimeString('en-US', { hour12: false })}] WARNING ${msg}`),
    error: (msg: string) => console.error(`[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ERROR ${msg}`),
};

// ============================================================================
// CHECKSUM VALIDATION
// ============================================================================

export function validateChecksum(content: string, name: string): boolean {
    const lines = content.split(/\r?\n/);
    let declaredChecksum = "";
    let dataStart = 0;

    for (let i = 0; i < Math.min(lines.length, 15); i++) {
        const line = lines[i].trim();
        const match = line.match(/^!\s*Checksum:\s*([\w+\/=]+)/i);
        if (match) {
            declaredChecksum = match[1];
            dataStart = i + 1;
            break;
        }
    }

    if (!declaredChecksum) {
        logger.warning(`No checksum found in ${name}`);
        return true; // No checksum to validate
    }

    const dataToHash = lines.slice(dataStart).join("\n") + (lines.length > dataStart ? "\n" : "");

    // Normalize newlines and encode to utf-8 before hashing
    const normalized = dataToHash.replace(/\r\n/g, "\n");
    const computedHash = createHash("md5").update(normalized, "utf-8").digest();

    // Encode to base64 and strip padding to match typical Adblock formatting
    const computedChecksum = computedHash.toString("base64").replace(/=+$/, "");

    if (declaredChecksum === computedChecksum) {
        logger.info(`✓ Checksum valid: ${name}`);
        return true;
    }

    logger.error(`✗ Checksum mismatch in ${name}: expected ${computedChecksum}, got ${declaredChecksum}`);
    return false;
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

export function countRules(content: string): number {
    let count = 0;
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const stripped = line.trim();
        if (stripped && !HEADER_PREFIXES.some(p => stripped.startsWith(p))) {
            count++;
        }
    }
    return count;
}

export async function processDownloadedFile(
    tempPath: string,
    url: string,
    filename: string,
    outputDir: string,
    skipChecksum = false
): Promise<string | null> {
    const destPath = join(outputDir, basename(filename));

    try {
        const file = Bun.file(tempPath);
        const content = await file.text();

        if (!skipChecksum) {
            const isValid = validateChecksum(content, filename);
            if (!isValid) {
                logger.warning(`Checksum validation failed for ${url}`);
                return null;
            }
        }

        if (content.length < 100) {
            logger.error(`Downloaded file suspiciously small (${content.length} bytes): ${url}`);
            return null;
        }

        const ruleCount = countRules(content);

        await Bun.write(destPath, content);
        logger.info(`✓ ${filename} (${ruleCount} rules)`);
        return destPath;
    } catch (e: any) {
        logger.error(`Error processing ${url}: ${e.message || e}`);
        return null;
    }
}

// ============================================================================
// ASYNC DOWNLOAD
// ============================================================================

export async function fetchList(
    url: string,
    filename: string,
    outputDir: string,
    skipChecksum = false
): Promise<[string, boolean]> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const headers = new Headers({
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
            "Accept": "text/plain,*/*",
        });

        const resp = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timeoutId);

        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
        }

        const tempDirPath = await mkdtemp(join(tmpdir(), "al-"));
        const tmpPath = join(tempDirPath, "tmp.txt");

        try {
            await Bun.write(tmpPath, resp);

            const result = await processDownloadedFile(tmpPath, url, filename, outputDir, skipChecksum);
            return [url, result !== null];
        } finally {
            await unlink(tmpPath).catch(() => {});
            await rm(tempDirPath, { recursive: true, force: true }).catch(() => {});
        }
    } catch (e: any) {
        if (e.name === 'AbortError') {
            logger.error(`✗ Timeout: ${url}`);
        } else {
            logger.error(`✗ Error for ${url}: ${e.message || e}`);
        }
    }

    return [url, false];
}

// ============================================================================
// SOURCE CONFIGURATION
// ============================================================================

export async function loadSources(configPath: string): Promise<Record<string, any>> {
    const file = Bun.file(configPath);
    if (!(await file.exists())) {
        logger.warning(`Config not found: ${configPath}, creating template`);
        const template = {
            sources: [
                {
                    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt",
                    filename: "uBlock-Filters.txt",
                    skip_checksum: false,
                    enabled: true,
                },
                {
                    url: "https://easylist.to/easylist/easylist.txt",
                    filename: "EasyList.txt",
                    skip_checksum: false,
                    enabled: true,
                },
            ]
        };
        await mkdir(dirname(configPath), { recursive: true });
        await Bun.write(configPath, JSON.stringify(template, null, 2) + "\n");
        logger.info(`Created template config: ${configPath}`);
    }

    const content = await Bun.file(configPath).text();
    const data = JSON.parse(content);
    const result: Record<string, any> = {};

    for (const src of (data.sources || [])) {
        if (src.enabled !== false) {
            result[src.url] = {
                filename: src.filename || sanitizeFilename(src.url),
                skip_checksum: src.skip_checksum || false,
                enabled: true,
            };
        }
    }
    return result;
}

export async function saveMetadata(
    sources: Record<string, any>,
    results: Record<string, boolean>,
    outputDir: string
): Promise<void> {
    const metadata = {
        last_updated: new Date().toISOString(),
        sources: {} as Record<string, any>,
    };

    for (const [url, config] of Object.entries(sources)) {
        metadata.sources[url] = {
            filename: config.filename,
            success: results[url] || false,
            checksum_validated: !config.skip_checksum,
        };
    }

    const metadataPath = METADATA_FILE;
    await Bun.write(metadataPath, JSON.stringify(metadata, null, 2) + "\n");
    logger.info(`Saved metadata: ${metadataPath}`);
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

export async function main(): Promise<number> {
    const { values } = parseArgs({
        args: Bun.argv,
        options: {
            config: {
                type: "string",
                default: SOURCES_CONFIG,
            },
            "output-dir": {
                type: "string",
                default: DEFAULT_OUTPUT,
            },
            "max-concurrent": {
                type: "string",
                default: String(MAX_CONCURRENT),
            },
            filter: {
                type: "string",
            },
            validate: {
                type: "boolean",
            },
        },
        strict: true,
        allowPositionals: true,
    });

    const outputDir = values["output-dir"] as string;
    const maxConcurrent = parseInt(values["max-concurrent"] as string, 10);
    const filter = values.filter as string | undefined;

    await mkdir(outputDir, { recursive: true });

    logger.info("Loading source configuration...");
    let sources = await loadSources(values.config as string);

    if (filter) {
        const filteredSources: Record<string, any> = {};
        for (const [url, cfg] of Object.entries(sources)) {
            if (url.toLowerCase().includes(filter.toLowerCase()) ||
                cfg.filename.toLowerCase().includes(filter.toLowerCase())) {
                filteredSources[url] = cfg;
            }
        }
        sources = filteredSources;
        logger.info(`Filtered to ${Object.keys(sources).length} sources matching '${filter}'`);
    }

    const sourceKeys = Object.keys(sources);
    if (sourceKeys.length === 0) {
        logger.error("No sources to update");
        return 1;
    }

    logger.info(`Updating ${sourceKeys.length} filter lists...`);

    const resultsDict: Record<string, boolean> = {};

    // Batch processing
    for (let i = 0; i < sourceKeys.length; i += maxConcurrent) {
        const batch = sourceKeys.slice(i, i + maxConcurrent);
        const tasks = batch.map(url => {
            const cfg = sources[url];
            return fetchList(url, cfg.filename, outputDir, cfg.skip_checksum);
        });

        const results = await Promise.all(tasks);
        for (const [url, success] of results) {
            resultsDict[url] = success;
        }
    }

    const successCount = Object.values(resultsDict).filter(Boolean).length;
    await saveMetadata(sources, resultsDict, outputDir);

    logger.info(`✓ Updated ${successCount}/${sourceKeys.length} lists successfully`);

    if (values.validate) {
        try {
            logger.info("Running AGLint validation...");
            // Run bun x aglint path/to/files/*.txt
            const proc = Bun.spawn(["bun", "x", "aglint", `${outputDir}/*.txt`], {
                stdout: "pipe",
                stderr: "pipe",
            });
            const exitCode = await proc.exited;
            if (exitCode !== 0) {
                logger.warning("AGLint found issues (non-blocking)");
            }
        } catch (e: any) {
            logger.warning(`Could not run AGLint: ${e.message || e}`);
        }
    }

    return successCount === sourceKeys.length ? 0 : 1;
}

if (import.meta.main) {
    process.exitCode = await main();
}
