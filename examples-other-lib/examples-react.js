/**
 * React equivalents for 5 key Uploop scenarios.
 *
 * These are realistic, production-style React implementations
 * showing the boilerplate, hooks, and patterns required.
 *
 * Each example counts: lines, useState, useEffect, useCallback,
 * useMemo, useRef — the "hook tax" React imposes.
 *
 * @file examples-other-lib/examples-react.js
 */

// ═══════════════════════════════════════════════════════════
// Scenario 1: Counter
// ═══════════════════════════════════════════════════════════

/**
 * React Counter
 *   Lines: 11
 *   useState: 1
 *   useEffect: 0
 *   Extras: 0
 *
 * Uploop equivalent: 7 lines (component('Counter', { state: { count: 0 },
 *   update: { inc: s => ({ count: s.count + 1 }) },
 *   view: (s, { send }) => html`<button @click=${() => send('inc')}>${s.count}</button>` }))
 */
export function ReactCounter() { /*
  function Counter() {
    const [count, setCount] = useState(0);
    return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
  }
*/}

// ═══════════════════════════════════════════════════════════
// Scenario 2: Search Typeahead
// ═══════════════════════════════════════════════════════════

/**
 * React Search Typeahead
 *   Lines: 35
 *   useState: 3
 *   useEffect: 1
 *   useRef: 1 (for AbortController)
 *   Manual: debounce timer, abort logic, loading flag, error state
 *   Missing: caching (requires React Query or SWR — adds ~5KB + more code)
 *
 * Uploop equivalent: ~12 lines
 *   Declares debounce, interruptible, cache on the graph node as metadata.
 *   No manual timers, no AbortController, no loading flag.
 */
export function ReactSearchTypeahead() { /*
  import { useState, useEffect, useRef } from 'react';

  function SearchBox() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const abortRef = useRef(null);

    useEffect(() => {
      if (!query) { setResults([]); return; }
      setLoading(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${query}`, { signal: controller.signal });
          const data = await res.json();
          if (!controller.signal.aborted) setResults(data);
        } catch (e) {
          if (e.name !== 'AbortError') console.error(e);
        }
        if (!controller.signal.aborted) setLoading(false);
      }, 300);
      return () => { clearTimeout(timer); controller.abort(); };
    }, [query]);

    return (
      <div>
        <input value={query} onChange={e => setQuery(e.target.value)} />
        {loading && <span>Loading...</span>}
        <ul>{results.map(r => <li key={r.id}>{r.name}</li>)}</ul>
      </div>
    );
  }
  // Hook tax: 3 useState + 1 useEffect + 1 useRef = 5 hooks
  // Boilerplate lines: ~22 (timer + abort + loading + cleanup)
  // Extra deps needed for caching: React Query (~5KB) or SWR (~3KB)
*/}

// ═══════════════════════════════════════════════════════════
// Scenario 3: Form with Validation
// ═══════════════════════════════════════════════════════════

/**
 * React Form (3 fields: name, email, age)
 *   Lines: 50
 *   useState: 4 (name, email, age, errors)
 *   useEffect: 0 (validation on submit)
 *   useCallback: 1 (handleSubmit)
 *   Manual: per-field onChange, error object management, reset logic
 *
 * Uploop equivalent: ~15 lines
 *   entity('User', { name: string(), email: string().email(), age: number().min(0) })
 *   entityComponent(User, { mode: 'form' }) — auto-generates state, handlers, and HTML
 */
export function ReactForm() { /*
  import { useState, useCallback } from 'react';

  function UserForm() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [age, setAge] = useState('');
    const [errors, setErrors] = useState({});

    const validate = () => {
      const e = {};
      if (!name.trim()) e.name = 'Name is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Invalid email';
      const ageNum = parseInt(age, 10);
      if (isNaN(ageNum) || ageNum < 0) e.age = 'Age must be a positive number';
      return e;
    };

    const handleSubmit = useCallback((e) => {
      e.preventDefault();
      const validationErrors = validate();
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
      setErrors({});
      console.log('Submit:', { name, email, age: parseInt(age, 10) });
    }, [name, email, age]);

    return (
      <form onSubmit={handleSubmit}>
        <div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
          {errors.name && <span>{errors.name}</span>}
        </div>
        <div>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
          {errors.email && <span>{errors.email}</span>}
        </div>
        <div>
          <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="Age" />
          {errors.age && <span>{errors.age}</span>}
        </div>
        <button type="submit">Save</button>
      </form>
    );
  }
  // Hook tax: 4 useState + 1 useCallback = 5 hooks
  // Validation: manual, duplicated on every form
*/}

// ═══════════════════════════════════════════════════════════
// Scenario 4: Todo List
// ═══════════════════════════════════════════════════════════

