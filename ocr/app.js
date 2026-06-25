  // Elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const previewImg = document.getElementById('previewImg');
  const previewActions = document.getElementById('previewActions');
  const clearBtn = document.getElementById('clearBtn');

  const runBtn = document.getElementById('runBtn');
  const promptInput = document.getElementById('promptInput');
  const status = document.getElementById('status');
  const resultCard = document.getElementById('resultCard');
  const resultText = document.getElementById('resultText');
  const charCount = document.getElementById('charCount');
  const copyBtn = document.getElementById('copyBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const toast = document.getElementById('toast');

  let imageDataUrl = null;
  const WORKER_URL = 'https://nemotron-ocr-proxy.b4rjxr9lk.workers.dev';

  // Drag & drop
  dropZone.addEventListener('click', () => !imageDataUrl && fileInput.click());
  dropZone.addEventListener('keydown', e => e.key === 'Enter' && !imageDataUrl && fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadFile(fileInput.files[0]);
  });

  clearBtn.addEventListener('click', () => {
    imageDataUrl = null;
    previewImg.src = '';
    previewImg.classList.remove('visible');
    previewActions.classList.remove('visible');
    dropZone.classList.remove('has-image');
    fileInput.value = '';
    runBtn.disabled = true;
    resultCard.classList.remove('visible');
    setStatus('');
  });

  function loadFile(file) {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setStatus('Unsupported file type. Use PNG, JPG, or WEBP.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      imageDataUrl = e.target.result;
      previewImg.src = imageDataUrl;
      previewImg.classList.add('visible');
      previewActions.classList.add('visible');
      dropZone.classList.add('has-image');
      runBtn.disabled = false;
      setStatus('');
    };
    reader.readAsDataURL(file);
  }

  // Run OCR
  runBtn.addEventListener('click', async () => {
    const workerUrl = WORKER_URL.replace(/\/$/, '');

    if (!imageDataUrl) {
      setStatus('Please upload an image.', 'error');
      return;
    }

    runBtn.disabled = true;
    setStatus('Running OCR…', '', true);
    resultCard.classList.remove('visible');

    try {
      const res = await fetch(`${workerUrl}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageDataUrl,
          prompt: promptInput.value.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      resultText.textContent = data.text;
      charCount.textContent = `${data.text.length.toLocaleString()} chars`;
      resultCard.classList.add('visible');
      resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setStatus('Done!', 'success');
    } catch (err) {
      setStatus(err.message, 'error');
    } finally {
      runBtn.disabled = false;
    }
  });

  function setStatus(msg, type = '', spinner = false) {
    status.className = type ? `${type}` : '';
    if (spinner) {
      status.innerHTML = `<span class="spinner"></span>${msg}`;
    } else {
      status.textContent = msg;
    }
  }

  // Copy
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(resultText.textContent);
      showToast();
    } catch {
      const r = document.createRange();
      r.selectNode(resultText);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
      document.execCommand('copy');
      showToast();
    }
  });

  // Download
  downloadBtn.addEventListener('click', () => {
    const blob = new Blob([resultText.textContent], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ocr-result.txt';
    a.click();
  });

  function showToast() {
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }
