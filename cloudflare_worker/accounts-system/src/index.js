const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_ITERATIONS = 100000;
const LEADERBOARD_LIMIT = 100;
const CHAT_LIMIT = 40;
const CHAT_MESSAGE_LIMIT = 120;
const CHAT_TITLE_MAX = 80;
const memoryStore = globalThis.__JACOB_ACCOUNTS_STORE__ || new Map();
globalThis.__JACOB_ACCOUNTS_STORE__ = memoryStore;

export default {
	async fetch(request, env) {
		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeaders(request) });
		}

		try {
			const url = new URL(request.url);
			const storage = createStorage(env);

			if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/api')) {
				return json(request, {
					name: 'JacobCreation Accounts',
					ok: true,
					storage: storage.kind,
					endpoints: {
						signup: '/api/signup',
						login: '/api/login',
						me: '/api/me',
						logout: '/api/logout',
						saveScore: '/api/scores',
						leaderboard: '/api/scores/:game',
						myScores: '/api/scores/me',
						progress: '/api/progress/:app',
						chats: '/api/chats/:app',
					},
				});
			}

			if (request.method === 'GET' && url.pathname === '/api/health') {
				return json(request, { ok: true, storage: storage.kind });
			}

			if (request.method === 'POST' && (url.pathname === '/api/signup' || url.pathname === '/api/register')) {
				return await signup(request, storage);
			}

			if (request.method === 'POST' && url.pathname === '/api/login') {
				return await login(request, storage);
			}

			if (request.method === 'GET' && url.pathname === '/api/me') {
				const session = await requireSession(request, storage);
				return json(request, {
					user: session.user,
					stats: await getAccountStats(storage, session.record.id),
					session: publicSession(session.session),
				});
			}

			if (request.method === 'POST' && url.pathname === '/api/logout') {
				const token = readBearerToken(request);
				if (token) await destroySession(storage, token);
				return json(request, { ok: true });
			}

			if (request.method === 'POST' && url.pathname === '/api/logout-all') {
				const session = await requireSession(request, storage);
				await destroyAllSessionsForUser(storage, session.record.id);
				return json(request, { ok: true });
			}

			if (request.method === 'PATCH' && url.pathname === '/api/profile') {
				const session = await requireSession(request, storage);
				const body = await readJson(request);
				const displayName = cleanString(body.displayName, 40);
				const email = normalizeEmail(body.email);
				if (!displayName) throw httpError(400, 'Display name is required.');
				if (!email) throw httpError(400, 'A valid email is required.');
				if (email !== session.record.email) {
					const emailTaken = await storage.get(emailKey(email));
					if (emailTaken && emailTaken !== session.record.id) throw httpError(409, 'That email is already registered.');
					await storage.delete(emailKey(session.record.email));
					await storage.put(emailKey(email), session.record.id);
					session.record.email = email;
				}

				session.record.displayName = displayName;
				session.record.updatedAt = new Date().toISOString();
				await persistUserRecord(storage, session.record);
				return json(request, {
					user: publicUser(session.record),
					stats: await getAccountStats(storage, session.record.id),
				});
			}

			if (request.method === 'POST' && url.pathname === '/api/password') {
				const session = await requireSession(request, storage);
				const body = await readJson(request);
				const currentPassword = String(body.currentPassword || '');
				const newPassword = String(body.newPassword || '');
				await assertPasswordMatches(session.record, currentPassword);
				if (newPassword.length < MIN_PASSWORD_LENGTH) {
					throw httpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
				}

				const salt = randomHex(16);
				session.record.passwordSalt = salt;
				session.record.passwordHash = await hashPassword(newPassword, salt);
				session.record.passwordIterations = PASSWORD_ITERATIONS;
				session.record.updatedAt = new Date().toISOString();
				await persistUserRecord(storage, session.record);
				await destroyAllSessionsForUser(storage, session.record.id, session.token);
				return json(request, { ok: true });
			}

			if (request.method === 'DELETE' && url.pathname === '/api/account') {
				const session = await requireSession(request, storage);
				const body = await readJson(request);
				const password = String(body.password || '');
				await assertPasswordMatches(session.record, password);
				await deleteAccount(storage, session.record);
				return json(request, { ok: true });
			}

			if (request.method === 'POST' && url.pathname === '/api/scores') {
				const session = await requireSession(request, storage);
				return await saveScore(request, storage, session);
			}

			if (request.method === 'GET' && url.pathname === '/api/progress') {
				const session = await requireSession(request, storage);
				return json(request, { progress: await getAllProgress(storage, session.record.id) });
			}

			if (url.pathname.startsWith('/api/progress/')) {
				const session = await requireSession(request, storage);
				const app = normalizeAppId(decodeURIComponent(url.pathname.slice('/api/progress/'.length)));
				if (!app) throw httpError(400, 'A valid app id is required.');
				if (request.method === 'GET') {
					return json(request, { app, progress: (await storage.get(progressKey(session.record.id, app))) || null });
				}
				if (request.method === 'PUT') {
					const body = await readJson(request);
					const progress = sanitizeProgressPayload(body);
					const saved = await saveProgress(storage, session.record.id, app, progress);
					return json(request, { app, progress: saved });
				}
			}

			if (request.method === 'GET' && /^\/api\/chats\/[^/]+$/.test(url.pathname)) {
				const session = await requireSession(request, storage);
				const app = normalizeAppId(decodeURIComponent(url.pathname.slice('/api/chats/'.length)));
				if (!app) throw httpError(400, 'A valid app id is required.');
				return json(request, { app, chats: await listChats(storage, session.record.id, app) });
			}

			if (/^\/api\/chats\/[^/]+\/[^/]+$/.test(url.pathname)) {
				const session = await requireSession(request, storage);
				const parts = url.pathname.split('/').filter(Boolean);
				const app = normalizeAppId(decodeURIComponent(parts[2]));
				const chatId = normalizeChatId(decodeURIComponent(parts[3]));
				if (!app || !chatId) throw httpError(400, 'A valid app id and chat id are required.');
				if (request.method === 'GET') {
					const chat = await storage.get(chatKey(session.record.id, app, chatId));
					if (!chat) throw httpError(404, 'Chat not found.');
					return json(request, { app, chat });
				}
				if (request.method === 'PUT') {
					const body = await readJson(request);
					const chat = await saveChat(storage, session.record.id, app, chatId, body);
					return json(request, { app, chat });
				}
				if (request.method === 'DELETE') {
					await deleteChat(storage, session.record.id, app, chatId);
					return json(request, { ok: true });
				}
			}

			if (request.method === 'GET' && url.pathname === '/api/scores/me') {
				const session = await requireSession(request, storage);
				const game = normalizeGameId(url.searchParams.get('game'));
				const scores = await getUserScores(storage, session.record.id, game);
				return json(request, { scores });
			}

			if (request.method === 'GET' && url.pathname.startsWith('/api/scores/')) {
				const game = normalizeGameId(decodeURIComponent(url.pathname.slice('/api/scores/'.length)));
				if (!game) throw httpError(400, 'A valid game id is required.');
				const limit = clampInteger(url.searchParams.get('limit'), 1, LEADERBOARD_LIMIT, 25);
				const leaderboard = await getLeaderboard(storage, game, limit);
				return json(request, { game, leaderboard });
			}

			return json(request, { error: 'Not found.' }, 404);
		} catch (error) {
			const status = Number(error.status) || 500;
			const message = status === 500 ? 'Something went wrong.' : error.message;
			return json(request, { error: message }, status);
		}
	},
};

