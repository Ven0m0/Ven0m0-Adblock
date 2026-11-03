import { afterEach, describe, expect, test } from "bun:test";
import { loadUserscript, readScript } from "./harness.js";

const NAME = "yt-codec.user.js";
const loaded = [];
const load = (opts) => {
  const s = loadUserscript(NAME, { url: "https://www.youtube.com/watch?v=x", ...opts });
  loaded.push(s);
  return s;
};
afterEach(() => {
  for (const s of loaded.splice(0)) s.dispose();
});

const fmt = (mimeType) => ({ mimeType });
const AV1 = fmt('video/mp4; codecs="av01.0.08M.08"');
const VP9 = fmt('video/webm; codecs="vp09.00.10.08"');
const AVC = fmt('video/mp4; codecs="avc1.640028"');
const AUDIO = fmt('audio/mp4; codecs="mp4a.40.2"');
const player = (...adaptiveFormats) => ({ streamingData: { adaptiveFormats } });
const mimes = (pr) => pr.streamingData.adaptiveFormats.map((f) => f.mimeType);

const playerFetch = (body) => () =>
  Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));

describe("capability block", () => {
  test("runs without throwing and sets the guard", () => {
    const s = load();
    expect(s.error).toBeNull();
    expect(s.window.__yt_codec_pref__).toBe(1);
  });

  test("MediaSource.isTypeSupported rejects AV1 only", () => {
    const { window } = load();
    expect(window.MediaSource.isTypeSupported('video/mp4; codecs="av01.0.08M.08"')).toBe(false);
    expect(window.MediaSource.isTypeSupported('video/webm; codecs="vp9"')).toBe(true);
    expect(window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.640028"')).toBe(true);
  });

  test("canPlayType rejects AV1 only", () => {
    const { window } = load();
    const p = window.HTMLMediaElement.prototype;
    expect(p.canPlayType('video/mp4; codecs="av01.0.08M.08"')).toBe("");
    expect(p.canPlayType('video/webm; codecs="vp9"')).toBe("probably");
  });

  test("mediaCapabilities.decodingInfo rejects AV1 and passes the rest through", async () => {
    const s = load({
      setup: (w) => {
        w.navigator.mediaCapabilities = { decodingInfo: async () => ({ supported: true }) };
      }
    });
    const mc = s.window.navigator.mediaCapabilities;
    expect((await mc.decodingInfo({ video: { contentType: 'video/mp4; codecs="av01.0.08M.08"' } })).supported).toBe(
      false
    );
    expect((await mc.decodingInfo({ video: { contentType: 'video/webm; codecs="vp9"' } })).supported).toBe(true);
  });
});

describe("response steering", () => {
  test("ytInitialPlayerResponse: VP9 offered keeps VP9 and audio only", () => {
    const { window } = load();
    window.ytInitialPlayerResponse = player(AV1, VP9, AVC, AUDIO);
    expect(mimes(window.ytInitialPlayerResponse)).toEqual([VP9.mimeType, AUDIO.mimeType]);
  });

  test("ytInitialPlayerResponse: no VP9 falls back to AVC and drops AV1", () => {
    const { window } = load();
    window.ytInitialPlayerResponse = player(AV1, AVC, AUDIO);
    expect(mimes(window.ytInitialPlayerResponse)).toEqual([AVC.mimeType, AUDIO.mimeType]);
  });

  test("fetch of /youtubei/v1/player is steered", async () => {
    const { window } = load({ setup: (w) => (w.fetch = playerFetch(player(AV1, VP9, AVC, AUDIO))) });
    const res = await window.fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false");
    expect(mimes(await res.json())).toEqual([VP9.mimeType, AUDIO.mimeType]);
  });

  test("fetch of other URLs is untouched", async () => {
    const body = player(AV1, VP9, AVC, AUDIO);
    const { window } = load({ setup: (w) => (w.fetch = playerFetch(body)) });
    const res = await window.fetch("https://www.youtube.com/youtubei/v1/next");
    expect(mimes(await res.json())).toHaveLength(4);
  });

  test("does not steer toward VP9 when the browser cannot play it", () => {
    const { window } = load({
      setup: (w) => {
        w.MediaSource.isTypeSupported = (t) => !/vp0?9/i.test(t);
      }
    });
    window.ytInitialPlayerResponse = player(AV1, VP9, AVC, AUDIO);
    expect(mimes(window.ytInitialPlayerResponse)).toHaveLength(4);
  });
});

test("header: runs on YouTube but not on music.youtube.com", () => {
  const src = readScript(NAME);
  expect(src.match(/^\/\/ @(?:match|include)\s+.*music\.youtube\.com.*$/gm) ?? []).toEqual([]);
  expect(src).toMatch(/^\/\/ @match\s+https:\/\/www\.youtube\.com\/\*$/m);
  expect(src).toMatch(/^\/\/ @grant\s+none$/m);
});
