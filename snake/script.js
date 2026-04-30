const canvas = document.getElementById('game-board');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('highScore');
const startBtn = document.getElementById('start-btn');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const difficultySelect = document.getElementById('difficulty');

// Game Constants
const GRID_SIZE = 20;
let tileCount;
let tileSize;

// Game State
let snake = [];
let food = null;
let direction = 'right';
let nextDirection = 'right';
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let gameLoop = null;
let isPaused = false;
let gameActive = false;
let speed = 120; // Initial speed in ms (Slower)
let lastTime = 0;
let foodType = 'regular'; // regular, golden, poison
let particles = [];

// Sound System
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(freq, type, duration, vol) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const sounds = {
    eat: () => playSound(600, 'sine', 0.1, 0.1),
    eatGolden: () => {
        playSound(600, 'sine', 0.1, 0.1);
        setTimeout(() => playSound(800, 'sine', 0.1, 0.1), 50);
    },
    eatPoison: () => playSound(150, 'sawtooth', 0.3, 0.1),
    gameOver: () => {
        playSound(200, 'square', 0.2, 0.1);
        setTimeout(() => playSound(150, 'square', 0.3, 0.1), 200);
    }
};

// Particle System
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 4 + 2;
        this.speedX = (Math.random() - 0.5) * 8;
        this.speedY = (Math.random() - 0.5) * 8;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
    }
    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

function createParticles(x, y, color) {
    for (let i = 0; i < 10; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// Initialize high score display
highScoreElement.textContent = highScore;

// Resize canvas to fit its container
function resize() {
    const container = document.getElementById('game-board-wrapper');
    const size = Math.min(container.clientWidth, 500);
    canvas.width = size;
    canvas.height = size;
    tileCount = GRID_SIZE;
    tileSize = canvas.width / tileCount;
}

window.addEventListener('resize', resize);
resize();

// Input handling
document.addEventListener('keydown', (e) => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (!gameActive) {
        if (e.key === 'Enter') startGame();
        return;
    }

    if (e.key === ' ') {
        togglePause();
        return;
    }

    const key = e.key.toLowerCase();
    if ((key === 'arrowup' || key === 'w') && direction !== 'down') nextDirection = 'up';
    if ((key === 'arrowdown' || key === 's') && direction !== 'up') nextDirection = 'down';
    if ((key === 'arrowleft' || key === 'a') && direction !== 'right') nextDirection = 'left';
    if ((key === 'arrowright' || key === 'd') && direction !== 'left') nextDirection = 'right';
});

// Touch controls for mobile
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
    if (!gameActive || isPaused) return;
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    if (!gameActive) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;
    
    if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > 30) {
            if (dx > 0 && direction !== 'left') nextDirection = 'right';
            else if (dx < 0 && direction !== 'right') nextDirection = 'left';
        }
    } else {
        if (Math.abs(dy) > 30) {
            if (dy > 0 && direction !== 'up') nextDirection = 'down';
            else if (dy < 0 && direction !== 'down') nextDirection = 'up';
        }
    }
}, { passive: true });

// Mobile D-Pad listeners
document.getElementById('ctrl-up').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (direction !== 'down') nextDirection = 'up';
});
document.getElementById('ctrl-down').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (direction !== 'up') nextDirection = 'down';
});
document.getElementById('ctrl-left').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (direction !== 'right') nextDirection = 'left';
});
document.getElementById('ctrl-right').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (direction !== 'left') nextDirection = 'right';
});

// Mobile Pause button
document.getElementById('mobile-pause-btn').addEventListener('click', (e) => {
    e.preventDefault();
    if (gameActive) togglePause();
});

function startGame() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];
    particles = [];
    direction = 'right';
    nextDirection = 'right';
    score = 0;
    scoreElement.textContent = score;
    speed = parseInt(difficultySelect.value);
    gameActive = true;
    isPaused = false;
    overlay.style.opacity = '0';
    setTimeout(() => overlay.style.visibility = 'hidden', 300);
    
    spawnFood();
    if (gameLoop) cancelAnimationFrame(gameLoop);
    lastTime = 0;
    requestAnimationFrame(main);
}

function spawnFood() {
    const r = Math.random();
    if (r > 0.9) foodType = 'golden';
    else if (r > 0.85) foodType = 'poison';
    else foodType = 'regular';

    food = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount),
        type: foodType
    };

    // Make sure food doesn't spawn on snake
    if (snake.some(segment => segment.x === food.x && segment.y === food.y)) {
        spawnFood();
    }
}

function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
        overlay.style.visibility = 'visible';
        overlay.style.opacity = '1';
        overlayTitle.textContent = 'PAUSED';
        overlayMsg.textContent = 'Press Space to Resume';
        startBtn.style.display = 'none';
    } else {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.style.visibility = 'hidden', 300);
        startBtn.style.display = 'inline-flex';
        lastTime = performance.now();
        requestAnimationFrame(main);
    }
}

function gameOver() {
    gameActive = false;
    sounds.gameOver();
    overlay.style.visibility = 'visible';
    overlay.style.opacity = '1';
    overlayTitle.textContent = 'GAME OVER';
    overlayMsg.textContent = `Score: ${score}`;
    startBtn.style.display = 'inline-flex';
    startBtn.textContent = 'Try Again';

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
        highScoreElement.textContent = highScore;
        overlayMsg.textContent = `New High Score: ${score}!`;
    }
}

