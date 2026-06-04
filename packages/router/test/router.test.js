import { describe, it, expect } from 'vitest'
import { createRouter } from '../src/index.js'

describe('createRouter', () => {
  it('creates a router with routes', () => {
    const router = createRouter({
      home: { view: () => 'home' },
      'blog/:id': { view: () => 'detail' }
    })
    expect(router).toBeDefined()
    const routes = router.getRoutes()
    expect(routes).toHaveProperty('home')
    expect(routes).toHaveProperty('blog/:id')
  })

  it('matches exact routes', () => {
    const router = createRouter({ home: { view: () => 'home' }, 'blog/:id': { view: () => 'detail' } })
    router.navigate('home')
    expect(router.match().view()).toBe('home')
  })

  it('matches parametric routes', () => {
    const router = createRouter({ 'blog/:id': { view: () => 'detail' } })
    router.navigate('blog/42')
    const match = router.match()
    expect(match.view()).toBe('detail')
    expect(match.params).toEqual({ id: '42' })
  })

  it('matches nested parametric routes', () => {
    const router = createRouter({ 'blog/:id/edit': { view: () => 'edit' } })
    router.navigate('blog/42/edit')
    const match = router.match()
    expect(match.view()).toBe('edit')
    expect(match.params).toEqual({ id: '42' })
  })

  it('returns 404 for unmatched routes', () => {
    const router = createRouter({ home: { view: () => 'home' } })
    router.navigate('nonexistent')
    const match = router.match()
    expect(match.view()).toBe('<h2>404 Not Found</h2>')
  })

  it('updates path on navigate', () => {
    const router = createRouter({ home: { view: () => 'home' } })
    router.navigate('home')
    expect(router.getCurrentPath()).toBe('home')
  })

  it('prevents path repetition on sequential navigations', () => {
    const router = createRouter({
      blog: { view: () => 'list' },
      'blog/:id': { view: () => 'detail' },
      'blog/:id/edit': { view: () => 'edit' }
    })
    router.navigate('blog')
    expect(router.getCurrentPath()).toBe('blog')
    router.navigate('blog/1')
    expect(router.getCurrentPath()).toBe('blog/1')
    router.navigate('blog/1/edit')
    expect(router.getCurrentPath()).toBe('blog/1/edit')
    router.navigate('blog')
    expect(router.getCurrentPath()).toBe('blog')
    router.navigate('blog/2')
    expect(router.getCurrentPath()).toBe('blog/2')
  })

  it('extracts params correctly', () => {
    const router = createRouter({})
    router.navigate('blog/1')
    expect(router.params()).toEqual({})
  })

  it('normalizes paths with leading slash', () => {
    const router = createRouter({ 'blog/:id': { view: () => 'detail' } })
    router.navigate('/blog/42')
    expect(router.getCurrentPath()).toBe('blog/42')
    expect(router.match().params).toEqual({ id: '42' })
  })

  it('normalizes route keys with trailing slash', () => {
    const router = createRouter({ 'blog/': { view: () => 'list' } })
    router.navigate('blog')
    expect(router.match().view()).toBe('list')
  })
})
