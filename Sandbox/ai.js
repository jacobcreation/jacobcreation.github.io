const WORKER_URL = "https://chatbot-ai.b4rjxr9lk.workers.dev/";

export async function askAI(message, files) {
  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, files })
  });

  const data = await res.json();
  return data.reply || "No reply";
}
