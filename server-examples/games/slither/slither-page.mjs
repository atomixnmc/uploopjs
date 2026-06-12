import { component } from '@uploop/core'
import { html } from '@uploop/html'

export const SlitherPage = component('SlitherPage', {
  state: { snakes: {}, food: [], tick: 0, players: 0 },
  view: (s) => {
    const count = Object.values(s.snakes).filter(sn => sn.alive).length
    return html`
      <div style="max-width:700px;margin:0 auto;padding:1rem;font-family:system-ui">
        <h2>🐍 Slither (Multiplayer)</h2>
        <p style="color:#888;font-size:0.9rem">${count} player${count !== 1 ? 's' : ''} online · Arrow keys to move · Wrap-around map · Eat food to grow</p>
        <canvas id="slither-canvas" width="720" height="480" style="border:2px solid #333;border-radius:8px;background:#111;display:block;margin:1rem 0"></canvas>
        
      </div>
    `
  }
})

export function slitherClientScript() {
  return `<script>
const canvas = document.getElementById('slither-canvas')
const ctx = canvas.getContext('2d')
const CELL = 12
const ws = new WebSocket('ws://localhost:3500/ws-slither')
const playerId = 'p' + Math.random().toString(36).slice(2, 8)
const name = 'Snake' + Math.floor(Math.random() * 1000)
let state = { snakes: {}, food: [] }

ws.onopen = () => ws.send(JSON.stringify({ type: 'join', id: playerId, name }))

ws.onmessage = (e) => {
  state = JSON.parse(e.data)
  draw()
}

document.onkeydown = (e) => {
  const dirs = { ArrowUp: {x:0,y:-1}, ArrowDown: {x:0,y:1}, ArrowLeft: {x:-1,y:0}, ArrowRight: {x:1,y:0} }
  const dir = dirs[e.key]
  if (dir) {
    e.preventDefault()
    ws.send(JSON.stringify({ type: 'turn', playerId, dir }))
  }
}

function draw() {
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, 720, 480)

  // Grid
  ctx.strokeStyle = '#1a1a1a'
  for (let x = 0; x < 60; x++) {
    for (let y = 0; y < 40; y++) {
      ctx.strokeRect(x * CELL, y * CELL, CELL, CELL)
    }
  }

  // Food
  ctx.fillStyle = '#ff0'
  for (const f of state.food || []) {
    ctx.fillRect(f.x * CELL + 2, f.y * CELL + 2, CELL - 4, CELL - 4)
  }

  // Snakes
  for (const snake of Object.values(state.snakes || {})) {
    if (!snake.alive) continue
    ctx.fillStyle = snake.color
    for (const seg of snake.body) {
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2)
    }
    // Name
    const head = snake.body[0]
    ctx.fillStyle = '#fff'
    ctx.font = '10px monospace'
    ctx.fillText(snake.name + ' ' + (snake.score || 0), head.x * CELL, head.y * CELL - 2)
  }

  requestAnimationFrame(draw)
}
draw()
</script>`
}
