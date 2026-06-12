import { describe, it, expect, beforeEach } from "vitest";
import { createChessGame } from "../games/chess/chess-server.mjs";

// ── Helpers ────────────────────────────────────────────────

function newGame() {
  return createChessGame({ aiModule: "./games/chess/chess-ai.mjs" });
}

/** Send a command and return the state diff if returned synchronously */
function send(loop, type, payload) {
  const before = loop.get();
  loop.send(type, payload);
  return loop.get();
}

/** Get number of pieces on board */
function pieceCount(board) {
  let c = 0;
  board.forEach((r) =>
    r.forEach((p) => {
      if (p) c++;
    }),
  );
  return c;
}

// ── Tests: Initial State ───────────────────────────────────

describe("chess-server — initial state", () => {
  it("creates game in waiting status", () => {
    const game = newGame();
    const s = game.get();
    expect(s.status).toBe("waiting");
    expect(s.players).toEqual([]);
    expect(s.currentTurn).toBe("white");
    expect(s.winner).toBeNull();
    expect(s.board.length).toBe(8);
    expect(pieceCount(s.board)).toBe(32);
    expect(s.mode).toBe("pvp");
  });
});

// ── Tests: Join ────────────────────────────────────────────

describe("chess-server — join", () => {
  it("first player joins as white", () => {
    const game = newGame();
    game.send("join", { id: "p1", name: "Alice" });
    const s = game.get();
    expect(s.players.length).toBe(1);
    expect(s.players[0].color).toBe("white");
    expect(s.players[0].name).toBe("Alice");
    expect(s.status).toBe("waiting"); // still waiting for 2nd
  });

  it("second player joins as black, game starts", () => {
    const game = newGame();
    game.send("join", { id: "p1", name: "Alice" });
    game.send("join", { id: "p2", name: "Bob" });
    const s = game.get();
    expect(s.players.length).toBe(2);
    expect(s.players[1].color).toBe("black");
    expect(s.players[1].name).toBe("Bob");
    expect(s.status).toBe("playing");
  });

  it("third player is ignored", () => {
    const game = newGame();
    game.send("join", { id: "p1", name: "Alice" });
    game.send("join", { id: "p2", name: "Bob" });
    game.send("join", { id: "p3", name: "Eve" });
    expect(game.get().players.length).toBe(2);
  });
});

// ── Tests: Mode ────────────────────────────────────────────

describe("chess-server — setMode", () => {
  it("sets mode and resets game", () => {
    const game = newGame();
    game.send("join", { id: "p1", name: "Alice" });
    game.send("setMode", "pve");
    const s = game.get();
    expect(s.mode).toBe("pve");
    expect(s.players).toEqual([]); // reset
    expect(s.status).toBe("waiting");
    expect(pieceCount(s.board)).toBe(32);
  });
});

// ── Tests: Select (move) ───────────────────────────────────

describe("chess-server — select", () => {
  let game, p1, p2;

  beforeEach(() => {
    game = newGame();
    p1 = { id: "p1", name: "Alice" };
    p2 = { id: "p2", name: "Bob" };
    game.send("join", p1);
    game.send("join", p2);
  });

  it("selecting own piece highlights it with legal moves", () => {
    game.send("select", { row: 6, col: 4, playerId: "p1" }); // e2 pawn
    const s = game.get();
    expect(s.selectedSquare).toEqual({ row: 6, col: 4 });
    expect(s.legalMoves.length).toBe(2); // e3, e4
    expect(s.legalMoves).toContainEqual({ row: 5, col: 4 });
    expect(s.legalMoves).toContainEqual({ row: 4, col: 4 });
  });

  it("selecting opponent piece does nothing", () => {
    game.send("select", { row: 1, col: 4, playerId: "p1" }); // e7 (black)
    const s = game.get();
    expect(s.selectedSquare).toBeNull();
    expect(s.legalMoves).toEqual([]);
  });

  it("selecting empty square does nothing", () => {
    game.send("select", { row: 3, col: 3, playerId: "p1" }); // empty
    const s = game.get();
    expect(s.selectedSquare).toBeNull();
  });

  it("deselecting by clicking empty square clears selection", () => {
    game.send("select", { row: 6, col: 4, playerId: "p1" });
    game.send("select", { row: 3, col: 3, playerId: "p1" }); // empty
    const s = game.get();
    expect(s.selectedSquare).toBeNull();
    expect(s.legalMoves).toEqual([]);
  });

  it("selecting another own piece switches selection", () => {
    game.send("select", { row: 6, col: 4, playerId: "p1" }); // e2
    game.send("select", { row: 6, col: 3, playerId: "p1" }); // d2
    const s = game.get();
    expect(s.selectedSquare).toEqual({ row: 6, col: 3 });
    // d2 pawn also has 2 moves
    expect(s.legalMoves.length).toBe(2);
  });

  it("completes a move: e2→e4", () => {
    game.send("select", { row: 6, col: 4, playerId: "p1" }); // click e2
    game.send("select", { row: 4, col: 4, playerId: "p1" }); // click e4
    const s = game.get();
    expect(s.board[6][4]).toBeNull(); // e2 empty
    expect(s.board[4][4]).toEqual({ type: "pawn", color: "white" }); // e4 has pawn
    expect(s.currentTurn).toBe("black");
    expect(s.selectedSquare).toBeNull();
    expect(s.legalMoves).toEqual([]);
  });

  it("illegal destination returns to selection if clicking own piece", () => {
    // Select e2 pawn, then click b2 pawn (own piece, not a legal move for e2 pawn)
    game.send("select", { row: 6, col: 4, playerId: "p1" }); // e2
    game.send("select", { row: 6, col: 1, playerId: "p1" }); // b2 (own piece)
    const s = game.get();
    expect(s.selectedSquare).toEqual({ row: 6, col: 1 });
    // b2 knight's legal moves
    expect(s.legalMoves.length).toBe(2);
  });

  it("illegal destination to empty square clears selection", () => {
    game.send("select", { row: 6, col: 4, playerId: "p1" }); // e2
    game.send("select", { row: 4, col: 3, playerId: "p1" }); // d4 (not legal for e2 pawn)
    const s = game.get();
    expect(s.selectedSquare).toBeNull();
    expect(s.legalMoves).toEqual([]);
  });
});

