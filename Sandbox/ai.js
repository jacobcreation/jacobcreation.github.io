const WORKER_URL = "https://sandbox-ai.b4rjxr9lk.workers.dev/";

let history = [];

export async function askAI(message, files) {
  if (!message.trim()) return "";

  history.push({ role: "user", content: message });
  history = history.slice(-6);

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history, files })
    });

    const data = await res.json();
    const reply = typeof data.reply === "string" ? data.reply : "";

    history.push({ role: "assistant", content: reply });
    return reply;
  } catch (e) {
    return `❌ AI error: ${e.message}`;
  }
}