async function signup(request, storage) {
	const body = await readJson(request);
	const username = normalizeUsername(body.username);
	const email = normalizeEmail(body.email);
	const password = String(body.password || '');
	const displayName = cleanString(body.displayName, 40) || username;

	if (!username) throw httpError(400, 'Username must be 3-24 letters, numbers, or underscores.');
	if (!email) throw httpError(400, 'A valid email is required.');
	if (password.length < MIN_PASSWORD_LENGTH) {
		throw httpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
	}

	const usernameTaken = await storage.get(usernameKey(username));
	if (usernameTaken) throw httpError(409, 'That username is already taken.');

	const emailTaken = await storage.get(emailKey(email));
	if (emailTaken) throw httpError(409, 'That email is already registered.');

	const now = new Date().toISOString();
	const id = crypto.randomUUID();
	const salt = randomHex(16);
	const passwordHash = await hashPassword(password, salt);
	const record = {
		id,
		username,
		email,
		displayName,
		passwordHash,
		passwordSalt: salt,
		passwordIterations: PASSWORD_ITERATIONS,
		createdAt: now,
		updatedAt: now,
	};

	await persistUserRecord(storage, record);
	await storage.put(usernameKey(username), id);
	await storage.put(emailKey(email), id);

	const token = await createSession(storage, id);
	return json(request, { token, user: publicUser(record) }, 201);
}

