const STORAGE_KEY = 'storyforge_ai_state_v1';
const ENDPOINT_KEY = 'storyforge_ai_endpoint_v1';
const DEPLOYED_ENDPOINT = 'https://story-ai.b4rjxr9lk.workers.dev/api/story';

const elements = {
	form: document.querySelector('#setupForm'),
	hero: document.querySelector('#heroInput'),
	setting: document.querySelector('#settingInput'),
	genre: document.querySelector('#genreInput'),
	tone: document.querySelector('#toneInput'),
	endpoint: document.querySelector('#endpointInput'),
	start: document.querySelector('#startButton'),
	reset: document.querySelector('#resetButton'),
	status: document.querySelector('#connectionStatus'),
	chapter: document.querySelector('#chapterLabel'),
	title: document.querySelector('#sceneTitle'),
	scene: document.querySelector('#sceneText'),
	choices: document.querySelector('#choiceList'),
	loading: document.querySelector('#loadingLine'),
	journal: document.querySelector('#journalList'),
	copy: document.querySelector('#copyButton'),
	toast: document.querySelector('#toast'),
	meters: {
		wonder: {
			value: document.querySelector('#wonderValue'),
			bar: document.querySelector('#wonderBar'),
		},
		danger: {
			value: document.querySelector('#dangerValue'),
			bar: document.querySelector('#dangerBar'),
		},
		resolve: {
			value: document.querySelector('#resolveValue'),
			bar: document.querySelector('#resolveBar'),
		},
	},
};

const defaultState = {
	chapter: 0,
	profile: {
		hero: 'Mara the mapmaker',
		setting: 'a library that unfolds into a moonlit kingdom',
		genre: 'fantasy',
		tone: 'mysterious',
	},
	stats: {
		wonder: 5,
		danger: 2,
		resolve: 4,
	},
	history: [],
	current: null,
};

let state = loadState();
let busy = false;

function defaultEndpoint() {
	if (location.port === '8787') {
		return `${location.origin}/api/story`;
	}

	return localStorage.getItem(ENDPOINT_KEY) || DEPLOYED_ENDPOINT;
}

