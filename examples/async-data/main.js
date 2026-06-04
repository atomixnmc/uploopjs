/**
 * Async Data Example — Demonstrates all v0.3.0 async metadata
 *
 * Features demonstrated:
 *   • debounce — search input with 300ms debounce
 *   • suspend — loading/error/success states via suspend()
 *   • error — retry with exponential backoff + fallback
 *   • interruptible — auto AbortController for fetch
 *   • cache — TTL + SWR for API results
 *   • dev — dev-mode validation
 *
 * Simulates a GitHub-style user search with all async concerns
 * handled declaratively by the framework — zero manual timer/AbortController/loading boilerplate.
 */

import { html, component, suspend } from '@uploop/html'
import { createLoop } from '@uploop/core'

// ── Simulated API (since we can't hit real GitHub without CORS) ──
const FAKE_USERS = [
  { login: 'alice', name: 'Alice Johnson', repos: 42, followers: 120 },
  { login: 'bob', name: 'Bob Smith', repos: 17, followers: 45 },
  { login: 'charlie', name: 'Charlie Brown', repos: 89, followers: 230 },
  { login: 'diana', name: 'Diana Prince', repos: 156, followers: 890 },
  { login: 'eve', name: 'Eve Wilson', repos: 5, followers: 12 },
  { login: 'frank', name: 'Frank Miller', repos: 34, followers: 67 },
  { login: 'grace', name: 'Grace Hopper', repos: 200, followers: 5000 },
  { login: 'hank', name: 'Hank Green', repos: 23, followers: 89 },
]

let _failCount = 0

// Simulate network delay + occasional failures
async function searchUsersAPI(query, { signal } = {}) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 500 + Math.random() * 1000)
    if (signal) signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) })
  })

  // Simulate occasional failures (first 2 calls fail, then succeed — demo retry)
  if (_failCount < 2) {
    _failCount++
    throw new Error('Network error — simulated failure #' + _failCount)
  }

  _failCount = 0
  const q = query.toLowerCase()
  return FAKE_USERS.filter(u =>
    u.login.includes(q) || u.name.toLowerCase().includes(q)
  )
}

// ── Async search loop ────────────────────────────────────
const searchLoop = createLoop({
  name: 'asyncSearch',
  state: {
    query: '',
    results: [],
    selectedUser: null
  },

  cache: {
    results: { ttl: 10000, swr: true }
  },

  error: {
    search: { retry: 3, fallback: { results: [], selectedUser: null } }
  },

  update: {
    search: {
      debounce: 300,
      interruptible: true,
      run: async (state, query, { signal } = {}) => {
        if (!query.trim()) return { results: [], selectedUser: null }
        const results = await searchUsersAPI(query, { signal })
        return { results }
      }
    },

    selectUser: (s, user) => ({ selectedUser: user }),

    clearSelection: (s) => ({ selectedUser: null }),

    refresh: (s) => {
      searchLoop.invalidateCache('results')
      searchLoop.send('search', s.query)
      return s
    }
  },

  dev: true
})

// ── Type-ahead component ─────────────────────────────────

const SearchInput = component('SearchInput', {
  view: (state) => html`
    <div style="position:relative;">
      <input type="text" placeholder="Search users (try 'a', 'bob', 'grace')..."
        .value=${state.query}
        @input=${['input', e => e.target.value]}
        style="width:100%;padding:0.6rem 0.75rem;border:2px solid #ddd;border-radius:8px;font-size:1rem;box-sizing:border-box;"
        autocomplete="off"
      />
      ${state.query ? html`
        <button @click=${() => searchLoop.send('search', '')}
          style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1.2rem;color:#888;">
          ×
        </button>
      ` : ''}
    </div>
  `,
  update: {
    input: (s, value) => {
      searchLoop.send('search', value)
      return { ...s, query: value }
    }
  }
})

// ── User card ────────────────────────────────────────────

const UserCard = component('UserCard', {
  view: (state) => html`
    <div @click=${() => searchLoop.send('selectUser', state)}
      style="padding:0.75rem;border:1px solid #eee;border-radius:8px;cursor:pointer;
        display:flex;align-items:center;gap:0.75rem;
        background:${state === searchLoop.get().selectedUser ? '#f0f0ff' : '#fff'};
        transition:background 0.2s;">
      <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#646cff,#ff44aa);
        display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:1.1rem;">
        ${state.login[0].toUpperCase()}
      </div>
      <div style="flex:1;">
        <div style="font-weight:600;">${state.name}</div>
        <div style="font-size:0.8rem;color:#888;">@${state.login}</div>
      </div>
      <div style="text-align:right;font-size:0.8rem;color:#888;">
        <div>📦 ${state.repos}</div>
        <div>👥 ${state.followers}</div>
      </div>
    </div>
  `
})

// ── Main async demo ──────────────────────────────────────

