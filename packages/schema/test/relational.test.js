/**
 * @uploop/schema — Phase 2 Tests
 *
 * Covers: entity(), ref(), computed(), toGraph(), fromSchema()
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createGraph } from '../../core/src/index.js'
import {
  entity, ref, computed, registerEntity, getEntity, listEntities, clearRegistry,
  toGraph, fromSchema,
  string, number, boolean, enumeration, object, array, optional
} from '../src/index.js'

beforeEach(() => {
  clearRegistry()
})

// ── entity() ───────────────────────────────────────────────

describe('entity()', () => {
  it('creates a named entity with fields', () => {
    const User = entity('User', {
      name: string(),
      email: string().email()
    })

    expect(User.entityName).toBe('User')
    expect(User.kind).toBe('uploop.entity')

    const r = User.validate({ name: 'Alice', email: 'alice@example.com' })
    expect(r.ok).toBe(true)
    expect(r.value.name).toBe('Alice')
  })

  it('validates field types', () => {
    const User = entity('User', {
      name: string(),
      age: number().integer().min(0)
    })

    const r = User.validate({ name: 'Alice', age: -5 })
    expect(r.ok).toBe(false)
  })

  it('registers in the global entity registry', () => {
    const User = entity('User', { name: string() })
    const found = getEntity('User')
    expect(found).toBe(User)
  })

  it('listEntities() returns all registered entities', () => {
    entity('User', { name: string() })
    entity('Post', { title: string() })
    expect(listEntities()).toHaveLength(2)
  })

  it('stores entity metadata', () => {
    const User = entity('User', { name: string() }, {
      temperature: 'cold',
      lifetime: 'persistent',
      owner: 'server',
      consistency: 'strong',
      cache: { ttl: 300_000 },
      description: 'A registered user',
      aiRole: 'identity.User'
    })

    expect(User._entityMeta.temperature).toBe('cold')
    expect(User._entityMeta.lifetime).toBe('persistent')
    expect(User._entityMeta.owner).toBe('server')
    expect(User._entityMeta.cache.ttl).toBe(300_000)
  })

  it('describe() exports fields, relations, edges, and metadata', () => {
    const User = entity('User', {
      name: string().min(1),
      email: string().email()
    }, {
      temperature: 'cold',
      lifetime: 'persistent',
      owner: 'server'
    })

    const desc = User.describe()
    expect(desc.kind).toBe('uploop.entity')
    expect(desc.entity).toBe('User')
    expect(desc.fields.name).toBeDefined()
    expect(desc.fields.email).toBeDefined()
    expect(desc.relations).toEqual([])
    expect(desc.meta.temperature).toBe('cold')
    expect(desc.meta.owner).toBe('server')
    // All JSON-serializable
    expect(() => JSON.stringify(desc)).not.toThrow()
  })

  it('allows optional fields', () => {
    const User = entity('User', {
      name: string(),
      bio: string().optional()
    })

    expect(User.validate({ name: 'Alice' }).ok).toBe(true)
    expect(User.validate({ name: 'Alice', bio: 'Hi' }).ok).toBe(true)
  })

  it('extend() creates entity with added fields', () => {
    const Base = entity('Base', { name: string() })
    const Extended = Base.extend({ age: number() })
    expect(Extended.validate({ name: 'Alice', age: 30 }).ok).toBe(true)
    expect(Extended.entityName).toBe('Base')
  })

  it('pick() creates subset entity', () => {
    const User = entity('User', { name: string(), age: number(), email: string() })
    const Public = User.pick(['name', 'email'])
    expect(Public.validate({ name: 'Alice', email: 'a@b.com' }).ok).toBe(true)
  })

  it('omit() creates entity without specified fields', () => {
    const User = entity('User', { name: string(), age: number(), secret: string() })
    const Safe = User.omit(['secret'])
    expect(Safe.validate({ name: 'Alice', age: 30 }).ok).toBe(true)
  })

  it('partial() makes all fields optional', () => {
    const User = entity('User', { name: string(), age: number() })
    const Patch = User.partial()
    expect(Patch.validate({}).ok).toBe(true)
    expect(Patch.validate({ name: 'Alice' }).ok).toBe(true)
  })
})

// ── ref() — Relations ──────────────────────────────────────

describe('ref()', () => {
  it('creates a reference to another entity', () => {
    entity('User', { name: string() })
    const Post = entity('Post', {
      title: string(),
      author: ref('User')
    })

    const r = Post.validate({ title: 'Hello', author: 'user-123' })
    expect(r.ok).toBe(true)
  })

  it('allows null/undefined ref', () => {
    entity('User', { name: string() })
    const Post = entity('Post', {
      title: string(),
      author: ref('User').nullable()
    })

    expect(Post.validate({ title: 'Hello', author: null }).ok).toBe(true)
    expect(Post.validate({ title: 'Hello' }).ok).toBe(false) // required
  })

  it('describe() includes relation metadata', () => {
    entity('User', { name: string() })
    const Post = entity('Post', {
      title: string(),
      author: ref('User', { inverse: 'posts', type: 'manyToOne' })
    })

    const desc = Post.describe()
    expect(desc.relations).toHaveLength(1)
    expect(desc.relations[0]).toEqual({
      field: 'author',
      ref: 'User',
      type: 'manyToOne',
      inverse: 'posts'
    })
  })

  it('describe() generates edges from relations', () => {
    entity('User', { name: string() })
    const Post = entity('Post', {
      title: string(),
      author: ref('User')
    })

    const desc = Post.describe()
    expect(desc.edges).toContainEqual(['Post.author', 'User.id'])
  })

  it('hasRelation() checks relation existence', () => {
    entity('User', { name: string() })
    const Post = entity('Post', {
      title: string(),
      author: ref('User')
    })

    expect(Post.hasRelation('User')).toBe(true)
    expect(Post.hasRelation('Category')).toBe(false)
  })
})

// ── computed() ─────────────────────────────────────────────

describe('computed()', () => {
  it('defines a computed field', () => {
    const Product = entity('Product', {
      price: number(),
      quantity: number(),
      total: computed(['price', 'quantity'], (p) => p.price * p.quantity)
    })

    const r = Product.validate({ price: 10, quantity: 3 })
    expect(r.ok).toBe(true)
    expect(r.value.total).toBe(30)
  })

  it('describe() includes computed field info', () => {
    const Product = entity('Product', {
      price: number(),
      total: computed(['price'], (p) => p.price * 2)
    })

    const desc = Product.describe()
    expect(desc.fields.total.computed).toBe(true)
    expect(desc.fields.total.dependencies).toEqual(['price'])
  })

  it('skips computed field on validation error', () => {
    const Product = entity('Product', {
      price: number(),
      broken: computed(['price'], () => { throw new Error('oops') })
    })

    const r = Product.validate({ price: 10 })
    expect(r.ok).toBe(true)
    // broken field just skipped, not crashing
  })
})

// ── toGraph() — HyperGraph Integration ─────────────────────

describe('toGraph()', () => {
  it('generates createGraph() config from entities', () => {
    const User = entity('User', {
      name: string(),
      email: string().email()
    }, { temperature: 'cold', lifetime: 'persistent', owner: 'server', cache: { ttl: 300_000 } })

    const config = toGraph([User], { name: 'test' })
    expect(config.name).toBe('test')
    expect(config.nodes['User.name']).toBeDefined()
    expect(config.nodes['User.name'].type).toBe('data')
    expect(config.nodes['User.name'].default).toBe('')
    expect(config.nodes['User.name'].temperature).toBe('cold')
    expect(config.nodes['User.name'].lifetime).toBe('persistent')
    expect(config.nodes['User.email']).toBeDefined()
  })

  it('generates edges from entity relations', () => {
    entity('User', { name: string() })
    const Post = entity('Post', {
      title: string(),
      author: ref('User')
    })

    const config = toGraph([Post])
    expect(config.edges).toContainEqual(['Post.author', 'User.id'])
  })

  it('creates a working HyperGraph from entities', () => {
    const User = entity('User', {
      name: string(),
      age: number().integer().min(0)
    })

    const config = toGraph([User], { name: 'user-graph' })
    const graph = createGraph(config)

    // Data nodes are initialized with defaults
    expect(graph.getNode('User.name')).toBe('')
    expect(graph.getNode('User.age')).toBe(0)

    // Direct set works
    graph.set('User.name', 'Alice')
    expect(graph.getNode('User.name')).toBe('Alice')

    // describe() includes the data
    const all = graph.get()
    expect(all['User.name']).toBe('Alice')

    graph.dispose()
  })

  it('works with multiple entities', () => {
    const User = entity('User', { name: string() })
    const Post = entity('Post', { title: string(), author: ref('User') })

    const config = toGraph([User, Post], { name: 'multi' })
    const graph = createGraph(config)

    expect(graph.getNode('User.name')).toBe('')
    expect(graph.getNode('Post.title')).toBe('')
    expect(graph.getNode('Post.author')).toBeNull()

    graph.dispose()
  })

  it('merges extra nodes and edges', () => {
    const User = entity('User', { name: string() })

    const config = toGraph([User], {
      name: 'extended',
      nodes: {
        searchQuery: { type: 'data', default: '' }
      },
      edges: [
        ['searchQuery', 'User.name']
      ]
    })

    expect(config.nodes['searchQuery']).toBeDefined()
    expect(config.nodes['User.name']).toBeDefined()
  })

  it('generateCRUD creates auto set handlers', () => {
    const User = entity('User', { name: string(), age: number() })

    const config = toGraph([User], { name: 'crud', generateCRUD: true })
    expect(config.nodes['User.set']).toBeDefined()
    expect(config.nodes['User.set'].type).toBe('update')
    expect(config.on['User.set']).toBe('User.set')

    const graph = createGraph(config)
    graph.send('User.set', { name: 'Alice', age: 30 })
    expect(graph.getNode('User.name')).toBe('Alice')
    expect(graph.getNode('User.age')).toBe(30)
    graph.dispose()
  })
})

// ── fromSchema() — Store Integration ───────────────────────

describe('fromSchema()', () => {
  it('generates createLoop() config from entity', () => {
    const User = entity('User', { name: string(), age: number() })

    const config = fromSchema(User)
    expect(config.name).toBe('User')
    expect(config.state['User.name']).toBe('')
    expect(config.state['User.age']).toBe(0)
    expect(config.update.setName).toBeDefined()
    expect(config.update.setAge).toBeDefined()
    expect(config.update.set).toBeDefined()
  })
})

// ── AI-Readability ─────────────────────────────────────────

describe('AI-readability — entity describe()', () => {
  it('describe() output is fully JSON-serializable', () => {
    entity('User', { name: string() })
    const Post = entity('Post', {
      title: string(),
      body: string(),
      author: ref('User'),
      tags: array(string()),
      published: boolean().optional()
    }, {
      temperature: 'warm',
      lifetime: 'persistent',
      owner: 'server',
      cache: { ttl: 60_000, swr: true },
      description: 'A blog post',
      aiRole: 'content.post',
      aiHints: { searchable: ['title'], sortable: ['createdAt'] }
    })

    const desc = Post.describe()
    const json = JSON.stringify(desc)
    expect(() => JSON.parse(json)).not.toThrow()

    const parsed = JSON.parse(json)
    expect(parsed.kind).toBe('uploop.entity')
    expect(parsed.entity).toBe('Post')
    expect(parsed.fields.title).toBeDefined()
    expect(parsed.fields.author.relation.ref).toBe('User')
    expect(parsed.relations).toHaveLength(1)
    expect(parsed.edges).toContainEqual(['Post.author', 'User.id'])
    expect(parsed.meta.temperature).toBe('warm')
    expect(parsed.meta.aiRole).toBe('content.post')
    expect(parsed.meta.aiHints.searchable).toContain('title')
  })
})
