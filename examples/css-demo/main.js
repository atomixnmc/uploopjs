import { html, component } from "@uploop/html";
import {
  inject,
  theme,
  extendTheme,
  applyTheme,
  lightTheme,
  darkTheme,
  spacing,
  colors,
  markUsed,
  watchDOM,
  getUsedClasses,
  stats,
  utility,
  variant,
  css,
  createNamedStyle,
  createGradientStyle,
  createEventStyle,
  shades,
  contrast,
  lighten,
  darken,
  alpha,
  injectAnimations,
  ANIMATIONS,
} from "@uploop/css";

// Pre-compute expensive values at module level (runs once)
const _totalRules = utility().length;
const _primaryShades = shades(colors.primary, 10);
const _successShades = shades(colors.success, 10);
const _warningShades = shades(colors.warning, 10);
const _colorDemos = [
  { label: "lighten 30%", bg: lighten(colors.primary, 30) },
  { label: "base", bg: colors.primary },
  { label: "darken 30%", bg: darken(colors.primary, 30) },
  { label: "alpha 0.4", bg: alpha(colors.primary, 0.4) },
];
const _shadeRows = [
  { name: "primary", list: _primaryShades },
  { name: "success", list: _successShades },
  { name: "warning", list: _warningShades },
];

const brandTheme = extendTheme(lightTheme, {
  name: "brand",
  colors: {
    primary: "#4f46e5",
    secondary: "#7c3aed",
    success: "#059669",
    danger: "#dc2626",
  },
});
const oceanTheme = extendTheme(lightTheme, {
  name: "ocean",
  colors: {
    primary: "#0891b2",
    secondary: "#0284c7",
    success: "#16a34a",
    info: "#0ea5e9",
  },
});
const THEMES = [
  { label: "Light", theme: lightTheme },
  { label: "Dark", theme: darkTheme },
  { label: "Brand", theme: brandTheme },
  { label: "Ocean", theme: oceanTheme },
];

const cardStyle = css()
  .prop("padding", "1.25rem")
  .prop("border-radius", "12px")
  .prop("background", "var(--color-surface)")
  .prop("box-shadow", "0 2px 8px rgba(0,0,0,0.08)")
  .done();

const gradientBtn = createGradientStyle({
  colors: ["var(--color-primary)", "var(--color-secondary)"],
  dir: "135deg",
});
const liftStyle = createEventStyle({
  event: "hover",
  transform: "translateY(-2px)",
  boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
});
const badgeStyle = createNamedStyle({
  display: "inline-block",
  padding: "0.15rem 0.6rem",
  borderRadius: "999px",
  fontSize: "0.72rem",
  fontWeight: "600",
});

