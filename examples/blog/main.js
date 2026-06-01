import { html, component } from "@uploop/html";
import { inject, colors } from "@uploop/css";
import { createRouter } from "@uploop/router";

// Inject CSS utilities once (called from main.js, but safe to call again)
inject();

// ─── Data ───────────────────────────────────────────────────
const POSTS = [
  {
    id: "1",
    title: "Introducing Uploop",
    excerpt:
      "A new update-loop architecture for the web. No JSX, no build step, just pure ESM and HyperGraph components.",
    author: "Team Uploop",
    date: "2025-06-01",
    readTime: "3 min",
    body: "Uploop is a universal update-loop architecture for UI, data, events, storage, and side effects. It is not just another component framework — it is a small, standard-like runtime model where UI, data, style, route, motion, and effects are designed as an executable HyperGraph.\n\nEvery component exports its design graph — nodes and edges that describe exactly how data flows through your app. This gives you devtools, AI generation, visual editing, debugging, and optimization out of the box.",
  },
  {
    id: "2",
    title: "HyperGraph: The Core Idea",
    excerpt:
      "Every component exports its design graph — nodes and edges that describe exactly how data flows.",
    author: "Team Uploop",
    date: "2025-06-02",
    readTime: "4 min",
    body: "The HyperGraph manifest is the most important protocol in Uploop. Every component can output a JSON description of its internal structure: what data it reads, what events it handles, what views it renders, and how they are connected.\n\nThis means your app is not just a black box — it is an inspectable, optimizable, AI-friendly graph that can be analyzed, visualized, and even translated to other frameworks.",
  },
  {
    id: "3",
    title: "Why Frame Scheduling Matters",
    excerpt: "Micro, visual, idle — different work needs different timing.",
    author: "Dev Team",
    date: "2025-06-03",
    readTime: "2 min",
    body: "Most UI frameworks treat all updates as ASAP. But not all work is equal. Uploop introduces frame scheduling: micro-frames for instant UI patches, visual-frames for requestAnimationFrame sync, and idle-frames for background work.\n\nThis becomes the bridge to Uploop-GE later — the same scheduler that powers UI updates will also power WebGPU render passes and game loops.",
  },
  {
    id: "4",
    title: "No Build Step, No Problem",
    excerpt:
      "Uploop works directly from a CDN. Import, write components, mount.",
    author: "Dev Team",
    date: "2025-06-04",
    readTime: "1 min",
    body: 'One of the core goals of Uploop is zero build configuration. Write your components in plain JavaScript with template literals, import from any ESM CDN, and mount to the DOM.\n\nNo JSX transform, no bundler, no config files. Just a script tag with type="module" and you are ready.',
  },
  {
    id: "5",
    title: "CSP-Safe by Design",
    excerpt:
      "Inline event handlers blocked by CSP? Uploop uses data attributes and addEventListener instead.",
    author: "Security Team",
    date: "2025-06-05",
    readTime: "2 min",
    body: "The @click syntax in Uploop templates is not just syntactic sugar. It is a security feature. Instead of generating inline onclick handlers (which violate CSP), Uploop uses data-up-event markers and attaches listeners via addEventListener during mount.\n\nThis means Uploop works out of the box with strict Content Security Policies that block inline scripts.",
  },
];

