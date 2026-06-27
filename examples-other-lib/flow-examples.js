/**
 * Concrete Comparisons — Uploop vs React vs Solid
 *
 * Shows real code side-by-side for common use cases,
 * highlighting where Uploop flows provide measurable advantages.
 *
 * @module @uploop/flows/examples
 */

// ── Example 1: Search Typeahead ───────────────────────────

/**
 * React version — manual everything:
 *   - 3 useState hooks (query, results, loading)
 *   - useEffect with manual cleanup
 *   - Manual AbortController
 *   - No debounce built-in
 *   - No cache
 *   - ~30 lines of boilerplate
 */
export function reactSearchTypeahead() { /*
  function SearchBox() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
      if (!query) return
      const controller = new AbortController()
      const timer = setTimeout(async () => {
        setLoading(true)
        try {
          const res = await fetch(`/api?q=${query}`, { signal: controller.signal })
          setResults(await res.json())
        } catch (e) {
          if (e.name !== 'AbortError') console.error(e)
        }
        setLoading(false)
      }, 300)
      return () => { clearTimeout(timer); controller.abort() }
    }, [query])

    return <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      {loading && <span>Loading...</span>}
      <ul>{results.map(r => <li key={r.id}>{r.name}</li>)}</ul>
    </div>
  }
  // Problems:
  // - 3 state variables = minimum 3 re-renders per keystroke
  // - AbortController wiring is manual
  // - No caching — refetches on every keystroke
  // - Loading state is manual
  // - No error handling shown
*/}

/**
 * Solid version — signals reduce re-renders but still manual wiring:
 *   - createSignal for query, results, loading
 *   - createEffect for the fetch
 *   - Still manual AbortController
 *   - Still manual debounce
 *   - No cache built-in
 */
export function solidSearchTypeahead() { /*
  function SearchBox() {
    const [query, setQuery] = createSignal('')
    const [results, setResults] = createSignal([])
    const [loading, setLoading] = createSignal(false)

    createEffect(() => {
      const q = query()
      if (!q) return
      const controller = new AbortController()
      const timer = setTimeout(async () => {
        setLoading(true)
        try {
          const res = await fetch(`/api?q=${q}`, { signal: controller.signal })
          setResults(await res.json())
        } catch (e) {
          if (e.name !== 'AbortError') console.error(e)
        }
        setLoading(false)
      }, 300)
      onCleanup(() => { clearTimeout(timer); controller.abort() })
    })

    return <div>
      <input value={query()} onInput={e => setQuery(e.target.value)} />
      <Show when={loading()}><span>Loading...</span></Show>
      <For each={results()}>{r => <li>{r.name}</li>}</For>
    </div>
  }
  // Problems:
  // - Still ~25 lines of boilerplate
  // - createEffect with cleanup is verbose
  // - No automatic caching
  // - createSignal/createEffect are separate concerns
*/}

/**
 * Uploop version with flows.searchTypeahead:
 *   - All metadata declared on the graph node
 *   - debounce, interruptible, cache are part of the node definition
 *   - Ring buffer for suggestion streaming
 *   - No manual AbortController, no manual setTimeout
 *   - Loading/error states via isPending()/getError()
 *   - ~10 lines of setup
 */
export function uploopSearchTypeahead() { /*
  const search = createGraph({
    nodes: {
      query:     { type: 'data',    default: '',    temperature: 'warm', lifetime: 'transient' },
      results:   { type: 'data',    default: [],    temperature: 'cold', cache: { ttl: 30000 } },
      search:    { type: 'update',  reads: ['query'], writes: ['results'],
                   debounce: 200, interruptible: true, cancelPrevious: true,
                   run: async (data, q, { signal }) => {
                     const res = await fetch(`/api?q=${q}`, { signal })
                     return { results: await res.json() }
                   }
      }
    },
    edges: [['query', 'search']]
  })

  const tuned = createFlow(search, flows.searchTypeahead)
  // → Auto-applies:
  //   - 200ms debounce (built into graph metadata)
  //   - AbortController (interruptible = true)
  //   - LRU cache with 30s TTL
  //   - Ring buffer for suggestion backpressure
  //   - Query→warm, Suggestions→hot, Results→cold lane routing
*/}

// ── Example 2: Data Table / Spreadsheet ────────────────────

/**
 * React version — re-renders entire table on any cell change.
 * Virtualization is a separate library (react-window, tanstack-virtual).
 * Sorting/filtering is manual.
 */
export function reactDataGrid() { /*
  // Every cell change → re-render entire table
  // useMemo prevents some re-computation but not re-renders
  // react-window for virtualization (~3KB extra)
  // tanstack-table for sorting/filtering (~5KB extra)
  // Total: ~8KB of extra libs, still re-renders all visible rows
*/}

/**
 * Solid version — granular updates but still O(rows) tracking.
 * No built-in formula dependency graph for computed columns.
 */
export function solidDataGrid() { /*
  // createMemo for each cell → fine-grained but verbose
  // No formula dependency tracking — must manually wire computed columns
  // Virtualization: solid-virtual or custom
  // Range invalidation: manual
*/}

/**
 * Uploop version with flows.dataGrid:
 *   - Each cell is a data node; formulas are edges
 *   - Dirty range invalidation: only changed cells recompute
 *   - Topological sort ensures correct formula evaluation order
 *   - Columnar storage for memory efficiency
 *   - Viewport-only rendering — only visible rows in DOM
 */