function update() {
    if (!gameActive || isPaused) return;

    direction = nextDirection;
    const head = { ...snake[0] };

    if (direction === 'up') head.y--;
    if (direction === 'down') head.y++;
    if (direction === 'left') head.x--;
    if (direction === 'right') head.x++;

    // Wall collision
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        return gameOver();
    }

    // Self collision
    if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        return gameOver();
    }

    snake.unshift(head);

    // Food collision
    if (head.x === food.x && head.y === food.y) {
        let pColor = '#ff2d2d';
        if (food.type === 'regular') {
            score += 10;
            sounds.eat();
        } else if (food.type === 'golden') {
            score += 50;
            sounds.eatGolden();
            pColor = '#ffcc00';
        } else if (food.type === 'poison') {
            score = Math.max(0, score - 20);
            sounds.eatPoison();
            pColor = '#9933ff';
            if (snake.length > 2) snake.pop(); // Shrink a bit if possible
        }

        createParticles(food.x * tileSize + tileSize / 2, food.y * tileSize + tileSize / 2, pColor);
        scoreElement.textContent = score;
        
        // Speed up every 100 points (slower progression)
        if (score > 0 && score % 100 === 0 && speed > 40) {
            speed -= 5;
        }

        spawnFood();
    } else {
        snake.pop();
    }
}

function draw() {
    // Clear canvas
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid (optional, very subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i < tileCount; i++) {
        ctx.beginPath();
        ctx.moveTo(i * tileSize, 0);
        ctx.lineTo(i * tileSize, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * tileSize);
        ctx.lineTo(canvas.width, i * tileSize);
        ctx.stroke();
    }

    // Draw Particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.update();
        p.draw();
    });

    // Draw Food
    if (food) {
        let color = '#ff2d2d';
        let glow = 'rgba(255, 45, 45, 0.5)';
        if (food.type === 'golden') {
            color = '#ffcc00';
            glow = 'rgba(255, 204, 0, 0.6)';
        } else if (food.type === 'poison') {
            color = '#9933ff';
            glow = 'rgba(153, 51, 255, 0.5)';
        }

        // Pulse effect
        const pulse = Math.sin(Date.now() / 150) * 2;
        ctx.shadowBlur = 15 + pulse;
        ctx.shadowColor = glow;
        ctx.fillStyle = color;
        
        ctx.beginPath();
        ctx.arc(
            food.x * tileSize + tileSize / 2,
            food.y * tileSize + tileSize / 2,
            (tileSize / 2 - 2) + pulse/2,
            0, Math.PI * 2
        );
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Draw Snake
    snake.forEach((segment, index) => {
        const isHead = index === 0;
        
        // Gradient color for snake
        const ratio = index / snake.length;
        ctx.fillStyle = isHead ? '#4ea1ff' : `rgba(78, 161, 255, ${1 - ratio * 0.6})`;
        
        if (isHead) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(78, 161, 255, 0.5)';
        } else {
            ctx.shadowBlur = 0;
        }

        // Draw rounded rectangle for segment
        const padding = 2;
        ctx.beginPath();
        const x = segment.x * tileSize + padding;
        const y = segment.y * tileSize + padding;
        const w = tileSize - padding * 2;
        const h = tileSize - padding * 2;
        const r = isHead ? 6 : 4;
        
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.fill();

        // Draw eyes on head
        if (isHead) {
            ctx.fillStyle = 'white';
            const eyeSize = tileSize / 6;
            let eyeX1, eyeY1, eyeX2, eyeY2;

            if (direction === 'right') {
                eyeX1 = x + w * 0.7; eyeY1 = y + h * 0.2;
                eyeX2 = x + w * 0.7; eyeY2 = y + h * 0.7;
            } else if (direction === 'left') {
                eyeX1 = x + w * 0.2; eyeY1 = y + h * 0.2;
                eyeX2 = x + w * 0.2; eyeY2 = y + h * 0.7;
            } else if (direction === 'up') {
                eyeX1 = x + w * 0.2; eyeY1 = y + h * 0.2;
                eyeX2 = x + w * 0.7; eyeY2 = y + h * 0.2;
            } else {
                eyeX1 = x + w * 0.2; eyeY1 = y + h * 0.7;
                eyeX2 = x + w * 0.7; eyeY2 = y + h * 0.7;
            }
            
            ctx.beginPath();
            ctx.arc(eyeX1 + eyeSize, eyeY1 + eyeSize, eyeSize, 0, Math.PI * 2);
            ctx.arc(eyeX2 + eyeSize, eyeY2 + eyeSize, eyeSize, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

function main(currentTime) {
    if (!gameActive || isPaused) return;

    gameLoop = requestAnimationFrame(main);

    const deltaTime = currentTime - lastTime;
    if (deltaTime < speed) return;

    lastTime = currentTime;
    update();
    draw();
}

startBtn.addEventListener('click', startGame);

// Initial draw
draw();
overlayMsg.textContent = "Use Arrows to move. Try to reach the High Score!";
overlayTitle.textContent = "SNAKE GAME";
startBtn.textContent = "Start Game";
