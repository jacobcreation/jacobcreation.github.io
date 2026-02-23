import * as THREE from 'three';
import PartySocket from 'partysocket';

// ----------------------------------------------------
// 1. GAME STATE
// ----------------------------------------------------
const gameState = {
    players: {},
    myId: null,
    coins: 0,
    health: 100,
    dead: false,
    team: null,
    teamScores: { red: 0, blue: 0 },
    spells: { dash: 0, shield: 0, blast: 0 },
    dashEndTime: 0
};

// Controls
const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
    space: false
};

// Global Mesh/State Collections
const otherTanks = {};
const activeProjectiles = {};
const clock = new THREE.Clock();
let timeSinceLastSend = 0;
let lastSendTime = 0;
let partySocket = null;
let myTank = null;
let buildings = [];

// ----------------------------------------------------
// 2. THREE.JS SETUP
// ----------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510);
scene.fog = new THREE.Fog(0x050510, 20, 150);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const cameraOffset = new THREE.Vector3(0, 12, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Raycaster for aiming
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, 40, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.left = -50;
dirLight.shadow.camera.right = 50;
dirLight.shadow.camera.top = 50;
dirLight.shadow.camera.bottom = -50;
scene.add(dirLight);

// Landscape (Ground)
const groundGeometry = new THREE.PlaneGeometry(250, 250, 64, 64);
const posAttr = groundGeometry.attributes.position;
for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);

    // Calculate distance from center
    const dist = Math.sqrt(vx * vx + vy * vy);
    let vz = 0;

    // Flat combat arena in the center (radius ~35)
    if (dist > 35) {
        // Curve upwards
        const upward = Math.pow(dist - 35, 1.2) * 0.4;
        // Add procedural noise (hills)
        const noise = Math.sin(vx * 0.1) * Math.cos(vy * 0.1) * 4 + Math.sin(vx * 0.05 + vy * 0.03) * 6;
        vz = upward + noise;
    }
    posAttr.setZ(i, vz);
}
groundGeometry.computeVertexNormals();

const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x0d0d1a,
    roughness: 0.9,
    metalness: 0.1,
    flatShading: true // Low-poly aesthetic
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Procedural Grid overlay that maps to the terrain
const gridGeo = new THREE.WireframeGeometry(groundGeometry);
const gridMat = new THREE.LineBasicMaterial({ color: 0x00d2d3, transparent: true, opacity: 0.1 });
const gridLines = new THREE.LineSegments(gridGeo, gridMat);
gridLines.rotation.x = -Math.PI / 2;
gridLines.position.y = 0.1; // Slightly above ground to prevent z-fighting
scene.add(gridLines);

// Starry Sky Background
const starsGeo = new THREE.BufferGeometry();
const starsCount = 2000;
const posArray = new Float32Array(starsCount * 3);
for (let i = 0; i < starsCount * 3; i += 3) {
    posArray[i] = (Math.random() - 0.5) * 600;
    posArray[i + 1] = Math.random() * 200 + 30; // High in the sky
    posArray[i + 2] = (Math.random() - 0.5) * 600;
}
starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0.8 });
const starMesh = new THREE.Points(starsGeo, starsMat);
scene.add(starMesh);

// ----------------------------------------------------
// 3. TANK CREATION 
// ----------------------------------------------------
function createTankMesh(colorHex = 0x1dd1a1) {
    const group = new THREE.Group();

    // Base/Tracks
    const tracksGeo = new THREE.BoxGeometry(2.4, 0.6, 3.4);
    const tracksMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.8 });
    const tracks = new THREE.Mesh(tracksGeo, tracksMat);
    tracks.position.y = 0.3;
    tracks.castShadow = true;
    group.add(tracks);

    // Body
    const bodyGeo = new THREE.BoxGeometry(2, 0.8, 3);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.4,
        metalness: 0.6,
        emissive: colorHex,
        emissiveIntensity: 0.2
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.0;
    body.castShadow = true;
    group.add(body);

    // Turret
    const turretGeo = new THREE.BoxGeometry(1.2, 0.8, 1.5);
    const turret = new THREE.Mesh(turretGeo, bodyMat);
    turret.position.y = 1.8;
    turret.castShadow = true;

    // Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.15, 0.15, 2);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x747d8c, roughness: 0.2, metalness: 0.8 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -1.5);
    barrel.castShadow = true;

    turret.add(barrel);
    group.add(turret);

    // Store reference to turret for aiming later
    group.userData.turret = turret;

    return group;
}

