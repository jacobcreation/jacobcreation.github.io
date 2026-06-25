        const workerUrl = "https://ai-chaos.b4rjxr9lk.workers.dev";
        const chatDiv = document.getElementById('chat');
        const sendBtn = document.getElementById('sendBtn');
        const userInput = document.getElementById('userInput');
        const promptSelect = document.getElementById('promptSelect');
        const modelSelect = document.getElementById('modelSelect');
        const clearBtn = document.getElementById('clearBtn');
        const customPromptGroup = document.getElementById('customPromptGroup');
        const customPromptInput = document.getElementById('customPrompt');

        promptSelect.addEventListener('change', () => {
            customPromptGroup.style.display = promptSelect.value === 'CUSTOM' ? 'flex' : 'none';
        });

        function appendMessage(text, className) {
            const div = document.createElement('div');
            div.className = 'msg ' + className;
            div.textContent = text;
            chatDiv.appendChild(div);
            chatDiv.scrollTop = chatDiv.scrollHeight;
            return div;
        }

        // Auto-resize textarea
        userInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });

        async function sendMessage() {
            const userMsg = userInput.value.trim();
            if (!userMsg || sendBtn.disabled) return;

            let systemPrompt = promptSelect.value;
            if (systemPrompt === 'CUSTOM') {
                systemPrompt = customPromptInput.value.trim() || 'You are a helpful assistant.';
            }
            const model = modelSelect.value;

            appendMessage(userMsg, 'user');
            userInput.value = '';
            userInput.style.height = 'auto';
            
            sendBtn.disabled = true;
            const loadingMsg = appendMessage('...', 'ai');

            try {
                const response = await fetch(workerUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        system: systemPrompt, 
                        prompt: userMsg, 
                        model: model 
                    })
                });

                if (!response.ok) throw new Error('Failed to connect to AI');

                const data = await response.json();
                const rawData = data;
                let aiReply = data.reply || data.result || data.response;
                // Ensure we only display a string response
                if (typeof aiReply !== 'string') {
                    // Attempt to extract a readable field from objects
                    if (aiReply && typeof aiReply === 'object') {
                        // Handle structured reply format (e.g., OpenAI API response)
                        if (Array.isArray(aiReply.choices) && aiReply.choices.length) {
                            const msg = aiReply.choices[0].message;
                            if (msg && typeof msg.content === 'string') {
                                aiReply = msg.content;
                            }
                        }
                        // Fallback to generic text/content fields
                        if (typeof aiReply !== 'string') {
                            aiReply = aiReply.text || aiReply.content || '';
                        }
                    }
                    // Fallback to stringified raw data if still empty
                    if (!aiReply) {
                        try {
                            aiReply = JSON.stringify(rawData);
                        } catch (_) {
                            aiReply = String(rawData);
                        }
                    }
                }
                loadingMsg.textContent = aiReply;
            } catch (e) {
                loadingMsg.className = 'msg error';
                loadingMsg.textContent = 'Error: ' + e.message;
            } finally {
                sendBtn.disabled = false;
                chatDiv.scrollTop = chatDiv.scrollHeight;
            }
        }

        sendBtn.addEventListener('click', sendMessage);
        clearBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear the chat?')) {
                chatDiv.innerHTML = '<div class="msg ai">Chat cleared. Ready for more chaos?</div>';
            }
        });
        userInput.addEventListener('keydown', (e) => { 
            if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                sendMessage(); 
            } 
        });
