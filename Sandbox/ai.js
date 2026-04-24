const WORKER_URL = "https://sandbox-ai.b4rjxr9lk.workers.dev/";

let history = [];

export async function askAI(message, files) {
  if (!message.trim()) return;

  const log = document.getElementById("aiLog");
  log.textContent += `\n\n🧑 ${message}\n🤖 Thinking…`;
  log.scrollTop = log.scrollHeight;

  history.push({ role: "user", content: message });
  history = history.slice(-6);

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history,
        files
      })
    });

    const data = await res.json();
    const reply = data.reply || "No reply.";

    log.textContent += `\n${reply}`;
    history.push({ role: "assistant", content: reply });
  } catch (e) {
    log.textContent += `\n❌ AI error: ${e.message}`;
  }

  log.scrollTop = log.scrollHeight;
}
