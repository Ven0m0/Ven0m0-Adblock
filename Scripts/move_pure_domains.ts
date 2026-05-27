#!/usr/bin/env bun
/**
 * Move pure domain entries from adblock lists to hostlist files.
 * Pure domains are entries without AdGuard filter syntax (||, ##, $, @@, etc.)
 */

import { join, basename } from "node:path";
import { Glob } from "bun";
import { isValidDomain, readLines, writeLines } from "./common.ts";
import { rename, unlink } from "node:fs/promises";

export function isPureDomain(line: string): boolean {
    const trimmed = line.trim();

    // Skip empty lines, comments, and common adblock start patterns
    if (
        !trimmed ||
        trimmed.startsWith("!") ||
        trimmed.startsWith("#") ||
        trimmed.startsWith("[") ||
        trimmed.startsWith(";") ||
        trimmed.startsWith("|") ||
        trimmed.startsWith("@") ||
        trimmed.startsWith("$") ||
        trimmed.startsWith("^") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("]") ||
        trimmed.startsWith("~")
    ) {
        return false;
    }

    // Validate as domain
    return isValidDomain(trimmed);
}

// Compiled regex patterns for domain categorization
const ADS_PATTERN = /ad|ads|analytics|tracking|telemetry|metric/i;
const SOCIAL_PATTERN = /social|facebook|twitter|instagram/i;

export function categorizeDomain(domain: string, sourceFile: string): string {
    const domainLower = domain.toLowerCase();
    const sourceFileLower = sourceFile.toLowerCase();

    // Map based on source file name
    if (sourceFileLower.includes("spotify")) {
        return "Spotify.txt";
    }
    if (sourceFileLower.includes("youtube") || sourceFileLower.includes("twitch")) {
        return "Social-Media.txt";
    }
    if (sourceFileLower.includes("reddit") || sourceFileLower.includes("twitter")) {
        return "Social-Media.txt";
    }
    if (sourceFileLower.includes("game")) {
        return "Games.txt";
    }

    // Map based on domain content
    if (ADS_PATTERN.test(domainLower)) {
        return "Ads.txt";
    }
    if (SOCIAL_PATTERN.test(domainLower)) {
        return "Social-Media.txt";
    }
    return "Other.txt";
}

export async function scanAdblockFiles(adblockDir: string): Promise<{ domainMoves: Record<string, Record<string, string[]>>; fileUpdates: Record<string, string[]> }> {
    const domainMoves: Record<string, Record<string, string[]>> = {};
    const fileUpdates: Record<string, string[]> = {};

    const glob = new Glob("*.txt");
    const txtFiles: string[] = [];
    for await (const file of glob.scan({ cwd: adblockDir, absolute: true })) {
        txtFiles.push(file);
    }
    txtFiles.sort();

    for (const adblockFile of txtFiles) {
        const fileName = basename(adblockFile);
        console.log(`Scanning: ${fileName}`);
        const pureDomains: string[] = [];
        const filterRules: string[] = [];

        try {
            const file = Bun.file(adblockFile);
            const content = await file.text();
            for (const line of content.split(/\r?\n/)) {
                if (isPureDomain(line)) {
                    pureDomains.push(line.trim());
                } else {
                    filterRules.push(line);
                }
            }
        } catch (e: any) {
            console.error(`  Error reading: ${e.message || e}`);
            continue;
        }

        if (pureDomains.length > 0) {
            console.log(`  Found ${pureDomains.length} pure domains`);
            fileUpdates[adblockFile] = filterRules;

            for (const domain of pureDomains) {
                const targetFile = categorizeDomain(domain, fileName);
                if (!domainMoves[targetFile]) domainMoves[targetFile] = {};
                if (!domainMoves[targetFile][fileName]) domainMoves[targetFile][fileName] = [];
                domainMoves[targetFile][fileName].push(domain);
            }
        }
    }

    return { domainMoves, fileUpdates };
}

