import { component } from "@uploop/core";
import { html } from "@uploop/html";

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/todos",
    desc: "List all todos",
    params: [],
    body: null,
    response: {
      type: "array",
      item: { id: "number", text: "string", done: "boolean" },
    },
    example: '[{"id":1,"text":"Learn Uploop SSR","done":false}]',
  },
  {
    method: "POST",
    path: "/api/todos",
    desc: "Create a new todo",
    params: [],
    body: { text: "string (required)" },
    response: {
      type: "object",
      fields: { id: "number", text: "string", done: "boolean" },
    },
    example: '{"id":4,"text":"New task","done":false}',
  },
  {
    method: "DELETE",
    path: "/api/todos/:id",
    desc: "Delete a todo by ID",
    params: [{ name: "id", type: "number", desc: "Todo ID" }],
    body: null,
    response: { type: "object", fields: { id: "number" } },
    example: '{"id":1}',
  },
  {
    method: "GET",
    path: "/api/blog",
    desc: "List all blog posts from SQLite",
    params: [],
    body: null,
    response: {
      type: "array",
      item: {
        id: "number",
        title: "string",
        body: "string",
        author: "string",
        created_at: "string",
      },
    },
    example:
      '[{"id":1,"title":"Introducing Uploop SST","body":"Server-side rendering...","author":"Team"}]',
  },
  {
    method: "POST",
    path: "/api/blog",
    desc: "Create a new blog post",
    params: [],
    body: {
      title: "string (required)",
      body: "string (required)",
      author: "string",
    },
    response: {
      type: "object",
      fields: { id: "number", title: "string", body: "string" },
    },
    example: '{"id":4,"title":"New Post","body":"Content here"}',
  },
  {
    method: "GET",
    path: "/api/state",
    desc: "Full state snapshot of all running loops",
    params: [],
    body: null,
    response: { type: "object", fields: { todos: "array", chat: "object" } },
    example: '{"todos":[...],"chat":{"messages":[],"online":0}}',
  },
];

