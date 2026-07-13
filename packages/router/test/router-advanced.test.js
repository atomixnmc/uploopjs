import { describe, it, expect } from 'vitest'
import { createRouter } from '../src/index.js'

describe('createRouter', () => {
  it('matches exact routes', () => {
    const router = createRouter({
      '': { view: () => 'Home' },
      'about': { view: () => 'About' }
    })
    router.navigate('about')
    expect(router.get().path).toBe('about')
    expect(router.match().view()).toBe('About')
  })

  it('returns 404 for unmatched routes', () => {
    const router = createRouter({ '': { view: () => 'Home' } })
    router.navigate('nonexistent')
    expect(router.match().view()).toBe('<h2>404 Not Found</h2>')
  })

  it('custom wildcard route', () => {
    const router = createRouter({ '*': { view: () => 'Custom 404' } })
    router.navigate('anything')
    expect(router.match().view()).toBe('Custom 404')
  })

  it('resolves parametric routes', () => {
    const router = createRouter({
      'users/:id': { view: (s) => `User ${s.params.id}` }
    })
    router.navigate('users/42')
    expect(router.get().params).toEqual({ id: '42' })
  })

  it('extracts multiple params', () => {
    const router = createRouter({
      'posts/:postId/comments/:commentId': { view: () => '' }
    })
    router.navigate('posts/10/comments/20')
    expect(router.get().params).toEqual({ postId: '10', commentId: '20' })
  })

  it('params() helper works', () => {
    const router = createRouter({ 'items/:id': { view: () => '' } })
    router.navigate('items/5')
    expect(router.params()).toEqual({ id: '5' })
  })

  it('guards block navigation', () => {
    let blocked = false
    const router = createRouter({
      'admin': { view: () => 'Admin', guard: () => { blocked = true; return false } }
    })
    router.navigate('admin')
    expect(router.get().path).not.toBe('admin')
    expect(blocked).toBe(true)
  })

  it('guards allow valid navigation', () => {
    const router = createRouter({
      'admin': { view: () => 'Admin', guard: () => true }
    })
    router.navigate('admin')
    expect(router.get().path).toBe('admin')
  })

  it('canNavigate checks guards', () => {
    const router = createRouter({
      'admin': { view: () => 'Admin', guard: () => false },
      'public': { view: () => 'Public' }
    })
    expect(router.canNavigate('admin')).toBe(false)
    expect(router.canNavigate('public')).toBe(true)
  })

  it('onNavigate global guard fires', () => {
    const calls = []
    const router = createRouter({ 'about': { view: () => 'About' } }, {
      onNavigate: (state, path, resolved) => { calls.push([state.path, path]) }
    })
    router.navigate('about')
    expect(calls.length).toBe(1)
  })

  it('addRoute registers at runtime', () => {
    const router = createRouter({})
    router.addRoute('about', { view: () => 'About' })
    router.navigate('about')
    expect(router.get().path).toBe('about')
  })

  it('getLayouts returns matching layouts', () => {
    const router = createRouter({
      'admin': { view: () => '', layout: (s, c) => `[L]${c}[/L]` },
      'admin/users': { view: () => 'Users' }
    })
    router.navigate('admin/users')
    const layouts = router.getLayouts()
    expect(layouts.length).toBe(1)
    expect(layouts[0].path).toBe('admin')
  })

  it('render applies layouts', () => {
    const router = createRouter({
      'admin': { view: () => 'Content', layout: (s, c) => `[Admin]${c}[/Admin]` }
    })
    router.navigate('admin')
    expect(router.render()).toBe('[Admin]Content[/Admin]')
  })

  it('loading and error getters work', () => {
    const router = createRouter({ '': { view: () => '' } })
    router.send('_setLoading', true)
    expect(router.loading).toBe(true)
    router.send('_setError', 'fail')
    expect(router.error).toBe('fail')
  })

  it('normalizes paths with leading slash', () => {
    const router = createRouter({ 'about': { view: () => 'About' } })
    router.navigate('/about')
    expect(router.get().path).toBe('about')
  })

  it('getRoutes returns route map', () => {
    const router = createRouter({ 'a': { view: () => '' }, 'b': { view: () => '' } })
    const routes = router.getRoutes()
    expect(Object.keys(routes)).toContain('a')
    expect(Object.keys(routes)).toContain('b')
  })
})