function spawnBuilding(b) {
    const height = 15;
    const geo = new THREE.BoxGeometry(b.width, height, b.depth);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x0a0a1a,
        roughness: 0.6,
        metalness: 0.4,
        transparent: true,
        opacity: 0.95
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(b.x, height / 2, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const edges = new THREE.EdgesGeometry(geo);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x22a6b3, linewidth: 2 });
    const wireframe = new THREE.LineSegments(edges, edgeMat);
    mesh.add(wireframe);

    scene.add(mesh);
    buildings.push(b);
}

// ----------------------------------------------------
// 4. HELPERS & UI
// ----------------------------------------------------
function toggleShop() {
    const shop = document.getElementById('shop-modal');
    if (shop) shop.classList.toggle('hidden');
}

function buySpell(spellId) {
    if (partySocket && partySocket.readyState === 1) {
        partySocket.send(JSON.stringify({ type: 'buy_spell', spell: spellId }));
    }
}

function updateSpellUI() {
    const dashBtn = document.getElementById('buy-dash');
    const shieldBtn = document.getElementById('buy-shield');
    const blastBtn = document.getElementById('buy-blast');
    if (dashBtn) dashBtn.innerText = `Dash x${gameState.spells.dash} (50 Coins) [Q]`;
    if (shieldBtn) shieldBtn.innerText = `Shield x${gameState.spells.shield} (100 Coins) [E]`;
    if (blastBtn) blastBtn.innerText = `Big Blast x${gameState.spells.blast} (150 Coins) [F]`;
}

function showDeathScreen() {
    const ds = document.getElementById('death-screen');
    if (ds) ds.classList.remove('hidden');
}

function hideDeathScreen() {
    const ds = document.getElementById('death-screen');
    if (ds) ds.classList.add('hidden');
}

function updateScoreboard() {
    const red = document.getElementById('red-score');
    const blue = document.getElementById('blue-score');
    if (red) red.innerText = gameState.teamScores.red;
    if (blue) blue.innerText = gameState.teamScores.blue;
}

function spawnOtherTank(id, state) {
    const tank = createTankMesh(state.color);
    tank.position.set(state.x, 0, state.z);
    tank.rotation.y = state.ry;
    tank.userData = {
        ...tank.userData,
        targetPosition: new THREE.Vector3(state.x, 0, state.z),
        targetRotationY: state.ry
    };
    otherTanks[id] = tank;
    scene.add(tank);
}

function castSpell(spellId) {
    if (gameState.spells[spellId] > 0 && partySocket && partySocket.readyState === 1) {
        gameState.spells[spellId]--;
        updateSpellUI();

        let extraParams = {};
        if (spellId === 'blast' && myTank) {
            let shootRy = myTank.rotation.y + Math.PI;
            let spawnX = myTank.position.x;
            let spawnZ = myTank.position.z;

            if (myTank.userData.turret) {
                const barrelTip = new THREE.Vector3(0, 0, -2.5);
                barrelTip.applyMatrix4(myTank.userData.turret.matrixWorld);
                spawnX = barrelTip.x;
                spawnZ = barrelTip.z;

                const dir = new THREE.Vector3(0, 0, -1);
                dir.transformDirection(myTank.userData.turret.matrixWorld);
                shootRy = Math.atan2(dir.x, dir.z);
            }

            extraParams = { x: spawnX, y: 1.8, z: spawnZ, ry: shootRy };
        }
        partySocket.send(JSON.stringify({ type: 'cast_spell', spell: spellId, ...extraParams }));
    }
}

