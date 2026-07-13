/**
 * Create a client-side proxy that mirrors a server-side loop.
 * send() goes over the transport; subscribe() receives pushes.
 *
 * @param {Object} options
 * @param {string} options.url — WebSocket URL or HTTP endpoint
 * @param {string} [options.transport='websocket'] — 'websocket' | 'http' | 'sse'
 * @param {string[]} [options.events] — events to forward (all if empty)
 * @returns {Object} remote loop proxy with send(), subscribe(), onDataChange()
 */
export function createRemoteLoop(options = {}) {
  const { url, transport = 'websocket', events = [] } = options
  const subscribers = new Set()
  const dataSubscribers = new Map()
  let ws = null
  let state = {}
  let connected = false

  function connect() {
    if (transport === 'websocket') {
      ws = new WebSocket(url)
      ws.onmessage = (msg) => {
        const envelope = JSON.parse(msg.data)
        if (envelope.type === 'state') {
          state = envelope.payload
          for (const fn of subscribers) fn(state)
        } else if (envelope.type === 'dataChange') {
          const subs = dataSubscribers.get(envelope.node)
          if (subs) {
            for (const fn of subs) fn(envelope.newValue, envelope.oldValue)
          }
        }
      }
      ws.onopen = () => { connected = true }
      ws.onclose = () => { connected = false; setTimeout(connect, 1000) }
    }
  }

  connect()

  return {
    send(event, ...args) {
      if (!connected) return
      const envelope = {
        type: 'event',
        name: event,
        payload: args,
        timestamp: Date.now()
      }
      if (ws) ws.send(JSON.stringify(envelope))
    },

    subscribe(fn) {
      subscribers.add(fn)
      return () => subscribers.delete(fn)
    },

    onDataChange(dataName, fn) {
      if (!dataSubscribers.has(dataName)) dataSubscribers.set(dataName, new Set())
      dataSubscribers.get(dataName).add(fn)
      return () => dataSubscribers.get(dataName)?.delete(fn)
    },

    get() {
      return state
    },

    close() {
      if (ws) ws.close()
    }
  }
}

/**
 * Create a server-side transport that exposes local loops to remote clients.
 *
 * @param {Object} options
 * @param {number} [options.port=3001] — WebSocket server port
 * @param {Object<string, Object>} options.loops — map of name → loop/graph instance
 * @returns {Object} transport server with close()
 */
export async function createTransportServer(options = {}) {
  const { port = 3001, loops = {} } = options

  // For Node.js: use 'ws' package. For now return stub.
  // In production, import WebSocketServer from 'ws'
  let wss = null

  try {
    const { WebSocketServer } = await import('ws')
    wss = new WebSocketServer({ port })

    wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        try {
          const envelope = JSON.parse(data.toString())
          if (envelope.type === 'event') {
            // Forward event to the appropriate loop
            // If event name matches a loop name, send there
            // Otherwise broadcast to all loops
            for (const [name, loop] of Object.entries(loops)) {
              if (typeof loop.send === 'function') {
                loop.send(envelope.name, ...(envelope.payload || []))
              }
            }
          }
        } catch (e) {
          console.error('[uploop/sst] transport error:', e)
        }
      })

      // Send initial state
      const initialState = {}
      for (const [name, loop] of Object.entries(loops)) {
        if (typeof loop.get === 'function') {
          initialState[name] = loop.get()
        }
      }
      ws.send(JSON.stringify({ type: 'state', payload: initialState }))

      // Subscribe to loop changes and push to client
      for (const [name, loop] of Object.entries(loops)) {
        if (typeof loop.subscribe === 'function') {
          loop.subscribe((newState) => {
            if (ws.readyState === 1) { // WebSocket.OPEN
              ws.send(JSON.stringify({ type: 'state', payload: { [name]: newState } }))
            }
          })
        }
        if (typeof loop.onDataChange === 'function') {
          // Push data changes
          const dataNodes = loop.nodes?.names || []
          for (const node of dataNodes) {
            loop.onDataChange(node, (newVal, oldVal) => {
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({
                  type: 'dataChange',
                  node: name + '.' + node,
                  newValue: newVal,
                  oldValue: oldVal
                }))
              }
            })
          }
        }
      }
    })
  } catch (e) {
    console.warn('[uploop/sst] WebSocket server not available. Install "ws" package.')
  }

  return {
    close() {
      if (wss) wss.close()
    }
  }
}
