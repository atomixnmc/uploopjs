/**
 * Server logger — timestamps + color-coded categories.
 */
const COLORS = { reset: "\x1b[0m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", blue: "\x1b[34m", cyan: "\x1b[36m", gray: "\x1b[90m" }

function ts() { return new Date().toISOString().slice(11, 23) }

export const log = {
  http(method, path, status) {
    const c = status >= 400 ? COLORS.red : status >= 300 ? COLORS.yellow : COLORS.green
    console.log(`${COLORS.gray}[${ts()}]${COLORS.reset} ${COLORS.cyan}HTTP${COLORS.reset} ${method} ${path} ${c}${status}${COLORS.reset}`)
  },
  ws(event, path, detail = '') {
    console.log(`${COLORS.gray}[${ts()}]${COLORS.reset} ${COLORS.yellow}WS${COLORS.reset}  ${event} ${path} ${COLORS.gray}${detail}${COLORS.reset}`)
  },
  game(name, event, detail = '') {
    console.log(`${COLORS.gray}[${ts()}]${COLORS.reset} ${COLORS.blue}GAME${COLORS.reset} ${name} ${event} ${COLORS.gray}${detail}${COLORS.reset}`)
  },
  state(name, state) {
    const summary = {
      status: state.status,
      players: state.players?.length || 0,
      turn: state.currentTurn,
      mode: state.mode || 'pvp',
      boardSize: state.board?.length || 0
    }
    console.log(`${COLORS.gray}[${ts()}]${COLORS.reset} ${COLORS.green}STATE${COLORS.reset} ${name} ${JSON.stringify(summary)}`)
  },
  error(where, e) {
    console.error(`${COLORS.gray}[${ts()}]${COLORS.reset} ${COLORS.red}ERROR${COLORS.reset} ${where}: ${e.message || e}`)
  }
}
