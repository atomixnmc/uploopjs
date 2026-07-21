import { describe, it, expect, vi } from 'vitest'
import {
  createRouter,
  createPageRouter,
  createEventRouter,
  createServiceRouter,
  createStreamRouter,
  createContext,
  createPipeline,
  composeMiddleware,
  loggerMiddleware,
  errorMiddleware,
  timeoutMiddleware,
  createMatcher,
  normalizePath,
  parsePattern,
  matchPath,
  rankPatterns
} from '../src/index.js'

// ============================================================================
// Context
// ============================================================================
describe('createContext', () => {
  it('creates a context with defaults', () => {
    const ctx = createContext()
    expect(ctx.path).toBe('')
    expect(ctx.params).toEqual({})
    expect(ctx.query).toEqual({})
    expect(ctx.auth).toEqual({ user: null, session: null, token: null })
    expect(ctx.status()).toBe(ctx)
    expect(ctx.getStatus()).toBe(200)
  })

  it('creates context with initial values', () => {
    const ctx = createContext({ path: '/test', params: { id: '42' }, query: { sort: 'asc' } })
    expect(ctx.path).toBe('/test')
    expect(ctx.params.id).toBe('42')
    expect(ctx.query.sort).toBe('asc')
  })

  it('sets status and headers', () => {
    const ctx = createContext()
    ctx.status(404)
    ctx.header('X-Custom', 'value')
    expect(ctx.getStatus()).toBe(404)
    expect(ctx.getHeader('X-Custom')).toBe('value')
  })

  it('clones with overrides', () => {
    const ctx = createContext({ path: '/a', state: { key: 'val' } })
    const cloned = ctx.clone({ path: '/b' })
    expect(cloned.path).toBe('/b')
    expect(ctx.path).toBe('/a')   // original unchanged
    expect(cloned.state).toEqual({}) // new state
    expect(ctx.state).toEqual({ key: 'val' })
  })

  it('detects server vs client', () => {
    const serverCtx = createContext({ req: {}, res: {} })
    expect(serverCtx.isServer).toBe(true)
    expect(serverCtx.isClient).toBe(false)
  })
})

// ============================================================================
// Middleware Pipeline
// ============================================================================
describe('createPipeline', () => {
  it('runs middleware in order', async () => {
    const order = []
    const m1 = async (ctx, next) => { order.push(1); return next() }
    const m2 = async (ctx, next) => { order.push(2); return next() }
    const m3 = async (ctx, next) => { order.push(3); return next() }

    const pipe = createPipeline([m1, m2, m3])
    await pipe.run({})
    expect(order).toEqual([1, 2, 3])
  })

  it('modifies context through pipeline', async () => {
    const pipe = createPipeline([
      async (ctx, next) => { ctx.count = 1; return next() },
      async (ctx, next) => { ctx.count += 2; return next() }
    ])
    const result = await pipe.run({ count: 0 })
    expect(result.count).toBe(3)
  })

  it('short-circuits', async () => {
    const calls = []
    const pipe = createPipeline([
      async (ctx, next) => { calls.push(1); return ctx },  // no next()
      async (ctx, next) => { calls.push(2); return next() }
    ])
    await pipe.run({})
    expect(calls).toEqual([1])
  })

  it('composes middleware', async () => {
    const m1 = async (ctx, next) => { ctx.a = 1; return next() }
    const m2 = async (ctx, next) => { ctx.b = 2; return next() }
    const composed = composeMiddleware(m1, m2)
    const ctx = await composed({}, async (c) => c)
    expect(ctx.a).toBe(1)
    expect(ctx.b).toBe(2)
  })

  it('can use() to extend pipeline', async () => {
    const pipe = createPipeline()
    const ext = pipe.use(async (ctx, next) => { ctx.x = 10; return next() })
    const ctx = await ext.run({})
    expect(ctx.x).toBe(10)
    expect(pipe.length()).toBe(0)
    expect(ext.length()).toBe(1)
  })

  it('errorMiddleware catches errors', async () => {
    let caught = null
    const pipe = createPipeline([
      errorMiddleware((err, ctx) => { caught = err.message; ctx._status = 500; return ctx }),
      async () => { throw new Error('boom') }
    ])
    const ctx = await pipe.run({})
    expect(caught).toBe('boom')
    expect(ctx._status).toBe(500)
  })

  it('loggerMiddleware does not throw', async () => {
    const pipe = createPipeline([loggerMiddleware()])
    const ctx = await pipe.run({ path: '/test' })
    expect(ctx.path).toBe('/test')
  })
})

