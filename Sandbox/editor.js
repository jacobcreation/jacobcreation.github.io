export const files = {
  html: "<h1>Hello Sandbox</h1>",
  css: "body { text-align: center; }",
  js: "console.log('JS running');"
};

let current = "html";

export function renderFiles() {
  const list = document.getElementById("files");
  list.innerHTML = "";

  Object.keys(files).forEach(name => {
    const el = document.createElement("div");
    el.textContent = name.toUpperCase();
    el.onclick = () => selectFile(name);
    list.appendChild(el);
  });

  selectFile(current);
}

export function selectFile(name) {
  current = name;
  document.getElementById("code").value = files[name];
}

export function saveCurrentFile() {
  files[current] = document.getElementById("code").value;
}
