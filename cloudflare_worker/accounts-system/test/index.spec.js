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
		expect((await me.json()).user.email).toBe(`tester_${suffix}@example.com`);

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
});
