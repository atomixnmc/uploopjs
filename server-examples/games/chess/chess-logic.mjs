// Pure chess logic — no UI, no server dependencies
// Board is 8×8 array. Piece: { type, color } or null for empty.

const COLS = 'abcdefgh'

/** Initial board: white at bottom (row 7), black at top (row 0) */
export function createGame() {
  const empty = () => Array.from({ length: 8 }, () => null)
  const backRank = (color) => [
    { type: 'rook', color },
    { type: 'knight', color },
    { type: 'bishop', color },
    { type: 'queen', color },
    { type: 'king', color },
    { type: 'bishop', color },
    { type: 'knight', color },
    { type: 'rook', color },
  ]
  const pawnRow = (color) => Array.from({ length: 8 }, () => ({ type: 'pawn', color }))

  return [
    backRank('black'),
    pawnRow('black'),
    empty(), empty(), empty(), empty(),
    pawnRow('white'),
    backRank('white'),
  ]
}

// ---- Internal helpers ----

function cloneBoard(board) {
  return board.map(row => row.map(cell => cell ? { ...cell } : null))
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8
}

function _applyMove(board, fromRow, fromCol, toRow, toCol) {
  const b = cloneBoard(board)
  b[toRow][toCol] = b[fromRow][fromCol]
  b[fromRow][fromCol] = null
  // Auto-promote pawn to queen
  if (b[toRow][toCol]?.type === 'pawn') {
    if (b[toRow][toCol].color === 'white' && toRow === 0) b[toRow][toCol] = { type: 'queen', color: 'white' }
    if (b[toRow][toCol].color === 'black' && toRow === 7) b[toRow][toCol] = { type: 'queen', color: 'black' }
  }
  return b
}

function _findKing(board, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.type === 'king' && p.color === color) return { row: r, col: c }
    }
  }
  return null
}

/** All pseudo-legal destinations for a piece (ignoring check) */
function _rawMoves(board, row, col) {
  const piece = board[row][col]
  if (!piece) return []
  const { type, color } = piece
  const opponent = color === 'white' ? 'black' : 'white'
  const moves = []

  function slide(dr, dc) {
    for (let r = row + dr, c = col + dc; inBounds(r, c); r += dr, c += dc) {
      if (board[r][c] === null) {
        moves.push({ row: r, col: c })
      } else {
        if (board[r][c].color === opponent) moves.push({ row: r, col: c })
        break
      }
    }
  }

  function addIfValid(r, c) {
    if (inBounds(r, c) && (board[r][c] === null || board[r][c].color === opponent)) {
      moves.push({ row: r, col: c })
    }
  }

  switch (type) {
    case 'pawn': {
      const dir = color === 'white' ? -1 : 1
      const startRow = color === 'white' ? 6 : 1
      // Forward 1
      if (inBounds(row + dir, col) && board[row + dir][col] === null) {
        moves.push({ row: row + dir, col })
        // Forward 2 from start
        if (row === startRow && board[row + 2 * dir][col] === null) {
          moves.push({ row: row + 2 * dir, col })
        }
      }
      // Captures
      for (const dc of [-1, 1]) {
        const nr = row + dir, nc = col + dc
        if (inBounds(nr, nc) && board[nr][nc] && board[nr][nc].color === opponent) {
          moves.push({ row: nr, col: nc })
        }
      }
      break
    }
    case 'rook':
      slide(1, 0); slide(-1, 0); slide(0, 1); slide(0, -1)
      break
    case 'knight':
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        addIfValid(row + dr, col + dc)
      }
      break
    case 'bishop':
      slide(1, 1); slide(1, -1); slide(-1, 1); slide(-1, -1)
      break
    case 'queen':
      slide(1, 0); slide(-1, 0); slide(0, 1); slide(0, -1)
      slide(1, 1); slide(1, -1); slide(-1, 1); slide(-1, -1)
      break
    case 'king':
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        addIfValid(row + dr, col + dc)
      }
      break
  }
  return moves
}

// ---- Public API ----

/** Legal moves for the piece at (row, col). Filters moves leaving own king in check. */
export function getMoves(board, row, col) {
  const piece = board[row][col]
  if (!piece) return []
  return _rawMoves(board, row, col).filter(to => {
    const newBoard = _applyMove(board, row, col, to.row, to.col)
    return !isCheck(newBoard, piece.color)
  })
}

/** Apply a move. Returns new board or null if illegal. */
export function makeMove(board, fromRow, fromCol, toRow, toCol) {
  const piece = board[fromRow][fromCol]
  if (!piece) return null
  const moves = getMoves(board, fromRow, fromCol)
  const legal = moves.some(m => m.row === toRow && m.col === toCol)
  if (!legal) return null
  return _applyMove(board, fromRow, fromCol, toRow, toCol)
}

/** Is the king of `color` in check? */
export function isCheck(board, color) {
  const king = _findKing(board, color)
  if (!king) return false
  const opponent = color === 'white' ? 'black' : 'white'
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] && board[r][c].color === opponent) {
        const attacks = _rawMoves(board, r, c)
        if (attacks.some(m => m.row === king.row && m.col === king.col)) return true
      }
    }
  }
  return false
}

/** Is the king of `color` checkmated? */
export function isCheckmate(board, color) {
  if (!isCheck(board, color)) return false
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] && board[r][c].color === color) {
        if (getMoves(board, r, c).length > 0) return false
      }
    }
  }
  return true
}

/** ASCII board for debugging */
export function boardToString(board) {
  const symbols = {
    king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p',
  }
  let out = '  ' + COLS.split('').join(' ') + '\n'
  for (let r = 0; r < 8; r++) {
    out += String(8 - r) + ' '
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      const ch = p ? (p.color === 'white' ? symbols[p.type].toUpperCase() : symbols[p.type]) : '.'
      out += ch + ' '
    }
    out += String(8 - r) + '\n'
  }
  out += '  ' + COLS.split('').join(' ')
  return out
}
