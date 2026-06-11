const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 100000;
const LEADERBOARD_LIMIT = 100;
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
				return json(request, { user: session.user });
			}

			if (request.method === 'POST' && url.pathname === '/api/logout') {
				const token = readBearerToken(request);
				if (token) await storage.delete(sessionKey(token));
				return json(request, { ok: true });
			}

			if (request.method === 'PATCH' && url.pathname === '/api/profile') {
				const session = await requireSession(request, storage);
				const body = await readJson(request);
				const displayName = cleanString(body.displayName, 40);
				if (!displayName) throw httpError(400, 'Display name is required.');

				session.record.displayName = displayName;
				session.record.updatedAt = new Date().toISOString();
				await storage.put(userKey(session.record.id), session.record);
				return json(request, { user: publicUser(session.record) });
			}

			if (request.method === 'POST' && url.pathname === '/api/scores') {
				const session = await requireSession(request, storage);
				return await saveScore(request, storage, session);
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
	if (password.length < 8) throw httpError(400, 'Password must be at least 8 characters.');

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

	await storage.put(userKey(id), record);
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
		await storage.delete(sessionKey(token));
		throw httpError(401, 'Session expired.');
	}

	const record = await storage.get(userKey(session.userId));
	if (!record) throw httpError(401, 'Account no longer exists.');

	return { token, record, user: publicUser(record) };
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
	const expiresAt = Date.now() + TOKEN_TTL_SECONDS * 1000;
	await storage.put(sessionKey(token), { userId, expiresAt }, { expirationTtl: TOKEN_TTL_SECONDS });
	return token;
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

function scoreKey(game, userId) {
	return `score:${game}:${userId}`;
}

function leaderboardKey(game) {
	return `leaderboard:${game}`;
}

function userScoresKey(userId) {
	return `scores:user:${userId}`;
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
		'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
		'access-control-allow-headers': 'Content-Type, Authorization',
		'access-control-max-age': '86400',
		vary: 'Origin',
	};
}