const CSSDemo = component("CSSDemo", {
  state: { activeTheme: "light" },
  update: {
    switchTheme: (s, name) => {
      const t = THEMES.find((t) => t.label.toLowerCase() === name);
      if (t) applyTheme(t.theme);
      return { ...s, activeTheme: name };
    },
  },
  view: (state, { send }) => {
    markUsed(
      "p-5 m-2 rounded-2 bg-white text-center d-flex flex-column items-center gap-2 " +
        "d-grid grid-cols-3 gap-4 pos-relative overflow-hidden font-bold text-2 " +
        "text-primary bg-primary text-white border-solid shadow-2 cursor-pointer",
    );

    return html`
<div style="font-family:sans-serif;max-width:800px;margin:0 auto;padding:1.5rem 1.5rem 3rem;background:var(--color-bg);color:var(--color-fg);">
  <div class="d-flex justify-between items-center mb-4" style="flex-wrap:wrap;gap:1rem;">
    <div>
      <h1 class="text-2" style="margin:0;font-weight:800;color:var(--color-primary);">@uploop/css</h1>
      <p style="margin:0.25rem 0 0;font-size:0.85rem;opacity:0.55;">Utility-first CSS engine · themable · tree-shakeable · 0 deps</p>
    </div>
    <div class="d-flex items-center gap-2" style="flex-wrap:wrap;">
      ${THEMES.map(
        (t) =>
          html` <button
            @click=${() => send("switchTheme", t.label.toLowerCase())}
            style="padding:0.35rem 0.8rem;border:none;border-radius:8px;cursor:pointer;font-size:0.78rem;font-weight:600;transition:all 0.15s;background:${state.activeTheme ===
            t.label.toLowerCase()
              ? "var(--color-primary)"
              : "#e8e8ed"};color:${state.activeTheme === t.label.toLowerCase()
              ? "white"
              : "#555"};"
          >
            ${t.label}
          </button>`,
      )}
    </div>
  </div>

  <h2 style="font-size:1.1rem;font-weight:700;margin:1.5rem 0 0.75rem;">🎨 Utility Classes in Action</h2>
  <div class="d-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;">
    ${[
      { icon: "🎯", title: "Spacing", codes: "p-4 m-2 gap-3 mx-auto" },
      {
        icon: "🌈",
        title: "Colors",
        codes: "text-primary bg-success border-danger",
      },
      { icon: "📐", title: "Layout", codes: "d-flex d-grid justify-center" },
      {
        icon: "🔤",
        title: "Typography",
        codes: "text-center font-bold tracking-w1",
      },
    ].map(
      (c) =>
        html` <div class="${cardStyle.className}">
          <div style="font-size:1.5rem;margin-bottom:0.5rem;">${c.icon}</div>
          <strong>${c.title}</strong>
          <p style="font-size:0.78rem;margin:0.25rem 0 0;opacity:0.6;">
            ${c.codes}
          </p>
        </div>`,
    )}
  </div>

  <h2 style="font-size:1.1rem;font-weight:700;margin:1.5rem 0 0.75rem;">✨ Dynamic & Scoped Styles</h2>
  <div class="d-flex gap-3" style="flex-wrap:wrap;align-items:center;">
    <button class="${gradientBtn.className} ${liftStyle.className}"
      style="border:none;color:white;padding:0.6rem 1.5rem;border-radius:10px;cursor:pointer;font-weight:600;transition:all 0.2s;">Gradient Button</button>
    <span class="${badgeStyle.className}" style="background:var(--color-success);color:white;">Chain API</span>
    <span class="${badgeStyle.className}" style="background:var(--color-info);color:white;">Named Styles</span>
    <span class="${badgeStyle.className}" style="background:var(--color-warning);color:#333;">Event Styles</span>
  </div>
  <p style="font-size:0.78rem;margin-top:0.5rem;opacity:0.6;">
    Gradient uses <code>createGradientStyle()</code>, badge uses <code>createNamedStyle()</code>,
    hover-lift uses <code>createEventStyle()</code>. All scoped, no global pollution.
  </p>

  <h2 style="font-size:1.1rem;font-weight:700;margin:1.5rem 0 0.75rem;">🎨 Auto-generated Color Shades</h2>
  <p style="font-size:0.78rem;margin:0 0 0.75rem;opacity:0.6;">
    Each theme color auto-generates 10 shade variants via <code>shadeMap()</code>. No manual palette needed.
  </p>
  ${_shadeRows.map(
    ({ name, list }) =>
      html` <div style="margin-bottom:0.75rem;">
        <div
          style="font-size:0.72rem;font-weight:600;margin-bottom:0.3rem;text-transform:uppercase;letter-spacing:0.05em;opacity:0.7;"
        >
          ${name} — ${colors[name]}
        </div>
        <div class="d-flex" style="gap:2px;border-radius:8px;overflow:hidden;">
          ${list.map(
            (hex, i) =>
              html` <div
                style="flex:1;height:36px;background:${hex};display:flex;align-items:flex-end;justify-content:center;padding-bottom:1px;"
                title="${name}-${i === 0 ? "50" : i * 100}: ${hex}"
              >
                <span
                  style="font-size:0.45rem;color:${contrast(
                    hex,
                  )};line-height:1;"
                  >${i === 0 ? "50" : i * 100}</span
                >
              </div>`,
          )}
        </div>
      </div>`,
  )}
  </div>

  <h2 style="font-size:1.1rem;font-weight:700;margin:1.5rem 0 0.75rem;">🔧 Color Calculation Utils</h2>
  <div class="d-flex gap-3" style="flex-wrap:wrap;align-items:center;font-size:0.78rem;">
    ${_colorDemos.map(
      (item) =>
        html` <div
          style="display:flex;flex-direction:column;align-items:center;gap:0.3rem;"
        >
          <div
            style="width:56px;height:56px;border-radius:10px;background:${item.bg};box-shadow:0 2px 6px rgba(0,0,0,0.1);"
          ></div>
          <span style="font-size:0.65rem;opacity:0.7;">${item.label}</span>
        </div>`,
    )}
  </div>
  <p style="font-size:0.72rem;margin-top:0.5rem;opacity:0.5;">
    <code>lighten()</code> · <code>darken()</code> · <code>alpha()</code> · <code>contrast()</code> — pure functions, tree-shakeable
  </p>

  <h2 style="font-size:1.1rem;font-weight:700;margin:1.5rem 0 0.75rem;">🎬 Animation Utilities</h2>
  <p style="font-size:0.78rem;margin:0 0 0.75rem;opacity:0.6;">
    Pre-built keyframe classes. Just add <code>class="up-anim-fade-in"</code>. Composable with duration/delay modifiers.
  </p>
  <div class="d-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.75rem;">
    ${[
      { cls: ANIMATIONS.fadeIn, label: "Fade In", icon: "👻" },
      { cls: ANIMATIONS.slideUp, label: "Slide Up", icon: "⬆️" },
      { cls: ANIMATIONS.scaleIn, label: "Scale In", icon: "💠" },
      { cls: ANIMATIONS.spin, label: "Spin", icon: "🔄" },
      { cls: ANIMATIONS.pulse, label: "Pulse", icon: "💓" },
      { cls: ANIMATIONS.bounce, label: "Bounce", icon: "🏀" },
    ].map(
      (a) =>
        html` <div
          class="${cardStyle.className} ${a.cls} ${ANIMATIONS.loop} ${ANIMATIONS.slow}"
          style="text-align:center;"
        >
          <div style="font-size:1.5rem;margin-bottom:0.3rem;">${a.icon}</div>
          <strong style="font-size:0.82rem;">${a.label}</strong>
          <p style="font-size:0.68rem;opacity:0.5;margin:0.2rem 0 0;">
            .${a.cls}
          </p>
        </div>`,
    )}
  </div>
  <p style="font-size:0.72rem;margin-top:0.5rem;opacity:0.5;">
    Also: <code>up-anim-fast</code> · <code>up-anim-slow</code> ·
    <code>up-anim-delay-100</code>–<code>500</code> · honors <code>prefers-reduced-motion</code>
  </p>

  <h2 style="font-size:1.1rem;font-weight:700;margin:1.5rem 0 0.75rem;">📱 Responsive Variants</h2>
  <div class="d-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.75rem;">
    ${[
      { code: "hover:bg-primary", desc: "hover variant" },
      { code: "sm:d-flex", desc: "responsive (>=576px)" },
      { code: "dark:text-white", desc: "dark mode" },
      { code: "focus:border-primary", desc: "focus variant" },
    ].map(
      (v) =>
        html` <div
          class="${cardStyle.className}"
          style="text-align:center;font-size:0.82rem;"
        >
          <code>${v.code}</code>
          <p style="margin:0.25rem 0 0;font-size:0.72rem;opacity:0.55;">
            ${v.desc}
          </p>
        </div>`,
    )}
  </div>

  <h2 style="font-size:1.1rem;font-weight:700;margin:1.5rem 0 0.75rem;">⚡ Runtime Optimizer</h2>
  <div class="${cardStyle.className}" style="font-family:monospace;font-size:0.78rem;line-height:1.6;opacity:0.85;">
    <div><strong>Tracks used classes</strong> via DOM observation</div>
    <div><strong>Prunes unused rules</strong> on injection</div>
    <div>Total utility rules: <strong>${_totalRules.toLocaleString()}</strong></div>
    <div>Used class names: <strong>${getUsedClasses().length.toLocaleString()}</strong></div>
    <div>Savings with pruning: <strong style="color:var(--color-success);">${stats().savings}</strong></div>
  </div>

  <p style="text-align:center;margin-top:2rem;font-size:0.75rem;opacity:0.5;">
    @uploop/css v0.2.0 · <code>import { theme, inject, css } from "@uploop/css"</code>
  </p>
</div>`;
  },
  mount: (_el, ctx) => {
    applyTheme(lightTheme);
    injectAnimations();
    watchDOM();
    markUsed("p-5 d-flex gap-4 text-center rounded-2 bg-white");
  },
});

export { CSSDemo };
export default CSSDemo;