// ─── Views ──────────────────────────────────────────────────
function ListView(state, { send, html }) {
  const posts = state.blogPosts || POSTS;
  return html`
    <div class="p-2" style="max-width:700px;margin:0 auto;">
      <h2 class="m-0" style="font-size:1.4rem;">📝 Blog</h2>
      <p class="mt-1 mb-2" style="font-size:0.85rem;color:#888;">
        Posts about the HyperGraph architecture
      </p>

      <input
        .value=${state.search || ""}
        @input=${["search", (e) => e.target.value]}
        placeholder="Search posts..."
        class="p-2 w-100"
        style="border:1px solid #ddd;border-radius:8px;font-size:0.9rem;margin-bottom:1rem;box-sizing:border-box;"
      />

      ${posts.length === 0
        ? html`<p style="color:#aaa;text-align:center;padding:2rem;">
            No posts found.
          </p>`
        : posts.map(
            (p) => html`
              <div
                @click=${() => send("navigate", "blog/" + p.id)}
                class="p-2 mb-1"
                style="border:1px solid #eee;border-radius:8px;cursor:pointer;background:white;transition:box-shadow 0.15s;"
                @mouseenter=${(e) =>
                  (e.currentTarget.style.boxShadow =
                    "0 2px 8px rgba(0,0,0,0.1)")}
                @mouseleave=${(e) => (e.currentTarget.style.boxShadow = "none")}
              >
                <h3 class="m-0 mb-1" style="font-size:1.05rem;">${p.title}</h3>
                <p
                  class="m-0 mb-1"
                  style="font-size:0.88rem;color:#555;line-height:1.5;"
                >
                  ${p.excerpt}
                </p>
                <div
                  style="display:flex;gap:1rem;font-size:0.78rem;color:#999;"
                >
                  <span>${p.author}</span>
                  <span>${p.date}</span>
                  <span>${p.readTime} read</span>
                </div>
              </div>
            `,
          )}
    </div>
  `;
}

function DetailView(state, { send, html }) {
  const id = state.params?.id;
  const post = POSTS.find((p) => p.id === id);
  if (!post)
    return html`<div class="p-4">
      <h2>Post not found</h2>
      <button @click=${() => send("navigate", "blog")} class="p-1">
        ← Back
      </button>
    </div>`;

  return html`
    <div class="p-2" style="max-width:700px;margin:0 auto;">
      <div class="flex-row mb-2" style="display:flex;gap:0.5rem;">
        <button
          @click=${() => send("navigate", "blog")}
          class="p-1"
          style="border:1px solid #ccc;border-radius:6px;cursor:pointer;background:white;font-size:0.85rem;"
        >
          ← Back
        </button>
        <button
          @click=${() => send("navigate", "blog/" + id + "/edit")}
          class="p-1"
          style="border:1px solid #646cff;border-radius:6px;cursor:pointer;background:#f0f0ff;color:#646cff;font-size:0.85rem;"
        >
          ✏ Edit
        </button>
      </div>
      <h1 class="m-0 mb-1" style="font-size:1.6rem;">${post.title}</h1>
      <div
        style="display:flex;gap:1rem;font-size:0.85rem;color:#888;margin-bottom:1.5rem;"
      >
        <span>${post.author}</span> <span>${post.date}</span>
        <span>${post.readTime} read</span>
      </div>
      ${post.body
        .split("\n")
        .filter(Boolean)
        .map(
          (p) => html`
            <p
              class="m-0 mb-2"
              style="line-height:1.8;font-size:1rem;color:#444;"
            >
              ${p}
            </p>
          `,
        )}
    </div>
  `;
}

function EditView(state, { send, html }) {
  const id = state.params?.id;
  const post = POSTS.find((p) => p.id === id);
  if (!post) return html`<div class="p-4"><h2>Post not found</h2></div>`;

  const title = state.editTitle ?? post.title;
  const body = state.editBody ?? post.body;

  return html`
    <div class="p-2" style="max-width:700px;margin:0 auto;">
      <div class="flex-row mb-2" style="display:flex;gap:0.5rem;">
        <button
          @click=${() => send("navigate", "blog/" + id)}
          class="p-1"
          style="border:1px solid #ccc;border-radius:6px;cursor:pointer;background:white;font-size:0.85rem;"
        >
          ← Cancel
        </button>
        <button
          @click=${() => send("saveEdit")}
          class="p-1"
          style="border:none;border-radius:6px;cursor:pointer;background:#646cff;color:white;font-size:0.85rem;"
        >
          💾 Save
        </button>
      </div>
      <h2 class="m-0 mb-2" style="font-size:1.3rem;">Edit: ${post.title}</h2>

      <label
        style="display:block;font-size:0.85rem;color:#666;margin-bottom:0.25rem;"
        >Title</label
      >
      <input
        .value=${title}
        @input=${["setEditTitle", (e) => e.target.value]}
        class="p-1 w-100 mb-2"
        style="border:1px solid #ccc;border-radius:6px;font-size:1rem;box-sizing:border-box;"
      />

      <label
        style="display:block;font-size:0.85rem;color:#666;margin-bottom:0.25rem;"
        >Body</label
      >
      <textarea
        .value=${body}
        @input=${["setEditBody", (e) => e.target.value]}
        class="p-1 w-100"
        rows="10"
        style="border:1px solid #ccc;border-radius:6px;font-size:0.9rem;box-sizing:border-box;font-family:inherit;resize:vertical;"
      ></textarea>
    </div>
  `;
}