export const AsyncDemo = component('AsyncDemo', {
  state: searchLoop.get(),

  view: (state, { send }) => {
    const loopState = searchLoop.get()
    const isSearching = searchLoop.isPending('search')
    const searchError = searchLoop.getError('search')
    const cacheInfo = searchLoop.getCached('results')

    const resultsContent = suspend(searchLoop, 'results', 'search', {
      loading: () => html`
        <div style="text-align:center;padding:2rem;color:#888;">
          <div style="font-size:2rem;margin-bottom:0.5rem;">⏳</div>
          <div>Searching for "${loopState.query}"...</div>
          ${isSearching ? html`<div style="font-size:0.75rem;margin-top:0.25rem;">Request in flight</div>` : ''}
        </div>
      `,
      error: (err, { retry }) => html`
        <div style="text-align:center;padding:2rem;color:#f44336;">
          <div style="font-size:2rem;margin-bottom:0.5rem;">❌</div>
          <div>Error: ${err.message}</div>
          <div style="font-size:0.8rem;margin:0.25rem 0;">Retries left: ${err.retriesLeft}</div>
          <button @click=${retry}
            style="margin-top:0.5rem;padding:0.3rem 1rem;background:#f44336;color:#fff;border:none;border-radius:4px;cursor:pointer;">
            Retry
          </button>
        </div>
      `,
      render: (results) => html`
        <div>
          ${results.length > 0 ? html`
            <div style="font-size:0.8rem;color:#888;margin-bottom:0.5rem;">
              ${results.length} result${results.length !== 1 ? 's' : ''}
              ${cacheInfo && !cacheInfo.fresh ? html`<span style="color:#ffaa00;"> · cached (stale, refreshing...)</span>` : ''}
              ${cacheInfo && cacheInfo.fresh ? html`<span style="color:#4caf50;"> · cached (fresh)</span>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:0.5rem;">
              ${results.map(u => UserCard(u))}
            </div>
          ` : html`
            <div style="text-align:center;padding:2rem;color:#888;">
              No users found for "${loopState.query}"
            </div>
          `}
        </div>
      `
    })

    return html`
      <div style="font-family:sans-serif;max-width:550px;margin:0 auto;padding:1rem;">
        <h2>⚡ Async Data Demo</h2>
        <p style="color:#888;font-size:0.85rem;margin-bottom:1rem;">
          Demonstrates <strong>debounce</strong> (300ms), <strong>interruptible</strong> fetch,
          <strong>error</strong> retry with backoff, <strong>suspend</strong> loading states,
          and <strong>cache</strong> with TTL + SWR — all declarative, zero boilerplate.
        </p>

        ${SearchInput({ query: loopState.query })}

        <div style="display:flex;gap:0.5rem;margin:0.5rem 0;flex-wrap:wrap;font-size:0.75rem;">
          <span style="padding:0.15rem 0.5rem;background:#e8f5e9;border-radius:4px;color:#2e7d32;">🕐 debounce: 300ms</span>
          <span style="padding:0.15rem 0.5rem;background:#e3f2fd;border-radius:4px;color:#1565c0;">🛑 interruptible</span>
          <span style="padding:0.15rem 0.5rem;background:#fff3e0;border-radius:4px;color:#e65100;">🔄 error: 3 retries</span>
          <span style="padding:0.15rem 0.5rem;background:#f3e5f5;border-radius:4px;color:#7b1fa2;">💾 cache: 10s TTL + SWR</span>
        </div>

        <div style="margin-top:1rem;min-height:200px;">
          ${loopState.query
            ? resultsContent
            : html`<div style="text-align:center;padding:2rem;color:#ccc;">Type to search users...</div>`
          }
        </div>

        <div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap;">
          <button @click=${() => searchLoop.send('refresh', loopState.query)}
            style="padding:0.3rem 0.75rem;background:#646cff;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:0.85rem;">
            🔄 Force Refresh (bust cache)
          </button>
          <button @click=${() => searchLoop.clearError('search')}
            style="padding:0.3rem 0.75rem;background:#ff9800;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:0.85rem;">
            Clear Error State
          </button>
          <button @click=${() => searchLoop.invalidateCache('results')}
            style="padding:0.3rem 0.75rem;background:#9c27b0;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:0.85rem;">
            Invalidate Cache
          </button>
        </div>

        <details style="margin-top:1.5rem;font-size:0.75rem;color:#888;">
          <summary>Debug: Loop State & Metadata</summary>
          <pre>Query: ${loopState.query}
Pending (search): ${isSearching}
Error (search): ${searchError ? JSON.stringify(searchError) : 'none'}
Cache (results): ${JSON.stringify(cacheInfo)}
Results count: ${loopState.results?.length || 0}
Selected: ${loopState.selectedUser?.login || 'none'}
Handler meta: ${JSON.stringify(searchLoop.getMeta('search'))}
Events: ${searchLoop.events.total} total, ${searchLoop.events.rejected} rejected, depth ${searchLoop.events.depth}</pre>
        </details>
      </div>
    `
  },

  mount: (el) => {
    const unsub = searchLoop.subscribe(() => {
      el.setAttribute?.('data-force-update', Math.random())
    })
    return () => unsub()
  }
})

export default AsyncDemo
