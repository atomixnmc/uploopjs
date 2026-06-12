/**
 * Blog Client — CMS with WYSIWYG editor + media blocks
 *
 * Imports reusable components from the Uploop ecosystem via import map:
 *   import { WysiwygEditor } from 'uploop:wysiwyg'
 *   import { ImageBlock, CarouselBlock, MediaBlock } from 'uploop:media'
 */

import { component } from "@uploop/core";
import { html } from "@uploop/html";
import { WysiwygEditor } from "uploop:wysiwyg";

// ── BlogEditor CMS component ───────────────────────────────

const BlogEditor = component("BlogEditor", {
  state: {
    title: "",
    body: "<p>Start writing...</p>",
    author: "Team",
    saving: false,
    saved: false,
    savedId: null,
    mode: "create",
    postId: null,
    wysiwygReady: false,
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
      wysiwygReady: false, // trigger re-sync
    }),
    wysiwygMounted: (s) => ({ wysiwygReady: true }),
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

        <input
          id="be-title"
          type="text"
          placeholder="Post title..."
          value="${s.title}"
          style="width:100%;padding:0.6rem;font-size:1.2rem;border:2px solid #ddd;border-radius:8px;margin-bottom:0.75rem;outline:none;font-weight:600"
          oninput="${(e) => send("setTitle", e.target.value)}"
        />

        <!-- WYSIWYG mount point -->
        <div id="be-wysiwyg-mount"></div>

        <!-- Media dialog -->
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
          ></div>
        </div>

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

// ── WYSIWYG ↔ BlogEditor state sync ───────────────────────

let _wysiwygMounted = false;

function syncWysiwygToEditor() {
  const bodyEl = document.querySelector(".up-wysiwyg-body");
  if (bodyEl) {
    BlogEditor.send("setBody", bodyEl.innerHTML);
  }
}

function mountOrSyncWysiwyg(initialBody) {
  const mount = document.getElementById("be-wysiwyg-mount");
  if (!mount) return;

  if (!_wysiwygMounted) {
    WysiwygEditor.mount(mount);
    _wysiwygMounted = true;
  }

  // Set initial content from BlogEditor state
  const bodyEl = mount.querySelector(".up-wysiwyg-body");
  if (bodyEl && initialBody) {
    bodyEl.innerHTML = initialBody;
    WysiwygEditor.send("setValue", initialBody);
  }

  // Sync toolbar edits back to BlogEditor
  if (bodyEl && !bodyEl._synced) {
    bodyEl._synced = true;
    bodyEl.addEventListener("input", () => syncWysiwygToEditor());
  }

  // Sync WYSIWYG state changes back
  if (!mount._mediaHooked) {
    mount._mediaHooked = true;
    mount.addEventListener("up-media-insert", (e) =>
      showMediaDialog(e.detail.type),
    );
  }

  BlogEditor.send("wysiwygMounted");
}

// ── Media block rendering on blog detail pages ─────────────

function mountMediaBlocks() {
  // Scan for data-media attributes and replace with mounted components
  const blocks = document.querySelectorAll("[data-media]");
  blocks.forEach((el) => {
    if (el._mounted) return;
    el._mounted = true;

    const type = el.dataset.media;
    if (type === "image") {
      const img = new Image();
      img.onload = () => {
        ImageBlock.mount(el, {
          state: {
            src: el.dataset.src,
            alt: el.dataset.alt || "",
            caption: el.dataset.caption || "",
          },
        });
      };
      img.src = el.dataset.src;
      // Fallback: mount immediately
      ImageBlock.mount(el, {
        state: {
          src: el.dataset.src,
          alt: el.dataset.alt || "",
          caption: el.dataset.caption || "",
        },
      });
    } else if (type === "carousel") {
      const images = [];
      for (const [k, v] of Object.entries(el.dataset)) {
        if (k.startsWith("img")) images.push({ src: v, alt: "" });
      }
      CarouselBlock.mount(el, { state: { images } });
    } else if (type === "audio" || type === "video") {
      MediaBlock.mount(el, {
        state: {
          type,
          src: el.dataset.src,
          title: el.dataset.title || "",
          artist: el.dataset.artist || "",
        },
      });
    }
  });
}

// ── Media insertion ────────────────────────────────────────

function showMediaDialog(type) {
  const dialog = document.getElementById("be-media-dialog");
  const form = document.getElementById("be-media-form");
  if (!dialog || !form) return;
  dialog.style.display = "block";

  const fields = {
    image: `<label>Image URL</label><input id=mf-src placeholder=https://... style=padding:.4rem;border:1px solid #ccc;border-radius:4px>
      <label>Alt text</label><input id=mf-alt placeholder=Description style=padding:.4rem;border:1px solid #ccc;border-radius:4px>
      <label>Caption</label><input id=mf-caption placeholder=Optional style=padding:.4rem;border:1px solid #ccc;border-radius:4px>
      <button id=mf-insert style=padding:.4rem;background:#646cff;color:#fff;border:none;border-radius:4px;cursor:pointer>Insert Image</button>`,
    carousel: `<label>Image URLs (one per line)</label><textarea id=mf-urls rows=4 placeholder="https://picsum.photos/seed/a/600/300&#10;https://picsum.photos/seed/b/600/300" style=padding:.4rem;border:1px solid #ccc;border-radius:4px;font-family:monospace;font-size:.8rem></textarea>
      <button id=mf-insert style=padding:.4rem;background:#646cff;color:#fff;border:none;border-radius:4px;cursor:pointer>Insert Carousel</button>`,
    audio: `<label>Media URL</label><input id=mf-src placeholder=https://... style=padding:.4rem;border:1px solid #ccc;border-radius:4px>
      <label>Title</label><input id=mf-title placeholder=Title style=padding:.4rem;border:1px solid #ccc;border-radius:4px>
      <label>Artist</label><input id=mf-artist placeholder=Artist style=padding:.4rem;border:1px solid #ccc;border-radius:4px>
      <button id=mf-insert style=padding:.4rem;background:#646cff;color:#fff;border:none;border-radius:4px;cursor:pointer>Insert Audio</button>`,
    video: `<label>Media URL</label><input id=mf-src placeholder=https://... style=padding:.4rem;border:1px solid #ccc;border-radius:4px>
      <label>Title</label><input id=mf-title placeholder=Title style=padding:.4rem;border:1px solid #ccc;border-radius:4px>
      <label>Creator</label><input id=mf-artist placeholder=Creator style=padding:.4rem;border:1px solid #ccc;border-radius:4px>
      <button id=mf-insert style=padding:.4rem;background:#646cff;color:#fff;border:none;border-radius:4px;cursor:pointer>Insert Video</button>`,
  };

  form.innerHTML = fields[type] || "";
  form.dataset.mediaType = type;
  document.getElementById("be-media-close").onclick = () => {
    dialog.style.display = "none";
  };
}

function insertMediaPlaceholder(type, props) {
  const body = document.querySelector(".up-wysiwyg-body");
  if (!body) return;

  let html;
  if (type === "image") {
    html = `<div data-media="image" data-src="${props.src}" data-alt="${props.alt}" data-caption="${props.caption}" contenteditable="false" style="display:block;margin:1rem 0"><img src="${props.src}" alt="${props.alt}" style="max-width:100%;border-radius:8px;pointer-events:none"><em style="display:block;text-align:center;font-size:.85rem;color:#888;margin-top:.25rem">${props.caption}</em></div>`;
  } else if (type === "carousel") {
    const attrs = props.urls.map((u, i) => `data-img${i}="${u}"`).join(" ");
    html = `<div data-media="carousel" ${attrs} contenteditable="false" style="display:block;margin:1rem 0;padding:2rem;text-align:center;background:#f0f0f5;border-radius:8px;color:#888"><em>🎠 Carousel (${props.urls.length} images)</em></div>`;
  } else {
    const icon = type === "audio" ? "🎵" : "🎬";
    html = `<div data-media="${type}" data-src="${props.src}" data-title="${props.title}" data-artist="${props.artist}" contenteditable="false" style="display:block;margin:1rem 0"><em>${icon} ${props.title || type}</em></div>`;
  }

  body.focus();
  document.execCommand("insertHTML", false, html);
  syncWysiwygToEditor();
}

// ── Form submit handler ────────────────────────────────────

document.addEventListener("click", (e) => {
  if (e.target.id !== "mf-insert") return;
  const form = document.getElementById("be-media-form");
  const dialog = document.getElementById("be-media-dialog");
  const type = form.dataset.mediaType;
  const g = (id) => document.getElementById(id)?.value || "";

  if (type === "image")
    insertMediaPlaceholder("image", {
      src: g("mf-src"),
      alt: g("mf-alt"),
      caption: g("mf-caption"),
    });
  else if (type === "carousel") {
    const urls = g("mf-urls")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (urls.length) insertMediaPlaceholder("carousel", { urls });
  } else
    insertMediaPlaceholder(type, {
      src: g("mf-src"),
      title: g("mf-title"),
      artist: g("mf-artist"),
    });

  dialog.style.display = "none";
});

// ── Save ───────────────────────────────────────────────────

async function handleSave() {
  const s = BlogEditor.get();
  if (!s.title.trim()) return alert("Please enter a title.");
  if (s.saving) return;

  BlogEditor.send("setSaving", true);
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
    BlogEditor.send("setSaved", { id: post.id });
    setTimeout(() => {
      window.location.href = "/blog/" + post.id;
    }, 800);
  } catch (e) {
    console.error("Save failed:", e);
    alert("Failed to save: " + e.message);
    BlogEditor.send("setSaving", false);
  }
}

