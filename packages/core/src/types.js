/**
 * @typedef {Object} LoopConfig
 * @property {Object} [state] - Initial state
 * @property {Object<string, (Function|{run: Function, debounce: number, interruptible: boolean})>} [update] - Update handlers (plain function or { run, debounce, interruptible })
 * @property {Object<string, Function>} [effect] - Effect handlers
 * @property {string} [name] - Loop name (for debugging)
 * @property {'micro'|'visual'|'idle'|'manual'} [frame] - Frame scheduler mode
 * @property {number} [maxEventDepth=100] - Max nested send() calls
 * @property {number} [maxEventsPerTransaction=0] - Max same-event per txn
 * @property {Function} [onUnknownEvent] - Called for unregistered events
 * @property {Function} [onEventRejected] - Called when an event is rejected
 * @property {Object<string, {retry: number, fallback?: any}>} [error] - Per-event error config: retry count + optional fallback state
 * @property {Object<string, any>} [suspend] - Per-event suspend config (marks handler as async/pending)
 * @property {Object<string, {ttl: number, swr?: boolean, fetch?: string}>} [cache] - Per-key cache config: TTL in ms, SWR mode, optional fetch event
 * @property {boolean} [dev=false] - Enable dev-mode validation (unused keys, unknown events)
 */

/**
 * @typedef {Object} GraphConfig
 * @property {string} [name] - Graph name
 * @property {Object<string, NodeDef>} nodes - Node definitions
 * @property {Array<[string,string]>} [edges] - Edge pairs
 * @property {Object<string, string>} [on] - Event → update node name
 * @property {'micro'|'visual'|'idle'|'manual'} [frame] - Scheduler mode
 * @property {number} [maxEventDepth=100]
 * @property {number} [maxEventsPerTransaction=0]
 * @property {Function} [onUnknownEvent]
 * @property {Function} [onEventRejected]
 */

/**
 * @typedef {Object} NodeDef
 * @property {'data'|'update'|'view'|'effect'|'event'|'resource'} type
 * @property {*} [default] - Default value (for data nodes)
 * @property {Function} [run] - Handler function (for update/view/effect)
 * @property {string[]} [reads] - Data node names this reads
 * @property {string[]} [writes] - Data node names this writes
 * @property {string} [lifetime] - 'transient'|'hot'|'cold'|'stable'|'persistent'
 * @property {'micro'|'visual'|'idle'|'network'} [frame] - Suggested frame
 * @property {number} [debounce] - Debounce ms
 * @property {boolean} [cancelPrevious] - Cancel prev pending execution
 * @property {Object} [cache] - Cache policy { key, ttl }
 * @property {boolean} [pure] - Pure function (no side effects)
 */

/**
 * @typedef {Object} EventEnvelope
 * @property {string} id
 * @property {string} type
 * @property {Array} payload
 * @property {'user'|'system'|'effect'|'external'} source
 * @property {string|null} cause
 * @property {number} depth
 * @property {number} timestamp
 * @property {string} transaction
 */

/**
 * @typedef {Object} Loop
 * @property {Function} get - Get current state
 * @property {Function} set - Set state directly
 * @property {Function} send - Send an event/update
 * @property {Function} subscribe - Subscribe → unsubscribe()
 * @property {Function} on - Register update handler at runtime
 * @property {Function} effect - Register an effect
 * @property {Object} frame - Frame scheduler
 * @property {Function} batch - Batch multiple updates
 * @property {Function} use - Extend with plugin
 * @property {Function} registerNode - Declare a node
 * @property {Function} registerEdge - Declare an edge
 * @property {Function} describe - Export HyperGraph manifest
 * @property {Function} dispose - Clean up
 * @property {Function} isPending - Check if an async handler is in-flight
 * @property {Function} getError - Get error state for an event handler
 * @property {Function} clearError - Clear error state for an event handler
 * @property {Function} getMeta - Get metadata (debounce, interruptible) for a handler
 * @property {Function} getCached - Get cached value with freshness info
 * @property {Function} cacheStatus - Check cache freshness for a key
 * @property {Function} invalidateCache - Force-expire a cache entry
 * @property {Function} clearCache - Clear all cache entries
 * @property {Function} validate - Run dev-mode validation, returns { unusedKeys, unknownEvents }
 * @property {Object} events - Event processing stats
 * @property {Object} nodes - Graph node introspection
 * @property {Object} edges - Graph edge introspection
 */

/**
 * @typedef {Object} Graph
 * @property {Function} get - Get all data as object
 * @property {Function} getNode - Get a single data node's value
 * @property {Function} set - Set a data node
 * @property {Function} setMany - Set multiple data nodes
 * @property {Function} send - Send an event
 * @property {Function} subscribe - Subscribe → unsubscribe()
 * @property {Object} frame - Frame scheduler
 * @property {Function} batch - Batch updates
 * @property {Function} use - Extend with plugin
 * @property {Function} registerNode - Declare a node
 * @property {Function} registerEdge - Declare an edge
 * @property {Function} describe - Export manifest
 * @property {Function} dispose - Clean up
 * @property {Object} events - Event stats { total, rejected, depth }
 * @property {Object} nodes - { names, types, get(name), data(name) }
 * @property {Object} edges - { list, get(from) }
 */

/**
 * @typedef {Object} Signal
 * @property {Function} get
 * @property {Function} set
 * @property {Function} subscribe
 * @property {Function} dispose
 */

/**
 * @typedef {Object} Frame
 * @property {Function} schedule
 * @property {Function} flush
 * @property {Function} dispose
 */

/**
 * @typedef {Object} EffectContext
 * @property {Function} get
 * @property {Function} send
 * @property {Function} onDispose
 */

/**
 * @typedef {'micro'|'visual'|'idle'|'manual'} FrameMode
 */

export default {}
