import { html, component } from "@uploop/html";

// ─── Playlist ────────────────────────────────────────────
// Sample audio files from samplelib.com (public domain samples)

const PLAYLIST = [
  {
    title: "Synth Loop",
    artist: "Sample A",
    src: "https://samplelib.com/lib/preview/mp3/sample-3s.mp3",
  },
  {
    title: "Drum Beat",
    artist: "Sample B",
    src: "https://samplelib.com/lib/preview/mp3/sample-6s.mp3",
  },
  {
    title: "Bass Groove",
    artist: "Sample C",
    src: "https://samplelib.com/lib/preview/mp3/sample-9s.mp3",
  },
  {
    title: "Piano Chord",
    artist: "Sample D",
    src: "https://samplelib.com/lib/preview/mp3/sample-12s.mp3",
  },
  {
    title: "Ambient Pad",
    artist: "Sample E",
    src: "https://samplelib.com/lib/preview/mp3/sample-15s.mp3",
  },
];

// ─── Format time helper ──────────────────────────────────
const fmt = (t) => {
  if (!t || !isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

// ─── Module-scoped audio element (survives innerHTML) ────
// innerHTML destroys DOM, so the <audio> element must live
// outside the view template. We store it at module level
// and connect it via the persistent resource system.
let _audioEl = null;

function getAudio() {
  if (_audioEl) return _audioEl;
  _audioEl = new Audio();
  _audioEl.preload = "auto";
  return _audioEl;
}

// ─── Component ───────────────────────────────────────────
const AudioPlayer = component("AudioPlayer", {
  state: {
    playing: false,
    volume: 0.7,
    currentTime: 0,
    duration: 0,
    trackIndex: 0,
  },

  update: {
    /** Play/pause toggle */
    toggle: (s) => {
      const audio = getAudio();
      if (s.playing) {
        audio.pause();
      } else {
        audio.play().catch(() => {});
      }
      return { ...s, playing: !s.playing };
    },

    /** Set volume (0–1) */
    setVolume: (s, v) => {
      const vol = parseFloat(v);
      getAudio().volume = vol;
      return { ...s, volume: vol };
    },

    /** Seek to position */
    setTime: (s, t) => {
      const time = parseFloat(t);
      const audio = getAudio();
      if (isFinite(time) && isFinite(audio.duration)) {
        audio.currentTime = time;
      }
      return { ...s, currentTime: time };
    },

    /** Update current time (called by timeupdate event) */
    timeUpdate: (s, t) => ({
      ...s,
      currentTime: t,
      duration: getAudio().duration || s.duration,
    }),

    /** Track ended — advance to next */
    trackEnded: (s) => {
      const next = (s.trackIndex + 1) % PLAYLIST.length;
      const audio = getAudio();
      audio.src = PLAYLIST[next].src;
      audio.play().catch(() => {});
      return { ...s, trackIndex: next, playing: true, currentTime: 0 };
    },

    /** Select a specific track */
    selectTrack: (s, idx) => {
      if (idx === s.trackIndex) return s; // same track — ignore
      const audio = getAudio();
      audio.src = PLAYLIST[idx].src;
      audio.play().catch(() => {});
      return { ...s, trackIndex: idx, playing: true, currentTime: 0 };
    },

    /** Go to previous track */
    prevTrack: (s) => {
      const prev = (s.trackIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
      const audio = getAudio();
      audio.src = PLAYLIST[prev].src;
      audio.play().catch(() => {});
      return { ...s, trackIndex: prev, playing: true, currentTime: 0 };
    },

    /** Go to next track */
    nextTrack: (s) => {
      const next = (s.trackIndex + 1) % PLAYLIST.length;
      const audio = getAudio();
      audio.src = PLAYLIST[next].src;
      audio.play().catch(() => {});
      return { ...s, trackIndex: next, playing: true, currentTime: 0 };
    },

    /** Audio metadata loaded */
    metadataLoaded: (s) => ({
      ...s,
      duration: getAudio().duration || s.duration,
    }),
  },

  view: (state, { send }) => {
    const pct =
      state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
    const track = PLAYLIST[state.trackIndex];

    return html`
      <div
        style="font-family:sans-serif;padding:1.5rem 1.5rem 1rem;max-width:420px;margin:0 auto;"
      >
        <!-- Now Playing -->
        <div style="text-align:center;margin-bottom:1rem;">
          <div style="font-size:3rem;margin-bottom:0.5rem;">🎵</div>
          <div style="font-size:1rem;font-weight:600;color:#222;">
            ${track.title}
          </div>
          <div style="font-size:0.8rem;color:#888;">${track.artist}</div>
        </div>

        <!-- Progress Bar -->
        <div
          style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;"
        >
          <span
            style="font-size:0.72rem;color:#666;min-width:36px;text-align:right;"
            >${fmt(state.currentTime)}</span
          >
          <div
            style="flex:1;height:6px;background:#e0e0e0;border-radius:3px;position:relative;cursor:pointer;"
            @click=${(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              send("setTime", ratio * state.duration);
            }}
          >
            <div
              style="height:100%;width:${pct}%;background:#646cff;border-radius:3px;transition:width 0.15s linear;"
            ></div>
          </div>
          <span style="font-size:0.72rem;color:#666;min-width:36px;"
            >${fmt(state.duration)}</span
          >
        </div>

        <!-- Controls -->
        <div
          style="display:flex;gap:1rem;justify-content:center;align-items:center;margin-bottom:1rem;"
        >
          <button
            @click=${() => send("prevTrack")}
            style="background:none;border:none;cursor:pointer;font-size:1.3rem;color:#555;padding:0.25rem;"
          >
            ⏮
          </button>
          <button
            @click=${() => send("toggle")}
            style="width:52px;height:52px;border-radius:50%;border:none;background:#646cff;color:white;font-size:1.4rem;cursor:pointer;display:flex;align-items:center;justify-content:center;"
          >
            ${state.playing ? "⏸" : "▶"}
          </button>
          <button
            @click=${() => send("nextTrack")}
            style="background:none;border:none;cursor:pointer;font-size:1.3rem;color:#555;padding:0.25rem;"
          >
            ⏭
          </button>
        </div>

        <!-- Volume -->
        <div
          style="display:flex;align-items:center;gap:0.4rem;justify-content:center;margin-bottom:1rem;"
        >
          <span style="font-size:0.75rem;">🔈</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value="${state.volume}"
            @input=${["setVolume", (e) => e.target.value]}
            style="width:80px;accent-color:#646cff;"
          />
          <span style="font-size:0.75rem;">🔊</span>
        </div>

        <!-- Playlist -->
        <div
          style="border-top:1px solid #eee;padding-top:0.75rem;max-height:180px;overflow-y:auto;"
        >
          <div
            style="font-size:0.72rem;color:#aaa;margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.05em;"
          >
            Playlist
          </div>
          ${PLAYLIST.map(
            (t, i) => html`
              <div
                @click=${() => send("selectTrack", i)}
                style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.5rem;
                       border-radius:6px;cursor:pointer;
                       background:${i === state.trackIndex
                  ? "#f0f0ff"
                  : "transparent"};
                       transition:background 0.15s;"
              >
                <span
                  style="font-size:0.85rem;min-width:24px;color:${i ===
                  state.trackIndex
                    ? "#646cff"
                    : "#ccc"};"
                >
                  ${i === state.trackIndex
                    ? state.playing
                      ? "🔊"
                      : "⏸"
                    : "🎵"}
                </span>
                <div style="flex:1;min-width:0;">
                  <div
                    style="font-size:0.82rem;color:${i === state.trackIndex
                      ? "#222"
                      : "#555"};font-weight:${i === state.trackIndex
                      ? "600"
                      : "400"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
                  >
                    ${t.title}
                  </div>
                  <div style="font-size:0.7rem;color:#aaa;">${t.artist}</div>
                </div>
                <span
                  style="font-size:0.68rem;color:#bbb;min-width:30px;text-align:right;"
                >
                  ${i === state.trackIndex ? fmt(state.currentTime) : ""}
                </span>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  },

  /**
   * Wire the persistent <audio> element to the component.
   * The audio element lives outside the view template so
   * innerHTML replacement doesn't destroy it.
   */
  mount: (el, ctx) => {
    const audio = getAudio();
    const send = (ev, val) => AudioPlayer.loop.send(ev, val);

    // Load initial track
    audio.src = PLAYLIST[0].src;
    audio.volume = 0.7;

    // Time update — sync audio position to state
    const onTime = () => send("timeUpdate", audio.currentTime);

    // Metadata loaded — sync duration to state
    const onMeta = () => send("metadataLoaded");

    // Track ended — auto-advance
    const onEnded = () => send("trackEnded");

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);

    // Cleanup on unmount
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
    };
  },
});

export { AudioPlayer };
export default AudioPlayer;
