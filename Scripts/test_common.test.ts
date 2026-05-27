import { describe, expect, test, spyOn, afterEach } from "bun:test";
import { sanitizeFilename, isValidDomain, readLines, writeLines } from "./common.ts";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";

describe("Common utilities", () => {
    describe("sanitizeFilename", () => {
        test("with name", () => {
            expect(sanitizeFilename("http://example.com", "My List")).toBe("My-List.txt");
            expect(sanitizeFilename("http://example.com", "My List.txt")).toBe("My-List.txt");
            expect(sanitizeFilename("http://example.com", "safe-name")).toBe("safe-name.txt");
        });

        test("without name", () => {
            const url = "https://example.com/list.txt";
            const filename = sanitizeFilename(url);
            expect(filename.startsWith("example-com-")).toBe(true);
            expect(filename.endsWith(".txt")).toBe(true);
            const expectedHash = createHash("sha256").update(url, "utf-8").digest("hex").slice(0, 12);
            expect(filename.includes(expectedHash)).toBe(true);
        });

        test("with name special chars", () => {
            expect(sanitizeFilename("http://example.com", "My!@#$%^&*()_+=List")).toBe("My----------_--List.txt");
            expect(sanitizeFilename("http://example.com", 'a/b\\c:d*e?f"g<h>i|j')).toBe("a-b-c-d-e-f-g-h-i-j.txt");
            expect(sanitizeFilename("http://example.com", "My List.txt")).toBe("My-List.txt");
            expect(sanitizeFilename("http://example.com", "a/b.txt")).toBe("a-b.txt");
            expect(sanitizeFilename("http://example.com", "c.txt.txt")).toBe("c.txt.txt");
        });

        test("without name special urls", () => {
            // Missing scheme (no ://) -> fallback to "list" part
            const url1 = "example.com/list.txt";
            const filename1 = sanitizeFilename(url1);
            expect(filename1.startsWith("list-")).toBe(true);
            expect(filename1.endsWith(".txt")).toBe(true);

            // Empty string
            const url2 = "";
            const filename2 = sanitizeFilename(url2);
            expect(filename2.startsWith("list-")).toBe(true);

            // URL with port
            const url3 = "http://example.com:8080/list.txt";
            const filename3 = sanitizeFilename(url3);
            expect(filename3.startsWith("example-com-8080-")).toBe(true);
        });
    });

    describe("isValidDomain", () => {
        test("valid domains", () => {
            expect(isValidDomain("example.com")).toBe(true);
            expect(isValidDomain("sub.example.com")).toBe(true);
            expect(isValidDomain("my-domain.co.uk")).toBe(true);
        });

        test("invalid domains", () => {
            expect(isValidDomain("invalid")).toBe(false);
            expect(isValidDomain("-start.com")).toBe(false);
            expect(isValidDomain("end-.com")).toBe(false);
            expect(isValidDomain("http://example.com")).toBe(false);
        });
    });

    describe("readLines", () => {
        let tempDir: string;

        test("read valid file", async () => {
            tempDir = await mkdtemp(join(tmpdir(), "bun-test-"));
            const targetFile = join(tempDir, "test.txt");
            await Bun.write(targetFile, "line1 \nline2\r\nline3");
            const lines = await readLines(targetFile);
            expect(lines).toEqual(["line1", "line2", "line3"]);
            await rm(tempDir, { recursive: true, force: true });
        });

        test("file not found", async () => {
            tempDir = await mkdtemp(join(tmpdir(), "bun-test-"));
            const nonExistent = join(tempDir, "missing.txt");
            const originalConsoleError = console.error;
            let capturedError = "";
            console.error = (msg) => { capturedError = msg; };

            const lines = await readLines(nonExistent);
            expect(lines).toBeNull();
            expect(capturedError.includes("Error reading")).toBe(true);

            console.error = originalConsoleError;
            await rm(tempDir, { recursive: true, force: true });
        });
    });

    describe("writeLines", () => {
        let tempDir: string;

        afterEach(async () => {
            if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => {});
        });

        test("atomic write and append", async () => {
            tempDir = await mkdtemp(join(tmpdir(), "bun-test-"));
            const targetFile = join(tempDir, "target.txt");

            // Test write
            let result = await writeLines(targetFile, ["line1", "line2"]);
            expect(result).toBe(true);
            expect(await Bun.file(targetFile).text()).toBe("line1\nline2\n");

            // Test atomic overwrite
            result = await writeLines(targetFile, ["line3", "line4"]);
            expect(result).toBe(true);
            expect(await Bun.file(targetFile).text()).toBe("line3\nline4\n");

            // Test append
            result = await writeLines(targetFile, ["line5"], "a");
            expect(result).toBe(true);
            expect(await Bun.file(targetFile).text()).toBe("line3\nline4\nline5\n");
        });
    });
});
