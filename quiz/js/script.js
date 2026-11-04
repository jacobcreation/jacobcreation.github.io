// ============================================================
//  CONSTANTS
// ============================================================
const WORKER_URL = "https://quiz-worker.b4rjxr9lk.workers.dev";
const TOTAL_QUESTIONS = 10;
const TIMER_SECONDS = 30;

// The API is preferred, but the game should remain playable when the remote
// Worker is unavailable (for example while offline or during a deployment).
const OFFLINE_QUESTIONS = [
	{
		topic: "General Science",
		question: "What force keeps planets in orbit around the Sun?",
		options: ["Magnetism", "Gravity", "Friction", "Buoyancy"],
		answer: "Gravity",
		explanation:
			"Gravity attracts planets toward the Sun and supplies the force that bends their paths into orbits.",
	},
	{
		topic: "Physics",
		question: "What is the SI unit of electrical resistance?",
		options: ["Volt", "Ampere", "Ohm", "Watt"],
		answer: "Ohm",
		explanation:
			"Electrical resistance is measured in ohms, represented by the symbol Ω.",
	},
	{
		topic: "Chemistry",
		question: "What is the chemical symbol for gold?",
		options: ["Ag", "Gd", "Go", "Au"],
		answer: "Au",
		explanation: "Au comes from the Latin word aurum, meaning gold.",
	},
	{
		topic: "Biology",
		question: "Which organelle is commonly called the powerhouse of the cell?",
		options: ["Nucleus", "Ribosome", "Mitochondrion", "Cell wall"],
		answer: "Mitochondrion",
		explanation:
			"Mitochondria produce most of a cell's usable energy in the form of ATP.",
	},
	{
		topic: "Earth Science",
		question: "What is the hard outer layer of Earth called?",
		options: ["Mantle", "Crust", "Outer core", "Lithosphere"],
		answer: "Crust",
		explanation: "The crust is Earth's thin, solid outermost rock layer.",
	},
	{
		topic: "Computers & Tech",
		question: "What does CPU stand for?",
		options: [
			"Central Processing Unit",
			"Computer Power Utility",
			"Core Program User",
			"Central Program Upload",
		],
		answer: "Central Processing Unit",
		explanation:
			"The CPU executes instructions and performs the core calculations of a computer.",
	},
	{
		topic: "Astronomy",
		question: "Which planet is known for its prominent ring system?",
		options: ["Mars", "Venus", "Saturn", "Mercury"],
		answer: "Saturn",
		explanation:
			"Saturn's bright, extensive rings are made mostly of ice and rocky particles.",
	},
	{
		topic: "History",
		question: "Which ancient civilization built Machu Picchu?",
		options: ["Maya", "Roman", "Inca", "Persian"],
		answer: "Inca",
		explanation:
			"Machu Picchu was built by the Inca in the Andes of present-day Peru.",
	},
	{
		topic: "Geography",
		question: "What is the largest ocean on Earth?",
		options: [
			"Atlantic Ocean",
			"Indian Ocean",
			"Arctic Ocean",
			"Pacific Ocean",
		],
		answer: "Pacific Ocean",
		explanation: "The Pacific Ocean covers more area than any other ocean.",
	},
	{
		topic: "Mathematics",
		question: "What is the value of π rounded to two decimal places?",
		options: ["3.12", "3.14", "3.16", "3.41"],
		answer: "3.14",
		explanation: "Pi is approximately 3.14159, which rounds to 3.14.",
	},
	{
		topic: "Music",
		question: "How many lines are on a standard musical staff?",
		options: ["Four", "Five", "Six", "Seven"],
		answer: "Five",
		explanation:
			"Standard musical notation uses five horizontal lines and the spaces between them.",
	},
	{
		topic: "Sports",
		question: "How many players from one team are on the court in basketball?",
		options: ["Four", "Five", "Six", "Seven"],
		answer: "Five",
		explanation:
			"Each basketball team has five players on the court during play.",
	},
	{
		topic: "Pop Culture",
		question: "Which fictional detective lives at 221B Baker Street?",
		options: ["Hercule Poirot", "Sherlock Holmes", "Nancy Drew", "Miss Marple"],
		answer: "Sherlock Holmes",
		explanation:
			"221B Baker Street is the famous London address of Sherlock Holmes.",
	},
];

