    const allFormats = [
      { name: "mp3", type: "audio" }, { name: "wav", type: "audio" }, { name: "aac", type: "audio" }, { name: "flac", type: "audio" }, { name: "ogg", type: "audio" }, { name: "m4a", type: "audio" },
      { name: "mp4", type: "video" }, { name: "mkv", type: "video" }, { name: "avi", type: "video" }, { name: "mov", type: "video" },
      { name: "jpg", type: "image" }, { name: "png", type: "image" }, { name: "gif", type: "image" }, { name: "webp", type: "image" }, { name: "svg", type: "image" },
      { name: "pdf", type: "document" }, { name: "doc", type: "document" }, { name: "docx", type: "document" }, { name: "txt", type: "document" },
      { name: "xls", type: "spreadsheet" }, { name: "xlsx", type: "spreadsheet" }, { name: "csv", type: "spreadsheet" },
      { name: "ppt", type: "presentation" }, { name: "pptx", type: "presentation" },
      { name: "epub", type: "ebook" }, { name: "mobi", type: "ebook" },
      { name: "zip", type: "archive" }, { name: "rar", type: "archive" }, { name: "7z", type: "archive" },
      { name: "ttf", type: "font" }, { name: "otf", type: "font" },
      { name: "json", type: "data" }, { name: "xml", type: "data" }
    ];

    const categoriesDiv = document.getElementById("categories");
    const toEl = document.getElementById("to");
    const fromEl = document.getElementById("from");
    const fileEl = document.getElementById("file");
    const statusEl = document.getElementById("status");
    const btn = document.getElementById("convert");
    const drop = document.getElementById("drop");
    const WORKER = "https://jacobconvert.b4rjxr9lk.workers.dev";
    let selectedFile = null;

    // Populate categories
    const categories = Array.from(new Set(allFormats.map(f => f.type)));
    categories.forEach(cat => {
      const catDiv = document.createElement("div"); catDiv.className = "category";
      const title = document.createElement("div"); title.className = "category-title"; title.textContent = cat.toUpperCase();
      catDiv.appendChild(title);
      const formatsDiv = document.createElement("div"); formatsDiv.className = "formats";
      allFormats.filter(f => f.type === cat).forEach(f => {
        const pill = document.createElement("span"); pill.className = "pill"; pill.textContent = f.name;
        pill.addEventListener("click", () => { toEl.value = f.name; updateButton(); formatsDiv.style.display = "none"; });
        formatsDiv.appendChild(pill);
      });
      catDiv.appendChild(formatsDiv);
      categoriesDiv.appendChild(catDiv);

      // Click to toggle
      title.addEventListener("click", () => { formatsDiv.style.display = formatsDiv.style.display === "block" ? "none" : "block"; });
    });

    // Helpers
    function ext(name) { const i = name.lastIndexOf("."); return i > -1 ? name.slice(i + 1).toLowerCase() : ""; }
    function setStatus(txt) { statusEl.textContent = txt; }
    function updateButton() { btn.disabled = !selectedFile || !toEl.value.trim(); }

    // File selection
    fileEl.addEventListener("change", e => {
      selectedFile = e.target.files[0]; fileEl.files = e.target.files;
      if (selectedFile) fromEl.value = ext(selectedFile.name);
      setStatus(`Selected: ${selectedFile.name}`); updateButton();
    });

    drop.addEventListener("dragover", e => { e.preventDefault(); });
    drop.addEventListener("drop", e => {
      e.preventDefault();
      if (e.dataTransfer.files.length) {
        selectedFile = e.dataTransfer.files[0];
        fileEl.files = e.dataTransfer.files;
        if (selectedFile) fromEl.value = ext(selectedFile.name);
        setStatus(`Selected: ${selectedFile.name}`); updateButton();
      }
    });

    // Convert
    btn.addEventListener("click", async () => {
      if (!selectedFile) return;
      const from = fromEl.value.trim().toLowerCase() || ext(selectedFile.name);
      const to = toEl.value.trim().toLowerCase();
      if (!from || !to) return setStatus("Please enter From and To.");
      setStatus("Converting… 🚀");

      try {
        const form = new FormData();
        form.append("file", selectedFile, selectedFile.name);
        form.append("from", from);
        form.append("to", to);
        const res = await fetch(`${WORKER}/api/convert`, { method: "POST", body: form });
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        const baseName = selectedFile.name.replace(/\.[^/.]+$/, "");
        const outName = `${baseName}_JacobConvert.${to}`;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = outName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1200);
        setStatus(`✅ Done!\nDownloaded: ${outName}`);
      } catch (e) { setStatus("❌ " + e.message); }
    });
