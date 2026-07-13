import { component } from "@uploop/core";
import { html } from "@uploop/html";

const PIECES = {
  king: "♚",
  queen: "♛",
  rook: "♜",
  bishop: "♝",
  knight: "♞",
  pawn: "♟",
};
const WHITE = {
  king: "♔",
  queen: "♕",
  rook: "♖",
  bishop: "♗",
  knight: "♘",
  pawn: "♙",
};

export const ChessPage = component("ChessPage", {
  state: {
    board: [],
    players: [],
    status: "waiting",
    currentTurn: "white",
    winner: null,
    messages: [],
    selectedSquare: null,
    legalMoves: [],
  },

  view(s) {
    const renderBoard = () => {
      if (!s.board || s.board.length === 0)
        return html`<p>⏳ Loading board...</p>`;

      return html`<div
        style="display:inline-block;border:3px solid #333;border-radius:4px"
      >
        ${s.board.map(
          (row, ri) => html`
            <div style="display:flex">
              ${row.map((cell, ci) => {
                const isDark = (ri + ci) % 2 === 1;
                const isSelected =
                  s.selectedSquare?.row === ri && s.selectedSquare?.col === ci;
                const isLegal = s.legalMoves?.some(
                  (m) => m.row === ri && m.col === ci,
                );
                const piece = cell;

                let bg = isDark ? "#769656" : "#eeeed2";
                if (isSelected) bg = "#baca44";
                if (isLegal) bg = isDark ? "#646c40" : "#c8d878";

                let symbol = "";
                if (piece) {
                  symbol =
                    piece.color === "white"
                      ? WHITE[piece.type]
                      : PIECES[piece.type];
                }

                return html`<div
                  style="width:52px;height:52px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:34px;cursor:pointer;user-select:none;transition:background 0.1s"
                >
                  ${symbol}
                </div>`;
              })}
            </div>
          `,
        )}
      </div>`;
    };

    return html`
      <div
        id="chess-root"
        style="max-width:750px;margin:0 auto;padding:2rem;font-family:system-ui"
      >
        <h2>♟ Multiplayer Chess</h2>
        <div style="display:flex;gap:2rem;flex-wrap:wrap">
          <div>
            <div
              id="chess-status"
              style="margin-bottom:0.75rem;font-weight:600"
            >
              ${s.status === "waiting"
                ? html`<button
                    id="chess-start-pve"
                    style="padding:0.4rem 1rem;background:#646cff;color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem"
                  >
                    🤖 Play vs Computer
                  </button>`
                : s.status === "playing"
                  ? html`<span
                      >Turn:
                      <span style="color:#646cff">${s.currentTurn}</span> (${(
                        s.players.find((p) => p.color === s.currentTurn) || {}
                      ).name || "?"})</span
                    >`
                  : html`<span
                      >🏆
                      <span style="color:#646cff">${s.winner}</span> wins!</span
                    >`}
            </div>
            <div id="chess-board">${renderBoard()}</div>
            <div style="margin-top:0.5rem;font-size:0.7rem;color:#aaa">
              State: ${s.status} | Mode: ${s.mode || "pvp"} | Players:
              ${(s.players || []).length} | Turn: ${s.currentTurn}
              ${s.aiThinking ? " | 🤔 AI thinking..." : ""}
            </div>
            <div style="margin-top:0.5rem;font-size:0.85rem;color:#888">
              ${(s.players || []).map(
                (p) =>
                  html`<span style="margin-right:1rem"
                    >${p.color === "white" ? "⬜" : "⬛"} ${p.name}</span
                  >`,
              )}
            </div>
          </div>
          <div style="flex:1;min-width:220px">
            <h3 style="margin-top:0">💬 Chat</h3>
            <div
              id="chess-chat"
              style="border:1px solid #eee;border-radius:8px;padding:0.75rem;height:280px;overflow-y:auto;background:#fafafa;margin-bottom:0.5rem"
            >
              ${(s.messages || []).map(
                (m) =>
                  html`<div style="margin-bottom:0.25rem">
                    <strong>${m.user}:</strong> ${m.text}
                  </div>`,
              )}
            </div>
            <div style="display:flex;gap:0.5rem">
              <input
                id="chess-chat-input"
                placeholder="Chat..."
                style="flex:1;padding:0.4rem;border:1px solid #ccc;border-radius:6px;font-size:0.9rem"
              />
              <button
                id="chess-chat-send"
                onclick="window._chessChat()"
                style="padding:0.4rem 0.8rem;background:#646cff;color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },
});
