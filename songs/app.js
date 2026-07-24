const WORKER_URL = "https://song-maker.b4rjxr9lk.workers.dev";

const ui = {
	form: document.querySelector("#songForm"),
	theme: document.querySelector("#theme"),
	tone: document.querySelector("#tone"),
	rhymeStyle: document.querySelector("#rhymeStyle"),
	style: document.querySelector("#style"),
	instructions: document.querySelector("#instructions"),
	lyrics: document.querySelector("#lyrics"),
	generateLyrics: document.querySelector("#generateLyrics"),
	instrumental: document.querySelector("#instrumental"),
	generateLyricsBtn: document.querySelector("#generateLyricsBtn"),
	rewriteLyricsBtn: document.querySelector("#rewriteLyricsBtn"),
	makeSongBtn: document.querySelector("#makeSongBtn"),
	status: document.querySelector("#status"),
	info: document.querySelector("#info"),
	player: document.querySelector("#player"),
	download: document.querySelector("#download"),
	healthDot: document.querySelector("#healthDot"),
	healthText: document.querySelector("#healthText"),
};

const busyButtons = [ui.generateLyricsBtn, ui.rewriteLyricsBtn, ui.makeSongBtn];

function setBusy(isBusy, message) {
	for (const button of busyButtons) {
		button.disabled = isBusy;
	}
	ui.status.textContent = message;
}

function setHealth(kind, message) {
	ui.healthDot.classList.remove("ready", "error");
	if (kind) {
		ui.healthDot.classList.add(kind);
	}
	ui.healthText.textContent = message;
}

function values() {
	return {
		theme: ui.theme.value.trim(),
		tone: ui.tone.value,
		rhymeStyle: ui.rhymeStyle.value,
		style: ui.style.value.trim(),
		instructions: ui.instructions.value.trim(),
		lyrics: ui.lyrics.value.trim(),
		generateLyrics: ui.generateLyrics.checked,
		instrumental: ui.instrumental.checked,
	};
}

async function post(path, body) {
	const response = await fetch(`${WORKER_URL}${path}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	const data = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(data.error || "Request failed.");
	}
	return data;
}

function showSong(data) {
	if (!data.audioUrl) {
		throw new Error("MiniMax did not return an audio URL.");
	}
	ui.player.src = data.audioUrl;
	ui.download.href = data.audioUrl;
	ui.player.hidden = false;
	ui.download.hidden = false;
	ui.info.textContent = data.info
		? `MiniMax info: ${JSON.stringify(data.info)}`
		: data.expiresIn || "Song ready.";
}

async function generateLyrics(includeExisting) {
	const current = values();
	setBusy(
		true,
		includeExisting ? "Rewriting lyrics..." : "Generating lyrics...",
	);
	try {
		const data = await post("/api/lyrics", {
			theme: current.theme,
			tone: current.tone,
			rhymeStyle: current.rhymeStyle,
			instructions: current.instructions,
			lyrics: includeExisting ? current.lyrics : "",
		});
		ui.lyrics.value = data.lyrics || current.lyrics;
		ui.info.textContent =
			[data.title, data.styleTags].filter(Boolean).join(" | ") ||
			"MiniMax lyrics ready.";
		setBusy(false, includeExisting ? "Rewrite ready." : "Lyrics ready.");
	} catch (error) {
		setBusy(false, error.message);
	}
}

async function makeSong() {
	const current = values();
	ui.player.hidden = true;
	ui.download.hidden = true;
	setBusy(true, "Making song...");
	try {
		const data = await post("/api/song", {
			prompt: current.style,
			lyrics: current.lyrics,
			generateLyrics: current.generateLyrics,
			instrumental: current.instrumental,
		});
		showSong(data);
		setBusy(false, "Song ready.");
	} catch (error) {
		setBusy(false, error.message);
	}
}

async function checkHealth() {
	try {
		const response = await fetch(`${WORKER_URL}/health`);
		const data = await response.json();
		if (data.ok && data.hasKey) {
			setHealth("ready", "Worker ready");
			return;
		}
		setHealth("error", "Worker missing key");
	} catch {
		setHealth("error", "Worker offline");
	}
}

ui.generateLyricsBtn.addEventListener("click", () => generateLyrics(false));
ui.rewriteLyricsBtn.addEventListener("click", () => generateLyrics(true));
ui.form.addEventListener("submit", (event) => {
	event.preventDefault();
	makeSong();
});

checkHealth();
