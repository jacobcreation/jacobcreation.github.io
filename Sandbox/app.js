import {
	initEditor,
	saveCurrentFile,
	files,
	formatCode,
	getCurrentFile,
	setFile,
	updateLineNumbers,
} from "./editor.js";
import { runSandbox, LIBRARIES } from "./sandbox.js";
import { askAI, initAIControls } from "./ai.js";
import { TEMPLATES } from "./templates.js";

// ── Globals & Init ────────────────────────────────────────────────────────────
let activeFilter = "all";
let isVertical = false;

function init() {
	initEditor();
	setupUI();
	loadFromURLOrStorage();
	initAIControls();

	window.addEventListener("message", handleConsoleMessage);

	// Run on init
	runSandbox();
}

function showToast(msg) {
	const t = document.getElementById("toast");
	t.textContent = msg;
	t.classList.add("show");
	setTimeout(() => t.classList.remove("show"), 2500);
}

// ── UI Setup ──────────────────────────────────────────────────────────────────
function setupUI() {
	const byId = (id) => document.getElementById(id);

	// Header Actions
	byId("run").addEventListener("click", () => {
		saveCurrentFile();
		runSandbox();
	});
	byId("formatBtn").addEventListener("click", () => {
		formatCode();
		showToast("Code formatted ✨");
	});
	byId("templatesBtn").addEventListener("click", showTemplatesModal);
	byId("libraryBtn").addEventListener("click", showLibrariesModal);
	byId("saveBtn").addEventListener("click", saveProject);
	byId("projectsBtn").addEventListener("click", showProjectsModal);
	byId("shareBtn").addEventListener("click", generateShareURL);
	byId("downloadBtn").addEventListener("click", exportProject);

	// Keyboard shortcuts
	document.addEventListener("keydown", (e) => {
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
			e.preventDefault();
			saveCurrentFile();
			runSandbox();
		}
		if ((e.ctrlKey || e.metaKey) && e.key === "s") {
			e.preventDefault();
			saveProject();
		}
	});

	// Toolbar Options
	const codeTa = byId("code");
	const lnDiv = byId("lineNumbers");

	byId("fontSizeInput").addEventListener("input", (e) => {
		const v = e.target.value + "px";
		byId("fontSizeVal").textContent = v;
		codeTa.style.fontSize = v;
		lnDiv.style.fontSize = v;
		updateLineNumbers();
	});

	byId("wrapToggle").addEventListener("change", (e) => {
		codeTa.style.whiteSpace = e.target.checked ? "pre-wrap" : "pre";
	});

	byId("layoutBtn").addEventListener("click", () => {
		isVertical = !isVertical;
		byId("main").classList.toggle("vertical", isVertical);
	});

	// Device Preview
	document.querySelectorAll("[data-device]").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			document
				.querySelectorAll("[data-device]")
				.forEach((b) => b.classList.remove("active"));
			btn.classList.add("active");
			const d = btn.dataset.device;
			const w = byId("deviceWrapper");
			w.className = d === "full" ? "" : d;
			byId("deviceLabel").textContent =
				d === "tablet"
					? "Tablet (768px)"
					: d === "mobile"
						? "Mobile (375px)"
						: "Full width";
		});
	});

	// Console Filters
	document.querySelectorAll(".filter-btn").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			document
				.querySelectorAll(".filter-btn")
				.forEach((b) => b.classList.remove("active"));
			btn.classList.add("active");
			activeFilter = btn.dataset.filter;
			applyConsoleFilter();
		});
	});

	byId("clearConsoleBtn").addEventListener("click", clearConsole);
	byId("clearConsoleBtn2").addEventListener("click", clearConsole);

	// Preview Pane Controls
	byId("refreshBtn").addEventListener("click", () => {
		saveCurrentFile();
		runSandbox();
	});
	byId("openTabBtn").addEventListener("click", openPreviewInNewTab);
	byId("newTabBtn").addEventListener("click", openPreviewInNewTab);
	byId("fullscreenBtn").addEventListener("click", () => {
		const f = byId("frame");
		if (f.requestFullscreen) f.requestFullscreen();
	});

	// AI Panel
	const aiInput = byId("aiInput");
	aiInput.addEventListener("keydown", async (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			const msg = aiInput.value.trim();
			if (!msg) return;
			aiInput.value = "";
			aiInput.disabled = true;
			saveCurrentFile();
			await askAI(msg, files);
			aiInput.disabled = false;
			aiInput.focus();
		}
	});

	document.querySelectorAll(".ai-quick-btn").forEach((btn) => {
		btn.addEventListener("click", async () => {
			const prompt = btn.dataset.prompt;
			aiInput.disabled = true;
			saveCurrentFile();
			await askAI(prompt, files);
			aiInput.disabled = false;
		});
	});

	byId("clearAiBtn").addEventListener("click", () => {
		byId("aiLog").innerHTML =
			`<div class="ai-bubble ai-ai"><span class="ai-label">🤖 AI</span><div class="ai-body">Chat cleared! What's next?</div></div>`;
	});

	// Modal Close
	byId("modalClose").addEventListener("click", closeModal);
	byId("modalOverlay").addEventListener("mousedown", (e) => {
		if (e.target.id === "modalOverlay") closeModal();
	});

	// Resizer
	setupResizer();
}