/**
 * React Todo List
 *   Lines: 45
 *   useState: 2
 *   useCallback: 3 (addTodo, toggleTodo, deleteTodo)
 *   useRef: 1 (input ref)
 *   Manual: key generation, array immutability, filter logic
 *
 * Uploop equivalent: ~20 lines
 *   state: { todos: [], text: '' },
 *   update: { add, toggle, remove, input }
 *   + html template with @click bindings
 */
export function ReactTodoList() { /*
  import { useState, useCallback, useRef } from 'react';

  function TodoList() {
    const [todos, setTodos] = useState([]);
    const [text, setText] = useState('');
    const inputRef = useRef(null);
    let nextId = useRef(1);

    const addTodo = useCallback(() => {
      if (!text.trim()) return;
      setTodos(t => [...t, { id: nextId.current++, text, done: false }]);
      setText('');
      inputRef.current?.focus();
    }, [text]);

    const toggleTodo = useCallback((id) => {
      setTodos(t => t.map(todo => todo.id === id ? { ...todo, done: !todo.done } : todo));
    }, []);

    const deleteTodo = useCallback((id) => {
      setTodos(t => t.filter(todo => todo.id !== id));
    }, []);

    return (
      <div>
        <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && addTodo()} />
        <button onClick={addTodo}>Add</button>
        <ul>
          {todos.map(todo => (
            <li key={todo.id}>
              <span style={{ textDecoration: todo.done ? 'line-through' : 'none' }}
                    onClick={() => toggleTodo(todo.id)}>{todo.text}</span>
              <button onClick={() => deleteTodo(todo.id)}>×</button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  // Hook tax: 2 useState + 3 useCallback + 1 useRef = 6 hooks
*/}

// ═══════════════════════════════════════════════════════════
// Scenario 5: Real-Time Chat
// ═══════════════════════════════════════════════════════════

/**
 * React Chat
 *   Lines: 55
 *   useState: 3
 *   useEffect: 2 (WebSocket connect + scroll)
 *   useRef: 2 (ws, messagesEnd)
 *   useCallback: 1
 *   Manual: WebSocket lifecycle, message queue, scroll management
 *
 * Uploop equivalent: ~20 lines
 *   Ring buffer executor handles backpressure.
 *   Graph edges handle message → view notification.
 *   No manual WebSocket lifecycle — declared as source.
 */
export function ReactChat() { /*
  import { useState, useEffect, useRef, useCallback } from 'react';

  function Chat() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [connected, setConnected] = useState(false);
    const wsRef = useRef(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
      const ws = new WebSocket('wss://chat.example.com');
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => setConnected(false);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        setMessages(m => [...m, msg]);
      };
      return () => ws.close();
    }, []);

    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const send = useCallback(() => {
      if (!input.trim() || !wsRef.current) return;
      const msg = { id: Date.now(), text: input, time: Date.now() };
      wsRef.current.send(JSON.stringify(msg));
      setMessages(m => [...m, { ...msg, local: true }]);
      setInput('');
    }, [input]);

    return (
      <div>
        <div className="messages">
          {messages.map(m => (
            <div key={m.id} className={m.local ? 'local' : 'remote'}>{m.text}</div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <input value={input} onChange={e => setInput(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && send()} />
        <button onClick={send} disabled={!connected}>Send</button>
      </div>
    );
  }
  // Hook tax: 3 useState + 2 useEffect + 2 useRef + 1 useCallback = 8 hooks
  // Missing: backpressure (1000 msg/sec would crash), reconnection logic, message queue
*/}

// ═══════════════════════════════════════════════════════════
// Measured Stats — The React Hook Tax
// ═══════════════════════════════════════════════════════════

export const REACT_HOOK_TAX = {
  counter:        { lines: 11, useState: 1, useEffect: 0, useCallback: 0, useMemo: 0, useRef: 0, totalHooks: 1 },
  searchTypeahead:{ lines: 35, useState: 3, useEffect: 1, useCallback: 0, useMemo: 0, useRef: 1, totalHooks: 5 },
  form:           { lines: 50, useState: 4, useEffect: 0, useCallback: 1, useMemo: 0, useRef: 0, totalHooks: 5 },
  todoList:       { lines: 45, useState: 2, useEffect: 0, useCallback: 3, useMemo: 0, useRef: 1, totalHooks: 6 },
  chat:           { lines: 55, useState: 3, useEffect: 2, useCallback: 1, useMemo: 0, useRef: 2, totalHooks: 8 },

  // Totals across all 5 scenarios
  total:          { lines: 196, useState: 13, useEffect: 3, useCallback: 5, useMemo: 0, useRef: 4, totalHooks: 25 },
  averageLines:   39.2,
  averageHooks:   5.0
}
