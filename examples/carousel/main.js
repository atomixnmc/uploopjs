import { html, component } from "@uploop/html";

const IMAGES = [
  { src: "https://picsum.photos/seed/a/600/300", alt: "Landscape" },
  { src: "https://picsum.photos/seed/b/600/300", alt: "City" },
  { src: "https://picsum.photos/seed/c/600/300", alt: "Nature" },
  { src: "https://picsum.photos/seed/d/600/300", alt: "Abstract" },
];

const ImageCarousel = component("ImageCarousel", {
  state: { index: 0, auto: true },

  update: {
    next: (s) => ({ ...s, index: (s.index + 1) % IMAGES.length, auto: false }),
    prev: (s) => ({ ...s, index: (s.index - 1 + IMAGES.length) % IMAGES.length, auto: false }),
    toggleAuto: (s) => ({ ...s, auto: !s.auto }),
    tick: (s) => { if (!s.auto) return s; return { ...s, index: (s.index + 1) % IMAGES.length } },
  },

  view: (state, { send }) => html`
    <div style="font-family:sans-serif;padding:1rem;text-align:center;">
      <div style="position:relative;max-width:600px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
        <img src="${IMAGES[state.index].src}" alt="${IMAGES[state.index].alt}"
          style="width:100%;height:auto;display:block;transition:opacity 0.3s;" />
        <button @click=${() => send("prev")}
          style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.4);color:white;border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:1.2rem;">‹</button>
        <button @click=${() => send("next")}
          style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.4);color:white;border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:1.2rem;">›</button>
      </div>
      <div style="margin-top:0.75rem;display:flex;gap:0.5rem;justify-content:center;align-items:center;">
        ${IMAGES.map((_, i) => html`
          <button @click=${() => send("next")}
            style="width:10px;height:10px;border-radius:50%;border:none;cursor:pointer;background:${i === state.index ? "#646cff" : "#ddd"};"></button>
        `)}
        <button @click=${() => send("toggleAuto")}
          style="margin-left:0.5rem;padding:0.2rem 0.6rem;border:1px solid #ccc;border-radius:4px;cursor:pointer;font-size:0.75rem;background:${state.auto ? "#e8f5e9" : "#fff3e0"};color:${state.auto ? "#2e7d32" : "#e65100"};">${state.auto ? "⏸ Pause" : "▶ Play"}</button>
      </div>
    </div>
  `,

  effect: {
    autoPlay: (ctx) => {
      const id = setInterval(() => ctx.send("tick"), 3000)
      ctx.onDispose(() => clearInterval(id))
    },
  },
});

export { ImageCarousel };
export default ImageCarousel;
