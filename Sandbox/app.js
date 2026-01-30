import { initEditor, saveCurrentFile, files, setActiveTab } from "./editor.js";
import { runSandbox } from "./sandbox.js";
import { askAI } from "./ai.js";
import { downloadProjectZip, importFile } from "./zip.js";

function init() {
  initEditor();
  runSandbox();

  document.getElementById("run").onclick = () => {
    saveCurrentFile();
    runSandbox();
  };

  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      saveCurrentFile();
      runSandbox();
    }
  });

  const divider = document.getElementById("divider");
  let drag = false;
  divider.onmousedown = () => drag = true;
  window.onmouseup = () => drag = false;
  window.onmousemove = e => {
    if (!drag) return;
    const p = (e.clientX / window.innerWidth) * 100;
    document.getElementById("layout").style.gridTemplateColumns =
      `${p}% 6px ${100 - p}%`;
  };

  window.addEventListener("message", e => {
    const c = document.getElementById("console");
    const d = e.data;
    if (!d || !d.type) return;

    c.style.display = "block";

    const div = document.createElement("div");
    div.className = "console-" + d.type;
    div.textContent = Array.isArray(d.args) ? d.args.join(" ") : "";
    c.appendChild(div);

    if (d.type === "error") setActiveTab("ai");
  });

  document.getElementById("clearConsole").onclick = () => {
    const c = document.getElementById("console");
    c.textContent = "";
    c.style.display = "none";
  };

  document.getElementById("downloadZip").onclick = downloadProjectZip;

  const upload = document.getElementById("uploadZip");
  document.getElementById("uploadZipBtn").onclick = () => upload.click();
  upload.onchange = async () => {
    await importFile(upload.files[0]);
    alert("Imported!");
    upload.value = "";
  };

  document.getElementById("copyLink").onclick = async () => {
    await navigator.clipboard.writeText(location.href);
    alert("Link copied!");
  };

  document.getElementById("clearChat").onclick = () => {
    document.getElementById("aiChat").innerHTML =
      '<div class="ai-bot">🤖 Ready again!</div>';
  };

  const aiInput = document.getElementById("aiInput");
  const aiChat = document.getElementById("aiChat");

  aiInput.addEventListener("keydown", async e => {
    if (e.key !== "Enter") return;
    const q = aiInput.value.trim();
    if (!q) return;
    aiInput.value = "";

    aiChat.innerHTML += `<div class="ai-user">${q}</div>`;
    const bot = document.createElement("div");
    bot.className = "ai-bot";
    bot.textContent = "Thinking…";
    aiChat.appendChild(bot);

    bot.textContent = await askAI(q, files);
  });
}

window.addEventListener("DOMContentLoaded", init);