async function updateHostlists(hostlistDir: string, domainMoves: Record<string, Record<string, string[]>>): Promise<number> {
    let totalMoved = 0;

    console.log("\n" + "=".repeat(60));
    console.log("Appending domains to hostlist files");
    console.log("=".repeat(60) + "\n");

    const targetFiles = Object.keys(domainMoves).sort();
    for (const targetFile of targetFiles) {
        const sourceDomains = domainMoves[targetFile];
        const targetPath = join(hostlistDir, targetFile);
        const allDomains: string[] = [];

        // Collect all domains from different sources
        const sourceFiles = Object.keys(sourceDomains).sort();
        for (const sourceFile of sourceFiles) {
            allDomains.push(...sourceDomains[sourceFile]);
        }

        if (allDomains.length === 0) continue;

        // Read existing hostlist
        const existingDomains = new Set<string>();
        const targetFileHandle = Bun.file(targetPath);
        if (await targetFileHandle.exists()) {
            const lines = await readLines(targetPath);
            if (lines) {
                for (const line of lines) {
                    const stripped = line.trim();
                    // Only track pure domains, not regex patterns
                    if (stripped && isValidDomain(stripped)) {
                        existingDomains.add(stripped);
                    }
                }
            }
        }

        // Filter out duplicates
        const newDomains = allDomains.filter(d => !existingDomains.has(d));

        if (newDomains.length > 0) {
            // Append new domains
            newDomains.sort();
            if (await writeLines(targetPath, newDomains, "a")) {
                totalMoved += newDomains.length;
                console.log(`Appended ${newDomains.length} domains to ${targetFile}`);
            }
        }
    }

    return totalMoved;
}

async function updateSourceFiles(fileUpdates: Record<string, string[]>): Promise<void> {
    console.log("\n" + "=".repeat(60));
    console.log("Updating source adblock files");
    console.log("=".repeat(60) + "\n");

    for (const [filepath, newLines] of Object.entries(fileUpdates)) {
        const tmpPath = filepath + ".tmp";
        if (await writeLines(tmpPath, newLines)) {
            await rename(tmpPath, filepath);
            console.log(`Updated ${basename(filepath)}`);
        } else {
            const tmpFile = Bun.file(tmpPath);
            if (await tmpFile.exists()) {
                await unlink(tmpPath).catch(() => {});
            }
        }
    }
}

export async function applyUpdates(hostlistDir: string, domainMoves: Record<string, Record<string, string[]>>, fileUpdates: Record<string, string[]>): Promise<number> {
    const totalMoved = await updateHostlists(hostlistDir, domainMoves);
    await updateSourceFiles(fileUpdates);
    return totalMoved;
}

export async function main(): Promise<number> {
    const repoDir = join(import.meta.dir, "..");
    const adblockDir = join(repoDir, "lists", "adblock");
    const hostlistDir = join(repoDir, "lists", "hostlist");

    const adblockDirFile = Bun.file(adblockDir); // check dir exists - bun file handles this poorly, better to use stat
    const hostlistDirFile = Bun.file(hostlistDir);
    // bun doesn't have a direct fs.existsSync that is clean without node:fs. We can try to read a glob to see if it throws or just continue.

    console.log("=".repeat(60));
    console.log("Moving pure domain entries from adblock to hostlist");
    console.log("=".repeat(60) + "\n");

    // Extract pure domains from adblock files (read only)
    const { domainMoves, fileUpdates } = await scanAdblockFiles(adblockDir);

    if (Object.keys(domainMoves).length === 0) {
        console.log("\n✓ No pure domains found in adblock lists");
        return 0;
    }

    // Apply updates (write)
    const totalMoved = await applyUpdates(hostlistDir, domainMoves, fileUpdates);

    console.log("\n" + "=".repeat(60));
    console.log(`✓ Successfully moved ${totalMoved} pure domains to hostlist`);
    console.log("=".repeat(60));

    return 0;
}

if (import.meta.main) {
    process.exitCode = await main();
}
