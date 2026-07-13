/**
 * Chess Client — loaded as external script via <script src="/public/chess-client.js">
 *
 * Architecture:
 *   - WebSocket connection state tracked via Uploop-style state object
 *   - All ws.send() calls guarded by connection check
 *   - Auto-reconnect on disconnect with backoff
 *   - Graceful degradation when disconnected (board frozen, not crashed)
 */

(function () {
  const configEl = document.getElementById("chess-config");
  if (!configEl) return console.error("[Chess] Missing #chess-config");
  const config = JSON.parse(configEl.textContent);
  const { playerId, playerName } = config;

  const stateEl = document.getElementById("chess-state");
  var initialState = { board: [], players: [], status: "waiting" };
  if (stateEl) {
    try {
      initialState = JSON.parse(stateEl.textContent);
    } catch (e) {}
  }

  console.log("[Chess] Loaded, player:", playerName);

  // ── Connection state (Uploop-style: state + guarded sends) ──
  var conn = {
    ws: null,
    open: false,
    reconnectTimer: null,
    reconnectDelay: 300,
  };

  function safeSend(data) {
    if (conn.ws && conn.open && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(data));
      return true;
    }
    console.warn("[Chess] Cannot send — not connected");
    return false;
  }

  function connect() {
    if (conn.ws) {
      try {
        conn.ws.close();
      } catch (e) {}
    }
    var ws = new WebSocket("ws://" + location.host + "/ws-chess");
    conn.ws = ws;
    conn.open = false;

    ws.onopen = function () {
      conn.open = true;
      conn.reconnectDelay = 300; // reset backoff
      console.log("[Chess] Connected");
      safeSend({ type: "join", id: playerId, name: playerName });
    };

    ws.onclose = function () {
      conn.open = false;
      console.log(
        "[Chess] Disconnected, reconnecting in",
        conn.reconnectDelay,
        "ms",
      );
      conn.reconnectTimer = setTimeout(function () {
        conn.reconnectDelay = Math.min(conn.reconnectDelay * 2, 10000);
        connect();
      }, conn.reconnectDelay);
    };

    ws.onerror = function () {
      conn.open = false;
    };

    ws.onmessage = function (e) {
      var msg = JSON.parse(e.data);
      if (msg.type === "state") {
        state = msg;
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
  }

  // ── State ─────────────────────────────────────────────────

  var state = null;

  // ── Board rendering ──────────────────────────────────────

  function updateBoard(s) {
    var container = document.getElementById("chess-board");
    if (!container || !s.board) return;
    var PIECES = {
      king: "♚",
      queen: "♛",
      rook: "♜",
      bishop: "♝",
      knight: "♞",
      pawn: "♟",
    };
    var WHITE = {
      king: "♔",
      queen: "♕",
      rook: "♖",
      bishop: "♗",
      knight: "♘",
      pawn: "♙",
    };

    var html =
      '<div style="display:inline-block;border:3px solid #333;border-radius:4px">';
    s.board.forEach(function (row, ri) {
      html += '<div style="display:flex">';
      row.forEach(function (cell, ci) {
        var isDark = (ri + ci) % 2 === 1;
        var isSelected =
          s.selectedSquare &&
          s.selectedSquare.row === ri &&
          s.selectedSquare.col === ci;
        var isLegal =
          s.legalMoves &&
          s.legalMoves.some(function (m) {
            return m.row === ri && m.col === ci;
          });
        var bg = isDark ? "#769656" : "#eeeed2";
        if (isSelected) bg = "#baca44";
        if (isLegal) bg = isDark ? "#646c40" : "#c8d878";
        var symbol = "";
        if (cell)
          symbol =
            cell.color === "white" ? WHITE[cell.type] : PIECES[cell.type];
        html +=
          '<div onclick="window._chessClick(' +
          ri +
          "," +
          ci +
          ')" style="width:52px;height:52px;background:' +
          bg +
          ';display:flex;align-items:center;justify-content:center;font-size:34px;cursor:pointer;user-select:none;transition:background 0.1s">' +
          symbol +
          "</div>";
      });
      html += "</div>";
    });
    html += "</div>";
    container.innerHTML = html;
  }

  // ── Status rendering ─────────────────────────────────────

  function updateStatus(s) {
    var el = document.getElementById("chess-status");
    if (!el) return;
    var resetBtn =
      ' <button onclick="window._chessReset()" style="padding:0.3rem 0.6rem;background:#f44336;color:white;border:none;border-radius:4px;cursor:pointer;font-size:0.75rem">🔄 Reset</button>';
    if (s.status === "waiting") {
      el.innerHTML =
        '<button id="chess-start-pve" onclick="window._chessStartPvE()" style="padding:0.4rem 1rem;background:#646cff;color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem">🤖 Play vs Computer</button>' +
        resetBtn;
    } else if (s.status === "playing") {
      var thinking = s.aiThinking ? " 🤔..." : "";
      el.innerHTML =
        'Turn: <span style="color:#646cff">' +
        s.currentTurn +
        "</span>" +
        thinking +
        (conn.open
          ? resetBtn
          : ' <span style="color:#f44336;font-size:0.7rem">⚠ Reconnecting...</span>');
    } else if (s.status === "finished") {
      el.innerHTML =
        '🏆 <span style="color:#646cff">' +
        s.winner +
        "</span> wins!" +
        resetBtn;
    }
  }

  // ── Chat rendering ───────────────────────────────────────

  function updateChat(s) {
    var el = document.getElementById("chess-chat");
    if (!el || !s.messages) return;
    el.innerHTML = s.messages
      .map(function (m) {
        return (
          '<div style="margin-bottom:0.25rem"><strong>' +
          m.user +
          ":</strong> " +
          m.text +
          "</div>"
        );
      })
      .join("");
    el.scrollTop = el.scrollHeight;
  }

  // ── Public API — all guarded ─────────────────────────────

  window._chessClick = function (row, col) {
    safeSend({ type: "select", row: row, col: col, playerId: playerId });
  };

  window._chessStartPvE = function () {
    safeSend({ type: "setMode", mode: "pve" });
    safeSend({ type: "join", id: playerId, name: playerName });
  };

  window._chessReset = function () {
    safeSend({ type: "reset" });
    setTimeout(function () {
      safeSend({ type: "join", id: playerId, name: playerName });
    }, 200);
  };

  window._chessChat = function () {
    var input = document.getElementById("chess-chat-input");
    if (!input || !input.value.trim()) return;
    safeSend({ type: "chat", user: playerName, text: input.value });
    input.value = "";
  };

  // ── Chat input wiring ───────────────────────────────────

  setTimeout(function () {
    var sendBtn = document.getElementById("chess-chat-send");
    var chatInput = document.getElementById("chess-chat-input");
    if (sendBtn) sendBtn.onclick = window._chessChat;
    if (chatInput) {
      chatInput.onkeydown = function (e) {
        if (e.key === "Enter") window._chessChat();
      };
    }
  }, 200);

  // ── Eager render + connect ───────────────────────────────

  if (initialState && initialState.board) {
    state = initialState;
    updateBoard(initialState);
    updateStatus(initialState);
    updateChat(initialState);
  }

  setTimeout(connect, 100);
})();
