import {
    setFile,
    files
} from "./editor.js";
import {
    runSandbox
} from "./sandbox.js";

const WORKER_URL = "https://sandbox-ai.b4rjxr9lk.workers.dev/";
const MODEL_CATALOG_URL = "./cloudflare_worker/models.json";
const MODEL_STORAGE_KEY = "sandbox_ai_model_v1";
const DEFAULT_MODEL = "qwen/qwen3-next-80b-a3b-instruct";
const POPULAR_MODEL_IDS = [
    "qwen/qwen3-next-80b-a3b-instruct",
    "qwen/qwen3-next-80b-a3b-thinking",
    "qwen/qwen3.5-397b-a17b",
    "qwen/qwen3.5-122b-a10b",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "meta/llama-3.3-70b-instruct",
    "mistralai/mistral-large-3-675b-instruct-2512",
    "moonshotai/kimi-k2.6",
    "z-ai/glm-5.1"
];
const UNAVAILABLE_MODEL_IDS = new Set([
    "qwen/qwen3-coder-480b-a35b-instruct"
]);

// Stable session ID for this browser tab (server keeps the real history)
const SESSION_ID = "sandbox-" + Math.random().toString(36).slice(2, 10);
let availableModels = [];

// ── Render a chat bubble into #aiLog ─────────────────────────────────────────
function appendMessage(role, text) {
    const log = document.getElementById("aiLog");

    const bubble = document.createElement("div");
    bubble.className = "ai-bubble ai-" + role;

    const label = document.createElement("span");
    label.className = "ai-label";
    label.textContent = role === "user" ? "🧑 You" : "🤖 AiCoder";

    const body = document.createElement("div");
    body.className = "ai-body";

    body.innerHTML = formatAIText(text);

    bubble.appendChild(label);
    bubble.appendChild(body);
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
}

