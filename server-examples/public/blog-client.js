/**
 * Blog Client — CMS with WYSIWYG editor + media blocks
 *
 * Architecture:
 *   - SSR renders shell (title input + mount div + save button)
 *   - Client creates WYSIWYG toolbar + contenteditable via vanilla DOM
 *   - Save via fetch to /api/blog (Uploop createService backend)
 *   - Import map provides @uploop/core, @uploop/html, uploop:wysiwyg
 */

// ── Toolbar HTML ───────────────────────────────────────────

const TOOLBAR_HTML = `
  <div class="up-wysiwyg-toolbar" style="display:flex;gap:4px;padding:0.5rem;background:#f5f5f5;border:2px solid #ddd;border-bottom:none;border-radius:8px 8px 0 0;flex-wrap:wrap;align-items:center">
    <button data-cmd="bold" title="Bold (Ctrl+B)" style="padding:0.3rem 0.5rem;font-weight:bold;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;min-width:28px;font-size:0.8rem">B</button>
    <button data-cmd="italic" title="Italic (Ctrl+I)" style="padding:0.3rem 0.5rem;font-style:italic;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;min-width:28px;font-size:0.8rem">I</button>
    <button data-cmd="underline" title="Underline (Ctrl+U)" style="padding:0.3rem 0.5rem;text-decoration:underline;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;min-width:28px;font-size:0.8rem">U</button>
    <span style="width:1px;background:#ddd;margin:0 4px"></span>
    <button data-cmd="formatBlock" data-arg="h2" title="Heading 2" style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:0.8rem;font-weight:700">H2</button>
    <button data-cmd="formatBlock" data-arg="h3" title="Heading 3" style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:0.8rem;font-weight:700">H3</button>
    <span style="width:1px;background:#ddd;margin:0 4px"></span>
    <button data-cmd="insertUnorderedList" title="Bullet List" style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:0.8rem">≡•</button>
    <button data-cmd="insertOrderedList" title="Numbered List" style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:0.8rem">≡1</button>
    <span style="width:1px;background:#ddd;margin:0 4px"></span>
    <button data-cmd="createLink" title="Insert Link" style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:0.8rem">🔗</button>
    <button data-cmd="unlink" title="Remove Link" style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:0.8rem">🔓</button>
    <span style="width:1px;background:#ddd;margin:0 4px"></span>
    <button data-media="image" title="Insert Image" style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:0.8rem">🖼</button>
    <button data-media="carousel" title="Insert Carousel" style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:0.8rem">🎠</button>
    <button data-media="audio" title="Insert Audio" style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:0.8rem">🎵</button>
    <button data-media="video" title="Insert Video" style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:0.8rem">🎬</button>
    <span style="width:1px;background:#ddd;margin:0 4px"></span>
    <button data-action="undo" title="Undo (Ctrl+Z)" style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:0.8rem">↩</button>
    <button data-action="redo" title="Redo (Ctrl+Y)" style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:0.8rem">↪</button>
  </div>`;

// ── Create WYSIWYG editor in mount div ────────────────────

// Undo/redo stack (Operational Transform light)
let _undoStack = [];
let _redoStack = [];
const MAX_UNDO = 50;

function pushUndo(html) {
  _undoStack.push(html);
  if (_undoStack.length > MAX_UNDO) _undoStack.shift();
  _redoStack = []; // clear redo on new action
}

function undo() {
  const body = document.querySelector(".up-wysiwyg-body");
  if (!body || _undoStack.length < 2) return;
  _redoStack.push(_undoStack.pop());
  const prev = _undoStack[_undoStack.length - 1];
  body.innerHTML = prev;
}

function redo() {
  const body = document.querySelector(".up-wysiwyg-body");
  if (!body || _redoStack.length === 0) return;
  const next = _redoStack.pop();
  _undoStack.push(next);
  body.innerHTML = next;
}

