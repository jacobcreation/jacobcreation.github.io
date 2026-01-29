import { files } from "./editor.js";

export function runSandbox() {
  const iframe = document.getElementById("preview");
  const doc = iframe.contentDocument;

  doc.open();
  doc.write(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>${files.css}</style>
</head>
<body>
${files.html}

<script>
(function(){
  const send = (type, args) =>
    parent.postMessage({ type, args }, "*");

  ["log","warn","error"].forEach(t=>{
    const o = console[t];
    console[t] = (...a)=>{ send(t,a); o(...a); };
  });

  window.onerror = (m,s,l,c)=>
    send("error",[m+" ("+l+":"+c+")"]);
})();
<\/script>

<script>${files.js}<\/script>
</body>
</html>
  `);
  doc.close();
}
