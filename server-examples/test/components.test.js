import { describe, it, expect } from "vitest";
import { renderToString } from "@uploop/sst";
import { Counter, counterClientScript } from "../components/counter.mjs";
import { BlogList, BlogDetail } from "../components/blog.mjs";
import { TodoList } from "../components/todos.mjs";
import { ChatPage, chatClientScript } from "../components/chat.mjs";
import { CSSDemo } from "../components/css-demo.mjs";
import { Landing } from "../components/landing.mjs";

describe("Counter", () => {
  it("renders with default count of 0", () => {
    const html = renderToString(Counter);
    expect(html).toContain("SSR Counter");
    expect(html).toContain('id="count-display"');
    expect(html).toContain('id="btn-inc"');
    expect(html).toContain('id="btn-dec"');
    expect(html).toContain('id="btn-reset"');
  });

  it("renders with custom count", () => {
    const html = renderToString(Counter, { count: 5 });
    expect(html).toContain('id="count-display"');
  });

  it("includes client-side hydration script", () => {
    expect(typeof counterClientScript).toBe("function");
    const s = counterClientScript(0);
    expect(s).toContain("btn-inc");
  });
});

describe("BlogList", () => {
  it("renders all blog posts", () => {
    const posts = [
      {
        id: 1,
        title: "Introducing Uploop SST",
        body: "SSR for Uploop.",
        author: "Team",
        created_at: "2026-06-01",
      },
      {
        id: 2,
        title: "Remote Loops",
        body: "Bridge loops.",
        author: "Team",
        created_at: "2026-06-02",
      },
      {
        id: 3,
        title: "Service Pattern",
        body: "CRUD services.",
        author: "Team",
        created_at: "2026-06-03",
      },
    ];
    const html = renderToString(BlogList, { posts });
    expect(html).toContain("Blog (SSR + SQLite)");
    expect(html).toContain("Introducing Uploop SST");
    expect(html).toContain("Remote Loops");
    expect(html).toContain("Service Pattern");
    expect(html).toContain("Team");
    expect(html).toContain("2026-06-01");
    expect(html).toContain("/blog/1");
    expect(html).toContain("/blog/2");
    expect(html).toContain("/blog/3");
  });
});

describe("BlogDetail", () => {
  it("renders a post with title and body", () => {
    const html = renderToString(BlogDetail, {
      id: "1",
      title: "Introducing Uploop SST",
      body: "Server-side rendering for Uploop components",
      author: "Team",
      created_at: "2026-06-01",
    });
    expect(html).toContain("Introducing Uploop SST");
    expect(html).toContain("Server-side rendering for Uploop components");
    expect(html).toContain("Team");
  });

  it("renders post 2 with title and body", () => {
    const html = renderToString(BlogDetail, {
      id: "2",
      title: "Remote Loops",
      body: "Bridge Uploop loops across the network",
      author: "Team",
      created_at: "2026-06-02",
    });
    expect(html).toContain("Remote Loops");
    expect(html).toContain("Bridge Uploop loops across the network");
  });

  it("renders post 3 with title and body", () => {
    const html = renderToString(BlogDetail, {
      id: "3",
      title: "Service Pattern",
      body: "FeathersJS-style CRUD services",
      author: "Team",
      created_at: "2026-06-03",
    });
    expect(html).toContain("Service Pattern");
    expect(html).toContain("FeathersJS-style CRUD services");
  });

  it('renders "Not found" for missing title', () => {
    const html = renderToString(BlogDetail, { id: "999" });
    expect(html).toContain("Not found");
    expect(html).not.toContain("Introducing");
  });

  it('renders "Not found" when no props provided', () => {
    const html = renderToString(BlogDetail);
    expect(html).toContain("Not found");
  });
});

describe("TodoList", () => {
  it("renders empty state with 0 items", () => {
    const html = renderToString(TodoList);
    expect(html).toContain("Todos (Service Pattern)");
    expect(html).toContain("0 items");
    expect(html).toContain('id="todo-list"');
  });

  it("renders todo items", () => {
    const items = [
      { id: 1, text: "Learn Uploop SSR", done: false },
      { id: 2, text: "Build a demo", done: false },
    ];
    const html = renderToString(TodoList, { items });
    expect(html).toContain("2 items");
    expect(html).toContain("Learn Uploop SSR");
    expect(html).toContain("Build a demo");
    expect(html).toContain('id="todo-list"');
  });

  it("renders done items with strikethrough style", () => {
    const items = [{ id: 1, text: "Done task", done: true }];
    const html = renderToString(TodoList, { items });
    expect(html).toContain("Done task");
    expect(html).toContain("text-decoration:line-through");
  });
});

describe("ChatPage", () => {
  it("renders empty chat with 0 online", () => {
    const html = renderToString(ChatPage);
    expect(html).toContain("Chat (WebSocket)");
    expect(html).toContain("0 online");
    expect(html).toContain("chat-messages");
    expect(html).toContain("chat-input");
    expect(html).toContain("chat-send");
  });

  it("renders messages and online count", () => {
    const state = {
      messages: [
        { user: "Alice", text: "Hello!", time: "12:00:00" },
        { user: "Bob", text: "Hi!", time: "12:01:00" },
      ],
      online: 3,
    };
    const html = renderToString(ChatPage, state);
    expect(html).toContain("3 online");
    expect(html).toContain("Alice");
    expect(html).toContain("Hello!");
    expect(html).toContain("Bob");
    expect(html).toContain("Hi!");
  });

  it("chatClientScript returns a script tag with WebSocket logic", () => {
    const script = chatClientScript();
    expect(script).toContain("<script>");
    expect(script).toContain("WebSocket");
    expect(script).toContain("chat-messages");
  });
});

describe("CSSDemo", () => {
  it("renders theme info and color blocks", () => {
    const html = renderToString(CSSDemo);
    expect(html).toContain("CSS (Server-Side Theming)");
    expect(html).toContain("Server-Side Theming");
    expect(html).toContain("Primary");
    expect(html).toContain("Success");
    expect(html).toContain("Info");
    expect(html).toContain("#4f46e5");
    expect(html).toContain("#059669");
    expect(html).toContain("#0ea5e9");
    expect(html).toContain("brand");
  });
});

describe("Landing", () => {
  it("renders title and all navigation links", () => {
    const html = renderToString(Landing);
    expect(html).toContain("Uploop SST");
    expect(html).toContain("Server-Side Toolset");
    expect(html).toContain("/counter");
    expect(html).toContain("/blog");
    expect(html).toContain("/todos");
    expect(html).toContain("/chat");
    expect(html).toContain("/css-demo");
    expect(html).toContain("/api/todos");
    expect(html).toContain("SSR + Hydration");
    expect(html).toContain("SSR + Router");
    expect(html).toContain("Service Pattern");
    expect(html).toContain("WebSocket");
    expect(html).toContain("Server Theming");
    expect(html).toContain("REST API");
    expect(html).toContain("v0.5.0");
  });
});
