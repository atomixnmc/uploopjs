import { html, component } from "@uploop/html";

const AudioPlayer = component("AudioPlayer", {
  state: { playing: false, volume: 0.7, currentTime: 0, duration: 0 },

  update: {
    toggle: (s) => ({ ...s, playing: !s.playing }),
    setVolume: (s, v) => ({ ...s, volume: parseFloat(v) }),
    setTime: (s, t) => ({ ...s, currentTime: parseFloat(t) }),
    setDuration: (s, d) => ({ ...s, duration: d }),
    tick: (s) => {
      if (!s.playing) return s;
      const next = s.currentTime + 0.1;
      return next >= s.duration
        ? { ...s, currentTime: 0, playing: false }
        : { ...s, currentTime: next };
    },
  },

  view: (state, { send }) => {
    const pct =
      state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
    const fmt = (t) => {
      const m = Math.floor(t / 60),
        s = Math.floor(t % 60);
      return m + ":" + String(s).padStart(2, "0");
    };

    return html`
      <div
        style="font-family:sans-serif;padding:1.5rem;max-width:400px;margin:0 auto;text-align:center;"
      >
        <div style="font-size:3rem;margin-bottom:0.5rem;">🎵</div>
        <div style="font-size:0.9rem;color:#888;margin-bottom:1rem;">
          Demo Audio Player
        </div>

        <div
          style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;"
        >
          <span style="font-size:0.75rem;color:#666;"
            >${fmt(state.currentTime)}</span
          >
          <div
            style="flex:1;height:6px;background:#e0e0e0;border-radius:3px;position:relative;cursor:pointer;"
            @click=${(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              send("setTime", pct * (state.duration || 60));
            }}
          >
            <div
              style="height:100%;width:${pct}%;background:#646cff;border-radius:3px;transition:width 0.1s;"
            ></div>
          </div>
          <span style="font-size:0.75rem;color:#666;"
            >${fmt(state.duration || 60)}</span
          >
        </div>

        <div
          style="display:flex;gap:0.5rem;justify-content:center;align-items:center;margin-bottom:0.75rem;"
        >
          <button
            @click=${() => send("toggle")}
            style="width:48px;height:48px;border-radius:50%;border:none;background:#646cff;color:white;font-size:1.3rem;cursor:pointer;"
          >
            ${state.playing ? "⏸" : "▶"}
          </button>
        </div>

        <div
          style="display:flex;align-items:center;gap:0.5rem;justify-content:center;"
        >
          <span style="font-size:0.75rem;">🔈</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value="${state.volume}"
            @input=${["setVolume", (e) => e.target.value]}
            style="width:80px;"
          />
          <span style="font-size:0.75rem;">🔊</span>
        </div>
      </div>
    `;
  },

  mount: (el, ctx) => {
    // Set initial duration and start tick effect
    AudioPlayer.loop.set({ duration: 60 });
    const id = setInterval(() => AudioPlayer.loop.send("tick"), 100);
    return () => clearInterval(id);
  },
});

export { AudioPlayer };
export default AudioPlayer;
