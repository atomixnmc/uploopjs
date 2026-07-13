// In-memory chat message store
const messages = []

export function saveMessage(msg) {
  messages.push(msg)
  // Keep last 500 messages
  if (messages.length > 500) messages.shift()
}

export function getMessages() {
  return messages
}
