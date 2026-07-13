import { describe, it, expect } from 'vitest'
import { createTodoService } from '../services/todos.mjs'

describe('createTodoService', () => {
  it('creates a service and seeds 3 default todos', async () => {
    const service = createTodoService()
    const items = await service.find()
    expect(items.length).toBe(3)
    expect(items[0].text).toBe('Learn Uploop SSR')
    expect(items[1].text).toBe('Build a demo')
    expect(items[2].text).toBe('Deploy to production')
    expect(items[0].id).toBe(1)
    expect(items[1].id).toBe(2)
    expect(items[2].id).toBe(3)
    expect(items[0].done).toBe(false)
  })

  it('find returns all todo items', async () => {
    const service = createTodoService()
    const items = await service.find()
    expect(Array.isArray(items)).toBe(true)
    expect(items.length).toBeGreaterThanOrEqual(3)
    items.forEach(item => {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('text')
      expect(item).toHaveProperty('done')
    })
  })

  it('create adds a new todo and returns it', async () => {
    const service = createTodoService()
    const result = await service.create({ text: 'Write tests' })
    expect(result.text).toBe('Write tests')

    const items = await service.find()
    expect(items.length).toBe(4)
    expect(items[3].text).toBe('Write tests')
    expect(items[3].id).toBe(4)
  })

  it('create handles multiple todos', async () => {
    const service = createTodoService()
    await service.create({ text: 'Task A' })
    await service.create({ text: 'Task B' })
    const items = await service.find()
    expect(items.length).toBe(5)
    expect(items[3].text).toBe('Task A')
    expect(items[4].text).toBe('Task B')
  })

  it('remove deletes a todo by id', async () => {
    const service = createTodoService()
    const result = await service.remove(1)
    expect(result.id).toBe(1)

    const items = await service.find()
    expect(items.length).toBe(2)
    expect(items.find(i => i.id === 1)).toBeUndefined()
  })

  it('remove non-existent id does not error', async () => {
    const service = createTodoService()
    const result = await service.remove(999)
    expect(result.id).toBe(999)

    const items = await service.find()
    expect(items.length).toBe(3) // unchanged
  })

  it('each service instance has independent state', async () => {
    const service1 = createTodoService()
    const service2 = createTodoService()

    await service1.create({ text: 'Only in service 1' })
    const items1 = await service1.find()
    const items2 = await service2.find()

    expect(items1.length).toBe(4)
    expect(items2.length).toBe(3)
  })
})
