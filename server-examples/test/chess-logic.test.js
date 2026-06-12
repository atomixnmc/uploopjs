import { describe, it, expect } from "vitest";
import {
  createGame,
  getMoves,
  makeMove,
  isCheck,
  isCheckmate,
  boardToString,
} from "../games/chess/chess-logic.mjs";

describe("chess-logic — createGame", () => {
  it("creates an 8×8 board", () => {
    const board = createGame();
    expect(board.length).toBe(8);
    board.forEach((row) => expect(row.length).toBe(8));
  });

  it("has 32 pieces total", () => {
    const board = createGame();
    let count = 0;
    board.forEach((row) =>
      row.forEach((cell) => {
        if (cell) count++;
      }),
    );
    expect(count).toBe(32);
  });

  it("white pieces occupy rows 6-7", () => {
    const board = createGame();
    for (let r = 6; r <= 7; r++) {
      for (let c = 0; c < 8; c++) {
        expect(board[r][c]).toBeTruthy();
        expect(board[r][c].color).toBe("white");
      }
    }
  });

  it("black pieces occupy rows 0-1", () => {
    const board = createGame();
    for (let r = 0; r <= 1; r++) {
      for (let c = 0; c < 8; c++) {
        expect(board[r][c]).toBeTruthy();
        expect(board[r][c].color).toBe("black");
      }
    }
  });
});

describe("chess-logic — getMoves", () => {
  it("white e2 pawn has 2 moves from start", () => {
    const board = createGame();
    const moves = getMoves(board, 6, 4); // e2
    expect(moves.length).toBe(2);
    expect(moves).toContainEqual({ row: 5, col: 4 }); // e3
    expect(moves).toContainEqual({ row: 4, col: 4 }); // e4
  });

  it("white knight at b1 has 2 moves", () => {
    const board = createGame();
    const moves = getMoves(board, 7, 1); // b1
    expect(moves.length).toBe(2);
    expect(moves).toContainEqual({ row: 5, col: 0 }); // a3
    expect(moves).toContainEqual({ row: 5, col: 2 }); // c3
  });

  it("empty square returns no moves", () => {
    const board = createGame();
    expect(getMoves(board, 3, 3).length).toBe(0);
  });

  it("king has up to 8 moves from center", () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[3][3] = { type: "king", color: "white" };
    expect(getMoves(board, 3, 3).length).toBe(8);
  });

  it("pawn blocked by own piece has no forward move", () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[6][4] = { type: "pawn", color: "white" };
    board[5][4] = { type: "pawn", color: "white" }; // blocked
    const moves = getMoves(board, 6, 4);
    expect(moves.length).toBe(0);
  });

  it("pawn can capture diagonally", () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[6][4] = { type: "pawn", color: "white" };
    board[5][3] = { type: "pawn", color: "black" };
    board[5][5] = { type: "pawn", color: "black" };
    const moves = getMoves(board, 6, 4);
    expect(moves.length).toBe(4); // forward 1, forward 2, capture left, capture right
  });

  it("pinned piece cannot move", () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[0][4] = { type: "king", color: "white" };
    board[0][3] = { type: "rook", color: "white" }; // pinned by black rook
    board[0][0] = { type: "rook", color: "black" };
    // Rook at (0,3) is pinned by rook at (0,0) — king at (0,4) is on same rank
    // Moving rook would expose king to check
    const moves = getMoves(board, 0, 3);
    // Rook can only move along the pin line (rank 0 between king and attacker)
    moves.forEach((m) => {
      expect(m.row).toBe(0); // must stay on rank 0
    });
  });
});

describe("chess-logic — makeMove", () => {
  it("e2-e4 is legal", () => {
    const board = createGame();
    const result = makeMove(board, 6, 4, 4, 4);
    expect(result).toBeTruthy();
    expect(result[6][4]).toBeNull();
    expect(result[4][4]).toEqual({ type: "pawn", color: "white" });
  });

  it("illegal move returns null", () => {
    const board = createGame();
    // e2-e5 (too far)
    expect(makeMove(board, 6, 4, 3, 4)).toBeNull();
    // moving opponent piece
    // moving bishop like a rook (illegal piece movement)
    expect(makeMove(board, 7, 2, 5, 2)).toBeNull();
  });

  it("move leaving own king in check returns null", () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[0][4] = { type: "king", color: "white" };
    board[1][4] = { type: "pawn", color: "white" };
    board[0][0] = { type: "rook", color: "black" }; // attacks rank 0
    // Moving pawn from (1,4) would expose king — should be illegal
    const moves = getMoves(board, 1, 4);
    expect(moves.length).toBe(0); // pinned
  });

  it("pawn promotes to queen on reaching 8th rank", () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[1][0] = { type: "pawn", color: "white" };
    board[0][1] = { type: "king", color: "white" };
    board[7][0] = { type: "king", color: "black" };
    const result = makeMove(board, 1, 0, 0, 0);
    expect(result).toBeTruthy();
    expect(result[0][0]).toEqual({ type: "queen", color: "white" });
  });
});

