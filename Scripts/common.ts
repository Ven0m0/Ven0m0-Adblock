/**
 * Common utilities and constants for Ven0m0-Adblock scripts.
 */

import { createHash } from "node:crypto";
import { open, mkdtemp, unlink, rename, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

// Regex to match pure domain names (basic validation)
// RFC 1035: labels limited to 63 chars, start with alphanumeric, end with alphanumeric
// This regex is a simplified version commonly used in adblock lists
export const DOMAIN_PATTERN = /^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?(?:\.[a-z0-9](?:[-a-z0-9]*[a-z0-9])?)*\.[a-z]{2,}$/i;

// AdGuard syntax indicators - if a line contains these, it's NOT a pure domain
export const ADGUARD_INDICATORS = [
    "||",
    "##",
    "#@#",
    "#?#",
    "@@",
    "$",
    "^",
    "*",
    "!",
    "[",
    "]",
    "##.",
    "###",
    "##:",
    "~",
    "|",
];

/** Check if a string is a valid domain name. */
export function isValidDomain(domain: string): boolean {
    return DOMAIN_PATTERN.test(domain);
}

/** Generate safe filename from URL or provided name. */
export function sanitizeFilename(url: string, name?: string | null): string {
    if (name) {
        const safe = name.replace(/[^\w\-.]/g, "-");
        return safe.endsWith(".txt") ? safe : `${safe}.txt`;
    }

    // Use SHA-256 here for filename generation.
    // This hash is for stable naming only and is not used for security purposes.
    const urlHash = createHash("sha256").update(url, "utf-8").digest("hex").slice(0, 12);
    const domainMatch = url.match(/:\/\/([^\/]+)/);
    const domainPart = domainMatch
        ? domainMatch[1].replace(/\./g, "-").replace(/:/g, "-")
        : "list";
    return `${domainPart}-${urlHash}.txt`;
}

/** Read lines from file. Returns null on error. */
export async function readLines(filepath: string): Promise<string[] | null> {
    try {
        const file = Bun.file(filepath);
        if (!(await file.exists())) {
            throw new Error(`ENOENT: no such file or directory, open '${filepath}'`);
        }
        const content = await file.text();
        return content.split(/\r?\n/).map(line => line.trimEnd());
    } catch (e: any) {
        console.error(`  Error reading ${filepath}: ${e}`);
        return null;
    }
}

/** Write lines to file. Returns true on success. */
export async function writeLines(filepath: string, lines: string[], mode: "w" | "a" = "w"): Promise<boolean> {
    try {
        const content = lines.length ? lines.join("\n") + "\n" : "";
        if (mode === "a") {
            const file = Bun.file(filepath);
            let existing = "";
            if (await file.exists()) {
                existing = await file.text();
            }
            await Bun.write(filepath, existing + content);
            return true;
        }

        // Write to a temporary file in the same directory to ensure atomic replace
        // handles cross-device link issues
        const dir = dirname(filepath);
        const tempDirPath = await mkdtemp(join(dir, "tmp-"));
        const tempPath = join(tempDirPath, "tmp.txt");

        try {
            await Bun.write(tempPath, content);
            await rename(tempPath, filepath);
            await rm(tempDirPath, { recursive: true, force: true });
            return true;
        } catch (e) {
            await unlink(tempPath).catch(() => {});
            await rm(tempDirPath, { recursive: true, force: true }).catch(() => {});
            throw e;
        }
    } catch (e: any) {
        console.error(`  Error writing ${filepath}: ${e}`);
        return false;
    }
}
