        // Fixed Cloudflare Worker URL for image editing
        const WORKER_URL = 'https://ai-image-edit.b4rjxr9lk.workers.dev';

        // Upload zone events
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const origPreview = document.getElementById('orig-preview');
        const origPlaceholder = document.getElementById('orig-placeholder');
        const generateBtn = document.getElementById('generate-btn');
        let selectedFile = null;

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

        fileInput.addEventListener('change', (e) => {
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

        function updateGenerateButtonState() {
            generateBtn.disabled = !selectedFile || !promptInput.value.trim();
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

            // Loading state
            generateBtn.disabled = true;
            const origBtnText = generateBtn.innerHTML;
            generateBtn.innerHTML = '<div class="spinner"></div> <span>Processing...</span>';
            outputPreview.style.display = 'none';
            outputPlaceholder.style.display = 'flex';
            outputPlaceholder.innerHTML = '<div class="spinner" style="width: 32px; height: 32px; border-width: 3px; border-top-color: var(--primary);"></div><span style="margin-top: 15px; color: var(--text-muted);">Editing with Gemini...</span>';
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
                    body: formData
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || data.message || `HTTP error ${response.status}`);
                }

                // Handle image output formats
                // OpenAI image/edits return format: { data: [ { b64_json: '...', url: '...' } ] }
                if (data.data && data.data[0]) {
                    const item = data.data[0];
                    if (item.b64_json) {
                        outputImageB64 = `data:image/png;base64,${item.b64_json}`;
                    } else if (item.url) {
                        outputImageB64 = item.url;
                    }
                } else if (data.artifacts && data.artifacts[0]) {
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
                } else {
                    throw new Error("Could not extract image data from worker response. Response schema: " + JSON.stringify(data));
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
