/**
 * WYSIWYG Editor — Reusable rich-text editing component
 *
 * IMPORTANT: The contenteditable body content is kept in a closure
 * variable, NOT in component state. This prevents Uploop's innerHTML
 * re-render from destroying the contenteditable on every keystroke.
 *
 *   import { WysiwygEditor } from 'uploop:wysiwyg'
 *   WysiwygEditor.mount(el)
 *   WysiwygEditor.setContent('<p>hello</p>')  // populate after mount
 *   WysiwygEditor.getContent()                // read current value
 */

import { component } from "@uploop/html";
import { html } from "@uploop/html";

// ── Closure state (survives innerHTML re-renders) ──────────

let _bodyHTML = "";
let _readOnly = false;
let _toolbar = true;

// ── Toolbar button styles ──────────────────────────────────

const tbBtn =
  "padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;" +
  "background:#fff;cursor:pointer;min-width:28px;font-size:0.8rem;" +
  "transition:background 0.1s";

const sep = '<span style="width:1px;background:#ddd;margin:0 4px"></span>';

// ── Component ──────────────────────────────────────────────

export const WysiwygEditor = component("WysiwygEditor", {
  state: { ready: false },

  view: (s, { send }) => {
    return html`
      <div class="up-wysiwyg" style="font-family:system-ui">
        ${_toolbar && !_readOnly
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
          contenteditable="${_readOnly ? "false" : "true"}"
          style="min-height:${_readOnly
            ? "auto"
            : "250px"};padding:1rem;border:2px solid #ddd;${_toolbar
            ? "border-top:none;"
            : "border-radius:8px;"}${_readOnly
            ? "border-radius:0 0 8px 8px;"
            : "border-radius:0 0 8px 8px;"}outline:none;background:#fff;font-size:1rem;line-height:1.7;color:#333"
        ></div>
      </div>
    `;
  },

  update: {
    markReady: (s) => ({ ready: true }),
  },

  /** Wire toolbar + keyboard shortcuts. Body content set externally. */
  mount: (el, ctx) => {
    if (!ctx || typeof document === "undefined") return;

    const body = el.querySelector(".up-wysiwyg-body");
    const send = (ev, val) => ctx.send(ev, val);

    // Restore content from closure (survives re-renders)
    if (body && _bodyHTML) {
      body.innerHTML = _bodyHTML;
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
          document.execCommand(cmd, false, btn.dataset.arg || null);
        }

        const mediaType = btn.dataset.media;
        if (mediaType) {
          el.dispatchEvent(
            new CustomEvent("up-media-insert", {
              detail: { type: mediaType },
              bubbles: true,
            }),
          );
        }

        // Save to closure after toolbar action
        if (body) _bodyHTML = body.innerHTML;
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
          if (body) _bodyHTML = body.innerHTML;
        }
      }
    };
    if (body) body.addEventListener("keydown", onKey);

    // Save to closure on each keystroke
    const onInput = () => {
      if (body) _bodyHTML = body.innerHTML;
    };
    if (body) body.addEventListener("input", onInput);

    send("markReady");

    return () => {
      if (toolbar) toolbar.removeEventListener("click", onClick);
      if (body) {
        body.removeEventListener("keydown", onKey);
        body.removeEventListener("input", onInput);
      }
    };
  },
});

// ── Public API for external control ────────────────────────

/** Set the WYSIWYG content (call after mount) */
WysiwygEditor.setContent = function (html) {
  _bodyHTML = html || "";
  const body = document.querySelector(".up-wysiwyg-body");
  if (body) body.innerHTML = _bodyHTML;
};

/** Get the current WYSIWYG content */
WysiwygEditor.getContent = function () {
  const body = document.querySelector(".up-wysiwyg-body");
  if (body) _bodyHTML = body.innerHTML;
  return _bodyHTML;
};

export default WysiwygEditor;
