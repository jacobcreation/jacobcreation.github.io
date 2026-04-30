const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Dimensions - Fixed height for physics consistency, dynamic width
const GAME_HEIGHT = 512;
let gameWidth = 288;

function resize() {
    const windowRatio = window.innerWidth / window.innerHeight;
    const gameRatio = 288 / 512;

    if (windowRatio > gameRatio) {
        // Landscape or wider screens
        canvas.height = GAME_HEIGHT;
        canvas.width = GAME_HEIGHT * windowRatio;
    } else {
        // Portrait or narrower screens
        canvas.height = GAME_HEIGHT;
        canvas.width = 288; // Keep original width as minimum for assets
    }
    gameWidth = canvas.width;
}

window.addEventListener('resize', resize);
resize();

// Game Constants
const GRAVITY = 0.25;
const JUMP = -4.5;
const SPEED = 2;
const PIPE_SPAWN_RATE = 100; // frames
const PIPE_GAP = 100;

// Game State
let state = 'START'; // START, PLAYING, GAME_OVER
let score = 0;
let frames = 0;

// Assets
const images = {};
const sounds = {};

const imageAssets = [
    'background-day', 'base', 'yellowbird-upflap', 'yellowbird-midflap', 
    'yellowbird-downflap', 'pipe-green', 'message', 'gameover'
];
for (let i = 0; i <= 9; i++) imageAssets.push(i.toString());

const audioAssets = ['wing', 'hit', 'die', 'point', 'swooshing'];

function loadAssets() {
    let loadedCount = 0;
    const totalCount = imageAssets.length + audioAssets.length;

    return new Promise((resolve) => {
        imageAssets.forEach(name => {
            const img = new Image();
            img.src = `assets/sprites/${name}.png`;
            img.onload = () => {
                images[name] = img;
                loadedCount++;
                if (loadedCount === totalCount) resolve();
            };
        });

        audioAssets.forEach(name => {
            const audio = new Audio();
            audio.src = `assets/audio/${name}.wav`;
            audio.oncanplaythrough = () => {
                sounds[name] = audio;
                loadedCount++;
                if (loadedCount === totalCount) resolve();
            };
            // Fallback for audio if it doesn't load
            audio.onerror = () => {
                console.warn(`Failed to load sound: ${name}`);
                loadedCount++;
                if (loadedCount === totalCount) resolve();
            };
        });
    });
}

// Entities
const bird = {
    x: 50,
    y: 150,
    w: 34,
    h: 24,
    velocity: 0,
    rotation: 0,
    frame: 0,
    animation: ['yellowbird-midflap', 'yellowbird-upflap', 'yellowbird-midflap', 'yellowbird-downflap'],

    update() {
        if (state === 'START') {
            this.y = 150 + Math.sin(frames / 10) * 10;
            this.frame = Math.floor(frames / 10) % 4;
        } else {
            this.velocity += GRAVITY;
            this.y += this.velocity;

            if (this.y + this.h/2 >= canvas.height - images.base.height) {
                this.y = canvas.height - images.base.height - this.h/2;
                if (state === 'PLAYING') endGame();
            }

            // Rotation
            if (this.velocity <= 0) {
                this.rotation = Math.max(-25, -25 * (this.velocity / JUMP));
            } else {
                this.rotation = Math.min(90, 90 * (this.velocity / 10));
            }

            this.frame = Math.floor(frames / 5) % 4;
        }
    },

    draw() {
        const name = this.animation[this.frame];
        const img = images[name];
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.drawImage(img, -this.w / 2, -this.h / 2);
        ctx.restore();
    },

    flap() {
        this.velocity = JUMP;
        if (sounds.wing) {
            sounds.wing.currentTime = 0;
            sounds.wing.play();
        }
    }
};

