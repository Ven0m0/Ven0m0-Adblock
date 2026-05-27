import { describe, expect, test } from "bun:test";
import { ADGUARD_INDICATORS } from "./common.ts";
import { isPureDomain } from "./move_pure_domains.ts";

describe("isPureDomain logic", () => {
    test("pure domains", () => {
        expect(isPureDomain("example.com")).toBe(true);
        expect(isPureDomain("sub.example.com")).toBe(true);
        expect(isPureDomain("valid-domain.co.uk")).toBe(true);
        expect(isPureDomain("abc.123.net")).toBe(true);
    });

    test("adguard indicators", () => {
        const baseDomain = "example.com";
        for (const indicator of ADGUARD_INDICATORS) {
            // Note: In original test this tested domain regex failing because of indicator
            expect(isPureDomain(`sub${indicator}.${baseDomain}`)).toBe(false);
        }
    });

    test("comments and special starts", () => {
        expect(isPureDomain("! comment")).toBe(false);
        expect(isPureDomain("# comment")).toBe(false);
        expect(isPureDomain("[Adblock Plus 2.0]")).toBe(false);
        expect(isPureDomain("; comment")).toBe(false);
    });

    test("invalid domains", () => {
        expect(isPureDomain("invalid_domain.com")).toBe(false); // underscore not allowed
        expect(isPureDomain("example")).toBe(false); // No TLD
        expect(isPureDomain("-example.com")).toBe(false);
    });

    test("complex rules", () => {
        expect(isPureDomain("||sub.example.com^")).toBe(false);
        expect(isPureDomain("sub.example.com##.ad")).toBe(false);
        expect(isPureDomain("@@||sub.example.com")).toBe(false);
    });
});
