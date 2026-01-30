import { files, setActiveTab } from "./editor.js";

export async function downloadProjectZip() {
  const JSZip = (await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm")).default;
  const zip = new JSZip();
  zip.file("index.html", files.html);
  zip.file("style.css", files.css);
  zip.file("app.js", files.js);

  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "sandbox.zip";
  a.click();
}

export async function importFile(file) {
  const text = await file.text();
  if (file.name.endsWith(".html")) files.html = text;
  if (file.name.endsWith(".css")) files.css = text;
  if (file.name.endsWith(".js")) files.js = text;
  setActiveTab("html");
}
