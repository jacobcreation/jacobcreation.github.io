import { initEditor, saveCurrentFile, files } from "./editor.js";
import { runSandbox } from "./sandbox.js";
import { askAI } from "./ai.js";

/* ========= RENDER AI MESSAGE ========= */
function renderAIMessage(container, text) {
  container.innerHTML = "";

  // Normalize line endings
  text = text.replace(/\r\n/g, "\n");

  // Auto-close unclosed fences
  const fenceCount = (text.match(/```/g) || []).length;
  if (fenceCount % 2 !== 0) {
    text += "\n```";
  }

  const parts = text.split("```");

  for (let i = 0; i < parts.length; i++) {
    // Normal text
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
      let lines = parts[i].split("\n");

      // Remove language line if present
      if (/^(html|css|js|javascript)$/i.test(lines[0].trim())) {
        lines.shift();
      }

      const codeText = lines.join("\n");

      // Wrapper
      const wrap = document.createElement("div");
      wrap.className = "ai-code-wrap";

      // Copy button
      const btn = document.createElement("button");
      btn.className = "ai-copy-btn";
      btn.textContent = "Copy";
      btn.onclick = () => {
        navigator.clipboard.writeText(codeText);
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy"), 1000);
      };

      // Code element
      const code = document.createElement("code");
      code.className = "ai-code";
      code.textContent = codeText;

      wrap.appendChild(btn);
      wrap.appendChild(code);
      container.appendChild(wrap);
    }
  }

  container.scrollTop = container.scrollHeight;
}

/* ========= INIT ========= */
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
        code.value.slice(0, s) + "  " + code.value.slice(code.selectionEnd);
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

      const aiMsg = document.createElement("div");
      aiMsg.style.marginBottom = "12px";
      aiLog.appendChild(aiMsg);

      renderAIMessage(aiMsg, reply);
    }
  });

  document.getElementById("clearChat").onclick = () => {
    aiLog.textContent = "🤖 AI ready. Ask about your code.";
  };
}

init();