function formatAIText(text) {
    // Escape HTML first
    const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Replace ```lang\n...\n``` with styled code blocks
    return escaped
        .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
            return `<pre class="ai-code"><code>${code.trim()}</code></pre>`;
        })
        .replace(/`([^`]+)`/g, '<code class="ai-inline">$1</code>')
        .replace(/\n/g, "<br>");
}

let sandboxHistory = [];
const UPDATE_FENCE_REGEX = /```(?:json)?\s*([\s\S]*?)\s*```/g;

function modelLooksChatReady(id) {
    const lower = String(id || "").toLowerCase();
    if (!lower) return false;
    if (
        UNAVAILABLE_MODEL_IDS.has(lower) ||
        lower.includes("embed") ||
        lower.includes("detector") ||
        lower.includes("reward") ||
        lower.includes("safety") ||
        lower.includes("guard") ||
        lower.includes("parse") ||
        lower.includes("translate") ||
        lower.includes("ocr")
    ) {
        return false;
    }
    return true;
}

function modelLabel(id) {
    const parts = String(id || "").split("/");
    const provider = parts[0] || "model";
    const name = parts[1] || parts[0] || "unknown";
    return `${name} (${provider})`;
}

function getSelectedModel() {
    const select = document.getElementById("aiModelSelect");
    return select?.value || localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL;
}

function setSelectedModel(model) {
    const select = document.getElementById("aiModelSelect");
    if (select) select.value = model;
    localStorage.setItem(MODEL_STORAGE_KEY, model);
}

function renderModelOptions(modelList, filterText = "") {
    const select = document.getElementById("aiModelSelect");
    if (!select) return;

    const current = getSelectedModel();
    const filter = filterText.trim().toLowerCase();
    const filtered = modelList.filter((model) => {
        const hay = `${model.id} ${model.owned_by || ""}`.toLowerCase();
        return hay.includes(filter);
    });

    const popular = filtered.filter((model) => POPULAR_MODEL_IDS.includes(model.id));
    const other = filtered.filter((model) => !POPULAR_MODEL_IDS.includes(model.id));

    const groups = [];
    if (popular.length) {
        groups.push(
            `<optgroup label="Popular">${popular.map((model) => `<option value="${model.id}">${modelLabel(model.id)}</option>`).join("")}</optgroup>`
        );
    }
    if (other.length) {
        groups.push(
            `<optgroup label="More models">${other.map((model) => `<option value="${model.id}">${modelLabel(model.id)}</option>`).join("")}</optgroup>`
        );
    }
    if (!groups.length) {
        groups.push(`<option value="${current}">${modelLabel(current)}</option>`);
    }

    select.innerHTML = groups.join("");

    const hasCurrent = filtered.some((model) => model.id === current);
    if (hasCurrent) {
        select.value = current;
    } else if (filtered.length) {
        setSelectedModel(filtered[0].id);
    } else {
        select.value = current;
    }
}

async function loadModelCatalog() {
    const select = document.getElementById("aiModelSelect");
    const search = document.getElementById("aiModelSearch");
    if (!select || !search) return;

    try {
        const res = await fetch(MODEL_CATALOG_URL, { cache: "no-store" });
        const data = await res.json();
        availableModels = (Array.isArray(data?.data) ? data.data : [])
            .filter((model) => modelLooksChatReady(model.id))
            .sort((a, b) => a.id.localeCompare(b.id));
    } catch {
        availableModels = [{ id: DEFAULT_MODEL, owned_by: "qwen" }];
    }

    const saved = localStorage.getItem(MODEL_STORAGE_KEY);
    setSelectedModel(saved || DEFAULT_MODEL);
    renderModelOptions(availableModels);

    search.addEventListener("input", () => {
        renderModelOptions(availableModels, search.value);
    });

    select.addEventListener("change", () => {
        localStorage.setItem(MODEL_STORAGE_KEY, select.value);
    });
}

export async function initAIControls() {
    await loadModelCatalog();
}

function findJsonObjectBounds(text, marker = '"updateSandbox"') {
    const markerIndex = text.indexOf(marker);
    if (markerIndex === -1) return null;

    let start = text.lastIndexOf("{", markerIndex);
    while (start !== -1) {
        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = start; i < text.length; i += 1) {
            const ch = text[i];
            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (ch === "\\") {
                    escaped = true;
                } else if (ch === '"') {
                    inString = false;
                }
                continue;
            }

            if (ch === '"') {
                inString = true;
                continue;
            }
            if (ch === "{") depth += 1;
            if (ch === "}") {
                depth -= 1;
                if (depth === 0) {
                    return [start, i + 1];
                }
            }
        }

        start = text.lastIndexOf("{", start - 1);
    }

    return null;
}

function extractSandboxUpdate(text) {
    const candidates = [];

    for (const match of text.matchAll(UPDATE_FENCE_REGEX)) {
        candidates.push(match[1]);
    }

    const rawBounds = findJsonObjectBounds(text);
    if (rawBounds) {
        candidates.push(text.slice(rawBounds[0], rawBounds[1]));
    }

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && parsed.updateSandbox === true) {
                return parsed;
            }
        } catch {}
    }

    return null;
}

function stripSandboxUpdateBlocks(text) {
    let cleaned = text.replace(UPDATE_FENCE_REGEX, (full, inner) => {
        try {
            const parsed = JSON.parse(inner);
            if (parsed && parsed.updateSandbox === true) return "";
        } catch {}
        return full;
    });

    const rawBounds = findJsonObjectBounds(cleaned);
    if (rawBounds) {
        const raw = cleaned.slice(rawBounds[0], rawBounds[1]);
        try {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.updateSandbox === true) {
                cleaned = cleaned.slice(0, rawBounds[0]) + cleaned.slice(rawBounds[1]);
            }
        } catch {}
    }

    return cleaned.trim();
}

function applySandboxUpdate(update) {
    const changedFiles = [];

    for (const key of ["html", "css", "js"]) {
        if (typeof update[key] === "string") {
            files[key] = update[key];
            changedFiles.push(key.toUpperCase());
        }
    }

    return changedFiles;
}

export async function askAI(message, currentFiles) {
    if (!message.trim()) return;

    sandboxHistory.push({
        role: "user",
        content: message
    });
    appendMessage("user", message);

    // Create an empty AI bubble to stream into
    const aiBubble = appendMessage("ai", "");
    const bodyEl = aiBubble.querySelector(".ai-body");
    aiBubble.classList.add("ai-thinking");

    try {
        const selectedModel = getSelectedModel();
        const res = await fetch(WORKER_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                sessionId: SESSION_ID,
                message,
                model: selectedModel,
                history: sandboxHistory,
                files: currentFiles,
                stream: true,
            }),
        });

        if (!res.ok) {
            let details = `HTTP ${res.status}`;
            try {
                const errorData = await res.json();
                details = errorData.error || errorData.reply || details;
            } catch {
                try {
                    const errorText = await res.text();
                    if (errorText) details = errorText;
                } catch {}
            }
            throw new Error(details);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let reply = "";
        let didUpdate = false;
        let buffer = "";
        let changedFiles = [];

        aiBubble.classList.remove("ai-thinking");

        while (true) {
            const {
                done,
                value
            } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, {
                stream: true
            });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith("data: ") && line.trim() !== "data: [DONE]") {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.response) {
                            reply += data.response;

                            let displayReply = reply;
                            if (/```(?:json)?[\s\S]*"updateSandbox"\s*:\s*true/i.test(displayReply)) {
                                displayReply =
                                    displayReply.replace(/```(?:json)?[\s\S]*$/i, "").trim() +
                                    "\n\n*(Applying code changes...)*";
                            }
                            bodyEl.innerHTML = formatAIText(displayReply);
                            aiBubble.parentElement.scrollTop =
                                aiBubble.parentElement.scrollHeight;
                        }
                    } catch (e) {}
                }
            }
        }

        if (buffer.startsWith("data: ") && buffer.trim() !== "data: [DONE]") {
            try {
                const data = JSON.parse(buffer.slice(6));
                if (data.response) {
                    reply += data.response;
                }
            } catch (e) {}
        }

        const update = extractSandboxUpdate(reply);
        let cleanedReply = stripSandboxUpdateBlocks(reply);
        if (update) {
            changedFiles = applySandboxUpdate(update);
            didUpdate = changedFiles.length > 0;
            const summary = changedFiles.length
                ? `Applied changes to ${changedFiles.join(", ")}.`
                : "Applied sandbox changes.";
            cleanedReply = cleanedReply
                ? `${cleanedReply}\n\n${summary}`
                : summary;
        }

        bodyEl.innerHTML = formatAIText(cleanedReply);
        sandboxHistory.push({
            role: "assistant",
            content: cleanedReply || reply
        });

        if (didUpdate) {
            const activeFile = document.querySelector("#tabs button.active").dataset
                .file;
            // Prevent saveCurrentFile() from overwriting the AI's new code with the old textarea content
            if (activeFile !== "ai") {
                document.getElementById("code").value = files[activeFile];
            }
            setFile(activeFile);
            runSandbox();
        }
    } catch (e) {
        aiBubble.classList.remove("ai-thinking");
        bodyEl.innerHTML = formatAIText("❌ Error: " + e.message);
    }
}
