// ─── Carousel Unit Tests ──────────────────────────────────────
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.useFakeTimers();

import { ImageCarousel } from "./main.js";

describe("ImageCarousel", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.clearAllTimers();
    ImageCarousel.loop.set({ index: 0, prevIndex: 0, auto: true });
  });

  afterEach(() => {
    container.remove();
    vi.clearAllTimers();
  });

  // ── Helpers ──────────────────────────────────────────────

  async function flush() {
    await Promise.resolve();
    vi.advanceTimersByTime(16);
    await Promise.resolve();
  }

  function state() {
    return ImageCarousel.loop.get();
  }

  function btn(text) {
    return Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === text,
    );
  }

  /** Get the "to" (current/fading-in) image layer. */
  function toLayer() {
    return Array.from(container.querySelectorAll("div[role='img']")).find(
      (el) => el.style?.zIndex === "2",
    );
  }

  /** Get the "from" (previous/fading-out) image layer. */
  function fromLayer() {
    return Array.from(container.querySelectorAll("div[role='img']")).find(
      (el) => el.style?.zIndex === "1",
    );
  }

  function bgUrl(el) {
    const bg = el?.style?.backgroundImage || "";
    return bg
      .replace(/url\(["']?/, "")
      .replace(/["']?\)/, "")
      .trim();
  }

  function dots() {
    return Array.from(container.querySelectorAll("button")).filter(
      (b) => b.style?.width === "10px" && b.style?.borderRadius === "50%",
    );
  }

  // ── Rendering ────────────────────────────────────────────

  it("renders without blank — to-layer has background-image", async () => {
    ImageCarousel.mount(container);
    await flush();
    expect(toLayer()).not.toBeNull();
    expect(bgUrl(toLayer())).toContain("picsum.photos");
  });

  it("skeleton shimmer is behind all layers (z-index:0)", async () => {
    ImageCarousel.mount(container);
    await flush();
    const stage = container.querySelector("div[style*='aspect-ratio']");
    const skel = stage?.querySelector?.("div[style*='up-shimmer']");
    expect(skel).not.toBeNull();
    expect(skel?.style?.zIndex).toBe("0");
  });

  it("to-layer sits at z-index:2 (above from-layer at z-index:1)", async () => {
    ImageCarousel.mount(container);
    await flush();
    expect(toLayer()?.style?.zIndex).toBe("2");
  });

  it("container has fixed aspect-ratio 2/1", async () => {
    ImageCarousel.mount(container);
    await flush();
    const stage = container.querySelector("div[style*='aspect-ratio']");
    expect(stage?.style?.aspectRatio).toBe("2/1");
  });

  // ── Cross-fade ───────────────────────────────────────────

  it("only to-layer renders on first mount (no from-layer)", async () => {
    ImageCarousel.mount(container);
    await flush();
    expect(toLayer()).not.toBeNull();
    expect(fromLayer()).toBeUndefined(); // prevIndex === index
  });

  it("both layers render during transition (prevIndex !== index)", async () => {
    ImageCarousel.mount(container);
    await flush();
    expect(fromLayer()).toBeUndefined();

    btn("›")?.click();
    await flush();
    // Now index=1, prevIndex=0 — both layers should exist
    expect(toLayer()).not.toBeNull();
    expect(fromLayer()).not.toBeNull();
  });

  it("from-layer has fade-out animation", async () => {
    ImageCarousel.mount(container);
    await flush();
    btn("›")?.click();
    await flush();
    expect(fromLayer()?.style?.animation).toContain("carousel-fade-out");
  });

  it("to-layer has fade-in animation", async () => {
    ImageCarousel.mount(container);
    await flush();
    expect(toLayer()?.style?.animation).toContain("carousel-fade-in");
  });

  it("to-layer shows next image after transition", async () => {
    ImageCarousel.mount(container);
    await flush();
    expect(bgUrl(toLayer())).toContain("picsum.photos/seed/a/");

    btn("›")?.click();
    await flush();
    expect(bgUrl(toLayer())).toContain("picsum.photos/seed/b/");
    const from = fromLayer();
    expect(from).not.toBeUndefined();
    expect(bgUrl(from)).toContain("picsum.photos/seed/a/");
  });

  // ── Navigation ───────────────────────────────────────────

  it("prev and next buttons exist", async () => {
    ImageCarousel.mount(container);
    await flush();
    expect(btn("‹")).not.toBeUndefined();
    expect(btn("›")).not.toBeUndefined();
  });

  it("clicking next advances slide index", async () => {
    ImageCarousel.mount(container);
    await flush();
    expect(state().index).toBe(0);
    btn("›")?.click();
    await flush();
    expect(state().index).toBe(1);
  });

  it("clicking prev wraps around to last slide", async () => {
    ImageCarousel.mount(container);
    await flush();
    btn("‹")?.click();
    await flush();
    expect(state().index).toBe(3);
  });

  it("clicking prev/next stores prevIndex", async () => {
    ImageCarousel.mount(container);
    await flush();
    btn("›")?.click();
    await flush();
    expect(state().index).toBe(1);
    expect(state().prevIndex).toBe(0);
  });

  it("clicking prev/next disables auto", async () => {
    ImageCarousel.mount(container);
    await flush();
    expect(state().auto).toBe(true);
    btn("›")?.click();
    await flush();
    expect(state().auto).toBe(false);
  });

  // ── Auto-play logic ──────────────────────────────────────

  it("tick advances index when auto is true, wraps at end", async () => {
    ImageCarousel.mount(container);
    await flush();
    expect(state().index).toBe(0);
    expect(state().auto).toBe(true);
    ImageCarousel.loop.send("tick");
    await flush();
    expect(state().index).toBe(1);
    ImageCarousel.loop.send("tick");
    await flush();
    expect(state().index).toBe(2);
    ImageCarousel.loop.send("tick");
    await flush();
    expect(state().index).toBe(3);
    ImageCarousel.loop.send("tick");
    await flush();
    expect(state().index).toBe(0);
  });

  it("tick does NOT advance when auto is false", async () => {
    ImageCarousel.mount(container);
    await flush();
    ImageCarousel.loop.send("toggleAuto");
    await flush();
    expect(state().auto).toBe(false);
    const idx = state().index;
    ImageCarousel.loop.send("tick");
    await flush();
    expect(state().index).toBe(idx);
  });

  it("pause button toggles auto, changes label", async () => {
    ImageCarousel.mount(container);
    await flush();
    expect(state().auto).toBe(true);
    const hasBtn = (txt) =>
      Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes(txt),
      );
    hasBtn("Pause")?.click();
    await flush();
    expect(state().auto).toBe(false);
    expect(hasBtn("Play")).not.toBeUndefined();
    hasBtn("Play")?.click();
    await flush();
    expect(state().auto).toBe(true);
    expect(hasBtn("Pause")).not.toBeUndefined();
  });

  // ── Dots ─────────────────────────────────────────────────

  it("4 dot indicators exist", async () => {
    ImageCarousel.mount(container);
    await flush();
    expect(dots().length).toBe(4);
  });

  it("active dot follows current slide", async () => {
    ImageCarousel.mount(container);
    await flush();
    expect(dots()[0].style?.background).toBe("rgb(100, 108, 255)");
    expect(dots()[1].style?.background).toBe("rgb(221, 221, 221)");

    btn("›")?.click();
    await flush();
    const d2 = dots();
    expect(d2[0].style?.background).toBe("rgb(221, 221, 221)");
    expect(d2[1].style?.background).toBe("rgb(100, 108, 255)");
  });
});
