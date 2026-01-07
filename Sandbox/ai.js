const WORKER = "https://sandbox-ai.b4rjxr9lk.workers.dev/";

let history = [];

export async function askAI(message) {
  history.push({role:"user",content:message});
  const res = await fetch(WORKER,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ message, history, files: JSON.parse(localStorage.files||"{}") })
  });
  const data = await res.json();
  history.push({role:"assistant",content:data.reply});
  log(data.reply);
}

export function fixWithAI() {
  askAI("Fix my code and explain changes.");
}

export function explainLastError() {
  askAI("Explain the last error and how to fix it.");
}

function log(t){
  const el=document.getElementById("aiLog");
  el.textContent+="\n"+t;
  el.scrollTop=el.scrollHeight;
}
