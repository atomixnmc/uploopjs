/**
 * SolidJS equivalents for 5 key Uploop scenarios.
 *
 * Solid eliminates the VDOM but still requires manual wiring
 * for async, cleanup, caching, and complex state orchestration.
 *
 * @file examples-other-lib/examples-solid.js
 */

// ═══════════════════════════════════════════════════════════
// Scenario 1: Counter
// ═══════════════════════════════════════════════════════════

/**
 * Solid Counter
 *   Lines: 6
 *   createSignal: 1
 *   createEffect: 0
 *
 * Solid is close to Uploop here. Both are signal-based.
 */
export function SolidCounter() { /*
  function Counter() {
    const [count, setCount] = createSignal(0);
    return <button onClick={() => setCount(c => c + 1)}>{count()}</button>;
  }
*/}

// ═══════════════════════════════════════════════════════════
// Scenario 2: Search Typeahead
// ═══════════════════════════════════════════════════════════

/**
 * Solid Search Typeahead
 *   Lines: 28
 *   createSignal: 3
 *   createEffect: 1
 *   onCleanup: 1
 *   Manual: AbortController, debounce timer, loading state
 *   Missing: caching (requires createResource or custom)
 *
 * Uploop difference:
 *   - debounce declared on node, not in effect
 *   - interruptible auto-generates AbortController
 *   - cache declared as node metadata
 *   - No onCleanup needed — framework handles lifecycle
 */
export function SolidSearchTypeahead() { /*
  import { createSignal, createEffect, onCleanup } from 'solid-js';

  function SearchBox() {
    const [query, setQuery] = createSignal('');
    const [results, setResults] = createSignal([]);
    const [loading, setLoading] = createSignal(false);

    createEffect(() => {
      const q = query();
      if (!q) { setResults([]); return; }
      setLoading(true);
      const controller = new AbortController();
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${q}`, { signal: controller.signal });
          setResults(await res.json());
        } catch (e) {
          if (e.name !== 'AbortError') console.error(e);
        }
        setLoading(false);
      }, 300);
      onCleanup(() => { clearTimeout(timer); controller.abort(); });
    });

    return (
      <div>
        <input value={query()} onInput={e => setQuery(e.target.value)} />
        <Show when={loading()}><span>Loading...</span></Show>
        <For each={results()}>{r => <li>{r.name}</li>}</For>
      </div>
    );
  }
  // Signal tax: 3 createSignal + 1 createEffect + 1 onCleanup = 5 primitives
  // Still manual: AbortController, setTimeout, loading flag
*/}

// ═══════════════════════════════════════════════════════════
// Scenario 3: Form with Validation
// ═══════════════════════════════════════════════════════════

/**
 * Solid Form
 *   Lines: 42
 *   createSignal: 4
 *   createMemo: 0 (could use but not for validation)
 *   Manual: validation function, per-field error tracking
 *
 * Uploop difference:
 *   - entity() defines shape + validation in one declaration
 *   - entityComponent() auto-generates handlers + HTML
 */
export function SolidForm() { /*
  import { createSignal } from 'solid-js';

  function UserForm() {
    const [name, setName] = createSignal('');
    const [email, setEmail] = createSignal('');
    const [age, setAge] = createSignal('');
    const [errors, setErrors] = createSignal({});

    const validate = () => {
      const e = {};
      if (!name().trim()) e.name = 'Name is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email())) e.email = 'Invalid email';
      const a = parseInt(age(), 10);
      if (isNaN(a) || a < 0) e.age = 'Age must be positive';
      return e;
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      const errs = validate();
      if (Object.keys(errs).length) { setErrors(errs); return; }
      setErrors({});
      console.log({ name: name(), email: email(), age: parseInt(age(), 10) });
    };

    return (
      <form onSubmit={handleSubmit}>
        <div>
          <input value={name()} onInput={e => setName(e.target.value)} placeholder="Name" />
          <Show when={errors().name}><span>{errors().name}</span></Show>
        </div>
        <div>
          <input value={email()} onInput={e => setEmail(e.target.value)} placeholder="Email" />
          <Show when={errors().email}><span>{errors().email}</span></Show>
        </div>
        <div>
          <input type="number" value={age()} onInput={e => setAge(e.target.value)} placeholder="Age" />
          <Show when={errors().age}><span>{errors().age}</span></Show>
        </div>
        <button type="submit">Save</button>
      </form>
    );
  }
*/}

