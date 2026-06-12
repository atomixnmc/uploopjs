/**
 * Chess Client — loaded as external script via <script src="/public/chess-client.js">
 *
 * Reads player config from a <script type="application/json" id="chess-config"> tag
 * and initial state from a <script type="application/json" id="chess-state"> tag.
 * No inline code in the HTML template — clean separation.
 */

(function () {
  const configEl = document.getElementById("chess-config");
  if (!configEl) return console.error("[Chess] Missing #chess-config");
  const config = JSON.parse(configEl.textContent);
  const { playerId, playerName } = config;

  const stateEl = document.getElementById("chess-state");
  let initialState = { board: [], players: [], status: "waiting" };
  if (stateEl) {
    try { initialState = JSON.parse(stateEl.textContent); } catch (e) {}
  }

  console.log("[Chess] Loaded, player:", playerName, "initial:", initialState.status);

  setTimeout(function () {
    const ws = new WebSocket("ws://" + location.host + "/ws-chess");
    console.log("[Chess] WebSocket connecting to /ws-chess");
    let state = null;

    // ---- Board rendering ----
    function updateBoard(s) {
      const container = document.getElementById("chess-board");
      if (!container || !s.board) return;
      const PIECES = {
        king: "♚", queen: "♛", rook: "♜", bishop: "♝", knight: "♞", pawn: "♟",
      };
      const WHITE = {
        king: "♔", queen: "♕", rook: "♖", bishop: "♗", knight: "♘", pawn: "♙",
      };

      let html = '<div style="display:inline-block;border:3px solid #333;border-radius:4px">';
      s.board.forEach(function (row, ri) {
        html += '<div style="display:flex">';
        row.forEach(function (cell, ci) {
          const isDark = (ri + ci) % 2 === 1;
          const isSelected = s.selectedSquare && s.selectedSquare.row === ri && s.selectedSquare.col === ci;
          const isLegal = s.legalMoves && s.legalMoves.some(function (m) { return m.row === ri && m.col === ci; });
          let bg = isDark ? "#769656" : "#eeeed2";
          if (isSelected) bg = "#baca44";
          if (isLegal) bg = isDark ? "#646c40" : "#c8d878";
          let symbol = "";
          if (cell) symbol = cell.color === "white" ? WHITE[cell.type] : PIECES[cell.type];
          html += '<div onclick="window._chessClick(' + ri + "," + ci + ')" style="width:52px;height:52px;background:' + bg + ';display:flex;align-items:center;justify-content:center;font-size:34px;cursor:pointer;user-select:none;transition:background 0.1s">' + symbol + "</div>";
        });
        html += "</div>";
      });
      html += "</div>";
      container.innerHTML = html;
    }

    window._chessClick = function (row, col) {
      ws.send(JSON.stringify({ type: "select", row: row, col: col, playerId: playerId }));
    };

    // ---- Status rendering ----
    function updateStatus(s) {
      const el = document.getElementById("chess-status");
      if (!el) return;
      const resetBtn = ' <button onclick="window._chessReset()" style="padding:0.3rem 0.6rem;background:#f44336;color:white;border:none;border-radius:4px;cursor:pointer;font-size:0.75rem">🔄 Reset</button>';
      if (s.status === "waiting") {
        el.innerHTML = '<button id="chess-start-pve" onclick="window._chessStartPvE()" style="padding:0.4rem 1rem;background:#646cff;color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem">🤖 Play vs Computer</button>' + resetBtn;
      } else if (s.status === "playing") {
        const thinking = s.aiThinking ? " 🤔..." : "";
        el.innerHTML = 'Turn: <span style="color:#646cff">' + s.currentTurn + "</span>" + thinking + resetBtn;
      } else if (s.status === "finished") {
        el.innerHTML = '🏆 <span style="color:#646cff">' + s.winner + "</span> wins!" + resetBtn;
      }
    }

    window._chessStartPvE = function () {
      ws.send(JSON.stringify({ type: "setMode", mode: "pve" }));
      ws.send(JSON.stringify({ type: "join", id: playerId, name: playerName }));
    };

    window._chessReset = function () {
      ws.send(JSON.stringify({ type: "reset" }));
      setTimeout(function () {
        ws.send(JSON.stringify({ type: "join", id: playerId, name: playerName }));
      }, 200);
    };

    // ---- Chat rendering ----
    function updateChat(s) {
      const el = document.getElementById("chess-chat");
      if (!el || !s.messages) return;
      el.innerHTML = s.messages
        .map(function (m) {
          return '<div style="margin-bottom:0.25rem"><strong>' + m.user + ":</strong> " + m.text + "</div>";
        })
        .join("");
      el.scrollTop = el.scrollHeight;
    }

    // ---- Eager render ----
    if (initialState && initialState.board) {
      state = initialState;
      updateBoard(initialState);
      updateStatus(initialState);
      updateChat(initialState);
    }

    // ---- WebSocket bridge ----
    ws.onmessage = function (e) {
      const msg = JSON.parse(e.data);
      if (msg.type === "state") {
        state = msg;
        console.log("[Chess] State:", state.status, "turn:", state.currentTurn, "ai:", state.aiThinking);
        updateBoard(state);
        updateStatus(state);
        updateChat(state);
      }
      if (msg.type === "chat") {
        if (state) {
          state.messages = state.messages || [];
          state.messages.push(msg);
          updateChat(state);
        }
      }
    };

    ws.onopen = function () {
      ws.send(JSON.stringify({ type: "join", id: playerId, name: playerName }));
    };

    // ---- Chat input ----
    window._chessChat = function () {
      const input = document.getElementById("chess-chat-input");
      if (!input || !input.value.trim()) return;
      ws.send(JSON.stringify({ type: "chat", user: playerName, text: input.value }));
      input.value = "";
    };

    const sendBtn = document.getElementById("chess-chat-send");
    const chatInput = document.getElementById("chess-chat-input");
    if (sendBtn) sendBtn.onclick = window._chessChat;
    if (chatInput) {
      chatInput.onkeydown = function (e) {
        if (e.key === "Enter") window._chessChat();
      };
    }
  }, 100);
})();