function NotFoundView(state, { send, html }) {
  return html`<div class="p-4" style="text-align:center;">
    <h2>404 — Page Not Found</h2>
    <p style="color:#888;">The page "${state.path}" does not exist.</p>
    <button
      @click=${() => send("navigate", "blog")}
      class="p-1"
      style="border:1px solid #646cff;border-radius:6px;cursor:pointer;background:white;"
    >
      ← Go to Blog
    </button>
  </div>`;
}

// ─── Blog Component ─────────────────────────────────────────
const Blog = component("Blog", {
  state: {
    title: "Blog",
    editTitle: null,
    editBody: null,
    search: "",
    blogPosts: POSTS,
    params: {},
    path: "",
  },

  update: {
    navigate: (s, path) => {
      router.send("navigate", path);
      const r = router.match();
      return {
        ...s,
        params: r.params || {},
        path: router.getCurrentPath(),
        editTitle: null,
        editBody: null,
      };
    },
    search: (s, q) => ({
      ...s,
      search: q,
      blogPosts: POSTS.filter(
        (p) =>
          !q ||
          p.title.toLowerCase().includes(q.toLowerCase()) ||
          p.excerpt.toLowerCase().includes(q.toLowerCase()),
      ),
    }),
    setEditTitle: (s, v) => ({ ...s, editTitle: v }),
    setEditBody: (s, v) => ({ ...s, editBody: v }),
    saveEdit: (s) => {
      // Update the post in-place so detail view shows edited content
      const post = POSTS.find((p) => p.id === s.params?.id);
      if (post && s.editTitle) post.title = s.editTitle;
      if (post && s.editBody) post.body = s.editBody;
      return {
        ...s,
        editTitle: null,
        editBody: null,
        path: "blog/" + (s.params?.id || ""),
      };
    },
  },

  view: (state, { send }) => {
    // Route to view
    const path = state.path;

    // Merge route params from router
    if (path.startsWith("blog/")) {
      const subpath = path.slice(5); // "blog/42/edit" -> "42/edit"
      if (subpath.endsWith("/edit")) {
        const id = subpath.replace("/edit", "");
        return EditView({ ...state, params: { id } }, { send, html });
      }
      if (subpath && subpath !== "post") {
        return DetailView(
          { ...state, params: { id: subpath } },
          { send, html },
        );
      }
      if (subpath === "post") {
        return DetailView({ ...state, params: { id: "1" } }, { send, html });
      }
    }

    if (path === "" || path === "blog") {
      return ListView(state, { send, html });
    }

    return NotFoundView(state, { send, html });
  },
});

// ─── Router (attached to Blog component) ────────────────────
const router = createRouter(
  {
    blog: { view: "list" },
    "blog/:id": { view: "detail" },
    "blog/:id/edit": { view: "edit" },
  },
  { useHash: true },
); // hash-based to avoid conflicting with demo app URL

// Initialize blog path
Blog.loop.send("navigate", "blog");

export { Blog, router, POSTS };
export default Blog;
