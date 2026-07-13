import { createLoop } from '@uploop/core'
import { createService } from '@uploop/sst'

export function createTodoService() {
  const todoLoop = createLoop({
    state: { items: [], nextId: 1 },
    update: {
      add: (s, text) => ({ items: [...s.items, { id: s.nextId, text, done: false }], nextId: s.nextId + 1 }),
      toggle: (s, id) => ({ items: s.items.map(i => i.id === id ? { ...i, done: !i.done } : i) }),
      remove: (s, id) => ({ items: s.items.filter(i => i.id !== id) })
    }
  })

  // Seed data
  todoLoop.send('add', 'Learn Uploop SSR')
  todoLoop.send('add', 'Build a demo')
  todoLoop.send('add', 'Deploy to production')

  return createService(todoLoop, {
    methods: {
      find: () => todoLoop.get().items,
      create: (data) => { todoLoop.send('add', data.text); return data },
      remove: (id) => { todoLoop.send('remove', id); return { id } }
    }
  })
}
