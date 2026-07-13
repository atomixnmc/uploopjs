import { html, component } from "@uploop/html";

const IMAGES = [
  { src: "https://picsum.photos/seed/a/600/300", alt: "Landscape" },
  { src: "https://picsum.photos/seed/b/600/300", alt: "City" },
  { src: "https://picsum.photos/seed/c/600/300", alt: "Nature" },
  { src: "https://picsum.photos/seed/d/600/300", alt: "Abstract" },
];

// ─── Smooth Cross-fade Carousel ──────────────────────────
//
// Two stacked background-image layers create a cross-fade:
//   "from" layer — previous slide, animates opacity 1→0
//   "to"   layer — current slide,  animates opacity 0→1
//
// Both animations play simultaneously on mount (innerHTML
// creates fresh DOM elements), producing a seamless blend.
// A skeleton shimmer underneath fills any load-time gaps.
//
// On first render prevIndex === index, so only the "to"
// layer renders (no fade-out needed).

let _intervalId = null;

const ImageCarousel = component("ImageCarousel", {
  state: { index: 0, prevIndex: 0, auto: true },

  update: {
    next: (s) => ({
      ...s,
      prevIndex: s.index,
      index: (s.index + 1) % IMAGES.length,
      auto: false,
    }),
    prev: (s) => ({
      ...s,
      prevIndex: s.index,
      index: (s.index - 1 + IMAGES.length) % IMAGES.length,
      auto: false,
    }),
    toggleAuto: (s) => ({ ...s, auto: !s.auto }),
    tick: (s) => {
      if (!s.auto) return s;
      return {
        ...s,
        prevIndex: s.index,
        index: (s.index + 1) % IMAGES.length,
      };
    },
  },

  view: (state, { send }) => {
    const current = IMAGES[state.index];
    const previous = IMAGES[state.prevIndex];
    const isTransition = state.prevIndex !== state.index;

    return html`
      <div style="font-family:sans-serif;padding:1rem;text-align:center;">
        <!-- Fixed container -->
        <div
          style="position:relative;width:100%;max-width:600px;margin:0 auto;
                 aspect-ratio:2/1;border-radius:12px;overflow:hidden;
                 box-shadow:0 4px 12px rgba(0,0,0,0.1);
                 background:#e8e8ed;"
        >
          <!-- Skeleton shimmer (behind both layers) -->
          <div
            style="position:absolute;inset:0;z-index:0;
                   background:linear-gradient(90deg,#e8e8ed 25%,#f0f0f5 50%,#e8e8ed 75%);
                   background-size:200% 100%;
                   animation:up-shimmer 1.8s ease-in-out infinite;"
          ></div>

          <!-- From layer: previous slide fading OUT -->
          ${isTransition
            ? html`
                <div
                  style="position:absolute;inset:0;z-index:1;
                         background-image:url(${previous.src});
                         background-size:cover;background-position:center;
                         animation:carousel-fade-out 0.5s ease forwards;"
                  role="img"
                  aria-label="${previous.alt}"
                ></div>
              `
            : ""}

          <!-- To layer: current slide fading IN -->
          <div
            style="position:absolute;inset:0;z-index:2;
                   background-image:url(${current.src});
                   background-size:cover;background-position:center;
                   animation:carousel-fade-in 0.5s ease forwards;"
            role="img"
            aria-label="${current.alt}"
          ></div>

          <!-- Nav buttons -->
          <button
            @click=${() => send("prev")}
            style="position:absolute;left:8px;top:50%;z-index:10;
                   transform:translateY(-50%);
                   background:rgba(0,0,0,0.35);color:white;border:none;
                   border-radius:50%;width:36px;height:36px;
                   cursor:pointer;font-size:1.2rem;backdrop-filter:blur(4px);"
          >
            ‹
          </button>
          <button
            @click=${() => send("next")}
            style="position:absolute;right:8px;top:50%;z-index:10;
                   transform:translateY(-50%);
                   background:rgba(0,0,0,0.35);color:white;border:none;
                   border-radius:50%;width:36px;height:36px;
                   cursor:pointer;font-size:1.2rem;backdrop-filter:blur(4px);"
          >
            ›
          </button>
        </div>

        <!-- Dots + auto toggle -->
        <div
          style="margin-top:0.75rem;display:flex;gap:0.5rem;justify-content:center;align-items:center;"
        >
          ${IMAGES.map(
            (_, i) => html`
              <button
                @click=${() => send("select", i)}
                style="width:10px;height:10px;border-radius:50%;border:none;cursor:pointer;
                       background:${i === state.index ? "#646cff" : "#ddd"};
                       transition:background 0.3s;"
              ></button>
            `,
          )}
          <button
            @click=${() => send("toggleAuto")}
            style="margin-left:0.5rem;padding:0.2rem 0.6rem;border:1px solid #ccc;
                   border-radius:4px;cursor:pointer;font-size:0.75rem;
                   background:${state.auto ? "#e8f5e9" : "#fff3e0"};
                   color:${state.auto ? "#2e7d32" : "#e65100"};"
          >
            ${state.auto ? "⏸ Pause" : "▶ Play"}
          </button>
        </div>
      </div>
    `;
  },

  effect: {
    autoPlay: (ctx) => {
      if (_intervalId) return;
      _intervalId = setInterval(() => ctx.send("tick"), 3000);
      ctx.onDispose(() => {
        clearInterval(_intervalId);
        _intervalId = null;
      });
    },
    injectKeyframes: () => {
      if (typeof document === "undefined") return;
      if (document.getElementById("up-carousel-keyframes")) return;
      const style = document.createElement("style");
      style.id = "up-carousel-keyframes";
      style.textContent = `
        @keyframes up-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes carousel-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes carousel-fade-out {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    },
  },
});

export { ImageCarousel };
export default ImageCarousel;