// ── Resizer ───────────────────────────────────────────────────────────────────
function setupResizer() {
	const resizer = document.getElementById("resizer");
	const leftPane = document.getElementById("editorPane");

	let isResizing = false;

	resizer.addEventListener("mousedown", (e) => {
		isResizing = true;
		resizer.classList.add("dragging");
		document.body.style.cursor = isVertical ? "row-resize" : "col-resize";
		document.getElementById("frame").style.pointerEvents = "none";
	});

	window.addEventListener("mousemove", (e) => {
		if (!isResizing) return;
		if (isVertical) {
			const h =
				e.clientY -
				document.querySelector("header").offsetHeight -
				document.getElementById("toolbar").offsetHeight;
			const totalH = document.getElementById("main").offsetHeight;
			const pct = Math.max(10, Math.min(90, (h / totalH) * 100));
			leftPane.style.flex = `0 0 ${pct}%`;
		} else {
			const w = e.clientX;
			const totalW = document.body.offsetWidth;
			const pct = Math.max(10, Math.min(90, (w / totalW) * 100));
			leftPane.style.flex = `0 0 ${pct}%`;
		}
	});

	window.addEventListener("mouseup", () => {
		if (isResizing) {
			isResizing = false;
			resizer.classList.remove("dragging");
			document.body.style.cursor = "";
			document.getElementById("frame").style.pointerEvents = "";
		}
	});
}

// ── Modals ────────────────────────────────────────────────────────────────────
function openModal(title, contentHTML) {
	document.getElementById("modalTitle").textContent = title;
	document.getElementById("modalContent").innerHTML = contentHTML;
	document.getElementById("modalOverlay").classList.remove("hidden");
}

function closeModal() {
	document.getElementById("modalOverlay").classList.add("hidden");
}

function showTemplatesModal() {
	const html = `<div class="modal-grid">
    ${TEMPLATES.map(
			(t, i) => `
      <div class="modal-card" data-idx="${i}">
        <span class="card-emoji">${t.emoji}</span>
        <div class="card-title">${t.title}</div>
        <div class="card-desc">${t.desc}</div>
      </div>
    `,
		).join("")}
  </div>`;

	openModal("Start from a template", html);

	document.querySelectorAll(".modal-card").forEach((c) => {
		c.addEventListener("click", () => {
			const t = TEMPLATES[c.dataset.idx];
			files.html = t.html;
			files.css = t.css;
			files.js = t.js;
			LIBRARIES.length = 0; // clear libs
			setFile("html");
			runSandbox();
			closeModal();
			showToast("Template loaded");
		});
	});
}

