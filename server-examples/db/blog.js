import { getDB } from "./schema.js";

export function getPosts() {
  return getDB().prepare("SELECT * FROM posts ORDER BY created_at DESC").all();
}

export function getPost(id) {
  return getDB().prepare("SELECT * FROM posts WHERE id = ?").get(id);
}

export function createPost({ title, body, author = "Team" }) {
  const result = getDB()
    .prepare("INSERT INTO posts (title, body, author) VALUES (?, ?, ?)")
    .run(title, body, author);
  return getPost(result.lastInsertRowid);
}

export function updatePost(id, { title, body, author }) {
  getDB()
    .prepare("UPDATE posts SET title = ?, body = ?, author = ? WHERE id = ?")
    .run(title, body, author, id);
  return getPost(id);
}
