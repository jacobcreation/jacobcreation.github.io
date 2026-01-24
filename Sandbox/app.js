import {
  initEditor,
  saveCurrentFile,
  files,
  setActiveTab,
  makeShareURL,
  setFile
} from "./editor.js";

import { runSandbox } from "./sandbox.js";
import { askAI } from "./ai.js";
import { downloadProjectZip, importFile } from "./zip.js";

/* ===== AI Rendering ===== */

function renderText(aiLog, text, role) {
  const div = document.createElement("div");
  div.className = role === "user" ? "chat-user" : "chat-ai";
  div.textContent = text;
  aiLog.appendChild(div);
}

function guessLang(code) {
  const t = code.trim();
  if (t.startsWith("<!DOCTYPE") || t.startsWith("<html") || t.includes("</")) return "html";
  if (t.includes("{") && t.includes("}") && (t.includes(":") || t.includes("background"))) return "css";
  return "js";
}

function renderCodeBlock(aiLog, codeText, langHint = "") {
  const wrap = document.createElement("div");
  wrap.className = "ai-code-wrap";

  const actions = document.createElement("div");
  actions.className = "ai-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "ai-btn";
  copyBtn.textContent = "Copy";
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(codeText);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy"), 900);
  };

  const lang = (langHint || guessLang(codeText)).toLowerCase();

  const insertBtn = document.createElement("button");
  insertBtn.className = "ai-btn";
  insertBtn.textContent = `Insert → ${lang.toUpperCase()}`;
  insertBtn.onclick = () => {
    if (lang === "html") setFile("html", codeText);
    else if (lang === "css") setFile("css", codeText);
    else setFile("js", codeText);

    setActiveTab(lang === "javascript" ? "js" : lang);
  };

  actions.appendChild(copyBtn);
  actions.appendChild(insertBtn);

  const code = document.createElement("code");
  code.className = "ai-code";
  code.textContent = codeText;

  wrap.appendChild(actions);
  wrap.appendChild(code);
  aiLog.appendChild(wrap);
}

function renderAIResponse(aiLog, text) {
  if (typeof text !== "string") {
    renderText(aiLog, "⚠️ AI returned nothing.", "ai");
    return;
  }

  text = text.replace(/\r\n/g, "\n");

  if ((text.match(/```/g) || []).length % 2 !== 0) {
    text += "\n```";
  }

  const parts = text.split("```");

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      const chunk = parts[i].trim();
      if (chunk) renderText(aiLog, chunk, "ai");
    } else {
      let lines = parts[i].split("\n");
      let langHint = lines[0]?.trim() || "";
      if (/^(html|css|js|javascript)$/i.test(langHint)) {
        lines.shift();
      } else {
        langHint = "";
      }
      renderCodeBlock(aiLog, lines.join("\n"), langHint);
    }
  }
}

/* ===== Init ===== */

function init() {
  initEditor();
  runSandbox();

  /* Run */
  document.getElementById("run").onclick = () => {
    saveCurrentFile();
    runSandbox();
  };

  /* Ctrl/Cmd + Enter */
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      saveCurrentFile();
      runSandbox();
    }
  });

  /* Tab inserts spaces */
  const codeArea = document.getElementById("code");
  codeArea.addEventListener("keydown", e => {
    if (e.key === "Tab") {
      e.preventDefault();
      const s = codeArea.selectionStart;
      codeArea.value =
        codeArea.value.slice(0, s) + "  " + codeArea.value.slice(codeArea.selectionEnd);
      codeArea.selectionStart = codeArea.selectionEnd = s + 2;
    }
  });

  /* Divider resize */
  const divider = document.getElementById("divider");
  let dragging = false;
  divider.onmousedown = () => (dragging = true);
  window.onmouseup = () => (dragging = false);
  window.onmousemove = e => {
    if (!dragging) return;
    const p = (e.clientX / window.innerWidth) * 100;
    document.getElementById("layout").style.gridTemplateColumns =
      `${p}% 6px ${100 - p}%`;
  };

  /* Console messages from iframe */
  window.addEventListener("message", e => {
    const consoleEl = document.getElementById("console");
    const data = e.data;

    if (!data || typeof data !== "object") return;
    if (!data.type || !Array.isArray(data.args)) return;

    const line = document.createElement("div");
    line.className = "console-" + data.type;

    line.textContent = data.args
      .map(v => {
        if (typeof v === "object") {
          try { return JSON.stringify(v, null, 2); }
          catch { return String(v); }
        }
        return String(v);
      })
      .join(" ");

    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  });

  /* Clear console */
  document.getElementById("clearConsole").onclick = () => {
    document.getElementById("console").textContent = "";
  };

  /* Copy Link (SHARE URL) */
  document.getElementById("copyLink").onclick = async () => {
    saveCurrentFile();
    const url = makeShareURL(); // ✅ SHARE URL
    await navigator.clipboard.writeText(url);
    alert("Link copied! Send it to your friend 😄");
  };

  /* Download ZIP */
  document.getElementById("downloadZip").onclick = () => {
    saveCurrentFile();
    downloadProjectZip();
  };

  /* Upload ZIP / file */
  const uploadInput = document.getElementById("uploadZip");
  document.getElementById("uploadZipBtn").onclick = () => uploadInput.click();

  uploadInput.onchange = async () => {
    const f = uploadInput.files?.[0];
    if (!f) return;

    try {
      await importFile(f);
      alert("Imported! Press Run ▶️");
    } catch (err) {
      alert("Import failed: " + (err?.message || err));
    } finally {
      uploadInput.value = "";
    }
  };

  /* AI input */
  const aiInput = document.getElementById("aiInput");
  const aiLog = document.getElementById("aiLog");

  aiInput.addEventListener("keydown", async e => {
    if (e.key !== "Enter") return;

    saveCurrentFile();

    const q = aiInput.value.trim();
    if (!q) return;
    aiInput.value = "";

    renderText(aiLog, "🧑 " + q, "user");
    aiLog.scrollTop = aiLog.scrollHeight;

    const reply = await askAI(q, files);
    renderAIResponse(aiLog, reply);
    aiLog.scrollTop = aiLog.scrollHeight;
  });

  /* Clear chat */
  document.getElementById("clearChat").onclick = () => {
    document.getElementById("aiLog").textContent =
      "🤖 AI ready. Ask about your code.";
  };
}

init();
