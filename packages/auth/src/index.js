/**
 * @uploop/auth — Declarative authentication & authorization
 *
 * 8 core concepts following Uploop philosophy:
 *   loop-first, declarative metadata, convention over configuration,
 *   HyperGraph-compatible, state-machine inspired.
 *
 *   1. createAuthSession — core auth state machine (loop)
 *   2. withCredentials    — username/password login
 *   3. withToken          — JWT/token lifecycle
 *   4. withRoles          — role-based access (RBAC)
 *   5. withPermissions    — fine-grained permission checks
 *   6. withPassword       — password hashing (bcrypt)
 *   7. withOAuth          — social login providers
 *   8. guard              — declarative route protection
 *
 * Inspired by @uploop/state-machine:
 *   Auth states: anonymous → authenticating → authenticated → expired
 *   Guards are declarative metadata on routes/loops.
 *   Session is a loop — send() login/logout, get() current user.
 *
 * Usage:
 *   import { createAuthSession, guard, withCredentials } from '@uploop/auth'
 *   const auth = createAuthSession({ ... })
 *   auth.send('login', { username, password })
 *   guard(auth, { role: 'admin' })(req) → true/false
 */

import { createLoop, uuid } from "@uploop/core";

// ── 1. createAuthSession — core auth state machine ─────────
//
// Auth is a finite state loop:
//   anonymous → authenticating → authenticated → expired
//                       ↑                          ↓
//                   refreshing ←────────────────────┘
//
// State shape:
//   { status, user, token, error, sessionId, expiresAt }
//
// Events:
//   login(credentials) → authenticating → authenticated
//   logout()           → authenticated → anonymous
//   refresh()          → expired → authenticated (with valid refresh token)
//   expire()           → authenticated → expired (token TTL elapsed)

export function createAuthSession(config = {}) {
  const {
    // Credential validator — receives { username, password }, returns user or null
    validateCredentials = null,
    // Token handler — { sign(user), verify(token), refresh(token) }
    tokenHandler = null,
    // Session TTL in ms (default 24h)
    sessionTTL = 24 * 60 * 60 * 1000,
    // Refresh token TTL in ms (default 7d)
    refreshTTL = 7 * 24 * 60 * 60 * 1000,
    // Initial user (for SSR session hydration)
    initialUser = null,
    // Optional session store (default: in-memory)
    sessionStore = null,
  } = config;

  const authLoop = createLoop({
    state: {
      status: initialUser ? "authenticated" : "anonymous",  // 'anonymous' | 'authenticating' | 'authenticated' | 'expired'
      user: initialUser || null,    // { id, username, roles, permissions, ... }
      token: null,                  // current JWT or session token
      refreshToken: null,           // long-lived refresh token
      error: null,                  // last auth error message
      sessionId: null,              // unique session identifier
      expiresAt: null,              // token expiry timestamp
    },

    update: {
      /** Start login flow — transitions to 'authenticating' */
      login(s, credentials) {
        return {
          status: "authenticating",
          error: null,
          user: null,
          token: null,
          refreshToken: null,
          sessionId: uuid(),
          expiresAt: null,
        };
      },

      /** Login succeeded — transitions to 'authenticated' */
      _authenticated(s, { user, token, refreshToken }) {
        return {
          status: "authenticated",
          user,
          token,
          refreshToken: refreshToken || null,
          error: null,
          expiresAt: Date.now() + sessionTTL,
        };
      },

      /** Login failed — transitions back to 'anonymous' with error */
      _loginFailed(s, error) {
        return {
          status: "anonymous",
          error: typeof error === "string" ? error : error?.message || "Authentication failed",
          user: null,
          token: null,
        };
      },

      /** Logout — transitions to 'anonymous', clears session */
      logout(s) {
        return {
          status: "anonymous",
          user: null,
          token: null,
          refreshToken: null,
          sessionId: null,
          expiresAt: null,
          error: null,
        };
      },

      /** Token expired — transitions to 'expired' */
      expire(s) {
        return s.status === "authenticated" ? { status: "expired" } : s;
      },

      /** Refresh token — transitions back to 'authenticated' */
      _refreshed(s, { token, expiresAt }) {
        return {
          status: "authenticated",
          token,
          expiresAt: expiresAt || Date.now() + sessionTTL,
          error: null,
        };
      },

      /** Refresh failed — stays expired, clears tokens */
      _refreshFailed(s, error) {
        return {
          status: "anonymous",
          token: null,
          refreshToken: null,
          error: typeof error === "string" ? error : "Token refresh failed",
        };
      },
    },
  });

  // ── Token expiry watcher (runs each get()) ──────────────
  const _origGet = authLoop.get;
  authLoop.get = function () {
    const s = _origGet.call(authLoop);
    if (s.status === "authenticated" && s.expiresAt && Date.now() > s.expiresAt) {
      authLoop.send("expire");
      return authLoop.get();
    }
    return s;
  };

  // ── Auto-validate credentials if handler provided ──────
  if (validateCredentials) {
    authLoop.on?.("login", async (s, credentials) => {
      try {
        const user = await validateCredentials(credentials);
        if (!user) {
          authLoop.send("_loginFailed", "Invalid credentials");
          return;
        }
        const token = tokenHandler?.sign
          ? await tokenHandler.sign(user)
          : `tok_${uuid()}`;
        authLoop.send("_authenticated", {
          user,
          token,
          refreshToken: tokenHandler?.sign
            ? await tokenHandler.sign({ ...user, _refresh: true })
            : `ref_${uuid()}`,
        });
      } catch (e) {
        authLoop.send("_loginFailed", e.message);
      }
    });
  }

  return authLoop;
}