// ============================================================================
// Pattern Matcher
// ============================================================================
describe('createMatcher', () => {
  it('matches exact static paths', () => {
    const m = createMatcher()
    m.add('users/list', 'handler1')
    m.add('users/create', 'handler2')

    expect(m.match('users/list').handler).toBe('handler1')
    expect(m.match('users/create').handler).toBe('handler2')
  })

  it('matches parametric paths', () => {
    const m = createMatcher()
    m.add('users/:id', 'userHandler')

    const result = m.match('users/42')
    expect(result.handler).toBe('userHandler')
    expect(result.params).toEqual({ id: '42' })
  })

  it('matches multiple params', () => {
    const m = createMatcher()
    m.add('orgs/:orgId/repos/:repoName', 'repoHandler')

    const result = m.match('orgs/acme/repos/backend')
    expect(result.handler).toBe('repoHandler')
    expect(result.params).toEqual({ orgId: 'acme', repoName: 'backend' })
  })

  it('matches wildcard segments (*)', () => {
    const m = createMatcher()
    m.add('files/*', 'fileHandler')

    const result = m.match('files/readme.md')
    expect(result.handler).toBe('fileHandler')
    expect(result.params['*']).toBe('readme.md')
  })

  it('matches globstar (**)', () => {
    const m = createMatcher()
    m.add('docs/**', 'docHandler')

    const r1 = m.match('docs/getting-started')
    expect(r1.handler).toBe('docHandler')
    expect(r1.params['**']).toBe('getting-started')

    const r2 = m.match('docs/api/v2/auth')
    expect(r2.handler).toBe('docHandler')
    expect(r2.params['**']).toBe('api/v2/auth')

    const r3 = m.match('docs')
    expect(r3).toBeTruthy()
    expect(r3.params['**']).toBe('')
  })

  it('matches regex params', () => {
    const m = createMatcher()
    m.add('users/:id(\\d+)', 'userHandler')
    m.add('users/:name', 'fallbackHandler')

    expect(m.match('users/42').handler).toBe('userHandler')
    expect(m.match('users/alice').handler).toBe('fallbackHandler')
  })

  it('matches optional params', () => {
    const m = createMatcher()
    m.add('search/:query?', 'searchHandler')

    expect(m.match('search').handler).toBe('searchHandler')
    expect(m.match('search/hello').handler).toBe('searchHandler')
    expect(m.match('search/hello').params.query).toBe('hello')
  })

  it('prefers static over param for specificity', () => {
    const m = createMatcher()
    m.add('users/new', 'newHandler')
    m.add('users/:id', 'userHandler')

    expect(m.match('users/new').handler).toBe('newHandler')
    expect(m.match('users/99').handler).toBe('userHandler')
  })

  it('returns null for no match', () => {
    const m = createMatcher()
    m.add('home', 'homeHandler')
    expect(m.match('nonexistent')).toBeNull()
  })

  it('lists registered routes', () => {
    const m = createMatcher()
    m.add('a', 1)
    m.add('b/:id', 2)
    expect(m.list()).toHaveLength(2)
    expect(m.size).toBe(2)
  })

  it('removes routes', () => {
    const m = createMatcher()
    m.add('a', 1)
    m.remove('a')
    expect(m.match('a')).toBeNull()
  })
})