const pipes = {
    list: [],
    update() {
        if (state !== 'PLAYING') return;

        if (frames % PIPE_SPAWN_RATE === 0) {
            const minHeight = 50;
            const maxHeight = canvas.height - images.base.height - PIPE_GAP - minHeight;
            const y = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;

            this.list.push({
                x: gameWidth,
                y: y,
                passed: false
            });
        }

        this.list.forEach((p, index) => {
            p.x -= SPEED;

            // Collision
            const birdLeft = bird.x - bird.w / 2 + 5;
            const birdRight = bird.x + bird.w / 2 - 5;
            const birdTop = bird.y - bird.h / 2 + 5;
            const birdBottom = bird.y + bird.h / 2 - 5;

            // Top pipe
            if (birdRight > p.x && birdLeft < p.x + images['pipe-green'].width &&
                birdTop < p.y) {
                endGame();
            }

            // Bottom pipe
            if (birdRight > p.x && birdLeft < p.x + images['pipe-green'].width &&
                birdBottom > p.y + PIPE_GAP) {
                endGame();
            }

            // Score
            if (!p.passed && bird.x > p.x + images['pipe-green'].width) {
                p.passed = true;
                score++;
                if (sounds.point) {
                    sounds.point.currentTime = 0;
                    sounds.point.play();
                }
            }

            if (p.x + images['pipe-green'].width < 0) {
                this.list.splice(index, 1);
            }
        });
    },

    draw() {
        this.list.forEach(p => {
            const pipeImg = images['pipe-green'];
            // Top pipe (flipped)
            ctx.save();
            ctx.translate(p.x + pipeImg.width / 2, p.y);
            ctx.scale(1, -1);
            ctx.drawImage(pipeImg, -pipeImg.width / 2, 0);
            ctx.restore();

            // Bottom pipe
            ctx.drawImage(pipeImg, p.x, p.y + PIPE_GAP);
        });
    }
};

const background = {
    x: 0,
    draw() {
        const img = images['background-day'];
        for (let i = 0; i <= Math.ceil(gameWidth / img.width); i++) {
            ctx.drawImage(img, this.x + i * img.width, 0);
        }
        if (state === 'PLAYING') {
            this.x -= 0.5;
            if (this.x <= -img.width) this.x = 0;
        }
    }
};

const ground = {
    x: 0,
    draw() {
        const img = images.base;
        for (let i = 0; i <= Math.ceil(gameWidth / img.width); i++) {
            ctx.drawImage(img, this.x + i * img.width, canvas.height - img.height);
        }
        if (state === 'PLAYING' || state === 'START') {
            this.x -= SPEED;
            if (this.x <= -img.width) this.x = 0;
        }
    }
};

function drawScore() {
    const scoreStr = score.toString();
    const totalWidth = scoreStr.length * 24;
    let startX = gameWidth / 2 - totalWidth / 2;

    for (let i = 0; i < scoreStr.length; i++) {
        const img = images[scoreStr[i]];
        ctx.drawImage(img, startX + i * 24, 20);
    }
}

function endGame() {
    state = 'GAME_OVER';
    if (sounds.hit) {
        sounds.hit.currentTime = 0;
        sounds.hit.play();
    }
    setTimeout(() => {
        if (sounds.die) {
            sounds.die.currentTime = 0;
            sounds.die.play();
        }
    }, 500);
}

function resetGame() {
    state = 'PLAYING';
    score = 0;
    frames = 0;
    bird.y = 150;
    bird.velocity = 0;
    bird.rotation = 0;
    pipes.list = [];
    if (sounds.swooshing) {
        sounds.swooshing.currentTime = 0;
        sounds.swooshing.play();
    }
}

// Input
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') handleInput();
});
canvas.addEventListener('mousedown', handleInput);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleInput();
});

function handleInput() {
    if (state === 'START') {
        resetGame();
    } else if (state === 'PLAYING') {
        bird.flap();
    } else if (state === 'GAME_OVER') {
        state = 'START';
        if (sounds.swooshing) {
            sounds.swooshing.currentTime = 0;
            sounds.swooshing.play();
        }
    }
}

// Main Loop
function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    background.draw();
    pipes.draw();
    ground.draw();
    bird.draw();

    if (state === 'START') {
        ctx.drawImage(images.message, gameWidth/2 - images.message.width/2, 50);
    } else if (state === 'GAME_OVER') {
        ctx.drawImage(images.gameover, gameWidth/2 - images.gameover.width/2, 100);
    }

    if (state === 'PLAYING' || state === 'GAME_OVER') {
        drawScore();
    }

    bird.update();
    pipes.update();

    frames++;
    requestAnimationFrame(loop);
}

loadAssets().then(() => {
    loop();
});
