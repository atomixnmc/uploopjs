import { component } from "@uploop/core";
import { html } from "@uploop/html";

export const TodoList = component("TodoList", {
  state: { items: [] },
  view: (s) => html`
    <div style="max-width:500px;margin:0 auto;padding:2rem">
      <h2>📋 Todos (Service Pattern)</h2>
      <div style="display:flex;gap:0.5rem;margin-bottom:1rem">
        <input
          id="todo-input"
          placeholder="What needs to be done?"
          style="flex:1;padding:0.5rem;border:1px solid #ccc;border-radius:6px"
        />
        <button
          id="todo-add"
          style="padding:0.5rem 1rem;background:#646cff;color:white;border:none;border-radius:6px;cursor:pointer"
        >
          Add
        </button>
      </div>
      <ul id="todo-list" style="list-style:none;padding:0">
        ${s.items.map(
          (t) => html`
            <li
              id="todo-${t.id}"
              style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0;border-bottom:1px solid #eee"
            >
              <span
                style="flex:1;text-decoration:${t.done
                  ? "line-through"
                  : "none"};color:${t.done ? "#aaa" : "#333"}"
                >${t.text}</span
              >
              <button
                onclick="deleteTodo(${t.id})"
                style="background:none;border:none;cursor:pointer;color:#ff4444;font-size:1.2rem"
              >
                ×
              </button>
            </li>
          `,
        )}
      </ul>
      <p style="color:#888;font-size:0.8rem;margin-top:0.5rem">
        ${s.items.length} items · API: GET/POST/DELETE /api/todos
      </p>
      
    </div>
  `,
});

export function todosClientScript() {
  return `<script>
async function refreshTodos() {
  const res = await fetch('/api/todos')
  const items = await res.json()
  const ul = document.getElementById('todo-list')
  ul.innerHTML = items.map(t => '<li id="todo-' + t.id + '" style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0;border-bottom:1px solid #eee"><span style="flex:1;text-decoration:' + (t.done ? 'line-through' : 'none') + ';color:' + (t.done ? '#aaa' : '#333') + '">' + t.text + '</span><button onclick="deleteTodo(' + t.id + ')" style="background:none;border:none;cursor:pointer;color:#ff4444;font-size:1.2rem">×</button></li>').join('')
  document.querySelector('#todo-list + p').textContent = items.length + ' items · API: GET/POST/DELETE /api/todos'
}
async function addTodo() {
  const input = document.getElementById('todo-input')
  if (!input.value.trim()) return
  await fetch('/api/todos', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({text: input.value}) })
  input.value = ''
  refreshTodos()
}
async function deleteTodo(id) {
  await fetch('/api/todos/' + id, { method: 'DELETE' })
  refreshTodos()
}
document.getElementById('todo-add').onclick = addTodo
document.getElementById('todo-input').onkeydown = (e) => { if (e.key === 'Enter') addTodo() }
window.deleteTodo = deleteTodo
</script>`;
}
