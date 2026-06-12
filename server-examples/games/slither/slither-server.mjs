import { createLoop } from '@uploop/core'

const W = 60, H = 40 // grid size

function randomPos() {
  return { x: Math.floor(Math.random() * W), y: Math.floor(Math.random() * H) }
}

export function createSlitherGame() {
  const gameLoop = createLoop({
    state: {
      snakes: {},       // playerId → { id, name, body: [{x,y},...], dir: {x,y}, color, alive }
      food: [],         // [{x, y}]
      tick: 0
    },
    update: {
      join: (s, player) => {
        if (Object.keys(s.snakes).length >= 20) return s
        const start = randomPos()
        const colors = ['#ff6b6b','#feca57','#48dbfb','#ff9ff3','#54a0ff','#5f27cd','#01a3a4','#f368e0','#0abde3','#10ac84']
        const color = colors[Object.keys(s.snakes).length % colors.length]
        return {
          snakes: { ...s.snakes, [player.id]: { id: player.id, name: player.name, body: [{x: start.x, y: start.y}, {x: start.x - 1, y: start.y}, {x: start.x - 2, y: start.y}], dir: {x: 1, y: 0}, color, alive: true, score: 0 } }
        }
      },
      turn: (s, { playerId, dir }) => {
        const snake = s.snakes[playerId]
        if (!snake || !snake.alive) return s
        // Prevent 180-degree turn
        if (dir.x === -snake.dir.x && dir.y === -snake.dir.y) return s
        return { snakes: { ...s.snakes, [playerId]: { ...snake, dir } } }
      },
      tick: (s) => {
        const snakes = { ...s.snakes }
        let food = [...s.food]
        const aliveSnakes = Object.values(snakes).filter(sn => sn.alive)

        // Spawn food (keep ~20 items)
        while (food.length < 20) food.push(randomPos())

        // Move each snake
        for (const snake of aliveSnakes) {
          const head = snake.body[0]
          const newHead = { x: (head.x + snake.dir.x + W) % W, y: (head.y + snake.dir.y + H) % H }
          const newBody = [newHead, ...snake.body]
          newBody.pop() // remove tail (unless ate food)

          // Check food
          const ateIndex = food.findIndex(f => f.x === newHead.x && f.y === newHead.y)
          if (ateIndex >= 0) {
            newBody.push(snake.body[snake.body.length - 1]) // grow
            food.splice(ateIndex, 1)
            snake.score += 10
          }

          // Check collision with other snakes
          let died = false
          for (const other of aliveSnakes) {
            if (other.id === snake.id) {
              // Self collision (skip head)
              if (newBody.slice(1).some(seg => seg.x === newHead.x && seg.y === newHead.y)) died = true
            } else {
              if (other.body.some(seg => seg.x === newHead.x && seg.y === newHead.y)) died = true
            }
          }

          snakes[snake.id] = { ...snake, body: newBody, alive: !died }
        }

        return { snakes, food, tick: s.tick + 1 }
      },
      leave: (s, playerId) => {
        const snakes = { ...s.snakes }
        delete snakes[playerId]
        return { snakes }
      }
    }
  })

  // Game tick loop — 15 ticks/sec
  setInterval(() => gameLoop.send('tick'), 1000 / 15)

  return gameLoop
}