// ── Tests: Turn enforcement ─────────────────────────────────

describe("chess-server — turn enforcement", () => {
  let game;

  beforeEach(() => {
    game = newGame();
    game.send("join", { id: "p1", name: "Alice" });
    game.send("join", { id: "p2", name: "Bob" });
  });

  it("black cannot move on white's turn", () => {
    game.send("select", { row: 1, col: 4, playerId: "p2" }); // black e7 pawn
    const s = game.get();
    expect(s.selectedSquare).toBeNull();
  });

  it("white cannot move on black's turn", () => {
    // White moves first
    game.send("select", { row: 6, col: 4, playerId: "p1" });
    game.send("select", { row: 4, col: 4, playerId: "p1" });
    // Now black's turn
    game.send("select", { row: 6, col: 3, playerId: "p1" }); // white d2
    const s = game.get();
    expect(s.selectedSquare).toBeNull();
  });
});

// ── Tests: Checkmate detection ─────────────────────────────

describe("chess-server — checkmate", () => {
  it("detects checkmate and sets winner", () => {
    const game = newGame();
    game.send("join", { id: "p1", name: "Alice" });
    game.send("join", { id: "p2", name: "Bob" });

    // Play fool's mate: 1.f3 e5 2.g4 Qh4#
    const moves = [
      [6, 5, 5, 5], // 1. f3 (white)
      [1, 4, 3, 4], // 1... e5 (black)
      [6, 6, 4, 6], // 2. g4 (white)
      [0, 3, 4, 7], // 2... Qh4# (black checkmates white)
    ];

    // f3 white
    game.send("select", { row: moves[0][0], col: moves[0][1], playerId: "p1" });
    game.send("select", { row: moves[0][2], col: moves[0][3], playerId: "p1" });

    // e5 black
    game.send("select", { row: moves[1][0], col: moves[1][1], playerId: "p2" });
    game.send("select", { row: moves[1][2], col: moves[1][3], playerId: "p2" });

    // g4 white
    game.send("select", { row: moves[2][0], col: moves[2][1], playerId: "p1" });
    game.send("select", { row: moves[2][2], col: moves[2][3], playerId: "p1" });

    // Qh4# black
    game.send("select", { row: moves[3][0], col: moves[3][1], playerId: "p2" });
    game.send("select", { row: moves[3][2], col: moves[3][3], playerId: "p2" });
    const s = game.get();

    expect(s.status).toBe("finished");
    expect(s.winner).toBe("black");
  });
});

// ── Tests: Reset ───────────────────────────────────────────

describe("chess-server — reset", () => {
  it("resets mid-game to initial state", () => {
    const game = newGame();
    game.send("join", { id: "p1", name: "Alice" });
    game.send("join", { id: "p2", name: "Bob" });

    // Make a move
    game.send("select", { row: 6, col: 4, playerId: "p1" });
    game.send("select", { row: 4, col: 4, playerId: "p1" });

    game.send("reset");
    const s = game.get();
    expect(s.players).toEqual([]);
    expect(s.status).toBe("waiting");
    expect(s.currentTurn).toBe("white");
    expect(s.winner).toBeNull();
    expect(pieceCount(s.board)).toBe(32);
    expect(s.selectedSquare).toBeNull();
    expect(s.legalMoves).toEqual([]);
    expect(s.aiThinking).toBe(false);
  });
});

// ── Tests: Chat ────────────────────────────────────────────

