/**
 * WYSIWYG Editor — Reusable rich-text editing component
 *
 * Architecture:
 *   Defined once with standard Uploop API. Works both server-side
 *   (renderToString for SSR shell) and client-side (mount for
 *   interactive editing). Inserted media blocks trigger custom
 *   events so parent CMS can handle them.
 *
 *   import { WysiwygEditor } from 'uploop:examples/wysiwyg'
 *
 *   // Server: renderToString(WysiwygEditor, { value: '<p>hi</p>' })
 *   // Client: WysiwygEditor.mount(el)
 *
 * Features:
 *   - Bold, Italic, Underline, Strikethrough
 *   - H1-H3 headings
 *   - Bullet & numbered lists
 *   - Link insertion
 *   - Media insertion hooks (image, carousel, audio, video)
 *   - readOnly mode for preview
 */

import { component } from "@uploop/core";
import { html } from "@uploop/html";

// ── Toolbar button styles ──────────────────────────────────

const tbBtn =
  "padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;" +
  "background:#fff;cursor:pointer;min-width:28px;font-size:0.8rem;" +
  "transition:background 0.1s";

const tbActive = "background:#e0e0ff;border-color:#646cff;";

const sep = '<span style="width:1px;background:#ddd;margin:0 4px"></span>';

// ── Component ──────────────────────────────────────────────

export const WysiwygEditor = component("WysiwygEditor", {
  state: {
    value: "", // HTML content
    readOnly: false,
    placeholder: "Start writing...",
    toolbar: true, // show/hide toolbar
  },

  view: (s, { send }) => {
    return html`
      <div class="up-wysiwyg" style="font-family:system-ui">
        ${s.toolbar && !s.readOnly
          ? html`<div
              class="up-wysiwyg-toolbar"
              style="display:flex;gap:4px;padding:0.5rem;background:#f5f5f5;border:2px solid #ddd;border-bottom:none;border-radius:8px 8px 0 0;flex-wrap:wrap;align-items:center"
            >
              <button
                data-cmd="bold"
                title="Bold (Ctrl+B)"
                style="${tbBtn};font-weight:bold"
              >
                B
              </button>
              <button
                data-cmd="italic"
                title="Italic (Ctrl+I)"
                style="${tbBtn};font-style:italic"
              >
                I
              </button>
              <button
                data-cmd="underline"
                title="Underline (Ctrl+U)"
                style="${tbBtn};text-decoration:underline"
              >
                U
              </button>
              <button
                data-cmd="strikeThrough"
                title="Strikethrough"
                style="${tbBtn};text-decoration:line-through"
              >
                S
              </button>
              ${sep}
              <button
                data-cmd="formatBlock"
                data-arg="h2"
                title="Heading 2"
                style="${tbBtn};font-weight:700"
              >
                H2
              </button>
              <button
                data-cmd="formatBlock"
                data-arg="h3"
                title="Heading 3"
                style="${tbBtn};font-weight:700"
              >
                H3
              </button>
              ${sep}
              <button
                data-cmd="insertUnorderedList"
                title="Bullet List"
                style="${tbBtn}"
              >
                ≡•
              </button>
              <button
                data-cmd="insertOrderedList"
                title="Numbered List"
                style="${tbBtn}"
              >
                ≡1
              </button>
              ${sep}
              <button
                data-cmd="createLink"
                title="Insert Link"
                style="${tbBtn}"
              >
                🔗
              </button>
              <button data-cmd="unlink" title="Remove Link" style="${tbBtn}">
                🔓
              </button>
              ${sep}
              <button data-media="image" title="Insert Image" style="${tbBtn}">
                🖼
              </button>
              <button
                data-media="carousel"
                title="Insert Carousel"
                style="${tbBtn}"
              >
                🎠
              </button>
              <button data-media="audio" title="Insert Audio" style="${tbBtn}">
                🎵
              </button>
              <button data-media="video" title="Insert Video" style="${tbBtn}">
                🎬
              </button>
            </div>`
          : ""}
        <div
          class="up-wysiwyg-body"
          contenteditable="${s.readOnly ? "false" : "true"}"
          style="min-height:${s.readOnly
            ? "auto"
            : "250px"};padding:1rem;border:2px solid #ddd;${s.toolbar
            ? "border-top:none;"
            : "border-radius:8px;"}${s.readOnly
            ? "border-radius:0 0 8px 8px;"
            : "border-radius:0 0 8px 8px;"}outline:none;background:#fff;font-size:1rem;line-height:1.7;color:#333"
          @input="${(e) => send("setValue", e.target.innerHTML)}"
        ></div>
      </div>
    `;
  },

  update: {
    setValue: (s, v) => ({ value: v }),
    setReadOnly: (s, v) => ({ readOnly: v }),
  },

  /** Hydrate contenteditable + wire toolbar on mount */
  mount: (el, ctx) => {
    if (!ctx || typeof document === "undefined") return;

    const body = el.querySelector(".up-wysiwyg-body");
    const send = (ev, val) => ctx.send(ev, val);

    // Set initial content from component state
    if (body) {
      const state = ctx.loop ? ctx.loop.get() : WysiwygEditor.loop.get();
      const html = state && state.value ? state.value : "";
      if (html) body.innerHTML = html;
    }

    // Toolbar click handler
    const toolbar = el.querySelector(".up-wysiwyg-toolbar");
    if (toolbar) {
      const onClick = (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        e.preventDefault();

        const cmd = btn.dataset.cmd;
        if (cmd === "createLink") {
          const url = prompt("Link URL:", "https://");
          if (url) document.execCommand(cmd, false, url);
        } else if (cmd) {
          const arg = btn.dataset.arg || null;
          document.execCommand(cmd, false, arg);
        }

        // Media insertion — fires custom event
        const mediaType = btn.dataset.media;
        if (mediaType) {
          el.dispatchEvent(
            new CustomEvent("up-media-insert", {
              detail: { type: mediaType },
              bubbles: true,
            }),
          );
        }

        // Sync body content after toolbar action
        if (body) send("setValue", body.innerHTML);
      };
      toolbar.addEventListener("click", onClick);
    }

    // Keyboard shortcuts
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey) {
        const map = { b: "bold", i: "italic", u: "underline", k: "createLink" };
        const cmd = map[e.key];
        if (cmd) {
          e.preventDefault();
          if (cmd === "createLink") {
            const url = prompt("Link URL:", "https://");
            if (url) document.execCommand(cmd, false, url);
          } else {
            document.execCommand(cmd);
          }
          if (body) send("setValue", body.innerHTML);
        }
      }
    };
    if (body) body.addEventListener("keydown", onKey);

    return () => {
      if (toolbar) toolbar.removeEventListener("click", onClick);
      if (body) body.removeEventListener("keydown", onKey);
    };
  },
});

export default WysiwygEditor;
