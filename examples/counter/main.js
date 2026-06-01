import { html, component } from '@uploop/html'

// ─── Counter with single/multi mode toggle ─────────────────
// Merges the old Counter + MultiCounter into one component.
// The "mode" button switches between counting one value
// or two values (with derived sum, like the original v0.0.1).
//
const Counter = component('Counter', {
  state: {
    mode: 'single',  // 'single' | 'multi'
    count: 0,
    count2: 0
  },

  update: {
    toggleMode: (s) => ({ ...s, mode: s.mode === 'single' ? 'multi' : 'single', count: 0, count2: 0 }),
    inc: (s) => ({ ...s, count: s.count + 1 }),
    dec: (s) => ({ ...s, count: s.count - 1 }),
    inc1: (s) => ({ ...s, count: s.count + 1 }),
    inc2: (s) => ({ ...s, count2: s.count2 + 2 }),
    reset: () => ({ mode: 'single', count: 0, count2: 0 })
  },

  view: (state, { send }) => {
    if (state.mode === 'multi') {
      return html`
        <div style="text-align:center;padding:2rem;font-family:sans-serif;">
          <button @click=${() => send('toggleMode')}
            style="padding:0.25rem 0.7rem;border:1px solid #aaa;border-radius:4px;cursor:pointer;background:transparent;font-size:0.78rem;color:#888;margin-bottom:0.75rem;">
            Switch to Single
          </button>

          <div style="font-size:1.1rem;">count1: <strong>${state.count}</strong></div>
          <div style="font-size:1.1rem;">count2: <strong>${state.count2}</strong></div>
          <div style="font-size:1.6rem;margin:0.5rem 0;color:#646cff;">Sum: <strong>${state.count + state.count2}</strong></div>

          <div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">
            <button @click=${() => send('inc1')} style="padding:0.4rem 1rem;cursor:pointer;border:1px solid #ccc;border-radius:6px;">count1 +1</button>
            <button @click=${() => send('inc2')} style="padding:0.4rem 1rem;cursor:pointer;border:1px solid #646cff;border-radius:6px;background:#646cff;color:white;">count2 +2</button>
            <button @click=${() => send('reset')} style="padding:0.3rem 0.8rem;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:transparent;">Reset</button>
          </div>
        </div>
      `
    }

    return html`
      <div style="text-align:center;padding:2rem;font-family:sans-serif;">
        <button @click=${() => send('toggleMode')}
          style="padding:0.25rem 0.7rem;border:1px solid #aaa;border-radius:4px;cursor:pointer;background:transparent;font-size:0.78rem;color:#888;margin-bottom:0.75rem;">
          Switch to Multi
        </button>

        <div style="font-size:3rem;font-weight:bold;margin:1rem 0;">${state.count}</div>

        <div style="display:flex;gap:0.5rem;justify-content:center;">
          <button @click=${() => send('dec')} style="padding:0.5rem 1.5rem;font-size:1.2rem;cursor:pointer;border:1px solid #ccc;border-radius:8px;background:#f0f0f0;">-1</button>
          <button @click=${() => send('inc')} style="padding:0.5rem 1.5rem;font-size:1.2rem;cursor:pointer;border:1px solid #646cff;border-radius:8px;background:#646cff;color:white;">+1</button>
        </div>
        <button @click=${() => send('reset')} style="margin-top:0.5rem;padding:0.3rem 1rem;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:transparent;">Reset</button>
      </div>
    `
  }
})

export { Counter }
export default Counter