function loadState() {
	try {
		return { ...structuredClone(defaultState), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
	} catch (_error) {
		return structuredClone(defaultState);
	}
}

function saveState() {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setBusy(nextBusy) {
	busy = nextBusy;
	elements.start.disabled = nextBusy;
	elements.reset.disabled = nextBusy;
	elements.loading.hidden = !nextBusy;
	elements.status.textContent = nextBusy ? 'Writing' : 'Ready';

	for (const button of elements.choices.querySelectorAll('button')) {
		button.disabled = nextBusy;
	}
}

function showToast(message) {
	elements.toast.textContent = message;
	elements.toast.hidden = false;
	clearTimeout(showToast.timer);
	showToast.timer = setTimeout(() => {
		elements.toast.hidden = true;
	}, 2800);
}

function clampStat(value) {
	return Math.max(0, Math.min(10, value));
}

function applyStats(delta = {}) {
	for (const key of Object.keys(state.stats)) {
		state.stats[key] = clampStat(state.stats[key] + (Number.parseInt(delta[key] || 0, 10) || 0));
	}
}

function profileFromForm() {
	return {
		hero: elements.hero.value.trim() || defaultState.profile.hero,
		setting: elements.setting.value.trim() || defaultState.profile.setting,
		genre: elements.genre.value,
		tone: elements.tone.value,
	};
}

function syncForm() {
	elements.hero.value = state.profile.hero;
	elements.setting.value = state.profile.setting;
	elements.genre.value = state.profile.genre;
	elements.tone.value = state.profile.tone;
	elements.endpoint.value = defaultEndpoint();
}

function renderMeters() {
	for (const [key, meter] of Object.entries(elements.meters)) {
		const value = state.stats[key];
		meter.value.textContent = value;
		meter.bar.style.width = `${value * 10}%`;
	}
}

function renderChoices() {
	elements.choices.replaceChildren();

	if (!state.current) {
		return;
	}

	for (const [index, choice] of state.current.choices.entries()) {
		const button = document.createElement('button');
		button.className = 'choice-button';
		button.type = 'button';
		button.innerHTML = `<span>${index + 1}</span><strong></strong>`;
		button.querySelector('strong').textContent = choice;
		button.addEventListener('click', () => advance(choice));
		elements.choices.append(button);
	}
}

function renderJournal() {
	elements.journal.replaceChildren();

	if (state.history.length === 0) {
		const item = document.createElement('li');
		item.textContent = 'Your choices will appear here.';
		elements.journal.append(item);
		return;
	}

	for (const entry of state.history) {
		const item = document.createElement('li');
		item.textContent = entry.picked ? `${entry.title}: ${entry.picked}` : entry.title;
		elements.journal.append(item);
	}
}

function render() {
	elements.chapter.textContent = `Chapter ${state.chapter}`;

	if (state.current) {
		elements.title.textContent = state.current.title;
		elements.scene.textContent = state.current.scene;
	} else {
		elements.title.textContent = 'The book is waiting.';
		elements.scene.textContent =
			'Name your hero, choose the kind of tale you want, and begin. Each choice asks the Cloudflare Worker to continue the story with Workers AI.';
	}

	renderMeters();
	renderChoices();
	renderJournal();
}

async function requestStory(action = '') {
	const endpoint = elements.endpoint.value.trim();
	if (!endpoint) {
		showToast('Add your Worker endpoint first.');
		return null;
	}

	localStorage.setItem(ENDPOINT_KEY, endpoint);
	setBusy(true);

	try {
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				...state.profile,
				action,
				history: state.history.slice(-8),
			}),
		});
		const data = await response.json().catch(() => ({}));

		if (!response.ok) {
			throw new Error(data.error || `Story request failed with ${response.status}.`);
		}

		if (!data.story || !Array.isArray(data.story.choices)) {
			throw new Error('The Worker returned an unexpected story shape.');
		}

		elements.status.textContent = data.model ? 'AI ready' : 'Ready';
		return data.story;
	} catch (_error) {
		elements.status.textContent = 'Needs attention';
		showToast(error.message || 'The story request failed.');
		return null;
	} finally {
		setBusy(false);
	}
}

async function begin(event) {
	event.preventDefault();
	if (busy) {
		return;
	}

	state = structuredClone(defaultState);
	state.profile = profileFromForm();
	const story = await requestStory();

	if (!story) {
		return;
	}

	state.chapter = 1;
	state.current = story;
	applyStats(story.stats);
	state.history = [{ title: story.title, scene: story.scene, picked: '' }];
	saveState();
	render();
}

async function advance(choice) {
	if (busy || !state.current) {
		return;
	}

	state.history[state.history.length - 1] = {
		...state.history[state.history.length - 1],
		picked: choice,
	};

	const story = await requestStory(choice);
	if (!story) {
		renderJournal();
		return;
	}

	state.chapter += 1;
	state.current = story;
	applyStats(story.stats);
	state.history.push({ title: story.title, scene: story.scene, picked: '' });
	saveState();
	render();
}

function resetStory() {
	if (busy) {
		return;
	}

	state = structuredClone(defaultState);
	state.profile = profileFromForm();
	localStorage.removeItem(STORAGE_KEY);
	render();
	showToast('New story sheet ready.');
}

async function copyJournal() {
	const lines = state.history.map((entry, index) => {
		const choice = entry.picked ? ` Choice: ${entry.picked}` : '';
		return `${index + 1}. ${entry.title}.${choice}\n${entry.scene}`;
	});
	const text = lines.join('\n\n') || 'No story yet.';

	try {
		await navigator.clipboard.writeText(text);
		showToast('Journal copied.');
	} catch (_error) {
		showToast('Clipboard is unavailable in this browser.');
	}
}

elements.form.addEventListener('submit', begin);
elements.reset.addEventListener('click', resetStory);
elements.copy.addEventListener('click', copyJournal);
syncForm();
render();
