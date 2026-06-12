/**
 * Router Example — Multi-page app with guards, params & layout
 *
 * Demonstrates:
 *   • Exact + parametric routes (/users/:id)
 *   • Route guards (auth check)
 *   • Nested layouts (admin section)
 *   • Browser history (back/forward)
 */

import { html, component } from "@uploop/html";
import { createRouter } from "@uploop/router";

// ── Auth "database" (simulated) ──────────────────────────
const USERS = [
  { id: 1, name: "Alice", role: "admin" },
  { id: 2, name: "Bob", role: "user" },
  { id: 3, name: "Charlie", role: "user" },
];

// ── Auth guard ───────────────────────────────────────────
let _isLoggedIn = false;
let _currentUser = null;

function requireAuth(state, path) {
  if (!_isLoggedIn) {
    alert("Please log in first!");
    return false;
  }
  return true;
}

function requireAdmin(state, path) {
  if (!_currentUser || _currentUser.role !== "admin") {
    alert("Admin access required!");
    return false;
  }
  return true;
}

// ── Page components ──────────────────────────────────────

function HomePage(state) {
  return html`
    <div style="padding:1rem;">
      <h2>🏠 Home</h2>
      <p>Welcome to the router demo!</p>
      <p>Current path: <code>${state.path}</code></p>
      ${_isLoggedIn
        ? html`<p>
            Logged in as
            <strong>${_currentUser.name}</strong> (${_currentUser.role})
          </p>`
        : html`<p style="color:#888;">Not logged in</p>`}
    </div>
  `;
}

function UsersPage(state) {
  return html`
    <div style="padding:1rem;">
      <h2>👥 Users</h2>
      <ul>
        ${USERS.map(
          (u) => html`
            <li>
              <a
                href="/users/${u.id}"
                @click=${(e) => {
                  e.preventDefault();
                  router.navigate(`users/${u.id}`);
                }}
              >
                ${u.name} (${u.role})
              </a>
            </li>
          `,
        )}
      </ul>
    </div>
  `;
}

function UserDetailPage(state) {
  const user = USERS.find((u) => u.id === Number(state.params.id));
  if (!user)
    return html`<div style="padding:1rem;color:red;">User not found</div>`;

  return html`
    <div style="padding:1rem;">
      <h2>👤 ${user.name}</h2>
      <p>ID: ${user.id}</p>
      <p>Role: ${user.role}</p>
      <a
        href="/users"
        @click=${(e) => {
          e.preventDefault();
          router.navigate("users");
        }}
        >← Back to users</a
      >
    </div>
  `;
}

function AboutPage() {
  return html`
    <div style="padding:1rem;">
      <h2>📖 About</h2>
      <p>
        Uploop Router — exact matching, params, guards, layouts, lazy loading.
      </p>
      <p>Try navigating to <code>/admin</code> — it requires admin role!</p>
    </div>
  `;
}

function AdminPage() {
  return html`
    <div
      style="padding:1rem;background:#fff3cd;border:2px solid #ffc107;border-radius:4px;"
    >
      <h2>🔒 Admin Panel</h2>
      <p>You have admin access!</p>
      <p>This is wrapped in an admin layout.</p>
    </div>
  `;
}

function AdminLayout(state, content) {
  return html`
    <div style="border:2px solid #ffc107;border-radius:8px;padding:0.5rem;">
      <div
        style="background:#ffc107;color:#000;padding:0.25rem 0.5rem;border-radius:4px 4px 0 0;font-weight:bold;"
      >
        ⚠ Admin Area
      </div>
      ${content}
    </div>
  `;
}

function NotFoundPage() {
  return html`<div style="padding:1rem;color:#888;">
    <h2>404 — Page Not Found</h2>
  </div>`;
}

// ── Router ───────────────────────────────────────────────