// ── 2. withCredentials — username/password auth ────────────
//
// Validates credentials against a user store.
// Returns a validateCredentials function for createAuthSession.
//
//   const auth = createAuthSession({
//     validateCredentials: withCredentials(async ({ username, password }) => {
//       const user = await db.users.findByUsername(username);
//       if (!user) return null;
//       const valid = await verifyPassword(password, user.hash);
//       return valid ? { id: user.id, username, roles: user.roles } : null;
//     })
//   })

export function withCredentials(validateFn) {
  return async (credentials) => {
    if (!credentials?.username || !credentials?.password) return null;
    return validateFn(credentials);
  };
}

// ── 3. withToken — JWT/token lifecycle ─────────────────────
//
// Creates sign/verify/refresh handlers for JWTs.
// Uses a secret key + optional expiry configuration.
//
//   const tokenHandler = withToken({ secret: 'my-secret', expiresIn: '24h' })
//   const auth = createAuthSession({ tokenHandler, validateCredentials })

export function withToken(config = {}) {
  const { secret = "uploop", expiresIn = "24h", refreshIn = "7d" } = config;

  function parseDuration(d) {
    const m = /^(\d+)([smhd])$/.exec(d);
    if (!m) return 24 * 60 * 60 * 1000;
    const v = parseInt(m[1]);
    const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return v * (units[m[2]] || 3600000);
  }

  // ── Simple HMAC-like token (no crypto dependency) ──────
  // In production, use jsonwebtoken or jose library.
  function _sign(payload) {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = btoa(
      JSON.stringify({
        ...payload,
        iat: Date.now(),
        exp: Date.now() + parseDuration(expiresIn),
      }),
    );
    const sig = btoa(`${header}.${body}.${secret}`);
    return `${header}.${body}.${sig}`;
  }

  function _verify(token) {
    try {
      const [header, body, sig] = token.split(".");
      const expected = btoa(`${header}.${body}.${secret}`);
      if (sig !== expected) return null;
      const payload = JSON.parse(atob(body));
      if (payload.exp && Date.now() > payload.exp) return null;
      return payload;
    } catch {
      return null;
    }
  }

  return {
    sign: _sign,
    verify: _verify,
    refresh: (token) => {
      const payload = _verify(token);
      if (!payload) return null;
      delete payload.exp;
      return _sign(payload);
    },
  };
}

// ── 4. withRoles — role-based access control (RBAC) ────────
//
//   const checkRole = withRoles(['admin', 'editor'])
//   checkRole(auth.get().user) → true/false

export function withRoles(allowedRoles) {
  return (user) => {
    if (!user) return false;
    const userRoles = user.roles || [];
    if (!Array.isArray(allowedRoles)) allowedRoles = [allowedRoles];
    return allowedRoles.some((r) => userRoles.includes(r));
  };
}

// ── 5. withPermissions — fine-grained permission checks ────
//
//   const canEdit = withPermissions('posts:write')
//   canEdit(auth.get().user) → true/false
//
// Supports wildcards: 'posts:*' matches 'posts:read', 'posts:write', etc.

export function withPermissions(requiredPermissions) {
  if (!Array.isArray(requiredPermissions)) requiredPermissions = [requiredPermissions];

  return (user) => {
    if (!user) return false;
    const userPerms = user.permissions || [];
    return requiredPermissions.every((req) =>
      userPerms.some((up) => {
        if (req === up) return true;
        // Wildcard: 'posts:*' matches 'posts:read'
        if (req.endsWith(":*")) {
          const prefix = req.slice(0, -2);
          return up.startsWith(prefix + ":");
        }
        return false;
      }),
    );
  };
}