function showLibrariesModal() {
	const libs = [
		{ name: "Tailwind CSS", url: "https://cdn.tailwindcss.com", type: "js" },
		{
			name: "Bootstrap CSS",
			url: "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css",
			type: "css",
		},
		{
			name: "React",
			url: "https://unpkg.com/react@18/umd/react.development.js",
			type: "js",
		},
		{
			name: "React DOM",
			url: "https://unpkg.com/react-dom@18/umd/react-dom.development.js",
			type: "js",
		},
		{
			name: "jQuery",
			url: "https://code.jquery.com/jquery-3.7.0.min.js",
			type: "js",
		},
		{
			name: "Chart.js",
			url: "https://cdn.jsdelivr.net/npm/chart.js",
			type: "js",
		},
		{
			name: "Three.js",
			url: "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
			type: "js",
		},
		{
			name: "FontAwesome",
			url: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
			type: "css",
		},
	];

	let html = `<div style="margin-bottom:16px; color:var(--muted); font-size:0.85rem;">Click a library to add it to your project. It will be injected before your code runs.</div>
  <div style="margin-bottom:16px;">
    <strong>Currently Active:</strong>
    <ul id="activeLibs" style="margin-top:6px; padding-left:20px; font-size:0.85rem; color:var(--blue)">
      ${LIBRARIES.length === 0 ? '<li style="color:var(--muted)">None</li>' : LIBRARIES.map((l) => `<li>${l}</li>`).join("")}
    </ul>
    ${LIBRARIES.length > 0 ? `<button id="clearLibsBtn" class="modal-btn modal-btn-danger" style="margin-top:8px; font-size:0.75rem; padding:4px 10px;">Clear All</button>` : ""}
  </div>
  <div class="modal-grid">`;

	libs.forEach((l, i) => {
		html += `<div class="modal-card lib-card" data-idx="${i}">
      <span class="card-emoji">${l.type === "css" ? "🎨" : "⚙️"}</span>
      <div class="card-title">${l.name}</div>
    </div>`;
	});
	html += `</div>`;

	openModal("CDN Libraries", html);

	document.querySelectorAll(".lib-card").forEach((c) => {
		c.addEventListener("click", () => {
			const l = libs[c.dataset.idx];
			if (!LIBRARIES.includes(l.url)) {
				LIBRARIES.push(l.url);
				runSandbox();
				showToast(`Added ${l.name}`);
				showLibrariesModal(); // refresh UI
			}
		});
	});

	const clrBtn = document.getElementById("clearLibsBtn");
	if (clrBtn) {
		clrBtn.addEventListener("click", () => {
			LIBRARIES.length = 0;
			runSandbox();
			showToast("Libraries cleared");
			showLibrariesModal();
		});
	}
}

// ── Save & Load & Share & Export ──────────────────────────────────────────────
function saveProject() {
	saveCurrentFile();
	const name = prompt("Enter a name for this project:", "My Project");
	if (!name) return;

	const projects = JSON.parse(localStorage.getItem("sandbox_projects") || "[]");
	const data = {
		id: Date.now().toString(),
		name,
		date: new Date().toLocaleString(),
		files: { ...files },
		libs: [...LIBRARIES],
	};

	projects.push(data);
	localStorage.setItem("sandbox_projects", JSON.stringify(projects));
	showToast("Project saved locally! 💾");
}

function showProjectsModal() {
	const projects = JSON.parse(localStorage.getItem("sandbox_projects") || "[]");

	if (projects.length === 0) {
		openModal(
			"Saved Projects",
			`<div style="text-align:center; padding:40px; color:var(--muted)">No saved projects yet. Click "Save" in the header!</div>`,
		);
		return;
	}

	let html = `<div class="project-list">`;
	projects.reverse().forEach((p) => {
		html += `
      <div class="project-item" data-id="${p.id}">
        <div style="flex:1; overflow:hidden">
          <div class="proj-name">${p.name}</div>
          <div class="proj-date">${p.date}</div>
        </div>
        <button class="btn-mini load-proj-btn">Load</button>
        <button class="btn-mini-icon del-proj-btn" style="color:#ff7070">🗑</button>
      </div>
    `;
	});
	html += `</div>`;

	openModal("Saved Projects", html);

	document.querySelectorAll(".project-item").forEach((item) => {
		const id = item.dataset.id;
		const p = projects.find((x) => x.id === id);

		item.querySelector(".load-proj-btn").addEventListener("click", () => {
			files.html = p.files.html;
			files.css = p.files.css;
			files.js = p.files.js;
			LIBRARIES.length = 0;
			if (p.libs) LIBRARIES.push(...p.libs);
			setFile(getCurrentFile());
			runSandbox();
			closeModal();
			showToast(`Loaded ${p.name}`);
		});

		item.querySelector(".del-proj-btn").addEventListener("click", () => {
			if (confirm(`Delete "${p.name}"?`)) {
				const remaining = projects.filter((x) => x.id !== id);
				localStorage.setItem("sandbox_projects", JSON.stringify(remaining));
				showProjectsModal(); // refresh
			}
		});
	});
}

