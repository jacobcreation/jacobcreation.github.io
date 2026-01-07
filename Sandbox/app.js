import { files, renderFiles, getCurrentFile, saveCurrentFile } from "./editor.js";
import { runSandbox } from "./sandbox.js";
import { askAI, fixWithAI, explainLastError } from "./ai.js";

function init() {
  console.log("Sandbox init");

  renderFiles();

  document.getElementById("run").addEventListener("click", () => {
    saveCurrentFile();
    runSandbox();
  });

  document.getElementById("zip").addEventListener("click", () => {
    saveCurrentFile();
    saveCurrentFile("zip");
  });

  document.getElementById("fix").addEventListener("click", fixWithAI);
  document.getElementById("explain").addEventListener("click", explainLastError);

  const aiInput = document.getElementById("aiInput");
  aiInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      askAI(aiInput.value);
      aiInput.value = "";
    }
  });

  // Load first file automatically
  const first = Object.keys(files)[0];
  document.getElementById("code").value = files[first];
  document.getElementById("files").dataset.current = first;

  runSandbox();
}

init();
