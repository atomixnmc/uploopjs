import { component } from "@uploop/core";
import { html } from "@uploop/html";

export const Landing = component("Landing", {
  view: () => html`
    <div style="max-width:600px;margin:0 auto;padding:2rem;text-align:center">
      <h1 style="font-size:2rem;margin-bottom:0.5rem">⚡ Uploop SST</h1>
      <p style="color:#888;margin-bottom:2rem">
        Server-Side Toolset — SSR, hydration, remote loops, services
      </p>
      <div
        style="display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;max-width:400px;margin:0 auto"
      >
        ${[
          {
            href: "/counter",
            icon: "🔢",
            title: "Counter",
            desc: "SSR + Hydration",
          },
          { href: "/blog", icon: "📝", title: "Blog", desc: "SSR + Router" },
          {
            href: "/todos",
            icon: "📋",
            title: "Todos",
            desc: "Service Pattern",
          },
          { href: "/chat", icon: "💬", title: "Chat", desc: "WebSocket" },
          {
            href: "/css-demo",
            icon: "🎨",
            title: "CSS",
            desc: "Server Theming",
          },
          { href: "/api/todos", icon: "🔌", title: "API", desc: "REST API" },
          {
            href: "/slither",
            icon: "🐍",
            title: "Slither",
            desc: "Multiplayer Game",
          },
        ].map(
          (c) => html`
            <a
              href="${c.href}"
              class="card"
              style="padding:1.5rem;border:2px solid #eee;border-radius:12px;text-decoration:none;color:#333;transition:all 0.2s;display:block"
            >
              <div style="font-size:2rem;margin-bottom:0.5rem">${c.icon}</div>
              <strong>${c.title}</strong>
              <p style="font-size:0.8rem;color:#888;margin:0.25rem 0 0">
                ${c.desc}
              </p>
            </a>
          `,
        )}
      </div>
      <p style="margin-top:2rem;font-size:0.75rem;color:#aaa">
        v0.5.0 · Hot reload enabled
      </p>
    </div>
  `,
});