function createWysiwyg(initialHTML) {
  const mount = document.getElementById("be-wysiwyg-mount");
  if (!mount) return console.error("[Blog] #be-wysiwyg-mount not found");

  // Build the WYSIWYG HTML
  mount.innerHTML = `
    <div class="up-wysiwyg" style="font-family:system-ui">
      ${TOOLBAR_HTML}
      <div class="up-wysiwyg-body" contenteditable="true"
        style="min-height:250px;padding:1rem;border:2px solid #ddd;border-top:none;border-radius:0 0 8px 8px;outline:none;background:#fff;font-size:1rem;line-height:1.7;color:#333"
      ></div>
    </div>`;

  const body = mount.querySelector(".up-wysiwyg-body");

  // Set initial content
  if (initialHTML && body) {
    body.innerHTML = initialHTML;
  }

  // Wire toolbar buttons
  const toolbar = mount.querySelector(".up-wysiwyg-toolbar");
  if (toolbar) {
    toolbar.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      e.preventDefault();

      const cmd = btn.dataset.cmd;
      const mediaType = btn.dataset.media;
      const action = btn.dataset.action;

      if (action === "undo") {
        undo();
        return;
      }
      if (action === "redo") {
        redo();
        return;
      }
      if (mediaType) {
        showMediaDialog(mediaType);
        return;
      }

      if (cmd === "createLink") {
        const url = prompt("Link URL:", "https://");
        if (url) document.execCommand(cmd, false, url);
      } else if (cmd) {
        document.execCommand(cmd, false, btn.dataset.arg || null);
      }
    });
  }

  // Keyboard shortcuts
  if (body) {
    body.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey) {
        const map = {
          b: "bold",
          i: "italic",
          u: "underline",
          k: "createLink",
          z: "undo",
          y: "redo",
        };
        const cmd = map[e.key];
        if (cmd) {
          e.preventDefault();
          if (cmd === "createLink") {
            const url = prompt("Link URL:", "https://");
            if (url) document.execCommand(cmd, false, url);
          } else if (cmd === "undo") {
            undo();
          } else if (cmd === "redo") {
            redo();
          } else {
            document.execCommand(cmd);
          }
        }
      }
    });

    // Active state tracking — highlight toolbar buttons based on cursor position
    const updateToolbarState = () => {
      const cmds = ["bold", "italic", "underline", "strikeThrough"];
      for (const cmd of cmds) {
        const btn = toolbar?.querySelector(`[data-cmd="${cmd}"]`);
        if (btn) {
          const active = document.queryCommandState(cmd);
          btn.style.background = active ? "#e0e0ff" : "#fff";
          btn.style.borderColor = active ? "#646cff" : "#ccc";
          btn.style.color = active ? "#646cff" : "#333";
        }
      }
    };
    document.addEventListener("selectionchange", updateToolbarState);
    body.addEventListener("keyup", updateToolbarState);
    body.addEventListener("mouseup", updateToolbarState);
    // Snapshot for undo after each edit
    body.addEventListener("input", () => pushUndo(body.innerHTML));
    // Initial state
    setTimeout(updateToolbarState, 100);
    // Initial undo snapshot
    pushUndo(body.innerHTML);
  }

  console.log(
    "[Blog] WYSIWYG editor created" + (initialHTML ? " with content" : ""),
  );
  return body;
}

// ── Get current WYSIWYG content ───────────────────────────

function getWysiwygContent() {
  const body = document.querySelector(".up-wysiwyg-body");
  return body ? body.innerHTML : "";
}

// ── Media dialog ───────────────────────────────────────────

function showMediaDialog(type) {
  let dialog = document.getElementById("be-media-dialog");
  if (!dialog) {
    dialog = document.createElement("div");
    dialog.id = "be-media-dialog";
    dialog.style.cssText =
      "display:none;margin:1rem 0;padding:1rem;background:#f8f8ff;border:1px solid #e0e0ff;border-radius:8px";
    dialog.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
        <strong>Insert Media</strong>
        <button id="be-media-close" style="border:none;background:none;cursor:pointer;font-size:1.2rem">&times;</button>
      </div>
      <div id="be-media-form" style="display:flex;flex-direction:column;gap:0.5rem"></div>`;
    document
      .getElementById("blog-editor-root")
      .insertBefore(dialog, document.getElementById("be-save").parentNode);
    dialog.querySelector("#be-media-close").onclick = () => {
      dialog.style.display = "none";
    };
  }

  const form = dialog.querySelector("#be-media-form");
  const fields = {
    image: `<label>Image URL</label><input id=mf-src placeholder=https://... style=padding:.4rem;border:1px solid #ccc;border-radius:4px>
      <label>Alt</label><input id=mf-alt placeholder=Description style=padding:.4rem;border:1px solid #ccc;border-radius:4px>
      <label>Caption</label><input id=mf-caption placeholder=Optional style=padding:.4rem;border:1px solid #ccc;border-radius:4px>
      <button id=mf-insert style=padding:.4rem;background:#646cff;color:#fff;border:none;border-radius:4px;cursor:pointer>Insert Image</button>`,
    carousel: `<label>Image URLs (one per line)</label><textarea id=mf-urls rows=4 placeholder="https://picsum.photos/seed/a/600/300" style=padding:.4rem;border:1px solid #ccc;border-radius:4px;font-family:monospace;font-size:.8rem></textarea>
      <button id=mf-insert style=padding:.4rem;background:#646cff;color:#fff;border:none;border-radius:4px;cursor:pointer>Insert Carousel</button>`,
    audio: `<label>Media URL</label><input id=mf-src placeholder=https://... style=padding:.4rem;border:1px solid #ccc;border-radius:4px>
      <label>Title</label><input id=mf-title placeholder=Title style=padding:.4rem;border:1px solid #ccc;border-radius:4px>
      <label>Artist</label><input id=mf-artist placeholder=Artist style=padding:.4rem;border:1px solid #ccc;border-radius:4px>
      <button id=mf-insert style=padding:.4rem;background:#646cff;color:#fff;border:none;border-radius:4px;cursor:pointer>Insert Audio</button>`,
    video: `<label>Media URL</label><input id=mf-src placeholder=https://... style=padding:.4rem;border:1px solid #ccc;border-radius:4px>
      <label>Title</label><input id=mf-title placeholder=Title style=padding:.4rem;border:1px solid #ccc;border-radius:4px>
      <label>Creator</label><input id=mf-artist placeholder=Creator style=padding:.4rem;border:1px solid #ccc;border-radius:4px>
      <button id=mf-insert style=padding:.4rem;background:#646cff;color:#fff;border:none;border-radius:4px;cursor:pointer>Insert Video</button>`,
  };
  form.innerHTML = fields[type] || "";
  form.dataset.mediaType = type;
  dialog.style.display = "block";
}