async function login(request, storage) {
	const body = await readJson(request);
	const identifier = cleanString(body.identifier || body.username || body.email, 120).toLowerCase();
	const password = String(body.password || '');
	if (!identifier || !password) throw httpError(400, 'Username/email and password are required.');

	const id = identifier.includes('@')
		? await storage.get(emailKey(normalizeEmail(identifier)))
		: await storage.get(usernameKey(normalizeUsername(identifier)));

	if (!id) throw httpError(401, 'Invalid login.');

	const record = await storage.get(userKey(id));
	if (!record) throw httpError(401, 'Invalid login.');

	const expected = await hashPassword(password, record.passwordSalt);
	if (expected !== record.passwordHash) throw httpError(401, 'Invalid login.');

	record.updatedAt = new Date().toISOString();
	await persistUserRecord(storage, record);
	const token = await createSession(storage, record.id);
	return json(request, { token, user: publicUser(record) });
}

async function saveScore(request, storage, session) {
	const body = await readJson(request);
	const game = normalizeGameId(body.game);
	const score = normalizeScore(body.score);
	const label = cleanString(body.label, 80);
	const mode = cleanString(body.mode, 40);
	const meta = cleanMeta(body.meta);

	if (!game) throw httpError(400, 'Game id must be 2-50 letters, numbers, dashes, or underscores.');
	if (score === null) throw httpError(400, 'Score must be a finite number.');

	const now = new Date().toISOString();
	const existing = await storage.get(scoreKey(game, session.record.id));
	const improved = !existing || score > existing.score;
	const entry = improved
		? {
				game,
				score,
				label,
				mode,
				meta,
				userId: session.record.id,
				username: session.record.username,
				displayName: session.record.displayName,
				createdAt: existing ? existing.createdAt : now,
				updatedAt: now,
			}
		: {
				...existing,
				username: session.record.username,
				displayName: session.record.displayName,
			};

	if (improved) {
		await storage.put(scoreKey(game, session.record.id), entry);
		await updateUserScores(storage, session.record.id, entry);
		await updateLeaderboard(storage, game, entry);
	}
	await updateAccountStats(storage, session.record.id, { game, score, improved });

	const leaderboard = await getLeaderboard(storage, game, 10);
	return json(request, {
		saved: improved,
		score: publicScore(entry),
		leaderboard,
	});
}

async function requireSession(request, storage) {
	const token = readBearerToken(request);
	if (!token) throw httpError(401, 'Sign in required.');

	const session = await storage.get(sessionKey(token));
	if (!session || !session.userId || Date.now() > session.expiresAt) {
		await destroySession(storage, token);
		throw httpError(401, 'Session expired.');
	}

	const record = await storage.get(userKey(session.userId));
	if (!record) throw httpError(401, 'Account no longer exists.');

	return { token, record, user: publicUser(record), session };
}

async function updateUserScores(storage, userId, entry) {
	const scores = (await storage.get(userScoresKey(userId))) || {};
	scores[entry.game] = entry;
	await storage.put(userScoresKey(userId), scores);
}

async function getUserScores(storage, userId, game) {
	const scores = (await storage.get(userScoresKey(userId))) || {};
	if (game) return scores[game] ? [publicScore(scores[game])] : [];
	return Object.values(scores)
		.sort((a, b) => b.score - a.score || String(b.updatedAt).localeCompare(String(a.updatedAt)))
		.map(publicScore);
}

