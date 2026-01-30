const WORKER_URL = "https://chatbot-ai.b4rjxr9lk.workers.dev/";
let history = [];

export async function askAI(message, files) {
  if (!message.trim()) return "";

  history.push({ role: "user", content: message });
  history = history.slice(-6);

  const fileList = [
    { name: "index.html", content: files.html },
    { name: "style.css", content: files.css },
    { name: "app.js", content: files.js }
  ];

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history,
        files: fileList
      })
    });

    const data = await res.json();
    const reply = typeof data.reply === "string" ? data.reply : "";

    history.push({ role: "assistant", content: reply });
    return reply;
  } catch (e) {
    return `❌ AI error: ${e.message}`;
  }
}
