import { html, component } from "@uploop/html";
import {
  css,
  createGradientStyle,
  createEventStyle,
  createNamedStyle,
  injectAnimations,
  ANIMATIONS,
  markUsed,
} from "@uploop/css";

// ─── Public Domain Video Playlist ──────────────────────────
// Served by test-videos.co.uk — freely distributable, no API key.
// Using 720p / 2MB clips for fast streaming.

const PLAYLIST = [
  {
    id: "bbb",
    title: "Big Buck Bunny",
    description:
      "A giant rabbit takes revenge on three bullying rodents in this award-winning open movie by the Blender Foundation. 60 fps, stunning 3D animation.",
    duration: "0:10",
    year: 2008,
    director: "Sacha Goedegebure",
    genre: "Animation · Comedy",
    src: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_2MB.mp4",
  },
  {
    id: "jellyfish",
    title: "Jellyfish",
    description:
      "Mesmerising macro footage of jellyfish drifting through deep blue water. A calming, high-detail nature clip from jell.yfish.us.",
    duration: "0:10",
    year: 2014,
    director: "Jell.yfish.us",
    genre: "Nature · Macro",
    src: "https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_2MB.mp4",
  },
  {
    id: "sintel",
    title: "Sintel",
    description:
      "A young girl named Sintel searches for a baby dragon she once rescued. A breathtaking Blender Foundation open movie set in a fantasy world.",
    duration: "0:10",
    year: 2010,
    director: "Colin Levy",
    genre: "Fantasy · Adventure",
    src: "https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_2MB.mp4",
  },
];

// ─── Helpers ──────────────────────────────────────────────