export function uploopDataGrid() { /*
  const grid = createGraph({
    nodes: {
      // Column data stored columnar (not row-major) for cache locality
      'col.name':   { type: 'data', default: [] },
      'col.price':  { type: 'data', default: [] },
      'col.total':  { type: 'data', default: [], temperature: 'cold', cache: { ttl: 1000 } },
      // Formula: total = price * quantity
      computeTotal: { type: 'update', reads: ['col.price', 'col.quantity'], writes: ['col.total'],
                      run: (d) => ({ 'col.total': d['col.price'].map((p, i) => p * (d['col.quantity']?.[i] || 1)) }) },
      // View: render visible rows
      gridView:     { type: 'view', reads: ['col.name', 'col.price', 'col.total'], run: renderFn }
    },
    edges: [['col.price', 'computeTotal']]
  })

  const tuned = createFlow(grid, flows.dataGrid)
  // → Auto-applies:
  //   - Columnar storage for memory efficiency
  //   - Dirty range invalidation
  //   - Formula dependency graph (topological sort)
  //   - Virtual viewport (40 rows)
  //   - Incremental recompute (only changed cells)
*/}

// ── Example 3: Real-Time Dashboard ─────────────────────────

/**
 * React version — multiple useEffect hooks, each widget re-renders
 * independently but there's no coordination. Fast widgets block slow ones.
 */
export function reactDashboard() { /*
  // 5 widgets, each with its own useEffect for data fetching
  // Real-time widget at 10fps blocks historical widget
  // No lane prioritization — all updates treated equally
  // React 18 concurrent features help but are opt-in and complex
*/}

/**
 * Uploop version with flows.dashboard:
 *   - Each widget is an executor island
 *   - Real-time widgets on hot lane (RAF)
 *   - Summary widgets on warm lane (microtask)
 *   - Historical widgets on cold lane (idle)
 *   - 16ms total frame budget, split across lanes
 */
export function uploopDashboard() { /*
  const dash = createGraph({
    nodes: {
      // Real-time metrics — hot lane
      'rt.cpu':      { type: 'data', default: 0, temperature: 'hot' },
      'rt.memory':   { type: 'data', default: 0, temperature: 'hot' },
      // Summary — warm lane
      'summary.avg': { type: 'data', default: 0, temperature: 'warm', cache: { ttl: 5000 } },
      // Historical — cold lane
      'hist.7d':     { type: 'data', default: [], temperature: 'cold', cache: { ttl: 300_000 } },
      // Views
      rtGauge:       { type: 'view', reads: ['rt.cpu', 'rt.memory'], run: gaugeRender },
      summaryCard:   { type: 'view', reads: ['summary.avg'], run: cardRender },
      histChart:     { type: 'view', reads: ['hist.7d'], run: chartRender }
    }
  })

  const tuned = createFlow(dash, flows.dashboard)
  // Result:
  // - rtGauge updates at 60fps (hot lane, RAF)
  // - summaryCard updates every 5s (warm lane, microtask)
  // - histChart updates during idle (cold lane, requestIdleCallback)
  // - Never blocks interaction — guaranteed by frame budget enforcement
*/}

// ── Summary Comparison Table ───────────────────────────────

export const COMPARISON_TABLE = {
  searchTypeahead: {
    react:  { linesOfCode: '~30', reRenders: '3 per keystroke', cache: 'manual', debounce: 'manual useEffect cleanup', abort: 'manual AbortController', winner: false },
    solid:  { linesOfCode: '~25', reRenders: '0 (signals)', cache: 'manual', debounce: 'manual onCleanup', abort: 'manual AbortController', winner: false },
    uploop: { linesOfCode: '~10', reRenders: '0 (graph edges)', cache: 'auto LRU TTL', debounce: 'declared on node', abort: 'auto (interruptible)', winner: true }
  },
  dataGrid: {
    react:  { approach: 'VDOM diff entire tree', extraDeps: 'react-window + tanstack-table (~8KB)', formulaSupport: 'manual useMemo', memory: 'row-major', winner: false },
    solid:  { approach: 'Signal per cell', extraDeps: 'solid-virtual', formulaSupport: 'manual createMemo', memory: 'row-major', winner: false },
    uploop: { approach: 'Dirty range invalidation', extraDeps: 'none (built-in)', formulaSupport: 'graph edges = formulas', memory: 'columnar', winner: true }
  },
  realtimeCollab: {
    react:  { sync: 'useEffect + socket.io', conflict: 'manual OT/CRDT lib (~10KB)', presence: 'separate state', backpressure: 'none', winner: false },
    solid:  { sync: 'createEffect + socket.io', conflict: 'manual OT/CRDT', presence: 'separate signal', backpressure: 'none', winner: false },
    uploop: { sync: 'ring buffer + ETL guru', conflict: 'update handler merge', presence: 'hot lane data node', backpressure: 'ring buffer modes', winner: true }
  },
  aiAgentStream: {
    react:  { streaming: 'useEffect + EventSource', cancel: 'manual AbortController', tokens: 'setState per token → N re-renders', toolCalls: 'separate state machine', winner: false },
    solid:  { streaming: 'createEffect + EventSource', cancel: 'manual onCleanup', tokens: 'signal per token (better)', toolCalls: 'separate signals', winner: false },
    uploop: { streaming: 'ring buffer + interruptible', cancel: 'auto cancelPrevious', tokens: 'ring buffer latest-only', toolCalls: 'ETL guru pipeline', winner: true }
  }
}
