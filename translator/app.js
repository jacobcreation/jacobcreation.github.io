        const LANGUAGES = [
            { code: "en", name: "English" },
            { code: "es", name: "Spanish" },
            { code: "fr", name: "French" },
            { code: "de", name: "German" },
            { code: "it", name: "Italian" },
            { code: "pt", name: "Portuguese" },
            { code: "ru", name: "Russian" },
            { code: "zh", name: "Chinese" },
            { code: "ja", name: "Japanese" },
            { code: "ko", name: "Korean" },
            { code: "ar", name: "Arabic" },
            { code: "nl", name: "Dutch" },
            { code: "pl", name: "Polish" },
            { code: "tr", name: "Turkish" },
            { code: "vi", name: "Vietnamese" },
            { code: "th", name: "Thai" },
            { code: "hi", name: "Hindi" },
            { code: "bn", name: "Bengali" },
            { code: "cs", name: "Czech" },
            { code: "da", name: "Danish" },
            { code: "el", name: "Greek" },
            { code: "fi", name: "Finnish" },
            { code: "he", name: "Hebrew" },
            { code: "hu", name: "Hungarian" },
            { code: "id", name: "Indonesian" },
            { code: "ms", name: "Malay" },
            { code: "no", name: "Norwegian" },
            { code: "ro", name: "Romanian" },
            { code: "sv", name: "Swedish" },
            { code: "uk", name: "Ukrainian" },
        ];

        const sourceLang = document.getElementById("sourceLang");
        const targetLang = document.getElementById("targetLang");
        const sourceText = document.getElementById("sourceText");
        const outputText = document.getElementById("outputText");
        const translateBtn = document.getElementById("translateBtn");
        const swapBtn = document.getElementById("swapBtn");
        const clearBtn = document.getElementById("clearBtn");
        const copyBtn = document.getElementById("copyBtn");
        const status = document.getElementById("status");
        const sourceCount = document.getElementById("sourceCount");
        const outputCount = document.getElementById("outputCount");
        const recordBtn = document.getElementById("recordBtn");

        let isTranslating = false;
        let mediaRecorder;
        let audioChunks = [];
        let isRecording = false;

        recordBtn.addEventListener("click", async () => {
            if (isRecording) {
                mediaRecorder.stop();
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                mediaRecorder.ondataavailable = (event) => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
                    stream.getTracks().forEach(track => track.stop());
                    
                    isRecording = false;
                    recordBtn.textContent = "🎤 Record";
                    recordBtn.classList.remove("btn-danger");
                    recordBtn.classList.add("btn-ghost");
                    
                    await transcribeAudio(audioBlob);
                };

                mediaRecorder.start();
                isRecording = true;
                recordBtn.textContent = "⏹ Stop";
                recordBtn.classList.remove("btn-ghost");
                recordBtn.classList.add("btn-danger");
                setStatus("Recording...");

            } catch (err) {
                setStatus("Microphone access denied or not available.", true);
                console.error(err);
            }
        });

        async function transcribeAudio(blob) {
            setStatus("Transcribing...");
            try {
                const res = await fetch(WORKER_URL, {
                    method: "POST",
                    headers: { 
                        "Content-Type": blob.type,
                        "X-Source-Lang": sourceLang.value 
                    },
                    body: blob,
                });

                if (!res.ok) {
                    const err = await res.text();
                    throw new Error(err || `HTTP ${res.status}`);
                }

                const data = await res.json();
                sourceText.value = data.result;
                updateCharCounts();
                setStatus("Transcription complete!");
                
                // Automatically translate after transcription
                translateBtn.click();
            } catch (e) {
                setStatus("Transcription error: " + e.message, true);
            }
        }

        function populateSelects() {
            LANGUAGES.forEach(l => {
                sourceLang.appendChild(new Option(l.name, l.code));
                targetLang.appendChild(new Option(l.name, l.code));
            });
            sourceLang.value = "en";
            targetLang.value = "es";
        }
        populateSelects();

        sourceText.addEventListener("input", () => {
            sourceCount.textContent = sourceText.value.length;
        });

        function updateCharCounts() {
            sourceCount.textContent = sourceText.value.length;
        }
        updateCharCounts();

        function setStatus(msg, isError) {
            status.textContent = msg;
            status.className = "status" + (isError ? " error" : "");
        }

        function showSpinner() {
            status.innerHTML = '<span class="spinner"></span> Translating…';
            status.className = "status";
        }

        swapBtn.addEventListener("click", () => {
            const tmpLang = sourceLang.value;
            sourceLang.value = targetLang.value;
            targetLang.value = tmpLang;

            const tmpText = sourceText.value;
            sourceText.value = outputText.value;
            outputText.value = tmpText;
            updateCharCounts();
        });

        clearBtn.addEventListener("click", () => {
            sourceText.value = "";
            outputText.value = "";
            setStatus("");
            updateCharCounts();
        });

        copyBtn.addEventListener("click", async () => {
            const text = outputText.value;
            if (!text) {
                setStatus("Nothing to copy.", true);
                return;
            }
            try {
                await navigator.clipboard.writeText(text);
                setStatus("Copied to clipboard!");
            } catch {
                setStatus("Failed to copy.", true);
            }
        });

        const WORKER_URL = "https://translator.b4rjxr9lk.workers.dev/";

        translateBtn.addEventListener("click", async () => {
            const text = sourceText.value.trim();
            if (!text) {
                setStatus("Please enter some text to translate.", true);
                return;
            }
            if (isTranslating) return;

            isTranslating = true;
            translateBtn.disabled = true;
            showSpinner();

            try {
                const res = await fetch(WORKER_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        text,
                        source_lang: sourceLang.value,
                        target_lang: targetLang.value,
                    }),
                });

                if (!res.ok) {
                    const err = await res.text();
                    throw new Error(err || `HTTP ${res.status}`);
                }

                const data = await res.json();
                outputText.value = data.result;
                outputCount.textContent = data.result.length;
                setStatus("Translation complete!");
            } catch (e) {
                setStatus("Error: " + e.message, true);
            } finally {
                isTranslating = false;
                translateBtn.disabled = false;
            }
        });
