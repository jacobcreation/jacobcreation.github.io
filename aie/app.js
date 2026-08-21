        // Fixed Cloudflare Worker URL for image editing
        const WORKER_URL = 'https://ai-image-edit.b4rjxr9lk.workers.dev';
        const CLIENT_ID_KEY = 'aie_client_id_v1';
        const DAILY_LIMIT_KEY = 'aie_daily_image_edit_v1';

        // Upload zone events
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const origPreview = document.getElementById('orig-preview');
        const origPlaceholder = document.getElementById('orig-placeholder');
        const generateBtn = document.getElementById('generate-btn');
        const limitNote = document.getElementById('limit-note');
        let selectedFile = null;
        const clientId = getClientId();

        dropZone.addEventListener('click', () => fileInput.click());

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleFile(fileInput.files[0]);
            }
        });

        function handleFile(file) {
            if (!file.type.startsWith('image/')) {
                showError("Please select a valid image file.");
                return;
            }
            selectedFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                origPreview.src = e.target.result;
                origPreview.style.display = 'block';
                origPlaceholder.style.display = 'none';
                updateGenerateButtonState();
            };
            reader.readAsDataURL(file);
            clearError();
        }

        const promptInput = document.getElementById('prompt-input');
        promptInput.addEventListener('input', updateGenerateButtonState);
        renderDailyLimitState();

        function updateGenerateButtonState() {
            generateBtn.disabled = isDailyLimitUsed() || !selectedFile || !promptInput.value.trim();
        }

        // Error functions
        const errorBox = document.getElementById('error-box');
        function showError(message) {
            errorBox.textContent = message;
            errorBox.style.display = 'block';
        }

        function clearError() {
            errorBox.style.display = 'none';
            errorBox.textContent = '';
        }

        // Submit action
        const outputPreview = document.getElementById('output-preview');
        const outputPlaceholder = document.getElementById('output-placeholder');
        const downloadBtn = document.getElementById('download-btn');
        let outputImageB64 = null;

        generateBtn.addEventListener('click', async () => {
            if (!selectedFile || !promptInput.value.trim()) return;
            if (isDailyLimitUsed()) {
                showError("You've already used today's image edit. Try again tomorrow.");
                renderDailyLimitState();
                return;
            }

            // Loading state
            generateBtn.disabled = true;
            const origBtnText = generateBtn.innerHTML;
            generateBtn.innerHTML = '<div class="spinner"></div> <span>Processing...</span>';
            outputPreview.style.display = 'none';
            outputPlaceholder.style.display = 'flex';
            outputPlaceholder.innerHTML = '<div class="spinner" style="width: 32px; height: 32px; border-width: 3px; border-top-color: var(--primary);"></div><span style="margin-top: 15px; color: var(--text-muted);">Editing with Flux.2 Klein 4B...</span>';
            downloadBtn.style.display = 'none';
            clearError();

            const workerUrl = WORKER_URL;
            const prompt = promptInput.value.trim();

            const formData = new FormData();
            formData.append('image', selectedFile);
            formData.append('prompt', prompt);

            try {
                const response = await fetch(workerUrl, {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: formData
                });

                const data = await response.json();

                if (!response.ok) {
                    if (response.status === 429 && data.code === 'daily_limit_reached') {
                        markDailyLimitUsed(data.resetAt);
                        renderDailyLimitState();
                    }
                    throw new Error(data.error || data.message || `HTTP error ${response.status}`);
                }

                // Handle image output formats
                // OpenAI image/edits return format: { data: [ { b64_json: '...', url: '...' } ] }
                if (data.data?.[0]) {
                    const item = data.data[0];
                    if (item.b64_json) {
                        outputImageB64 = `data:image/png;base64,${item.b64_json}`;
                    } else if (item.url) {
                        outputImageB64 = item.url;
                    }
                } else if (data.artifacts?.[0]) {
                    // Alternative image API format
                    const base64 = data.artifacts[0].base64;
                    outputImageB64 = `data:image/png;base64,${base64}`;
                } else if (data.image) {
                    outputImageB64 = data.image.startsWith('data:') ? data.image : `data:image/png;base64,${data.image}`;
                }

                if (outputImageB64) {
                    outputPreview.src = outputImageB64;
                    outputPreview.style.display = 'block';
                    outputPlaceholder.style.display = 'none';
                    downloadBtn.style.display = 'inline-flex';
                    markDailyLimitUsed(data.resetAt);
                    renderDailyLimitState();
                } else {
                    throw new Error(`Could not extract image data from worker response. Response schema: ${JSON.stringify(data)}`);
                }

            } catch (err) {
                console.error(err);
                showError(`Error: ${err.message || 'Unknown error occurred while contacting the worker.'}`);
                outputPlaceholder.innerHTML = '<span class="placeholder-icon">❌</span><span>Generation failed</span>';
            } finally {
                generateBtn.innerHTML = origBtnText;
                updateGenerateButtonState();
            }
        });

        // Download result action
        downloadBtn.addEventListener('click', () => {
            if (!outputImageB64) return;
            const link = document.createElement('a');
            link.href = outputImageB64;
            link.download = `edited_${selectedFile ? selectedFile.name : 'image.png'}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });

        function getRequestHeaders() {
            const headers = { 'X-AIE-Client-ID': clientId };
            if (window.JacobAccounts && typeof window.JacobAccounts.getAuthHeaders === 'function') {
                Object.assign(headers, window.JacobAccounts.getAuthHeaders());
            }
            return headers;
        }

        function getClientId() {
            try {
                const existing = localStorage.getItem(CLIENT_ID_KEY);
                if (existing) return existing;
                const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
                localStorage.setItem(CLIENT_ID_KEY, id);
                return id;
            } catch {
                return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            }
        }

        function isDailyLimitUsed() {
            const state = getDailyLimitState();
            if (!state) return false;
            const resetAt = Date.parse(state.resetAt || '');
            return Number.isFinite(resetAt) && Date.now() < resetAt;
        }

        function markDailyLimitUsed(resetAt) {
            const fallbackReset = getNextUtcMidnight().toISOString();
            try {
                localStorage.setItem(DAILY_LIMIT_KEY, JSON.stringify({ resetAt: resetAt || fallbackReset }));
            } catch {}
        }

        function getDailyLimitState() {
            try {
                return JSON.parse(localStorage.getItem(DAILY_LIMIT_KEY) || 'null');
            } catch {
                return null;
            }
        }

        function renderDailyLimitState() {
            if (!limitNote) return;
            if (isDailyLimitUsed()) {
                const state = getDailyLimitState();
                const resetAt = new Date(state.resetAt);
                limitNote.textContent = `Daily limit used. Next edit unlocks ${resetAt.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`;
                limitNote.style.display = 'block';
            } else {
                limitNote.textContent = '1 image edit available today.';
                limitNote.style.display = 'block';
            }
            updateGenerateButtonState();
        }

        function getNextUtcMidnight() {
            const now = new Date();
            return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
        }

        window.addEventListener('jacob-account-change', renderDailyLimitState);