// ── Insert media placeholder ──────────────────────────────

document.addEventListener("click", (e) => {
  if (e.target.id !== "mf-insert") return;
  const dialog = document.getElementById("be-media-dialog");
  const form = document.getElementById("be-media-form");
  const type = form.dataset.mediaType;
  const g = (id) => document.getElementById(id)?.value || "";

  const body = document.querySelector(".up-wysiwyg-body");
  if (!body) return;

  let html;
  if (type === "image") {
    html = `<div data-media="image" data-src="${g("mf-src")}" data-alt="${g("mf-alt")}" data-caption="${g("mf-caption")}" contenteditable="false" style="display:block;margin:1rem 0"><img src="${g("mf-src")}" alt="${g("mf-alt")}" style="max-width:100%;border-radius:8px;pointer-events:none"><em style="display:block;text-align:center;font-size:.85rem;color:#888;margin-top:.25rem">${g("mf-caption")}</em></div>`;
  } else if (type === "carousel") {
    const urls = g("mf-urls")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const attrs = urls.map((u, i) => `data-img${i}="${u}"`).join(" ");
    html = `<div data-media="carousel" ${attrs} contenteditable="false" style="display:block;margin:1rem 0;padding:2rem;text-align:center;background:#f0f0f5;border-radius:8px;color:#888"><em>🎠 Carousel (${urls.length} images)</em></div>`;
  } else {
    html = `<div data-media="${type}" data-src="${g("mf-src")}" data-title="${g("mf-title")}" data-artist="${g("mf-artist")}" contenteditable="false" style="display:block;margin:1rem 0"><em>${type === "audio" ? "🎵" : "🎬"} ${g("mf-title") || type}</em></div>`;
  }

  body.focus();
  document.execCommand("insertHTML", false, html);
  dialog.style.display = "none";
});

// ── Save ───────────────────────────────────────────────────

async function handleSave() {
  const title = document.getElementById("be-title")?.value?.trim();
  if (!title) return alert("Please enter a title.");

  const saveBtn = document.getElementById("be-save");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  try {
    const body = getWysiwygContent();
    const path = window.location.pathname;
    const editMatch = path.match(/^\/blog\/(.+)\/edit$/);
    const url = editMatch ? `/api/blog/${editMatch[1]}` : "/api/blog";
    const method = editMatch ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, author: "Team" }),
    });
    if (!res.ok) throw new Error("Server error: " + res.status);
    const post = await res.json();
    window.location.href = "/blog/" + post.id;
  } catch (e) {
    console.error("Save failed:", e);
    alert("Failed to save: " + e.message);
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "💾 Publish";
    }
  }
}

// ── Init ───────────────────────────────────────────────────

const root = document.getElementById("blog-editor-root");
if (!root) {
  console.log("[Blog] Not on editor page");
} else {
  const path = window.location.pathname;
  const editMatch = path.match(/^\/blog\/(.+)\/edit$/);

  if (editMatch) {
    fetch(`/api/blog/${editMatch[1]}`)
      .then((r) => r.json())
      .then((post) => {
        document.getElementById("be-title").value = post.title || "";
        createWysiwyg(post.body);
      })
      .catch((err) => {
        console.error("[Blog] Failed to load post:", err);
        createWysiwyg();
      });
  } else {
    // Create mode
    createWysiwyg();
  }

  // Wire save button
  document.addEventListener("click", (e) => {
    if (e.target.id === "be-save") handleSave();
  });

  console.log("[Blog] CMS ready — vanilla DOM WYSIWYG");
}
