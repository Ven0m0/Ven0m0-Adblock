import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { isPureDomain, categorizeDomain, applyUpdates } from "./move_pure_domains.ts";

describe("Move Pure Domains script", () => {
    describe("isPureDomain", () => {
        test("valid pure domains", () => {
            const validDomains = [
                "www.example.com",
                "sub.example.com",
                "test.co.uk",
                "very.long.domain.name.with.many.parts.org",
                "example.com",
                "a-b.com",
                "123.com",
            ];
            for (const domain of validDomains) {
                expect(isPureDomain(domain)).toBe(true);
            }
        });

        test("adguard syntax and invalid domains", () => {
            const invalidLines = [
                "||example.com^",
                "@@||example.com",
                "example.com$script",
                "##.ad-class",
                "example.com##.ad",
                "! Comment",
                "[Adblock Plus 2.0]",
                "|http://example.com",
                "example.com#@#.ad",
                "/pattern/",
                "http://example.com",  // URL, not pure domain
                "https://example.com", // URL
                "",
                "   ",
                "-start-dash.com",
                "example.c", // 1 char TLD
                "example.123" // numeric TLD
            ];
            for (const line of invalidLines) {
                expect(isPureDomain(line)).toBe(false);
            }
        });
    });

    describe("categorizeDomain", () => {
        test("source file matching", () => {
            expect(categorizeDomain("example.com", "spotify_filters.txt")).toBe("Spotify.txt");
            expect(categorizeDomain("example.com", "YouTube-Ads.txt")).toBe("Social-Media.txt");
            expect(categorizeDomain("example.com", "twitch_adblock.txt")).toBe("Social-Media.txt");
            expect(categorizeDomain("example.com", "reddit_promoted.txt")).toBe("Social-Media.txt");
            expect(categorizeDomain("example.com", "TWITTER.txt")).toBe("Social-Media.txt");
            expect(categorizeDomain("example.com", "game_servers.txt")).toBe("Games.txt");
        });

        test("domain keyword matching (Ads)", () => {
            expect(categorizeDomain("ad.example.com", "unknown.txt")).toBe("Ads.txt");
            expect(categorizeDomain("google-ads.com", "unknown.txt")).toBe("Ads.txt");
            expect(categorizeDomain("analytics.google.com", "unknown.txt")).toBe("Ads.txt");
            expect(categorizeDomain("tracking.example.net", "unknown.txt")).toBe("Ads.txt");
            expect(categorizeDomain("telemetry.microsoft.com", "unknown.txt")).toBe("Ads.txt");
            expect(categorizeDomain("metrics.apple.com", "unknown.txt")).toBe("Ads.txt");
        });

        test("domain keyword matching (Social)", () => {
            expect(categorizeDomain("social.network.com", "unknown.txt")).toBe("Social-Media.txt");
            expect(categorizeDomain("api.facebook.com", "unknown.txt")).toBe("Social-Media.txt");
            expect(categorizeDomain("cdn.twitter.com", "unknown.txt")).toBe("Social-Media.txt");
            expect(categorizeDomain("instagram-images.net", "unknown.txt")).toBe("Social-Media.txt");
        });

        test("fallback category", () => {
            expect(categorizeDomain("example.com", "unknown.txt")).toBe("Other.txt");
            expect(categorizeDomain("randomsite.org", "filter.txt")).toBe("Other.txt");
        });
    });

    describe("applyUpdates", () => {
        let tempDir: string;
        let originalStdoutWrite: typeof process.stdout.write;

        beforeEach(() => {
            originalStdoutWrite = process.stdout.write;
            process.stdout.write = () => true;
            console.log = () => {};
        });

        afterEach(async () => {
            process.stdout.write = originalStdoutWrite;
            if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => {});
        });

        test("basic apply", async () => {
            tempDir = await mkdtemp(join(tmpdir(), "bun-test-"));
            const hostlistDir = join(tempDir, "hostlist");
            const adblockDir = join(tempDir, "adblock");
            await mkdir(hostlistDir);
            await mkdir(adblockDir);

            const targetPath = join(hostlistDir, "Other.txt");
            await Bun.write(targetPath, "existing.com\n");

            const sourcePath = join(adblockDir, "test_list.txt");
            await Bun.write(sourcePath, "domain1.com\ndomain2.com\n||ad.com^\n");

            const domainMoves = {
                "Other.txt": { "test_list.txt": ["domain1.com", "domain2.com"] }
            };
            const fileUpdates = { [sourcePath]: ["||ad.com^"] };

            const totalMoved = await applyUpdates(hostlistDir, domainMoves, fileUpdates);

            expect(totalMoved).toBe(2);
            expect(await Bun.file(targetPath).text()).toBe("existing.com\ndomain1.com\ndomain2.com\n");
            expect(await Bun.file(sourcePath).text()).toBe("||ad.com^\n");
        });

        test("deduplication", async () => {
            tempDir = await mkdtemp(join(tmpdir(), "bun-test-"));
            const hostlistDir = join(tempDir, "hostlist");
            const adblockDir = join(tempDir, "adblock");
            await mkdir(hostlistDir);
            await mkdir(adblockDir);

            const targetPath = join(hostlistDir, "Other.txt");
            await Bun.write(targetPath, "existing.com\n");

            const sourcePath = join(adblockDir, "test_list.txt");
            await Bun.write(sourcePath, "existing.com\nnew.com\n");

            const domainMoves = {
                "Other.txt": { "test_list.txt": ["existing.com", "new.com"] }
            };
            const fileUpdates = { [sourcePath]: [] };

            const totalMoved = await applyUpdates(hostlistDir, domainMoves, fileUpdates);

            expect(totalMoved).toBe(1);
            expect(await Bun.file(targetPath).text()).toBe("existing.com\nnew.com\n");
        });
    });
});
