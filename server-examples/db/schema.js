import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, 'data.db')

let _db = null

export function getDB() {
  if (_db) return _db
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')

  _db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      author TEXT DEFAULT 'Team',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  _db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Seed posts if empty
  const count = _db.prepare('SELECT COUNT(*) as c FROM posts').get()
  if (count.c === 0) {
    const insert = _db.prepare('INSERT INTO posts (title, body, author) VALUES (?, ?, ?)')
    insert.run('Introducing Uploop SST', 'Server-side rendering for Uploop components. Render components to HTML strings on the server, hydrate on the client.', 'Team')
    insert.run('Remote Loops', 'Bridge Uploop loops across the network. Same send()/subscribe() API works client and server.', 'Team')
    insert.run('Service Pattern', 'FeathersJS-style CRUD services wrapping Uploop data nodes. Real-time events built in.', 'Team')
  }

  return _db
}

export function closeDB() {
  if (_db) { _db.close(); _db = null }
}
