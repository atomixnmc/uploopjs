/**
 * Blog Client — CMS with WYSIWYG editor + media blocks
 *
 * Imports reusable components from the Uploop ecosystem:
 *   import { WysiwygEditor } from 'uploop:wysiwyg'
 *   import { ImageBlock, CarouselBlock, MediaBlock } from 'uploop:media'
 *
 * Same components work server-side (SSR) and client-side (mount).
 */

import { component, createLoop } from "@uploop/core";
import { html } from "@uploop/html";
import { WysiwygEditor } from "uploop:wysiwyg";
import { ImageBlock, CarouselBlock, MediaBlock } from "uploop:media";

// ── BlogEditor CMS component ───────────────────────────────

const BlogEditor = component("BlogEditor", {
  state: {
    title: "",
    body: "<p>Start writing...</p>",
    author: "Team",
    saving: false,
    saved: false,
    savedId: null,
    mode: "create", // 'create' | 'edit'
    postId: null,
  },

  update: {
    setTitle: (s, v) => ({ title: v }),
    setBody: (s, v) => ({ body: v }),
    setSaving: (s, v) => ({ saving: v }),
    setSaved: (s, { id }) => ({ saved: true, saving: false, savedId: id }),
    setMode: (s, { mode, post }) => ({
      mode,
      postId: post?.id || null,
      title: post?.title || "",
      body: post?.body || "<p>Start writing...</p>",
      author: post?.author || "Team",
      saved: false,
    }),
  },

  view: (s, { send }) => {
    return html`
      <div
        id="blog-editor-root"
        style="max-width:750px;margin:0 auto;padding:2rem;font-family:system-ui"
      >
        <a
          href="/blog"
          style="color:#646cff;text-decoration:none;font-size:0.85rem"
          >← Back to blog</a
        >
        <h2 style="margin:0.5rem 0">
          ${s.mode === "edit" ? "✏️ Edit Post" : "✏️ New Blog Post"}
        </h2>

        <!-- Title -->
        <input
          id="be-title"
          type="text"
          placeholder="Post title..."
          value="${s.title}"
          style="width:100%;padding:0.6rem;font-size:1.2rem;border:2px solid #ddd;border-radius:8px;margin-bottom:0.75rem;outline:none;font-weight:600"
          oninput="${(e) => send("setTitle", e.target.value)}"
        />

        <!-- WYSIWYG Editor (reusable module) -->
        <div id="be-wysiwyg-mount"></div>

        <!-- Media insertion dialog -->
        <div
          id="be-media-dialog"
          style="display:none;margin:1rem 0;padding:1rem;background:#f8f8ff;border:1px solid #e0e0ff;border-radius:8px"
        >
          <div
            style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem"
          >
            <strong style="font-size:0.9rem">Insert Media</strong>
            <button
              id="be-media-close"
              style="border:none;background:none;cursor:pointer;font-size:1.2rem"
            >
              &times;
            </button>
          </div>
          <div
            id="be-media-form"
            style="display:flex;flex-direction:column;gap:0.5rem"
          >
            <!-- Populated dynamically by media type -->
          </div>
        </div>

        <!-- Status bar -->
        <div
          style="display:flex;align-items:center;justify-content:space-between;margin-top:0.75rem"
        >
          <span style="font-size:0.8rem;color:#888">
            ${s.saving
              ? "⏳ Saving..."
              : s.saved
                ? `✅ Saved! Post #${s.savedId}`
                : "Ready"}
          </span>
          <button
            id="be-save"
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

// ── Mount WYSIWYG ──────────────────────────────────────────

function mountWysiwyg() {
  const mount = document.getElementById("be-wysiwyg-mount");
  if (!mount) return;

  WysiwygEditor.mount(mount);

  // Listen for media insertion events from the toolbar
  mount.addEventListener("up-media-insert", (e) => {
    showMediaDialog(e.detail.type);
  });
}

// ── Media insertion dialog ─────────────────────────────────

function showMediaDialog(type) {
  const dialog = document.getElementById("be-media-dialog");
  const form = document.getElementById("be-media-form");
  if (!dialog || !form) return;

  dialog.style.display = "block";
  let formHtml = "";

  if (type === "image") {
    formHtml = `
      <label style="font-size:0.85rem">Image URL</label>
      <input id="mf-src" placeholder="https://..." style="padding:0.4rem;border:1px solid #ccc;border-radius:4px" />
      <label style="font-size:0.85rem">Alt text</label>
      <input id="mf-alt" placeholder="Description" style="padding:0.4rem;border:1px solid #ccc;border-radius:4px" />
      <label style="font-size:0.85rem">Caption</label>
      <input id="mf-caption" placeholder="Optional caption" style="padding:0.4rem;border:1px solid #ccc;border-radius:4px" />
      <button id="mf-insert" style="padding:0.4rem;background:#646cff;color:#fff;border:none;border-radius:4px;cursor:pointer">Insert Image</button>
    `;
  } else if (type === "carousel") {
    formHtml = `
      <label style="font-size:0.85rem">Image URLs (one per line)</label>
      <textarea id="mf-urls" rows="4" placeholder="https://picsum.photos/seed/a/600/300&#10;https://picsum.photos/seed/b/600/300" style="padding:0.4rem;border:1px solid #ccc;border-radius:4px;font-family:monospace;font-size:0.8rem"></textarea>
      <button id="mf-insert" style="padding:0.4rem;background:#646cff;color:#fff;border:none;border-radius:4px;cursor:pointer">Insert Carousel</button>
    `;
  } else if (type === "audio" || type === "video") {
    formHtml = `
      <label style="font-size:0.85rem">Media URL</label>
      <input id="mf-src" placeholder="https://..." style="padding:0.4rem;border:1px solid #ccc;border-radius:4px" />
      <label style="font-size:0.85rem">Title</label>
      <input id="mf-title" placeholder="Track title" style="padding:0.4rem;border:1px solid #ccc;border-radius:4px" />
      <label style="font-size:0.85rem">Artist / Creator</label>
      <input id="mf-artist" placeholder="Artist name" style="padding:0.4rem;border:1px solid #ccc;border-radius:4px" />
      <button id="mf-insert" style="padding:0.4rem;background:#646cff;color:#fff;border:none;border-radius:4px;cursor:pointer">Insert ${type === "audio" ? "Audio" : "Video"}</button>
    `;
  }

  form.innerHTML = formHtml;
  form.dataset.mediaType = type;

  // Close button
  document.getElementById("be-media-close").onclick = () => {
    dialog.style.display = "none";
  };
}

// Insert media placeholder into WYSIWYG
function insertMediaPlaceholder(type, props) {
  const body = document.querySelector(".up-wysiwyg-body");
  if (!body) return;

  let placeholder;
  if (type === "image") {
    placeholder = `<div data-media="image" data-src="${props.src}" data-alt="${props.alt}" data-caption="${props.caption}"><img src="${props.src}" alt="${props.alt}" style="max-width:100%;border-radius:8px"><em>${props.caption}</em></div>`;
  } else if (type === "carousel") {
    const imgs = props.urls.map((u, i) => `data-img${i}="${u}"`).join(" ");
    placeholder = `<div data-media="carousel" ${imgs}><em>🎠 Carousel (${props.urls.length} images)</em></div>`;
  } else if (type === "audio" || type === "video") {
    placeholder = `<div data-media="${type}" data-src="${props.src}" data-title="${props.title}" data-artist="${props.artist}"><em>${type === "audio" ? "🎵" : "🎬"} ${props.title || type}</em></div>`;
  }

  body.focus();
  document.execCommand("insertHTML", false, placeholder);
  BlogEditor.send("setBody", body.innerHTML);
}

// ── Media form handler ─────────────────────────────────────

document.addEventListener("click", (e) => {
  if (e.target.id !== "mf-insert") return;
  const form = document.getElementById("be-media-form");
  const dialog = document.getElementById("be-media-dialog");
  const type = form.dataset.mediaType;

  if (type === "image") {
    const src = document.getElementById("mf-src")?.value;
    const alt = document.getElementById("mf-alt")?.value || "";
    const caption = document.getElementById("mf-caption")?.value || "";
    if (src) insertMediaPlaceholder("image", { src, alt, caption });
  } else if (type === "carousel") {
    const urls = (document.getElementById("mf-urls")?.value || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (urls.length) insertMediaPlaceholder("carousel", { urls });
  } else if (type === "audio" || type === "video") {
    const src = document.getElementById("mf-src")?.value;
    const title = document.getElementById("mf-title")?.value || "";
    const artist = document.getElementById("mf-artist")?.value || "";
    if (src) insertMediaPlaceholder(type, { src, title, artist });
  }

  if (dialog) dialog.style.display = "none";
});

// ── Save handler ───────────────────────────────────────────

async function handleSave(s, send) {
  if (!s.title.trim()) return alert("Please enter a title.");
  if (s.saving) return;

  send("setSaving", true);
  try {
    const url =
      s.mode === "edit" && s.postId ? `/api/blog/${s.postId}` : "/api/blog";
    const method = s.mode === "edit" ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: s.title, body: s.body, author: s.author }),
    });
    if (!res.ok) throw new Error("Server error: " + res.status);
    const post = await res.json();
    send("setSaved", { id: post.id });
    setTimeout(() => {
      window.location.href = "/blog/" + post.id;
    }, 800);
  } catch (e) {
    console.error("Save failed:", e);
    alert("Failed to save: " + e.message);
    send("setSaving", false);
  }
}

// ── Init ───────────────────────────────────────────────────

const root = document.getElementById("blog-editor-root");
if (root) {
  BlogEditor.mount(root);

  // Check for edit mode (URL like /blog/42/edit)
  const path = window.location.pathname;
  const editMatch = path.match(/^\/blog\/(\d+)\/edit$/);
  if (editMatch) {
    const postId = editMatch[1];
    fetch(`/api/blog/${postId}`)
      .then((r) => r.json())
      .then((post) => {
        BlogEditor.send("setMode", { mode: "edit", post });
        mountWysiwyg();
      })
      .catch(() => mountWysiwyg());
  } else {
    mountWysiwyg();
  }

  // Wire save button
  document.getElementById("be-save").addEventListener("click", () => {
    const s = BlogEditor.get();
    handleSave(s, BlogEditor.send.bind(BlogEditor));
  });

  console.log(
    "[Blog] CMS editor mounted — WYSIWYG + Media blocks via uploop:wysiwyg + uploop:media",
  );
} else {
  console.log("[Blog] No editor root — not on editor page");
}