// ── 6. withPassword — password hashing ────────────────────
//
//   const { hash, verify } = withPassword()
//   const hashed = await hash('password123')
//   const valid = await verify('password123', hashed)
//
// Uses Web Crypto API (SHA-256 + salt). Production should use bcrypt.

export function withPassword() {
  // Simple SHA-256 based hashing with salt.
  // In production, use bcryptjs or argon2.
  async function hash(password) {
    const salt = crypto.randomUUID();
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `uploop:${salt}:${hashHex}`;
  }

  async function verify(password, stored) {
    if (!stored || !stored.startsWith("uploop:")) return false;
    const [, salt, originalHash] = stored.split(":");
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const computedHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return computedHash === originalHash;
  }

  return { hash, verify };
}

// ── 7. withOAuth — social login providers ──────────────────
//
//   const oauth = withOAuth({
//     github: { clientId: '...', clientSecret: '...', redirectUri: '...' }
//   })
//   const url = oauth.getRedirectUrl('github')
//   const user = await oauth.handleCallback('github', code)

export function withOAuth(providers = {}) {
  function getRedirectUrl(provider, state) {
    const p = providers[provider];
    if (!p) throw new Error(`Unknown provider: ${provider}`);
    const params = new URLSearchParams({
      client_id: p.clientId,
      redirect_uri: p.redirectUri,
      response_type: "code",
      scope: p.scope || "read:user user:email",
      state: state || uuid(),
    });
    if (provider === "github") return `https://github.com/login/oauth/authorize?${params}`;
    if (provider === "google") return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    return `${p.authUrl || ""}?${params}`;
  }

  async function handleCallback(provider, code) {
    const p = providers[provider];
    if (!p) throw new Error(`Unknown provider: ${provider}`);
    // Exchange code for token, fetch user profile
    // Simplified — production would use fetch + provider-specific APIs
    const tokenRes = await fetch(p.tokenUrl || `https://github.com/login/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: p.clientId,
        client_secret: p.clientSecret,
        code,
        redirect_uri: p.redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) return null;

    const userRes = await fetch(p.userUrl || "https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await userRes.json();
    return {
      id: `${provider}_${profile.id || profile.sub}`,
      username: profile.login || profile.name || profile.email,
      email: profile.email,
      avatar: profile.avatar_url || profile.picture,
      provider,
    };
  }

  return { getRedirectUrl, handleCallback };
}

// ── 8. guard — declarative route/middleware protection ─────
//
// Guards are first-class metadata. Inspired by @uploop/state-machine
// guards and @uploop/router route guards.
//
//   // Role guard
//   guard(auth, { role: 'admin' })
//
//   // Permission guard
//   guard(auth, { permission: 'posts:write' })
//
//   // Combined guard
//   guard(auth, { role: ['admin', 'editor'], permission: 'posts:read' })
//
//   // Auth-only guard (any authenticated user)
//   guard(auth, { authenticated: true })
//
//   // Usage in SST routes:
//   if (path === '/admin') {
//     if (!guard(auth, { role: 'admin' })(req)) return forbidden(res)
//     return ok(res, adminPage)
//   }

export function guard(authLoop, rules = {}) {
  return (req) => {
    const state = authLoop.get();

    // Rule: must be authenticated
    if (rules.authenticated) {
      if (state.status !== "authenticated") return false;
    }

    // Rule: role check
    if (rules.role) {
      const check = withRoles(rules.role);
      if (!check(state.user)) return false;
    }

    // Rule: permission check
    if (rules.permission) {
      const check = withPermissions(rules.permission);
      if (!check(state.user)) return false;
    }

    // Rule: custom predicate
    if (typeof rules.check === "function") {
      if (!rules.check(state.user, req)) return false;
    }

    return true;
  };
}

// ── Utility: HTTP response helpers for guards ──────────────

export function forbidden(res, message = "Forbidden") {
  res.writeHead(403, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: message }));
}

export function unauthorized(res, message = "Unauthorized") {
  res.writeHead(401, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: message }));
}

// ── Re-export for convenience ──────────────────────────────

export default {
  createAuthSession,
  withCredentials,
  withToken,
  withRoles,
  withPermissions,
  withPassword,
  withOAuth,
  guard,
  forbidden,
  unauthorized,
};
