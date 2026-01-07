export function runSandbox() {
  const frame = document.getElementById("frame");
  frame.srcdoc = `
    <script>
    console.log = (...a)=>parent.postMessage(a.join(" "), "*");
    try { ${localStorage.js || ""} }
    catch(e){ parent.postMessage("ERR:"+e, "*"); }
    <\/script>
  `;
}