describe('pattern helpers', () => {
  it('normalizePath', () => {
    expect(normalizePath('/test/')).toBe('test')
    expect(normalizePath('//test//')).toBe('test')
    expect(normalizePath('')).toBe('')
  })

  it('parsePattern', () => {
    expect(parsePattern('users/:id')).toEqual([
      { type: 'static', value: 'users' },
      { type: 'param', name: 'id' }
    ])
    expect(parsePattern('files/*')).toEqual([
      { type: 'static', value: 'files' },
      { type: 'wildcard', name: '*' }
    ])
    expect(parsePattern('api/**')).toEqual([
      { type: 'static', value: 'api' },
      { type: 'globstar' }
    ])
    expect(parsePattern(':id(\\d+)')).toEqual([
      { type: 'param', name: 'id', regex: /^\d+$/ }
    ])
  })

  it('matchPath simple', () => {
    expect(matchPath(':id', '42')).toEqual({ id: '42' })
    expect(matchPath('users/:id/posts/:postId', 'users/3/posts/7'))
      .toEqual({ id: '3', postId: '7' })
  })

  it('rankPatterns sorts by specificity', () => {
    const sorted = rankPatterns(['files/*', 'users/:id', 'users/new', 'api/**'])
    expect(sorted[0]).toBe('users/new')
  })
})

// ============================================================================
// Event Router
// ============================================================================
describe('createEventRouter', () => {
  it('dispatches events to matching handlers', async () => {
    const events = createEventRouter({
      'order:created': (payload, ctx) => {
        ctx.result = `created order ${payload.id}`
      }
    })

    const ctx = {}
    await events.dispatch('order:created', { id: 1 }, ctx)
    expect(ctx.result).toBe('created order 1')
  })

  it('uses guard to block events', async () => {
    const events = createEventRouter({
      'admin:delete': {
        guard: (payload, ctx) => ctx.isAdmin,
        handler: (payload, ctx) => { ctx.deleted = true }
      }
    })

    const ctx1 = { isAdmin: false }
    await events.dispatch('admin:delete', { id: 1 }, ctx1)
    expect(ctx1.deleted).toBeUndefined()

    const ctx2 = { isAdmin: true }
    await events.dispatch('admin:delete', { id: 2 }, ctx2)
    expect(ctx2.deleted).toBe(true)
  })

  it('matches wildcard events', async () => {
    const calls = []
    const events = createEventRouter({
      'payment:*': (payload, ctx) => { calls.push(ctx.path) }
    })

    await events.dispatch('payment:received', {}, {})
    await events.dispatch('payment:failed', {}, {})
    expect(calls).toEqual(['payment:received', 'payment:failed'])
  })

  it('supports event listeners', async () => {
    const events = createEventRouter({})
    const received = []
    events.on('user:login', (payload) => received.push(payload))

    await events.dispatch('user:login', { user: 'alice' })
    expect(received).toEqual([{ user: 'alice' }])
  })

  it('supports wildcard listeners', async () => {
    const events = createEventRouter({})
    const all = []
    events.on('*', (payload, ctx) => all.push(ctx.path))

    await events.dispatch('a', {}, {})
    await events.dispatch('b', {}, {})
    expect(all).toEqual(['a', 'b'])
  })

  it('broadcasts to all handlers', async () => {
    const events = createEventRouter({
      'a': (payload, ctx) => { ctx.a = true },
      'b': (payload, ctx) => { ctx.b = true }
    })
    const ctx = {}
    await events.broadcast({}, ctx)
    expect(ctx.a).toBe(true)
    expect(ctx.b).toBe(true)
  })

  it('adds and removes routes at runtime', async () => {
    const events = createEventRouter({})
    events.addRoute('dynamic:event', (payload, ctx) => { ctx.hit = true })
    const ctx = {}
    await events.dispatch('dynamic:event', {}, ctx)
    expect(ctx.hit).toBe(true)

    events.removeRoute('dynamic:event')
    const ctx2 = {}
    await events.dispatch('dynamic:event', {}, ctx2)
    expect(ctx2.hit).toBeUndefined()
  })
})

