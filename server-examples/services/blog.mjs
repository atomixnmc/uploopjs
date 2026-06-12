/**
 * Blog Service — Uploop createLoop + createService pattern
 *
 * Demonstrates the core Uploop data architecture:
 *
 *   createLoop({ state, update }) → the data store
 *   createService(loop, methods)  → CRUD interface
 *   loop.graph.describe()         → HyperGraph JSON
 *
 * The loop IS the data source. SQLite is used only for
 * persistence (seed on startup, optional sync).
 */

import { createLoop } from "@uploop/core";
import { createService } from "@uploop/sst";
import { getDB } from "../db/schema.js";

// ── Blog data loop ─────────────────────────────────────────

const blogLoop = createLoop({
  state: {
    posts: [], // [{ id, title, body, author, created_at }]
    nextId: 1,
  },

  update: {
    /** CRUD: create a new post */
    _create(s, { title, body, author }) {
      const post = {
        id: s.nextId,
        title,
        body: body || "",
        author: author || "Team",
        created_at: new Date().toISOString(),
      };
      return { posts: [post, ...s.posts], nextId: s.nextId + 1 };
    },

    /** CRUD: update an existing post */
    _update(s, { id, title, body, author }) {
      return {
        posts: s.posts.map((p) =>
          p.id === id
            ? { ...p, title: title || p.title, body: body ?? p.body, author: author || p.author }
            : p,
        ),
      };
    },

    /** CRUD: remove a post */
    _remove(s, id) {
      return { posts: s.posts.filter((p) => p.id !== id) };
    },

    /** Seed from SQLite on startup */
    _seed(s, rows) {
      if (s.posts.length > 0) return s;
      const posts = rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        author: r.author,
        created_at: r.created_at,
      }));
      const maxId = posts.reduce((max, p) => Math.max(max, p.id), 0);
      return { posts, nextId: maxId + 1 };
    },
  },
});

// ── Seed from SQLite ───────────────────────────────────────

const db = getDB();
const rows = db.prepare("SELECT * FROM posts ORDER BY created_at DESC").all();
if (rows.length > 0) {
  blogLoop.send("_seed", rows);
}

// ── Service wrapper (FeathersJS-style) ─────────────────────

export const blogService = createService(blogLoop, {
  methods: {
    /** List all posts */
    find: () => blogLoop.get().posts,

    /** Get single post by id */
    get: (id) => blogLoop.get().posts.find((p) => p.id === Number(id)) || null,

    /** Create a new post (loop + SQLite) */
    create: (data) => {
      blogLoop.send("_create", data);
      const post = blogLoop.get().posts[0];
      // Persist to SQLite
      db.prepare("INSERT INTO posts (title, body, author) VALUES (?, ?, ?)").run(
        post.title, post.body, post.author,
      );
      return post;
    },

    /** Update an existing post */
    update: (id, data) => {
      blogLoop.send("_update", { id: Number(id), ...data });
      const post = blogLoop.get().posts.find((p) => p.id === Number(id));
      if (post) {
        db.prepare("UPDATE posts SET title = ?, body = ?, author = ? WHERE id = ?").run(
          post.title, post.body, post.author, post.id,
        );
      }
      return post;
    },

    /** Remove a post */
    remove: (id) => {
      blogLoop.send("_remove", Number(id));
      db.prepare("DELETE FROM posts WHERE id = ?").run(Number(id));
      return { id: Number(id) };
    },
  },
});

// ── HyperGraph export ──────────────────────────────────────
//
// Every Uploop loop can describe itself as a typed graph:
//
//   blogLoop.describe() → {
//     nodes: {
//       posts:   { type: 'state', reads: [...], writes: [...] },
//       _create: { type: 'update', ... },
//       _update: { type: 'update', ... },
//       ...
//     },
//     edges: [...]
//   }
//
// This is the foundation for devtools, AI generation, and
// visual editing. Export it for the /hypergraph dashboard.

export function getBlogGraph() {
  return blogLoop.describe ? blogLoop.describe() : { nodes: {}, edges: [] };
}

export { blogLoop };
