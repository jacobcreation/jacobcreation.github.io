// ===== IMPORTS =====
import { initEditor, saveCurrentFile, files } from "./editor.js";
import { runSandbox } from "./sandbox.js";
import { askAI } from "./ai.js";
import { downloadProjectZip } from "./zip.js";

// ===== INIT =====
function init() {
  initEditor();
  runSandbox();
  // Hide console at start
  const consoleEl = document.getElementById("console");
  consoleEl.style.display = "none";


  // ===== RUN BUTTON =====
  const runBtn = document.getElementById("run");
  runBtn.onclick = () => {
    saveCurrentFile();
    runSandbox();
  };

  // ===== DOWNLOAD ZIP =====
  const zipBtn = document.getElementById("downloadZip");
  zipBtn.onclick = () => {
    saveCurrentFile();
    downloadProjectZip();
  };

  // ===== AI CHAT =====
  const aiInput = document.getElementById("aiInput");
  const aiChat = document.getElementById("aiChat");

  aiInput.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;

    const message = aiInput.value.trim();
    if (!message) return;

    aiInput.value = "";

    // user bubble
    const userDiv = document.createElement("div");
    userDiv.className = "ai-user";
    userDiv.textContent = message;
    aiChat.appendChild(userDiv);

    aiChat.scrollTop = aiChat.scrollHeight;

    // bot bubble
    const botDiv = document.createElement("div");
    botDiv.className = "ai-bot";
    botDiv.textContent = "Thinking…";
    aiChat.appendChild(botDiv);

    aiChat.scrollTop = aiChat.scrollHeight;

    try {
      const reply = await askAI(message, files);
      botDiv.textContent = reply || "🤖 (no reply)";
    } catch (err) {
      botDiv.textContent = "❌ AI error: " + err.message;
    }

    aiChat.scrollTop = aiChat.scrollHeight;
  });
}

// ===== START APP =====
window.addEventListener("DOMContentLoaded", init);


/* ===== CONSOLE BRIDGE ===== */
window.addEventListener("message", e => {
  const c = document.getElementById("console");
  const data = e.data;

  if (!data || !data.type) return;

  c.style.display = "block";

  const div = document.createElement("div");
  div.className = "console-" + data.type;

  // ✅ FIX FOR LINE 91
  const text = Array.isArray(data.args)
    ? data.args.map(v =>
      typeof v === "object"
        ? JSON.stringify(v, null, 2)
        : String(v)
    ).join(" ")
    : "";

  div.textContent = text;
  c.appendChild(div);
  c.scrollTop = c.scrollHeight;
});



const text = args.join(" ");
const line = document.createElement("div");
line.className = "console-" + type;
line.textContent = text;

/* ERROR ACTIONS */
if (type === "error") {
  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "6px";
  actions.style.marginTop = "4px";

  /* Explain */
  const explainBtn = document.createElement("button");
  explainBtn.textContent = "Explain 🤖";
  explainBtn.onclick = async () => {
    addChatUser("Explain this error:\n" + text);
    const bubble = addChatBot("Thinking…");
    const reply = await askAI(
      "Explain this JavaScript error in simple terms:\n" + text,
      files
    );
    bubble.textContent = reply;
  };

  /* Fix */
  const fixBtn = document.createElement("button");
  fixBtn.textContent = "Fix 🛠️";
  fixBtn.onclick = async () => {
    addChatUser("Fix this error:\n" + text);
    const bubble = addChatBot("Fixing…");

    const reply = await askAI(
      "Fix this error. Return FULL corrected code using code blocks. " +
      "Use HTML, CSS, and JavaScript as needed.\n\nError:\n" + text,
      files
    );

    bubble.textContent = reply;

    const match = reply.match(/```([\s\S]*?)```/);
    if (match) {
      const code = match[1].trim();

      const insertActions = document.createElement("div");
      insertActions.style.display = "flex";
      insertActions.style.gap = "6px";

      ["html", "css", "js"].forEach(tab => {
        const btn = document.createElement("button");
        btn.textContent = `Insert → ${tab.toUpperCase()}`;
        btn.onclick = () => insertIntoTab(tab, code);
        insertActions.appendChild(btn);
      });

      bubble.appendChild(insertActions);
    }
  };

  actions.appendChild(explainBtn);
  actions.appendChild(fixBtn);
  line.appendChild(actions);
}

consoleEl.appendChild(line);
consoleEl.scrollTop = consoleEl.scrollHeight;


/* Clear console */
document.getElementById("clearConsole").onclick = () => {
  document.getElementById("console").textContent = "";
};

/* ===== ZIP ===== */
document.getElementById("downloadZip").onclick = () => {
  saveCurrentFile();
  downloadProjectZip();
};

const uploadInput = document.getElementById("uploadZip");
const uploadBtn = document.getElementById("uploadZipBtn");

if (uploadBtn && uploadInput) {
  uploadBtn.onclick = () => uploadInput.click();
  uploadInput.onchange = async () => {
    if (!uploadInput.files?.[0]) return;
    await importFile(uploadInput.files[0]);
    uploadInput.value = "";
    alert("Imported! Press Run ▶️");
  };
}

/* Copy link */
const copyBtn = document.getElementById("copyLink");
if (copyBtn) {
  copyBtn.onclick = async () => {
    await navigator.clipboard.writeText(location.href);
    alert("Link copied!");
  };
}

/* ===== DIVIDER RESIZE ===== */
const divider = document.getElementById("divider");
let dragging = false;

divider.onmousedown = () => dragging = true;
window.onmouseup = () => dragging = false;
window.onmousemove = e => {
  if (!dragging) return;
  const p = (e.clientX / window.innerWidth) * 100;
  document.getElementById("layout").style.gridTemplateColumns =
    `${p}% 6px ${100 - p}%`;
};

/* ===== AI CHAT INPUT ===== */
const aiInput = document.getElementById("aiInput");

aiInput.addEventListener("keydown", async e => {
  if (e.key !== "Enter") return;

  const q = aiInput.value.trim();
  if (!q) return;
  aiInput.value = "";

  addChatUser(q);
  const bubble = addChatBot("Thinking…");

  const reply = await askAI(q, files);
  bubble.textContent = reply;

  const match = reply.match(/```([\s\S]*?)```/);
  if (match) {
    const code = match[1].trim();

    const insertActions = document.createElement("div");
    insertActions.style.display = "flex";
    insertActions.style.gap = "6px";

    ["html", "css", "js"].forEach(tab => {
      const btn = document.createElement("button");
      btn.textContent = `Insert → ${tab.toUpperCase()}`;
      btn.onclick = () => insertIntoTab(tab, code);
      insertActions.appendChild(btn);
    });

    bubble.appendChild(insertActions);
  }
});


/* INIT ONCE */
window.addEventListener("DOMContentLoaded", init);