const SUBJECTS = [
	{
		emoji: "🔬",
		name: "General Science",
		desc: "Broad science topics & facts",
	},
	{ emoji: "⚛️", name: "Physics", desc: "Forces, energy, motion & more" },
	{ emoji: "🧪", name: "Chemistry", desc: "Elements, reactions, compounds" },
	{ emoji: "🧬", name: "Biology", desc: "Life, cells, evolution & ecology" },
	{ emoji: "🌍", name: "Earth Science", desc: "Geology, weather, oceans" },
	{ emoji: "💻", name: "Computers & Tech", desc: "Tech, coding, internet, AI" },
	{ emoji: "🔭", name: "Astronomy", desc: "Planets, stars, galaxies, space" },
	{ emoji: "📜", name: "History", desc: "World history & civilizations" },
	{ emoji: "🎬", name: "Pop Culture", desc: "Movies, TV, celebrities" },
	{ emoji: "🎵", name: "Music", desc: "Artists, albums, genres" },
	{ emoji: "⚽", name: "Sports", desc: "World sports & athletes" },
	{ emoji: "🌐", name: "Geography", desc: "Countries, capitals, landmarks" },
	{ emoji: "🧮", name: "Mathematics", desc: "Logic, numbers, and equations" },
];

const ACHIEVEMENTS_DEF = [
	{
		emoji: "🥇",
		name: "Gold Star",
		desc: "Score 9 or 10 in a game",
		key: "ach_gold",
	},
	{
		emoji: "🔥",
		name: "On Fire",
		desc: "Answer 5 correct in a row",
		key: "ach_streak5",
	},
	{
		emoji: "⚡",
		name: "Speed Demon",
		desc: "Answer correctly within 5 seconds",
		key: "ach_speed",
	},
	{
		emoji: "🎓",
		name: "Scholar",
		desc: "Complete 5 different subjects",
		key: "ach_subjects5",
	},
	{
		emoji: "💯",
		name: "Perfect!",
		desc: "Score 10/10 in one game",
		key: "ach_perfect",
	},
	{
		emoji: "🌟",
		name: "Champion",
		desc: "Appear in the top 3 leaderboard",
		key: "ach_top3",
	},
	{
		emoji: "🧠",
		name: "Big Brain",
		desc: "Play 10 total games",
		key: "ach_10games",
	},
	{
		emoji: "🔑",
		name: "Key Player",
		desc: "Save your name to leaderboard",
		key: "ach_saved",
	},
];

// ============================================================
//  GAME STATE
// ============================================================
let selectedSubjects = [];
let questionNumber = 0;
let score = 0;
let correctCount = 0;
let history = JSON.parse(localStorage.getItem("quiz_history") || "[]");
let difficulty = 1;
let timerInterval = null;
let timeLeft = TIMER_SECONDS;
let streak = 0;
let questionsBuffer = [];
let activeQuestionTotal = TOTAL_QUESTIONS;

// ============================================================
//  SCREEN ROUTER
// ============================================================
function showScreen(id) {
	document
		.querySelectorAll(".screen")
		.forEach((s) => s.classList.remove("active"));
	document.getElementById(id).classList.add("active");
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
	renderSubjects();
	renderLeaderboard();
	renderAchievements();

	// Home buttons
	document.getElementById("play-now-btn").addEventListener("click", () => {
		selectedSubjects = SUBJECTS.map((s) => s.name); // All topics
		startGame();
	});

	document
		.getElementById("select-subject-btn")
		.addEventListener("click", () => {
			// Start a fresh subject selection instead of keeping a previous
			// Play Now/all-subjects selection hidden in the game state.
			selectedSubjects = [];
			renderSubjects();
			showScreen("subject-screen");
		});
	document
		.getElementById("leaderboard-btn")
		.addEventListener("click", () => showScreen("leaderboard-screen"));
	document
		.getElementById("achievements-btn")
		.addEventListener("click", () => showScreen("achievements-screen"));

	// Back buttons
	document.querySelectorAll(".back-btn").forEach((btn) => {
		btn.addEventListener("click", () => showScreen(btn.dataset.target));
	});

	// Start game from subject screen
	document
		.getElementById("start-game-btn")
		.addEventListener("click", startGame);

	// Feedback → next question
	document.getElementById("next-q-btn").addEventListener("click", nextQuestion);

	// Result buttons
	document.getElementById("result-retry-btn").addEventListener("click", () => {
		showScreen("subject-screen");
		resetGame();
	});
	document.getElementById("result-home-btn").addEventListener("click", () => {
		showScreen("home-screen");
		resetGame();
	});

	// Save score
	document
		.getElementById("save-score-btn")
		.addEventListener("click", saveScore);
});

