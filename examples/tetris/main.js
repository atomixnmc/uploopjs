import { html, component } from '@uploop/html'

// ─── Tetris constants ───────────────────────────────────────
const COLS = 10, ROWS = 20, BLOCK = 24
const SHAPES = [
  { n: 'I', blocks: [[1,1,1,1]], color: '#00f0f0' },
  { n: 'O', blocks: [[1,1],[1,1]], color: '#f0f000' },
  { n: 'T', blocks: [[0,1,0],[1,1,1]], color: '#a000f0' },
  { n: 'S', blocks: [[0,1,1],[1,1,0]], color: '#00f000' },
  { n: 'Z', blocks: [[1,1,0],[0,1,1]], color: '#f00000' },
  { n: 'L', blocks: [[1,0,0],[1,1,1]], color: '#f0a000' },
  { n: 'J', blocks: [[0,0,1],[1,1,1]], color: '#0000f0' }
]

function randShape() {
  const s = SHAPES[Math.floor(Math.random() * SHAPES.length)]
  return { ...s, blocks: s.blocks.map(r => [...r]) }
}

function rotate(mat) {
  return mat[0].map((_, i) => mat.map(r => r[i]).reverse())
}

function collides(board, piece, px, py) {
  for (let y = 0; y < piece.blocks.length; y++)
    for (let x = 0; x < piece.blocks[y].length; x++)
      if (piece.blocks[y][x] && (board[py + y]?.[px + x] !== 0)) return true
  return false
}

function mergeBoard(board, piece, px, py) {
  const b = board.map(r => [...r])
  for (let y = 0; y < piece.blocks.length; y++)
    for (let x = 0; x < piece.blocks[y].length; x++)
      if (piece.blocks[y][x]) b[py + y][px + x] = piece.color
  return b
}

function clearLines(board) {
  const remaining = board.filter(r => r.some(c => c === 0))
  const cleared = ROWS - remaining.length
  while (remaining.length < ROWS) remaining.unshift(new Array(COLS).fill(0))
  return { board: remaining, cleared }
}

