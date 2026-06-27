# Uploop v1.0–v2.0 Future Roadmap

> **Status:** Strategic Plan  
> **Date:** 2026-06-26  
> **Scope:** Long runtime integration (v1.0), i2c ecosystem convergence (v2.0)

---

## v1.0 — Uploop × Long Convergence

### Overview

v1.0 marks the production convergence of Uploop (the HyperGraph application framework) and Long (the polyglot JavaScript/TypeScript runtime built on Uploop's architecture). Both exit beta simultaneously and meet as a unified platform.

### Long: Beyond a Runtime

Long is not just a "faster Node.js." It's a purpose-built runtime that understands Uploop's HyperGraph natively. At v1.0, Long extends beyond execution into three new domains:

| Domain | What Long Provides | Why It Matters |
|--------|-------------------|---------------|
| **Native FFmpeg** | Hardware-accelerated media processing | Video, audio, image pipelines without external dependencies |
| **GPU Rendering** | WebGPU + native GPU via wgpu | Canvas, WebGL, 3D scenes rendered at native speed |
| **Tooling Engine** | Vite-class bundler + dev server replacement | Zero-config builds, HMR at native speed, memory-efficient serving |

### 1. Native FFmpeg Pipeline

```
┌──────────────────────────────────────────────┐
│              UPLOOP MEDIA FLOW                │
│                                                │
│  entity('VideoAsset', {                       │
│    source: binary(),                          │
│    format: enumeration(['mp4','webm','avi']), │
│    resolution: object({ w: number(), h: number() })│
│  })                                            │
│       │                                        │
│       ▼                                        │
│  createFlow(graph, flows.videoPlayer)          │
│       │                                        │
│       ▼                                        │
│  Long FFmpeg (native)                          │
│  • Hardware decode (GPU)                       │
│  • Transcode pipeline                          │
│  • Frame extraction                            │
│  • Thumbnail generation                        │
│  • Streaming output (uploop-stream binary)     │
└──────────────────────────────────────────────┘
```

**API surface**:
```js
// Uploop entity → Long FFmpeg pipeline
const videoAsset = entity('VideoAsset', {
  source: binary(),
  format: enumeration(['mp4', 'webm', 'avi', 'mov']),
  resolution: object({ width: number(), height: number() }),
  bitrate: number(),
  duration: number(),
  thumbnail: binary().optional()
})

// Auto-generated processing via flow
const videoFlow = createFlow(graph, flows.videoPlayer)
videoFlow.transcode({ from: 'mov', to: 'webm', quality: 80 })
videoFlow.extractFrames({ interval: '1s', format: 'png' })
videoFlow.generateThumbnail({ at: '50%', width: 320 })

// All operations run natively through Long — no child_process, no wasm-ffmpeg
```

### 2. GPU-Accelerated Rendering

Long provides native GPU access through both WebGPU (browser) and wgpu (native). Uploop's SceneGraph Booster executor routes canvas/WebGL/3D work directly to the GPU.

```
Uploop HyperGraph
    │
    ▼
SceneGraph Booster executor
    │
    ▼
Long GPU layer
    ├── WebGPU (browser) — zero-copy buffer sharing
    └── wgpu (native) — Vulkan/Metal/DX12 backends
```

**What this enables**:
- **Canvas 2D at 120fps**: Drawing app, whiteboard, diagram editor — GPU-rasterized
- **WebGL/WebGPU 3D**: Scene graph → GPU command buffer with no JS overhead
- **Video compositing**: Overlay graphics on video frames in real-time
- **Shader effects**: Entity-defined filter pipelines → GPU shader compilation
- **AI inference**: HyperAI models (v2.0) running on GPU via Long

### 3. Long DevTools — Vite Replacement

Long includes a built-in dev server and bundler that replaces Vite for Uploop projects. Because Long understands Uploop's HyperGraph, it can optimize in ways generic bundlers cannot.

| | Vite | Long DevTools |
|---|---|---|
| **HMR** | Module-level | **Graph-level** — only changed nodes re-execute |
| **Bundling** | esbuild + rollup | **Graph-aware tree-shaking** — remove unreferenced nodes |
| **Build time** | ~2-5s (cold) | **~0.5s** (graph pre-analyzed) |
| **Memory** | V8 heap (~200MB baseline) | **Temperature-aware** — hot paths in memory, cold on disk |
| **SSR** | Vite SSR (manual config) | **Native** — Long runs server-side graph directly |
| **Binary assets** | Manual config | **Entity-driven** — stream codec for assets |
| **Schema checking** | None | **Built-in** — entity validation at dev time |

**Usage**:
```bash
# Start Uploop app with Long dev server
long dev

# Build for production
long build

# Serve production build
long serve --port 3000
```

**Graph-aware optimizations**:
- **Dead node elimination**: `findOrphans()` at build time removes unreferenced data nodes
- **Precomputed critical paths**: Topological sort cached, no runtime analysis needed
- **VTable precompilation**: Binary stream vtables baked at build time, not computed per message
- **Temperature-based code splitting**: Hot code inlined, cold code lazy-loaded

---

## v2.0 — i2c Ecosystem Convergence

### Overview

v2.0 marks Uploop's integration with the broader i2c ecosystem — a family of AI-native, graph-driven platforms that share the HyperGraph architecture. Uploop becomes the application layer of a larger stack.

### The i2c Ecosystem at v2.0

```
┌─────────────────────────────────────────────────────────────┐
│                     i2c ECOSYSTEM v2.0                       │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │  Uploop  │  │  Quang   │  │ HyperAI  │  │    Minh      │ │
│  │ App FW   │  │ AI Cloud │  │Graph AI  │  │  AI Agent    │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘ │
│       │             │             │               │         │
│       └─────────────┼─────────────┼───────────────┘         │
│                     │             │                          │
│               ┌─────┴─────────────┴──────┐                   │
│               │       HYPERGRAPH         │                   │
│               │   (shared data model)    │                   │
│               └─────────────┬────────────┘                   │
│                             │                                │
│               ┌─────────────┴────────────┐                   │
│               │          Long            │                   │
│               │    (native runtime)      │                   │
│               └──────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Quang — AI-First Cloud Native

Quang is an AI-first cloud platform where applications are described as HyperGraphs, not configured as YAML. Uploop entities become cloud resources automatically.

| Quang Concept | Uploop Mapping |
|--------------|---------------|
| **Service** | `entity()` with `owner: 'server'` |
| **Database** | `entity()` with `lifetime: 'persistent'` → auto-provisioned |
| **Cache** | `entity()` with `cache: { ttl }` → auto CDN edge cache |
| **Queue** | `uploop/flows` pipeline → auto-provisioned message queue |
| **Storage** | `entity()` with binary fields → auto object storage |
| **Auth** | `@uploop/auth` → auto IAM policies |
| **Edge** | `entity()` with `temperature: 'hot'` → auto edge deployment |

**Deployment**: Push a HyperGraph to Quang — infrastructure auto-provisions:
```bash
long deploy --target quang
# Entity graph analyzed → D1 tables, R2 buckets, Worker routes, IAM policies generated
```

### 2.2 HyperAI — Transformer for HyperGraph

HyperAI is a graph-native AI model architecture. Unlike transformers (sequence-based), HyperAI operates on HyperGraphs directly — nodes, edges, and metadata become the model's attention context.

| Transformer (GPT) | HyperAI |
|-------------------|---------|
| Token sequence → attention matrix | **Graph nodes → edge-weighted attention** |
| Linear context window (8K–128K tokens) | **Graph context (unlimited nodes, connected by edges)** |
| Flat position encoding | **Structured: node type + edge type + metadata position** |
| Next-token prediction | **Next-node + next-edge prediction** |
| Text in, text out | **Graph in, graph out (code, UI, data, queries)** |

**Uploop integration**:
```js
// HyperAI reads the full application graph
const appGraph = createGraph(toGraph([User, Post, Comment]))

// AI understands the entire data model
const aiContext = HyperAI.context(appGraph)
// → HyperAI sees: 3 entities, 15 fields, 2 relations, 5 views, 4 update handlers

// AI generates new features as graph extensions
const newFeature = await HyperAI.generate(appGraph, {
  intent: intent({ Payment: { amount: 'num', userId: 'User', status: 'str|paid|pending' } })
})
// → Returns: entity('Payment', {...}) + toGraph([Payment]) + entityComponent(Payment)

// AI refactors safely — understands impact through graph edges
const impact = await HyperAI.predictImpact(appGraph, {
  change: 'remove User.age field'
})
// → Impact analysis: 3 views read User.age, 1 update writes User.age, 2 computed fields depend on it
```

### 2.3 Minh — AI Agent Platform

Minh is an AI agent platform (similar to Google's Gemini) that uses Uploop HyperGraphs as its native reasoning substrate. Minh agents understand Uploop applications at the graph level.

| Gemini/Claude | Minh |
|--------------|------|
| General-purpose chat agent | **Uploop-aware — reads describe() natively** |
| Tool calling via function schemas | **Entity-driven tools — entity() = tool schema** |
| Context window limits | **HyperGraph context — unlimited via edge traversal** |
| Code generation | **Graph generation — emits entities, flows, components** |
| No framework awareness | **Native Uploop understanding — knows about HyperGraph, flows, stream** |

**Minh agent in Uploop**:
```js
import { MinhAgent } from '@i2c/minh'

const agent = new MinhAgent({
  graph: appGraph,
  capabilities: ['codegen', 'refactor', 'testgen', 'deploy']
})

// Agent reads the entire app at the graph level
await agent.analyze(appGraph.describe())
// → "I see 3 entities (User, Post, Comment), 2 relations, 15 fields.
//    The User entity has cold temperature with 600s cache TTL.
//    The Post entity has a ref to User via author field.
//    I can help you add features, fix bugs, or optimize performance."

// Agent generates code as graph operations
const result = await agent.task('Add a like feature to posts')
// → Generates: entity('Like', { userId: ref('User'), postId: ref('Post') })
//             + update handler for toggling
//             + view component for like count
//             + test file
```

---

## Timeline

| Milestone | Date | Deliverables |
|-----------|------|-------------|
| **v0.9** | Q3 2026 | Auth, storage, GQL, store v2 |
| **v1.0-beta** | Q4 2026 | Long runtime beta, Uploop beta convergence |
| **v1.0** | Q1 2027 | Long GA (FFmpeg, GPU, DevTools), production-ready Uploop |
| **v2.0-alpha** | Q2 2027 | HyperAI prototype, Quang alpha |
| **v2.0** | Q4 2027 | Full i2c ecosystem: Uploop + Long + Quang + HyperAI + Minh |

---

*This roadmap reflects the strategic direction. Priorities may shift based on adoption and ecosystem feedback.*
