export const files = {
  html: "<h1>Hello Sandbox</h1>",
  css: "body { text-align: center; }",
  js: "console.log('JS running');"
};

let current = "html";

export function initEditor() {
  document.getElementById("code").value = files[current];

  document.querySelectorAll("#tabs button").forEach(btn => {
    btn.addEventListener("click", () => setFile(btn.dataset.file));
  });
}

export function setFile(name) {
  saveCurrentFile();
  current = name;
  document.getElementById("code").value = files[name];

  document.querySelectorAll("#tabs button").forEach(b =>
    b.classList.toggle("active", b.dataset.file === name)
  );
}

export function saveCurrentFile() {
  files[current] = document.getElementById("code").value;
}
