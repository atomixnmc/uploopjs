/**
 * Blog Client — loaded as <script type="module" src="/public/blog-client.js">
 *
 * Demonstrates Uploop module reuse: the BlogEditor component is
 * defined with the SAME API on both server (renderToString for SSR)
 * and client (mount for interactive WYSIWYG).
 *
 *   import { component } from '@uploop/core'  ← same import
 *   import { html } from '@uploop/html'        ← same import
 */

import { component, createLoop } from "@uploop/core";
import { html } from "@uploop/html";

// ── BlogEditor component (client-side mount) ───────────────
//
// This is structurally identical to the server-side BlogEditor
// in components/blog.mjs. The only difference: on the client,
// component() creates a DOM execution target automatically.
// On the server, renderToString() swaps in a string target.

const BlogEditor = component("BlogEditor", {
  state: {
    title: "",
    body: "<p>Start writing...</p>",
    author: "Team",
    saving: false,
    saved: false,
    savedId: null,
  },

  update: {
    setTitle(s, title) {
      return { title };
    },
    setBody(s, body) {
      return { body };
    },
    setSaving(s, saving) {
      return { saving };
    },
    setSaved(s, { id }) {
      return { saved: true, saving: false, savedId: id };
    },
  },

  view: (s, { send }) => {
    return html`
      <div style="max-width:700px;margin:0 auto;padding:2rem;font-family:system-ui">
        <a href="/blog" style="color:#646cff;text-decoration:none;font-size:0.85rem">← Back to blog</a>
        <h2 style="margin:0.5rem 0">✏️ New Blog Post</h2>

        <!-- Title -->
        <input
          id="be-title"
          type="text"
          placeholder="Post title..."
          value="${s.title}"
          style="width:100%;padding:0.6rem;font-size:1.2rem;border:2px solid #ddd;border-radius:8px;margin-bottom:0.75rem;outline:none;font-weight:600"
          oninput="${(e) => send("setTitle", e.target.value)}"
        />

        <!-- Toolbar -->
        <div id="be-toolbar" style="display:flex;gap:4px;padding:0.4rem;background:#f5f5f5;border:2px solid #ddd;border-bottom:none;border-radius:8px 8px 0 0;flex-wrap:wrap">
          <button @click="${() => docCmd('bold')}" title="Bold" style="padding:0.3rem 0.5rem;font-weight:bold;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;min-width:28px">B</button>
          <button @click="${() => docCmd('italic')}" title="Italic" style="padding:0.3rem 0.5rem;font-style:italic;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;min-width:28px">I</button>
          <button @click="${() => docCmd('underline')}" title="Underline" style="padding:0.3rem 0.5rem;text-decoration:underline;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;min-width:28px">U</button>
          <span style="width:1px;background:#ddd;margin:0 4px"></span>
          <button @click="${() => docCmd('formatBlock', 'h2')}" title="Heading 2" style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:0.8rem;font-weight:700">H2</button>
          <button @click="${() => docCmd('formatBlock', 'h3')}" title="Heading 3" style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:0.8rem;font-weight:700">H3</button>
          <span style="width:1px;background:#ddd;margin:0 4px"></span>
          <button @click="${() => docCmd('insertUnorderedList')}" title="Bullet List" style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:0.8rem">•≡</button>
          <button @click="${() => docCmd('insertOrderedList')}" title="Numbered List" style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:0.8rem">1≡</button>
          <span style="width:1px;background:#ddd;margin:0 4px"></span>
          <button @click="${() => insertLink()}" title="Insert Link" style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:0.8rem">🔗</button>
        </div>

        <!-- WYSIWYG content area -->
        <div
          id="be-body"
          contenteditable="true"
          @input="${(e) => send("setBody", e.target.innerHTML)}"
          style="min-height:300px;padding:1rem;border:2px solid #ddd;border-top:none;border-radius:0 0 8px 8px;outline:none;background:#fff;font-size:1rem;line-height:1.7;color:#333"
        ></div>

        <!-- Status bar -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:0.75rem">
          <span style="font-size:0.8rem;color:#888">
            ${s.saving ? "⏳ Saving..." : s.saved ? `✅ Saved! Post #${s.savedId}` : "Ready"}
          </span>
          <button
            @click="${() => handleSave(s, send)}"
            style="padding:0.5rem 1.5rem;background:#10ac84;color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem;font-weight:600"
            disabled="${s.saving}"
          >
            ${s.saving ? "Saving..." : "💾 Publish"}
          </button>
        </div>
      </div>
    `;
  },
});

// ── WYSIWYG helpers ────────────────────────────────────────

function docCmd(cmd, arg) {
  document.execCommand(cmd, false, arg || null);
  // Sync body after toolbar action
  const bodyEl = document.getElementById("be-body");
  if (bodyEl) {
    BlogEditor.send("setBody", bodyEl.innerHTML);
  }
}

function insertLink() {
  const url = prompt("Link URL:", "https://");
  if (url) {
    document.execCommand("createLink", false, url);
    const bodyEl = document.getElementById("be-body");
    if (bodyEl) BlogEditor.send("setBody", bodyEl.innerHTML);
  }
}

// ── Save handler ───────────────────────────────────────────

async function handleSave(s, send) {
  if (!s.title.trim()) return alert("Please enter a title.");
  if (s.saving) return;

  send("setSaving", true);
  try {
    const res = await fetch("/api/blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: s.title,
        body: s.body,
        author: s.author,
      }),
    });
    if (!res.ok) throw new Error("Server error: " + res.status);
    const post = await res.json();
    send("setSaved", { id: post.id });

    // Redirect to the new post after a brief pause
    setTimeout(() => {
      window.location.href = "/blog/" + post.id;
    }, 800);
  } catch (e) {
    console.error("Save failed:", e);
    alert("Failed to save: " + e.message);
    send("setSaving", false);
  }
}

// ── Mount ──────────────────────────────────────────────────

const root = document.getElementById("blog-editor-root");
if (root) {
  BlogEditor.mount(root);
  // Prime the contenteditable with default body
  const bodyEl = document.getElementById("be-body");
  if (bodyEl) {
    bodyEl.innerHTML = BlogEditor.get().body;
    bodyEl.focus();
  }
  console.log("[Blog] WYSIWYG editor mounted — same component as SSR");
} else {
  console.log("[Blog] No editor root — not on /blog/new page");
}