// ============================================================================
// Service Router
// ============================================================================
describe('createServiceRouter', () => {
  it('calls service methods', async () => {
    const services = createServiceRouter({
      products: {
        find: (params, ctx) => [{ id: 1, name: 'Widget' }],
        get: (id, ctx) => ({ id, name: 'Widget' }),
        create: (data, ctx) => ({ ...data, id: 99 })
      }
    })

    const results = await services.call('products.find', {})
    expect(results).toEqual([{ id: 1, name: 'Widget' }])

    const item = await services.call('products.get', 1)
    expect(item.id).toBe(1)

    const created = await services.call('products.create', { name: 'New' })
    expect(created.id).toBe(99)
  })

  it('supports service.method notation', async () => {
    const services = createServiceRouter({
      users: { find: () => ['alice'] }
    })
    const result = await services.call('users.find')
    expect(result).toEqual(['alice'])
  })

  it('throws on missing service', async () => {
    const services = createServiceRouter({})
    await expect(services.call('nonexistent.method')).rejects.toThrow('Service "nonexistent" not found')
  })

  it('throws on missing method', async () => {
    const services = createServiceRouter({ users: {} })
    await expect(services.call('users.delete')).rejects.toThrow('Method "delete" not found')
  })

  it('executes service-level guards', async () => {
    const services = createServiceRouter({
      admin: {
        guard: (args, ctx) => args?.[0]?.role === 'admin',
        methods: {
          dashboard: (data, ctx) => 'secret'
        }
      }
    })

    await expect(services.call('admin.dashboard', { role: 'user' }))
      .rejects.toThrow('Guard blocked')

    const result = await services.call('admin.dashboard', { role: 'admin' })
    expect(result).toBe('secret')
  })

  it('executes method-level guards', async () => {
    const services = createServiceRouter({
      posts: {
        methods: {
          delete: {
            guard: (id, ctx) => ctx.isAdmin,
            handler: (id, ctx) => `deleted ${id}`
          }
        }
      }
    })

    await expect(services.call('posts.delete', 1, { isAdmin: false }))
      .rejects.toThrow('Method guard blocked')

    const result = await services.call('posts.delete', 1, { isAdmin: true })
    expect(result).toBe('deleted 1')
  })

  it('adds/removes services at runtime', async () => {
    const services = createServiceRouter({})
    services.addService('temp', { methods: { hello: () => 'world' } })
    expect(await services.call('temp.hello')).toBe('world')

    services.removeService('temp')
    await expect(services.call('temp.hello')).rejects.toThrow('not found')
  })

  it('lists services', () => {
    const services = createServiceRouter({
      a: { methods: { x() {}, y() {} } },
      b: { methods: { z() {} } }
    })
    const list = services.list()
    expect(list.a).toEqual(['x', 'y'])
    expect(list.b).toEqual(['z'])
  })

  it('supports realtime events', async () => {
    const events = []
    const services = createServiceRouter({
      messages: {
        methods: {
          send: {
            realtime: true,
            handler: (data, ctx) => data
          }
        }
      }
    })

    services.on('messages.send', (payload) => events.push(payload))
    await services.call('messages.send', { text: 'hello' })
    expect(events).toHaveLength(1)
    expect(events[0].result.text).toBe('hello')
  })
})

// ============================================================================
// Stream Router
// ============================================================================
describe('createStreamRouter', () => {
  it('opens a stream and iterates', async () => {
    const streams = createStreamRouter({
      'test:numbers': async function* () {
        yield 1; yield 2; yield 3
      }
    })

    const instance = streams.open('test:numbers')
    const values = []
    for await (const v of instance) {
      values.push(v)
    }
    expect(values).toEqual([1, 2, 3])
    expect(instance.closed).toBe(true)
  })

  it('blocks with guard', () => {
    const streams = createStreamRouter({
      'admin:feed': {
        guard: (ctx) => ctx.meta?.role === 'admin',
        source: async function* () { yield 1 }
      }
    })

    expect(() => streams.open('admin:feed', { meta: { role: 'user' } }))
      .toThrow('Guard blocked')

    const inst = streams.open('admin:feed', { meta: { role: 'admin' } })
    expect(inst).toBeDefined()
    inst.close()
  })

  it('supports data listeners', async () => {
    const streams = createStreamRouter({
      'ticker': async function* () { yield 'AAPL'; yield 'GOOG' }
    })

    const inst = streams.open('ticker')
    const received = []
    inst.on('data', (d) => received.push(d))

    // drain
    for await (const _ of inst) { /* drain */ }
    expect(received).toEqual(['AAPL', 'GOOG'])
  })

  it('broadcasts to active instances', () => {
    const streams = createStreamRouter({
      'chat': async function* () { /* never yields */ yield; await new Promise(() => {}) }
    })

    const inst = streams.open('chat')
    const received = []
    inst.on('data', (d) => received.push(d))

    streams.broadcast('chat', { user: 'alice', text: 'hi' })
    expect(received).toEqual([{ user: 'alice', text: 'hi' }])
    inst.close()
  })

  it('lists streams with status', () => {
    const streams = createStreamRouter({
      'live:scores': { source: async function* () {}, guard: () => true },
      'static:log': async function* () {}
    })
    const list = streams.list()
    expect(list['live:scores'].hasGuard).toBe(true)
    expect(list['live:scores'].transport).toBe('sse')
    expect(list['static:log'].hasGuard).toBe(false)
  })
})