describe("chess-logic — isCheck", () => {
  it("not in check at game start", () => {
    const board = createGame();
    expect(isCheck(board, "white")).toBe(false);
    expect(isCheck(board, "black")).toBe(false);
  });

  it("king attacked by rook is in check", () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[0][4] = { type: "king", color: "white" };
    board[0][0] = { type: "rook", color: "black" };
    expect(isCheck(board, "white")).toBe(true);
  });

  it("king attacked by queen is in check", () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[0][4] = { type: "king", color: "white" };
    board[3][4] = { type: "queen", color: "black" };
    expect(isCheck(board, "white")).toBe(true);
  });
});

describe("chess-logic — isCheckmate", () => {
  it("not checkmate at game start", () => {
    const board = createGame();
    expect(isCheckmate(board, "white")).toBe(false);
    expect(isCheckmate(board, "black")).toBe(false);
  });

  it("fool's mate is checkmate", () => {
    // 1. f3 e5 2. g4 Qh4#
    const board = createGame();
    let b = makeMove(board, 6, 5, 5, 5); // f3
    b = makeMove(b, 1, 4, 3, 4); // e5
    b = makeMove(b, 6, 6, 4, 6); // g4
    b = makeMove(b, 0, 3, 4, 7); // Qh4#
    expect(isCheck(b, "white")).toBe(true);
    expect(isCheckmate(b, "white")).toBe(true);
  });

  it("check without checkmate", () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[0][4] = { type: "king", color: "white" };
    board[7][4] = { type: "queen", color: "black" }; // attacks king directly
    board[7][0] = { type: "king", color: "black" };
    expect(isCheck(board, "white")).toBe(true);
    // King can move to d8/d7/e7/f7/f8, so not checkmate
    expect(isCheckmate(board, "white")).toBe(false);
  });

  it("back-rank mate with king cornered", () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    // King on a8 trapped by queen on b7, supported by king on c6
    board[0][0] = { type: "king", color: "white" };
    board[1][1] = { type: "queen", color: "black" };
    board[2][2] = { type: "king", color: "black" };
    expect(isCheckmate(board, "white")).toBe(true);
  });
});

describe("chess-logic — game flow", () => {
  it("full fool's mate sequence", () => {
    let board = createGame();

    // 1. f2-f3
    board = makeMove(board, 6, 5, 5, 5);
    expect(board).toBeTruthy();

    // 1... e7-e5
    board = makeMove(board, 1, 4, 3, 4);
    expect(board).toBeTruthy();

    // 2. g2-g4
    board = makeMove(board, 6, 6, 4, 6);
    expect(board).toBeTruthy();

    // 2... Qd8-h4#
    board = makeMove(board, 0, 3, 4, 7);
    expect(board).toBeTruthy();

    expect(isCheckmate(board, "white")).toBe(true);
  });

  it("scholar's mate sequence", () => {
    let board = createGame();

    // 1. e4 e5
    board = makeMove(board, 6, 4, 4, 4);
    board = makeMove(board, 1, 4, 3, 4);

    // 2. Qh5 Nc6
    board = makeMove(board, 7, 3, 3, 7);
    board = makeMove(board, 0, 1, 2, 2);

    // 3. Bc4 Nf6
    board = makeMove(board, 7, 5, 4, 2);
    board = makeMove(board, 0, 6, 2, 5);

    // 4. Qxf7#
    board = makeMove(board, 3, 7, 1, 5);
    expect(board).toBeTruthy();
    expect(isCheckmate(board, "black")).toBe(true);
  });

  it("board stays sized correctly after many moves", () => {
    let board = createGame();
    const moves = [
      [6, 4, 4, 4],
      [1, 4, 3, 4], // e4 e5
      [7, 6, 5, 5],
      [0, 1, 2, 2], // Nf3 Nc6
      [7, 5, 4, 2],
      [0, 5, 4, 1], // Bc4 Bb4
      [7, 1, 5, 2], // Nc3
    ];
    for (const [fr, fc, tr, tc] of moves) {
      board = makeMove(board, fr, fc, tr, tc);
      expect(board).toBeTruthy();
      expect(board.length).toBe(8);
      board.forEach((row) => expect(row.length).toBe(8));
    }
  });

  it("piece count decreases after captures", () => {
    let board = createGame();
    let count = 0;
    board.forEach((row) =>
      row.forEach((c) => {
        if (c) count++;
      }),
    );
    expect(count).toBe(32);

    // Play moves that include captures
    board = makeMove(board, 6, 4, 4, 4); // e4
    board = makeMove(board, 1, 3, 3, 3); // d5
    board = makeMove(board, 4, 4, 3, 3); // exd5 (capture)

    count = 0;
    board.forEach((row) =>
      row.forEach((c) => {
        if (c) count++;
      }),
    );
    expect(count).toBe(31); // one black pawn captured
  });
});
