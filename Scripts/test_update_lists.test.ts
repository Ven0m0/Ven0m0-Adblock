import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { countRules, validateChecksum, loadSources, saveMetadata } from "./update_lists.ts";
import { createHash } from "node:crypto";

describe("Update Lists script", () => {
    describe("countRules", () => {
        test("empty content", () => {
            expect(countRules("")).toBe(0);
        });

        test("only headers", () => {
            const content = "! Header 1\n! Header 2\n# Comment\n[Adblock Plus]\n";
            expect(countRules(content)).toBe(0);
        });

        test("mixed content", () => {
            const content = `! Header
||example.com^
example.com##.ad
domain.com
# Another comment
||ads.example.com^
`;
            expect(countRules(content)).toBe(4);
        });

        test("empty lines and whitespace", () => {
            const content = "rule1.com\n\nrule2.com\n\n";
            expect(countRules(content)).toBe(2);

            const content2 = "rule1.com\r\nrule2.com\r\n";
            expect(countRules(content2)).toBe(2);

            const content3 = "rule1.com\n   \n\trule2.com\n";
            expect(countRules(content3)).toBe(2);
        });
    });

    describe("validateChecksum", () => {
        test("valid checksum", () => {
            const rulesContent = "! Title\n||example.com^";
            const hash = createHash("md5").update(rulesContent + "\n", "utf-8").digest();
            const checksum = hash.toString("base64").replace(/=+$/, "");

            const content = `! Checksum: ${checksum}\n${rulesContent}`;
            expect(validateChecksum(content, "test.txt")).toBe(true);
        });

        test("invalid checksum", () => {
            const content = "! Checksum: invalidbase64\n! Title\n||example.com^";
            expect(validateChecksum(content, "test.txt")).toBe(false);
        });

        test("no checksum", () => {
            const content = "! Title\n||example.com^";
            expect(validateChecksum(content, "test.txt")).toBe(true); // Should pass if no checksum found
        });
    });

    describe("loadSources", () => {
        let tempDir: string;
        let originalConsoleInfo: typeof console.log;
        let originalConsoleWarn: typeof console.warn;

        beforeEach(() => {
            originalConsoleInfo = console.log;
            originalConsoleWarn = console.warn;
            console.log = () => {};
            console.warn = () => {};
        });

        afterEach(async () => {
            console.log = originalConsoleInfo;
            console.warn = originalConsoleWarn;
            if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => {});
        });

        test("template creation", async () => {
            tempDir = await mkdtemp(join(tmpdir(), "bun-test-"));
            const configPath = join(tempDir, "sources-urls.json");

            const sources = await loadSources(configPath);
            expect(Object.keys(sources).length).toBeGreaterThan(0);
            expect(await Bun.file(configPath).exists()).toBe(true);
        });

        test("existing config", async () => {
            tempDir = await mkdtemp(join(tmpdir(), "bun-test-"));
            const configPath = join(tempDir, "sources-urls.json");

            const configData = {
                sources: [
                    {
                        url: "https://example.com/list1.txt",
                        filename: "custom-name.txt",
                        skip_checksum: true,
                        enabled: true,
                    },
                    {
                        url: "https://example.com/list2.txt",
                        enabled: false,
                    },
                    {
                        url: "https://example.com/list3.txt",
                        enabled: true,
                    },
                ]
            };

            await Bun.write(configPath, JSON.stringify(configData));
            const sources = await loadSources(configPath);

            expect(Object.keys(sources).length).toBe(2);
            expect(sources["https://example.com/list1.txt"].filename).toBe("custom-name.txt");
            expect(sources["https://example.com/list1.txt"].skip_checksum).toBe(true);
            expect(sources["https://example.com/list3.txt"]).toBeDefined();
        });
    });
});
