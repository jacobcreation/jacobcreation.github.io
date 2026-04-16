const {
    Engine, Render, Runner, Events,
    MouseConstraint, Mouse, Composite, Bodies, Body, Constraint, Vector
} = Matter;

let engine;
let bird;
let slingshotConstraint;
let isFired = false;
let score = 0;
let enemies = [];
let blocks = [];
let bodyToElement = new Map();

let GAME_WIDTH = window.innerWidth;
let GAME_HEIGHT = window.innerHeight;
let WORLD_WIDTH = 2500;
let GROUND_Y = GAME_HEIGHT * 0.85;
let SLING_X = 250;
let SLING_Y = GROUND_Y - 150;

let birdsRemaining = 3;
let gameState = 'playing';
let cameraX = 0;
let gameMouse;
let stopTimer = 0;
let frameCount = 0;

const gameContainer = document.getElementById('game-container');
const gameLayer = document.getElementById('game-layer');
const slingshotBand = document.getElementById('slingshot-band');

function init() {
    engine = Engine.create();
    
    createEnvironment();
    createBird();
    createLevel();

    setupMouse();
    setupCollisions();

    Runner.run(Runner.create(), engine);
    requestAnimationFrame(renderLoop);

    document.getElementById('reset-button').addEventListener('click', resetGame);
}

function createDOMElement(body, className, width, height) {
    const el = document.createElement('div');
    el.classList.add('body', className);
    el.style.width = width + 'px';
    el.style.height = height + 'px';
    
    if (className === 'ground') {
        el.style.width = '120%';
    }
    
    gameLayer.appendChild(el);
    bodyToElement.set(body, { element: el, width, height });
    return el;
}

function createEnvironment() {
    const groundHeight = Math.max(GAME_HEIGHT - GROUND_Y, 100);
    const ground = Bodies.rectangle(WORLD_WIDTH / 2, GROUND_Y + groundHeight / 2, WORLD_WIDTH * 2, groundHeight, { 
        isStatic: true, label: 'ground' 
    });
    createDOMElement(ground, 'ground', WORLD_WIDTH * 2, groundHeight);
    
    const slingW = 20;
    const slingH = 150;
    const slingBase1 = Bodies.rectangle(SLING_X, SLING_Y + slingH / 2, slingW, slingH, {
        isStatic: true, label: 'slingshot', isSensor: true
    });
    createDOMElement(slingBase1, 'slingshot', slingW, slingH);

    Composite.add(engine.world, [ground, slingBase1]);
}

function createBird() {
    const radius = 22;
    bird = Bodies.circle(SLING_X, SLING_Y, radius, {
        restitution: 0.6,
        density: 0.005,
        friction: 0.5,
        label: 'bird',
        collisionFilter: { category: 0x0002 }
    });
    createDOMElement(bird, 'bird', radius * 2, radius * 2);

    slingshotConstraint = Constraint.create({
        pointA: { x: SLING_X, y: SLING_Y },
        bodyB: bird,
        stiffness: 0.05,
        damping: 0.01,
        length: 10
    });

    Composite.add(engine.world, [bird, slingshotConstraint]);
    isFired = false;
    slingshotBand.style.display = 'block';
}

function createLevel() {
    const startX = 1200;
    
    buildCastle(startX, GROUND_Y);
    buildCastle(startX + 220, GROUND_Y);
    
    addBlock(startX + 110, GROUND_Y - 15, 60, 30, 'stone');
    addPig(startX + 110, GROUND_Y - 49);
}

function buildCastle(centerX, bottomY) {
    const blockW = 30;
    const blockH = 90;
    
    addBlock(centerX - 45, bottomY - blockH / 2, blockW, blockH, 'block');
    addBlock(centerX + 45, bottomY - blockH / 2, blockW, blockH, 'block');
    addBlock(centerX, bottomY - blockH - blockW / 2, 140, blockW, 'glass');
    addPig(centerX, bottomY - 19);
    
    const floor2Y = bottomY - blockH - blockW;
    addBlock(centerX - 30, floor2Y - blockH / 2, blockW, blockH, 'block');
    addBlock(centerX + 30, floor2Y - blockH / 2, blockW, blockH, 'block');
    addBlock(centerX, floor2Y - blockH - blockW / 2, 110, blockW, 'stone');
    addPig(centerX, floor2Y - 19);
    
    addPig(centerX, floor2Y - blockH - blockW - 19);
}

