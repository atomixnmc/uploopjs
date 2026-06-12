import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { createApp } from "../app.mjs";

let server;
let baseURL;

beforeAll(async () => {
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseURL = `http://localhost:${port}`;
      resolve();
    });
  });
});

afterAll(() => {
  if (server) {
    server.close();
  }
});

function get(path) {
  return new Promise((resolve, reject) => {
    http
      .get(`${baseURL}${path}`, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body }),
        );
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function post(path, data) {
  const payload = JSON.stringify(data);
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${baseURL}${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body }),
        );
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function del(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${baseURL}${path}`,
      { method: "DELETE" },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body }),
        );
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("HTTP Routes", () => {
  describe("Pages", () => {
    it("GET / renders landing page", async () => {
      const { status, body, headers } = await get("/");
      expect(status).toBe(200);
      expect(headers["content-type"]).toContain("text/html");
      expect(body).toContain("Uploop SST");
      expect(body).toContain("v0.5.0");
      expect(body).toContain("<!DOCTYPE html>");
    });

    it("GET /counter renders counter page", async () => {
      const { status, body } = await get("/counter");
      expect(status).toBe(200);
      expect(body).toContain("SSR Counter");
      expect(body).toContain("Counter — Uploop SST");
    });

    it("GET /blog renders blog list", async () => {
      const { status, body } = await get("/blog");
      expect(status).toBe(200);
      expect(body).toContain("Blog (SSR + SQLite)");
      expect(body).toContain("Introducing Uploop SST");
      expect(body).toContain("Blog — Uploop SST");
    });

    it("GET /blog/1 renders blog post detail", async () => {
      const { status, body } = await get("/blog/1");
      expect(status).toBe(200);
      expect(body).toContain("Introducing Uploop SST");
      expect(body).toContain("Server-side rendering for Uploop components");
      expect(body).toContain("Blog Post — Uploop SST");
    });

    it("GET /blog/999 renders not found", async () => {
      const { status, body } = await get("/blog/999");
      expect(status).toBe(200); // rendered as content, not 404 status
      expect(body).toContain("Not found");
      expect(body).not.toContain("Introducing");
    });

    it("GET /todos renders todo list with seed data", async () => {
      const { status, body } = await get("/todos");
      expect(status).toBe(200);
      expect(body).toContain("Todos (Service Pattern)");
      expect(body).toContain("Learn Uploop SSR");
      expect(body).toContain("Build a demo");
      expect(body).toContain("Deploy to production");
      expect(body).toContain("3 items");
    });

    it("GET /chat renders chat page with script", async () => {
      const { status, body } = await get("/chat");
      expect(status).toBe(200);
      expect(body).toContain("Chat (WebSocket)");
      expect(body).toContain("chat-messages");
      expect(body).toContain("Chat — Uploop SST");
      // Chat page includes the client script inline
      expect(body).toContain("WebSocket");
    });

    it("GET /css-demo renders CSS demo page", async () => {
      const { status, body } = await get("/css-demo");
      expect(status).toBe(200);
      expect(body).toContain("CSS (Server-Side Theming)");
      expect(body).toContain("#4f46e5");
      expect(body).toContain("#059669");
      expect(body).toContain("#0ea5e9");
      expect(body).toContain("CSS Demo — Uploop SST");
    });
  });

  describe("API", () => {
    it("GET /api/todos returns seed todos as JSON", async () => {
      const { status, body, headers } = await get("/api/todos");
      expect(status).toBe(200);
      expect(headers["content-type"]).toContain("application/json");

      const data = JSON.parse(body);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(3);
      expect(data[0].text).toBe("Learn Uploop SSR");
    });

    it("POST /api/todos creates a new todo", async () => {
      const { status, body, headers } = await post("/api/todos", {
        text: "Integration test todo",
      });
      expect(status).toBe(201);
      expect(headers["content-type"]).toContain("application/json");

      const data = JSON.parse(body);
      expect(data.text).toBe("Integration test todo");
    });

    it("DELETE /api/todos/:id removes a todo", async () => {
      const { status, body, headers } = await del("/api/todos/1");
      expect(status).toBe(200);
      expect(headers["content-type"]).toContain("application/json");

      const data = JSON.parse(body);
      expect(data.id).toBe(1);
    });

    it("GET /api/state returns combined state", async () => {
      const { status, body, headers } = await get("/api/state");
      expect(status).toBe(200);
      expect(headers["content-type"]).toContain("application/json");

      const data = JSON.parse(body);
      expect(data).toHaveProperty("todos");
      expect(data).toHaveProperty("chat");
      expect(Array.isArray(data.todos)).toBe(true);
      expect(data.chat).toHaveProperty("online");
      expect(data.chat).toHaveProperty("messages");
    });
  });

  describe("Error handling", () => {
    it("GET /nonexistent returns 404 page", async () => {
      const { status, body } = await get("/nonexistent");
      // The route handler returns content with 200 but renders a 404 page
      // (the ok() helper uses status=200 for HTML pages)
      expect(body).toContain("Page not found");
    });
  });
});
