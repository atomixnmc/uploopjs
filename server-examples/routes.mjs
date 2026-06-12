import { renderToString } from "@uploop/sst";
import { wrapPage, notFoundPage, errorPage } from "./layout.mjs";
import { log } from "./logger.mjs";
import { Counter, counterClientScript } from "./components/counter.mjs";
import {
  BlogList,
  BlogDetail,
  BlogEditor,
  blogClientScript,
} from "./components/blog.mjs";
import { getPosts, getPost, createPost } from "./db/blog.js";
import { TodoList, todosClientScript } from "./components/todos.mjs";
import { ChatPage, chatClientScript } from "./components/chat.mjs";
import { CSSDemo } from "./components/css-demo.mjs";
import { Landing } from "./components/landing.mjs";
import { HyperGraphDocs } from "./components/hypergraph-docs.mjs";
import { APIDocs, apiDocsClientScript } from "./components/api-docs.mjs";
import { ChessPage } from "./games/chess/chess-page.mjs";
import {
  SlitherPage,
  slitherClientScript,
} from "./games/slither/slither-page.mjs";

export function setupRoutes({ todoService, chatLoop, chessGame, slitherGame }) {
  return async (req, res) => {
    const url = new URL(req.url, "http://localhost:3500");
    const path = url.pathname;
    const html = { "Content-Type": "text/html; charset=utf-8" };

    try {
      // WebSocket upgrade — let ws servers handle it
      if (req.headers.upgrade === "websocket") return;
      // Pages — pass activePath for sidebar highlighting
      if (path === "/")
        return ok(res, wrapPage("Home", renderToString(Landing), "/"));
      if (path === "/counter")
        return ok(
          res,
          wrapPage(
            "Counter",
            renderToString(Counter, { count: 0 }) + counterClientScript(0),
            "/counter",
          ),
        );
      if (path === "/blog/new") {
        // SSR renders the editor shell; client hydrates for WYSIWYG
        return ok(
          res,
          wrapPage(
            "New Post",
            renderToString(BlogEditor) + blogClientScript(),
            "/blog",
          ),
        );
      }
      if (path === "/blog") {
        const posts = getPosts();
        return ok(
          res,
          wrapPage("Blog", renderToString(BlogList, { posts }), "/blog"),
        );
      }
      if (path.startsWith("/blog/")) {
        const id = path.split("/")[2];
        const post = getPost(id);
        if (!post)
          return ok(
            res,
            wrapPage(
              "Blog Post",
              renderToString(BlogDetail, { id: "" }),
              "/blog",
            ),
          );
        return ok(
          res,
          wrapPage(
            "Blog Post",
            renderToString(BlogDetail, {
              id: String(post.id),
              title: post.title,
              body: post.body,
              author: post.author,
              created_at: post.created_at,
            }),
            "/blog",
          ),
        );
      }
      if (path === "/todos") {
        const items = await todoService.find();
        return ok(
          res,
          wrapPage(
            "Todos",
            renderToString(TodoList, { items }) + todosClientScript(),
            "/todos",
          ),
        );
      }
      if (path === "/chat") {
        const state = chatLoop.get();
        return ok(
          res,
          wrapPage(
            "Chat",
            renderToString(ChatPage, state) + chatClientScript(),
            "/chat",
          ),
        );
      }
      if (path === "/chess") {
        const state = chessGame.get();
        log.state("chess", state);
        log.http("GET", path, 200);
        const playerId = "p" + Math.random().toString(36).slice(2, 8);
        const playerName = "Player" + Math.floor(Math.random() * 1000);
        const configJSON = JSON.stringify({ playerId, playerName });
        const stateJSON = JSON.stringify(state);
        return ok(
          res,
          wrapPage(
            "Chess",
            renderToString(ChessPage, state) +
              `<script type="application/json" id="chess-config">${configJSON}</script>` +
              `<script type="application/json" id="chess-state">${stateJSON}</script>` +
              `<script src="/public/chess-client.js"></script>`,
            "/chess",
          ),
        );
      }
      if (path === "/css-demo")
        return ok(
          res,
          wrapPage("CSS Demo", renderToString(CSSDemo), "/css-demo"),
        );
      if (path === "/hypergraph") {
        const graphState = {
          todos: {
            graph: todoService.loop,
            desc: "Todo CRUD service — FeathersJS-style service pattern",
            events: todoService.loop.events || { total: 0, rejected: 0 },
            state: await todoService.find(),
          },
          chat: {
            graph: chatLoop,
            desc: "Real-time chat — WebSocket broadcast",
            events: chatLoop.events || { total: 0, rejected: 0 },
            state: chatLoop.get(),
          },
          chess: {
            graph: chessGame,
            desc: "Multiplayer chess — turn-based game loop",
            events: chessGame.events || { total: 0, rejected: 0 },
            state: chessGame.get(),
          },
          slither: {
            graph: slitherGame,
            desc: "Multiplayer snake game — 15fps game loop",
            events: slitherGame.events || { total: 0, rejected: 0 },
            state: slitherGame.get(),
          },
        };
        return ok(
          res,
          wrapPage(
            "HyperGraph",
            renderToString(HyperGraphDocs, { graphs: graphState }),
            "/hypergraph",
          ),
        );
      }
      if (path === "/api-docs")
        return ok(
          res,
          wrapPage(
            "API Docs",
            renderToString(APIDocs) + apiDocsClientScript(),
            "/api-docs",
          ),
        );
      if (path === "/slither") {
        const state = slitherGame.get();
        return ok(
          res,
          wrapPage(
            "Slither",
            renderToString(SlitherPage, state) + slitherClientScript(),
            "/slither",
          ),
        );
      }

      // API
      if (path === "/api/blog" && req.method === "GET")
        return json(res, getPosts());
      if (path === "/api/blog" && req.method === "POST") {
        return readBody(req).then((data) =>
          json(res, createPost(JSON.parse(data)), 201),
        );
      }
      if (path === "/api/todos" && req.method === "GET")
        return json(res, await todoService.find());
      if (path === "/api/todos" && req.method === "POST") {
        const body = await readBody(req);
        const created = await todoService.create(JSON.parse(body));
        return json(res, created, 201);
      }
      if (path.startsWith("/api/todos/") && req.method === "DELETE") {
        const id = parseInt(path.split("/")[3]);
        const removed = await todoService.remove(id);
        return json(res, removed);
      }
      if (path === "/api/state") {
        const todos = await todoService.find();
        return json(res, { todos, chat: chatLoop.get() });
      }

      return ok(res, notFoundPage(), 404);
    } catch (e) {
      console.error(e);
      return ok(res, errorPage(e.message), 500);
    }
  };
}

function ok(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(body);
}
function json(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => resolve(body));
  });
}
