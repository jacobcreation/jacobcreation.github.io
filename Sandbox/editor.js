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
  saveCurrentFile();
  active = tab;

  document.querySelectorAll(".tab").forEach(t =>
    t.classList.toggle("active", t.dataset.tab === tab)
  );

  codeEl.value = files[tab];
}

export function saveCurrentFile() {
  files[active] = codeEl.value;
}