const router = createRouter(
  {
    "": { view: HomePage },
    users: { view: UsersPage },
    "users/:id": { view: UserDetailPage },
    about: { view: AboutPage },
    admin: { view: AdminPage, guard: requireAdmin, layout: AdminLayout },
    "*": { view: NotFoundPage },
  },
  {
    useHash: true,
    onNavigate: (state, path) => {
      console.log(`Navigate: ${state.path} \u2192 ${path}`);
    },
  },
);

// ── Nav component ────────────────────────────────────────

export const RouterDemo = component("RouterDemo", {
  state: {
    path: router.getCurrentPath(),
  },

  update: {
    login: (s) => {
      _isLoggedIn = true;
      _currentUser = USERS[0]; // Alice (admin)
      return { ...s };
    },
    loginUser: (s) => {
      _isLoggedIn = true;
      _currentUser = USERS[1]; // Bob (user)
      return { ...s };
    },
    logout: (s) => {
      _isLoggedIn = false;
      _currentUser = null;
      return { ...s };
    },
    refresh: (s) => ({
      path: router.getCurrentPath(),
    }),
  },

  view: (state, { send }) => {
    return html`
      <div
        style="font-family:sans-serif;max-width:700px;margin:0 auto;padding:1rem;"
      >
        <h2>🧭 Uploop Router Demo</h2>

        <!-- Nav bar -->
        <nav
          style="display:flex;gap:0.75rem;padding:0.5rem 0;border-bottom:2px solid #eee;margin-bottom:1rem;flex-wrap:wrap;align-items:center;"
        >
          <a
            href="/"
            @click=${router.link("")}
            style="color:${state.path === ""
              ? "#646cff"
              : "#333"};text-decoration:none;font-weight:${state.path === ""
              ? "bold"
              : "normal"};"
            >Home</a
          >
          <a
            href="/users"
            @click=${router.link("users")}
            style="color:${state.path.startsWith("users")
              ? "#646cff"
              : "#333"};text-decoration:none;font-weight:${state.path.startsWith(
              "users",
            )
              ? "bold"
              : "normal"};"
            >Users</a
          >
          <a
            href="/about"
            @click=${router.link("about")}
            style="color:${state.path === "about"
              ? "#646cff"
              : "#333"};text-decoration:none;font-weight:${state.path ===
            "about"
              ? "bold"
              : "normal"};"
            >About</a
          >
          <a
            href="/admin"
            @click=${router.link("admin")}
            style="color:${state.path === "admin"
              ? "#646cff"
              : "#333"};text-decoration:none;font-weight:${state.path ===
            "admin"
              ? "bold"
              : "normal"};"
            >Admin 🔒</a
          >

          <span style="flex:1;"></span>

          ${!_isLoggedIn
            ? html`
                <button
                  @click=${() => send("login")}
                  style="padding:0.25rem 0.75rem;background:#4caf50;color:#fff;border:none;border-radius:4px;cursor:pointer;"
                >
                  Login as Admin
                </button>
                <button
                  @click=${() => send("loginUser")}
                  style="padding:0.25rem 0.75rem;background:#2196f3;color:#fff;border:none;border-radius:4px;cursor:pointer;"
                >
                  Login as User
                </button>
              `
            : html`
                <span style="font-size:0.85rem;">👤 ${_currentUser?.name}</span>
                <button
                  @click=${() => send("logout")}
                  style="padding:0.25rem 0.75rem;background:#f44336;color:#fff;border:none;border-radius:4px;cursor:pointer;"
                >
                  Logout
                </button>
              `}
        </nav>

        <!-- Route content -->
        <div id="router-outlet">${router.render()}</div>

        <!-- Debug info -->
        <details style="margin-top:1.5rem;font-size:0.8rem;color:#888;">
          <summary>Debug Info</summary>
          <pre>
Path: ${state.path}
Params: ${JSON.stringify(router.params(), null, 2)}
Loading: ${router.loading}
Error: ${router.error || "none"}</pre
          >
        </details>
      </div>
    `;
  },

  mount: (el) => {
    const unsub = router.subscribe(() => {
      // Re-render parent on route change — router.get() in view handles state
    });
    return () => unsub();
  },
});

export default RouterDemo;