// ═══════════════════════════════════════════════════════════
// Scenario 4: Todo List
// ═══════════════════════════════════════════════════════════

/**
 * Solid Todo List
 *   Lines: 30
 *   createSignal: 2
 *   createMemo: 0
 *   Solid's For component handles keyed lists efficiently
 */
export function SolidTodoList() { /*
  import { createSignal } from 'solid-js';
  import { For } from 'solid-js/web';

  function TodoList() {
    const [todos, setTodos] = createSignal([]);
    const [text, setText] = createSignal('');
    let nextId = 1;

    const add = () => {
      if (!text().trim()) return;
      setTodos(t => [...t, { id: nextId++, text: text(), done: false }]);
      setText('');
    };

    return (
      <div>
        <input value={text()} onInput={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <button onClick={add}>Add</button>
        <ul>
          <For each={todos()}>{todo => (
            <li>
              <span onClick={() => setTodos(t => t.map(x => x.id === todo.id ? { ...x, done: !x.done } : x))}
                    style={{ 'text-decoration': todo.done ? 'line-through' : 'none' }}>{todo.text}</span>
              <button onClick={() => setTodos(t => t.filter(x => x.id !== todo.id))}>×</button>
            </li>
          )}</For>
        </ul>
      </div>
    );
  }
*/}

// ═══════════════════════════════════════════════════════════
// Scenario 5: Real-Time Chat
// ═══════════════════════════════════════════════════════════

/**
 * Solid Chat
 *   Lines: 42
 *   createSignal: 3
 *   createEffect: 1
 *   onCleanup: 1
 *   Manual: WebSocket lifecycle, scroll, message queue
 *
 * Solid eliminates re-renders but still requires manual
 * WebSocket management, cleanup, and scroll orchestration.
 */
export function SolidChat() { /*
  import { createSignal, createEffect, onCleanup } from 'solid-js';
  import { For } from 'solid-js/web';

  function Chat() {
    const [messages, setMessages] = createSignal([]);
    const [input, setInput] = createSignal('');
    const [connected, setConnected] = createSignal(false);
    let ws;
    let messagesEnd;

    createEffect(() => {
      ws = new WebSocket('wss://chat.example.com');
      ws.onopen = () => setConnected(true);
      ws.onclose = () => setConnected(false);
      ws.onmessage = (e) => setMessages(m => [...m, JSON.parse(e.data)]);
      onCleanup(() => ws.close());
    });

    createEffect(() => {
      if (messages().length) messagesEnd?.scrollIntoView({ behavior: 'smooth' });
    });

    const send = () => {
      if (!input().trim() || !ws) return;
      const msg = { id: Date.now(), text: input(), time: Date.now() };
      ws.send(JSON.stringify(msg));
      setMessages(m => [...m, { ...msg, local: true }]);
      setInput('');
    };

    return (
      <div>
        <div class="messages">
          <For each={messages()}>{m => (
            <div class={m.local ? 'local' : 'remote'}>{m.text}</div>
          )}</For>
          <div ref={messagesEnd} />
        </div>
        <input value={input()} onInput={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
        <button onClick={send} disabled={!connected()}>Send</button>
      </div>
    );
  }
*/}

// ═══════════════════════════════════════════════════════════
// Measured Stats — The Solid Primitive Tax
// ═══════════════════════════════════════════════════════════

export const SOLID_PRIMITIVE_TAX = {
  counter:        { lines: 6,  createSignal: 1, createEffect: 0, createMemo: 0, onCleanup: 0, totalPrimitives: 1 },
  searchTypeahead:{ lines: 28, createSignal: 3, createEffect: 1, createMemo: 0, onCleanup: 1, totalPrimitives: 5 },
  form:           { lines: 42, createSignal: 4, createEffect: 0, createMemo: 0, onCleanup: 0, totalPrimitives: 4 },
  todoList:       { lines: 30, createSignal: 2, createEffect: 0, createMemo: 0, onCleanup: 0, totalPrimitives: 2 },
  chat:           { lines: 42, createSignal: 3, createEffect: 2, createMemo: 0, onCleanup: 1, totalPrimitives: 6 },

  total:          { lines: 148, createSignal: 13, createEffect: 3, createMemo: 0, onCleanup: 2, totalPrimitives: 18 },
  averageLines:   29.6,
  averagePrimitives: 3.6
}
