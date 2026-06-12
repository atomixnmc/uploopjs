/**
 * Media Blocks — Reusable content embedding components
 *
 * These are Uploop components that can be embedded in blog posts,
 * CMS pages, or any context. They work both server-side (SSR
 * renders placeholder/link) and client-side (mount for interactive).
 *
 *   import { ImageBlock }  from 'uploop:examples/media'
 *   import { CarouselBlock } from 'uploop:examples/media'
 *   import { MediaBlock }  from 'uploop:examples/media'
 */

import { component } from "@uploop/core";
import { html } from "@uploop/html";

// ── Image Block ────────────────────────────────────────────

export const ImageBlock = component("ImageBlock", {
  state: { src: "", alt: "", caption: "" },

  view: (s) => {
    if (!s.src) return html`<div style="padding:2rem;text-align:center;color:#999;border:2px dashed #ddd;border-radius:8px">🖼 No image source</div>`;
    return html`
      <figure style="margin:1.5rem 0;text-align:center">
        <img
          src="${s.src}"
          alt="${s.alt}"
          loading="lazy"
          style="max-width:100%;height:auto;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1)"
        />
        ${s.caption
          ? html`<figcaption style="margin-top:0.5rem;font-size:0.85rem;color:#888;font-style:italic">${s.caption}</figcaption>`
          : ""}
      </figure>
    `;
  },
});

// ── Carousel Block ─────────────────────────────────────────

export const CarouselBlock = component("CarouselBlock", {
  state: {
    images: [], // [{ src, alt }]
    index: 0,
    auto: true,
    interval: 4000,
  },

  update: {
    next: (s) => ({ ...s, index: (s.index + 1) % Math.max(1, s.images.length) }),
    prev: (s) => ({ ...s, index: (s.index - 1 + Math.max(1, s.images.length)) % Math.max(1, s.images.length) }),
    toggleAuto: (s) => ({ ...s, auto: !s.auto }),
  },

  view: (s, { send }) => {
    if (!s.images.length)
      return html`<div style="padding:2rem;text-align:center;color:#999;border:2px dashed #ddd;border-radius:8px">🎠 No images</div>`;

    const img = s.images[s.index];
    return html`
      <div style="position:relative;margin:1.5rem 0;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);background:#e8e8ed">
        <img src="${img.src}" alt="${img.alt}" style="width:100%;height:auto;display:block;aspect-ratio:2/1;object-fit:cover" loading="lazy" />
        ${s.images.length > 1
          ? html`
              <button @click="${() => send("prev")}" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.4);color:#fff;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:1.2rem">‹</button>
              <button @click="${() => send("next")}" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.4);color:#fff;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:1.2rem">›</button>
              <div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;gap:6px">
                ${s.images.map((_, i) => html`<span style="width:8px;height:8px;border-radius:50%;background:${i === s.index ? "#fff" : "rgba(255,255,255,0.4)"};transition:background 0.2s"></span>`)}
              </div>
              <button @click="${() => send("toggleAuto")}" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.4);color:#fff;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:0.7rem">${s.auto ? "⏸" : "▶"}</button>
            `
          : ""}
      </div>
    `;
  },
});

// ── Media Block (Audio/Video) ──────────────────────────────

export const MediaBlock = component("MediaBlock", {
  state: { type: "audio", src: "", title: "", artist: "" },

  view: (s) => {
    if (!s.src)
      return html`<div style="padding:2rem;text-align:center;color:#999;border:2px dashed #ddd;border-radius:8px">${s.type === "video" ? "🎬" : "🎵"} No media source</div>`;

    return html`
      <div style="margin:1.5rem 0;padding:1rem;background:#fafafa;border:1px solid #eee;border-radius:8px">
        ${s.title ? html`<div style="font-weight:600;margin-bottom:0.5rem;font-size:0.95rem">${s.title}</div>` : ""}
        ${s.artist ? html`<div style="font-size:0.8rem;color:#888;margin-bottom:0.5rem">${s.artist}</div>` : ""}
        ${s.type === "audio"
          ? html`<audio controls src="${s.src}" style="width:100%;margin-top:0.25rem"></audio>`
          : html`<video controls src="${s.src}" style="width:100%;max-height:400px;border-radius:6px;margin-top:0.25rem"></video>`}
      </div>
    `;
  },
});