/** Format seconds → m:ss */
const fmt = (t) => {
  if (!t || !isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

/** Format seconds → m:ss or h:mm:ss for long videos */
const fmtLong = (t) => {
  if (!t || !isFinite(t)) return "0:00";
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
};

// ─── CSS Utils: Dynamic Scoped Styles ─────────────────────

const playerBg = createGradientStyle({
  colors: ["#0f0f1a", "#1a1a2e", "#16213e"],
  dir: "160deg",
});

const accentGradient = createGradientStyle({
  colors: ["#646cff", "#e83e8c"],
  dir: "135deg",
});

const cardStyle = css()
  .prop("background", "rgba(255,255,255,0.04)")
  .prop("border-radius", "12px")
  .prop("border", "1px solid rgba(255,255,255,0.08)")
  .prop("padding", "0.75rem")
  .prop("backdrop-filter", "blur(12px)")
  .done();

const controlBtn = createNamedStyle({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.08)",
  border: "none",
  borderRadius: "8px",
  color: "rgba(255,255,255,0.85)",
  cursor: "pointer",
  fontSize: "1rem",
  padding: "0.45rem",
  transition: "all 0.2s",
});

const controlBtnHover = createEventStyle({
  event: "hover",
  background: "rgba(255,255,255,0.16)",
  transform: "scale(1.08)",
});

const playBtnStyle = createNamedStyle({
  width: "48px",
  height: "48px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  borderRadius: "50%",
  color: "white",
  fontSize: "1.3rem",
  cursor: "pointer",
  boxShadow: "0 4px 20px rgba(100,108,255,0.4)",
  transition: "all 0.25s",
});

const playBtnHover = createEventStyle({
  event: "hover",
  transform: "scale(1.12)",
  boxShadow: "0 6px 28px rgba(100,108,255,0.55)",
});

const playlistItem = createNamedStyle({
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  padding: "0.55rem 0.65rem",
  borderRadius: "10px",
  cursor: "pointer",
  transition: "all 0.2s",
});

const playlistItemHover = createEventStyle({
  event: "hover",
  background: "rgba(255,255,255,0.06)",
});

const dialogOverlay = createNamedStyle({
  position: "fixed",
  inset: "0",
  background: "rgba(0,0,0,0.6)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: "1000",
});

const dialogCard = createNamedStyle({
  background: "#1a1a2e",
  borderRadius: "16px",
  padding: "1.5rem",
  maxWidth: "440px",
  width: "90vw",
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  border: "1px solid rgba(255,255,255,0.1)",
  position: "relative",
});

const sliderTrack = css()
  .prop("width", "100%")
  .prop("height", "4px")
  .prop("background", "rgba(255,255,255,0.12)")
  .prop("border-radius", "2px")
  .prop("cursor", "pointer")
  .prop("position", "relative")
  .prop("transition", "height 0.15s")
  .prop("outline", "none")
  .done();

const thumbBase = css()
  .prop("appearance", "none")
  .prop("-webkit-appearance", "none")
  .prop("background", "transparent")
  .done();

// ─── Persistent Video Element ─────────────────────────────
let _videoEl = null;

function getVideo() {
  if (_videoEl) return _videoEl;
  _videoEl = document.createElement("video");
  _videoEl.preload = "metadata";
  _videoEl.playsInline = true;
  _videoEl.style.width = "100%";
  _videoEl.style.display = "block";
  _videoEl.style.borderRadius = "12px";
  _videoEl.style.background = "#000";
  _videoEl.style.outline = "none";
  return _videoEl;
}

// ─── Component ────────────────────────────────────────────

const VideoPlayer = component("VideoPlayer", {
  state: {
    playing: false,
    volume: 0.8,
    muted: false,
    currentTime: 0,
    duration: 0,
    trackIndex: 0,
    showInfo: false,
    playbackRate: 1,
  },

  update: {
    togglePlay: (s) => {
      const vid = getVideo();
      if (s.playing) vid.pause();
      else vid.play().catch(() => {});
      return { ...s, playing: !s.playing };
    },

    setVolume: (s, v) => {
      const vol = parseFloat(v);
      const vid = getVideo();
      vid.volume = vol;
      vid.muted = vol === 0;
      return { ...s, volume: vol, muted: vol === 0 };
    },

    toggleMute: (s) => {
      const vid = getVideo();
      vid.muted = !s.muted;
      return { ...s, muted: !s.muted };
    },

    setTime: (s, t) => {
      const time = parseFloat(t);
      const vid = getVideo();
      if (isFinite(time) && isFinite(vid.duration)) vid.currentTime = time;
      return { ...s, currentTime: time };
    },

    timeUpdate: (s, t) => ({
      ...s,
      currentTime: t,
      duration: getVideo().duration || s.duration,
    }),

    metadataLoaded: (s) => ({
      ...s,
      duration: getVideo().duration || s.duration,
    }),

    trackEnded: (s) => {
      const next = (s.trackIndex + 1) % PLAYLIST.length;
      const vid = getVideo();
      vid.src = PLAYLIST[next].src;
      vid.play().catch(() => {});
      return { ...s, trackIndex: next, playing: true, currentTime: 0 };
    },

    selectTrack: (s, idx) => {
      if (idx === s.trackIndex) return s;
      const vid = getVideo();
      vid.src = PLAYLIST[idx].src;
      vid.play().catch(() => {});
      return { ...s, trackIndex: idx, playing: true, currentTime: 0 };
    },

    prevTrack: (s) => {
      const prev = (s.trackIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
      const vid = getVideo();
      vid.src = PLAYLIST[prev].src;
      vid.play().catch(() => {});
      return { ...s, trackIndex: prev, playing: true, currentTime: 0 };
    },

    nextTrack: (s) => {
      const next = (s.trackIndex + 1) % PLAYLIST.length;
      const vid = getVideo();
      vid.src = PLAYLIST[next].src;
      vid.play().catch(() => {});
      return { ...s, trackIndex: next, playing: true, currentTime: 0 };
    },

    seekFwd: (s) => {
      const vid = getVideo();
      vid.currentTime = Math.min(vid.duration, vid.currentTime + 10);
      return { ...s, currentTime: vid.currentTime };
    },

    seekBack: (s) => {
      const vid = getVideo();
      vid.currentTime = Math.max(0, vid.currentTime - 10);
      return { ...s, currentTime: vid.currentTime };
    },

    setRate: (s, rate) => {
      const r = parseFloat(rate);
      const vid = getVideo();
      vid.playbackRate = r;
      return { ...s, playbackRate: r };
    },

    toggleInfo: (s) => ({ ...s, showInfo: !s.showInfo }),

    videoPlaying: (s) => ({ ...s, playing: true }),
    videoPaused: (s) => ({ ...s, playing: false }),
  },

  view: (state, { send }) => {
    const pct =
      state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
    const track = PLAYLIST[state.trackIndex];

    markUsed(
      "d-flex flex-column items-center gap-2 text-center rounded-2 " +
        "overflow-hidden cursor-pointer text-white font-bold shadow-2",
    );

    return html`
      <div
        class="${playerBg.className}"
        style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
               max-width: 820px; margin: 0 auto; border-radius: 16px; overflow: hidden;
               box-shadow: 0 8px 40px rgba(0,0,0,0.3); color: rgba(255,255,255,0.9);"
      >
        <!-- ─── Video Display Slot ─────────────────────── -->
        <div
          id="video-slot"
          style="position: relative; background: #000;"
        ></div>

        <!-- ─── Now Playing Bar ────────────────────────── -->
        <div style="padding: 0.85rem 1.2rem 0.5rem;">
          <div
            style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;"
          >
            <div style="flex: 1; min-width: 0;">
              <div
                style="font-size: 0.95rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
              >
                ${track.title}
              </div>
              <div
                style="font-size: 0.72rem; opacity: 0.5; margin-top: 0.1rem;"
              >
                ${track.genre} · ${track.year}
              </div>
            </div>
            <button
              @click=${() => send("toggleInfo")}
              class="${controlBtn.className} ${controlBtnHover.className}"
              title="Video Info"
              style="font-size: 1.1rem;"
            >
              ℹ
            </button>
          </div>
        </div>

        <!-- ─── Progress Bar ───────────────────────────── -->
        <div style="padding: 0 1.2rem 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span
              style="font-size: 0.68rem; opacity: 0.5; min-width: 40px; text-align: right;"
            >
              ${fmt(state.currentTime)}
            </span>
            <div
              style="flex: 1; height: 5px; background: rgba(255,255,255,0.1); border-radius: 3px; cursor: pointer; position: relative;"
              @click=${(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                send("setTime", ratio * state.duration);
              }}
            >
              <div
                class="${accentGradient.className}"
                style="height: 100%; width: ${pct}%; border-radius: 3px; transition: width 0.1s linear; position: relative;"
              >
                <div
                  style="position: absolute; right: -6px; top: -4px; width: 13px; height: 13px; border-radius: 50%; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); opacity: 0; transition: opacity 0.15s;"
                ></div>
              </div>
            </div>
            <span style="font-size: 0.68rem; opacity: 0.5; min-width: 40px;">
              ${fmtLong(state.duration)}
            </span>
          </div>
        </div>

        <!-- ─── Controls ───────────────────────────────── -->
        <div
          style="display: flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.35rem 1.2rem 0.85rem; flex-wrap: wrap;"
        >
          <!-- Shuffle-like skip back -->
          <button
            @click=${() => send("seekBack")}
            class="${controlBtn.className} ${controlBtnHover.className}"
            title="Back 10s"
            style="font-size: 0.85rem;"
          >
            ↺
          </button>

          <!-- Prev Track -->
          <button
            @click=${() => send("prevTrack")}
            class="${controlBtn.className} ${controlBtnHover.className}"
            title="Previous"
          >
            ⏮
          </button>

          <!-- Play / Pause -->
          <button
            @click=${() => send("togglePlay")}
            class="${playBtnStyle.className} ${playBtnHover.className} ${accentGradient.className}"
          >
            ${state.playing
              ? html`<span style="font-size: 1.2rem;">⏸</span>`
              : html`<span style="font-size: 1.4rem; margin-left: 3px;"
                  >▶</span
                >`}
          </button>

          <!-- Next Track -->
          <button
            @click=${() => send("nextTrack")}
            class="${controlBtn.className} ${controlBtnHover.className}"
            title="Next"
          >
            ⏭
          </button>

          <!-- Skip Fwd -->
          <button
            @click=${() => send("seekFwd")}
            class="${controlBtn.className} ${controlBtnHover.className}"
            title="Forward 10s"
            style="font-size: 0.85rem;"
          >
            ↻
          </button>

          <!-- Divider -->
          <span
            style="color: rgba(255,255,255,0.15); margin: 0 0.25rem; user-select: none;"
            >│</span
          >

          <!-- Volume -->
          <button
            @click=${() => send("toggleMute")}
            class="${controlBtn.className} ${controlBtnHover.className}"
            title=${state.muted ? "Unmute" : "Mute"}
          >
            ${state.muted || state.volume === 0
              ? "🔇"
              : state.volume < 0.5
                ? "🔉"
                : "🔊"}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value="${state.muted ? 0 : state.volume}"
            @input=${["setVolume", (e) => e.target.value]}
            style="width: 70px; accent-color: #646cff; cursor: pointer;"
          />

          <!-- Divider -->
          <span
            style="color: rgba(255,255,255,0.15); margin: 0 0.25rem; user-select: none;"
            >│</span
          >

          <!-- Speed -->
          <select
            @change=${["setRate", (e) => e.target.value]}
            style="background: rgba(255,255,255,0.08); border: none; border-radius: 8px;
                   color: rgba(255,255,255,0.85); padding: 0.35rem 0.45rem; font-size: 0.75rem;
                   cursor: pointer; font-family: inherit;"
          >
            ${[0.5, 0.75, 1, 1.25, 1.5, 2].map(
              (r) =>
                html`<option
                  value="${r}"
                  style="background: #1a1a2e; color: white;"
                  ?selected=${state.playbackRate === r}
                >
                  ${r === 1 ? "1×" : r + "×"}
                </option>`,
            )}
          </select>
        </div>

        <!-- ─── Playlist ────────────────────────────────── -->
        <div
          style="border-top: 1px solid rgba(255,255,255,0.08); padding: 0.75rem 1.2rem 1rem;"
        >
          <div
            style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.6rem;"
          >
            <span
              style="font-size: 0.75rem; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.06em;"
              >Playlist</span
            >
            <span
              style="font-size: 0.65rem; opacity: 0.35; background: rgba(255,255,255,0.08); border-radius: 999px;
                     padding: 0.1rem 0.5rem;"
            >
              ${PLAYLIST.length}
            </span>
          </div>

          <div
            style="display: flex; flex-direction: column; gap: 2px; max-height: 320px; overflow-y: auto;"
          >
            ${PLAYLIST.map(
              (t, i) => html`
                <div
                  @click=${() => send("selectTrack", i)}
                  class="${playlistItem.className} ${playlistItemHover.className}"
                  style="background: ${i === state.trackIndex
                    ? "rgba(100,108,255,0.15)"
                    : "transparent"};
                    border: ${i === state.trackIndex
                    ? "1px solid rgba(100,108,255,0.25)"
                    : "1px solid transparent"};"
                >
                  <!-- Thumb -->
                  <div
                    style="width: 48px; height: 32px; border-radius: 6px; overflow: hidden; flex-shrink: 0;
                           background: #0a0a14; position: relative;"
                  >
                    <div
                      style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
                             font-size: 0.9rem; opacity: 0.25;"
                    >
                      🎬
                    </div>
                    ${i === state.trackIndex
                      ? html`<div
                          style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;"
                        >
                          <div
                            style="width: 8px; height: 8px; border-radius: 50%;
                                       background: ${state.playing
                              ? "#4f8"
                              : "#fff"};"
                          ></div>
                        </div>`
                      : ""}
                  </div>

                  <!-- Meta -->
                  <div style="flex: 1; min-width: 0;">
                    <div
                      style="font-size: 0.82rem; font-weight: ${i ===
                      state.trackIndex
                        ? "700"
                        : "500"};
                             color: ${i === state.trackIndex
                        ? "rgba(255,255,255,0.95)"
                        : "rgba(255,255,255,0.7)"};
                             white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                    >
                      ${t.title}
                    </div>
                    <div
                      style="font-size: 0.68rem; opacity: 0.45; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                    >
                      ${t.duration} · ${t.genre}
                    </div>
                  </div>

                  <!-- Duration badge -->
                  <span
                    style="font-size: 0.65rem; opacity: 0.4; flex-shrink: 0;"
                  >
                    ${t.duration}
                  </span>
                </div>
              `,
            )}
          </div>
        </div>

        <!-- ─── Footer ──────────────────────────────────── -->
        <div
          style="padding: 0.5rem 1.2rem 1rem; text-align: center; font-size: 0.65rem; opacity: 0.3;"
        >
          Built with <span style="color: #646cff;">@uploop/css</span> ·
          <span style="color: #e83e8c;">@uploop/html</span> · Public domain
          videos
        </div>
      </div>

      <!-- ─── Video Info Dialog ─────────────────────────── -->
      ${state.showInfo
        ? html`
            <div
              class="${dialogOverlay.className} ${ANIMATIONS.fadeIn}"
              @click=${(e) => {
                if (e.target === e.currentTarget) send("toggleInfo");
              }}
            >
              <div
                class="${dialogCard.className} ${ANIMATIONS.slideUp}"
                style="animation-duration: 0.25s;"
              >
                <!-- Close button -->
                <button
                  @click=${() => send("toggleInfo")}
                  class="${controlBtn.className} ${controlBtnHover.className}"
                  style="position: absolute; top: 0.75rem; right: 0.75rem;"
                >
                  ✕
                </button>

                <!-- Poster placeholder -->
                <div
                  class="${accentGradient.className}"
                  style="width: 100%; height: 140px; border-radius: 10px; overflow: hidden; margin-bottom: 1rem;
                         display: flex; align-items: center; justify-content: center; font-size: 2.5rem;"
                >
                  🎬
                </div>

                <!-- Title -->
                <h2 style="margin: 0; font-size: 1.2rem; font-weight: 800;">
                  ${track.title}
                </h2>

                <!-- Badges -->
                <div
                  style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.6rem;"
                >
                  <span
                    style="font-size: 0.68rem; background: rgba(100,108,255,0.2); color: #a5b4fc; border-radius: 999px; padding: 0.15rem 0.6rem;"
                  >
                    ${track.genre}
                  </span>
                  <span
                    style="font-size: 0.68rem; background: rgba(232,62,140,0.15); color: #f5a0c8; border-radius: 999px; padding: 0.15rem 0.6rem;"
                  >
                    ${track.year}
                  </span>
                  <span
                    style="font-size: 0.68rem; background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); border-radius: 999px; padding: 0.15rem 0.6rem;"
                  >
                    ${track.duration}
                  </span>
                </div>

                <!-- Description -->
                <p
                  style="font-size: 0.82rem; opacity: 0.65; margin-top: 0.75rem; line-height: 1.55;"
                >
                  ${track.description}
                </p>

                <!-- Director -->
                <div
                  style="font-size: 0.72rem; opacity: 0.4; margin-top: 0.6rem;"
                >
                  Directed by
                  <strong style="color: rgba(255,255,255,0.6);"
                    >${track.director}</strong
                  >
                </div>
              </div>
            </div>
          `
        : ""}
    `;
  },

  mount: (el, ctx) => {
    const video = getVideo();
    const send = (ev, val) => VideoPlayer.loop.send(ev, val);

    // Inject animations
    injectAnimations();

    // Load initial track
    video.src = PLAYLIST[0].src;
    video.volume = 0.8;

    // Register video as a persistent resource so it survives innerHTML wipes
    ctx.registerResource("video", {
      save: () => {
        // Detach from DOM before innerHTML destroys it
        if (video.parentNode) video.parentNode.removeChild(video);
        return true;
      },
      restore: (_saved, root) => {
        // Re-attach after render
        const slot = root.querySelector("#video-slot");
        if (slot) slot.appendChild(video);
      },
    });

    // Event listeners
    const onTime = () => send("timeUpdate", video.currentTime);
    const onMeta = () => send("metadataLoaded");
    const onEnded = () => send("trackEnded");
    const onPlay = () => send("videoPlaying");
    const onPause = () => send("videoPaused");

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("ended", onEnded);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.pause();
      video.removeAttribute("src");
    };
  },
});

export { VideoPlayer };
export default VideoPlayer;
