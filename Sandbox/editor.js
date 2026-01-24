export const files = {
  html: `<h1>Hello Sandbox 👋</h1>
<p>Edit HTML/CSS/JS then press Run.</p>
<button onclick="console.log('clicked!')">Click me</button>`,
  css: `body { font-family: system-ui; padding: 16px; }`,
  js: `console.log("Sandbox ready!");
console.warn("This is a warning");
console.error("This is an error");`
};

let current = "html";

export function initEditor() {
  loadFromLocalStorage();
  loadFromURLIfPresent();

  const code = document.getElementById("code");
  code.value = files[current];

  document.querySelectorAll("#tabs button").forEach(btn => {
    btn.onclick = () => {
      saveCurrentFile();
      setActiveTab(btn.dataset.file);
    };
  });

  updateTabUI();
}

export function saveCurrentFile() {
  const code = document.getElementById("code");
  if (current === "ai") return;
  files[current] = code.value;
  saveToLocalStorage();
}

export function setActiveTab(name) {
  current = name;

  const code = document.getElementById("code");
  const aiPanel = document.getElementById("aiPanel");
  const consoleEl = document.getElementById("console");

  if (name === "ai") {
    code.hidden = true;
    aiPanel.hidden = false;
    consoleEl.hidden = true;
  } else {
    code.hidden = false;
    aiPanel.hidden = true;
    consoleEl.hidden = false;
    code.value = files[name];
  }

  updateTabUI();
}

export function setFile(name, content) {
  if (!(name in files)) return;
  files[name] = content;
  saveToLocalStorage();

  if (current === name) {
    document.getElementById("code").value = content;
  }
}

function updateTabUI() {
  document.querySelectorAll("#tabs button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.file === current);
  });
}

/* ===== LocalStorage ===== */

function saveToLocalStorage() {
  localStorage.setItem("sandbox_files", JSON.stringify(files));
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem("sandbox_files");
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved && typeof saved === "object") {
      if (typeof saved.html === "string") files.html = saved.html;
      if (typeof saved.css === "string") files.css = saved.css;
      if (typeof saved.js === "string") files.js = saved.js;
    }
  } catch { }
}

/* ===== Share Link ===== */

export function makeShareURL() {
  const payload = { h: files.html, c: files.css, j: files.js };
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  const url = new URL(location.href);
  url.searchParams.set("s", encoded);
  return url.toString();
}

function loadFromURLIfPresent() {
  const url = new URL(location.href);
  const s = url.searchParams.get("s");
  if (!s) return;

  try {
    const json = decodeURIComponent(escape(atob(s)));
    const payload = JSON.parse(json);

    if (payload && typeof payload === "object") {
      if (typeof payload.h === "string") files.html = payload.h;
      if (typeof payload.c === "string") files.css = payload.c;
      if (typeof payload.j === "string") files.js = payload.j;
    }
  } catch { }
}
