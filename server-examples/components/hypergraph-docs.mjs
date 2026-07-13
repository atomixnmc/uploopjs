import { component } from "@uploop/core";
import { html } from "@uploop/html";

export const HyperGraphDocs = component("HyperGraphDocs", {
  state: { graphs: {} },

  view(s) {
    const entries = Object.entries(s.graphs);

    return html`
      <div
        style="max-width:800px;margin:0 auto;padding:2rem;font-family:system-ui"
      >
        <h2>📊 HyperGraph API Docs</h2>
        <p style="color:#888;margin-bottom:1.5rem">
          Auto-generated from live Uploop graph manifests. Every loop exports
          its structure via <code>describe()</code>.
        </p>

        ${entries.length === 0
          ? html`<p style="color:#888">No graphs available.</p>`
          : entries.map(
              ([name, info]) => {
                const graph = info.graph;
                const manifest = graph?.describe?.() || {};

                return html`
            <div
              style="border:2px solid #e0e0e0;border-radius:12px;padding:1.5rem;margin-bottom:1.5rem;background:white"
            >
              <h3 style="margin:0 0 0.25rem">
                <span style="color:#646cff"
                  >${manifest.kind || "uploop.loop"}</span
                >
                <span style="color:#333"> ${manifest.name || name}</span>
              </h3>
              <p style="color:#888;font-size:0.85rem;margin:0 0 1rem">
                ${info.desc || ""}
              </p>

              ${manifest.nodes
                ? html`
                    <div style="margin-bottom:1rem">
                      <strong style="font-size:0.85rem"
                        >Nodes
                        (${Object.keys(manifest.nodes).length})</strong
                      >
                      <div
                        style="display:flex;flex-wrap:wrap;gap:0.35rem;margin-top:0.35rem"
                      >
                        ${Object.entries(manifest.nodes).map(
                          ([nodeName, node]) => {
                            const type = node?.type || "unknown";
                            const colors = {
                              data: { bg: "#e8f5e9", fg: "#2e7d32" },
                              update: { bg: "#e3f2fd", fg: "#1565c0" },
                              view: { bg: "#fff3e0", fg: "#e65100" },
                              effect: { bg: "#f3e5f5", fg: "#7b1fa2" },
                            };
                            const c =
                              colors[type] || { bg: "#f5f5f5", fg: "#666" };
                            return html`<span
                              style="padding:0.2rem 0.5rem;border-radius:4px;font-size:0.72rem;font-family:monospace;
                        background:${c.bg};color:${c.fg}"
                            >
                              ${nodeName}
                              <span style="opacity:0.6;font-size:0.65rem"
                                >${type}</span
                              >
                            </span>`;
                          },
                        )}
                      </div>
                    </div>
                  `
                : ""}

              ${manifest.edges
                ? html`
                    <div style="margin-bottom:1rem">
                      <strong style="font-size:0.85rem"
                        >Edges (${manifest.edges.length})</strong
                      >
                      <div
                        style="font-size:0.75rem;color:#666;font-family:monospace;margin-top:0.25rem"
                      >
                        ${manifest.edges.map(
                          ([from, to]) =>
                            html`<span style="margin-right:0.75rem"
                              >${from} → ${to}</span
                            >`,
                        )}
                      </div>
                    </div>
                  `
                : ""}

              ${info.events
                ? html`
                    <div>
                      <strong style="font-size:0.85rem">Events</strong>
                      <span
                        style="font-size:0.75rem;color:#888;margin-left:0.5rem"
                      >
                        ${info.events.total} total,
                        ${info.events.rejected} rejected
                      </span>
                    </div>
                  `
                : ""}

              ${info.state
                ? html`
                    <details style="margin-top:0.75rem;font-size:0.8rem">
                      <summary style="cursor:pointer;color:#888">
                        Current State
                      </summary>
                      <pre
                        style="background:#f5f5f5;padding:0.75rem;border-radius:6px;overflow-x:auto;margin-top:0.35rem;font-size:0.75rem"
                      >
${JSON.stringify(info.state, null, 2)}</pre
                      >
                    </details>
                  `
                : ""}
            </div>
          `;
              },
            )}
      </div>
    `;
  },
});
