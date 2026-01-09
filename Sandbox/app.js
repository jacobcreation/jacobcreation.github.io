import { initEditor, saveCurrentFile, files } from "./editor.js";
import { runSandbox } from "./sandbox.js";
import { askAI } from "./ai.js";

/* ---------- FORCE PROPER CODE FENCES ---------- */
function forceTripleBackticks(text) {
  return text
    // ``html → ```html
    .replace(/``\s*(html|css|js)\n/gi, "```$1\n")
    // `html → ```html
    .replace(/`\s*(html|css|js)\n/gi, "```$1\n")
    // ```\nhtml → ```html
    .replace(/```\s*\n\s*(html|css|js)\n/gi, "```$1\n")
    // fix bad closing `
    .replace(/\n``?\s*$/g, "\n```");
}

/* ---------- RENDER AI MESSAGE ---------- */
function renderAIMessage(container, text) {
  container.innerHTML = "";

  const parts = text.split("```");

  for (let i = 0; i < parts.length; i++) {
    // Plain text
    if (i % 2 === 0) {
      if (parts[i].trim()) {
        const div = document.createElement("div");
        div.textContent = parts[i];
        div.style.marginBottom = "8px";
        container.appendChild(div);
      }
    }
    // Code block
    else {
      const lines = parts[i].trimStart().split("\n");
      lines.shift(); // remove language
      const code = lines.join("\n");

      const pre = document.createElement("pre");
      pre.style.position = "relative";

      const codeEl = document.createElement("code");
      codeEl.textContent = code;
      pre.appendChild(codeEl);

      const btn = document.createElement("button");
      btn.textContent = "Copy";
      btn.style.position = "absolute";
      btn.style.top = "6px";
      btn.style.right = "6px";
      btn.style.fontSize = "12px";

      btn.onclick = () => {
        navigator.clipboard.writeText(code);
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy"), 1000);
      };

      pre.appendChild(btn);
      container.appendChild(pre);
    }
  }

  container.scrollTop = container.scrollHeight;
}

/* ---------- INIT ---------- */
function init() {
  initEditor();
  runSandbox();

  document.getElementById("run").onclick = () => {
    saveCurrentFile();
    runSandbox();
  };

  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      saveCurrentFile();
      runSandbox();
    }
  });

  const code = document.getElementById("code");
  code.addEventListener("keydown", e => {
    if (e.key === "Tab") {
      e.preventDefault();
      const s = code.selectionStart;
      code.value =
        code.value.slice(0, s) +
        "  " +
        code.value.slice(code.selectionEnd);
      code.selectionStart = code.selectionEnd = s + 2;
    }
  });

  const aiInput = document.getElementById("aiInput");
  const aiLog = document.getElementById("aiLog");

  aiInput.addEventListener("keydown", async e => {
    if (e.key === "Enter") {
      saveCurrentFile();

      const q = aiInput.value.trim();
      if (!q) return;

      const user = document.createElement("div");
      user.textContent = "🧑 " + q;
      user.style.marginBottom = "6px";
      aiLog.appendChild(user);

      aiInput.value = "";

      const reply = await askAI(q, files);
      const fixed = forceTripleBackticks(reply);

      const aiMsg = document.createElement("div");
      aiMsg.style.marginBottom = "12px";
      aiLog.appendChild(aiMsg);

      renderAIMessage(aiMsg, fixed);
    }
  });

  document.getElementById("clearChat").onclick = () => {
    aiLog.textContent = "🤖 AI ready. Ask about your code.";
  };
}

init();
