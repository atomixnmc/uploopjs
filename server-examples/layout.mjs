/**
 * Layout — shared page shell with sidebar navigation.
 * All pages use this wrapper for consistent navigation.
 */

/**
 * Render a page with the sidebar navigation layout.
 * @param {string} title - Page title
 * @param {string} content - Page content HTML
 * @param {string} [activePath] - Current active path for highlighting
 * @returns {string} Full HTML page
 */
export function wrapPage(title, content, activePath = "/") {
  const nav = buildSidebar(activePath);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Uploop SST</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0 }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #f5f5f8;
      color: #333;
      display: flex;
      min-height: 100vh;
    }

    /* ── Sidebar ── */
    nav.sidebar {
      width: 240px;
      min-width: 240px;
      background: #1a1a2e;
      color: #cdd6f4;
      padding: 1.5rem 0;
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 0; left: 0; bottom: 0;
      overflow-y: auto;
      z-index: 100;
      box-shadow: 2px 0 12px rgba(0,0,0,0.15);
    }

    nav.sidebar .brand {
      padding: 0 1.25rem 1rem;
      border-bottom: 1px solid #313155;
      margin-bottom: 0.75rem;
    }

    nav.sidebar .brand h2 {
      font-size: 1.1rem;
      font-weight: 700;
      color: #646cff;
    }

    nav.sidebar .brand span {
      font-size: 0.7rem;
      color: #6c7086;
    }

    nav.sidebar .section {
      padding: 0.5rem 1.25rem 0.25rem;
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6c7086;
    }

    nav.sidebar a {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.5rem 1.25rem;
      font-size: 0.85rem;
      color: #a6adc8;
      text-decoration: none;
      transition: all 0.15s;
      border-left: 3px solid transparent;
    }

    nav.sidebar a:hover {
      background: #313155;
      color: #cdd6f4;
    }

    nav.sidebar a.active {
      background: #313155;
      color: #646cff;
      border-left-color: #646cff;
      font-weight: 600;
    }

    nav.sidebar a .icon {
      font-size: 1.1rem;
      width: 24px;
      text-align: center;
    }

    nav.sidebar .version {
      margin-top: auto;
      padding: 1rem 1.25rem 0;
      font-size: 0.7rem;
      color: #585b70;
      border-top: 1px solid #313155;
    }

    /* ── Content ── */
    main.content {
      margin-left: 240px;
      flex: 1;
      padding: 2rem;
      min-height: 100vh;
    }

    /* ── Mobile ── */
    @media (max-width: 640px) {
      nav.sidebar {
        width: 100%;
        position: relative;
        min-width: unset;
        flex-direction: row;
        flex-wrap: wrap;
        padding: 0.75rem;
        gap: 0.25rem;
      }
      nav.sidebar .brand,
      nav.sidebar .section,
      nav.sidebar .version {
        display: none;
      }
      nav.sidebar a {
        padding: 0.35rem 0.6rem;
        font-size: 0.75rem;
        border-left: none;
        border-radius: 6px;
      }
      body { flex-direction: column }
      main.content { margin-left: 0; padding: 1rem }
    }
  </style>
  <!-- Hot reload: browser refreshes when server restarts -->
  <script>
    (function() {
      var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      function connect() {
        var ws = new WebSocket(proto + '//' + location.host + '/ws-hotreload');
        var wasOpen = false;
        ws.onopen = function() {
          if (wasOpen) location.reload();
          wasOpen = true;
        };
        ws.onclose = function() { setTimeout(connect, 300); };
        ws.onerror = function() { ws.close(); };
      }
      connect();
    })();
  </script>
</head>
<body>
  ${nav}
  <main class="content">${content}</main>
</body>
</html>`;
}

function buildSidebar(activePath) {
  const sections = [
    {
      label: "Pages",
      items: [
        {
          href: "/counter",
          icon: "🔢",
          label: "Counter",
          desc: "SSR + Hydration",
        },
        { href: "/blog", icon: "📝", label: "Blog", desc: "SSR + SQLite" },
        { href: "/todos", icon: "📋", label: "Todos", desc: "Service Pattern" },
      ],
    },
    {
      label: "Realtime",
      items: [
        { href: "/chat", icon: "💬", label: "Chat", desc: "WebSocket" },
        { href: "/chess", icon: "♟", label: "Chess", desc: "Multiplayer Game" },
        {
          href: "/slither",
          icon: "🐍",
          label: "Slither",
          desc: "Multiplayer Game",
        },
      ],
    },
    {
      label: "Styling",
      items: [
        { href: "/css-demo", icon: "🎨", label: "CSS", desc: "Server Theming" },
      ],
    },
    {
      label: "API",
      items: [
        {
          href: "/api-docs",
          icon: "📡",
          label: "API Docs",
          desc: "Specs + Tester",
        },
        {
          href: "/api/todos",
          icon: "📡",
          label: "Todos API",
          desc: "REST JSON",
        },
        { href: "/api/blog", icon: "📡", label: "Blog API", desc: "REST JSON" },
        {
          href: "/api/state",
          icon: "📡",
          label: "State",
          desc: "Full Snapshot",
        },
      ],
    },
    {
      label: "Introspection",
      items: [
        {
          href: "/hypergraph",
          icon: "📊",
          label: "HyperGraph",
          desc: "Live Graph Docs",
        },
      ],
    },
  ];

  let html = `<nav class="sidebar">
    <div class="brand">
      <h2>⚡ Uploop SST</h2>
      <span>Server-Side Toolset v0.5</span>
    </div>
    <a href="/" class="${activePath === "/" ? "active" : ""}">
      <span class="icon">🏠</span> Home
    </a>`;

  for (const section of sections) {
    html += `<div class="section">${section.label}</div>`;
    for (const item of section.items) {
      const isActive =
        activePath === item.href || activePath.startsWith(item.href + "/");
      html += `<a href="${item.href}" class="${isActive ? "active" : ""}" title="${item.desc}">
        <span class="icon">${item.icon}</span> ${item.label}
      </a>`;
    }
  }

  html += `<div class="version">Hot reload enabled</div></nav>`;
  return html;
}

export function errorPage(message) {
  return wrapPage(
    "Error",
    `<div style="text-align:center;padding:3rem"><h1>Error</h1><p>${message}</p></div>`,
  );
}

export function notFoundPage() {
  return wrapPage(
    "404",
    '<div style="text-align:center;padding:3rem"><h1>404</h1><p>Page not found</p></div>',
  );
}
