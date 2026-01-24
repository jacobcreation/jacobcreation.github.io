import { files, setFile, setActiveTab } from "./editor.js";

function normalizeName(name) {
  return name.replace(/\\/g, "/").split("/").pop().toLowerCase();
}

export async function downloadProjectZip() {
  const { default: JSZip } = await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");

  const zip = new JSZip();
  zip.file("index.html", files.html || "");
  zip.file("style.css", files.css || "");
  zip.file("app.js", files.js || "");
  zip.file(
    "README.txt",
    `Web Sandbox Export

Files:
- index.html (your HTML)
- style.css (your CSS)
- app.js (your JS)

Open index.html in a browser or use Live Server.`
  );

  const blob = await zip.generateAsync({ type: "blob" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "sandbox-project.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

export async function importFile(file) {
  const name = (file.name || "").toLowerCase();

  // Single file import
  if (name.endsWith(".html") || name.endsWith(".css") || name.endsWith(".js")) {
    const text = await file.text();

    if (name.endsWith(".html")) {
      setFile("html", text);
      setActiveTab("html");
    } else if (name.endsWith(".css")) {
      setFile("css", text);
      setActiveTab("css");
    } else {
      setFile("js", text);
      setActiveTab("js");
    }
    return;
  }

  // ZIP import
  if (name.endsWith(".zip")) {
    const { default: JSZip } = await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");
    const zip = await JSZip.loadAsync(file);

    let htmlText = null;
    let cssText = null;
    let jsText = null;

    for (const key in zip.files) {
      const entry = zip.files[key];
      if (entry.dir) continue;

      const base = normalizeName(entry.name);

      if (!htmlText && base.endsWith(".html")) htmlText = await entry.async("text");
      if (!cssText && base.endsWith(".css")) cssText = await entry.async("text");
      if (!jsText && base.endsWith(".js")) jsText = await entry.async("text");
    }

    if (htmlText != null) setFile("html", htmlText);
    if (cssText != null) setFile("css", cssText);
    if (jsText != null) setFile("js", jsText);

    setActiveTab("html");
    return;
  }

  throw new Error("Unsupported file type. Upload a .zip, .html, .css, or .js.");
}