function generateShareURL() {
	saveCurrentFile();
	const data = JSON.stringify({ f: files, l: LIBRARIES });
	// Base64 encode the state and put it in hash
	const hash = btoa(encodeURIComponent(data));
	const url = window.location.origin + window.location.pathname + "#" + hash;

	const html = `
    <div style="margin-bottom:12px; font-size:0.9rem">Copy this URL to share your code:</div>
    <input type="text" class="share-url" id="shareUrlInput" value="${url}" readonly />
    <div style="display:flex; gap:8px">
      <button class="modal-btn modal-btn-primary" id="copyUrlBtn">Copy to Clipboard</button>
    </div>
  `;
	openModal("Share Project", html);

	setTimeout(() => {
		const input = document.getElementById("shareUrlInput");
		input.select();
		document.getElementById("copyUrlBtn").addEventListener("click", () => {
			navigator.clipboard.writeText(url);
			showToast("URL copied! 🔗");
			closeModal();
		});
	}, 10);
}

function exportProject() {
	saveCurrentFile();
	// Build a single standalone HTML file combining everything

	let libsHtml = LIBRARIES.map((url) => {
		if (url.endsWith(".css")) return `<link rel="stylesheet" href="${url}">`;
		return `<script src="${url}"><\/script>`;
	}).join("\n  ");

	const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sandbox Export</title>
  ${libsHtml}
  <style>
${files.css}
  </style>
</head>
<body>
${files.html}
  <script>
${files.js}
  <\/script>
</body>
</html>`;

	const blob = new Blob([fullHtml], { type: "text/html" });
	const a = document.createElement("a");
	a.href = URL.createObjectURL(blob);
	a.download = "sandbox-export.html";
	a.click();
	URL.revokeObjectURL(a.href);
	showToast("Exported as HTML ⬇");
}

function loadFromURLOrStorage() {
	const hash = window.location.hash.slice(1);
	if (hash) {
		try {
			const data = JSON.parse(decodeURIComponent(atob(hash)));
			if (data.f) {
				files.html = data.f.html || "";
				files.css = data.f.css || "";
				files.js = data.f.js || "";
			}
			if (data.l) {
				LIBRARIES.length = 0;
				LIBRARIES.push(...data.l);
			}
			window.location.hash = ""; // clean URL
			setFile("html");
			showToast("Loaded from URL! ✨");
		} catch (e) {
			console.error("Failed to load from URL", e);
		}
	} else {
		// Optionally auto-save/load last session in localStorage
		const saved = localStorage.getItem("sandbox_autosave");
		if (saved) {
			try {
				const data = JSON.parse(saved);
				files.html = data.f.html;
				files.css = data.f.css;
				files.js = data.f.js;
				LIBRARIES.length = 0;
				if (data.l) LIBRARIES.push(...data.l);
				setFile("html");
			} catch (e) {}
		}
	}

	// Setup auto-save before unload
	window.addEventListener("beforeunload", () => {
		saveCurrentFile();
		localStorage.setItem(
			"sandbox_autosave",
			JSON.stringify({ f: files, l: LIBRARIES }),
		);
	});
}

function openPreviewInNewTab() {
	saveCurrentFile();
	const w = window.open("", "_blank");

	let libsHtml = LIBRARIES.map((url) => {
		if (url.endsWith(".css")) return `<link rel="stylesheet" href="${url}">`;
		return `<script src="${url}"><\/script>`;
	}).join("\n  ");

	const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sandbox Preview</title>
  ${libsHtml}
  <style>
${files.css}
  </style>
</head>
<body>
${files.html}
  <script>
${files.js}
  <\/script>
</body>
</html>`;

	w.document.open();
	w.document.write(fullHtml);
	w.document.close();
}

// ── Console Renderer ──────────────────────────────────────────────────────────
let groupDepth = 0;

const TYPE_META = {
	log: { color: "#eaf2ff", icon: "" },
	info: { color: "#a5d4ff", icon: "ℹ" },
	warn: { color: "#ffd97d", icon: "⚠" },
	error: { color: "#ff7070", icon: "✖" },
	debug: { color: "#b0a5ff", icon: "⬡" },
	trace: { color: "#c8b8ff", icon: "⤷" },
	dir: { color: "#7de8c8", icon: "▶" },
	group: { color: "#a5d4ff", icon: "▼" },
	groupCollapsed: { color: "#a5d4ff", icon: "▶" },
	groupEnd: { color: null, icon: null },
	table: { color: "#7de8c8", icon: "⊞" },
	clear: { color: null, icon: null },
};