async function updateLeaderboard(storage, game, entry) {
	const current = (await storage.get(leaderboardKey(game))) || [];
	const withoutUser = current.filter((item) => item.userId !== entry.userId);
	withoutUser.push(entry);
	withoutUser.sort((a, b) => b.score - a.score || String(a.updatedAt).localeCompare(String(b.updatedAt)));
	await storage.put(leaderboardKey(game), withoutUser.slice(0, LEADERBOARD_LIMIT));
}

async function getLeaderboard(storage, game, limit) {
	const current = (await storage.get(leaderboardKey(game))) || [];
	return current.slice(0, limit).map((entry, index) => ({
		rank: index + 1,
		...publicScore(entry),
	}));
}

async function createSession(storage, userId) {
	const token = randomHex(32);
	const now = Date.now();
	const expiresAt = now + TOKEN_TTL_SECONDS * 1000;
	await storage.put(
		sessionKey(token),
		{ userId, createdAt: now, lastSeenAt: now, expiresAt },
		{ expirationTtl: TOKEN_TTL_SECONDS },
	);
	await addSessionToUserIndex(storage, userId, token);
	return token;
}

async function destroySession(storage, token) {
	const session = await storage.get(sessionKey(token));
	await storage.delete(sessionKey(token));
	if (session && session.userId) {
		await removeSessionFromUserIndex(storage, session.userId, token);
	}
}

async function destroyAllSessionsForUser(storage, userId, exceptToken = '') {
	const tokens = (await storage.get(userSessionsKey(userId))) || [];
	const keep = [];
	for (const token of tokens) {
		if (token && token === exceptToken) {
			keep.push(token);
			continue;
		}
		await storage.delete(sessionKey(token));
	}
	if (keep.length) {
		await storage.put(userSessionsKey(userId), keep);
	} else {
		await storage.delete(userSessionsKey(userId));
	}
}

function publicUser(record) {
	return {
		id: record.id,
		username: record.username,
		email: record.email,
		displayName: record.displayName,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
	};
}

function publicSession(session) {
	return {
		expiresAt: new Date(session.expiresAt).toISOString(),
		createdAt: session.createdAt ? new Date(session.createdAt).toISOString() : null,
		lastSeenAt: session.lastSeenAt ? new Date(session.lastSeenAt).toISOString() : null,
	};
}

function publicScore(entry) {
	return {
		game: entry.game,
		score: entry.score,
		label: entry.label || '',
		mode: entry.mode || '',
		meta: entry.meta || {},
		username: entry.username,
		displayName: entry.displayName,
		updatedAt: entry.updatedAt,
	};
}

function createStorage(env) {
	const kv = env && env.ACCOUNTS;
	if (kv && typeof kv.get === 'function' && typeof kv.put === 'function') {
		return {
			kind: 'kv',
			async get(key) {
				const value = await kv.get(key);
				return value ? JSON.parse(value) : null;
			},
			async put(key, value, options) {
				await kv.put(key, JSON.stringify(value), options);
			},
			async delete(key) {
				await kv.delete(key);
			},
		};
	}

	return {
		kind: 'volatile',
		async get(key) {
			const entry = memoryStore.get(key);
			if (!entry) return null;
			if (entry.expiresAt && Date.now() > entry.expiresAt) {
				memoryStore.delete(key);
				return null;
			}
			return JSON.parse(entry.value);
		},
		async put(key, value, options = {}) {
			const expiresAt = options.expirationTtl ? Date.now() + options.expirationTtl * 1000 : 0;
			memoryStore.set(key, { value: JSON.stringify(value), expiresAt });
		},
		async delete(key) {
			memoryStore.delete(key);
		},
	};
}

async function persistUserRecord(storage, record) {
	await storage.put(userKey(record.id), record);
}

async function assertPasswordMatches(record, password) {
	if (!password) throw httpError(400, 'Password is required.');
	const expected = await hashPassword(password, record.passwordSalt);
	if (expected !== record.passwordHash) throw httpError(401, 'Invalid password.');
}

async function addSessionToUserIndex(storage, userId, token) {
	const tokens = (await storage.get(userSessionsKey(userId))) || [];
	if (!tokens.includes(token)) {
		tokens.push(token);
		await storage.put(userSessionsKey(userId), tokens.slice(-24));
	}
}