// ============================================================
//  SUBJECTS
// ============================================================
function renderSubjects() {
	const list = document.getElementById("subject-list");
	list.innerHTML = "";
	SUBJECTS.forEach((subj) => {
		const div = document.createElement("div");
		div.className = "subject-item";
		div.dataset.name = subj.name;
		div.innerHTML = `
            <span class="subject-emoji">${subj.emoji}</span>
            <div class="subject-info">
                <div class="subject-name">${subj.name}</div>
                <div class="subject-desc">${subj.desc}</div>
            </div>
            <span class="subject-check">✅</span>
        `;
		div.addEventListener("click", () => toggleSubject(div, subj.name));
		list.appendChild(div);
	});
	document.getElementById("start-game-btn").disabled = selectedSubjects.length === 0;
}

function toggleSubject(el, name) {
	el.classList.toggle("selected");
	const idx = selectedSubjects.indexOf(name);
	if (idx === -1) selectedSubjects.push(name);
	else selectedSubjects.splice(idx, 1);
	document.getElementById("start-game-btn").disabled =
		selectedSubjects.length === 0;
}

// ============================================================
//  GAME FLOW
// ============================================================
function startGame() {
	resetGame();
	fetchAllQuestions();
}

function resetGame() {
	questionNumber = 0;
	score = 0;
	correctCount = 0;
	difficulty = 1;
	streak = 0;
	questionsBuffer = [];
	activeQuestionTotal = TOTAL_QUESTIONS;
	stopTimer();
}