// ── Init ───────────────────────────────────────────────────

const root = document.getElementById("blog-editor-root");

if (root) {
  // Mount BlogEditor shell first (renders title input + save button)
  BlogEditor.mount(root);

  const path = window.location.pathname;
  const editMatch = path.match(/^\/blog\/(\d+)\/edit$/);

  if (editMatch) {
    // Edit mode: fetch post, THEN mount WYSIWYG with content
    const postId = editMatch[1];
    fetch(`/api/blog/${postId}`)
      .then((r) => r.json())
      .then((post) => {
        BlogEditor.send("setMode", { mode: "edit", post });
        // Wait a tick for state to propagate, then mount WYSIWYG with content
        requestAnimationFrame(() => {
          mountOrSyncWysiwyg(post.body);
        });
      })
      .catch(() => mountOrSyncWysiwyg());
  } else {
    // Create mode: mount WYSIWYG immediately with default content
    requestAnimationFrame(() => mountOrSyncWysiwyg());
  }

  // Wire save button (delegated — survives innerHTML)
  document.addEventListener("click", (e) => {
    if (e.target.id === "be-save") handleSave();
  });

  console.log("[Blog] CMS editor mounted — uploop:wysiwyg + uploop:media");
} else {
  console.log("[Blog] Blog detail or list page — no editor");
}
