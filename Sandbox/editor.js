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

  saveCurrentFile();

  if (tab === "ai") {
    codeEl.style.display = "none";
    aiPanel.style.display = "flex";
    setTimeout(() => document.getElementById("aiInput")?.focus(), 0);
    return;
  }

  aiPanel.style.display = "none";
  codeEl.style.display = "block";
  active = tab;
  codeEl.value = files[tab];
}

export function saveCurrentFile() {
  if (files[active] !== undefined) {
    files[active] = codeEl.value;
  }
}
