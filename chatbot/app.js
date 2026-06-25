    const ENDPOINT = "https://chatbot-ai.b4rjxr9lk.workers.dev/";
    const SITE_NAME = "jacobcreation";

    const chatBody = document.getElementById("chatBody");
    const chatForm = document.getElementById("chatForm");
    const chatText = document.getElementById("chatText");

    const imgBtn = document.getElementById("uploadImgBtn");
    const imgFile = document.getElementById("imgFileInput");
    const fileBtn = document.getElementById("uploadFileBtn");
    const docFile = document.getElementById("docFileInput");
    const clearBtn = document.getElementById("clearChatBtn");
    const newChatBtn = document.getElementById("newChatBtn");
    const cloudChatsBtn = document.getElementById("cloudChatsBtn");
    const cloudChatsPanel = document.getElementById("cloudChatsPanel");
    const cloudChatsList = document.getElementById("cloudChatsList");
    const cloudChatsStatus = document.getElementById("cloudChatsStatus");
    const syncCloudChatBtn = document.getElementById("syncCloudChatBtn");
    const composerAttachment = document.getElementById("composerAttachment");
    const composerAttachmentImg = document.getElementById("composerAttachmentImg");
    const composerAttachmentName = document.getElementById("composerAttachmentName");
    const removeAttachmentBtn = document.getElementById("removeAttachmentBtn");
    const modelSelect = document.getElementById("modelSelect");
    const modelSearch = document.getElementById("modelSearch");
    const presetSelect = document.getElementById("presetSelect");
    const replyLengthSelect = document.getElementById("replyLengthSelect");
    const webSearchSelect = document.getElementById("webSearchSelect");
    const memoryNoteInput = document.getElementById("memoryNoteInput");
    const quickPrompts = document.getElementById("quickPrompts");

    const SETTINGS_KEY = "jc_chatbot_settings_v2";
    const CHAT_APP_ID = "chatbot";
    const CLIENT_ID_KEY = "jc_chatbot_client_id";
    const UPLOAD_LIMIT_KEY = "jc_chatbot_upload_day";
    const ATTACHMENT_MODEL_FALLBACK = "gemini-2.5-flash";
    const WEB_SEARCH_AUTO_RE = /\b(latest|current|today|tonight|yesterday|tomorrow|this week|this month|this year|news|headline|recent|new|now|live|price|stock|weather|schedule|score|release date|version|update|verify|fact check|look up|search|web|internet|browse|who is|what is|where is|when is|which|compare|best|top|review|available|released|changed)\b/i;
    const WEB_SEARCH_SKIP_RE = /\b(remember this|save to memory|call me|my name is|clear chat|new chat|download memory|upload memory|make|generate|create|write|export|build)\b/i;
    const LEGACY_MODEL_REDIRECTS = {
      "cerebras/qwen-3-235b-a22b-instruct-2507": "cerebras/gpt-oss-120b",
      "@cf/mistral/mistral-small-3.1-24b-instruct": "@cf/mistralai/mistral-small-3.1-24b-instruct",
      "@cf/mistralai/mistral-7b-instruct-v0.2-lora": "@cf/mistral/mistral-7b-instruct-v0.2-lora",
      "@cf/qwen/qwen2.5-72b-instruct": "@cf/qwen/qwen3-30b-a3b-fp8",
      "@cf/deepseek-ai/deepseek-r1-distill-llama-70b": "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b"
    };
    let currentAttachment = null;
    const allModelOptions = Array.from(modelSelect.querySelectorAll("option")).map((option) => ({
      value: option.value,
      label: option.textContent,
      group: option.parentElement?.label || "Models"
    }));

    function normalizeModelSelection(value) {
      return LEGACY_MODEL_REDIRECTS[value] || value;
    }

    restoreSettings();
    loadHistory();

    function restoreSettings() {
      try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
        if (saved.model) modelSelect.value = normalizeModelSelection(saved.model);
        if (saved.preset) presetSelect.value = saved.preset;
        if (saved.replyLength) replyLengthSelect.value = saved.replyLength;
        if (saved.webSearchMode) webSearchSelect.value = saved.webSearchMode;
        saveSettings();
      } catch (error) {
        console.warn("Failed to restore chatbot settings", error);
      }
    }

    function saveSettings() {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        model: normalizeModelSelection(modelSelect.value),
        preset: presetSelect.value,
        replyLength: replyLengthSelect.value,
        webSearchMode: webSearchSelect.value
      }));
    }

    function getSessionId() {
      let id = localStorage.getItem("jc_session");
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("jc_session", id);
      }
      return id;
    }

    function setSessionId(id) {
      localStorage.setItem("jc_session", id);
    }

    function getClientId() {
      let id = localStorage.getItem(CLIENT_ID_KEY);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(CLIENT_ID_KEY, id);
      }
      return id;
    }

    function getUtcDayStamp() {
      return new Date().toISOString().slice(0, 10);
    }

    function hasUsedDailyUpload() {
      return localStorage.getItem(UPLOAD_LIMIT_KEY) === getUtcDayStamp();
    }

    function markDailyUploadUsed() {
      localStorage.setItem(UPLOAD_LIMIT_KEY, getUtcDayStamp());
    }

    function getAttachmentModelSelection() {
      const selected = normalizeModelSelection(modelSelect?.value || "");
      if (selected.startsWith("gemini-")) {
        return selected;
      }
      return ATTACHMENT_MODEL_FALLBACK;
    }

    function willLikelySearchWeb(message, attachment = null) {
      if (attachment) return false;
      const mode = webSearchSelect?.value || "auto";
      const text = String(message || "").trim();
      if (!text) return false;
      if (mode === "on") return true;
      if (mode === "off") return false;
      if (WEB_SEARCH_SKIP_RE.test(text)) return false;
      if (WEB_SEARCH_AUTO_RE.test(text)) return true;
      if (/\?/.test(text) && text.length >= 18) return true;
      return /\b(what|who|where|when|why|how|is|are|does|do|can)\b/i.test(text) && text.split(/\s+/).length >= 5;
    }

    function getAccountsApi() {
      return window.JacobAccounts || null;
    }

    function isAccountSignedIn() {
      const api = getAccountsApi();
      return Boolean(api && typeof api.isSignedIn === "function" && api.isSignedIn());
    }

    function renderMarkdown(text) {
      if (window.marked && typeof window.marked.parse === "function") {
        return window.marked.parse(text);
      }
      const escaped = String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
      return escaped.replace(/\n/g, "<br>");
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function addBubble(text, who = "bot", typing = false, attachment = null) {
      const div = document.createElement("div");
      div.className = `bubble ${who}`;
      
      if (who === "bot") {
          if (typing) {
              div.innerHTML = "";
              chatBody.appendChild(div);
              let i = 0;
              const words = text.split(" ");
              const interval = setInterval(() => {
                  if (i < words.length) {
                      div.innerHTML = renderMarkdown(words.slice(0, i + 1).join(" "));
                      div.querySelectorAll("p").forEach(p => p.style.margin = "0 0 10px 0");
                      chatBody.scrollTop = chatBody.scrollHeight;
                      i++;
                  } else {
                      clearInterval(interval);
                  }
              }, 40);
          } else {
              div.innerHTML = renderMarkdown(text);
              div.querySelectorAll("p").forEach(p => p.style.margin = "0 0 10px 0");
              chatBody.appendChild(div);
          }
      } else {
          if (attachment && attachment.dataUrl) {
            const img = document.createElement("img");
            img.className = "bubble-attachment";
            img.src = attachment.dataUrl;
            img.alt = attachment.name ? `Attached image: ${attachment.name}` : "Attached image";
            div.appendChild(img);
          }

          const textNode = document.createElement("div");
          textNode.className = "bubble-text";
          textNode.innerText = text;
          div.appendChild(textNode);
          chatBody.appendChild(div);
      }
      
      chatBody.scrollTop = chatBody.scrollHeight;
      return div;
    }

    function formatBytes(bytes) {
      const value = Number(bytes) || 0;
      if (value < 1024) return `${value} B`;
      if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
      return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }

    function base64ToBlob(base64, mimeType) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mimeType || "application/octet-stream" });
    }

    async function downloadGeneratedFile(fileId, button) {
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "Downloading";
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "downloadGeneratedFile",
            sessionId: getSessionId(),
            fileId
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not download file.");
        const blob = base64ToBlob(data.contentBase64, data.mimeType);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.name || "jacobbot-file.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        addBubble(`Download failed: ${error.message}`, "bot");
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    }

    function addGeneratedFileCards(files) {
      if (!Array.isArray(files) || files.length === 0) return;
      const wrap = document.createElement("div");
      wrap.className = "generated-files";
      files.forEach((file) => {
        const row = document.createElement("div");
        row.className = "generated-file";

        const meta = document.createElement("div");
        meta.className = "generated-file-meta";

        const name = document.createElement("div");
        name.className = "generated-file-name";
        name.textContent = file.name || "Generated file";

        const note = document.createElement("div");
        note.className = "generated-file-note";
        const expires = file.expiresAt ? new Date(file.expiresAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "24 hours";
        note.textContent = `${file.mimeType || "file"} • ${formatBytes(file.size)} • expires ${expires}`;

        const btn = document.createElement("button");
        btn.className = "generated-file-download";
        btn.type = "button";
        btn.textContent = "Download";
        btn.addEventListener("click", () => downloadGeneratedFile(file.id, btn));

        meta.appendChild(name);
        meta.appendChild(note);
        row.appendChild(meta);
        row.appendChild(btn);
        wrap.appendChild(row);
      });
      chatBody.appendChild(wrap);
      chatBody.scrollTop = chatBody.scrollHeight;
    }

    function updateComposerAttachment() {
      if (!currentAttachment) {
        composerAttachment.classList.remove("active");
        composerAttachment.classList.remove("file-mode");
        composerAttachmentImg.removeAttribute("src");
        composerAttachmentName.textContent = "";
        return;
      }

      if (currentAttachment.kind === "image" && currentAttachment.dataUrl) {
        composerAttachmentImg.src = currentAttachment.dataUrl;
        composerAttachment.classList.remove("file-mode");
      } else {
        composerAttachmentImg.removeAttribute("src");
        composerAttachment.classList.add("file-mode");
      }

      composerAttachmentName.textContent = currentAttachment.name || (currentAttachment.kind === "file" ? "File" : "Image");
      composerAttachment.classList.add("active");
    }

    function clearComposerAttachment() {
      currentAttachment = null;
      updateComposerAttachment();
      imgFile.value = "";
      docFile.value = "";
    }

    function updateModelFilter() {
      const query = modelSearch.value.trim().toLowerCase();
      const currentValue = modelSelect.value;
      if (!query) {
        Array.from(modelSelect.querySelectorAll("optgroup")).forEach((group) => {
          group.hidden = false;
          Array.from(group.children).forEach((option) => {
            option.hidden = false;
          });
        });
        modelSelect.value = currentValue;
        return;
      }

      Array.from(modelSelect.querySelectorAll("optgroup")).forEach((group) => {
        let anyVisible = false;
        Array.from(group.children).forEach((option) => {
          const matches = `${option.textContent} ${option.value}`.toLowerCase().includes(query);
          option.hidden = !matches;
          if (matches) anyVisible = true;
        });
        group.hidden = !anyVisible;
      });

      const visibleOption = Array.from(modelSelect.querySelectorAll("option")).find((option) => !option.hidden);
      if (visibleOption && modelSelect.selectedOptions[0]?.hidden) {
        modelSelect.value = visibleOption.value;
      }
    }

    async function loadHistory() {
        try {
            const res = await fetch(ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "download", sessionId: getSessionId() })
            });
            const data = await res.json();
            if (data.history && data.history.length > 0) {
                chatBody.innerHTML = "";
                data.history.forEach(m => {
                    addBubble(m.content, m.role === "assistant" ? "bot" : "user", false);
                });
            } else {
                chatBody.innerHTML = "";
                addBubble("Hi! How can I help today?");
            }
        } catch (e) {
            console.error("Failed to load history:", e);
        }
    }

    async function getCurrentServerChatSnapshot() {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download", sessionId: getSessionId() })
      });
      const data = await res.json().catch(() => ({}));
      return {
        history: Array.isArray(data.history) ? data.history : [],
        facts: data.facts && typeof data.facts === "object" ? data.facts : {}
      };
    }

    function deriveChatTitle(history) {
      const firstUser = history.find((item) => item.role === "user" && item.content);
      const title = (firstUser ? firstUser.content : "Saved chat").replace(/\s+/g, " ").trim();
      return title.slice(0, 80) || "Saved chat";
    }

    function formatCloudDate(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    }

    function renderCloudChats(chats) {
      if (!cloudChatsList) return;
      if (!chats.length) {
        cloudChatsList.innerHTML = `<div class="cloud-chat-card"><div class="cloud-chat-preview">No saved account chats yet.</div></div>`;
        return;
      }

      cloudChatsList.innerHTML = chats.map((chat) => `
        <div class="cloud-chat-card" data-chat-id="${chat.id}">
          <div class="cloud-chat-top">
            <div class="cloud-chat-title">${escapeHtml(chat.title || "Saved chat")}</div>
            <div class="cloud-status">${escapeHtml(formatCloudDate(chat.updatedAt))}</div>
          </div>
          <div class="cloud-chat-preview">${escapeHtml(chat.preview || `${chat.messageCount || 0} saved messages`)}</div>
          <div class="cloud-chat-actions">
            <button class="cloud-chip" type="button" data-load-chat="${chat.id}">Load</button>
            <button class="cloud-chip" type="button" data-delete-chat="${chat.id}">Delete</button>
          </div>
        </div>
      `).join("");
    }

    async function loadCloudChats() {
      if (!cloudChatsStatus) return;
      const api = getAccountsApi();
      if (!api || !isAccountSignedIn()) {
        cloudChatsStatus.textContent = "Make an account or sign in to save chats here.";
        renderCloudChats([]);
        return;
      }

      cloudChatsStatus.textContent = "Loading saved chats...";
      try {
        const chats = await api.listChats(CHAT_APP_ID);
        renderCloudChats(chats);
        cloudChatsStatus.textContent = chats.length ? "Saved chats in your account." : "No saved account chats yet.";
      } catch (error) {
        cloudChatsStatus.textContent = error.message || "Could not load saved chats.";
        renderCloudChats([]);
      }
    }

    async function syncCurrentChatToAccount(showBubble = false) {
      const api = getAccountsApi();
      if (!api || !isAccountSignedIn()) {
        if (showBubble) addBubble("Sign in first to sync chats to your account.", "bot");
        return;
      }

      const snapshot = await getCurrentServerChatSnapshot();
      if (!snapshot.history.length) {
        if (showBubble) addBubble("This chat is empty, so there is nothing to sync yet.", "bot");
        return;
      }

      await api.saveChat(CHAT_APP_ID, getSessionId(), {
        title: deriveChatTitle(snapshot.history),
        messages: snapshot.history,
        meta: {
          model: modelSelect.value,
          preset: presetSelect.value,
          replyLength: replyLengthSelect.value,
          factCount: Object.keys(snapshot.facts || {}).length
        }
      });

      if (showBubble) addBubble("Synced this chat to your account. ☁️", "bot");
      if (cloudChatsPanel.classList.contains("active")) {
        loadCloudChats();
      }
    }

    async function loadCloudChat(chatId) {
      const api = getAccountsApi();
      if (!api || !isAccountSignedIn()) {
        addBubble("Sign in first to load account chats.", "bot");
        return;
      }

      try {
        const chat = await api.getChat(CHAT_APP_ID, chatId);
        await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upload",
            sessionId: chatId,
            history: Array.isArray(chat.messages) ? chat.messages : [],
            facts: {}
          })
        });
        setSessionId(chatId);
        chatBody.innerHTML = "";
        await loadHistory();
        cloudChatsStatus.textContent = `Loaded "${chat.title || "Saved chat"}".`;
      } catch (error) {
        addBubble(`Could not load account chat: ${error.message}`, "bot");
      }
    }

    async function deleteCloudChat(chatId) {
      const api = getAccountsApi();
      if (!api || !isAccountSignedIn()) return;
      try {
        await api.deleteChat(CHAT_APP_ID, chatId);
        if (chatId === getSessionId()) {
          setSessionId(crypto.randomUUID());
          chatBody.innerHTML = "";
          addBubble("Hi! How can I help today?");
        }
        loadCloudChats();
      } catch (error) {
        addBubble(`Could not delete account chat: ${error.message}`, "bot");
      }
    }

    async function startNewChat() {
      try {
        await syncCurrentChatToAccount(false);
      } catch (error) {
        console.warn("Could not sync current chat before starting a new one", error);
      }
      setSessionId(crypto.randomUUID());
      chatBody.innerHTML = "";
      addBubble("Hi! How can I help today?");
      clearComposerAttachment();
      chatText.value = "";
      if (cloudChatsPanel.classList.contains("active")) {
        cloudChatsStatus.textContent = "Started a fresh chat. Sync it anytime.";
      }
    }

    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      let msg = chatText.value.trim();

      if (!msg && !currentAttachment) return;
      if (!msg && currentAttachment?.kind === "image") msg = "Please analyze this image.";
      if (!msg && currentAttachment?.kind === "file") msg = `Please analyze this file: ${currentAttachment.name}`;

      const attachedItem = currentAttachment;
      if (attachedItem && hasUsedDailyUpload()) {
        addBubble("Uploads are limited to 1 per day. Try again tomorrow for another image or file.", "bot");
        return;
      }
      addBubble(msg, "user", false, attachedItem?.kind === "image" ? attachedItem : null);
      chatText.value = "";
      clearComposerAttachment();

      const typingDiv = document.createElement("div");
      typingDiv.className = "bubble bot";
      typingDiv.textContent = willLikelySearchWeb(msg, attachedItem) ? "Searching web..." : "Thinking... 💭";
      chatBody.appendChild(typingDiv);
      chatBody.scrollTop = chatBody.scrollHeight;

      try {
        const payload = {
            action: "chat",
            site: SITE_NAME,
            sessionId: getSessionId(),
            clientId: getClientId(),
            message: msg,
            model: attachedItem ? getAttachmentModelSelection() : (modelSelect ? modelSelect.value : "@cf/meta/llama-3.2-3b-instruct"),
            preset: presetSelect.value,
            replyLength: replyLengthSelect.value,
            webSearchMode: webSearchSelect.value,
            memoryNote: memoryNoteInput.value.trim()
        };

        if (attachedItem?.kind === "image") {
          payload.image = {
            mimeType: attachedItem.mimeType,
            data: attachedItem.data
          };
        }

        if (attachedItem?.kind === "file") {
          payload.file = {
            mimeType: attachedItem.mimeType,
            data: attachedItem.data,
            name: attachedItem.name,
            text: attachedItem.text
          };
        }

        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Network response was not ok");

        typingDiv.remove();
        if (attachedItem) {
            markDailyUploadUsed();
        }
        if (data.resolvedModelSelection && modelSelect && Array.from(modelSelect.options).some((option) => option.value === data.resolvedModelSelection)) {
            modelSelect.value = data.resolvedModelSelection;
        }
        if (data.routedModel) {
            const routedLabel = data.routedProviderLabel || "Model used";
            addBubble(`${routedLabel}: ${data.routedModel}`, "bot");
        }
        if (data.webSearch) {
            const sourceCount = data.webSearch.resultCount === 1 ? "1 source" : `${data.webSearch.resultCount} sources`;
            addBubble(`Web search used: ${data.webSearch.query} (${sourceCount})`, "bot");
        }
        if (data.reply) {
            addBubble(data.reply, "bot", true);
        } else {
            addBubble("I'm not sure what to say.");
        }
        if (data.generatedFiles && data.generatedFiles.length) {
            addGeneratedFileCards(data.generatedFiles);
        }
        if (data.memorySaved) {
          addBubble(`Saved to memory: ${data.memorySaved}`, "bot");
        }
        memoryNoteInput.value = "";
        saveSettings();
        syncCurrentChatToAccount(false).catch(() => {});

      } catch (err) {
        typingDiv.remove();
        // console.error(err);  // Removed for production
        addBubble("Error: " + err.message + " 🧠", "bot");
      }
    });

    clearBtn.addEventListener("click", async () => {
        if (!confirm("Clear chat history?")) return;
        try {
            await fetch(ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "clear", sessionId: getSessionId() })
            });
            chatBody.innerHTML = "";
            addBubble("Memory cleared! Starting fresh. ✨");
            syncCurrentChatToAccount(false).catch(() => {});
        } catch (e) {
            console.error(e);
            addBubble("Failed to clear chat history from server.");
        }
    });

    imgBtn.addEventListener("click", () => { imgFile.click(); });
    fileBtn.addEventListener("click", () => { docFile.click(); });
    newChatBtn.addEventListener("click", () => { startNewChat(); });
    cloudChatsBtn.addEventListener("click", () => {
      cloudChatsPanel.classList.toggle("active");
      if (cloudChatsPanel.classList.contains("active")) {
        loadCloudChats();
      }
    });
    syncCloudChatBtn.addEventListener("click", () => {
      syncCurrentChatToAccount(true).catch((error) => addBubble(`Cloud sync failed: ${error.message}`, "bot"));
    });
    removeAttachmentBtn.addEventListener("click", clearComposerAttachment);
    modelSearch.addEventListener("input", updateModelFilter);
    modelSelect.addEventListener("change", saveSettings);
    presetSelect.addEventListener("change", saveSettings);
    replyLengthSelect.addEventListener("change", saveSettings);
    webSearchSelect.addEventListener("change", saveSettings);

    quickPrompts.addEventListener("click", (event) => {
      const chip = event.target.closest(".prompt-chip");
      if (!chip) return;
      chatText.value = chip.dataset.prompt || "";
      chatText.focus();
    });

    imgFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (hasUsedDailyUpload()) {
        addBubble("You already used today's upload. Come back tomorrow to attach another image.", "bot");
        e.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        const base64String = dataUrl.split(',')[1];
        currentAttachment = {
          kind: "image",
          mimeType: file.type,
          data: base64String,
          dataUrl,
          name: file.name
        };
        updateComposerAttachment();
        chatText.focus();
      };
      reader.readAsDataURL(file);
    });

    docFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (hasUsedDailyUpload()) {
        addBubble("You already used today's upload. Come back tomorrow to attach another file.", "bot");
        e.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = typeof event.target.result === "string" ? event.target.result : "";
        currentAttachment = {
          kind: "file",
          mimeType: file.type || "text/plain",
          data: btoa(unescape(encodeURIComponent(text))).slice(0, 350000),
          text: text.slice(0, 12000),
          name: file.name
        };
        updateComposerAttachment();
        chatText.focus();
      };
      reader.readAsText(file);
    });

    updateModelFilter();

    cloudChatsList.addEventListener("click", (event) => {
      const loadButton = event.target.closest("[data-load-chat]");
      if (loadButton) {
        loadCloudChat(loadButton.dataset.loadChat);
        return;
      }
      const deleteButton = event.target.closest("[data-delete-chat]");
      if (deleteButton) {
        if (confirm("Delete this saved account chat?")) {
          deleteCloudChat(deleteButton.dataset.deleteChat);
        }
      }
    });

    window.addEventListener("jacob-account-change", () => {
      if (isAccountSignedIn()) {
        syncCurrentChatToAccount(false).catch(() => {});
      }
      if (cloudChatsPanel.classList.contains("active")) {
        loadCloudChats();
      }
    });

    function keepAccountLauncherAboveComposer() {
      const widget = document.getElementById("jacob-account-widget");
      const root = widget?.shadowRoot;
      if (!root || root.getElementById("chatbot-mobile-account-offset")) return Boolean(root);

      const style = document.createElement("style");
      style.id = "chatbot-mobile-account-offset";
      style.textContent = `
        .account-launcher {
          bottom: max(84px, calc(env(safe-area-inset-bottom) + 84px));
        }
        @media (max-width: 720px) {
          .account-launcher {
            bottom: max(88px, calc(env(safe-area-inset-bottom) + 88px));
          }
        }
      `;
      root.appendChild(style);
      return true;
    }

    const accountLauncherOffsetTimer = window.setInterval(() => {
      if (keepAccountLauncherAboveComposer()) {
        window.clearInterval(accountLauncherOffsetTimer);
      }
    }, 250);

    window.addEventListener("load", keepAccountLauncherAboveComposer);
