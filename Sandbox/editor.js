export const files = {
  html: "<h1>Hello Sandbox</h1>",
  css: "body { text-align: center; }",
  js: "console.log('JS running');"
};

let current = "html";

export function initEditor() {
  document.getElementById("code").value = files[current];

  document.querySelectorAll("#tabs button").forEach(btn => {
    btn.addEventListener("click", () => setTab(btn.dataset.file));
  });
}

export function setTab(name) {
  saveCurrentFile();

  const code = document.getElementById("code");
  const ai = document.getElementById("aiPanel");

  code.hidden = name === "ai";
  ai.hidden = name !== "ai";

  if (name !== "ai") {
    current = name;
    code.value = files[name];
  }

  document.querySelectorAll("#tabs button").forEach(b =>
    b.classList.toggle("active", b.dataset.file === name)
  );
}

export function saveCurrentFile() {
  if (current !== "ai") {
    files[current] = document.getElementById("code").value;
  }
}
