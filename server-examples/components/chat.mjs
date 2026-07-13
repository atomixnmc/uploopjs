import { component, createLoop } from "@uploop/core";
import { html } from "@uploop/html";
import { getMessages, saveMessage } from "../db/chat.js";

export function createChatLoop() {
  const recent = getMessages(50);
  return createLoop({
    state: {
      messages: recent.map((m) => ({
        user: m.user,
        text: m.text,
        time: m.created_at,
      })),
      online: 0,
    },
    update: {
      message: (s, msg) => {
        saveMessage(msg);
        return {
          messages: [
            ...s.messages,
            { ...msg, time: new Date().toLocaleTimeString() },
          ].slice(-50),
        };
      },
      join: (s) => ({ online: s.online + 1 }),
      leave: (s) => ({ online: Math.max(0, s.online - 1) }),
    },
  });
}

export const ChatPage = component("ChatPage", {
  state: { messages: [], online: 0 },
  view: (s) => html`
    <div id="chat-root" style="max-width:500px;margin:0 auto;padding:2rem">
      <h2>💬 Chat (WebSocket)</h2>
      <p style="color:#888;font-size:0.85rem">🟢 ${s.online} online</p>
      <div
        id="chat-messages"
        style="border:1px solid #eee;border-radius:8px;padding:1rem;min-height:200px;max-height:300px;overflow-y:auto;margin:1rem 0;background:#fafafa"
      >
        ${s.messages.map(
          (m) =>
            html`<div style="margin-bottom:0.5rem">
              <strong>${m.user}:</strong> ${m.text}<span
                style="color:#aaa;font-size:0.7rem;margin-left:0.5rem"
                >${m.time}</span
              >
            </div>`,
        )}
      </div>
      <div style="display:flex;gap:0.5rem">
        <input
          id="chat-input"
          placeholder="Type a message..."
          style="flex:1;padding:0.5rem;border:1px solid #ccc;border-radius:6px"
        />
        <button
          id="chat-send"
          style="padding:0.5rem 1rem;background:#646cff;color:white;border:none;border-radius:6px;cursor:pointer"
        >
          Send
        </button>
      </div>
    </div>
  `,
});

export function chatClientScript() {
  return `<script>
setTimeout(function() {
  var ws = new WebSocket('ws://' + location.host + '/ws')
  var name = 'User' + Math.floor(Math.random() * 1000)
  ws.onopen = function() { ws.send(JSON.stringify({ type: 'join', user: name })) }
  ws.onmessage = function(e) {
    var msg = JSON.parse(e.data)
    var div = document.getElementById('chat-messages')
    if (div && msg.type === 'message') {
      div.innerHTML += '<div><strong>' + msg.user + ':</strong> ' + msg.text + '</div>'
      div.scrollTop = div.scrollHeight
    }
    if (msg.type === 'online') {
      var p = document.querySelector('#chat-root p')
      if (p) p.innerHTML = '🟢 ' + msg.count + ' online'
    }
  }
  document.getElementById('chat-send').onclick = function() {
    var input = document.getElementById('chat-input')
    if (input.value.trim()) { ws.send(JSON.stringify({ type: 'message', user: name, text: input.value })); input.value = '' }
  }
  document.getElementById('chat-input').onkeydown = function(e) { if (e.key === 'Enter') document.getElementById('chat-send').click() }
}, 100)
</script>`;
}
