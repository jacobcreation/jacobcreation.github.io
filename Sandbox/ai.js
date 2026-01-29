const WORKER_URL = "https://chatbot-ai.b4rjxr9lk.workers.dev/";
let history = [];

export async function askAI(message, files) {
  history.push({ role: "user", content: message });
  history = history.slice(-6);

  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, files })
  });

  const data = await res.json();
  history.push({ role: "assistant", content: data.reply });
  return data.reply;
}