describe("chess-server — chat", () => {
  it("adds message to messages array", () => {
    const game = newGame();
    game.send("chat", { user: "Alice", text: "hello" });
    game.send("chat", { user: "Bob", text: "hi" });
    const s = game.get();
    expect(s.messages.length).toBe(2);
    expect(s.messages[0]).toEqual({ user: "Alice", text: "hello" });
    expect(s.messages[1]).toEqual({ user: "Bob", text: "hi" });
  });

  it("caps messages at 50", () => {
    const game = newGame();
    for (let i = 0; i < 60; i++) {
      game.send("chat", { user: "test", text: `msg${i}` });
    }
    const s = game.get();
    expect(s.messages.length).toBe(50);
    expect(s.messages[0].text).toBe("msg10"); // first 10 dropped
    expect(s.messages[49].text).toBe("msg59");
  });
});

// ── Tests: Leave ───────────────────────────────────────────

describe("chess-server — leave", () => {
  it("removes player from game", () => {
    const game = newGame();
    game.send("join", { id: "p1", name: "Alice" });
    game.send("join", { id: "p2", name: "Bob" });
    game.send("leave", "p1");
    const s = game.get();
    expect(s.players.length).toBe(1);
    expect(s.players[0].id).toBe("p2");
  });

  it("sets status to waiting when player leaves mid-game", () => {
    const game = newGame();
    game.send("join", { id: "p1", name: "Alice" });
    game.send("join", { id: "p2", name: "Bob" });
    game.send("leave", "p1");
    const s = game.get();
    expect(s.status).toBe("waiting");
  });
});

// ── Tests: PvE mode ────────────────────────────────────────

describe("chess-server — PvE mode", () => {
  it("in PvE, human joins as white", () => {
    const game = newGame();
    game.send("setMode", "pve");
    game.send("join", { id: "p1", name: "Alice" });
    const s = game.get();
    expect(s.players.length).toBe(1);
    expect(s.players[0].color).toBe("white");
    expect(s.players[0].isAI).toBe(false);
    expect(s.status).toBe("playing"); // PvE starts immediately with 1 human
  });

  it("second human join in PvE is allowed (PvE allows 1 human)", () => {
    const game = newGame();
    game.send("setMode", "pve");
    game.send("join", { id: "p1", name: "Alice" });
    // PvE starts playing with just 1 human (vs AI)
    expect(game.get().status).toBe("playing");
    // Second human join is allowed by the join handler (cap at 2)
    // even in PvE mode — the AI trigger only fires when it's AI's turn
    game.send("join", { id: "p2", name: "Bob" });
    expect(game.get().players.length).toBe(2);
  });

  it("AI does not move on human's turn", () => {
    const game = newGame();
    game.send("setMode", "pve");
    game.send("join", { id: "p1", name: "Alice" });
    const s = game.get();
    // Should be human's (white) turn, not AI
    expect(s.currentTurn).toBe("white");
  });

  it("aiMove does nothing when not AI's turn", () => {
    const game = newGame();
    game.send("setMode", "pve");
    game.send("join", { id: "p1", name: "Alice" });
    // Human's turn (white), call aiMove — should be no-op
    const before = game.get();
    game.send("aiMove");
    const after = game.get();
    expect(after.board).toEqual(before.board);
    expect(after.currentTurn).toBe("white");
  });
});

// ── Tests: Board integrity after many moves ────────────────

describe("chess-server — game flow", () => {
  it("piece count stays consistent through many non-capture moves", () => {
    const game = newGame();
    game.send("join", { id: "p1", name: "Alice" });
    game.send("join", { id: "p2", name: "Bob" });

    // Play 6 non-capture moves (3 per side)
    const moves = [
      { player: "p1", from: [6, 4], to: [4, 4] }, // e4
      { player: "p2", from: [1, 4], to: [3, 4] }, // e5
      { player: "p1", from: [7, 6], to: [5, 5] }, // Nf3
      { player: "p2", from: [0, 1], to: [2, 2] }, // Nc6
      { player: "p1", from: [7, 5], to: [4, 2] }, // Bc4
      { player: "p2", from: [0, 5], to: [1, 4] }, // Be7? Wait, Be7 isn't directly possible from f8. Let me use a different move.
    ];

    // Actually let's just do simpler moves
    // Only use moves we know are legal on a standard board
    const simpleMoves = [
      { player: "p1", from: [6, 4], to: [4, 4] }, // e4
      { player: "p2", from: [1, 4], to: [3, 4] }, // e5
      { player: "p1", from: [7, 6], to: [5, 5] }, // Nf3
      { player: "p2", from: [0, 1], to: [2, 2] }, // Nc6
      { player: "p1", from: [6, 3], to: [4, 3] }, // d4
      { player: "p2", from: [1, 3], to: [3, 3] }, // d5
    ];

    for (const { player, from, to } of simpleMoves) {
      game.send("select", { row: from[0], col: from[1], playerId: player });
      game.send("select", { row: to[0], col: to[1], playerId: player });
    }

    const s = game.get();
    expect(s.board.length).toBe(8);
    expect(pieceCount(s.board)).toBe(32); // no captures
    expect(s.status).toBe("playing");
  });
});
