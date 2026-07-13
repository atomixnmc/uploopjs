import { component } from "@uploop/core";
import { html } from "@uploop/html";
import { createRouter } from "@uploop/router";

// ── Router ──────────────────────────────────────────────────

export const blogRouter = createRouter(
  { "": { view: "list" }, ":id": { view: "detail" } },
  { useHash: false },
);

// ── BlogList (SSR) ─────────────────────────────────────────

export const BlogList = component("BlogList", {
  state: { posts: [] },
  view: (s) => html`
    <div style="max-width:660px;margin:0 auto;padding:2rem">
      <div
        style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem"
      >
        <h2 style="margin:0">📝 Blog (SSR + SQLite)</h2>
        <a
          href="/blog/new"
          style="padding:0.4rem 1rem;background:#646cff;color:white;text-decoration:none;border-radius:6px;font-size:0.85rem;font-weight:600"
          >+ New Post</a
        >
      </div>
      ${s.posts.map(
        (p) => html`
          <div
            style="padding:1rem;margin-bottom:0.5rem;border:1px solid #eee;border-radius:8px"
          >
            <a
              href="/blog/${p.slug || p.id}"
              style="font-size:1.1rem;color:#646cff;text-decoration:none;font-weight:600"
              >${p.title}</a
            >
            <p style="color:#666;font-size:0.85rem;margin:0.25rem 0 0">
              ${p.author} · ${p.created_at}
            </p>
          </div>
        `,
      )}
    </div>
  `,
});

// ── BlogDetail (SSR) ───────────────────────────────────────

export const BlogDetail = component("BlogDetail", {
  state: { id: "", slug: "", title: "", body: "", author: "", created_at: "" },
  view: (s) => {
    if (!s.title)
      return html`<div style="padding:2rem;text-align:center">
        <h2>Not found</h2>
      </div>`;
    return html`
      <div style="max-width:660px;margin:0 auto;padding:2rem">
        <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem">
          <a
            href="/blog"
            style="color:#646cff;text-decoration:none;font-size:0.85rem"
            >← Back to blog</a
          >
          <a
            href="/blog/${s.slug || s.id}/edit"
            style="color:#10ac84;text-decoration:none;font-size:0.85rem;margin-left:auto"
            >✏ Edit</a
          >
        </div>
        <h2 style="margin-top:0.5rem">${s.title}</h2>
        <p style="color:#888;font-size:0.8rem">${s.author} · ${s.created_at}</p>
        <div id="blog-body" style="line-height:1.8;color:#444;margin-top:1rem">
          ${s.body}
        </div>
      </div>
    `;
  },
});

// ── BlogEditor — SSR + Client reusable component ────────────
//
// This component is the key demo: defined once, used both
// server-side (renderToString) and client-side (mount) via
// the import map:
//
//   import { component } from '@uploop/core'
//   import { html } from '@uploop/html'
//   const editor = component('BlogEditor', { ... })
//
//   Server: renderToString(editor)  → SSR HTML
//   Client: editor.mount(el)        → interactive WYSIWYG
//

export const BlogEditor = component("BlogEditor", {
  state: { title: "", mode: "create" },
  view: (s) => html`
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
      />
      <div id="be-wysiwyg-mount"></div>
      <div
        style="display:flex;align-items:center;justify-content:space-between;margin-top:0.75rem"
      >
        <span style="font-size:0.8rem;color:#888">Ready</span>
        <button
          id="be-save"
          style="padding:0.5rem 1.5rem;background:#10ac84;color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem;font-weight:600"
        >
          💾 Publish
        </button>
      </div>
    </div>
  `,
});

// ── Client-side script ─────────────────────────────────────
//
// Loaded as <script type="module" src="/public/blog-client.js">
// Imports the real @uploop/core and @uploop/html via import map,
// mounts the BlogEditor component with full WYSIWYG interactivity.
// The SAME component definition is used for SSR and client mount.

export function blogClientScript() {
  return `<script type="module" src="/public/blog-client.js"></script>`;
}