function uniqueQuestions(questions) {
	const seen = new Set();
	return questions.filter((question) => {
		const key = typeof question?.question === "string" ? question.question.trim() : "";
		if (!key || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

async function fetchAllQuestions() {
	showScreen("loading-screen");
	setLoadingState("Generating quiz batch...", false);

	try {
		const res = await fetch(WORKER_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				difficulty: Math.round(difficulty),
				history,
				topics: selectedSubjects.length
					? selectedSubjects
					: SUBJECTS.map((s) => s.name),
				count: TOTAL_QUESTIONS,
			}),
		});

		const data = await res.json();
		if (!res.ok || data.error) throw new Error(data.error || "Server error");

		if (data.questions && Array.isArray(data.questions)) {
			questionsBuffer = uniqueQuestions(data.questions);
		} else if (data.question) {
			// Fallback for single question response
			questionsBuffer = uniqueQuestions([data]);
		} else {
			throw new Error("Invalid data from AI");
		}

		if (questionsBuffer.length === 0) throw new Error("No questions received");
		activeQuestionTotal = Math.min(TOTAL_QUESTIONS, questionsBuffer.length);

		// Start the first question
		await loadNextQuestionFromBuffer();
	} catch (err) {
		console.warn("Question API unavailable; using offline question bank.", err);
		questionsBuffer = getOfflineQuestions(TOTAL_QUESTIONS);
		activeQuestionTotal = Math.min(TOTAL_QUESTIONS, questionsBuffer.length);
		setLoadingState("Using offline question bank...", false);
		await loadNextQuestionFromBuffer();
	}
}

function getOfflineQuestions(count) {
	const available = OFFLINE_QUESTIONS.filter(
		(q) => !selectedSubjects.length || selectedSubjects.includes(q.topic),
	);
	const pool = (available.length ? available : OFFLINE_QUESTIONS).sort(
		() => Math.random() - 0.5,
	);
	return pool.slice(0, Math.min(count, pool.length)).map((question) => ({
		...question,
	}));
}

async function loadNextQuestionFromBuffer() {
	// If we have the question in buffer, use it
	if (questionsBuffer && questionsBuffer[questionNumber]) {
		const nextQ = questionsBuffer[questionNumber];
		addToHistory(nextQ.question);
		renderQuestion(nextQ);
	}
	// If buffer exhausted but we still need more questions to reach TOTAL_QUESTIONS
	else if (questionNumber < activeQuestionTotal) {
		showScreen("loading-screen");
		setLoadingState("Fetching next question...", false);

		try {
			const res = await fetch(WORKER_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					difficulty: Math.round(difficulty),
					history,
					topics: selectedSubjects.length
						? selectedSubjects
						: SUBJECTS.map((s) => s.name),
					count: 1,
				}),
			});
			const data = await res.json();
			if (!res.ok || data.error) throw new Error(data.error || "Server error");

			let newQ;
			if (
				data.questions &&
				Array.isArray(data.questions) &&
				data.questions.length > 0
			) {
				newQ = data.questions[0];
			} else if (data.question) {
				newQ = data;
			} else {
				throw new Error("Invalid data from AI");
			}

			if (questionsBuffer.some((question) => question.question === newQ.question)) {
				throw new Error("Duplicate question received");
			}
			questionsBuffer[questionNumber] = newQ;
			activeQuestionTotal = Math.min(TOTAL_QUESTIONS, questionsBuffer.length);
			addToHistory(newQ.question);
			renderQuestion(newQ);
		} catch (err) {
			console.warn(
				"Next question API unavailable; using offline question.",
				err,
			);
			const newQ = getOfflineQuestions(1)[0];
			if (!newQ) {
				showResult();
				return;
			}
			questionsBuffer[questionNumber] = newQ;
			activeQuestionTotal = Math.min(TOTAL_QUESTIONS, questionsBuffer.length);
			addToHistory(newQ.question);
			renderQuestion(newQ);
		}
	} else {
		showResult();
	}
}

function addToHistory(qText) {
	if (!history.includes(qText)) {
		history.push(qText);
		if (history.length > 50) history.shift();
		localStorage.setItem("quiz_history", JSON.stringify(history));
	}
}

function setLoadingState(text, _isRetrying) {
	const loadTxt = document.getElementById("loading-text");
	if (loadTxt) loadTxt.textContent = text;
}

function renderQuestion(data) {
	questionNumber++;
	updateProgress();

	document.getElementById("q-counter").textContent =
		`Question ${questionNumber}/${activeQuestionTotal}`;
	document.getElementById("quiz-subject-tag").textContent =
		selectedSubjects.length === 1 ? selectedSubjects[0] : "Mixed Subjects";
	document.getElementById("quiz-question").textContent = data.question;

	const LABELS = ["A", "B", "C", "D"];
	const container = document.getElementById("quiz-options");
	container.innerHTML = "";

	const shuffled = [...data.options].sort(() => Math.random() - 0.5);
	shuffled.forEach((opt, i) => {
		const btn = document.createElement("button");
		btn.className = "option-btn";
		btn.innerHTML = `<span class="option-label">${LABELS[i]}</span><span>${opt}</span>`;
		btn.addEventListener("click", () =>
			selectAnswer(btn, opt, data.answer, data.explanation || ""),
		);
		container.appendChild(btn);
	});

	showScreen("quiz-screen");
	startTimer(data.answer, data.explanation || "");
}

function updateProgress() {
	const pct = ((questionNumber - 1) / activeQuestionTotal) * 100;
	document.getElementById("progress-fill").style.width = pct + "%";
}

// ============================================================
//  TIMER
// ============================================================
function startTimer(correctAnswer, explanation) {
	stopTimer();
	timeLeft = TIMER_SECONDS;
	const box = document.getElementById("timer-box");
	const val = document.getElementById("timer-val");
	box.classList.remove("warning");
	val.textContent = timeLeft;

	timerInterval = setInterval(() => {
		timeLeft--;
		val.textContent = timeLeft;
		if (timeLeft <= 10) box.classList.add("warning");
		if (timeLeft <= 0) {
			stopTimer();
			// Time up — treat as wrong
			disableOptions();
			const allBtns = document.querySelectorAll(".option-btn");
			allBtns.forEach((b) => {
				if (b.querySelector("span:last-child").textContent === correctAnswer) {
					b.classList.add("correct");
				}
			});
			streak = 0;
			showFeedback(false, correctAnswer, explanation);
		}
	}, 1000);
}

