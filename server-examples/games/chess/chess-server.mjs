import { createLoop } from "@uploop/core";
import { saveMessage } from "../../db/chat.mjs";
import { createGame, getMoves, makeMove, isCheckmate } from "./chess-logic.mjs";
import { log } from "../../logger.mjs";

/**
 * Create a chess game loop.
 * Supports PvP (two human players) and PvE (vs computer AI).
 *
 * The AI module is loaded via dynamic import — demonstrating Uploop's
 * flexibility: the AI can be served from a CDN, npm package, local file,
 * or any ESM-compatible URL. No bundling required.
 *
 * @param {Object} options
 * @param {string} [options.aiModule] — path/URL to AI module (default: local chess-ai.mjs)
 */
export function createChessGame(options = {}) {
  const aiModulePath = options.aiModule || "./chess-ai.mjs";

  const gameLoop = createLoop({
    state: {
      board: createGame(),
      players: [],
      currentTurn: "white",
      status: "waiting",
      messages: [],
      winner: null,
      selectedSquare: null,
      legalMoves: [],
      mode: "pvp", // 'pvp' | 'pve'
      aiColor: "black",
      aiThinking: false,
    },
    update: {
      join(s, player) {
        log.game("chess", "join", `${player.name} (${player.color || "?"})`);
        if (s.players.length >= 2) return s;
        // Human player joins — never AI
        const color = s.players.length === 0 ? "white" : "black";
        const newPlayers = [...s.players, { ...player, color, isAI: false }];
        return {
          players: newPlayers,
          status:
            s.mode === "pve" || newPlayers.length === 2 ? "playing" : "waiting",
        };
      },

      setMode(s, mode) {
        log.game("chess", "setMode", mode);
        return {
          mode,
          players: [],
          status: "waiting",
          board: createGame(),
          currentTurn: "white",
          winner: null,
        };
      },

      reset(s) {
        log.game("chess", "reset", "game reset");
        return {
          players: [],
          status: "waiting",
          board: createGame(),
          currentTurn: "white",
          winner: null,
          selectedSquare: null,
          legalMoves: [],
          aiThinking: false,
        };
      },

      select(s, { row, col, playerId }) {
        log.game(
          "chess",
          "select",
          `(${row},${col}) by ${playerId} turn=${s.currentTurn}`,
        );
        if (s.status !== "playing") {
          log.game("chess", "select-reject", "not playing");
          return s;
        }
        const player = s.players.find((p) => p.id === playerId);
        if (!player) {
          log.game(
            "chess",
            "select-reject",
            `player ${playerId} not found in [${s.players.map((p) => p.id).join(",")}]`,
          );
          return s;
        }
        if (player.color !== s.currentTurn) {
          log.game(
            "chess",
            "select-reject",
            `wrong turn: player=${player.color} current=${s.currentTurn}`,
          );
          return s;
        }
        if (player.isAI) {
          log.game("chess", "select-reject", "AI player");
          return s;
        }

        if (s.selectedSquare) {
          const { row: fromRow, col: fromCol } = s.selectedSquare;
          const newBoard = makeMove(s.board, fromRow, fromCol, row, col);
          if (!newBoard) {
            const piece = s.board[row][col];
            if (piece && piece.color === s.currentTurn) {
              return {
                selectedSquare: { row, col },
                legalMoves: getMoves(s.board, row, col),
              };
            }
            return { selectedSquare: null, legalMoves: [] };
          }

          const nextTurn = s.currentTurn === "white" ? "black" : "white";
          const winner = isCheckmate(newBoard, nextTurn) ? s.currentTurn : null;
          return {
            board: newBoard,
            currentTurn: nextTurn,
            status: winner ? "finished" : "playing",
            winner,
            selectedSquare: null,
            legalMoves: [],
          };
        } else {
          const piece = s.board[row][col];
          if (!piece || piece.color !== s.currentTurn) return s;
          return {
            selectedSquare: { row, col },
            legalMoves: getMoves(s.board, row, col),
          };
        }
      },

      /**
       * AI move — dynamically imports the chess AI module.
       * Uses metadata format { run: async fn } so Uploop routes it
       * through the async-aware execution path.
       */
      aiMove: {
        run: async (s) => {
          log.game(
            "chess",
            "aiMove-called",
            `turn=${s.currentTurn} aiColor=${s.aiColor} mode=${s.mode} status=${s.status}`,
          );
          if (s.status !== "playing") {
            log.game("chess", "aiMove-skip", "not playing");
            return s;
          }
          if (s.mode !== "pve") {
            log.game("chess", "aiMove-skip", "not pve");
            return s;
          }
          if (s.currentTurn !== s.aiColor) {
            log.game(
              "chess",
              "aiMove-skip",
              `wrong turn: ${s.currentTurn} vs ${s.aiColor}`,
            );
            return s;
          }
          log.game("chess", "aiMove-start", "importing AI module...");

          try {
            // Dynamic import — the module path can be a CDN URL!
            const ai = await import(aiModulePath);
            // Timeout guard: force move within 5 seconds
            const best = await Promise.race([
              Promise.resolve(ai.findBestMove(s.board, s.aiColor, 3)),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("AI timeout")), 5000),
              ),
            ]);
            if (!best) return { aiThinking: false };

            const newBoard = makeMove(
              s.board,
              best.fromRow,
              best.fromCol,
              best.toRow,
              best.toCol,
            );
            if (!newBoard) return { aiThinking: false };

            const nextTurn = s.currentTurn === "white" ? "black" : "white";
            const winner = isCheckmate(newBoard, nextTurn) ? s.aiColor : null;
            return {
              board: newBoard,
              currentTurn: nextTurn,
              status: winner ? "finished" : "playing",
              winner,
              aiThinking: false,
              selectedSquare: null,
              legalMoves: [],
            };
          } catch (e) {
            console.error("AI error:", e.message);
            // Fallback: make a random legal move so game doesn't freeze
            const allMoves = [];
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                const piece = s.board[r][c];
                if (!piece || piece.color !== s.aiColor) continue;
                const moves = getMoves(s.board, r, c);
                for (const m of moves) {
                  const nb = makeMove(s.board, r, c, m.row, m.col);
                  if (nb)
                    allMoves.push({
                      fromRow: r,
                      fromCol: c,
                      toRow: m.row,
                      toCol: m.col,
                    });
                }
              }
            }
            if (allMoves.length > 0) {
              const pick =
                allMoves[Math.floor(Math.random() * allMoves.length)];
              const newBoard = makeMove(
                s.board,
                pick.fromRow,
                pick.fromCol,
                pick.toRow,
                pick.toCol,
              );
              const nextTurn = s.currentTurn === "white" ? "black" : "white";
              return {
                board: newBoard,
                currentTurn: nextTurn,
                aiThinking: false,
                selectedSquare: null,
                legalMoves: [],
              };
            }
            return { aiThinking: false };
          }
        },
      },

      setAiThinking(s, v) {
        return { aiThinking: v };
      },

      chat(s, msg) {
        saveMessage(msg);
        return { messages: [...s.messages, msg].slice(-50) };
      },

      leave(s, playerId) {
        const remaining = s.players.filter((p) => p.id !== playerId);
        return {
          players: remaining,
          status: remaining.length < 2 ? "waiting" : s.status,
        };
      },
    },
  });

  // Watch for AI turn — when it's AI's turn, trigger aiMove after a short delay
  gameLoop.subscribe((state) => {
    log.state("chess", state);
    if (
      state.mode === "pve" &&
      state.currentTurn === state.aiColor &&
      state.status === "playing" &&
      !state.aiThinking
    ) {
      log.game(
        "chess",
        "ai-trigger",
        `AI turn (${state.aiColor}), thinking...`,
      );
      gameLoop.send("setAiThinking", true);
      setTimeout(() => {
        if (gameLoop.get().currentTurn === state.aiColor) {
          log.game("chess", "ai-exec", "calling aiMove");
          gameLoop.send("aiMove");
        }
      }, 600);
    }
  });

  return gameLoop;
}