// ----------------------------------------------------
// 5. INPUT & LISTENERS
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (keys.hasOwnProperty(k)) keys[k] = true;
        if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
        if (k === 'b') toggleShop();

        if (k === 'q') castSpell('dash');
        if (k === 'e') castSpell('shield');
        if (k === 'f') castSpell('blast');
    });

    window.addEventListener('keyup', (e) => {
        const k = e.key.toLowerCase();
        if (keys.hasOwnProperty(k)) keys[k] = false;
        if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const closeShop = document.getElementById('close-shop');
    if (closeShop) closeShop.addEventListener('click', toggleShop);

    const buyDash = document.getElementById('buy-dash');
    const buyShield = document.getElementById('buy-shield');
    const buyBlast = document.getElementById('buy-blast');
    if (buyDash) buyDash.addEventListener('click', () => buySpell('dash'));
    if (buyShield) buyShield.addEventListener('click', () => buySpell('shield'));
    if (buyBlast) buyBlast.addEventListener('click', () => buySpell('blast'));

    window.addEventListener('mousemove', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('mousedown', (e) => {
        if (e.button === 0 && myTank && partySocket && partySocket.readyState === 1) {
            let shootRy = myTank.rotation.y + Math.PI;
            let spawnX = myTank.position.x;
            let spawnZ = myTank.position.z;

            if (myTank.userData.turret) {
                const barrelTip = new THREE.Vector3(0, 0, -2.5);
                barrelTip.applyMatrix4(myTank.userData.turret.matrixWorld);
                spawnX = barrelTip.x;
                spawnZ = barrelTip.z;
                const dir = new THREE.Vector3(0, 0, -1);
                dir.transformDirection(myTank.userData.turret.matrixWorld);
                shootRy = Math.atan2(dir.x, dir.z);
            }

            partySocket.send(JSON.stringify({
                type: 'shoot', x: spawnX, y: 1.8, z: spawnZ, ry: shootRy
            }));
        }
    });

    const respawnBtn = document.getElementById('respawn-btn');
    if (respawnBtn) respawnBtn.addEventListener('click', () => {
        if (partySocket && partySocket.readyState === 1) {
            partySocket.send(JSON.stringify({ type: 'respawn' }));
            hideDeathScreen();
        }
    });

    const quitBtn = document.getElementById('quit-btn');
    if (quitBtn) quitBtn.addEventListener('click', () => {
        window.location.href = "../index.html";
    });

    // Start Loops & Network AFTER listeners are ready
    animate();
    initNetwork();
});


// ----------------------------------------------------
// 6. PROJECTILES
// ----------------------------------------------------
function spawnClientProjectile(id, proj) {
    const size = proj.isBlast ? 1.0 : 0.3;
    const geo = new THREE.SphereGeometry(size, 8, 8);
    const color = proj.isBlast ? 0xfeca57 : 0xff3838;
    const mat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.8
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(proj.x, proj.y, proj.z);

    // Attach velocity metadata
    mesh.userData = {
        vx: Math.sin(proj.ry) * (proj.isBlast ? 8 : 10),
        vz: Math.cos(proj.ry) * (proj.isBlast ? 8 : 10)
    };

    scene.add(mesh);
    activeProjectiles[id] = mesh;
}

// ----------------------------------------------------
// 7. ANIMATION LOOP
// ----------------------------------------------------
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    // Local movement predictions
    if (myTank && !gameState.dead) {
        const isDashing = Date.now() < gameState.dashEndTime;
        const moveSpeed = (isDashing ? 35 : 12) * dt;
        const rotateSpeed = 2.5 * dt;

        let moved = false;
        const oldPos = myTank.position.clone();

        if (keys['w'] || keys['arrowup']) {
            myTank.translateZ(-moveSpeed);
            moved = true;
        }
        if (keys['s'] || keys['arrowdown']) {
            myTank.translateZ(moveSpeed);
            moved = true;
        }

        // Build collision prediction
        if (moved) {
            let hitBuilding = false;
            const radius = 1.5;
            for (const b of buildings) {
                if (myTank.position.x > b.x - b.width / 2 - radius && myTank.position.x < b.x + b.width / 2 + radius &&
                    myTank.position.z > b.z - b.depth / 2 - radius && myTank.position.z < b.z + b.depth / 2 + radius) {
                    hitBuilding = true;
                    break;
                }
            }
            if (hitBuilding) {
                myTank.position.copy(oldPos);
                moved = false;
            }
        }

        if (keys['a'] || keys['arrowleft']) {
            myTank.rotation.y += rotateSpeed;
            moved = true;
        }
        if (keys['d'] || keys['arrowright']) {
            myTank.rotation.y -= rotateSpeed;
            moved = true;
        }

        // Camera follow (smooth)
        const idealOffset = cameraOffset.clone().applyMatrix4(myTank.matrixWorld);
        camera.position.lerp(idealOffset, 0.1);
        camera.lookAt(myTank.position);

        // Turret Aiming
        if (myTank.userData.turret) {
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(ground);
            if (intersects.length > 0) {
                const target = intersects[0].point;
                const dx = target.x - myTank.position.x;
                const dz = target.z - myTank.position.z;
                // Angle towards target. Since the barrel is at -Z relative to the turret, 
                // we rotate it by PI (180 degrees) so -Z points at the target.
                const globalAngle = Math.atan2(dx, dz) + Math.PI;
                myTank.userData.turret.rotation.y = globalAngle - myTank.rotation.y;
            }
        }

        // Send network update approx 20 times a second
        timeSinceLastSend += dt;
        if (moved && partySocket && partySocket.readyState === 1 && timeSinceLastSend > 0.05) {
            partySocket.send(JSON.stringify({
                type: 'move',
                x: myTank.position.x,
                y: myTank.position.y,
                z: myTank.position.z,
                ry: myTank.rotation.y
            }));
            timeSinceLastSend = 0;
        }
    }

    // Interpolate other players to their target network position
    for (const id in otherTanks) {
        const tank = otherTanks[id];
        if (tank.userData.targetPosition) {
            tank.position.lerp(tank.userData.targetPosition, 0.3);

            // Simple rotation lerp
            const diff = tank.userData.targetRotationY - tank.rotation.y;
            // Normalize angular difference
            const shortestAngle = Math.atan2(Math.sin(diff), Math.cos(diff));
            tank.rotation.y += shortestAngle * 0.3;
        }
    }

    // Move projectiles
    for (const [pId, mesh] of Object.entries(activeProjectiles)) {
        mesh.position.x += mesh.userData.vx * dt;
        mesh.position.z += mesh.userData.vz * dt;
    }

    renderer.render(scene, camera);
}

