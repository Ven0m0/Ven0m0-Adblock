import { afterEach, describe, expect, test } from "bun:test";
import { loadUserscript, readScript } from "./harness.js";

const NAME = "yt-music.user.js";
const URL_YTM = "https://music.youtube.com/";
const loaded = [];
const load = (opts) => {
  const s = loadUserscript(NAME, { url: URL_YTM, ...opts });
  loaded.push(s);
  return s;
};
afterEach(() => {
  for (const s of loaded.splice(0)) s.dispose();
});

const AAC = ['audio/mp4; codecs="mp4a.40.2"', "audio/aac", 'video/mp4; codecs="avc1.4d401e, mp4a.40.2"'];
const OTHER = ['audio/webm; codecs="opus"', 'video/webm; codecs="vp9"', 'video/mp4; codecs="avc1.4d401e"'];

describe("load", () => {
  test("runs with default config without throwing", () => {
    const s = load();
    expect(s.error).toBeNull();
    expect(s.window.__ytmusic_complete__).toBe(1);
    expect(s.calls.menu).toHaveLength(1);
  });

  test("runs at document-start before <head>/<body> exist", () => {
    expect(load({ noHead: true }).error).toBeNull();
  });

  test("load-event modules initialise without throwing", () => {
    const s = load();
    expect(() => s.window.fire("load")).not.toThrow();
    // LazyLoadingModule observes <body> for added nodes
    expect(s.calls.observed.map((o) => o.target)).toContain(s.document.body);
  });

  test("emergency disable key stops the script", () => {
    const s = load({ storage: { disable_ytmusic_complete: "1" } });
    expect(s.error).toBeNull();
    expect(s.calls.menu).toHaveLength(0);
    expect(s.calls.gmGet).toEqual([]);
  });

  test("duplicate-load guard stops a second instance", () => {
    const s = load({
      setup: (w) => {
        w.__ytmusic_complete__ = 1;
      }
    });
    expect(s.calls.menu).toHaveLength(0);
  });
});

describe("Opus codec preference", () => {
  test.each(AAC)("MediaSource.isTypeSupported rejects %s", (mime) => {
    expect(load().window.MediaSource.isTypeSupported(mime)).toBe(false);
  });

  test.each(OTHER)("MediaSource.isTypeSupported passes %s through", (mime) => {
    expect(load().window.MediaSource.isTypeSupported(mime)).toBe(true);
  });

  test("canPlayType rejects AAC and passes other types through with the element as this", () => {
    const seen = [];
    const s = load({
      setup: (w) => {
        w.HTMLMediaElement.prototype.canPlayType = function (mime) {
          seen.push([this, mime]);
          return "maybe";
        };
      }
    });
    const el = new s.window.HTMLMediaElement();
    for (const mime of AAC) expect(el.canPlayType(mime)).toBe("");
    for (const mime of OTHER) expect(el.canPlayType(mime)).toBe("maybe");
    expect(seen).toEqual(OTHER.map((mime) => [el, mime]));
  });

  test("non-string input is passed through", () => {
    expect(load().window.MediaSource.isTypeSupported(undefined)).toBe(true);
  });

  test("disabled via config leaves both APIs untouched", () => {
    const s = load({ gmValues: { ytm_opus_codec: false } });
    expect(s.window.MediaSource.isTypeSupported(AAC[0])).toBe(true);
    expect(new s.window.HTMLMediaElement().canPlayType(AAC[0])).toBe("probably");
  });

  test("works when MediaSource is unavailable", () => {
    const s = load({
      setup: (w) => {
        w.MediaSource = undefined;
      }
    });
    expect(s.error).toBeNull();
    expect(new s.window.HTMLMediaElement().canPlayType(AAC[0])).toBe("");
  });
});

describe("1.0.1 removals stay removed", () => {
  const REMOVED = ["ytm_auto_audio", "ytm_fix_releases"];
  const PANEL = "ytm-complete-settings";
  // Opens the settings panel and returns it followed by all its descendants, in document order
  const openPanel = (s) => {
    s.document.getElementById = (id) => s.document.body.children.find((c) => c.id === id) ?? null;
    s.calls.menu[0].fn();
    const walk = (n) => [n, ...n.children.flatMap(walk)];
    return walk(s.document.body.children.find((c) => c.id === PANEL));
  };

  test("removed modules do not appear in the source", () => {
    const gone = /ytm_auto_audio|ytm_fix_releases|AutoAudioModule|autoAudioMode|fixNewReleases|ytm-audio|ytm-releases/g;
    expect(readScript(NAME).match(gone) ?? []).toEqual([]);
  });

  test("removed GM keys are neither read at load nor written on save", () => {
    const s = load();
    const nodes = openPanel(s);
    for (const n of nodes) if (n.type === "checkbox") n.checked = true;
    nodes.find((n) => n.id === "ytm-save").onclick();
    expect(s.calls.gmGet.length).toBeGreaterThan(0);
    expect(s.calls.gmSet.sort()).toEqual([...s.calls.gmGet].sort());
    for (const k of REMOVED) {
      expect(s.calls.gmGet).not.toContain(k);
      expect(s.calls.gmSet).not.toContain(k);
    }
  });

  test("settings panel has no controls for removed modules", () => {
    const ids = openPanel(load())
      .map((n) => n.id)
      .filter((id) => id?.startsWith("ytm-") && id !== PANEL);
    expect(ids).toEqual(["ytm-opus", "ytm-autopause", "ytm-perf", "ytm-lazy", "ytm-ui", "ytm-save", "ytm-close"]);
  });

  // Regression: the panel was assigned through innerHTML, which YouTube's Trusted Types policy can reject.
  test("settings panel is built without innerHTML", () => {
    const [panel] = openPanel(load());
    expect(panel.innerHTML).toBeUndefined();
    expect(readScript(NAME)).not.toMatch(/.innerHTMLs*=/);
  });

  test("checkboxes reflect the stored config and Save writes the edited values", () => {
    const s = load({ gmValues: { ytm_opus_codec: false } });
    const nodes = openPanel(s);
    const opus = nodes.find((n) => n.id === "ytm-opus");
    expect(opus.checked).toBe(false);
    opus.checked = true;
    nodes.find((n) => n.id === "ytm-save").onclick();
    expect(s.gm.get("ytm_opus_codec")).toBe(true);
  });

  // Regression: createSettingsPanel had no "already open" guard, so each menu click appended another panel
  // with duplicate element ids (the second panel's Save/Close buttons are then dead).
  test("opening the settings panel twice does not duplicate it", () => {
    const s = load();
    openPanel(s);
    openPanel(s);
    expect(s.document.body.children.filter((c) => c.id === PANEL)).toHaveLength(1);
  });

  test("Close removes the panel", () => {
    const s = load();
    openPanel(s)
      .find((n) => n.id === "ytm-close")
      .onclick();
    expect(s.document.body.children).toHaveLength(0);
  });
});

describe("styles", () => {
  test("performance and UI styles are injected by default and skipped when disabled", () => {
    expect(load().calls.styles).toHaveLength(2);
    expect(load({ gmValues: { ytm_performance: false, ytm_ui_enhance: false } }).calls.styles).toHaveLength(0);
  });
});
