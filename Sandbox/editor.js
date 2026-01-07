export const files = JSON.parse(localStorage.files || "null") || {
  html: "<h1>Hello Sandbox</h1>",
  css: "body{text-align:center}",
  js: "console.log('Ready')"
};

export function renderFiles() {
  const el = document.getElementById("files");
  el.innerHTML = "";

  Object.keys(files).forEach(name => {
    const d = document.createElement("div");
    d.textContent = name;
    d.onclick = () => {
      document.getElementById("files").dataset.current = name;
      document.getElementById("code").value = files[name];
    };
    el.appendChild(d);
  });
}

export function getCurrentFile() {
  return document.getElementById("files").dataset.current;
}

export function saveCurrentFile(type) {
  const name = getCurrentFile();
  if (name) {
    files[name] = document.getElementById("code").value;
    localStorage.files = JSON.stringify(files);
  }

  if (type === "zip") {
    const zip = new JSZip();
    Object.entries(files).forEach(([k,v]) => zip.file(k, v));
    zip.generateAsync({type:"blob"}).then(b=>{
      const a=document.createElement("a");
      a.href=URL.createObjectURL(b);
      a.download="project.zip";
      a.click();
    });
  }
}