function stopTimer() {
	clearInterval(timerInterval);
	timerInterval = null;
}

// ============================================================
//  ANSWER
// ============================================================
function selectAnswer(btn, chosen, correct, explanation) {
	stopTimer();
	disableOptions();

	const isCorrect = chosen === correct;

	if (isCorrect) {
		btn.classList.add("correct");
		score += 10;
		correctCount++;
		streak++;

		// Difficulty ramp (Note: applies if we were fetching dynamically,
		// for batch fetch it's pre-determined but we keep the state)
		if (difficulty < 10) difficulty = Math.min(10, difficulty + 0.5);

		// Achievement: speed
		if (timeLeft >= 25) unlockAchievement("ach_speed");
		// Achievement: streak
		if (streak >= 5) unlockAchievement("ach_streak5");
	} else {
		btn.classList.add("wrong");
		streak = 0;
		// Highlight correct
		document.querySelectorAll(".option-btn").forEach((b) => {
			if (b.querySelector("span:last-child").textContent === correct)
				b.classList.add("correct");
		});
	}

	showFeedback(isCorrect, correct, explanation);
}

function disableOptions() {
	document.querySelectorAll(".option-btn").forEach((b) => (b.disabled = true));
}

// ============================================================
//  FEEDBACK
// ============================================================
function showFeedback(isCorrect, correctAnswer, explanation) {
	document.getElementById("feedback-icon").textContent = isCorrect
		? "✅"
		: "❌";
	document.getElementById("feedback-label").textContent = isCorrect
		? "Correct!"
		: "Wrong!";
	document.getElementById("feedback-label").className =
		"feedback-label " + (isCorrect ? "correct-label" : "wrong-label");
	document.getElementById("feedback-correct-answer").textContent =
		correctAnswer;
	document.getElementById("feedback-explanation").textContent =
		explanation || "No explanation available.";

	// Colour the answer box if wrong
	const box = document.querySelector(".feedback-answer-box");
	if (!isCorrect) {
		box.style.background = "#FFEBEE";
		box.style.borderColor = "var(--wrong)";
		document.querySelector(".feedback-answer-title").style.color =
			"var(--wrong)";
		document.querySelector(".feedback-correct-answer").style.color =
			"var(--wrong)";
	} else {
		box.style.background = "";
		box.style.borderColor = "";
		document.querySelector(".feedback-answer-title").style.color = "";
		document.querySelector(".feedback-correct-answer").style.color = "";
	}

	showScreen("feedback-screen");
}

// ============================================================
//  NEXT QUESTION / END GAME
// ============================================================
async function nextQuestion() {
	if (questionNumber >= activeQuestionTotal) {
		showResult();
	} else {
		// No loading screen needed if in buffer!
		await loadNextQuestionFromBuffer();
	}
}

// ============================================================
//  RESULT
// ============================================================
function showResult() {
	const accuracy = Math.round((correctCount / activeQuestionTotal) * 100);
	const rank =
		correctCount >= 9 ? "gold" : correctCount >= 6 ? "silver" : "bronze";
	const badges = { gold: "🥇", silver: "🥈", bronze: "🥉" };
	const labels = { gold: "Gold!", silver: "Silver!", bronze: "Bronze" };

	document.getElementById("result-badge").textContent = badges[rank];
	document.getElementById("result-rank").textContent = labels[rank];
	document.getElementById("result-rank").className = "result-rank " + rank;
	document.getElementById("result-score").textContent =
		`${correctCount}/${activeQuestionTotal}`;
	document.getElementById("stat-accuracy").textContent = accuracy + "%";
	document.getElementById("stat-correct").textContent = correctCount;
	document.getElementById("stat-wrong").textContent =
		activeQuestionTotal - correctCount;
	document.getElementById("result-name-row").style.display = "flex";
	document.getElementById("player-name-input").value = "";

	if (rank === "gold") unlockAchievement("ach_gold");
	if (activeQuestionTotal === TOTAL_QUESTIONS && correctCount === activeQuestionTotal) {
		unlockAchievement("ach_perfect");
	}
	trackGames();

	showScreen("result-screen");
}