async function removeSessionFromUserIndex(storage, userId, token) {
	const tokens = (await storage.get(userSessionsKey(userId))) || [];
	const filtered = tokens.filter((item) => item !== token);
	if (filtered.length) {
		await storage.put(userSessionsKey(userId), filtered);
	} else {
		await storage.delete(userSessionsKey(userId));
	}
}

async function getAccountStats(storage, userId) {
	const stats = (await storage.get(accountStatsKey(userId))) || {};
	const scoreMap = (await storage.get(userScoresKey(userId))) || {};
	const scores = Object.values(scoreMap);
	return {
		gamesTracked: scores.length,
		bestScoreCount: Number(stats.bestScoreCount) || 0,
		submissionCount: Number(stats.submissionCount) || 0,
		improvementCount: Number(stats.improvementCount) || 0,
		lastGame: stats.lastGame || '',
		lastScore: Number.isFinite(stats.lastScore) ? stats.lastScore : null,
		lastPlayedAt: stats.lastPlayedAt || null,
	};
}

async function updateAccountStats(storage, userId, details) {
	const stats = (await storage.get(accountStatsKey(userId))) || {};
	stats.submissionCount = (Number(stats.submissionCount) || 0) + 1;
	if (details.improved) {
		stats.improvementCount = (Number(stats.improvementCount) || 0) + 1;
	}
	stats.lastGame = details.game;
	stats.lastScore = details.score;
	stats.lastPlayedAt = new Date().toISOString();
	const userScores = (await storage.get(userScoresKey(userId))) || {};
	stats.bestScoreCount = Object.keys(userScores).length;
	await storage.put(accountStatsKey(userId), stats);
}

async function deleteAccount(storage, record) {
	const scores = (await storage.get(userScoresKey(record.id))) || {};
	for (const entry of Object.values(scores)) {
		await storage.delete(scoreKey(entry.game, record.id));
		const current = (await storage.get(leaderboardKey(entry.game))) || [];
		const filtered = current.filter((item) => item.userId !== record.id);
		if (filtered.length) {
			await storage.put(leaderboardKey(entry.game), filtered);
		} else {
			await storage.delete(leaderboardKey(entry.game));
		}
	}

	await destroyAllSessionsForUser(storage, record.id);
	await storage.delete(userScoresKey(record.id));
	await storage.delete(accountStatsKey(record.id));
	await deleteAllProgress(storage, record.id);
	await deleteAllChats(storage, record.id);
	await storage.delete(usernameKey(record.username));
	await storage.delete(emailKey(record.email));
	await storage.delete(userKey(record.id));
}

async function getAllProgress(storage, userId) {
	const index = (await storage.get(progressIndexKey(userId))) || [];
	const entries = {};
	for (const app of index) {
		const progress = await storage.get(progressKey(userId, app));
		if (progress) entries[app] = progress;
	}
	return entries;
}

async function saveProgress(storage, userId, app, progress) {
	const now = new Date().toISOString();
	const existing = (await storage.get(progressKey(userId, app))) || null;
	const saved = {
		...existing,
		...progress,
		app,
		updatedAt: now,
		createdAt: existing?.createdAt || now,
	};
	await storage.put(progressKey(userId, app), saved);
	const index = (await storage.get(progressIndexKey(userId))) || [];
	if (!index.includes(app)) {
		index.push(app);
		await storage.put(progressIndexKey(userId), index.slice(-100));
	}
	return saved;
}

function sanitizeProgressPayload(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw httpError(400, 'Progress payload must be an object.');
	const sanitized = {};
	for (const [key, raw] of Object.entries(value).slice(0, 40)) {
		const cleanKey = cleanString(key, 40);
		if (!cleanKey) continue;
		if (typeof raw === 'string') {
			sanitized[cleanKey] = cleanString(raw, 400);
		} else if (typeof raw === 'number' && Number.isFinite(raw)) {
			sanitized[cleanKey] = Math.round(raw * 1000) / 1000;
		} else if (typeof raw === 'boolean') {
			sanitized[cleanKey] = raw;
		} else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
			sanitized[cleanKey] = cleanMeta(raw);
		}
	}
	if (!Object.keys(sanitized).length) throw httpError(400, 'Progress payload is empty.');
	return sanitized;
}

