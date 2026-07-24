const MINIMAX_BASE_URL = "https://api.minimax.io/v1";
const MUSIC_MODEL = "music-2.6-free";
const LYRICS_MODEL = "@cf/zai-org/glm-4.7-flash";
const JSON_HEADERS = {
	"content-type": "application/json; charset=utf-8",
	"access-control-allow-origin": "*",
	"access-control-allow-methods": "GET, POST, OPTIONS",
	"access-control-allow-headers": "content-type, authorization",
};

const AUDIO_SETTING = {
	sample_rate: 44100,
	bitrate: 256000,
	format: "mp3",
};

function json(data, init = {}) {
	return new Response(JSON.stringify(data, null, 2), {
		...init,
		headers: {
			...JSON_HEADERS,
			...(init.headers || {}),
		},
	});
}

function html(markup, init = {}) {
	return new Response(markup, {
		...init,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"access-control-allow-origin": "*",
			...(init.headers || {}),
		},
	});
}

async function readJson(request) {
	try {
		return await request.json();
	} catch {
		throw new Response(JSON.stringify({ error: "Send a JSON body." }), {
			status: 400,
			headers: JSON_HEADERS,
		});
	}
}

function cleanText(value, fallback = "") {
	return typeof value === "string" ? value.trim() : fallback;
}

function limitText(value, max) {
	const text = cleanText(value);
	return text.length > max ? text.slice(0, max) : text;
}

function requireApiKey(env) {
	const key = cleanText(env.MINIMAX_API_KEY);
	if (!key) {
		throw json(
			{
				error: "MINIMAX_API_KEY is not configured on this Worker.",
				howToFix: "Run: npx wrangler secret put MINIMAX_API_KEY",
			},
			{ status: 500 },
		);
	}
	return key;
}

