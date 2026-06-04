import { describe, it, expect } from 'vitest'
import { createRouter } from '../src/index.js'

describe('createRouter advanced features', () => {
  it('resolves parametric routes', () => {
    const router = createRouter({
      'users/:id': { view: (s) => `User ${s.params.id}` },
      '': { view: () => 'Home' }
    }, { useHash: false })

    router.navigate('users/42')
    const state = router.get()
    expect(state.path).toBe('users/42')
    expect(state.params).toEqual({ id: '42' })
  })

  it('guards block navigation', () => {
    let blocked = false
    const router = createRouter({
      'admin': {
        view: () => 'Admin',
        guard: () => { blocked = true; return false }
      },
      '': { view: () => 'Home' }
    }, { useHash: false })

    router.navigate('admin')
    expect(router.get().path).not.toBe('admin')
    expect(blocked).toBe(true)
  })

  it('guards allow valid navigation', () => {
    const router = createRouter({
      'admin': { view: () => 'Admin', guard: () => true },
      '': { view: () => 'Home' }
    }, { useHash: false })

    router.navigate('admin')
    expect(router.get().path).toBe('admin')
  })

  it('canNavigate checks guards without navigating', () => {
    const router = createRouter({
      'admin': { view: () => 'Admin', guard: () => false },
      'public': { view: () => 'Public' }
    }, { useHash: false })

    expect(router.canNavigate('admin')).toBe(false)
    expect(router.canNavigate('public')).toBe(true)
  })

  it('addRoute registers routes at runtime', () => {
    const router = createRouter({ '': { view: () => 'Home' } })
    router.addRoute('about', { view: () => 'About' })
    router.navigate('about')
    expect(router.get().path).toBe('about')
  })

  it('getLayouts returns matching layout chain', () => {
    const router = createRouter({
      'admin': {
        view: () => 'Admin',
        layout: (s, content) => `[Admin]${content}[/Admin]`
      },
      'admin/users': {
        view: () => 'Users',
        layout: (s, content) => `[Sub]${content}[/Sub]`
      }
    })

    router.navigate('admin')
    const layouts = router.getLayouts()
    expect(layouts.length).toBe(1)
    expect(layouts[0].path).toBe('admin')
  })

  it('onNavigate hook fires on navigation', () => {
    const calls = []
    const router = createRouter({
      '': { view: () => 'Home' },
      'about': { view: () => 'About' }
    }, {
      onNavigate: (from, to) => calls.push([from, to])
    })

    router.navigate('about')
    expect(calls.length).toBe(1)
    expect(calls[0][1]).toBe('about')
  })

  it('wildcard route matches unknown paths', () => {
    const router = createRouter({
      '': { view: () => 'Home' },
      '*': { view: () => '404' }
    })

    router.navigate('nonexistent')
    const route = router.match()
    expect(route.view()).toBe('404')
  })

  it('params extracted for multiple segments', () => {
    const router = createRouter({
      'posts/:postId/comments/:commentId': {
        view: (s) => `Post ${s.params.postId} comment ${s.params.commentId}`
      }
    })

    router.navigate('posts/10/comments/20')
    expect(router.get().params).toEqual({ postId: '10', commentId: '20' })
  })

  it('loading and error state setters work', () => {
    const router = createRouter({ '': { view: () => 'Home' } })
    router.send('_setLoading', true)
    expect(router.loading).toBe(true)
    router.send('_setError', 'Test error')
    expect(router.error).toBe('Test error')
  })
})
