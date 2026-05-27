#!/usr/bin/env bun
/**
 * Deduplicate and optimize blocklist files
 * - Removes duplicates within files and across files
 * - Strips comments, empty lines, and trailing whitespace
 * - Sorts entries for better compression
 * - Validates domain syntax
 */

import { join, basename, dirname } from "node:path";
import { Glob } from "bun";
import { isValidDomain, writeLines } from "./common.ts";

const HEADER_PREFIXES = ["! ", "#", "[", ";"];

export class Stats {
    original = 0;
    headers = 0;
    final = 0;
    removed = 0;

    get compressionRatio(): number {
        return this.original > 0 ? (1 - this.final / this.original) * 100 : 0.0;
    }
}

export function isHeader(line: string): boolean {
    return !line || HEADER_PREFIXES.some(prefix => line.startsWith(prefix));
}

export function isValidRule(line: string): boolean {
    if (!line || line.length > 2048) {
        return false;
    }
    if (line.startsWith("||") || line.startsWith("@@||")) {
        const domain = line.split("^")[0].replace(/^\|\||^@@\|\|/, "");
        return isValidDomain(domain);
    }
    return true;
}

export function processContent(lines: Iterable<string>): { headers: string[]; rules: string[]; stats: Stats } {
    const stats = new Stats();
    const headers: string[] = [];
    const rulesWithComments: { rule: string; comments: string[] }[] = [];
    const seen = new Set<string>();
    let inHeader = true;
    let currentComments: string[] = [];

    for (const rawLine of lines) {
        stats.original++;
        const line = rawLine.trim();
        if (!line) {
            if (inHeader) {
                headers.push("");
            }
            continue;
        }

        if (isHeader(line)) {
            if (inHeader) {
                headers.push(line);
            } else {
                currentComments.push(line);
            }
        } else {
            inHeader = false;
            if (!seen.has(line) && isValidRule(line)) {
                seen.add(line);
                rulesWithComments.push({ rule: line, comments: currentComments });
                currentComments = [];
            } else {
                currentComments = [];
            }
        }
    }

    rulesWithComments.sort((a, b) => a.rule.localeCompare(b.rule, "en", { sensitivity: "base" }));

    const rules: string[] = [];
    for (const { rule, comments } of rulesWithComments) {
        rules.push(...comments);
        rules.push(rule);
    }

    stats.headers = headers.length;
    stats.final = headers.length + rules.length;
    stats.removed = stats.original - stats.final;

    return { headers, rules, stats };
}

export async function deduplicateFile(filepath: string): Promise<{ stats: Stats; rules: string[] }> {
    console.log(`Processing: ${filepath}`);

    try {
        const file = Bun.file(filepath);
        if (!(await file.exists())) {
            throw new Error(`ENOENT: no such file or directory, open '${filepath}'`);
        }
        const text = await file.text();
        const linesGen = text.split(/\r?\n/).map(line => line.trim());
        const { headers, rules, stats } = processContent(linesGen);

        const finalContent = [...headers, ...rules];
        if (await writeLines(filepath, finalContent)) {
            console.log(`  ${stats.original} → ${stats.final} lines (${stats.removed} removed, ${stats.compressionRatio.toFixed(1)}% reduction)`);
            return { stats, rules };
        }
        return { stats: new Stats(), rules: [] };
    } catch (e: any) {
        console.error(`  Error reading ${filepath}: ${e.message || e}`);
        return { stats: new Stats(), rules: [] };
    }
}

export function findCrossFileDuplicates(fileRules: Record<string, string[]>): Record<string, string[]> {
    const entryLocations: Record<string, string[]> = {};

    for (const [filename, rules] of Object.entries(fileRules)) {
        for (const rawRule of rules) {
            const rule = rawRule.trim();
            if (rule && !isHeader(rule)) { // Ignore comments in cross-file check
                if (!entryLocations[rule]) {
                    entryLocations[rule] = [];
                }
                entryLocations[rule].push(filename);
            }
        }
    }

    const duplicates: Record<string, string[]> = {};
    for (const [entry, files] of Object.entries(entryLocations)) {
        if (files.length > 1) {
            duplicates[entry] = files;
        }
    }
    return duplicates;
}

export async function main(): Promise<number> {
    const repoDir = join(import.meta.dir, "..");
    const args = process.argv.slice(2);
    const listsDir = args.length > 0 ? args[0] : join(repoDir, "lists");

    const listsDirFile = Bun.file(listsDir); // simple check if exists by checking if it throws on readdir? Bun doesn't have exist for dir.
    // Use glob to find files
    const glob = new Glob("**/*.txt");
    const txtFiles: string[] = [];
    try {
        for await (const file of glob.scan({ cwd: listsDir, absolute: true })) {
            txtFiles.push(file);
        }
    } catch (e) {
         console.error(`Error: Lists directory not found at ${listsDir}`);
         return 1;
    }

    txtFiles.sort();

    if (txtFiles.length === 0) {
        console.error("No .txt files found in lists directory");
        return 1;
    }

    console.log(`Found ${txtFiles.length} files\n`);

    const totalStats = new Stats();
    const fileRules: Record<string, string[]> = {};

    for (const filepath of txtFiles) {
        const { stats, rules } = await deduplicateFile(filepath);
        fileRules[basename(filepath)] = rules;
        totalStats.original += stats.original;
        totalStats.final += stats.final;
        totalStats.removed += stats.removed;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Total: ${totalStats.original} → ${totalStats.final} lines`);
    console.log(`Removed: ${totalStats.removed} (${totalStats.compressionRatio.toFixed(1)}% reduction)`);
    console.log(`\n${'='.repeat(60)}`);
    console.log("Checking for cross-file duplicates...");

    const duplicates = findCrossFileDuplicates(fileRules);

    if (Object.keys(duplicates).length > 0) {
        const fileGroups: Record<string, string[]> = {};
        for (const [entry, files] of Object.entries(duplicates)) {
            const sortedFiles = [...files].sort().join(", ");
            if (!fileGroups[sortedFiles]) fileGroups[sortedFiles] = [];
            fileGroups[sortedFiles].push(entry);
        }

        console.log(`Found ${Object.keys(duplicates).length} cross-file duplicates:\n`);
        const sortedGroups = Object.entries(fileGroups).sort(([a], [b]) => a.localeCompare(b));

        for (const [fileTuple, entries] of sortedGroups) {
            entries.sort();
            console.log(`${entries.length} entries in: ${fileTuple}`);
            for (const entry of entries.slice(0, 5)) {
                console.log(`  ${entry}`);
            }
            if (entries.length > 5) {
                console.log(`  ... and ${entries.length - 5} more`);
            }
        }
    } else {
        console.log("✓ No cross-file duplicates");
    }

    return 0;
}

if (import.meta.main) {
    process.exitCode = await main();
}