async function callMiniMax(env, endpoint, payload) {
	const response = await fetch(`${MINIMAX_BASE_URL}${endpoint}`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${requireApiKey(env)}`,
			"content-type": "application/json",
		},
		body: JSON.stringify(payload),
	});
	const text = await response.text();
	let data;
	try {
		data = text ? JSON.parse(text) : {};
	} catch {
		data = { raw: text };
	}

	if (!response.ok || data?.base_resp?.status_code) {
		return {
			ok: false,
			status: response.status,
			data,
			message:
				data?.base_resp?.status_msg ||
				data?.message ||
				data?.error ||
				"MiniMax request failed.",
		};
	}

	return { ok: true, status: response.status, data };
}

function buildLyricsPrompt({ theme, tone, rhymeStyle, instructions }) {
	const parts = [
		theme ? `Theme: ${theme}` : "Theme: user-suggested original song",
		tone ? `Tone: ${tone}` : "Tone: memorable and singable",
		rhymeStyle
			? `Rhyme style: ${rhymeStyle}`
			: "Rhyme style: natural end rhymes",
		instructions ? `Extra direction: ${instructions}` : "",
		"Use clear section tags such as [Verse], [Chorus], and [Bridge].",
		"Keep the words easy to sing.",
	];
	return parts.filter(Boolean).join("\n");
}

function requireAiBinding(env) {
	if (!env.AI?.run) {
		throw json(
			{
				error: "Workers AI is not configured on this Worker.",
				howToFix: 'Add an AI binding named "AI" to wrangler.jsonc.',
			},
			{ status: 500 },
		);
	}
	return env.AI;
}

function extractAiText(result) {
	if (typeof result?.response === "string") {
		return result.response.trim();
	}
	const content = result?.choices?.[0]?.message?.content;
	if (typeof content === "string") {
		return content.trim();
	}
	if (Array.isArray(content)) {
		return content
			.map((part) => part?.text || part?.content || "")
			.join("")
			.trim();
	}
	return "";
}

function parseLyricsResponse(text) {
	const cleaned = text
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/i, "")
		.trim();
	try {
		const data = JSON.parse(cleaned);
		return {
			title: cleanText(data.title),
			styleTags: cleanText(data.styleTags || data.style_tags),
			lyrics: cleanText(data.lyrics) || cleaned,
		};
	} catch {
		return { title: "", styleTags: "", lyrics: cleaned };
	}
}

async function handleLyrics(request, env) {
	const body = await readJson(request);
	const existingLyrics = limitText(body.lyrics, 3500);
	const prompt = buildLyricsPrompt({
		theme: limitText(body.theme || body.prompt, 1000),
		tone: limitText(body.tone, 200),
		rhymeStyle: limitText(body.rhymeStyle, 200),
		instructions: limitText(body.instructions, 700),
	});
	const ai = requireAiBinding(env);
	const title = limitText(body.title, 120);
	const messages = [
		{
			role: "system",
			content:
				"You write polished, original song lyrics. Return only compact JSON with string fields: title, styleTags, lyrics. Lyrics must use clear section tags such as [Verse], [Chorus], and [Bridge].",
		},
		{
			role: "user",
			content: [
				existingLyrics
					? "Rewrite these lyrics using the direction below. Preserve useful ideas, improve flow, rhyme, and singability."
					: "Write a complete original song using the direction below.",
				title ? `Title: ${title}` : "",
				prompt,
				existingLyrics ? `Existing lyrics:\n${existingLyrics}` : "",
			]
				.filter(Boolean)
				.join("\n\n"),
		},
	];
	let result;
	try {
		result = await ai.run(LYRICS_MODEL, {
			messages,
			max_completion_tokens: 1800,
			temperature: 0.8,
		});
	} catch (error) {
		return json(
			{
				error: error?.message || "Workers AI lyrics generation failed.",
				provider: "workers-ai",
				model: LYRICS_MODEL,
			},
			{ status: 502 },
		);
	}
	const parsed = parseLyricsResponse(extractAiText(result));

	if (!parsed.lyrics) {
		return json(
			{
				error: "Workers AI returned an empty lyrics response.",
				provider: "workers-ai",
				model: LYRICS_MODEL,
				raw: result,
			},
			{ status: 502 },
		);
	}

	return json({
		title: parsed.title,
		styleTags: parsed.styleTags,
		lyrics: parsed.lyrics,
		provider: "workers-ai",
		model: LYRICS_MODEL,
		raw: result,
	});
}

async function handleSong(request, env) {
	const body = await readJson(request);
	const prompt = limitText(body.prompt || body.style, 2000);
	const lyrics = limitText(body.lyrics, 3500);
	const instrumental = Boolean(body.instrumental);

	if (!prompt && instrumental) {
		return json(
			{ error: "Add a style prompt for instrumental generation." },
			{ status: 400 },
		);
	}

	if (!lyrics && !instrumental && !body.generateLyrics) {
		return json(
			{
				error:
					"Add lyrics, or enable AI-generated lyrics before making a vocal song.",
			},
			{ status: 400 },
		);
	}

	const payload = {
		model: MUSIC_MODEL,
		prompt,
		audio_setting: AUDIO_SETTING,
		output_format: "url",
		lyrics_optimizer: Boolean(body.generateLyrics && !lyrics && !instrumental),
		is_instrumental: instrumental,
		...(lyrics && !instrumental ? { lyrics } : {}),
	};

	const result = await callMiniMax(env, "/music_generation", payload);
	if (!result.ok) {
		return json(
			{ error: result.message, provider: result.data },
			{ status: result.status || 502 },
		);
	}

	return json({
		audioUrl: result.data?.data?.audio || "",
		status: result.data?.data?.status ?? null,
		model: MUSIC_MODEL,
		provider: "minimax",
		expiresIn: "MiniMax audio URLs expire after 24 hours.",
		info: result.data?.extra_info || null,
		raw: result.data,
	});
}

function appShell() {
	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Song Maker</title>
	<style>
		:root {
			color-scheme: light;
			--ink: #14120f;
			--muted: #615f5a;
			--line: #d8d2c7;
			--paper: #f7f2e8;
			--panel: #fffaf0;
			--accent: #d84d33;
			--accent-2: #0c7c7c;
			--dark: #1f2a2b;
		}
		* { box-sizing: border-box; }
		body {
			margin: 0;
			font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			color: var(--ink);
			background: linear-gradient(180deg, #f9f4eb 0%, #edf3f1 100%);
			min-height: 100vh;
		}
		main {
			width: min(1180px, calc(100vw - 28px));
			margin: 0 auto;
			padding: 28px 0 40px;
		}
		header {
			display: grid;
			grid-template-columns: 1.2fr 0.8fr;
			gap: 24px;
			align-items: end;
			padding: 18px 0 26px;
		}
		h1 {
			margin: 0;
			font-size: clamp(2.2rem, 7vw, 5.5rem);
			line-height: 0.9;
			letter-spacing: 0;
		}
		.lead {
			margin: 0;
			color: var(--muted);
			font-size: 1rem;
			line-height: 1.5;
		}
		.workspace {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 360px;
			gap: 18px;
			align-items: start;
		}
		.panel {
			background: rgba(255, 250, 240, 0.92);
			border: 1px solid var(--line);
			border-radius: 8px;
			padding: 18px;
			box-shadow: 0 18px 50px rgba(31, 42, 43, 0.08);
		}
		.field {
			display: grid;
			gap: 7px;
			margin-bottom: 14px;
		}
		label {
			font-size: 0.78rem;
			font-weight: 800;
			text-transform: uppercase;
			color: var(--dark);
		}
		input, textarea, select {
			width: 100%;
			border: 1px solid var(--line);
			border-radius: 6px;
			background: white;
			color: var(--ink);
			font: inherit;
			padding: 11px 12px;
			outline: none;
		}
		textarea {
			min-height: 330px;
			resize: vertical;
			line-height: 1.45;
		}
		input:focus, textarea:focus, select:focus {
			border-color: var(--accent-2);
			box-shadow: 0 0 0 3px rgba(12, 124, 124, 0.14);
		}
		.row {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 12px;
		}
		.actions {
			display: flex;
			flex-wrap: wrap;
			gap: 10px;
			margin-top: 16px;
		}
		button, a.download {
			border: 0;
			border-radius: 6px;
			background: var(--dark);
			color: white;
			font: inherit;
			font-weight: 800;
			padding: 11px 14px;
			cursor: pointer;
			text-decoration: none;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-height: 42px;
		}
		button.secondary {
			background: var(--accent-2);
		}
		button.warn {
			background: var(--accent);
		}
		button:disabled {
			cursor: wait;
			opacity: 0.65;
		}
		.toggle {
			display: flex;
			gap: 9px;
			align-items: center;
			margin: 8px 0;
			color: var(--muted);
		}
		.toggle input {
			width: 18px;
			height: 18px;
		}
		.output {
			display: grid;
			gap: 12px;
		}
		audio {
			width: 100%;
		}
		.status {
			min-height: 24px;
			color: var(--muted);
			line-height: 1.45;
		}
		.meta {
			border-top: 1px solid var(--line);
			margin-top: 14px;
			padding-top: 12px;
			color: var(--muted);
			font-size: 0.88rem;
			line-height: 1.45;
		}
		@media (max-width: 860px) {
			header, .workspace, .row {
				grid-template-columns: 1fr;
			}
			textarea {
				min-height: 260px;
			}
		}
	</style>
</head>
<body>
	<main>
		<header>
			<h1>Song Maker</h1>
			<p class="lead">Write lyrics yourself, reshape them for tighter rhymes or a new tone, then make a full MP3 with MiniMax Music free.</p>
		</header>
		<section class="workspace">
			<div class="panel">
				<div class="row">
					<div class="field">
						<label for="theme">Theme</label>
						<input id="theme" placeholder="late-night drive, summer crush, boss battle">
					</div>
					<div class="field">
						<label for="tone">Tone</label>
						<select id="tone">
							<option>catchy and bright</option>
							<option>sad and intimate</option>
							<option>angry and cinematic</option>
							<option>funny and playful</option>
							<option>dark and dramatic</option>
							<option>hopeful anthem</option>
						</select>
					</div>
				</div>
				<div class="row">
					<div class="field">
						<label for="rhymeStyle">Rhyme</label>
						<select id="rhymeStyle">
							<option>natural end rhymes</option>
							<option>tight AABB rhymes</option>
							<option>internal rhymes</option>
							<option>simple pop rhymes</option>
							<option>rap multisyllable rhymes</option>
						</select>
					</div>
					<div class="field">
						<label for="style">Music Style</label>
						<input id="style" value="Pop, polished, radio-ready, warm vocals, strong chorus">
					</div>
				</div>
				<div class="field">
					<label for="instructions">Direction</label>
					<input id="instructions" placeholder="make the chorus huge, make verses rhyme more, use a gentler tone">
				</div>
				<div class="field">
					<label for="lyrics">Lyrics</label>
					<textarea id="lyrics" placeholder="[Verse]\nType lyrics here, or leave empty and generate some.\n\n[Chorus]\nGive me a hook that sticks."></textarea>
				</div>
				<label class="toggle">
					<input type="checkbox" id="generateLyrics">
					<span>Let MiniMax generate lyrics from the style prompt if the lyrics box is empty</span>
				</label>
				<label class="toggle">
					<input type="checkbox" id="instrumental">
					<span>Instrumental only</span>
				</label>
				<div class="actions">
					<button class="secondary" id="lyricsBtn" type="button">Generate Lyrics</button>
					<button id="rewriteBtn" type="button">Rewrite Lyrics</button>
					<button class="warn" id="songBtn" type="button">Make Song</button>
				</div>
			</div>
			<aside class="panel output">
				<div class="status" id="status">Ready.</div>
				<audio id="player" controls hidden></audio>
				<a class="download" id="download" hidden download="minimax-song.mp3">Download MP3</a>
				<div class="meta" id="meta">Model: music-2.6-free</div>
			</aside>
		</section>
	</main>
	<script>
		const $ = (id) => document.getElementById(id);
		const fields = {
			theme: $('theme'),
			tone: $('tone'),
			rhymeStyle: $('rhymeStyle'),
			style: $('style'),
			instructions: $('instructions'),
			lyrics: $('lyrics'),
			generateLyrics: $('generateLyrics'),
			instrumental: $('instrumental'),
			status: $('status'),
			meta: $('meta'),
			player: $('player'),
			download: $('download'),
		};
		const buttons = [$('lyricsBtn'), $('rewriteBtn'), $('songBtn')];

		function setBusy(isBusy, message) {
			buttons.forEach((button) => button.disabled = isBusy);
			fields.status.textContent = message;
		}

		async function post(path, body) {
			const response = await fetch(path, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body),
			});
			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(data.error || 'Request failed.');
			}
			return data;
		}

		function lyricPayload(includeExisting) {
			return {
				theme: fields.theme.value,
				tone: fields.tone.value,
				rhymeStyle: fields.rhymeStyle.value,
				instructions: fields.instructions.value,
				lyrics: includeExisting ? fields.lyrics.value : '',
			};
		}

		$('lyricsBtn').addEventListener('click', async () => {
			try {
				setBusy(true, 'Generating lyrics...');
				const data = await post('/api/lyrics', lyricPayload(false));
				fields.lyrics.value = data.lyrics || '';
				fields.meta.textContent = [data.title, data.styleTags].filter(Boolean).join(' | ') || 'Lyrics ready.';
				setBusy(false, 'Lyrics ready.');
			} catch (error) {
				setBusy(false, error.message);
			}
		});

		$('rewriteBtn').addEventListener('click', async () => {
			try {
				setBusy(true, 'Rewriting lyrics...');
				const data = await post('/api/lyrics', lyricPayload(true));
				fields.lyrics.value = data.lyrics || fields.lyrics.value;
				fields.meta.textContent = [data.title, data.styleTags].filter(Boolean).join(' | ') || 'Rewrite ready.';
				setBusy(false, 'Rewrite ready.');
			} catch (error) {
				setBusy(false, error.message);
			}
		});

		$('songBtn').addEventListener('click', async () => {
			try {
				setBusy(true, 'Making song...');
				fields.player.hidden = true;
				fields.download.hidden = true;
				const data = await post('/api/song', {
					prompt: fields.style.value,
					lyrics: fields.lyrics.value,
					generateLyrics: fields.generateLyrics.checked,
					instrumental: fields.instrumental.checked,
				});
				if (!data.audioUrl) {
					throw new Error('MiniMax did not return an audio URL.');
				}
				fields.player.src = data.audioUrl;
				fields.download.href = data.audioUrl;
				fields.player.hidden = false;
				fields.download.hidden = false;
				fields.meta.textContent = data.info ? JSON.stringify(data.info) : data.expiresIn;
				setBusy(false, 'Song ready.');
			} catch (error) {
				setBusy(false, error.message);
			}
		});
	</script>
</body>
</html>`;
}

async function route(request, env) {
	const url = new URL(request.url);
	if (request.method === "OPTIONS") {
		return new Response(null, { status: 204, headers: JSON_HEADERS });
	}
	if (url.pathname === "/health") {
		return json({
			ok: true,
			provider: "minimax",
			model: MUSIC_MODEL,
			lyricsProvider: "workers-ai",
			lyricsModel: LYRICS_MODEL,
			hasAi: Boolean(env.AI?.run),
			hasKey: Boolean(env.MINIMAX_API_KEY),
		});
	}
	if (request.method === "POST" && url.pathname === "/api/lyrics") {
		return handleLyrics(request, env);
	}
	if (request.method === "POST" && url.pathname === "/api/song") {
		return handleSong(request, env);
	}
	if (
		request.method === "GET" &&
		(url.pathname === "/" || url.pathname === "/index.html")
	) {
		return html(appShell());
	}
	return json({ error: "Not found." }, { status: 404 });
}

export default {
	async fetch(request, env) {
		try {
			return await route(request, env);
		} catch (error) {
			if (error instanceof Response) {
				return error;
			}
			return json(
				{ error: error?.message || "Unexpected Worker error." },
				{ status: 500 },
			);
		}
	},
};
