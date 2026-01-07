import { files, renderFiles, saveFile } from "./editor.js";
import { runSandbox } from "./sandbox.js";
import { askAI, fixWithAI, explainLastError } from "./ai.js";

renderFiles();

document.getElementById("run").onclick = runSandbox;
document.getElementById("zip").onclick = () => saveFile("zip");
document.getElementById("fix").onclick = fixWithAI;
document.getElementById("explain").onclick = explainLastError;

document.getElementById("aiInput").onkeydown = e => {
  if (e.key === "Enter") askAI(e.target.value);
};
