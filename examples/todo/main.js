import { html, component } from '@uploop/html'

// ── Event <-> Data Store Relationship ────────────────────────
//
// Every user interaction in Uploop flows through the same pipeline:
//
//   DOM Event (click, input, submit, keystroke, ...)
//       │
//       ▼
//   @click / @input  →  template binding
//       │
//       ▼
//   send('eventName', payload)   ← generic event dispatch
//       │
//       ▼
//   update handler  (state, payload) => partialState
//       │
//       ▼
//   state patch  →  merge via { ...old, ...result }
//       │
//       ▼
//   subscribers notified  →  view re-renders  →  DOM patch
//
// This means ALL events — clicks, keystrokes, mouse moves, custom
// events — use the exact same mechanism. There is no special
// "keystroke event" type. An input keystroke calls send('input', value),
// exactly like a button click calls send('add').
//
// The data store (loop state) is the single source of truth.
// Events flow INTO it, and the view flows OUT of it.
// This one-way data flow makes state predictable and debuggable.

const Todo = component('Todo', {
  state: {
    text: '',
    todos: [],
    filter: 'all' // 'all' | 'active' | 'completed'
  },

  update: {
    // ── Event: keystroke → updates `text` in store ─────────
    // The @input binding calls send('input', value) on every keystroke.
    // This handler receives the value and patches state.text.
    // The view re-renders with the new text (focus preserved by framework).
    input: (s, text) => ({ ...s, text }),

    // ── Event: button click → adds todo to store ────────────
    add: (s) => {
      if (!s.text.trim()) return s
      return {
        text: '',
        todos: [...s.todos, { id: Date.now(), text: s.text, done: false }]
      }
    },

    // ── Event: checkbox click → toggles todo.done in store ──
    toggle: (s, id) => ({
      todos: s.todos.map(t =>
        t.id === id ? { ...t, done: !t.done } : t
      )
    }),

    // ── Event: delete button → removes todo from store ──────
    remove: (s, id) => ({
      todos: s.todos.filter(t => t.id !== id)
    }),

    // ── Event: filter button → changes store.filter ─────────
    filter: (s, filter) => ({ ...s, filter }),

    // ── Event: clear button → removes done todos from store ─
    clearDone: (s) => ({
      todos: s.todos.filter(t => !t.done)
    })
  },

  view: (state, { send }) => {
    const filtered = state.todos.filter(t => {
      if (state.filter === 'active') return !t.done
      if (state.filter === 'completed') return t.done
      return true
    })

    return html`
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:2rem;">
        <div style="margin-bottom:0.5rem;">
          <h2 style="margin:0;">📝 Uploop Todos</h2>
          <p style="margin:0.25rem 0 0;font-size:0.75rem;color:#aaa;">
            <code>@input</code> → <code>send('input', value)</code> → update state → re-render (focus preserved)
          </p>
        </div>

        <!-- Input: @input captures keystrokes, .value syncs store → UI -->
        <div style="display:flex;gap:0.5rem;margin-bottom:1rem;">
          <input .value=${state.text}
            @input=${['input', e => e.target.value]}
            placeholder="What needs to be done?"
            style="flex:1;padding:0.5rem;border:1px solid #ccc;border-radius:4px;font-size:1rem;" />
          <button @click=${() => send('add')}
            style="padding:0.5rem 1rem;background:#646cff;color:white;border:none;border-radius:4px;cursor:pointer;">
            Add
          </button>
        </div>

        <!-- Filters: each button sends a filter event to the store -->
        <div style="display:flex;gap:0.5rem;margin-bottom:1rem;font-size:0.85rem;">
          <button @click=${() => send('filter', 'all')}
            style="padding:0.2rem 0.6rem;border:1px solid #ccc;border-radius:4px;cursor:pointer;
                   background:${state.filter === 'all' ? '#646cff' : 'transparent'};
                   color:${state.filter === 'all' ? 'white' : 'inherit'};">
            All
          </button>
          <button @click=${() => send('filter', 'active')}
            style="padding:0.2rem 0.6rem;border:1px solid #ccc;border-radius:4px;cursor:pointer;
                   background:${state.filter === 'active' ? '#646cff' : 'transparent'};
                   color:${state.filter === 'active' ? 'white' : 'inherit'};">
            Active
          </button>
          <button @click=${() => send('filter', 'completed')}
            style="padding:0.2rem 0.6rem;border:1px solid #ccc;border-radius:4px;cursor:pointer;
                   background:${state.filter === 'completed' ? '#646cff' : 'transparent'};
                   color:${state.filter === 'completed' ? 'white' : 'inherit'};">
            Completed
          </button>
          <span style="flex:1;text-align:right;color:#888;padding-top:0.2rem;">
            ${state.todos.filter(t => !t.done).length} left
          </span>
        </div>

        <!-- Todo items rendered from store state -->
        <ul style="list-style:none;padding:0;margin:0;">
          ${filtered.map(todo => html`
            <li style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0;
                       border-bottom:1px solid #eee;">
              <input type="checkbox" ?checked=${todo.done}
                @click=${() => send('toggle', todo.id)}
                style="cursor:pointer;" />
              <span style="flex:1;text-decoration:${todo.done ? 'line-through' : 'none'};
                          color:${todo.done ? '#aaa' : 'inherit'};">
                ${todo.text}
              </span>
              <button @click=${() => send('remove', todo.id)}
                style="background:none;border:none;cursor:pointer;color:#ff4444;font-size:1.2rem;">
                ×
              </button>
            </li>
          `)}
        </ul>

        ${state.todos.some(t => t.done) ? html`
          <div style="margin-top:1rem;text-align:center;">
            <button @click=${() => send('clearDone')}
              style="padding:0.3rem 1rem;border:1px solid #ccc;border-radius:4px;cursor:pointer;
                     background:transparent;font-size:0.85rem;">
              Clear completed
            </button>
          </div>
        ` : ''}

        <p style="margin-top:2rem;font-size:0.75rem;color:#aaa;text-align:center;">
          ${state.todos.length} todos · state.text reflects each keystroke
        </p>
      </div>
    `
  }
})

export { Todo }
export default Todo
