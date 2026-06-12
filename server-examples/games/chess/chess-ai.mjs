// ════════════════════════════════════════════════════════════
// Uploop Chess AI v2 — chess.js + PeSTO-style evaluation
//
// Uses chess.js for correct move generation (en passant,
// castling, promotions, stalemate) plus piece-square tables
// for positional understanding.
//
// Algorithm: Negamax-style minimax with alpha-beta, depth 4
// Evaluation: Material + piece-square tables (PeSTO-inspired)
// ════════════════════════════════════════════════════════════

import { Chess } from "chess.js";

// ── Material values (centipawns) ───────────────────────────
const PV = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// ── Piece-Square Tables (White's perspective, row 0=rank8) ──
// Values in centipawns. Higher = better for the piece.
// Adapted from PeSTO / Sunfish evaluation.

const PST = {
  p: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5, 5, 10, 25, 25, 10, 5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0],
    [5, -5, -10, 0, 0, -10, -5, 5],
    [5, 10, 10, -20, -20, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  n: [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 0, 0, 0, -20, -40],
    [-30, 0, 10, 15, 15, 10, 0, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-40, -20, 0, 5, 5, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50],
  ],
  b: [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 5, 5, 10, 10, 5, 5, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 10, 10, 10, 10, 10, 10, -10],
    [-10, 5, 0, 0, 0, 0, 5, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20],
  ],
  r: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [5, 10, 10, 10, 10, 10, 10, 5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [0, 0, 0, 5, 5, 0, 0, 0],
  ],
  q: [
    [-20, -10, -10, -5, -5, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 5, 5, 5, 0, -10],
    [-5, 0, 5, 5, 5, 5, 0, -5],
    [0, 0, 5, 5, 5, 5, 0, -5],
    [-10, 5, 5, 5, 5, 5, 0, -10],
    [-10, 0, 5, 0, 0, 0, 0, -10],
    [-20, -10, -10, -5, -5, -10, -10, -20],
  ],
  // Middlegame king — encourages castling (king on g1/c1)
  k: [
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [20, 20, 0, 0, 0, 0, 20, 20],
    [20, 30, 10, 0, 0, 10, 30, 20],
  ],
  // Endgame king — encourages centralization
  ke: [
    [-50, -40, -30, -20, -20, -30, -40, -50],
    [-30, -20, -10, 0, 0, -10, -20, -30],
    [-30, -10, 20, 30, 30, 20, -10, -30],
    [-30, -10, 30, 40, 40, 30, -10, -30],
    [-30, -10, 30, 40, 40, 30, -10, -30],
    [-30, -10, 20, 30, 30, 20, -10, -30],
    [-30, -30, 0, 0, 0, 0, -30, -30],
    [-50, -30, -30, -30, -30, -30, -30, -50],
  ],
};

// ── Board → FEN conversion ─────────────────────────────────

const PIECE_CHAR = {
  king: "k",
  queen: "q",
  rook: "r",
  bishop: "b",
  knight: "n",
  pawn: "p",
};

/**
 * Convert the game's 8×8 board array to a FEN string.
 * Game board: row 0 = rank 8 (top), row 7 = rank 1 (bottom).
 */
function boardToFen(board, currentTurn) {
  let placement = "";
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (!cell) {
        empty++;
        continue;
      }
      if (empty > 0) {
        placement += empty;
        empty = 0;
      }
      const ch = PIECE_CHAR[cell.type];
      placement += cell.color === "white" ? ch.toUpperCase() : ch;
    }
    if (empty > 0) placement += empty;
    if (r < 7) placement += "/";
  }
  const active = currentTurn === "white" ? "w" : "b";
  return `${placement} ${active} KQkq - 0 1`;
}

// ── Evaluation (from White's perspective) ──────────────────

function totalMaterial(chess) {
  let total = 0;
  for (const row of chess.board())
    for (const p of row) if (p) total += PV[p.type] || 0;
  return total;
}

function evaluate(chess) {
  const board = chess.board();
  const isEndgame = totalMaterial(chess) < 3000;
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const val = PV[piece.type];
      const row = piece.color === "w" ? r : 7 - r;
      const table = piece.type === "k" && isEndgame ? PST.ke : PST[piece.type];
      const pst = table[row][c];
      score += (piece.color === "w" ? 1 : -1) * (val + pst);
    }
  }
  return score;
}

// ── Move ordering ──────────────────────────────────────────

function orderMoves(moves) {
  return moves.sort((a, b) => {
    if (a.promotion && !b.promotion) return -1;
    if (!a.promotion && b.promotion) return 1;
    const aCap = a.captured ? PV[a.captured] - (PV[a.piece] || 0) / 10 : 0;
    const bCap = b.captured ? PV[b.captured] - (PV[b.piece] || 0) / 10 : 0;
    return bCap - aCap;
  });
}

// ── Minimax with alpha-beta (white's perspective) ──────────

/**
 * Search from the perspective of `color` ('w'/'b').
 * Returns score from WHITE's perspective (positive = good for white).
 */
function search(chess, depth, alpha, beta, color) {
  if (depth === 0) return evaluate(chess);

  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) {
    if (chess.isCheckmate()) {
      // Player to move is checkmated → they lose
      return color === "w"
        ? -99999 + (4 - depth) * 1000
        : 99999 - (4 - depth) * 1000;
    }
    return 0; // stalemate
  }

  orderMoves(moves);
  const opponent = color === "w" ? "b" : "w";

  if (color === "w") {
    let best = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const score = search(chess, depth - 1, alpha, beta, opponent);
      chess.undo();
      if (score > best) best = score;
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      chess.move(move);
      const score = search(chess, depth - 1, alpha, beta, opponent);
      chess.undo();
      if (score < best) best = score;
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return best;
  }
}

// ── Coordinate conversion ──────────────────────────────────

function fromChessSquare(sq) {
  return {
    row: 7 - (sq.charCodeAt(1) - "1".charCodeAt(0)),
    col: sq.charCodeAt(0) - "a".charCodeAt(0),
  };
}

// ── Public API ─────────────────────────────────────────────

/**
 * Find the best move for the given color.
 * @param {Array} board - 8×8 board array (row 0 = top/rank 8)
 * @param {string} color - 'white' or 'black'
 * @param {number} [depth=4] - search depth (ply)
 * @returns {{ fromRow: number, fromCol: number, toRow: number, toCol: number, score: number } | null}
 */
export function findBestMove(board, color, depth = 3) {
  const fen = boardToFen(board, color);
  const chess = new Chess(fen);

  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;

  orderMoves(moves);

  const chessColor = color === "white" ? "w" : "b";
  const opponent = chessColor === "w" ? "b" : "w";
  const isWhite = chessColor === "w";

  let bestMove = null;
  let bestScore = isWhite ? -Infinity : Infinity;

  for (const move of moves) {
    chess.move(move);
    const score = search(chess, depth - 1, -Infinity, Infinity, opponent);
    chess.undo();

    if (isWhite ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  if (!bestMove) return null;

  const from = fromChessSquare(bestMove.from);
  const to = fromChessSquare(bestMove.to);

  return {
    fromRow: from.row,
    fromCol: from.col,
    toRow: to.row,
    toCol: to.col,
    score: bestScore,
  };
}