// ============================================================================
// Unified Router
// ============================================================================
describe('createRouter (unified)', () => {
  it('creates unified router with all modes', () => {
    const router = createRouter({
      pages: { '/': () => 'home' },
      events: { 'test': () => {} },
      services: { api: { ping: () => 'pong' } },
      streams: { 'feed': async function* () {} }
    })

    expect(router.pages).toBeDefined()
    expect(router.events).toBeDefined()
    expect(router.services).toBeDefined()
    expect(router.streams).toBeDefined()
    expect(router.navigate).toBeDefined()
  })

  it('supports v0.9 API: createRouter(routes)', () => {
    const router = createRouter({ 'home': { view: () => 'Home' } })
    expect(router.navigate).toBeDefined()
    expect(router.getRoutes()).toHaveProperty('home')
  })

  it('supports v0.9 API: createRouter(routes, options)', () => {
    const router = createRouter({ 'home': { view: () => 'Home' } }, { base: 'app' })
    expect(router.getRoutes()).toHaveProperty('home')
  })

  it('creates request context with router attached', () => {
    const router = createRouter({ pages: { '/': () => 'home' } })
    const ctx = router.createRequestContext({ path: '/test' })
    expect(ctx.router.pages).toBeDefined()
    expect(ctx.path).toBe('/test')
  })

  it('delegates page navigation', () => {
    const router = createRouter({
      pages: { 'about': { view: () => 'About' } }
    })
    router.navigate('about')
    expect(router.getCurrentPath()).toBe('about')
  })

  it('dispatches events through unified router', async () => {
    const router = createRouter({
      events: { 'ping': (payload, ctx) => { ctx.pong = true } }
    })
    const ctx = {}
    await router.events.dispatch('ping', {}, ctx)
    expect(ctx.pong).toBe(true)
  })

  it('calls services through unified router', async () => {
    const router = createRouter({
      services: { test: { echo: (data) => data } }
    })
    const result = await router.services.call('test.echo', 'hello')
    expect(result).toBe('hello')
  })

  it('mounts sub-routers', () => {
    const adminRouter = createRouter({
      pages: { 'dashboard': { view: () => 'Admin Dashboard' } }
    })

    const mainRouter = createRouter({
      pages: { 'home': { view: () => 'Home' } }
    })

    mainRouter.mount('admin', adminRouter)
    mainRouter.navigate('home')
    expect(mainRouter.getCurrentPath()).toBe('home')
  })
})

// ============================================================================
// Page Router Extended
// ============================================================================
describe('createPageRouter (extended)', () => {
  it('supports resolve() for reverse routing', () => {
    const router = createPageRouter({
      'users/:id': { view: () => 'user' }
    })
    const path = router.resolve('users/:id', { id: '42' })
    expect(path).toBe('users/42')
  })

  it('supports href() anchor generation', () => {
    const router = createPageRouter({
      'about': { view: () => 'about' }
    })
    const html = router.href('about', {}, 'About Us')
    expect(html).toContain('href="/about"')
    expect(html).toContain('About Us')
  })

  it('listRoutes returns array format', () => {
    const router = createPageRouter({
      'a': { view: () => 'A' },
      'b': { view: () => 'B' }
    })
    const list = router.listRoutes()
    expect(list).toHaveLength(2)
    expect(list[0].pattern).toBeDefined()
  })
})
