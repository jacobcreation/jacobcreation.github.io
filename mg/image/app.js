        const WORKER_URL = 'https://meme-generator.b4rjxr9lk.workers.dev';
        let currentUrl = '';
        let currentPrompt = '';
        let currentEnhanced = '';
        let currentModel = '';
        let isUnlimited = localStorage.getItem('unlimited_mode') === 'true';

        function unlockUnlimited() {
            const pw = prompt("Password:");
            if (pw === "20141") {
                isUnlimited = true;
                localStorage.setItem('unlimited_mode', 'true');
                alert("Limits bypassed.");
            }
        }

        const spinnerMessages = [
            'Cooking something cursed...',
            'Asking the AI to be funny...',
            'Training on dank memes...',
            'Generating internet gold...',
            'Almost going viral...',
        ];

        function enhancePrompt(raw) {
            const styles = [
                'meme format', 'viral internet meme', 'bold impact font text overlay',
                'absurdist humor meme', 'reaction meme', 'relatable meme format'
            ];
            const vibes = [
                'extremely relatable', 'chaotic energy', 'deadpan humor',
                'ironic twist', 'wholesome chaos', 'over-the-top expression'
            ];
            const moods = [
                'funny exaggerated facial expression', 'hilarious composition',
                'comedic timing', 'unexpected juxtaposition'
            ];
            const s = styles[Math.floor(Math.random() * styles.length)];
            const v = vibes[Math.floor(Math.random() * vibes.length)];
            const m = moods[Math.floor(Math.random() * moods.length)];
            return `${raw}, ${s}, ${v}, ${m}, high quality meme image, shareable, internet culture aesthetic, white bold text overlay`;
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
            const bg = document.getElementById('memeBg');
            const spinnerWrap = document.getElementById('spinnerWrap');
            const btn = document.getElementById('genBtn');
            const enhancedPill = document.getElementById('enhancedPill');
            bg.style.backgroundImage = "url('" + url + "')";
            bg.style.display = 'block';
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
            const bg = document.getElementById('memeBg');
            const errorMsg = document.getElementById('errorMsg');
            const enhancedPill = document.getElementById('enhancedPill');
            const spinnerLabel = document.getElementById('spinnerLabel');

            btn.disabled = true;
            errorMsg.style.display = 'none';
            bg.style.display = 'none';
            placeholder.style.display = 'none';
            spinnerWrap.style.display = 'flex';
            enhancedPill.style.display = 'none';
            spinnerLabel.textContent = spinnerMessages[Math.floor(Math.random() * spinnerMessages.length)];

            currentPrompt = rawPrompt;
            currentModel = document.getElementById('modelSelect').value;
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
                        bypass: isUnlimited ? '20141' : undefined
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
                    const errorText = await response.text();
                    throw new Error(errorText || `Status ${response.status}`);
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
                errorMsg.textContent = `⚠ Error: ${err.message}`;
                errorMsg.style.display = 'block';
                btn.disabled = false;
            }
        }

        function downloadMeme() {
            if (!currentUrl) return;
            const a = document.createElement('a');
            a.href = currentUrl;
            a.download = 'meme-' + Date.now() + '.jpg';
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        function sharePrompt() {
            const shareText = `Check out this AI meme: "${currentPrompt}" — generated at ${window.location.href}`;
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
                hist = JSON.parse(localStorage.getItem('meme_history') || '[]');
            } catch (e) {}
            hist.unshift({ url, prompt, ts: Date.now() });
            hist = hist.slice(0, 10);
            try {
                localStorage.setItem('meme_history', JSON.stringify(hist));
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
                div.innerHTML = `<img src="${item.url}" loading="lazy" /><span class="hist-tip">${item.prompt}</span>`;
                grid.appendChild(div);
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
            try { localStorage.removeItem('meme_history'); } catch (e) {}
            document.getElementById('histSection').style.display = 'none';
            document.getElementById('histGrid').innerHTML = '';
        }

        document.getElementById('prompt').addEventListener('keydown', e => {
            if (e.key === 'Enter') generate();
        });

        (function init() {
            let hist = [];
            try {
                hist = JSON.parse(localStorage.getItem('meme_history') || '[]');
            } catch (e) {}
            if (hist.length) renderHistory(hist);

            const params = new URLSearchParams(window.location.search);
            if (params.get('p')) {
                document.getElementById('prompt').value = params.get('p');
            }
        })();
