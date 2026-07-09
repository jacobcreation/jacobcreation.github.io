        const WORKER_URL = 'https://meme-generator-video.b4rjxr9lk.workers.dev';
        let currentUrl = '';
        let currentPrompt = '';
        let currentEnhanced = '';
        let currentModel = '';

        const spinnerMessages = [
            'Rendering your video with NVIDIA NIM...',
            'Starting the Cosmos generation job...',
            'Generating video frames...',
            'Refining motion and timing...',
            'Preparing the final clip...',
            'Almost ready...',
        ];

        function enhancePrompt(raw) {
            const styles = [
                'short cinematic video', 'clean visual composition', 'smooth camera motion',
                'natural subject movement', 'well lit scene', 'polished generated video'
            ];
            const vibes = [
                'clear focal point', 'natural pacing', 'balanced mood',
                'expressive motion', 'visually coherent style'
            ];
            const moods = [
                'cinematic lighting', 'steady animation',
                'realistic motion', 'crisp details'
            ];
            const s = styles[Math.floor(Math.random() * styles.length)];
            const v = vibes[Math.floor(Math.random() * vibes.length)];
            const m = moods[Math.floor(Math.random() * moods.length)];
            return `${raw}, ${s}, ${v}, ${m}, high quality video, smooth motion, refined visual style`;
        }

        async function generate() {
            const rawPrompt = document.getElementById('prompt').value.trim();
            if (!rawPrompt) {
                document.getElementById('prompt').focus();
                return;
            }
            doGenerate(rawPrompt);
        }

        function regenerate() {
            if (currentPrompt) doGenerate(currentPrompt);
        }

        function showMeme(url, enhanced, rawPrompt, saveHist) {
            const video = document.getElementById('memeVideo');
            const spinnerWrap = document.getElementById('spinnerWrap');
            const btn = document.getElementById('genBtn');
            const enhancedPill = document.getElementById('enhancedPill');
            
            video.src = url;
            video.style.display = 'block';
            video.play();
            
            spinnerWrap.style.display = 'none';
            btn.disabled = false;
            document.getElementById('dlBtn').disabled = false;
            document.getElementById('regenBtn').disabled = false;
            document.getElementById('shareBtn').disabled = false;
            document.getElementById('enhancedText').textContent = enhanced || rawPrompt;
            enhancedPill.style.display = 'block';
            if (saveHist) saveToHistory(url, rawPrompt);
        }

        async function doGenerate(rawPrompt) {
            const btn = document.getElementById('genBtn');
            const spinnerWrap = document.getElementById('spinnerWrap');
            const placeholder = document.getElementById('placeholder');
            const video = document.getElementById('memeVideo');
            const errorMsg = document.getElementById('errorMsg');
            const enhancedPill = document.getElementById('enhancedPill');
            const spinnerLabel = document.getElementById('spinnerLabel');

            btn.disabled = true;
            errorMsg.style.display = 'none';
            video.style.display = 'none';
            video.pause();
            placeholder.style.display = 'none';
            spinnerWrap.style.display = 'flex';
            enhancedPill.style.display = 'none';
            spinnerLabel.textContent = spinnerMessages[Math.floor(Math.random() * spinnerMessages.length)];

            currentPrompt = rawPrompt;
            const enhanced = enhancePrompt(rawPrompt);
            currentEnhanced = enhanced;
            const seed = Math.floor(Math.random() * 2147483647);

            try {
                const response = await fetch(WORKER_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        prompt: enhanced,
                        seed: seed,
                        model: currentModel,
                    }),
                });

                if (response.status === 429) {
                    const data = await response.json();
                    spinnerWrap.style.display = 'none';
                    placeholder.style.display = 'block';
                    errorMsg.textContent = data.error;
                    errorMsg.style.display = 'block';
                    btn.disabled = false;
                    return;
                }
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || `Status ${response.status}`);
                }

                const blob = await response.blob();
                
                if (currentUrl && currentUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(currentUrl);
                }
                
                const url = URL.createObjectURL(blob);
                currentUrl = url;
                
                showMeme(url, enhanced, rawPrompt, true);
            } catch (err) {
                console.error(err);
                spinnerWrap.style.display = 'none';
                placeholder.style.display = 'block';
                errorMsg.textContent = `Error: ${err.message}`;
                errorMsg.style.display = 'block';
                btn.disabled = false;
            }
        }

        function downloadMeme() {
            if (!currentUrl) return;
            const a = document.createElement('a');
            a.href = currentUrl;
            a.download = 'video-' + Date.now() + '.mp4';
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        function sharePrompt() {
            const shareText = `AI video prompt: "${currentPrompt}" — generated at ${window.location.href}`;
            navigator.clipboard.writeText(shareText).then(() => {
                const btn = document.getElementById('shareBtn');
                const original = btn.textContent;
                btn.textContent = '✓ Copied!';
                setTimeout(() => btn.textContent = original, 1800);
            });
        }

        function saveToHistory(url, prompt) {
            let hist = [];
            try {
                hist = JSON.parse(sessionStorage.getItem('video_meme_history') || '[]');
            } catch (e) {}
            hist.unshift({ url, prompt, ts: Date.now() });
            hist = hist.slice(0, 5);
            try {
                sessionStorage.setItem('video_meme_history', JSON.stringify(hist));
            } catch (e) {}
            renderHistory(hist);
        }

        function renderHistory(hist) {
            if (!hist || !hist.length) return;
            const section = document.getElementById('histSection');
            const grid = document.getElementById('histGrid');
            section.style.display = 'block';
            grid.innerHTML = '';
            hist.forEach(item => {
                const div = document.createElement('div');
                div.className = 'hist-item';
                div.title = item.prompt;
                div.onclick = () => loadFromHistory(item);
                div.innerHTML = `<video src="${item.url}" muted playsinline></video><span class="hist-tip">${item.prompt}</span>`;
                grid.appendChild(div);
                
                div.onmouseenter = () => div.querySelector('video').play();
                div.onmouseleave = () => {
                    const v = div.querySelector('video');
                    v.pause();
                    v.currentTime = 0;
                };
            });
        }

        function loadFromHistory(item) {
            document.getElementById('placeholder').style.display = 'none';
            document.getElementById('spinnerWrap').style.display = 'none';
            currentUrl = item.url;
            currentPrompt = item.prompt;
            document.getElementById('prompt').value = item.prompt;
            showMeme(item.url, item.prompt, item.prompt, false);
        }

        function clearHistory() {
            try { sessionStorage.removeItem('video_meme_history'); } catch (e) {}
            document.getElementById('histSection').style.display = 'none';
            document.getElementById('histGrid').innerHTML = '';
        }

        document.getElementById('prompt').addEventListener('keydown', e => {
            if (e.key === 'Enter') generate();
        });

        (function init() {
            let hist = [];
            try {
                hist = JSON.parse(sessionStorage.getItem('video_meme_history') || '[]');
            } catch (e) {}
            if (hist.length) renderHistory(hist);

            const params = new URLSearchParams(window.location.search);
            if (params.get('p')) {
                document.getElementById('prompt').value = params.get('p');
            }
        })();
