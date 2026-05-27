/**
 * Chess Puzzle Accounts Synchronization Helper
 * Manages login, signup, sessions, and stats syncing with the Cloudflare Worker.
 */

const ChessAccounts = (function () {
	// Auto-detect environment: localhost vs. production workers.dev
	const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
		? 'http://localhost:8787'
		: 'https://accnts.jacobcreation.workers.dev';

	// Storage Keys
	const TOKEN_KEY = 'chess_session_token';
	const USERNAME_KEY = 'chess_username';
	const GUEST_KEY = 'chess_guest_mode';

	// Game Storage Keys
	const RATING_KEY = 'chessPuzzleRating';
	const STREAK_KEY = 'chessPuzzleStreak';
	const BEST_STREAK_KEY = 'chessPuzzleBestStreak';
	const PB_KEY = 'chessStormHighScore';
	const TOTAL_PLAYED_KEY = 'chessStormTotalPlayedCount';

	// Fetch helper with auth header
	async function apiRequest(path, method = 'GET', body = null) {
		const headers = {
			'Content-Type': 'application/json',
		};
		const token = localStorage.getItem(TOKEN_KEY);
		if (token) {
			headers['Authorization'] = `Bearer ${token}`;
		}

		const options = {
			method,
			headers,
		};
		if (body) {
			options.body = JSON.stringify(body);
		}

		const response = await fetch(`${API_URL}${path}`, options);
		const data = await response.json();
		if (!response.ok) {
			throw new Error(data.error || 'API Request failed');
		}
		return data;
	}

	return {
		getApiUrl: () => API_URL,
		isLoggedIn: () => !!localStorage.getItem(TOKEN_KEY),
		getToken: () => localStorage.getItem(TOKEN_KEY),
		getUsername: () => localStorage.getItem(USERNAME_KEY),
		isGuest: () => localStorage.getItem(GUEST_KEY) === 'true',

		setGuestMode: function (enable) {
			if (enable) {
				localStorage.setItem(GUEST_KEY, 'true');
			} else {
				localStorage.removeItem(GUEST_KEY);
			}
		},

		signup: async function (username, password) {
			return await apiRequest('/api/signup', 'POST', { username, password });
		},

		login: async function (username, password) {
			const res = await apiRequest('/api/login', 'POST', { username, password });
			if (res.token && res.username) {
				localStorage.setItem(TOKEN_KEY, res.token);
				localStorage.setItem(USERNAME_KEY, res.username);
				localStorage.removeItem(GUEST_KEY);
				
				// Smart merge stats upon login
				if (res.stats) {
					await this.smartMergeStats(res.stats);
				}
			}
			return res;
		},

		logout: async function () {
			try {
				await apiRequest('/api/logout', 'POST');
			} catch (e) {
				console.warn("Logout request failed, clearing local session anyway.", e);
			}
			localStorage.removeItem(TOKEN_KEY);
			localStorage.removeItem(USERNAME_KEY);
			localStorage.removeItem(GUEST_KEY);
			
			// Reset stats to defaults on logout
			localStorage.removeItem(RATING_KEY);
			localStorage.removeItem(STREAK_KEY);
			localStorage.removeItem(BEST_STREAK_KEY);
			localStorage.removeItem(PB_KEY);
			localStorage.removeItem(TOTAL_PLAYED_KEY);

			// Redirect to homepage
			const rootPath = window.location.pathname.includes('/puzzlenormal/') || window.location.pathname.includes('/storm/') ? '../' : './';
			window.location.href = rootPath + 'index.html';
		},

		// Merges server stats and local progress securely
		smartMergeStats: async function (serverStats) {
			const localRating = parseInt(localStorage.getItem(RATING_KEY)) || 1500;
			const localStreak = parseInt(localStorage.getItem(STREAK_KEY)) || 0;
			const localBestStreak = parseInt(localStorage.getItem(BEST_STREAK_KEY)) || 0;
			const localStormPB = parseInt(localStorage.getItem(PB_KEY)) || 0;
			const localStormPlayed = parseInt(localStorage.getItem(TOTAL_PLAYED_KEY)) || 0;

			// Rating merge: if server is default (1500) and local has played rating, use local rating
			let mergedRating = serverStats.rating;
			if (serverStats.rating === 1500 && localRating !== 1500) {
				mergedRating = localRating;
			}
			const mergedBestStreak = Math.max(serverStats.best_streak || 0, localBestStreak);
			const mergedStormPB = Math.max(serverStats.storm_pb || 0, localStormPB);
			const mergedStormPlayed = Math.max(serverStats.storm_played || 0, localStormPlayed);

			const mergedStats = {
				rating: mergedRating,
				streak: localStreak, 
				best_streak: mergedBestStreak,
				storm_pb: mergedStormPB,
				storm_played: mergedStormPlayed
			};

			// Save to local storage
			localStorage.setItem(RATING_KEY, mergedStats.rating);
			localStorage.setItem(STREAK_KEY, mergedStats.streak);
			localStorage.setItem(BEST_STREAK_KEY, mergedStats.best_streak);
			localStorage.setItem(PB_KEY, mergedStats.storm_pb);
			localStorage.setItem(TOTAL_PLAYED_KEY, mergedStats.storm_played);

			// Sync back merged stats to server
			try {
				await this.updateStatsOnServer(mergedStats);
			} catch (e) {
				console.error("Failed to upload merged stats to server:", e);
			}
		},

		fetchAndSyncStats: async function () {
			if (!this.isLoggedIn()) return null;
			try {
				const res = await apiRequest('/api/stats', 'GET');
				if (res.stats) {
					localStorage.setItem(RATING_KEY, res.stats.rating || 1500);
					localStorage.setItem(STREAK_KEY, res.stats.streak || 0);
					localStorage.setItem(BEST_STREAK_KEY, res.stats.best_streak || 0);
					localStorage.setItem(PB_KEY, res.stats.storm_pb || 0);
					localStorage.setItem(TOTAL_PLAYED_KEY, res.stats.storm_played || 0);
					return res.stats;
				}
			} catch (e) {
				console.error("Failed to sync stats from server:", e);
			}
			return null;
		},

		updateStatsOnServer: async function (stats) {
			if (!this.isLoggedIn()) return;
			return await apiRequest('/api/stats', 'POST', stats);
		},

		// Sync current local stats values to server
		syncCurrentLocalStats: async function () {
			if (!this.isLoggedIn()) return;
			const stats = {
				rating: parseInt(localStorage.getItem(RATING_KEY)) || 1500,
				streak: parseInt(localStorage.getItem(STREAK_KEY)) || 0,
				best_streak: parseInt(localStorage.getItem(BEST_STREAK_KEY)) || 0,
				storm_pb: parseInt(localStorage.getItem(PB_KEY)) || 0,
				storm_played: parseInt(localStorage.getItem(TOTAL_PLAYED_KEY)) || 0,
			};
			return await this.updateStatsOnServer(stats);
		},

		// Restore account stats from the R2 Backup Bucket
		restoreFromBackup: async function () {
			if (!this.isLoggedIn()) return;
			const res = await apiRequest('/api/backup/restore', 'POST');
			if (res.stats) {
				localStorage.setItem(RATING_KEY, res.stats.rating || 1500);
				localStorage.setItem(STREAK_KEY, res.stats.streak || 0);
				localStorage.setItem(BEST_STREAK_KEY, res.stats.best_streak || 0);
				localStorage.setItem(PB_KEY, res.stats.storm_pb || 0);
				localStorage.setItem(TOTAL_PLAYED_KEY, res.stats.storm_played || 0);
			}
			return res;
		},

		// Inject Account controls into the global header navigation bar
		injectHeaderControls: function () {
			const nav = document.getElementById('jacobMainNav');
			if (!nav) return;

			// Prevent duplicate injection
			if (document.getElementById('jacob-nav-account-container')) return;

			const container = document.createElement('div');
			container.id = 'jacob-nav-account-container';
			container.style.display = 'inline-flex';
			container.style.alignItems = 'center';
			container.style.gap = '8px';
			container.style.marginLeft = '8px';

			if (this.isLoggedIn()) {
				const username = this.getUsername();
				const rating = localStorage.getItem(RATING_KEY) || 1500;

				container.innerHTML = `
					<span style="color: #4fc3f7; font-size: 0.9rem; font-weight: 600; padding: 4px 8px; background: rgba(79, 195, 247, 0.1); border-radius: 6px; border: 1px solid rgba(79, 195, 247, 0.25);">
						👤 ${username} (${rating})
					</span>
					<button id="jacob-logout-btn" style="min-height: 36px; padding: 4px 12px; font-size: 0.85rem; font-weight: bold; background: #e94560; color: white; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
						Logout
					</button>
				`;
			} else {
				const rootPath = window.location.pathname.includes('/puzzlenormal/') || window.location.pathname.includes('/storm/') ? '../' : './';
				container.innerHTML = `
					<span style="color: #aaa; font-size: 0.9rem; font-weight: 600;">
						👤 Guest
					</span>
					<a href="${rootPath}index.html" style="min-height: 36px; padding: 4px 12px; font-size: 0.85rem; font-weight: bold; background: #16213e; color: #4fc3f7; border: 1px solid #4fc3f7; border-radius: 6px; text-decoration: none; display: inline-flex; align-items: center; justify-content: center;">
						Login
					</a>
				`;
			}

			nav.appendChild(container);

			const logoutBtn = document.getElementById('jacob-logout-btn');
			if (logoutBtn) {
				logoutBtn.addEventListener('click', async () => {
					logoutBtn.disabled = true;
					logoutBtn.innerText = 'Logging out...';
					await this.logout();
				});
				// Add simple hover effect
				logoutBtn.addEventListener('mouseover', () => {
					logoutBtn.style.filter = 'brightness(1.1)';
				});
				logoutBtn.addEventListener('mouseout', () => {
					logoutBtn.style.filter = 'brightness(1.0)';
				});
			}
		}
	};
})();

// Automatically inject account controls and sync stats on load
(function() {
	const init = async () => {
		// Sync stats if logged in
		if (ChessAccounts.isLoggedIn()) {
			await ChessAccounts.fetchAndSyncStats();
		}
		
		// Attempt to inject controls (retry if DOM isn't fully ready)
		let attempts = 0;
		const injectInterval = setInterval(() => {
			attempts++;
			const nav = document.getElementById('jacobMainNav');
			if (nav) {
				ChessAccounts.injectHeaderControls();
				clearInterval(injectInterval);
			} else if (attempts > 50) {
				clearInterval(injectInterval);
			}
		}, 100);
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