async function listChats(storage, userId, app) {
	const list = (await storage.get(chatsIndexKey(userId, app))) || [];
	return list.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

async function saveChat(storage, userId, app, chatId, payload) {
	const messages = sanitizeChatMessages(payload.messages);
	const title = cleanString(payload.title, CHAT_TITLE_MAX) || deriveChatTitle(messages);
	const meta = sanitizeChatMeta(payload.meta);
	const preview = deriveChatPreview(messages);
	const now = new Date().toISOString();
	const existing = await storage.get(chatKey(userId, app, chatId));
	const chat = {
		id: chatId,
		app,
		title,
		preview,
		meta,
		messages,
		messageCount: messages.length,
		createdAt: existing?.createdAt || now,
		updatedAt: now,
	};
	await storage.put(chatKey(userId, app, chatId), chat);

	const current = (await storage.get(chatsIndexKey(userId, app))) || [];
	const summary = publicChatSummary(chat);
	const next = current.filter((item) => item.id !== chatId);
	next.unshift(summary);
	await storage.put(chatsIndexKey(userId, app), next.slice(0, CHAT_LIMIT));
	const apps = (await storage.get(chatsAppsKey(userId))) || [];
	if (!apps.includes(app)) {
		apps.push(app);
		await storage.put(chatsAppsKey(userId), apps.slice(-100));
	}
	return chat;
}

async function deleteChat(storage, userId, app, chatId) {
	await storage.delete(chatKey(userId, app, chatId));
	const current = (await storage.get(chatsIndexKey(userId, app))) || [];
	const next = current.filter((item) => item.id !== chatId);
	if (next.length) {
		await storage.put(chatsIndexKey(userId, app), next);
	} else {
		await storage.delete(chatsIndexKey(userId, app));
	}
}

function sanitizeChatMessages(messages) {
	if (!Array.isArray(messages) || !messages.length) throw httpError(400, 'Chat messages are required.');
	const sanitized = messages
		.filter((message) => message && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string')
		.slice(-CHAT_MESSAGE_LIMIT)
		.map((message) => ({
			role: message.role,
			content: cleanString(message.content, message.role === 'assistant' ? 5000 : 4000),
		}))
		.filter((message) => message.content);
	if (!sanitized.length) throw httpError(400, 'Chat messages are empty.');
	return sanitized;
}

function sanitizeChatMeta(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return cleanMeta(value);
}

function deriveChatTitle(messages) {
	const firstUser = messages.find((message) => message.role === 'user' && message.content);
	return cleanString(firstUser?.content || 'Saved chat', CHAT_TITLE_MAX) || 'Saved chat';
}

function deriveChatPreview(messages) {
	const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant' && message.content);
	const source = lastAssistant?.content || messages[messages.length - 1]?.content || '';
	return cleanString(source, 140);
}

function publicChatSummary(chat) {
	return {
		id: chat.id,
		app: chat.app,
		title: chat.title,
		preview: chat.preview,
		messageCount: chat.messageCount,
		meta: chat.meta || {},
		createdAt: chat.createdAt,
		updatedAt: chat.updatedAt,
	};
}

async function deleteAllProgress(storage, userId) {
	const index = (await storage.get(progressIndexKey(userId))) || [];
	for (const app of index) {
		await storage.delete(progressKey(userId, app));
	}
	await storage.delete(progressIndexKey(userId));
}

async function deleteAllChats(storage, userId) {
	const chatApps = (await storage.get(chatsAppsKey(userId))) || [];
	for (const app of chatApps) {
		const list = (await storage.get(chatsIndexKey(userId, app))) || [];
		for (const chat of list) {
			await storage.delete(chatKey(userId, app, chat.id));
		}
		await storage.delete(chatsIndexKey(userId, app));
	}
	await storage.delete(chatsAppsKey(userId));
}

async function readJson(request) {
	const type = request.headers.get('content-type') || '';
	if (!type.includes('application/json')) throw httpError(415, 'Expected application/json.');
	return request.json();
}

function readBearerToken(request) {
	const header = request.headers.get('authorization') || '';
	const match = header.match(/^Bearer\s+(.+)$/i);
	return match ? match[1].trim() : '';
}

async function hashPassword(password, saltHex) {
	const passwordBytes = new TextEncoder().encode(password);
	const saltBytes = hexToBytes(saltHex);
	const keyMaterial = await crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: PASSWORD_ITERATIONS },
		keyMaterial,
		256,
	);
	return bytesToHex(new Uint8Array(bits));
}

