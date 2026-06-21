import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

const jsonHeaders = { 'content-type': 'application/json' };

describe('accounts worker', () => {
	it('creates an account, returns the session user, and logs out', async () => {
		const ctx = createExecutionContext();
		const suffix = crypto.randomUUID().slice(0, 8);
		const signup = await worker.fetch(
			new Request('http://example.com/api/signup', {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					username: `tester_${suffix}`,
					email: `tester_${suffix}@example.com`,
					password: 'correct horse battery',
					displayName: 'Test User',
				}),
			}),
			env,
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(signup.status).toBe(201);
		const created = await signup.json();
		expect(created.token).toBeTruthy();
		expect(created.user.username).toBe(`tester_${suffix}`);
		expect(created.user.passwordHash).toBeUndefined();

		const me = await worker.fetch(
			new Request('http://example.com/api/me', {
				headers: { authorization: `Bearer ${created.token}` },
			}),
			env,
			createExecutionContext(),
		);
		expect(me.status).toBe(200);
		const meBody = await me.json();
		expect(meBody.user.email).toBe(`tester_${suffix}@example.com`);
		expect(meBody.stats.submissionCount).toBe(0);
		expect(meBody.session.expiresAt).toBeTruthy();

		const logout = await worker.fetch(
			new Request('http://example.com/api/logout', {
				method: 'POST',
				headers: { authorization: `Bearer ${created.token}` },
			}),
			env,
			createExecutionContext(),
		);
		expect(logout.status).toBe(200);

		const expired = await worker.fetch(
			new Request('http://example.com/api/me', {
				headers: { authorization: `Bearer ${created.token}` },
			}),
			env,
			createExecutionContext(),
		);
		expect(expired.status).toBe(401);
	});

	it('logs in through the public worker entrypoint', async () => {
		const suffix = crypto.randomUUID().slice(0, 8);
		await SELF.fetch('http://example.com/api/signup', {
			method: 'POST',
			headers: jsonHeaders,
			body: JSON.stringify({
				username: `self_${suffix}`,
				email: `self_${suffix}@example.com`,
				password: 'correct horse battery',
			}),
		});

		const response = await SELF.fetch('http://example.com/api/login', {
			method: 'POST',
			headers: jsonHeaders,
			body: JSON.stringify({
				identifier: `self_${suffix}@example.com`,
				password: 'correct horse battery',
			}),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.token).toBeTruthy();
		expect(body.user.username).toBe(`self_${suffix}`);
	});

	it('rejects duplicate usernames', async () => {
		const suffix = crypto.randomUUID().slice(0, 8);
		const payload = {
			username: `dupe_${suffix}`,
			email: `dupe_${suffix}@example.com`,
			password: 'correct horse battery',
		};

		const first = await worker.fetch(
			new Request('http://example.com/api/signup', {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify(payload),
			}),
			env,
			createExecutionContext(),
		);
		expect(first.status).toBe(201);

		const second = await worker.fetch(
			new Request('http://example.com/api/signup', {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({ ...payload, email: `other_${suffix}@example.com` }),
			}),
			env,
			createExecutionContext(),
		);
		expect(second.status).toBe(409);
	});

	it('saves personal bests and returns leaderboards', async () => {
		const suffix = crypto.randomUUID().slice(0, 8);
		const signup = await worker.fetch(
			new Request('http://example.com/api/signup', {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					username: `score_${suffix}`,
					email: `score_${suffix}@example.com`,
					password: 'correct horse battery',
					displayName: 'Score Hero',
				}),
			}),
			env,
			createExecutionContext(),
		);
		const account = await signup.json();
		const auth = { ...jsonHeaders, authorization: `Bearer ${account.token}` };

		const first = await worker.fetch(
			new Request('http://example.com/api/scores', {
				method: 'POST',
				headers: auth,
				body: JSON.stringify({
					game: 'neon-battle',
					score: 4200,
					label: 'Arcade run',
					mode: 'normal',
					meta: { wave: 9, perfect: true },
				}),
			}),
			env,
			createExecutionContext(),
		);
		expect(first.status).toBe(200);
		const saved = await first.json();
		expect(saved.saved).toBe(true);
		expect(saved.score.score).toBe(4200);
		expect(saved.leaderboard[0].displayName).toBe('Score Hero');

		const worse = await worker.fetch(
			new Request('http://example.com/api/scores', {
				method: 'POST',
				headers: auth,
				body: JSON.stringify({ game: 'neon-battle', score: 100 }),
			}),
			env,
			createExecutionContext(),
		);
		const ignored = await worse.json();
		expect(worse.status).toBe(200);
		expect(ignored.saved).toBe(false);
		expect(ignored.score.score).toBe(4200);

		const leaderboard = await worker.fetch(
			new Request('http://example.com/api/scores/neon-battle?limit=5'),
			env,
			createExecutionContext(),
		);
		expect(leaderboard.status).toBe(200);
		const leaderboardBody = await leaderboard.json();
		expect(leaderboardBody.leaderboard[0].rank).toBe(1);
		expect(leaderboardBody.leaderboard[0].username).toBe(`score_${suffix}`);

		const mine = await worker.fetch(
			new Request('http://example.com/api/scores/me', {
				headers: { authorization: `Bearer ${account.token}` },
			}),
			env,
			createExecutionContext(),
		);
		expect(mine.status).toBe(200);
		const myScores = await mine.json();
		expect(myScores.scores).toHaveLength(1);
		expect(myScores.scores[0].game).toBe('neon-battle');
	});

	it('updates profile details and allows login with the new email', async () => {
		const suffix = crypto.randomUUID().slice(0, 8);
		const signup = await worker.fetch(
			new Request('http://example.com/api/signup', {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					username: `profile_${suffix}`,
					email: `profile_${suffix}@example.com`,
					password: 'correct horse battery',
					displayName: 'Before Name',
				}),
			}),
			env,
			createExecutionContext(),
		);
		const account = await signup.json();

		const update = await worker.fetch(
			new Request('http://example.com/api/profile', {
				method: 'PATCH',
				headers: { ...jsonHeaders, authorization: `Bearer ${account.token}` },
				body: JSON.stringify({
					displayName: 'After Name',
					email: `renamed_${suffix}@example.com`,
				}),
			}),
			env,
			createExecutionContext(),
		);
		expect(update.status).toBe(200);
		const updated = await update.json();
		expect(updated.user.displayName).toBe('After Name');
		expect(updated.user.email).toBe(`renamed_${suffix}@example.com`);

		const login = await worker.fetch(
			new Request('http://example.com/api/login', {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					identifier: `renamed_${suffix}@example.com`,
					password: 'correct horse battery',
				}),
			}),
			env,
			createExecutionContext(),
		);
		expect(login.status).toBe(200);
	});

	it('changes password and invalidates older sessions', async () => {
		const suffix = crypto.randomUUID().slice(0, 8);
		const signup = await worker.fetch(
			new Request('http://example.com/api/signup', {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					username: `pw_${suffix}`,
					email: `pw_${suffix}@example.com`,
					password: 'correct horse battery',
				}),
			}),
			env,
			createExecutionContext(),
		);
		const account = await signup.json();

		const secondLogin = await worker.fetch(
			new Request('http://example.com/api/login', {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					identifier: `pw_${suffix}`,
					password: 'correct horse battery',
				}),
			}),
			env,
			createExecutionContext(),
		);
		const secondSession = await secondLogin.json();

		const change = await worker.fetch(
			new Request('http://example.com/api/password', {
				method: 'POST',
				headers: { ...jsonHeaders, authorization: `Bearer ${account.token}` },
				body: JSON.stringify({
					currentPassword: 'correct horse battery',
					newPassword: 'new horse battery',
				}),
			}),
			env,
			createExecutionContext(),
		);
		expect(change.status).toBe(200);

		const expired = await worker.fetch(
			new Request('http://example.com/api/me', {
				headers: { authorization: `Bearer ${secondSession.token}` },
			}),
			env,
			createExecutionContext(),
		);
		expect(expired.status).toBe(401);

		const oldLogin = await worker.fetch(
			new Request('http://example.com/api/login', {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					identifier: `pw_${suffix}`,
					password: 'correct horse battery',
				}),
			}),
			env,
			createExecutionContext(),
		);
		expect(oldLogin.status).toBe(401);

		const newLogin = await worker.fetch(
			new Request('http://example.com/api/login', {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					identifier: `pw_${suffix}`,
					password: 'new horse battery',
				}),
			}),
			env,
			createExecutionContext(),
		);
		expect(newLogin.status).toBe(200);
	});

	it('deletes accounts and removes their leaderboard entries', async () => {
		const suffix = crypto.randomUUID().slice(0, 8);
		const signup = await worker.fetch(
			new Request('http://example.com/api/signup', {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					username: `gone_${suffix}`,
					email: `gone_${suffix}@example.com`,
					password: 'correct horse battery',
					displayName: 'Gone Soon',
				}),
			}),
			env,
			createExecutionContext(),
		);
		const account = await signup.json();
		const auth = { ...jsonHeaders, authorization: `Bearer ${account.token}` };

		await worker.fetch(
			new Request('http://example.com/api/scores', {
				method: 'POST',
				headers: auth,
				body: JSON.stringify({ game: 'cleanup-game', score: 999 }),
			}),
			env,
			createExecutionContext(),
		);

		const remove = await worker.fetch(
			new Request('http://example.com/api/account', {
				method: 'DELETE',
				headers: auth,
				body: JSON.stringify({ password: 'correct horse battery' }),
			}),
			env,
			createExecutionContext(),
		);
		expect(remove.status).toBe(200);

		const me = await worker.fetch(
			new Request('http://example.com/api/me', {
				headers: { authorization: `Bearer ${account.token}` },
			}),
			env,
			createExecutionContext(),
		);
		expect(me.status).toBe(401);

		const leaderboard = await worker.fetch(
			new Request('http://example.com/api/scores/cleanup-game?limit=5'),
			env,
			createExecutionContext(),
		);
		expect(leaderboard.status).toBe(200);
		const board = await leaderboard.json();
		expect(board.leaderboard).toHaveLength(0);
	});

	it('stores and returns app progress for signed-in users', async () => {
		const suffix = crypto.randomUUID().slice(0, 8);
		const signup = await worker.fetch(
			new Request('http://example.com/api/signup', {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					username: `progress_${suffix}`,
					email: `progress_${suffix}@example.com`,
					password: 'correct horse battery',
				}),
			}),
			env,
			createExecutionContext(),
		);
		const account = await signup.json();
		const auth = { ...jsonHeaders, authorization: `Bearer ${account.token}` };

		const save = await worker.fetch(
			new Request('http://example.com/api/progress/chesspuzzle', {
				method: 'PUT',
				headers: auth,
				body: JSON.stringify({
					rating: 1622,
					bestStreak: 9,
					stormPB: 14,
				}),
			}),
			env,
			createExecutionContext(),
		);
		expect(save.status).toBe(200);
		const saved = await save.json();
		expect(saved.progress.rating).toBe(1622);

		const getOne = await worker.fetch(
			new Request('http://example.com/api/progress/chesspuzzle', {
				headers: { authorization: `Bearer ${account.token}` },
			}),
			env,
			createExecutionContext(),
		);
		expect(getOne.status).toBe(200);
		expect((await getOne.json()).progress.bestStreak).toBe(9);

		const getAll = await worker.fetch(
			new Request('http://example.com/api/progress', {
				headers: { authorization: `Bearer ${account.token}` },
			}),
			env,
			createExecutionContext(),
		);
		expect(getAll.status).toBe(200);
		const all = await getAll.json();
		expect(all.progress.chesspuzzle.stormPB).toBe(14);
	});

	it('stores, lists, loads, and deletes saved chats', async () => {
		const suffix = crypto.randomUUID().slice(0, 8);
		const signup = await worker.fetch(
			new Request('http://example.com/api/signup', {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({
					username: `chat_${suffix}`,
					email: `chat_${suffix}@example.com`,
					password: 'correct horse battery',
				}),
			}),
			env,
			createExecutionContext(),
		);
		const account = await signup.json();
		const auth = { ...jsonHeaders, authorization: `Bearer ${account.token}` };

		const save = await worker.fetch(
			new Request('http://example.com/api/chats/chatbot/session-one', {
				method: 'PUT',
				headers: auth,
				body: JSON.stringify({
					title: 'First chat',
					messages: [
						{ role: 'user', content: 'Hello there' },
						{ role: 'assistant', content: 'Hi, welcome back.' },
					],
					meta: { model: '@cf/meta/llama-3.2-3b-instruct' },
				}),
			}),
			env,
			createExecutionContext(),
		);
		expect(save.status).toBe(200);
		const saved = await save.json();
		expect(saved.chat.messageCount).toBe(2);
		expect(saved.chat.preview).toContain('welcome back');

		const list = await worker.fetch(
			new Request('http://example.com/api/chats/chatbot', {
				headers: { authorization: `Bearer ${account.token}` },
			}),
			env,
			createExecutionContext(),
		);
		expect(list.status).toBe(200);
		const listed = await list.json();
		expect(listed.chats).toHaveLength(1);
		expect(listed.chats[0].title).toBe('First chat');

		const get = await worker.fetch(
			new Request('http://example.com/api/chats/chatbot/session-one', {
				headers: { authorization: `Bearer ${account.token}` },
			}),
			env,
			createExecutionContext(),
		);
		expect(get.status).toBe(200);
		const loaded = await get.json();
		expect(loaded.chat.messages[0].content).toBe('Hello there');

		const remove = await worker.fetch(
			new Request('http://example.com/api/chats/chatbot/session-one', {
				method: 'DELETE',
				headers: auth,
				body: JSON.stringify({}),
			}),
			env,
			createExecutionContext(),
		);
		expect(remove.status).toBe(200);

		const missing = await worker.fetch(
			new Request('http://example.com/api/chats/chatbot/session-one', {
				headers: { authorization: `Bearer ${account.token}` },
			}),
			env,
			createExecutionContext(),
		);
		expect(missing.status).toBe(404);
	});

	it('advertises PUT in CORS preflight headers for chat saves', async () => {
		const response = await worker.fetch(
			new Request('http://example.com/api/chats/chatbot/session-one', {
				method: 'OPTIONS',
				headers: {
					origin: 'https://jacobcreation.github.io',
					'access-control-request-method': 'PUT',
					'access-control-request-headers': 'content-type,authorization',
				},
			}),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(204);
		expect(response.headers.get('access-control-allow-methods')).toContain('PUT');
		expect(response.headers.get('access-control-allow-origin')).toBe('https://jacobcreation.github.io');
	});
});
