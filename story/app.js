const STORAGE_KEY = 'storyforge_ai_state_v1';
const SAVED_STORIES_KEY = 'storyforge_saved_stories_v1';
const ACCOUNT_APP_ID = 'storyforge';
const ACCOUNT_SAVED_STORIES_KEY = 'saved-stories';
const WORKER_URL = 'https://story-ai.b4rjxr9lk.workers.dev/api/story';

const elements = {
	form: document.querySelector('#setupForm'),
	hero: document.querySelector('#heroInput'),
	setting: document.querySelector('#settingInput'),
	genre: document.querySelector('#genreInput'),
	tone: document.querySelector('#toneInput'),
	start: document.querySelector('#startButton'),
	saveStory: document.querySelector('#saveStoryButton'),
	reset: document.querySelector('#resetButton'),
	status: document.querySelector('#connectionStatus'),
	chapter: document.querySelector('#chapterLabel'),
	title: document.querySelector('#sceneTitle'),
	scene: document.querySelector('#sceneText'),
	choices: document.querySelector('#choiceList'),
	loading: document.querySelector('#loadingLine'),
	journal: document.querySelector('#journalList'),
	savedStories: document.querySelector('#savedStoryList'),
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
	pages: [],
	savedStoryId: '',
};

let state = loadState();
let savedStories = loadSavedStories();
let busy = false;
let accountStoriesLoaded = false;

function loadState() {
	try {
		return { ...structuredClone(defaultState), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
	} catch (_error) {
		return structuredClone(defaultState);
	}
}

function saveState() {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	if (state.savedStoryId) {
		upsertSavedStory(createStorySnapshot(state.savedStoryId), { silent: true });
	}
}

function setBusy(nextBusy) {
	busy = nextBusy;
	elements.start.disabled = nextBusy;
	elements.reset.disabled = nextBusy;
	elements.start.textContent = nextBusy ? 'Writing...' : 'Begin';
	elements.loading.hidden = !nextBusy;
	elements.status.textContent = nextBusy ? 'Writing' : 'Ready';

	for (const button of elements.choices.querySelectorAll('button')) {
		button.disabled = nextBusy;
	}
	if (elements.saveStory) elements.saveStory.disabled = nextBusy || !state.current;
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

function renderSavedStories() {
	elements.savedStories.replaceChildren();

	if (!savedStories.length) {
		const empty = document.createElement('p');
		empty.className = 'empty-note';
		empty.textContent = 'Saved stories will appear here.';
		elements.savedStories.append(empty);
		return;
	}

	for (const story of savedStories) {
		const card = document.createElement('article');
		card.className = 'saved-story-card';

		const body = document.createElement('button');
		body.className = 'saved-story-main';
		body.type = 'button';
		body.innerHTML = '<strong></strong><span></span>';
		body.querySelector('strong').textContent = story.title || 'Untitled story';
		body.querySelector('span').textContent = `${story.profile?.hero || 'Hero'} · Chapter ${story.chapter || 0}`;
		body.addEventListener('click', () => loadSavedStory(story.id));

		const remove = document.createElement('button');
		remove.className = 'saved-story-delete';
		remove.type = 'button';
		remove.setAttribute('aria-label', `Delete ${story.title || 'story'}`);
		remove.textContent = 'Delete';
		remove.addEventListener('click', () => deleteSavedStory(story.id));

		card.append(body, remove);
		elements.savedStories.append(card);
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
			'Choose a hero, set the world, and begin. Your next page will appear here with three paths forward.';
	}

	renderMeters();
	renderChoices();
	renderJournal();
	renderSavedStories();
	if (elements.saveStory) elements.saveStory.disabled = busy || !state.current;
}

function focusStoryOnSmallScreens() {
	if (window.matchMedia('(max-width: 760px)').matches) {
		document.querySelector('.scene-panel').scrollIntoView({ block: 'start', behavior: 'smooth' });
	}
}

async function requestStoryBatch(action = '') {
	setBusy(true);

	try {
		const response = await fetch(WORKER_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				...state.profile,
				action,
				history: state.history.slice(-8),
				pageCount: 8,
			}),
		});
		const data = await response.json().catch(() => ({}));

		if (!response.ok) {
			throw new Error(data.error || `Story request failed with ${response.status}.`);
		}

		const pages = Array.isArray(data.pages) ? data.pages : data.story ? [data.story] : [];
		if (!pages.length || pages.some((page) => !Array.isArray(page.choices))) {
			throw new Error('The Worker returned an unexpected story shape.');
		}

		elements.status.textContent = data.model ? 'AI ready' : 'Ready';
		return pages;
	} catch (error) {
		elements.status.textContent = 'Needs attention';
		showToast(error.message || 'The story request failed. Check your connection and try again.');
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
	const pages = await requestStoryBatch();

	if (!pages) {
		return;
	}

	const [story, ...upcomingPages] = pages;
	state.chapter = 1;
	state.current = story;
	state.pages = upcomingPages;
	state.savedStoryId = '';
	applyStats(story.stats);
	state.history = [{ title: story.title, scene: story.scene, picked: '' }];
	saveState();
	render();
	focusStoryOnSmallScreens();
}

