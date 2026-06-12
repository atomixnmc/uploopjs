import { describe, it, expect } from "vitest";
import { renderToString } from "@uploop/sst";
import { ChessPage } from "../games/chess/chess-page.mjs";

describe("ChessPage — SSR rendering", () => {
  it("renders waiting state with Play vs Computer button", () => {
    const html = renderToString(ChessPage, {
      board: [],
      players: [],
      status: "waiting",
      currentTurn: "white",
      winner: null,
      messages: [],
      selectedSquare: null,
      legalMoves: [],
      mode: "pvp",
    });
    expect(html).toContain("Multiplayer Chess");
    expect(html).toContain("chess-root");
    expect(html).toContain("chess-board");
    expect(html).toContain("chess-status");
    expect(html).toContain("chess-start-pve");
    expect(html).toContain("Play vs Computer");
    expect(html).toContain("chess-chat");
  });

  it("renders playing state with turn indicator", () => {
    const html = renderToString(ChessPage, {
      board: [],
      players: [
        { id: "p1", name: "Alice", color: "white" },
        { id: "p2", name: "Bob", color: "black" },
      ],
      status: "playing",
      currentTurn: "white",
      winner: null,
      messages: [],
      selectedSquare: null,
      legalMoves: [],
      mode: "pvp",
    });
    expect(html).toContain("Turn:");
    expect(html).toContain("white");
    expect(html).toContain("Alice");
    expect(html).toContain("Bob");
    // Should show player indicators
    expect(html).toContain("⬜");
    expect(html).toContain("⬛");
  });

  it("renders finished state with winner", () => {
    const html = renderToString(ChessPage, {
      board: [],
      players: [],
      status: "finished",
      currentTurn: "white",
      winner: "black",
      messages: [],
      selectedSquare: null,
      legalMoves: [],
      mode: "pvp",
    });
    expect(html).toContain("🏆");
    expect(html).toContain("black");
    expect(html).toContain("wins!");
  });

  it("renders chat messages", () => {
    const html = renderToString(ChessPage, {
      board: [],
      players: [],
      status: "waiting",
      currentTurn: "white",
      winner: null,
      messages: [
        { user: "Alice", text: "Good luck!" },
        { user: "Bob", text: "You too!" },
      ],
      selectedSquare: null,
      legalMoves: [],
      mode: "pvp",
    });
    expect(html).toContain("Alice");
    expect(html).toContain("Good luck!");
    expect(html).toContain("Bob");
    expect(html).toContain("You too!");
  });

  it("renders debug info with mode and player count", () => {
    const html = renderToString(ChessPage, {
      board: [],
      players: [
        { id: "p1", name: "Alice", color: "white" },
      ],
      status: "playing",
      currentTurn: "white",
      winner: null,
      messages: [],
      selectedSquare: null,
      legalMoves: [],
      mode: "pve",
    });
    expect(html).toContain("State:");
    expect(html).toContain("Mode:");
    expect(html).toContain("pve");
    expect(html).toContain("Players:");
    expect(html).toContain("1");
    expect(html).toContain("Turn:");
  });

  it("renders AI thinking indicator in PvE mode", () => {
    const html = renderToString(ChessPage, {
      board: [],
      players: [
        { id: "p1", name: "Alice", color: "white" },
      ],
      status: "playing",
      currentTurn: "black",
      winner: null,
      messages: [],
      selectedSquare: null,
      legalMoves: [],
      mode: "pve",
      aiThinking: true,
    });
    expect(html).toContain("AI thinking...");
  });

  it("renders empty state with loading message when no board", () => {
    const html = renderToString(ChessPage, {
      board: [],
      players: [],
      status: "waiting",
      currentTurn: "white",
      winner: null,
      messages: [],
      selectedSquare: null,
      legalMoves: [],
      mode: "pvp",
    });
    expect(html).toContain("Loading board...");
  });

  it("renders board when board data is present", () => {
    // Create a minimal board with a few pieces
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[0][4] = { type: "king", color: "black" };
    board[7][4] = { type: "king", color: "white" };

    const html = renderToString(ChessPage, {
      board,
      players: [],
      status: "waiting",
      currentTurn: "white",
      winner: null,
      messages: [],
      selectedSquare: null,
      legalMoves: [],
      mode: "pvp",
    });
    expect(html).toContain("♔"); // white king
    expect(html).toContain("♚"); // black king
  });

  it("renders selected and legal square highlights", () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[6][4] = { type: "pawn", color: "white" };
    board[7][4] = { type: "king", color: "white" };
    board[0][4] = { type: "king", color: "black" };

    const html = renderToString(ChessPage, {
      board,
      players: [],
      status: "waiting",
      currentTurn: "white",
      winner: null,
      messages: [],
      selectedSquare: { row: 6, col: 4 },
      legalMoves: [{ row: 5, col: 4 }, { row: 4, col: 4 }],
      mode: "pvp",
    });
    expect(html).toContain("baca44"); // selected color
    expect(html).toContain("c8d878"); // legal move highlight
  });

  it("renders chat input and send button", () => {
    const html = renderToString(ChessPage);
    expect(html).toContain("chess-chat-input");
    expect(html).toContain("chess-chat-send");
    expect(html).toContain("Chat...");
    expect(html).toContain("Send");
    expect(html).toContain("_chessChat()");
  });

  it("renders all piece types with correct symbols", () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[0][0] = { type: "rook", color: "black" };
    board[0][1] = { type: "knight", color: "black" };
    board[0][2] = { type: "bishop", color: "black" };
    board[0][3] = { type: "queen", color: "black" };
    board[0][4] = { type: "king", color: "black" };
    board[0][5] = { type: "bishop", color: "black" };
    board[0][6] = { type: "knight", color: "black" };
    board[0][7] = { type: "rook", color: "black" };
    board[1][0] = { type: "pawn", color: "black" };

    const html = renderToString(ChessPage, {
      board,
      players: [],
      status: "waiting",
      currentTurn: "white",
      winner: null,
      messages: [],
      selectedSquare: null,
      legalMoves: [],
      mode: "pvp",
    });

    // Black pieces use PIECES map
    expect(html).toContain("♜"); // black rook
    expect(html).toContain("♞"); // black knight
    expect(html).toContain("♝"); // black bishop
    expect(html).toContain("♛"); // black queen
    expect(html).toContain("♚"); // black king
    expect(html).toContain("♟"); // black pawn
  });
});
