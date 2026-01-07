export const files = JSON.parse(localStorage.files || "{}") || {
  html: "<h1>Hello</h1>",
  css: "body{text-align:center}",
  js: "console.log('Ready')"
};

export function renderFiles() {
  const el = document.getElementById("files");
  el.innerHTML = "";
  Object.keys(files).forEach(f => {
    const d = document.createElement("div");
    d.textContent = f;
    d.onclick = () => {
      document.getElementById("code").value = files[f];
      el.dataset.current = f;
    };
    el.appendChild(d);
  });
}

export function saveFile(type) {
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
