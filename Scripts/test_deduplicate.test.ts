import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import {
    main,
    processContent,
    isHeader,
    isValidRule,
    findCrossFileDuplicates,
    deduplicateFile,
    Stats
} from "./deduplicate.ts";

describe("Deduplicate script", () => {
    describe("processContent", () => {
        test("keeps comments", () => {
            const lines = [
                "! Header line 1",
                "! Header line 2",
                "rule1.com",
                "! Comment for rule2",
                "rule2.com",
                "! Comment for rule3",
                "rule3.com",
                "! Another comment for rule3",
                "rule3.com",
                "! Comment for rule4",
                "rule4.com",
            ];

            const { headers, rules, stats } = processContent(lines);

            const expectedHeaders = ["! Header line 1", "! Header line 2"];

            const expectedRules = [
                "rule1.com",
                "! Comment for rule2",
                "rule2.com",
                "! Comment for rule3",
                "rule3.com",
                "! Comment for rule4",
                "rule4.com",
            ];

            expect(headers).toEqual(expectedHeaders);
            expect(rules).toEqual(expectedRules);
        });
    });

    describe("isHeader", () => {
        test("identifies headers", () => {
            expect(isHeader("! This is a comment")).toBe(true);
            expect(isHeader("# This is also a comment")).toBe(true);
            expect(isHeader("[Adblock Plus 2.0]")).toBe(true);
            expect(isHeader("; Semicolon comment")).toBe(true);
            expect(isHeader("")).toBe(true);

            expect(isHeader("||example.com^")).toBe(false);
            expect(isHeader("example.com##.ad")).toBe(false);
            expect(isHeader("example.com")).toBe(false);
            expect(isHeader("@@||example.com")).toBe(false);
        });
    });

    describe("isValidRule", () => {
        test("identifies valid rules", () => {
            expect(isValidRule("example.com")).toBe(true);
            expect(isValidRule("||example.com^")).toBe(true);
            expect(isValidRule("@@||example.com")).toBe(true);
            expect(isValidRule("example.com$domain=example.com")).toBe(true);
            expect(isValidRule("||example.com^$important")).toBe(true);

            expect(isValidRule("")).toBe(false);
            expect(isValidRule("a".repeat(2049))).toBe(false);
            expect(isValidRule("a".repeat(2048))).toBe(true);

            expect(isValidRule("||invalid^")).toBe(false);
            expect(isValidRule("||-start.com^")).toBe(false);
            expect(isValidRule("||end-.com^")).toBe(false);
        });
    });

    describe("findCrossFileDuplicates", () => {
        test("finds duplicates", () => {
            const fileRules = {
                "file1.txt": ["rule1.com", "rule2.com", "  rule3.com  "],
                "file2.txt": ["rule2.com", "rule4.com"],
                "file3.txt": ["rule3.com", "rule5.com", "  "],
            };

            const duplicates = findCrossFileDuplicates(fileRules);

            const expected = {
                "rule2.com": ["file1.txt", "file2.txt"],
                "rule3.com": ["file1.txt", "file3.txt"],
            };

            expect(duplicates).toEqual(expected);
            expect(findCrossFileDuplicates({ "f1": ["a"], "f2": ["b"] })).toEqual({});
            expect(findCrossFileDuplicates({})).toEqual({});
        });
    });

    describe("main function", () => {
        let tempDir: string;
        let originalArgv: string[];
        let originalStdoutWrite: typeof process.stdout.write;
        let originalStderrWrite: typeof process.stderr.write;

        beforeEach(() => {
            originalArgv = process.argv;
            originalStdoutWrite = process.stdout.write;
            originalStderrWrite = process.stderr.write;

            // Silence console during tests
            process.stdout.write = () => true;
            process.stderr.write = () => true;
            console.log = () => {};
            console.error = () => {};
        });

        afterEach(async () => {
            process.argv = originalArgv;
            process.stdout.write = originalStdoutWrite;
            process.stderr.write = originalStderrWrite;
            if (tempDir) {
                await rm(tempDir, { recursive: true, force: true }).catch(() => {});
            }
        });

        test("valid directory", async () => {
            tempDir = await mkdtemp(join(tmpdir(), "bun-test-"));

            const file1 = join(tempDir, "file1.txt");
            await Bun.write(file1, "rule1.com\nrule1.com\nrule2.com\n");

            const file2 = join(tempDir, "file2.txt");
            await Bun.write(file2, "rule2.com\nrule3.com\n");

            process.argv = ["bun", "deduplicate.ts", tempDir];
            const result = await main();

            expect(result).toBe(0);
            expect(await Bun.file(file1).text()).toBe("rule1.com\nrule2.com\n");
            expect(await Bun.file(file2).text()).toBe("rule2.com\nrule3.com\n");
        });

        test("directory not found", async () => {
            tempDir = await mkdtemp(join(tmpdir(), "bun-test-"));
            const nonExistent = join(tempDir, "nonexistent");

            let stderrOutput = "";
            process.stderr.write = (chunk: any) => { stderrOutput += chunk; return true; };
            console.error = (msg: string) => { stderrOutput += msg + "\n"; };

            process.argv = ["bun", "deduplicate.ts", nonExistent];
            const result = await main();

            expect(result).toBe(1);
            expect(stderrOutput).toContain("Lists directory not found");
        });

        test("no txt files", async () => {
            tempDir = await mkdtemp(join(tmpdir(), "bun-test-"));
            const file1 = join(tempDir, "file1.log");
            await Bun.write(file1, "rule1.com\n");

            let stderrOutput = "";
            process.stderr.write = (chunk: any) => { stderrOutput += chunk; return true; };
            console.error = (msg: string) => { stderrOutput += msg + "\n"; };

            process.argv = ["bun", "deduplicate.ts", tempDir];
            const result = await main();

            expect(result).toBe(1);
            expect(stderrOutput).toContain("No .txt files found");
        });
    });
});
