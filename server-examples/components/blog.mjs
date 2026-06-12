import { component } from "@uploop/core";
import { html } from "@uploop/html";
import { createRouter } from "@uploop/router";

export const blogRouter = createRouter(
  { "": { view: "list" }, ":id": { view: "detail" } },
  { useHash: false },
);

export const BlogList = component("BlogList", {
  state: { posts: [] },
  view: (s) => html`
    <div style="max-width:600px;margin:0 auto;padding:2rem">
      <h2>📝 Blog (SSR + SQLite)</h2>
      ${s.posts.map(
        (p) => html`
          <div
            style="padding:1rem;margin-bottom:0.5rem;border:1px solid #eee;border-radius:8px"
          >
            <a
              href="/blog/${p.id}"
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

export const BlogDetail = component("BlogDetail", {
  state: { id: "", title: "", body: "", author: "", created_at: "" },
  view: (s) => {
    if (!s.title)
      return html`<div style="padding:2rem;text-align:center">
        <h2>Not found</h2>
      </div>`;
    return html`
      <div style="max-width:600px;margin:0 auto;padding:2rem">
        <h2 style="margin-top:0.5rem">${s.title}</h2>
        <p style="color:#888;font-size:0.8rem">${s.author} · ${s.created_at}</p>
        <p style="line-height:1.8;color:#444;margin-top:1rem">${s.body}</p>
      </div>
    `;
  },
});
