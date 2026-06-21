(function () {
	'use strict';

	const script = document.currentScript;
	const apiBase = (script && script.dataset.accountApi ? script.dataset.accountApi : 'https://accounts-system.b4rjxr9lk.workers.dev').replace(/\/$/, '');
	const tokenKey = 'jacob_accounts_token_v1';
	const pendingScoresKey = 'jacob_accounts_pending_scores_v1';
	const state = {
		token: localStorage.getItem(tokenKey) || '',
		user: null,
		stats: null,
		session: null,
		ready: false,
		open: false,
		mode: 'login',
		message: '',
		busy: false,
		scoreBusy: false,
		scoreLoaded: false,
		scoreGame: '',
		scoreGameName: '',
		leaderboard: [],
		myScore: null,
	};

	let root;
	let app;
	let changeWaiters = [];
	let scoreBridgeInstalled = false;
	let originalSetItem = null;
	const lastAutoScores = new Map();

	const accountsApi = {
		apiBase,
		get token() {
			return state.token;
		},
		get user() {
			return state.user;
		},
		isSignedIn() {
			return Boolean(state.user && state.token);
		},
		getAuthHeaders() {
			return state.token ? { Authorization: `Bearer ${state.token}` } : {};
		},
		open(mode) {
			state.open = true;
			if (mode === 'signup' || mode === 'login') state.mode = mode;
			render();
		},
		close() {
			state.open = false;
			render();
		},
		async refresh() {
			return refreshSession();
		},
		async signIn(identifier, password) {
			return submitLogin({ identifier, password });
		},
		async signUp(details) {
			return submitSignup(details);
		},
		async logout() {
			return logout();
		},
		async logoutEverywhere() {
			return logoutEverywhere();
		},
		async updateProfile(details) {
			return updateProfile(details);
		},
		async changePassword(details) {
			return changePassword(details);
		},
		async deleteAccount(password) {
			return deleteAccount(password);
		},
		currentGameId() {
			return currentGameId();
		},
		async saveHighScore(game, score, details) {
			const payload = normalizeScorePayload(game, score, details);
			if (!payload) throw new Error('A game id and numeric score are required.');
			if (!state.user) await accountsApi.requireSignIn();
			const result = await request('/api/scores', {
				method: 'POST',
				auth: true,
				body: payload,
			});
			if (payload.game === state.scoreGame) {
				state.scoreLoaded = false;
				loadPanelScores();
			}
			window.dispatchEvent(new CustomEvent('jacob-score-saved', { detail: result }));
			return result;
		},
		async getLeaderboard(game = currentGameId(), options = {}) {
			const gameId = cleanGameId(game);
			if (!gameId) throw new Error('A valid game id is required.');
			const limit = Math.max(1, Math.min(100, Number(options.limit) || 25));
			return request(`/api/scores/${encodeURIComponent(gameId)}?limit=${limit}`, { method: 'GET' });
		},
		async getMyScores(game) {
			if (!state.user) await accountsApi.requireSignIn();
			const gameId = game ? cleanGameId(game) : '';
			const suffix = gameId ? `?game=${encodeURIComponent(gameId)}` : '';
			return request(`/api/scores/me${suffix}`, { method: 'GET', auth: true });
		},
		async getProgress(appId) {
			if (!state.user) await accountsApi.requireSignIn();
			const app = cleanGameId(appId);
			if (!app) throw new Error('A valid app id is required.');
			const data = await request(`/api/progress/${encodeURIComponent(app)}`, { method: 'GET', auth: true });
			return data.progress || null;
		},
		async setProgress(appId, progress) {
			if (!state.user) await accountsApi.requireSignIn();
			const app = cleanGameId(appId);
			if (!app) throw new Error('A valid app id is required.');
			const data = await request(`/api/progress/${encodeURIComponent(app)}`, { method: 'PUT', auth: true, body: progress || {} });
			return data.progress || null;
		},
		async listChats(appId) {
			if (!state.user) await accountsApi.requireSignIn();
			const app = cleanGameId(appId);
			if (!app) throw new Error('A valid app id is required.');
			const data = await request(`/api/chats/${encodeURIComponent(app)}`, { method: 'GET', auth: true });
			return data.chats || [];
		},
		async getChat(appId, chatId) {
			if (!state.user) await accountsApi.requireSignIn();
			const app = cleanGameId(appId);
			const chat = cleanChatId(chatId);
			if (!app || !chat) throw new Error('A valid app id and chat id are required.');
			const data = await request(`/api/chats/${encodeURIComponent(app)}/${encodeURIComponent(chat)}`, { method: 'GET', auth: true });
			return data.chat || null;
		},
		async saveChat(appId, chatId, payload) {
			if (!state.user) await accountsApi.requireSignIn();
			const app = cleanGameId(appId);
			const chat = cleanChatId(chatId);
			if (!app || !chat) throw new Error('A valid app id and chat id are required.');
			const data = await request(`/api/chats/${encodeURIComponent(app)}/${encodeURIComponent(chat)}`, {
				method: 'PUT',
				auth: true,
				body: payload || {},
			});
			return data.chat || null;
		},
		async deleteChat(appId, chatId) {
			if (!state.user) await accountsApi.requireSignIn();
			const app = cleanGameId(appId);
			const chat = cleanChatId(chatId);
			if (!app || !chat) throw new Error('A valid app id and chat id are required.');
			return request(`/api/chats/${encodeURIComponent(app)}/${encodeURIComponent(chat)}`, { method: 'DELETE', auth: true });
		},
		requireSignIn() {
			if (state.user) return Promise.resolve(state.user);
			state.open = true;
			render();
			return new Promise((resolve) => {
				changeWaiters.push(resolve);
			});
		},
	};

	window.JacobAccounts = accountsApi;

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}

	function init() {
		if (document.getElementById('jacob-account-widget')) return;

		const host = document.createElement('div');
		host.id = 'jacob-account-widget';
		document.body.appendChild(host);
		root = host.attachShadow({ mode: 'open' });
		app = document.createElement('div');
		root.append(styleElement(), app);
		installLocalScoreBridge();
		render();
		refreshSession();
	}

	async function refreshSession() {
		if (!state.token) {
			state.ready = true;
			render();
			return null;
		}

		try {
			const data = await request('/api/me', { method: 'GET', auth: true });
			state.user = data.user;
			state.stats = data.stats || null;
			state.session = data.session || null;
			state.message = '';
			notifyChange();
			flushPendingScores();
			return state.user;
		} catch (error) {
			state.token = '';
			state.user = null;
			state.stats = null;
			state.session = null;
			localStorage.removeItem(tokenKey);
			state.message = error.message || 'Session expired.';
			notifyChange();
			return null;
		} finally {
			state.ready = true;
			render();
		}
	}

	async function submitLogin(values) {
		return runAuth(async () => {
			const data = await request('/api/login', {
				method: 'POST',
				body: {
					identifier: values.identifier,
					password: values.password,
				},
			});
			acceptSession(data);
			state.open = false;
			return state.user;
		});
	}

	async function submitSignup(values) {
		return runAuth(async () => {
			const data = await request('/api/signup', {
				method: 'POST',
				body: {
					username: values.username,
					email: values.email,
					password: values.password,
					displayName: values.displayName,
				},
			});
			acceptSession(data);
			state.open = false;
			return state.user;
		});
	}

	async function logout() {
		state.busy = true;
		render();
		try {
			if (state.token) {
				await request('/api/logout', { method: 'POST', auth: true });
			}
		} catch (error) {
			state.message = error.message || 'Could not reach accounts.';
		} finally {
			state.token = '';
			state.user = null;
			state.stats = null;
			state.session = null;
			state.busy = false;
			localStorage.removeItem(tokenKey);
			notifyChange();
			render();
		}
	}

	async function logoutEverywhere() {
		state.busy = true;
		state.message = '';
		render();
		try {
			await request('/api/logout-all', { method: 'POST', auth: true });
			state.message = 'Signed out on every device.';
		} catch (error) {
			state.message = error.message || 'Could not sign out everywhere.';
			throw error;
		} finally {
			await logout();
		}
	}

	async function runAuth(action) {
		state.busy = true;
		state.message = '';
		render();
		try {
			const user = await action();
			return user;
		} catch (error) {
			state.message = error.message || 'Could not reach accounts.';
			throw error;
		} finally {
			state.busy = false;
			render();
		}
	}

	function acceptSession(data) {
		state.token = data.token;
		state.user = data.user;
		state.stats = data.stats || state.stats || null;
		state.session = data.session || null;
		state.message = '';
		localStorage.setItem(tokenKey, state.token);
		notifyChange();
		flushPendingScores();
	}

	async function updateProfile(values) {
		return runAuth(async () => {
			const data = await request('/api/profile', {
				method: 'PATCH',
				auth: true,
				body: {
					displayName: values.displayName,
					email: values.email,
				},
			});
			state.user = data.user;
			state.stats = data.stats || state.stats;
			state.message = 'Profile updated.';
			notifyChange();
			return state.user;
		});
	}

	async function changePassword(values) {
		return runAuth(async () => {
			await request('/api/password', {
				method: 'POST',
				auth: true,
				body: {
					currentPassword: values.currentPassword,
					newPassword: values.newPassword,
				},
			});
			state.message = 'Password changed. Other devices were signed out.';
			return true;
		});
	}

	async function deleteAccount(password) {
		return runAuth(async () => {
			await request('/api/account', {
				method: 'DELETE',
				auth: true,
				body: { password },
			});
			await logout();
			state.message = 'Account deleted.';
			return true;
		});
	}

	async function request(path, options = {}) {
		const headers = { Accept: 'application/json' };
		if (options.body) headers['Content-Type'] = 'application/json';
		if (options.auth && state.token) headers.Authorization = `Bearer ${state.token}`;

		const response = await fetch(`${apiBase}${path}`, {
			method: options.method || 'GET',
			headers,
			body: options.body ? JSON.stringify(options.body) : undefined,
		});
		const data = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(data.error || `Accounts request failed (${response.status}).`);
		return data;
	}

	function notifyChange() {
		window.dispatchEvent(
			new CustomEvent('jacob-account-change', {
				detail: { user: state.user, token: state.token, signedIn: Boolean(state.user && state.token) },
			}),
		);
		changeWaiters = changeWaiters.filter((resolve) => {
			if (state.user) {
				resolve(state.user);
				return false;
			}
			return true;
		});
	}

	function render() {
		if (!app) return;
		const name = state.user ? state.user.displayName || state.user.username : '';
		const initial = name ? name.trim().charAt(0).toUpperCase() : '';
		app.innerHTML = `
			<button class="account-launcher" type="button" aria-haspopup="dialog" aria-expanded="${state.open ? 'true' : 'false'}">
				<span class="avatar">${escapeHtml(initial || '?')}</span>
				<span class="launcher-text">${escapeHtml(name || 'Sign in')}</span>
			</button>
			${state.open ? modalMarkup() : ''}
		`;

		app.querySelector('.account-launcher').addEventListener('click', () => {
			state.open = !state.open;
			render();
		});

		const close = app.querySelector('[data-close]');
		if (close) close.addEventListener('click', accountsApi.close);

		const backdrop = app.querySelector('.account-backdrop');
		if (backdrop) backdrop.addEventListener('click', accountsApi.close);

		const loginTab = app.querySelector('[data-mode="login"]');
		const signupTab = app.querySelector('[data-mode="signup"]');
		if (loginTab) loginTab.addEventListener('click', () => setMode('login'));
		if (signupTab) signupTab.addEventListener('click', () => setMode('signup'));

		const form = app.querySelector('form');
		if (form) form.addEventListener('submit', handleSubmit);

		const logoutButton = app.querySelector('[data-logout]');
		if (logoutButton) logoutButton.addEventListener('click', logout);

		const logoutEverywhereButton = app.querySelector('[data-logout-all]');
		if (logoutEverywhereButton) logoutEverywhereButton.addEventListener('click', () => logoutEverywhere().catch(() => {}));

		const refreshScoresButton = app.querySelector('[data-refresh-scores]');
		if (refreshScoresButton) refreshScoresButton.addEventListener('click', () => loadPanelScores(true));

		const profileForm = app.querySelector('[data-profile-form]');
		if (profileForm) {
			profileForm.addEventListener('submit', (event) => {
				event.preventDefault();
				const data = Object.fromEntries(new FormData(event.currentTarget));
				updateProfile(data).catch(() => {});
			});
		}

		const passwordForm = app.querySelector('[data-password-form]');
		if (passwordForm) {
			passwordForm.addEventListener('submit', (event) => {
				event.preventDefault();
				const data = Object.fromEntries(new FormData(event.currentTarget));
				if (data.newPassword !== data.confirmPassword) {
					state.message = 'New passwords do not match.';
					render();
					return;
				}
				changePassword(data)
					.then(() => {
						event.currentTarget.reset();
						render();
					})
					.catch(() => {});
			});
		}

		const deleteButton = app.querySelector('[data-delete-account]');
		if (deleteButton) {
			deleteButton.addEventListener('click', async () => {
				const password = window.prompt('Enter your password to delete this account.');
				if (!password) return;
				deleteAccount(password).catch(() => {});
			});
		}

		if (state.open && state.user) loadPanelScores();
	}

	function setMode(mode) {
		state.mode = mode;
		state.message = '';
		render();
	}

	function modalMarkup() {
		if (state.user) {
			return `
				<div class="account-backdrop"></div>
				<section class="account-panel" role="dialog" aria-modal="true" aria-label="Account">
					<div class="panel-head">
						<div>
							<p class="eyebrow">Signed in</p>
							<h2>${escapeHtml(state.user.displayName || state.user.username)}</h2>
						</div>
						<button class="icon-button" type="button" data-close aria-label="Close">x</button>
					</div>
					<div class="profile-line">
						<span>@${escapeHtml(state.user.username)}</span>
						<span>${escapeHtml(state.user.email)}</span>
					</div>
					${accountStatsMarkup()}
					${scorePanelMarkup()}
					<form class="stack-form" data-profile-form>
						<p class="eyebrow">Profile</p>
						<label>
							<span>Display name</span>
							<input name="displayName" maxlength="40" value="${escapeAttribute(state.user.displayName || '')}" required>
						</label>
						<label>
							<span>Email</span>
							<input name="email" type="email" value="${escapeAttribute(state.user.email || '')}" required>
						</label>
						<button class="primary secondary" type="submit" ${state.busy ? 'disabled' : ''}>Save profile</button>
					</form>
					<form class="stack-form" data-password-form>
						<p class="eyebrow">Security</p>
						<label>
							<span>Current password</span>
							<input name="currentPassword" type="password" autocomplete="current-password" required>
						</label>
						<label>
							<span>New password</span>
							<input name="newPassword" type="password" autocomplete="new-password" minlength="8" required>
						</label>
						<label>
							<span>Confirm new password</span>
							<input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required>
						</label>
						<button class="primary secondary" type="submit" ${state.busy ? 'disabled' : ''}>Change password</button>
					</form>
					${state.message ? `<p class="message">${escapeHtml(state.message)}</p>` : ''}
					<div class="action-grid">
						<button class="mini-button" type="button" data-logout-all ${state.busy ? 'disabled' : ''}>Sign out everywhere</button>
						<button class="mini-button danger-button" type="button" data-delete-account ${state.busy ? 'disabled' : ''}>Delete account</button>
					</div>
					<button class="primary danger" type="button" data-logout ${state.busy ? 'disabled' : ''}>Sign out</button>
				</section>
			`;
		}

		const isSignup = state.mode === 'signup';
		return `
			<div class="account-backdrop"></div>
			<section class="account-panel" role="dialog" aria-modal="true" aria-label="${isSignup ? 'Create account' : 'Sign in'}">
				<div class="panel-head">
					<div>
						<p class="eyebrow">JacobCreation</p>
						<h2>${isSignup ? 'Create account' : 'Sign in'}</h2>
					</div>
					<button class="icon-button" type="button" data-close aria-label="Close">x</button>
				</div>
				<div class="tabs" role="tablist" aria-label="Account mode">
					<button class="${!isSignup ? 'active' : ''}" type="button" data-mode="login">Sign in</button>
					<button class="${isSignup ? 'active' : ''}" type="button" data-mode="signup">Create</button>
				</div>
				<form>
					${isSignup ? signupFields() : loginFields()}
					${state.message ? `<p class="message">${escapeHtml(state.message)}</p>` : ''}
					<button class="primary" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Working...' : isSignup ? 'Create account' : 'Sign in'}</button>
				</form>
			</section>
		`;
	}

	function loginFields() {
		return `
			<label>
				<span>Username or email</span>
				<input name="identifier" autocomplete="username" required>
			</label>
			<label>
				<span>Password</span>
				<input name="password" type="password" autocomplete="current-password" required>
			</label>
		`;
	}

	function signupFields() {
		return `
			<label>
				<span>Display name</span>
				<input name="displayName" autocomplete="name" maxlength="40">
			</label>
			<label>
				<span>Username</span>
				<input name="username" autocomplete="username" pattern="[A-Za-z0-9_]{3,24}" required>
			</label>
			<label>
				<span>Email</span>
				<input name="email" type="email" autocomplete="email" required>
			</label>
			<label>
				<span>Password</span>
				<input name="password" type="password" autocomplete="new-password" minlength="8" required>
			</label>
		`;
	}

	function handleSubmit(event) {
		event.preventDefault();
		const data = Object.fromEntries(new FormData(event.currentTarget));
		const action = state.mode === 'signup' ? submitSignup(data) : submitLogin(data);
		action.catch(() => {});
	}

	async function loadPanelScores(force = false) {
		const game = currentGameId();
		const gameName = currentGameName();
		if (state.scoreBusy) return;
		if (!force && state.scoreLoaded && state.scoreGame === game) return;

		state.scoreBusy = true;
		state.scoreGame = game;
		state.scoreGameName = gameName;
		try {
			const [leaderboard, mine] = await Promise.all([
				accountsApi.getLeaderboard(game, { limit: 3 }),
				accountsApi.getMyScores(game),
			]);
			state.leaderboard = leaderboard.leaderboard || [];
			state.myScore = mine.scores && mine.scores[0] ? mine.scores[0] : null;
			state.scoreLoaded = true;
		} catch (error) {
			state.leaderboard = [];
			state.myScore = null;
		} finally {
			state.scoreBusy = false;
			render();
		}
	}

	function scorePanelMarkup() {
		const game = state.scoreGame || currentGameId();
		const gameName = state.scoreGameName || currentGameName() || game;
		const rows = state.leaderboard.length
			? state.leaderboard
					.map(
						(entry) => `
							<div class="score-row">
								<span>#${entry.rank} ${escapeHtml(entry.displayName || entry.username)}</span>
								<strong>${formatScore(entry.score)}</strong>
							</div>
						`,
					)
					.join('')
			: `<div class="score-empty">${state.scoreBusy ? 'Loading scores...' : 'No scores yet.'}</div>`;

		return `
			<div class="scores-box">
				<div class="scores-head">
					<div>
						<p class="eyebrow">Scores</p>
						<h3>${escapeHtml(gameName)}</h3>
					</div>
					<button class="mini-button" type="button" data-refresh-scores ${state.scoreBusy ? 'disabled' : ''}>Refresh</button>
				</div>
				<div class="my-score">
					<span>Your best</span>
					<strong>${state.myScore ? formatScore(state.myScore.score) : '-'}</strong>
				</div>
				${rows}
			</div>
		`;
	}

	function accountStatsMarkup() {
		const stats = state.stats || {};
		const sessionExpiry = state.session && state.session.expiresAt ? formatShortDate(state.session.expiresAt) : 'Unknown';
		const lastGameName = stats.lastGameName || formatGameNameFromId(stats.lastGame) || '-';
		return `
			<div class="stats-box">
				<div class="scores-head">
					<div>
						<p class="eyebrow">Account</p>
						<h3>Progress</h3>
					</div>
					<span class="session-chip">Session until ${escapeHtml(sessionExpiry)}</span>
				</div>
				<div class="stats-grid">
					<div class="stat-card"><span>Games tracked</span><strong>${formatCount(stats.gamesTracked)}</strong></div>
					<div class="stat-card"><span>Score submits</span><strong>${formatCount(stats.submissionCount)}</strong></div>
					<div class="stat-card"><span>New bests</span><strong>${formatCount(stats.improvementCount)}</strong></div>
					<div class="stat-card"><span>Last game</span><strong>${escapeHtml(lastGameName)}</strong></div>
				</div>
			</div>
		`;
	}

	function normalizeScorePayload(game, score, details = {}) {
		if (typeof game === 'object' && game) {
			details = game;
			score = details.score;
			game = details.game;
		}
		const gameId = cleanGameId(game || currentGameId());
		const numericScore = Number(score);
		if (!gameId || !Number.isFinite(numericScore)) return null;
		const gameName = cleanGameName(details.gameName || currentGameName());
		return {
			game: gameId,
			gameName,
			score: numericScore,
			label: details.label || '',
			mode: details.mode || '',
			meta: { ...(details.meta || {}), gameName },
		};
	}

	function currentGameId() {
		const explicit = document.body && document.body.dataset ? document.body.dataset.accountGame : '';
		if (explicit) return cleanGameId(explicit);
		const parts = location.pathname.split('/').filter(Boolean);
		if (!parts.length) return 'home';
		if (parts[0] === 'mg' && parts[1]) return cleanGameId(`mg-${parts[1]}`);
		if (parts[0] === 'chesspuzzle' && parts[1]) return cleanGameId(`chesspuzzle-${parts[1]}`);
		if (parts[0] === 'riddles' && parts[1]) return cleanGameId(`riddles-${parts[1]}`);
		return cleanGameId(parts[0]);
	}

	function currentGameName() {
		const bodyExplicit = document.body && document.body.dataset ? document.body.dataset.accountGameName : '';
		if (bodyExplicit) return cleanGameName(bodyExplicit);
		const scriptExplicit = script && script.dataset ? script.dataset.accountGameName : '';
		if (scriptExplicit) return cleanGameName(scriptExplicit);
		const heading = document.querySelector('main h1, h1, .logo, .logo-text, .brand h1, .portal-header h1, .game-header h1');
		if (heading && heading.textContent) return cleanGameName(heading.textContent);
		const title = String(document.title || '').replace(/\s*[-|]\s*JacobCreation\s*$/i, '').trim();
		if (title) return cleanGameName(title);
		return formatGameNameFromId(currentGameId());
	}

	function cleanGameId(value) {
		return String(value || '')
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9_-]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 50);
	}

	function cleanGameName(value) {
		return String(value || '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 80);
	}

	function formatGameNameFromId(value) {
		const text = String(value || '')
			.replace(/^mg-/, 'MG ')
			.replace(/^chesspuzzle-/, 'Chess Puzzle ')
			.replace(/^riddles-/, 'Riddles ')
			.replace(/[-_]+/g, ' ')
			.trim();
		if (!text) return '';
		return text.replace(/\b\w/g, (char) => char.toUpperCase());
	}

	function cleanChatId(value) {
		return String(value || '')
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9_-]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 80);
	}

	function formatScore(score) {
		return Number(score).toLocaleString(undefined, { maximumFractionDigits: 3 });
	}

	function formatCount(value) {
		return Number(value || 0).toLocaleString();
	}

	function formatShortDate(value) {
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return 'Unknown';
		return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function installLocalScoreBridge() {
		if (scoreBridgeInstalled || !window.localStorage || !autoScoreEnabled()) return;
		scoreBridgeInstalled = true;

		try {
			const storagePrototype = Object.getPrototypeOf(localStorage);
			const nativeSetItem = storagePrototype && storagePrototype.setItem ? storagePrototype.setItem : localStorage.setItem;
			originalSetItem = nativeSetItem.bind(localStorage);
			storagePrototype.setItem = function patchedSetItem(key, value) {
				nativeSetItem.call(this, key, value);
				if (this === localStorage) captureLocalScore(key, value);
			};
		} catch (error) {
			scoreBridgeInstalled = false;
		}

		scanExistingLocalScores();
	}

	function scanExistingLocalScores() {
		try {
			for (let index = 0; index < localStorage.length; index += 1) {
				const key = localStorage.key(index);
				if (key) captureLocalScore(key, localStorage.getItem(key));
			}
		} catch (error) {
			// Browsers may block storage in private or embedded contexts.
		}
	}

	function captureLocalScore(key, value) {
		if (!isLikelyScoreKey(key)) return;
		const score = extractBestScore(value);
		if (!Number.isFinite(score) || score <= 0) return;

		const game = currentGameId();
		const label = cleanScoreLabel(key);
		const cacheKey = `${game}:${label}`;
		if ((lastAutoScores.get(cacheKey) || 0) >= score) return;
		lastAutoScores.set(cacheKey, score);

		const payload = {
			game,
			score,
			label,
			mode: 'auto',
			meta: { source: 'localStorage', storageKey: String(key).slice(0, 80) },
		};

		if (state.user && state.token) {
			request('/api/scores', { method: 'POST', auth: true, body: payload })
				.then((result) => {
					window.dispatchEvent(new CustomEvent('jacob-score-saved', { detail: result }));
					if (payload.game === state.scoreGame) {
						state.scoreLoaded = false;
						loadPanelScores();
					}
				})
				.catch(() => queuePendingScore(payload));
		} else {
			queuePendingScore(payload);
		}
	}

	function isLikelyScoreKey(key) {
		const text = String(key || '');
		if (!text || text === tokenKey || text === pendingScoresKey) return false;
		if (/(sound|theme|config|skin|coin|completed|muted|token|session|account|state|save)/i.test(text)) return false;
		return /(high.?score|best.?score|personal.?best|\bpb\b|_scores$|-scores$)/i.test(text);
	}

	function autoScoreEnabled() {
		const bodyFlag = document.body && document.body.dataset ? document.body.dataset.accountAutoscore : '';
		const scriptFlag = script && script.dataset ? script.dataset.accountAutoscore : '';
		return isTrueLike(bodyFlag) || isTrueLike(scriptFlag) || window.JacobAccountsAutoScore === true;
	}

	function isTrueLike(value) {
		return /^(1|true|yes|on)$/i.test(String(value || '').trim());
	}

	function extractBestScore(value) {
		const direct = Number(value);
		if (Number.isFinite(direct)) return direct;

		try {
			const parsed = JSON.parse(value);
			return maxNumericValue(parsed, 0, { count: 0 });
		} catch (error) {
			return NaN;
		}
	}

	function maxNumericValue(value, depth, stateRef) {
		if (stateRef.count > 120 || depth > 5) return NaN;
		stateRef.count += 1;

		if (typeof value === 'number' && Number.isFinite(value)) return value;
		if (typeof value === 'string') {
			const numeric = Number(value);
			return Number.isFinite(numeric) ? numeric : NaN;
		}
		if (!value || typeof value !== 'object') return NaN;

		const values = Array.isArray(value) ? value : Object.values(value);
		return values.reduce((best, item) => {
			const candidate = maxNumericValue(item, depth + 1, stateRef);
			return Number.isFinite(candidate) && candidate > best ? candidate : best;
		}, NaN);
	}

	function cleanScoreLabel(key) {
		return String(key || 'High score')
			.replace(/[_-]+/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 80);
	}

	function queuePendingScore(payload) {
		const pending = readPendingScores();
		const existingIndex = pending.findIndex((item) => item.game === payload.game && item.label === payload.label);
		if (existingIndex >= 0) {
			if (pending[existingIndex].score >= payload.score) return;
			pending[existingIndex] = payload;
		} else {
			pending.push(payload);
		}
		writePendingScores(pending.slice(-40));
	}

	function readPendingScores() {
		try {
			const parsed = JSON.parse(localStorage.getItem(pendingScoresKey) || '[]');
			return Array.isArray(parsed) ? parsed : [];
		} catch (error) {
			return [];
		}
	}

	function writePendingScores(scores) {
		try {
			const writer = originalSetItem || localStorage.setItem.bind(localStorage);
			writer(pendingScoresKey, JSON.stringify(scores));
		} catch (error) {
			// Storage may be unavailable; losing a queued score is better than breaking the page.
		}
	}

	async function flushPendingScores() {
		if (!state.user || !state.token) return;
		const pending = readPendingScores();
		if (!pending.length) return;

		const remaining = [];
		for (const payload of pending) {
			try {
				await request('/api/scores', { method: 'POST', auth: true, body: payload });
			} catch (error) {
				remaining.push(payload);
			}
		}

		writePendingScores(remaining);
		if (remaining.length !== pending.length) {
			state.scoreLoaded = false;
			loadPanelScores();
		}
	}

	function styleElement() {
		const style = document.createElement('style');
		style.textContent = `
			:host {
				color-scheme: dark;
				font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			}

			* {
				box-sizing: border-box;
			}

			.account-launcher {
				position: fixed;
				right: max(12px, env(safe-area-inset-right));
				bottom: max(12px, env(safe-area-inset-bottom));
				z-index: 2147483000;
				display: inline-flex;
				align-items: center;
				gap: 8px;
				max-width: min(220px, calc(100vw - 24px));
				min-height: 42px;
				padding: 6px 12px 6px 6px;
				border: 1px solid rgba(255, 255, 255, 0.2);
				border-radius: 999px;
				background: rgba(12, 16, 28, 0.88);
				color: #f8fbff;
				box-shadow: 0 14px 34px rgba(0, 0, 0, 0.32);
				backdrop-filter: blur(16px);
				cursor: pointer;
			}

			.avatar {
				width: 30px;
				height: 30px;
				display: inline-grid;
				place-items: center;
				flex: 0 0 auto;
				border-radius: 999px;
				background: linear-gradient(135deg, #38d996, #4f8cff);
				color: #06111f;
				font-size: 13px;
				font-weight: 800;
			}

			.launcher-text {
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				font-size: 13px;
				font-weight: 700;
				letter-spacing: 0;
			}

			.account-backdrop {
				position: fixed;
				inset: 0;
				z-index: 2147483001;
				background: rgba(2, 6, 14, 0.42);
			}

			.account-panel {
				position: fixed;
				right: max(12px, env(safe-area-inset-right));
				bottom: calc(max(12px, env(safe-area-inset-bottom)) + 54px);
				z-index: 2147483002;
				width: min(360px, calc(100vw - 24px));
				max-height: calc(100vh - 92px);
				overflow: auto;
				padding: 16px;
				border: 1px solid rgba(255, 255, 255, 0.16);
				border-radius: 8px;
				background: #111827;
				color: #f8fbff;
				box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
			}

			.panel-head {
				display: flex;
				align-items: flex-start;
				justify-content: space-between;
				gap: 12px;
				margin-bottom: 14px;
			}

			.eyebrow {
				margin: 0 0 3px;
				color: #8fb1d9;
				font-size: 11px;
				font-weight: 800;
				letter-spacing: 0.08em;
				text-transform: uppercase;
			}

			h2 {
				margin: 0;
				color: #ffffff;
				font-size: 21px;
				line-height: 1.15;
				letter-spacing: 0;
			}

			.icon-button {
				width: 30px;
				height: 30px;
				border: 1px solid rgba(255, 255, 255, 0.14);
				border-radius: 999px;
				background: rgba(255, 255, 255, 0.06);
				color: #e8eef8;
				cursor: pointer;
				font-size: 16px;
				line-height: 1;
			}

			.tabs {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 4px;
				padding: 4px;
				border-radius: 8px;
				background: rgba(255, 255, 255, 0.06);
				margin-bottom: 14px;
			}

			.tabs button {
				min-height: 36px;
				border: 0;
				border-radius: 6px;
				background: transparent;
				color: #aebed3;
				font-weight: 800;
				cursor: pointer;
			}

			.tabs button.active {
				background: #f8fbff;
				color: #0d1526;
			}

			form {
				display: grid;
				gap: 11px;
			}

			label {
				display: grid;
				gap: 6px;
				color: #c7d4e7;
				font-size: 12px;
				font-weight: 800;
			}

			input {
				width: 100%;
				min-height: 42px;
				border: 1px solid rgba(255, 255, 255, 0.14);
				border-radius: 7px;
				background: rgba(255, 255, 255, 0.06);
				color: #ffffff;
				padding: 10px 11px;
				font: inherit;
				font-size: 14px;
				outline: none;
			}

			input:focus {
				border-color: #6ee7b7;
				box-shadow: 0 0 0 3px rgba(110, 231, 183, 0.16);
			}

			.primary {
				width: 100%;
				min-height: 42px;
				border: 0;
				border-radius: 7px;
				background: #6ee7b7;
				color: #07111f;
				font-weight: 900;
				cursor: pointer;
			}

			.primary.danger {
				background: #ffb4a6;
			}

			.primary.secondary {
				background: rgba(248, 251, 255, 0.1);
				color: #f8fbff;
				border: 1px solid rgba(255, 255, 255, 0.14);
			}

			.primary:disabled {
				cursor: wait;
				opacity: 0.68;
			}

			.message {
				margin: 0;
				padding: 10px 11px;
				border: 1px solid rgba(255, 255, 255, 0.12);
				border-radius: 7px;
				background: rgba(255, 255, 255, 0.06);
				color: #ffd6ce;
				font-size: 13px;
				line-height: 1.35;
			}

			.profile-line {
				display: grid;
				gap: 7px;
				margin-bottom: 14px;
				color: #c7d4e7;
				font-size: 13px;
				line-height: 1.35;
				overflow-wrap: anywhere;
			}

			.scores-box {
				display: grid;
				gap: 8px;
				margin-bottom: 14px;
				padding: 12px;
				border: 1px solid rgba(255, 255, 255, 0.12);
				border-radius: 8px;
				background: rgba(255, 255, 255, 0.05);
			}

			.stats-box,
			.stack-form {
				display: grid;
				gap: 10px;
				margin-bottom: 14px;
				padding: 12px;
				border: 1px solid rgba(255, 255, 255, 0.12);
				border-radius: 8px;
				background: rgba(255, 255, 255, 0.05);
			}

			.stats-grid {
				display: grid;
				grid-template-columns: repeat(2, minmax(0, 1fr));
				gap: 8px;
			}

			.stat-card {
				display: grid;
				gap: 4px;
				padding: 10px;
				border-radius: 7px;
				background: rgba(4, 10, 20, 0.36);
				color: #c7d4e7;
				font-size: 12px;
			}

			.stat-card strong {
				color: #ffffff;
				font-size: 15px;
			}

			.session-chip {
				align-self: start;
				padding: 6px 8px;
				border-radius: 999px;
				background: rgba(110, 231, 183, 0.12);
				color: #dffdf2;
				font-size: 11px;
				font-weight: 800;
			}

			.scores-head,
			.my-score,
			.score-row {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 10px;
			}

			.scores-head {
				margin-bottom: 2px;
			}

			h3 {
				margin: 0;
				color: #ffffff;
				font-size: 15px;
				line-height: 1.1;
				letter-spacing: 0;
			}

			.mini-button {
				min-height: 30px;
				border: 1px solid rgba(255, 255, 255, 0.14);
				border-radius: 6px;
				background: rgba(255, 255, 255, 0.08);
				color: #e8eef8;
				padding: 0 9px;
				font-size: 12px;
				font-weight: 800;
				cursor: pointer;
			}

			.mini-button:disabled {
				opacity: 0.6;
				cursor: wait;
			}

			.action-grid {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 8px;
				margin-bottom: 12px;
			}

			.danger-button {
				color: #ffd6ce;
				border-color: rgba(255, 180, 166, 0.26);
			}

			.my-score {
				padding: 9px 10px;
				border-radius: 7px;
				background: rgba(110, 231, 183, 0.12);
				color: #dffdf2;
				font-size: 13px;
			}

			.score-row,
			.score-empty {
				color: #c7d4e7;
				font-size: 13px;
				line-height: 1.3;
			}

			.score-row strong,
			.my-score strong {
				color: #ffffff;
				font-variant-numeric: tabular-nums;
			}

			@media (max-width: 520px) {
				.launcher-text {
					display: none;
				}

				.account-launcher {
					padding: 6px;
				}

				.account-panel {
					left: 12px;
					right: 12px;
					width: auto;
				}
			}
		`;
		return style;
	}

	function escapeHtml(value) {
		return String(value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	function escapeAttribute(value) {
		return escapeHtml(value).replace(/`/g, '&#096;');
	}
})();