function addBlock(x, y, w, h, typeClass = 'block') {
    let massProps = {
        restitution: 0.2,
        friction: 0.6,
        label: 'block',
        collisionFilter: { category: 0x0001 }
    };
    if (typeClass === 'glass') {
        massProps.density = 0.0005; 
        massProps.label = 'glass';
    } else if (typeClass === 'stone') {
        massProps.density = 0.005; 
        massProps.label = 'stone';
    }

    const block = Bodies.rectangle(x, y, w, h, massProps);
    blocks.push(block);
    createDOMElement(block, typeClass, w, h);
    Composite.add(engine.world, block);
    return block;
}

function addPig(x, y) {
    const radius = 18;
    const pig = Bodies.circle(x, y, radius, {
        restitution: 0.4,
        density: 0.002,
        friction: 0.5,
        label: 'pig',
        collisionFilter: { category: 0x0001 }
    });
    enemies.push(pig);
    createDOMElement(pig, 'pig', radius * 2, radius * 2);
    Composite.add(engine.world, pig);
    return pig;
}

function setupMouse() {
    gameMouse = Mouse.create(gameContainer);
    
    const mouseConstraint = MouseConstraint.create(engine, {
        mouse: gameMouse,
        constraint: {
            stiffness: 0.1,
            render: { visible: false }
        },
        collisionFilter: {
            mask: 0x0002 
        }
    });

    Composite.add(engine.world, mouseConstraint);

    Events.on(mouseConstraint, 'enddrag', function(event) {
        if (event.body === bird && !isFired) {
            isFired = true;
            bird.collisionFilter.category = 0x0001; 
        }
    });
}

function setupCollisions() {
    Events.on(engine, 'collisionStart', function(event) {
        const pairs = event.pairs;
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;

            const relVelX = bodyA.velocity.x - bodyB.velocity.x;
            const relVelY = bodyA.velocity.y - bodyB.velocity.y;
            const speedScale = Math.sqrt(relVelX * relVelX + relVelY * relVelY);
            
            if (speedScale < 4) continue;
            
            checkDamage(bodyA, speedScale, bodyB.mass);
            checkDamage(bodyB, speedScale, bodyA.mass);
        }
    });
}

function checkDamage(body, impactVelocity, collidingMass) {
    if (body.isStatic || !body.label) return;

    const effMass = (collidingMass === Infinity) ? 10 : collidingMass;
    let effectiveImpact = impactVelocity * (effMass / 5);

    if (body.label === 'pig' && effectiveImpact > 5) {
        destroyBody(body, enemies);
        addScore(500, body);
    } else if (body.label === 'glass' && effectiveImpact > 3) {
        destroyBody(body, blocks);
        addScore(100, body);
    } else if (body.label === 'block' && effectiveImpact > 8) {
        destroyBody(body, blocks);
        addScore(50, body);
    } else if (body.label === 'stone' && effectiveImpact > 15) {
        destroyBody(body, blocks);
        addScore(100, body);
    }
}

function addScore(points, body = null) {
    score += points;
    const scoreEl = document.getElementById('score');
    scoreEl.innerText = score;
    scoreEl.style.transform = 'scale(1.5)';
    scoreEl.style.color = '#ffeb3b';
    setTimeout(() => {
        scoreEl.style.transform = 'scale(1)';
        scoreEl.style.color = '#fff';
    }, 200);

    if (body) {
        const floatEl = document.createElement('div');
        floatEl.className = 'floating-score';
        floatEl.innerText = '+' + points;
        floatEl.style.left = body.position.x + 'px';
        floatEl.style.top = body.position.y + 'px';
        gameLayer.appendChild(floatEl);
        setTimeout(() => { if (floatEl.parentNode) floatEl.parentNode.removeChild(floatEl); }, 1000);
    }
}

function destroyBody(body, arrayList) {
    if (!bodyToElement.has(body)) return;

    const index = arrayList.indexOf(body);
    if (index > -1) arrayList.splice(index, 1);
    
    Composite.remove(engine.world, body);
    
    const domData = bodyToElement.get(body);
    if (domData) {
        const el = domData.element;
        el.style.transition = 'opacity 0.2s, transform 0.2s';
        el.style.opacity = '0';
        el.style.transform = el.style.transform + ' scale(1.8)';
        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 200);
        bodyToElement.delete(body);
    }
}

