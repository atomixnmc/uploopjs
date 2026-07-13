import { component } from "@uploop/core";
import { html } from "@uploop/html";

const colors = { primary: "#4f46e5", success: "#059669", info: "#0ea5e9" };

export const CSSDemo = component("CSSDemo", {
  view: () => {
    return html`
      <style>
        :root {
          --color-primary: ${colors.primary};
          --color-success: ${colors.success};
          --color-info: ${colors.info};
        }
      </style>
      <div style="max-width:600px;margin:0 auto;padding:2rem">
        <h2>🎨 CSS (Server-Side Theming)</h2>
        <p style="color:#888;margin-bottom:1rem">
          Theme tokens via &lt;style&gt; :root custom properties and inline
          hardcoded values
        </p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem">
          <div
            style="padding:1.5rem;background:${colors.primary};color:white;border-radius:12px;text-align:center"
          >
            <strong>Primary</strong><br /><span style="font-size:0.8rem"
              >#4f46e5</span
            >
          </div>
          <div
            style="padding:1.5rem;background:${colors.success};color:white;border-radius:12px;text-align:center"
          >
            <strong>Success</strong><br /><span style="font-size:0.8rem"
              >#059669</span
            >
          </div>
          <div
            style="padding:1.5rem;background:${colors.info};color:white;border-radius:12px;text-align:center"
          >
            <strong>Info</strong><br /><span style="font-size:0.8rem"
              >#0ea5e9</span
            >
          </div>
        </div>
        <p style="font-size:0.8rem;color:#888;margin-top:1rem">
          Theme: brand · Hardcoded color values + :root CSS custom properties
          for JS access
        </p>
      </div>
    `;
  },
});