async function advance(choice) {
	if (busy || !state.current) {
		return;
	}

	state.history[state.history.length - 1] = {
		...state.history[state.history.length - 1],
		picked: choice,
	};

	let story = state.pages.shift();
	if (!story) {
		const pages = await requestStoryBatch(choice);
		if (!pages) {
			renderJournal();
			return;
		}
		[story] = pages;
		state.pages = pages.slice(1);
	}

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
	focusStoryOnSmallScreens();
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

function loadSavedStories() {
	try {
		const parsed = JSON.parse(localStorage.getItem(SAVED_STORIES_KEY) || '[]');
		return Array.isArray(parsed) ? parsed : [];
	} catch (_error) {
		return [];
	}
}

function writeSavedStories() {
	localStorage.setItem(SAVED_STORIES_KEY, JSON.stringify(savedStories.slice(0, 24)));
	saveSavedStoriesToAccount();
}

function createStorySnapshot(id = '') {
	const storyId = id || `story-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
	const title = state.current?.title || `${state.profile.hero}'s story`;
	return {
		id: storyId,
		title,
		updatedAt: Date.now(),
		chapter: state.chapter,
		profile: structuredClone(state.profile),
		stats: structuredClone(state.stats),
		history: structuredClone(state.history),
		current: structuredClone(state.current),
		pages: structuredClone(state.pages),
	};
}

function upsertSavedStory(story, options = {}) {
	if (!story || !story.current) return null;
	savedStories = [story, ...savedStories.filter((item) => item.id !== story.id)].slice(0, 24);
	writeSavedStories();
	if (!options.silent) {
		showToast('Story saved.');
	}
	renderSavedStories();
	return story;
}

function saveCurrentStory() {
	if (!state.current) {
		showToast('Begin a story first.');
		return;
	}
	const story = upsertSavedStory(createStorySnapshot(state.savedStoryId));
	if (story) {
		state.savedStoryId = story.id;
		saveState();
		render();
	}
}

function loadSavedStory(id) {
	const story = savedStories.find((item) => item.id === id);
	if (!story) return;
	state = {
		...structuredClone(defaultState),
		chapter: Number(story.chapter) || 0,
		profile: structuredClone(story.profile || defaultState.profile),
		stats: structuredClone(story.stats || defaultState.stats),
		history: Array.isArray(story.history) ? structuredClone(story.history) : [],
		current: story.current ? structuredClone(story.current) : null,
		pages: Array.isArray(story.pages) ? structuredClone(story.pages) : [],
		savedStoryId: story.id,
	};
	saveState();
	syncForm();
	render();
	focusStoryOnSmallScreens();
	showToast('Story loaded.');
}

function deleteSavedStory(id) {
	savedStories = savedStories.filter((story) => story.id !== id);
	if (state.savedStoryId === id) {
		state.savedStoryId = '';
		saveState();
	}
	writeSavedStories();
	render();
	showToast('Story deleted.');
}

async function loadSavedStoriesFromAccount() {
	const accounts = window.JacobAccounts;
	if (accountStoriesLoaded || !accounts || !accounts.isSignedIn || !accounts.isSignedIn()) return;
	accountStoriesLoaded = true;
	try {
		const record = await accounts.getData(ACCOUNT_APP_ID, ACCOUNT_SAVED_STORIES_KEY);
		const remoteStories = Array.isArray(record?.value) ? record.value : [];
		if (remoteStories.length) {
			const localById = new Map(savedStories.map((story) => [story.id, story]));
			for (const remote of remoteStories) {
				const local = localById.get(remote.id);
				if (!local || Number(remote.updatedAt || 0) > Number(local.updatedAt || 0)) {
					localById.set(remote.id, remote);
				}
			}
			savedStories = Array.from(localById.values())
				.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
				.slice(0, 24);
			localStorage.setItem(SAVED_STORIES_KEY, JSON.stringify(savedStories));
			renderSavedStories();
		} else if (savedStories.length) {
			await saveSavedStoriesToAccount();
		}
	} catch (error) {
		if (/not found/i.test(error.message || '')) {
			if (savedStories.length) await saveSavedStoriesToAccount();
		} else {
			console.warn('Could not load saved stories from account', error);
		}
	}
}

async function saveSavedStoriesToAccount() {
	const accounts = window.JacobAccounts;
	if (!accounts || !accounts.isSignedIn || !accounts.isSignedIn()) return;
	try {
		await accounts.setData(ACCOUNT_APP_ID, ACCOUNT_SAVED_STORIES_KEY, savedStories.slice(0, 24), {
			label: 'Saved stories',
			meta: { count: savedStories.length },
		});
	} catch (error) {
		console.warn('Could not save stories to account', error);
	}
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
elements.saveStory.addEventListener('click', saveCurrentStory);
elements.copy.addEventListener('click', copyJournal);
window.addEventListener('jacob-account-change', () => {
	accountStoriesLoaded = false;
	loadSavedStoriesFromAccount();
});
setTimeout(loadSavedStoriesFromAccount, 700);
syncForm();
render();