function handleConsoleMessage(e) {
	const d = e.data;
	if (!d || !d.__console) return;

	const { type, args, extra } = d;
	const text = args.join(" ");

	appendToConsole(type, text, extra?.json);
}

function appendToConsole(type, text, tableData) {
	const c = document.getElementById("console");
	const meta = TYPE_META[type] || TYPE_META.log;

	if (type === "clear") {
		c.innerHTML = "";
		groupDepth = 0;
		return;
	}
	if (type === "groupEnd") {
		groupDepth = Math.max(0, groupDepth - 1);
		return;
	}

	const row = document.createElement("div");
	row.className = `con-row con-${type}`;
	row.dataset.type = type; // for filtering
	row.style.paddingLeft = 8 + groupDepth * 16 + "px";

	if (meta.color) row.style.color = meta.color;

	// Add timestamp
	const ts = document.createElement("span");
	ts.className = "con-ts";
	const now = new Date();
	ts.textContent = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
	row.appendChild(ts);

	// Icon
	if (meta.icon) {
		const icon = document.createElement("span");
		icon.className = "con-icon";
		icon.textContent = meta.icon + " ";
		row.appendChild(icon);
	}

	if (type === "table" && tableData) {
		try {
			const data = JSON.parse(tableData);
			const keys = Array.isArray(data)
				? Object.keys(data[0] || {})
				: Object.keys(Object.values(data)[0] || {});

			const tbl = document.createElement("table");
			tbl.className = "con-table";

			const thead = tbl.createTHead();
			const hr = thead.insertRow();
			const thIdx = document.createElement("th");
			thIdx.textContent = "(index)";
			hr.appendChild(thIdx);
			keys.forEach((k) => {
				const th = document.createElement("th");
				th.textContent = k;
				hr.appendChild(th);
			});

			const tbody = tbl.createTBody();
			const entries = Array.isArray(data)
				? data.entries()
				: Object.entries(data);
			for (const [i, item] of entries) {
				const tr = tbody.insertRow();
				const tdIdx = tr.insertCell();
				tdIdx.textContent = i;
				keys.forEach((k) => {
					const td = tr.insertCell();
					td.textContent = item != null ? serialize(item[k]) : "";
				});
			}
			row.appendChild(tbl);
		} catch {
			row.appendChild(document.createTextNode(tableData));
		}
	} else if (type === "trace") {
		const pre = document.createElement("pre");
		pre.className = "con-pre";
		pre.textContent = text;
		row.appendChild(pre);
	} else {
		const lines = text.split("\n");
		if (lines.length > 1) {
			const pre = document.createElement("pre");
			pre.className = "con-pre";
			pre.textContent = text;
			row.appendChild(pre);
		} else {
			row.appendChild(document.createTextNode(text));
		}
	}

	if (type === "error") row.style.borderLeft = "3px solid #ff7070";
	if (type === "warn") row.style.borderLeft = "3px solid #ffd97d";

	// Apply active filter
	if (activeFilter !== "all") {
		if (activeFilter === "error" && type !== "error")
			row.classList.add("hidden");
		if (activeFilter === "warn" && type !== "warn" && type !== "error")
			row.classList.add("hidden");
		if (activeFilter === "log" && (type === "error" || type === "warn"))
			row.classList.add("hidden");
	}

	c.appendChild(row);
	c.scrollTop = c.scrollHeight;

	if (type === "group" || type === "groupCollapsed") groupDepth++;
}

function applyConsoleFilter() {
	document.querySelectorAll(".con-row").forEach((row) => {
		const type = row.dataset.type;
		row.classList.remove("hidden");
		if (activeFilter === "error" && type !== "error")
			row.classList.add("hidden");
		if (activeFilter === "warn" && type !== "warn" && type !== "error")
			row.classList.add("hidden");
		if (activeFilter === "log" && (type === "error" || type === "warn"))
			row.classList.add("hidden");
	});
}

function clearConsole() {
	document.getElementById("console").innerHTML = "";
	groupDepth = 0;
}

function serialize(val) {
	if (val === null || val === undefined) return String(val);
	if (typeof val === "object") {
		try {
			return JSON.stringify(val);
		} catch {
			return String(val);
		}
	}
	return String(val);
}

// ── Start ─────────────────────────────────────────────────────────────────────
init();