function resetGame() {
    location.reload();
}

function nextTurn() {
    if (bird) {
        destroyBody(bird, []);
        bird = null;
    }
    birdsRemaining--;
    document.getElementById('birds-count').innerText = Math.max(0, birdsRemaining);
    
    if (birdsRemaining > 0 && enemies.length > 0) {
        createBird();
        stopTimer = 0;
    }
}

function endGame(result) {
    gameState = 'ended';
    const endScreen = document.getElementById('end-screen');
    const endTitle = document.getElementById('end-title');
    const finalScore = document.getElementById('final-score');
    
    endScreen.classList.remove('hidden');
    finalScore.innerText = score;
    
    if (result === 'win') {
        endTitle.innerText = "Level Cleared!";
        endTitle.style.color = "#4CAF50";
    } else {
        endTitle.innerText = "Level Failed!";
        endTitle.style.color = "#f44336";
    }
}

function renderLoop() {
    frameCount++;
    
    if (gameState === 'ended') return;

    // Camera Panning Logic
    if (bird && isFired) {
        const targetX = Math.max(0, bird.position.x - GAME_WIDTH / 3);
        cameraX += (targetX - cameraX) * 0.1;
        cameraX = Math.min(cameraX, WORLD_WIDTH - GAME_WIDTH);
    } else {
        cameraX += (0 - cameraX) * 0.1;
        cameraX = Math.max(0, cameraX); // Clamp so it doesn't overshoot start
    }
    
    gameLayer.style.transform = `translateX(${-cameraX}px)`;
    if (gameMouse) {
        Mouse.setOffset(gameMouse, { x: cameraX, y: 0 });
    }

    for (let [body, domData] of bodyToElement.entries()) {
        const x = body.position.x - domData.width / 2;
        const y = body.position.y - domData.height / 2;
        const angle = body.angle;
        domData.element.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad)`;
    }

    if (!isFired && slingshotConstraint) {
        const px = slingshotConstraint.pointA.x;
        const py = slingshotConstraint.pointA.y;
        const bx = bird.position.x;
        const by = bird.position.y;
        
        const dx = bx - px;
        const dy = by - py;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const angle = Math.atan2(dy, dx);

        slingshotBand.style.left = px + 'px';
        slingshotBand.style.top = py + 'px';
        slingshotBand.style.width = dist + 'px';
        slingshotBand.style.transform = `rotate(${angle}rad)`;
    } else if (isFired && slingshotConstraint) {
        // Auto detach spring band
        if (bird.position.x > SLING_X - 15 || bird.velocity.x < -2) {
            Composite.remove(engine.world, slingshotConstraint);
            slingshotBand.style.display = 'none';
            slingshotConstraint = null;
        }
    }

    // Bird trails & turn management
    if (isFired && bird) {
        if (frameCount % 4 === 0 && bird.speed > 3) {
            const dot = document.createElement('div');
            dot.className = 'trail-dot';
            dot.style.left = bird.position.x + 'px';
            dot.style.top = bird.position.y + 'px';
            gameLayer.appendChild(dot);
            setTimeout(() => { if (dot.parentNode) dot.parentNode.removeChild(dot); }, 2000);
        }

        const outOfBounds = bird.position.x > WORLD_WIDTH || bird.position.x < -100 || bird.position.y > GAME_HEIGHT + 200;
        const stopped = bird.speed < 0.5 && bird.angularVelocity < 0.05;
        
        if (outOfBounds || stopped) {
            stopTimer++;
            if (stopTimer > 90 || outOfBounds) {
                nextTurn();
            }
        } else {
            stopTimer = 0;
        }
    }
    
    // Win / Lose Checks
    if (gameState === 'playing') {
        if (enemies.length === 0) {
            gameState = 'waiting';
            setTimeout(() => endGame('win'), 1500);
        } else if (birdsRemaining === 0 && !bird) {
            let blocksMoving = blocks.some(b => b.speed > 1);
            if (!blocksMoving) {
                gameState = 'waiting';
                setTimeout(() => endGame('lose'), 1500);
            }
        }
    }

    requestAnimationFrame(renderLoop);
}

window.onload = () => {
    setTimeout(init, 50); 
};

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { location.reload(); }, 300);
});
