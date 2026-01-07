const WORKER_URL = "https://sandbox-ai.b4rjxr9lk.workers.dev/";

let history = [];
let typing = false;

/**
 * Typewriter effect
 */
async function typeText(el, text, speed = 18) {
  typing = true;
  for (let i = 0; i < text.length; i++) {
    el.textContent += text[i];
    el.scrollTop = el.scrollHeight;
    await new Promise(r => setTimeout(r, speed));
  }
  typing = false;
}

export async function askAI(message, files) {
  if (!message.trim() || typing) return;

  const log = document.getElementById("aiLog");

  // User message
  log.textContent += `\n\n🧑 ${message}\n🤖 `;
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
    const reply = data.reply || "…";

    // Type the reply instead of dumping it
    await typeText(log, reply);

    history.push({ role: "assistant", content: reply });

  } catch (e) {
    log.textContent += `❌ AI error: ${e.message}`;
  }

  log.scrollTop = log.scrollHeight;
}
