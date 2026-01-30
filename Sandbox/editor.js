export const files = {
  html: "<h1>Hello Jacob</h1>",
  css: "body { font-family: sans-serif; }",
  js: "console.log('JS running');"
};

let active = "html";
let codeEl;

export function initEditor() {
  codeEl = document.getElementById("code");
  codeEl.value = files[active];

  document.querySelectorAll(".tab").forEach(tab => {
    tab.onclick = () => setActiveTab(tab.dataset.tab);
  });
}

export function setActiveTab(tab) {
  const aiPanel = document.getElementById("aiPanel");

  document.querySelectorAll(".tab").forEach(t =>
    t.classList.toggle("active", t.dataset.tab === tab)
  );

  // AI TAB
  if (tab === "ai") {
    saveCurrentFile();
    if (codeEl) codeEl.style.display = "none";
    aiPanel.style.display = "flex";
    return;
  }

  // CODE TABS
  saveCurrentFile();
  aiPanel.style.display = "none";
  if (codeEl) codeEl.style.display = "block";

  active = tab;
  if (codeEl) codeEl.value = files[tab] ?? "";
}

export function saveCurrentFile() {
  if (!codeEl) return;
  if (files[active] === undefined) return;
  files[active] = codeEl.value;
}