// ============================================================
//  LEADERBOARD  (localStorage)
// ============================================================
function saveScore() {
	const name = document.getElementById("player-name-input").value.trim();
	if (!name) {
		alert("Please enter your name!");
		return;
	}

	const subject = selectedSubjects.length === 1 ? selectedSubjects[0] : "Mixed";
	const board = getLeaderboard();
	board.push({ name, score: correctCount, subject, ts: Date.now() });
	board.sort((a, b) => b.score - a.score);
	const top20 = board.slice(0, 20);
	localStorage.setItem("quiz_leaderboard", JSON.stringify(top20));

	// Achievement: top 3
	const myPos = top20.findIndex(
		(r) =>
			r.ts ===
			board.find((x) => x.name === name && x.score === correctCount)?.ts,
	);
	if (myPos < 3) unlockAchievement("ach_top3");
	unlockAchievement("ach_saved");

	document.getElementById("result-name-row").style.display = "none";
	renderLeaderboard();
	alert("Score saved! 🎉");
}

function getLeaderboard() {
	try {
		return JSON.parse(localStorage.getItem("quiz_leaderboard") || "[]");
	} catch {
		return [];
	}
}

function renderLeaderboard() {
	const list = document.getElementById("leaderboard-list");
	const board = getLeaderboard();
	if (!board.length) {
		list.innerHTML = '<p class="lb-empty">No scores yet. Play a game!</p>';
		return;
	}
	const MEDALS = ["gold", "silver", "bronze"];
	list.innerHTML = board
		.map(
			(r, i) => `
        <div class="lb-row">
            <div class="lb-rank-num ${MEDALS[i] || ""}">${i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</div>
            <div>
                <div class="lb-name">${escHtml(r.name)}</div>
                <div class="lb-subject-tag">${escHtml(r.subject)}</div>
            </div>
            <div class="lb-score">${r.score}/${TOTAL_QUESTIONS}</div>
        </div>
    `,
		)
		.join("");
}

// ============================================================
//  ACHIEVEMENTS
// ============================================================
function getUnlocked() {
	try {
		return JSON.parse(localStorage.getItem("quiz_achievements") || "[]");
	} catch {
		return [];
	}
}

function unlockAchievement(key) {
	const unlocked = getUnlocked();
	if (!unlocked.includes(key)) {
		unlocked.push(key);
		localStorage.setItem("quiz_achievements", JSON.stringify(unlocked));
		renderAchievements();
	}
}

function renderAchievements() {
	const list = document.getElementById("achievements-list");
	const unlocked = getUnlocked();
	list.innerHTML = ACHIEVEMENTS_DEF.map(
		(a) => `
        <div class="achievement-row ${unlocked.includes(a.key) ? "unlocked" : ""}">
            <span class="ach-emoji">${a.emoji}</span>
            <div class="ach-info">
                <div class="ach-name">${a.name}</div>
                <div class="ach-desc">${a.desc}</div>
            </div>
            <div class="ach-status">${unlocked.includes(a.key) ? "Unlocked ✅" : "Locked 🔒"}</div>
        </div>
    `,
	).join("");
}

function trackGames() {
	const count = parseInt(localStorage.getItem("quiz_total_games") || "0") + 1;
	localStorage.setItem("quiz_total_games", count);
	if (count >= 10) unlockAchievement("ach_10games");

	const subjectSet = JSON.parse(
		localStorage.getItem("quiz_used_subjects") || "[]",
	);
	selectedSubjects.forEach((s) => {
		if (!subjectSet.includes(s)) subjectSet.push(s);
	});
	localStorage.setItem("quiz_used_subjects", JSON.stringify(subjectSet));
	if (subjectSet.length >= 5) unlockAchievement("ach_subjects5");
}

// ============================================================
//  UTILS
// ============================================================
function escHtml(str) {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
