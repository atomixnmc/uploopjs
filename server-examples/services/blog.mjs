/**
 * Blog Service — Uploop createLoop + createService + UUID + slugs
 *
 *   createLoop({ state, update }) → data store with UUID ids
 *   createService(loop, methods)  → FeathersJS CRUD
 *   uuid() from @uploop/core     → RFC 4122 v4 post IDs
 *   slug from title               → /blog/my-post-title
 */

import { createLoop, uuid } from "@uploop/core";
import { createService } from "@uploop/sst";
import { getDB } from "../db/schema.js";

// ── Slug helper ────────────────────────────────────────────

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

function uniqueSlug(posts, title, excludeId) {
  let base = slugify(title) || "post";
  let slug = base;
  let n = 1;
  while (posts.some((p) => p.slug === slug && p.id !== excludeId)) {
    slug = `${base}-${++n}`;
  }
  return slug;
}

// ── Migrate SQLite schema ──────────────────────────────────

const db = getDB();
// Add slug column if it doesn't exist (safe migration)
try {
  db.exec("ALTER TABLE posts ADD COLUMN slug TEXT");
} catch (e) {
  /* already exists */
}
// Generate slugs for existing posts that don't have one
const unslugged = db
  .prepare("SELECT id, title FROM posts WHERE slug IS NULL OR slug = ''")
  .all();
for (const row of unslugged) {
  const slug = slugify(row.title) || "post-" + row.id;
  db.prepare("UPDATE posts SET slug = ? WHERE id = ?").run(slug, row.id);
}

// ── Blog data loop ─────────────────────────────────────────

const blogLoop = createLoop({
  state: { posts: [], nextId: 1 },
  update: {
    _create(s, { title, body, author }) {
      const slug = uniqueSlug(s.posts, title);
      const post = {
        id: uuid(),
        title,
        slug,
        body: body || "",
        author: author || "Team",
        created_at: new Date().toISOString(),
      };
      return { posts: [post, ...s.posts] };
    },
    _update(s, { id, title, body, author }) {
      return {
        posts: s.posts.map((p) => {
          if (p.id !== id) return p;
          const newTitle = title || p.title;
          const slug = title ? uniqueSlug(s.posts, newTitle, id) : p.slug;
          return {
            ...p,
            title: newTitle,
            slug,
            body: body ?? p.body,
            author: author || p.author,
          };
        }),
      };
    },
    _remove(s, id) {
      return { posts: s.posts.filter((p) => p.id !== id) };
    },
    _seed(s, rows) {
      if (s.posts.length > 0) return s;
      const posts = rows.map((r) => ({
        id: r.id || uuid(),
        title: r.title,
        slug: r.slug || slugify(r.title),
        body: r.body,
        author: r.author,
        created_at: r.created_at,
      }));
      return { posts };
    },
  },
});

// ── Seed from SQLite ───────────────────────────────────────

const rows = db.prepare("SELECT * FROM posts ORDER BY created_at DESC").all();
if (rows.length > 0) blogLoop.send("_seed", rows);

// ── Service ────────────────────────────────────────────────

export const blogService = createService(blogLoop, {
  methods: {
    find: () => blogLoop.get().posts,
    get: (idOrSlug) => {
      const posts = blogLoop.get().posts;
      return (
        posts.find(
          (p) =>
            p.id === idOrSlug ||
            p.slug === idOrSlug ||
            String(p.id) === idOrSlug,
        ) || null
      );
    },
    create: (data) => {
      blogLoop.send("_create", data);
      const post = blogLoop.get().posts[0];
      db.prepare(
        "INSERT INTO posts (id, title, slug, body, author) VALUES (?, ?, ?, ?, ?)",
      ).run(post.id, post.title, post.slug, post.body, post.author);
      return post;
    },
    update: (idOrSlug, data) => {
      const posts = blogLoop.get().posts;
      const existing = posts.find(
        (p) =>
          p.id === idOrSlug || p.slug === idOrSlug || String(p.id) === idOrSlug,
      );
      if (!existing) return null;
      blogLoop.send("_update", { id: existing.id, ...data });
      const post = blogLoop.get().posts.find((p) => p.id === existing.id);
      if (post)
        db.prepare(
          "UPDATE posts SET title=?, slug=?, body=?, author=? WHERE id=?",
        ).run(post.title, post.slug, post.body, post.author, post.id);
      return post;
    },
    remove: (idOrSlug) => {
      const posts = blogLoop.get().posts;
      const existing = posts.find(
        (p) =>
          p.id === idOrSlug || p.slug === idOrSlug || String(p.id) === idOrSlug,
      );
      if (!existing) return { id: idOrSlug };
      blogLoop.send("_remove", existing.id);
      db.prepare("DELETE FROM posts WHERE id = ?").run(existing.id);
      return { id: existing.id };
    },
  },
});

export { blogLoop };