// ----------------------------------------------------
// 8. MULTIPLAYER WEBSOCKET SETUP
// ----------------------------------------------------
function initNetwork() {
    const host = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "localhost:1999"
        : "tanks-backend.jacobcreation.partykit.dev";

    try {
        partySocket = new PartySocket({
            host: host,
            room: "global-arena"
        });

        partySocket.addEventListener("message", (e) => {
            const data = JSON.parse(e.data);

            if (data.type === "init") {
                const statusEl = document.getElementById('match-status');
                if (statusEl) {
                    statusEl.innerText = "Connected!";
                    statusEl.style.color = "#1dd1a1";
                    setTimeout(() => statusEl.classList.add('hidden'), 2000);
                }

                gameState.myId = data.id;
                gameState.team = data.team;
                if (data.teamScores) {
                    gameState.teamScores = data.teamScores;
                    updateScoreboard();
                }

                // Initialize buildings
                if (data.buildings && buildings.length === 0) {
                    for (const b of data.buildings) {
                        spawnBuilding(b);
                    }
                }

                // Spawn our tank
                if (!myTank) {
                    myTank = createTankMesh(data.myColor);
                    myTank.position.set(data.state[data.id].x, 0, data.state[data.id].z);
                    myTank.rotation.y = data.state[data.id].ry;
                    scene.add(myTank);

                    // Set match status based on team
                    const s = document.getElementById('match-status');
                    if (s) {
                        s.innerText = `YOU ARE ON ${data.team.toUpperCase()} TEAM`;
                        s.style.color = data.team === 'red' ? '#ff4757' : '#54a0ff';
                        s.classList.remove('hidden');
                    }
                }

                // Spawn existing players
                for (const [id, state] of Object.entries(data.state)) {
                    if (id !== gameState.myId && !otherTanks[id]) {
                        spawnOtherTank(id, state);
                    }
                }
            }
            else if (data.type === "update") {
                if (data.players[gameState.myId]) {
                    const myState = data.players[gameState.myId];
                    if (myState.health < gameState.health) {
                        const hb = document.getElementById('health-bar');
                        if (hb) hb.style.background = 'linear-gradient(90deg, #ff6b6b, #ee5253)';
                        setTimeout(() => {
                            if (hb) hb.style.background = 'linear-gradient(90deg, #1dd1a1, #10ac84)';
                        }, 500);
                    }

                    if (myState.health === 100 && gameState.health <= 0 && myTank) {
                        myTank.position.set(myState.x, myState.y, myState.z);
                    }

                    gameState.health = myState.health;
                    gameState.coins = myState.coins;

                    if (data.teamScores) {
                        gameState.teamScores = data.teamScores;
                        updateScoreboard();
                    }

                    if (myState.dead && !gameState.dead) {
                        gameState.dead = true;
                        showDeathScreen();
                        if (myTank) myTank.visible = false;
                    } else if (!myState.dead && gameState.dead) {
                        gameState.dead = false;
                        hideDeathScreen();
                        if (myTank) {
                            myTank.position.set(myState.x, 0, myState.z);
                            myTank.visible = true;
                        }
                    }

                    if (myState.spells) {
                        gameState.spells = {
                            dash: myState.spells.dash || 0,
                            shield: myState.spells.shield || 0,
                            blast: myState.spells.blast || 0
                        };
                        updateSpellUI();
                    }

                    const hbWidth = document.getElementById('health-bar');
                    const cc = document.getElementById('coin-count');
                    if (hbWidth) hbWidth.style.width = Math.max(0, gameState.health) + '%';
                    if (cc) cc.innerText = gameState.coins;
                }

                for (const [id, state] of Object.entries(data.players)) {
                    if (id === gameState.myId) continue;
                    if (otherTanks[id]) {
                        otherTanks[id].userData.targetPosition.set(state.x, 0, state.z);
                        otherTanks[id].userData.targetRotationY = state.ry;
                        otherTanks[id].visible = !state.dead;
                    } else if (!state.dead) {
                        spawnOtherTank(id, state);
                    }
                }

                if (data.removedProjectiles) {
                    for (const pId of data.removedProjectiles) {
                        if (activeProjectiles[pId]) {
                            scene.remove(activeProjectiles[pId]);
                            delete activeProjectiles[pId];
                        }
                    }
                }
            }
            else if (data.type === "spawn_projectile") {
                spawnClientProjectile(data.id, data.proj);
            }
            else if (data.type === "remove") {
                if (otherTanks[data.id]) {
                    scene.remove(otherTanks[data.id]);
                    delete otherTanks[data.id];
                }
            }
            else if (data.type === "spell_effect") {
                const targetTank = data.id === gameState.myId ? myTank : otherTanks[data.id];
                if (targetTank) {
                    if (data.spell === 'dash' && data.id === gameState.myId) {
                        gameState.dashEndTime = Date.now() + 1000;
                    } else if (data.spell === 'shield') {
                        const shieldGeo = new THREE.SphereGeometry(2.5, 16, 16);
                        const shieldMat = new THREE.MeshBasicMaterial({ color: 0x48dbfb, transparent: true, opacity: 0.4, wireframe: true });
                        const shield = new THREE.Mesh(shieldGeo, shieldMat);
                        targetTank.add(shield);
                        setTimeout(() => { targetTank.remove(shield); }, 5000);
                    }
                }
            }
        });

        partySocket.addEventListener("open", () => {
            console.log("Connected to PartyKit server");
        });
    } catch (e) {
        console.warn("PartySocket library not loaded yet or failed to connect.", e);
        if (!myTank) {
            myTank = createTankMesh(0xff9ff3);
            scene.add(myTank);
        }
    }
}