function normalizeUsername(value) {
	const username = cleanString(value, 24).toLowerCase();
	return /^[a-z0-9_]{3,24}$/.test(username) ? username : '';
}

function normalizeEmail(value) {
	const email = cleanString(value, 120).toLowerCase();
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function normalizeGameId(value) {
	const game = cleanString(value, 50).toLowerCase();
	return /^[a-z0-9][a-z0-9_-]{1,49}$/.test(game) ? game : '';
}

function normalizeAppId(value) {
	const app = cleanString(value, 50).toLowerCase();
	return /^[a-z0-9][a-z0-9_-]{1,49}$/.test(app) ? app : '';
}

function normalizeChatId(value) {
	const chatId = cleanString(value, 80).toLowerCase();
	return /^[a-z0-9][a-z0-9_-]{1,79}$/.test(chatId) ? chatId : '';
}

function normalizeScore(value) {
	const score = Number(value);
	if (!Number.isFinite(score) || score < 0 || score > 1000000000000000) return null;
	return Math.round(score * 1000) / 1000;
}

function cleanMeta(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	const meta = {};
	for (const [key, raw] of Object.entries(value).slice(0, 12)) {
		const cleanKey = cleanString(key, 30);
		if (!cleanKey) continue;
		if (typeof raw === 'number' && Number.isFinite(raw)) {
			meta[cleanKey] = Math.round(raw * 1000) / 1000;
		} else if (typeof raw === 'boolean') {
			meta[cleanKey] = raw;
		} else if (typeof raw === 'string') {
			meta[cleanKey] = cleanString(raw, 120);
		}
	}
	return JSON.stringify(meta).length <= 1000 ? meta : {};
}

function clampInteger(value, min, max, fallback) {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.max(min, Math.min(max, parsed));
}

function cleanString(value, maxLength) {
	return String(value || '').trim().slice(0, maxLength);
}

function randomHex(byteLength) {
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);
	return bytesToHex(bytes);
}

function bytesToHex(bytes) {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
	const bytes = new Uint8Array(hex.length / 2);
	for (let index = 0; index < bytes.length; index += 1) {
		bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
	}
	return bytes;
}

function userKey(id) {
	return `user:${id}`;
}

function usernameKey(username) {
	return `username:${username}`;
}

function emailKey(email) {
	return `email:${email}`;
}

function sessionKey(token) {
	return `session:${token}`;
}

function userSessionsKey(userId) {
	return `sessions:user:${userId}`;
}

function scoreKey(game, userId) {
	return `score:${game}:${userId}`;
}

function leaderboardKey(game) {
	return `leaderboard:${game}`;
}

function userScoresKey(userId) {
	return `scores:user:${userId}`;
}

function accountStatsKey(userId) {
	return `stats:user:${userId}`;
}

function progressKey(userId, app) {
	return `progress:${userId}:${app}`;
}

function progressIndexKey(userId) {
	return `progress:index:${userId}`;
}

function chatKey(userId, app, chatId) {
	return `chat:${userId}:${app}:${chatId}`;
}

function chatsIndexKey(userId, app) {
	return `chats:index:${userId}:${app}`;
}

function chatsAppsKey(userId) {
	return `chats:apps:${userId}`;
}

function httpError(status, message) {
	const error = new Error(message);
	error.status = status;
	return error;
}

function json(request, data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			...corsHeaders(request),
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store',
		},
	});
}

function corsHeaders(request) {
	const origin = request.headers.get('origin') || '*';
	return {
		'access-control-allow-origin': origin,
		'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
		'access-control-allow-headers': 'Content-Type, Authorization',
		'access-control-max-age': '86400',
		vary: 'Origin',
	};
}