// ─── Tetris Component ───────────────────────────────────────
const Tetris = component('Tetris', {
  state: {
    board: Array.from({ length: ROWS }, () => new Array(COLS).fill(0)),
    piece: null,
    px: 3, py: 0,
    score: 0,
    level: 1,
    running: false,
    gameOver: false,
    dropInterval: null
  },

  update: {
    start: (s) => {
      const p = randShape()
      return {
        ...s,
        board: Array.from({ length: ROWS }, () => new Array(COLS).fill(0)),
        piece: p,
        px: 3, py: 0,
        score: 0, level: 1,
        running: true, gameOver: false
      }
    },
    tick: (s) => {
      if (!s.running || !s.piece) return s
      if (!collides(s.board, s.piece, s.px, s.py + 1)) {
        return { ...s, py: s.py + 1 }
      }
      // Lock piece
      let board = mergeBoard(s.board, s.piece, s.px, s.py)
      const { board: newBoard, cleared } = clearLines(board)
      const score = s.score + cleared * cleared * 100
      const level = Math.floor(score / 500) + 1
      const nextPiece = randShape()
      if (collides(newBoard, nextPiece, 3, 0)) {
        return { ...s, board: newBoard, gameOver: true, running: false }
      }
      return {
        ...s, board: newBoard, piece: nextPiece,
        px: 3, py: 0, score, level
      }
    },
    move: (s, dx) => {
      if (!s.running || !s.piece) return s
      if (!collides(s.board, s.piece, s.px + dx, s.py)) {
        return { ...s, px: s.px + dx }
      }
      return s
    },
    rotate: (s) => {
      if (!s.running || !s.piece) return s
      const rotated = { ...s.piece, blocks: rotate(s.piece.blocks) }
      if (!collides(s.board, rotated, s.px, s.py)) {
        return { ...s, piece: rotated }
      }
      return s
    },
    hardDrop: (s) => {
      if (!s.running || !s.piece) return s
      let py = s.py
      while (!collides(s.board, s.piece, s.px, py + 1)) py++
      return { ...s, py }
    },
    stop: (s) => ({ ...s, running: false })
  },

  view: (state, { send }) => {
    // Render board with current piece
    let display = state.board.map(r => [...r])
    if (state.piece && state.running) {
      for (let y = 0; y < state.piece.blocks.length; y++)
        for (let x = 0; x < state.piece.blocks[y].length; x++)
          if (state.piece.blocks[y][x] && state.py + y >= 0)
            display[state.py + y][state.px + x] = state.piece.color
    }

    return html`
      <div style="font-family:sans-serif;padding:1rem;display:flex;gap:1.5rem;align-items:flex-start;justify-content:center;">
        <div>
          <div style="border:2px solid #333;border-radius:4px;overflow:hidden;line-height:0;background:#111;">
            ${display.map(row => html`
              <div style="display:flex;">
                ${row.map(cell => html`
                  <div style="width:${BLOCK}px;height:${BLOCK}px;
                              background:${cell || '#1a1a2e'};
                              ${cell ? `border:1px solid rgba(255,255,255,0.2)` : 'border:1px solid #222'};">
                  </div>
                `)}
              </div>
            `)}
          </div>
          <div style="display:flex;gap:0.25rem;margin-top:0.5rem;">
            <button @click=${() => send('move', -1)} style="flex:1;padding:0.4rem;font-size:1.2rem;background:#eee;border:1px solid #ccc;border-radius:4px;cursor:pointer;">◀</button>
            <button @click=${() => send('rotate')} style="flex:1;padding:0.4rem;font-size:1.2rem;background:#eee;border:1px solid #ccc;border-radius:4px;cursor:pointer;">↻</button>
            <button @click=${() => send('move', 1)} style="flex:1;padding:0.4rem;font-size:1.2rem;background:#eee;border:1px solid #ccc;border-radius:4px;cursor:pointer;">▶</button>
          </div>
          <button @click=${() => send('hardDrop')} style="width:100%;margin-top:0.25rem;padding:0.3rem;background:#eee;border:1px solid #ccc;border-radius:4px;cursor:pointer;font-size:0.85rem;">⬇ Hard Drop</button>
        </div>
        <div style="min-width:120px;">
          <div style="font-size:1.5rem;font-weight:bold;">${state.score}</div>
          <div style="font-size:0.85rem;color:#888;">Score</div>
          <div style="font-size:1rem;font-weight:bold;margin-top:0.5rem;">Lv ${state.level}</div>
          ${state.gameOver ? html`
            <div style="margin-top:1rem;color:#cc0000;font-weight:bold;font-size:1.1rem;">Game Over</div>
          ` : ''}
          <button @click=${() => send('start')}
            style="margin-top:1rem;width:100%;padding:0.5rem;background:${state.running ? '#ff4444' : '#646cff'};color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem;">
            ${state.running ? 'Restart' : 'Start'}
          </button>
          <div style="margin-top:0.75rem;font-size:0.75rem;color:#aaa;line-height:1.6;">
            ← → Move<br/>
            ↑ Rotate<br/>
            Space: Drop<br/>
            P: Pause
          </div>
        </div>
      </div>
    `
  },

  mount: (el) => {
    function onKey(e) {
      const state = Tetris.loop.get()
      if (!state.running) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); Tetris.loop.send('move', -1) }
      if (e.key === 'ArrowRight') { e.preventDefault(); Tetris.loop.send('move', 1) }
      if (e.key === 'ArrowUp') { e.preventDefault(); Tetris.loop.send('rotate') }
      if (e.key === 'ArrowDown') { e.preventDefault(); Tetris.loop.send('tick') }
      if (e.key === ' ') { e.preventDefault(); Tetris.loop.send('hardDrop') }
      if (e.key === 'p' || e.key === 'P') { Tetris.loop.send('stop') }
    }
    window.addEventListener('keydown', onKey)

    // Game loop
    let lastDrop = 0
    let animId = null
    function gameLoop(time) {
      const state = Tetris.loop.get()
      if (state.running && time - lastDrop > Math.max(100, 500 - state.level * 50)) {
        Tetris.loop.send('tick')
        lastDrop = time
      }
      animId = requestAnimationFrame(gameLoop)
    }
    animId = requestAnimationFrame(gameLoop)

    return () => {
      window.removeEventListener('keydown', onKey)
      if (animId) cancelAnimationFrame(animId)
    }
  }
})

export { Tetris }
export default Tetris
