import { files } from "./editor.js";

export async function downloadProjectZip() {
  const { default: JSZip } = await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");
  const zip = new JSZip();

  zip.file("index.html", files.html);
  zip.file("style.css", files.css);
  zip.file("app.js", files.js);

  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "sandbox-project.zip";
  a.click();
}
