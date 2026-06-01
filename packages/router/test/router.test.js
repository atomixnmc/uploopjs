import { describe, it, expect } from 'vitest'
import { createRouter } from '../src/index.js'

describe('createRouter', () => {
  it('creates a router with routes', () => {
    const router = createRouter({
      home: { view: 'home' },
      'blog/:id': { view: 'detail' }
    })
    expect(router).toBeDefined()
    expect(router.getRoutes()).toHaveProperty('home')
    expect(router.getRoutes()).toHaveProperty('blog/:id')
  })

  it('matches exact routes', () => {
    const homeView = { view: 'home' }
    const router = createRouter({ home: homeView, 'blog/:id': { view: 'detail' } })
    router.send('navigate', 'home')
    const match = router.match()
    expect(match.view).toBe('home')
  })

  it('matches parametric routes', () => {
    const router = createRouter({ 'blog/:id': { view: 'detail' } })
    router.send('navigate', 'blog/42')
    const match = router.match()
    expect(match.view).toBe('detail')
    expect(match.params).toEqual({ id: '42' })
  })

  it('matches nested parametric routes', () => {
    const router = createRouter({ 'blog/:id/edit': { view: 'edit' } })
    router.send('navigate', 'blog/42/edit')
    const match = router.match()
    expect(match.view).toBe('edit')
    expect(match.params).toEqual({ id: '42' })
  })

  it('returns 404 for unmatched routes', () => {
    const router = createRouter({ home: { view: 'home' } })
    router.send('navigate', 'nonexistent')
    const match = router.match()
    expect(match.view).toBeTypeOf('function') // default 404
  })

  it('updates path on navigate', () => {
    const router = createRouter({ home: { view: 'home' } })
    router.send('navigate', 'home')
    expect(router.getCurrentPath()).toBe('home')
  })

  it('prevents path repetition on sequential navigations', () => {
    const router = createRouter({
      blog: { view: 'list' },
      'blog/:id': { view: 'detail' },
      'blog/:id/edit': { view: 'edit' }
    })

    router.send('navigate', 'blog')
    expect(router.getCurrentPath()).toBe('blog')

    router.send('navigate', 'blog/1')
    expect(router.getCurrentPath()).toBe('blog/1')

    router.send('navigate', 'blog/1/edit')
    expect(router.getCurrentPath()).toBe('blog/1/edit')

    router.send('navigate', 'blog')
    expect(router.getCurrentPath()).toBe('blog')

    router.send('navigate', 'blog/2')
    expect(router.getCurrentPath()).toBe('blog/2')
  })

  it('extracts params correctly', () => {
    const router = createRouter({})
    router.send('navigate', 'blog/1')
    expect(router.params()).toEqual({})
  })

  it('normalizes paths with leading slash', () => {
    const router = createRouter({ 'blog/:id': { view: 'detail' } })
    router.send('navigate', '/blog/42')
    expect(router.getCurrentPath()).toBe('blog/42')
    const match = router.match()
    expect(match.params).toEqual({ id: '42' })
  })

  it('normalizes route keys with trailing slash', () => {
    const router = createRouter({ 'blog/': { view: 'list' } })
    router.send('navigate', 'blog')
    expect(router.match().view).toBe('list')
  })
})
