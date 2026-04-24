import { setFile, files } from "./editor.js";
import { runSandbox } from "./sandbox.js";

const WORKER_URL = "https://chatbot-ai.b4rjxr9lk.workers.dev/";

// Stable session ID for this browser tab (server keeps the real history)
const SESSION_ID = "sandbox-" + Math.random().toString(36).slice(2, 10);

// ── Render a chat bubble into #aiLog ─────────────────────────────────────────
function appendMessage(role, text) {
  const log = document.getElementById("aiLog");

  const bubble = document.createElement("div");
  bubble.className = "ai-bubble ai-" + role;

  const label = document.createElement("span");
  label.className = "ai-label";
  label.textContent = role === "user" ? "🧑 You" : "🤖 AI";

  const body = document.createElement("div");
  body.className = "ai-body";

  body.innerHTML = formatAIText(text);

  bubble.appendChild(label);
  bubble.appendChild(body);
  log.appendChild(bubble);
  log.scrollTop = log.scrollHeight;
  return bubble;
}

function formatAIText(text) {
  // Escape HTML first
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Replace ```lang\n...\n``` with styled code blocks
  return escaped.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="ai-code"><code>${code.trim()}</code></pre>`;
  }).replace(/`([^`]+)`/g, "<code class=\"ai-inline\">$1</code>")
    .replace(/\n/g, "<br>");
}

let sandboxHistory = [];

export async function askAI(message, currentFiles) {
  if (!message.trim()) return;

  sandboxHistory.push({ role: "user", content: message });
  appendMessage("user", message);

  // Create an empty AI bubble to stream into
  const aiBubble = appendMessage("ai", "");
  const bodyEl = aiBubble.querySelector(".ai-body");
  aiBubble.classList.add("ai-thinking");

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        message,
        history: sandboxHistory,
        files: currentFiles,
        stream: true
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let reply = "";
    let didUpdate = false;

    aiBubble.classList.remove("ai-thinking");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.response) {
              reply += data.response;
              
              // Incrementally update UI
              // Temporarily hide the JSON block from the stream if we see it starting
              let displayReply = reply;
              if (displayReply.includes('```json\n{\n  "updateSandbox"')) {
                displayReply = displayReply.split('```json')[0] + "\n\n*(Writing code...)*";
              }
              bodyEl.innerHTML = formatAIText(displayReply);
              aiBubble.parentElement.scrollTop = aiBubble.parentElement.scrollHeight;
            }
          } catch (e) {}
        }
      }
    }

    // Finished streaming. Parse for agentic JSON blocks.
    const updateRegex = /```json\n([\s\S]*?)\n```/g;
    let match;
    let cleanedReply = reply;

    while ((match = updateRegex.exec(reply)) !== null) {
      try {
        const update = JSON.parse(match[1]);
        if (update.updateSandbox === true) {
          didUpdate = true;
          if (update.html !== undefined) files.html = update.html;
          if (update.css !== undefined) files.css = update.css;
          if (update.js !== undefined) files.js = update.js;
          
          cleanedReply = cleanedReply.replace(match[0], `<div style="margin: 8px 0; padding: 6px; background: rgba(78,161,255,0.2); border-radius: 6px; color: #a5d4ff; font-size: 11px;">✨ AI applied code changes!</div>`);
        }
      } catch (e) {}
    }

    bodyEl.innerHTML = formatAIText(cleanedReply);
    sandboxHistory.push({ role: "assistant", content: reply });

    if (didUpdate) {
      setFile(document.querySelector("#tabs button.active").dataset.file);
      runSandbox();
    }

  } catch (e) {
    aiBubble.classList.remove("ai-thinking");
    bodyEl.innerHTML = formatAIText("❌ Error: " + e.message);
  }
}
