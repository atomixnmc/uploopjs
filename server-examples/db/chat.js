import { getDB } from './schema.js'

export function getMessages(limit = 50) {
  return getDB().prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT ?').all(limit).reverse()
}

export function saveMessage({ user, text }) {
  const result = getDB().prepare('INSERT INTO messages (user, text) VALUES (?, ?)').run(user, text)
  return { id: result.lastInsertRowid, user, text }
}