export const APIDocs = component("APIDocs", {
  view: () => html`
    <style>
      .api-card {
        border: 1px solid #e5e5e5;
        border-radius: 12px;
        margin-bottom: 1.25rem;
        background: #fff;
        overflow: hidden;
        transition: box-shadow 0.15s;
      }
      .api-card:hover {
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
      }
      .api-card-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid #f0f0f0;
        background: #fafbfc;
      }
      .api-method {
        padding: 0.2rem 0.6rem;
        border-radius: 6px;
        font-size: 0.72rem;
        font-weight: 700;
        font-family: monospace;
        min-width: 56px;
        text-align: center;
      }
      .method-GET {
        background: #e8f5e9;
        color: #1b5e20;
      }
      .method-POST {
        background: #e3f2fd;
        color: #0d47a1;
      }
      .method-DELETE {
        background: #ffebee;
        color: #b71c1c;
      }
      .api-path {
        font-family: "SF Mono", "Fira Code", monospace;
        font-size: 0.88rem;
        color: #333;
      }
      .api-body {
        padding: 1rem 1.25rem;
      }
      .api-desc {
        color: #555;
        font-size: 0.88rem;
        margin: 0 0 0.75rem;
      }
      .api-section-title {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #999;
        margin: 0.75rem 0 0.35rem;
      }
      .api-params {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .api-param {
        padding: 0.15rem 0.5rem;
        background: #f5f5f5;
        border-radius: 4px;
        font-size: 0.75rem;
        font-family: monospace;
        color: #555;
      }
      .api-param-type {
        color: #888;
        font-size: 0.65rem;
      }
      .api-tester {
        display: flex;
        gap: 0.5rem;
        margin: 0.75rem 0;
      }
      .api-input {
        flex: 1;
        padding: 0.5rem 0.6rem;
        border: 1px solid #d0d5dd;
        border-radius: 8px;
        font-family: monospace;
        font-size: 0.8rem;
        resize: vertical;
        outline: none;
        transition: border-color 0.15s;
      }
      .api-input:focus {
        border-color: #646cff;
      }
      .api-send {
        padding: 0.5rem 1rem;
        background: #646cff;
        color: #fff;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 600;
        transition: background 0.15s;
      }
      .api-send:hover {
        background: #535bf2;
      }
      .api-output {
        background: #1e1e2e;
        color: #cdd6f4;
        padding: 0.75rem;
        border-radius: 8px;
        font-size: 0.75rem;
        font-family: monospace;
        max-height: 180px;
        overflow: auto;
        display: none;
        white-space: pre-wrap;
      }
      .api-response-fields {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
      }
      .api-field {
        padding: 0.12rem 0.45rem;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        font-size: 0.7rem;
        font-family: monospace;
        background: #fafafa;
      }
      .api-field-type {
        color: #888;
      }
    </style>

    <div
      style="max-width:780px;margin:0 auto;padding:1.5rem 2rem;font-family:system-ui,-apple-system,sans-serif"
    >
      <div style="margin-bottom:2rem">
        <h2 style="font-size:1.4rem;margin:0 0 0.25rem">📡 API Reference</h2>
        <p style="color:#888;font-size:0.9rem;margin:0">
          OpenAPI-style specs with live tester — powered by Uploop's service
          layer + SQLite
        </p>
      </div>

      ${ENDPOINTS.map((ep) => {
        const id = (ep.method + "-" + ep.path)
          .replace(/[\/:]/g, "-")
          .replace(/-+/g, "-");
        const hasTester = ep.method === "POST" || ep.method === "PUT";

        return html`
          <div class="api-card">
            <div class="api-card-header">
              <span class="api-method method-${ep.method}">${ep.method}</span>
              <code class="api-path">${ep.path}</code>
            </div>
            <div class="api-body">
              <p class="api-desc">${ep.desc}</p>

              ${ep.params.length > 0
                ? html`
                    <div class="api-section-title">Parameters</div>
                    <div class="api-params">
                      ${ep.params.map(
                        (p) => html`
                          <span class="api-param">
                            ${p.name}
                            <span class="api-param-type">${p.type}</span>
                          </span>
                        `,
                      )}
                    </div>
                  `
                : ""}
              ${ep.body
                ? html`
                    <div class="api-section-title">Request Body</div>
                    <div class="api-response-fields">
                      ${Object.entries(ep.body).map(
                        ([k, v]) => html`
                          <span class="api-field">
                            ${k}
                            <span class="api-field-type">${v}</span>
                          </span>
                        `,
                      )}
                    </div>
                  `
                : ""}
              ${ep.response
                ? html`
                    <div class="api-section-title">Response</div>
                    <div class="api-response-fields">
                      ${ep.response.type === "array"
                        ? html`<span class="api-field"
                              >Array<span class="api-field-type"
                                >&lt;object&gt;</span
                              ></span
                            >
                            ${Object.entries(ep.response.item || {}).map(
                              ([k, v]) => html`
                                <span class="api-field">
                                  ${k}
                                  <span class="api-field-type">${v}</span>
                                </span>
                              `,
                            )}`
                        : Object.entries(ep.response.fields || {}).map(
                            ([k, v]) => html`
                              <span class="api-field">
                                ${k}
                                <span class="api-field-type">${v}</span>
                              </span>
                            `,
                          )}
                    </div>
                  `
                : ""}
              ${hasTester
                ? html`
                    <div class="api-section-title">Try it</div>
                    <div class="api-tester">
                      <textarea
                        id="${id}-input"
                        class="api-input"
                        rows="2"
                        placeholder="${ep.body ? JSON.stringify(ep.body) : ""}"
                      >
${ep.example}</textarea
                      >
                      <button id="${id}-btn" class="api-send">▶ Send</button>
                    </div>
                    <pre id="${id}-output" class="api-output"></pre>
                  `
                : ""}

              <details style="margin-top:0.75rem;font-size:0.8rem">
                <summary style="color:#888;cursor:pointer">
                  Example response
                </summary>
                <pre
                  style="background:#f5f5f5;padding:0.6rem;border-radius:6px;font-size:0.75rem;overflow-x:auto;margin-top:0.35rem"
                >
${ep.example}</pre
                >
              </details>
            </div>
          </div>
        `;
      })}
    </div>
  `,
});

export function apiDocsClientScript() {
  return `<script>
setTimeout(function() {
  document.querySelectorAll('[id$="-btn"]').forEach(function(btn) {
    btn.onclick = async function() {
      var id = btn.id.replace('-btn', '');
      var input = document.getElementById(id + '-input');
      var output = document.getElementById(id + '-output');
      // Parse method from ID: e.g. "POST--api-todos" → POST, /api/todos
      var method = id.startsWith('GET-') ? 'GET' : id.startsWith('POST-') ? 'POST' : 'DELETE';
      var path = '/' + id.substring(method.length + 1).replace(/--/g, '/').replace(/-/g, '/').replace(/\/\//g, '/');
      output.style.display = 'block';
      output.textContent = '⏳ Sending ' + method + ' ' + path + '...';
      try {
        var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
        if (input && input.value.trim() && method !== 'GET') opts.body = input.value;
        var res = await fetch(path, opts);
        var data = await res.json();
        output.textContent = '✓ ' + res.status + ' ' + res.statusText + '\\n\\n' + JSON.stringify(data, null, 2);
      } catch(e) {
        output.textContent = '✗ Error: ' + e.message;
      }
    };
  });
}, 100);
</script>`;
}
