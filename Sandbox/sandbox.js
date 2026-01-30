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
<link rel="icon" href="data:,">
<style>${files.css}</style>
</head>
<body>
${files.html}
<script>
(function(){
  const send=(type,args)=>parent.postMessage({type,args},"*");
  ["log","warn","error"].forEach(t=>{
    const o=console[t];
    console[t]=(...a)=>{send(t,a);o(...a);}
  });
})();
<\/script>
<script>${files.js}<\/script>
</body>
</html>
`);
  doc.close();
}
