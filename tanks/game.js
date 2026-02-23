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
let myTankYaw = 0; // Track yaw separately to avoid quaternion/Euler feedback loop

// ---- Infinite Terrain Chunk System ----
const CHUNK_SIZE = 64;     // world units per chunk
const CHUNK_SEGS = 24;     // geometry segments per chunk
const CHUNK_RADIUS = 3;    // how many chunks to keep loaded around the player
const loadedChunks = {};   // key = "cx_cz"

// Simple deterministic pseudo-noise (no external lib needed)
function noise(x, z, seed = 17) {
    const s = Math.sin(x * 127.1 + z * 311.7 + seed) * 43758.5453;
    return s - Math.floor(s);
}
function smoothNoise(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx);
    const uz = fz * fz * (3 - 2 * fz);
    return (
        noise(ix, iz) * (1 - ux) * (1 - uz) +
        noise(ix + 1, iz) * ux * (1 - uz) +
        noise(ix, iz + 1) * (1 - ux) * uz +
        noise(ix + 1, iz + 1) * ux * uz
    );
}
function terrainHeight(wx, wz) {
    // Large rolling hills
    let h = smoothNoise(wx * 0.008, wz * 0.008) * 18;
    // Medium bumps
    h += smoothNoise(wx * 0.025, wz * 0.025) * 6;
    // Fine detail
    h += smoothNoise(wx * 0.07, wz * 0.07) * 1.5;
    // Flatten the central combat zone
    const dist = Math.sqrt(wx * wx + wz * wz);
    const flat = Math.max(0, 1 - dist / 40);
    return h * (1 - flat * flat);
}

// ----------------------------------------------------
// 2. THREE.JS SETUP
// ----------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue
scene.fog = new THREE.Fog(0x87CEEB, 40, 200);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// cameraOffset is now strictly for first-person (relative to tank body)
const cameraOffset = new THREE.Vector3(0, 2.4, 0.5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Raycaster for aiming
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Lighting
const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x4a6741, 0.7); // sky blue top, dark green bottom
scene.add(hemisphereLight);

const dirLight = new THREE.DirectionalLight(0xfff5d0, 1.4); // warm sunlight
dirLight.position.set(80, 150, 60);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 4096;
dirLight.shadow.mapSize.height = 4096;
dirLight.shadow.camera.left = -120;
dirLight.shadow.camera.right = 120;
dirLight.shadow.camera.top = 120;
dirLight.shadow.camera.bottom = -120;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

// Sun halo/fill backlight
const fillLight = new THREE.DirectionalLight(0xaad4f5, 0.3);
fillLight.position.set(-80, 40, -60);
scene.add(fillLight);

// Chunk material (shared, vertex-coloring)
const groundMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.02,
    flatShading: true
});

function terrainColor(height) {
    if (height < 0.5) return new THREE.Color(0x5a8a3a); // flat grass
    if (height < 4) return new THREE.Color(0x4a7a2a); // light grass
    if (height < 8) return new THREE.Color(0x7a6040); // rocky brown
    if (height < 14) return new THREE.Color(0x6a5535); // dark rock
    return new THREE.Color(0xc8c8c8);                    // snow cap
}

function buildChunk(cx, cz) {
    const key = `${cx}_${cz}`;
    if (loadedChunks[key]) return;

    const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SEGS, CHUNK_SEGS);
    const pos = geo.attributes.position;
    const heights = [];

    for (let i = 0; i < pos.count; i++) {
        const localX = pos.getX(i);
        const localY = pos.getY(i);
        const wx = cx * CHUNK_SIZE + localX;
        const wz = cz * CHUNK_SIZE + localY;
        const h = terrainHeight(wx, wz);
        pos.setZ(i, h);
        heights.push(h);
    }
    geo.computeVertexNormals();

    // Assign vertex colors based on height
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
        const c = terrainColor(heights[i]);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mesh = new THREE.Mesh(geo, groundMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    mesh.receiveShadow = true;
    scene.add(mesh);
    loadedChunks[key] = mesh;
}

function updateChunks(playerX, playerZ) {
    const cx = Math.round(playerX / CHUNK_SIZE);
    const cz = Math.round(playerZ / CHUNK_SIZE);

    // Load chunks in radius
    for (let dx = -CHUNK_RADIUS; dx <= CHUNK_RADIUS; dx++) {
        for (let dz = -CHUNK_RADIUS; dz <= CHUNK_RADIUS; dz++) {
            buildChunk(cx + dx, cz + dz);
        }
    }

    // Unload far away chunks
    for (const key of Object.keys(loadedChunks)) {
        const [ccx, ccz] = key.split('_').map(Number);
        if (Math.abs(ccx - cx) > CHUNK_RADIUS + 1 || Math.abs(ccz - cz) > CHUNK_RADIUS + 1) {
            scene.remove(loadedChunks[key]);
            loadedChunks[key].geometry.dispose();
            delete loadedChunks[key];
        }
    }
}

// Seed initial chunks at spawn
updateChunks(0, 0);

// A flat invisible plane for raycasting (turret aiming)
const groundPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshBasicMaterial({ visible: false })
);
groundPlane.rotation.x = -Math.PI / 2;
scene.add(groundPlane);

// ----------------------------------------------------
// 3. TANK CREATION 
// ----------------------------------------------------
function createTankMesh(colorHex = 0x4a7c3f) {
    const group = new THREE.Group();

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7, metalness: 0.5 });
    const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.8, metalness: 0.15 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.4, metalness: 0.9 });

    // --- Track housings (left + right) ---
    const trackGeo = new THREE.BoxGeometry(0.55, 0.7, 4.0);
    [-1.1, 1.1].forEach(xOff => {
        const t = new THREE.Mesh(trackGeo, darkMat);
        t.position.set(xOff, 0.35, 0);
        t.castShadow = true;
        group.add(t);
    });

    // Road wheels (5 per side)
    const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12);
    for (let i = 0; i < 5; i++) {
        [-1.25, 1.25].forEach(xOff => {
            const w = new THREE.Mesh(wheelGeo, metalMat);
            w.rotation.z = Math.PI / 2;
            w.position.set(xOff, 0.28, -1.5 + i * 0.75);
            group.add(w);
        });
    }

    // --- Hull body ---
    const hullGeo = new THREE.BoxGeometry(2.0, 0.6, 3.6);
    const hull = new THREE.Mesh(hullGeo, bodyMat);
    hull.position.y = 0.85;
    hull.castShadow = true;
    group.add(hull);

    // Front glacis plate (angled)
    const glacisGeo = new THREE.BoxGeometry(2.0, 0.5, 0.6);
    const glacis = new THREE.Mesh(glacisGeo, bodyMat);
    glacis.position.set(0, 0.95, -2.0);
    glacis.rotation.x = 0.35;
    glacis.castShadow = true;
    group.add(glacis);

    // Rear engine deck bump
    const deckGeo = new THREE.BoxGeometry(1.8, 0.15, 1.0);
    const deck = new THREE.Mesh(deckGeo, bodyMat);
    deck.position.set(0, 1.2, 1.3);
    group.add(deck);

    // Engine exhaust pipes (2)
    const pipeGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6);
    [0.35, -0.35].forEach(xOff => {
        const pipe = new THREE.Mesh(pipeGeo, darkMat);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(xOff, 1.35, 2.0);
        group.add(pipe);
    });

    // --- Turret ---
    const turretBaseGeo = new THREE.BoxGeometry(1.6, 0.55, 1.8);
    const turretBase = new THREE.Mesh(turretBaseGeo, bodyMat);
    turretBase.position.set(0, 0, 0);
    turretBase.castShadow = true;

    const turretTopGeo = new THREE.BoxGeometry(1.3, 0.25, 1.5);
    const turretTop = new THREE.Mesh(turretTopGeo, bodyMat);
    turretTop.position.y = 0.4;
    turretBase.add(turretTop);

    // Hatch ring
    const hatchGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.1, 12);
    const hatch = new THREE.Mesh(hatchGeo, metalMat);
    hatch.position.set(-0.32, 0.55, -0.2);
    turretBase.add(hatch);

    // Antenna
    const antennaGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.2, 4);
    const antenna = new THREE.Mesh(antennaGeo, metalMat);
    antenna.position.set(0.52, 1.0, 0.4);
    turretBase.add(antenna);

    // --- Barrel (long + realistic) ---
    const barrelGeo = new THREE.CylinderGeometry(0.1, 0.12, 3.2, 10);
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.1, -2.4);
    barrel.castShadow = true;
    turretBase.add(barrel);

    // Muzzle brake
    const muzzleGeo = new THREE.CylinderGeometry(0.135, 0.1, 0.3, 8);
    const muzzle = new THREE.Mesh(muzzleGeo, barrelMat);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.1, -4.0);
    turretBase.add(muzzle);

    // Turret sits on top of hull
    const turretGroup = new THREE.Group();
    turretGroup.add(turretBase);
    turretGroup.position.set(0, 1.43, -0.15);
    group.add(turretGroup);

    group.userData.turret = turretGroup;

    return group;
}

function spawnBuilding(b) {
    const groundY = terrainHeight(b.x, b.z);
    const height = 12 + Math.random() * 8;
    const geo = new THREE.BoxGeometry(b.width, height, b.depth);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x7a7a80,
        roughness: 0.95,
        metalness: 0.05
    });
    const mesh = new THREE.Mesh(geo, mat);
    // Position so bottom of building sits on terrain surface
    mesh.position.set(b.x, groundY + height / 2, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Window grid (edge geometry overlay)
    const windowMat = new THREE.MeshStandardMaterial({ color: 0xaad4ff, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.7 });
    const winRows = Math.floor(height / 2);
    for (let row = 0; row < winRows; row++) {
        for (let col = -1; col <= 1; col += 2) {
            const wGeo = new THREE.BoxGeometry(0.4, 0.5, 0.05);
            const win = new THREE.Mesh(wGeo, windowMat);
            win.position.set(col * 1.0, -height / 2 + 1.2 + row * 2, b.depth / 2 + 0.01);
            mesh.add(win);
            const win2 = new THREE.Mesh(wGeo, windowMat);
            win2.position.set(col * 1.0, -height / 2 + 1.2 + row * 2, -b.depth / 2 - 0.01);
            win2.rotation.y = Math.PI;
            mesh.add(win2);
        }
    }

    scene.add(mesh);
    buildings.push(b);
}

// Pine tree helper
const treeMeshes = [];
function spawnTree(wx, wz) {
    const h = terrainHeight(wx, wz);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.9 });
    const treeGroup = new THREE.Group();

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.6, 7), trunkMat);
    trunk.position.y = 0.8;
    treeGroup.add(trunk);

    // 3-layer pine cone shape
    [2.4, 1.7, 1.1].forEach((radius, i) => {
        const tier = new THREE.Mesh(new THREE.ConeGeometry(radius, 1.5, 8), leafMat);
        tier.position.y = 1.4 + i * 1.1;
        treeGroup.add(tier);
    });

    treeGroup.position.set(wx, h, wz);
    treeGroup.rotation.y = Math.random() * Math.PI * 2;
    const scale = 0.7 + Math.random() * 0.7;
    treeGroup.scale.setScalar(scale);
    treeGroup.castShadow = true;
    scene.add(treeGroup);
    treeMeshes.push(treeGroup);
}

// Scatter trees around the map
(function seedTrees() {
    const rng = (seed) => { const s = Math.sin(seed) * 43758.5453; return s - Math.floor(s); };
    for (let i = 0; i < 160; i++) {
        const angle = rng(i * 7.13) * Math.PI * 2;
        const dist = 30 + rng(i * 3.77) * 80;
        const wx = Math.cos(angle) * dist;
        const wz = Math.sin(angle) * dist;
        const h = terrainHeight(wx, wz);
        if (h > 0.5 && h < 10) spawnTree(wx, wz); // only on grassy/rocky terrain
    }
})();

// Muzzle flash effect
function spawnMuzzleFlash(worldPos) {
    const geo = new THREE.SphereGeometry(0.6, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 1.0 });
    const flash = new THREE.Mesh(geo, mat);
    flash.position.copy(worldPos);
    scene.add(flash);
    let age = 0;
    const fadeFlash = () => {
        age += 0.08;
        flash.material.opacity = Math.max(0, 1 - age * 3);
        flash.scale.setScalar(1 + age * 4);
        if (age < 0.5) requestAnimationFrame(fadeFlash);
        else scene.remove(flash);
    };
    requestAnimationFrame(fadeFlash);
}

// Explosion ring on hit
function spawnExplosion(worldPos) {
    const colors = [0xff4500, 0xff8c00, 0xffd700];
    colors.forEach((col, i) => {
        const ring = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 8, 8),
            new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9 })
        );
        ring.position.copy(worldPos);
        ring.position.y += 0.5;
        scene.add(ring);
        let a = 0;
        const anim = () => {
            a += 0.06;
            ring.scale.setScalar(1 + a * (3 + i));
            ring.material.opacity = Math.max(0, 0.9 - a * 1.5);
            if (a < 0.7) requestAnimationFrame(anim);
            else scene.remove(ring);
        };
        setTimeout(() => requestAnimationFrame(anim), i * 60);
    });
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
                const barrelTip = new THREE.Vector3(0, 0.1, -4.3);
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
                const barrelTip = new THREE.Vector3(0, 0.1, -4.3);
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
            // Visual muzzle flash at barrel tip
            spawnMuzzleFlash(new THREE.Vector3(spawnX, 2.2, spawnZ));
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

// Snap a tank group to the current terrain height and tilt it with the slope.
// yaw must be passed explicitly — do NOT read tankGroup.rotation.y after quaternion is set.
function snapToTerrain(tankGroup, yaw) {
    const x = tankGroup.position.x;
    const z = tankGroup.position.z;

    // Sample height at tank centre and two offset points to compute surface normal
    const s = 1.5; // sample offset in world units
    const h0 = terrainHeight(x, z);
    const hpx = terrainHeight(x + s, z);
    const hpz = terrainHeight(x, z + s);

    // Tank sits slightly above the raw terrain so tracks don't clip
    tankGroup.position.y = h0 + 0.3;

    // Compute surface normal via cross product of slope vectors
    const vX = new THREE.Vector3(s, hpx - h0, 0);
    const vZ = new THREE.Vector3(0, hpz - h0, s);
    const normal = new THREE.Vector3().crossVectors(vZ, vX).normalize();

    // Align the tank's +Y with the surface normal
    const up = new THREE.Vector3(0, 1, 0);
    const alignQ = new THREE.Quaternion().setFromUnitVectors(up, normal);

    // Apply yaw on top (using the explicitly-passed yaw, not rotation.y)
    const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    tankGroup.quaternion.multiplyQuaternions(alignQ, yawQ);
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

        // Local World boundary enforcement
        const WORLD_LIMIT = 45;
        if (myTank.position.x > WORLD_LIMIT) { myTank.position.x = WORLD_LIMIT; moved = true; }
        if (myTank.position.x < -WORLD_LIMIT) { myTank.position.x = -WORLD_LIMIT; moved = true; }
        if (myTank.position.z > WORLD_LIMIT) { myTank.position.z = WORLD_LIMIT; moved = true; }
        if (myTank.position.z < -WORLD_LIMIT) { myTank.position.z = -WORLD_LIMIT; moved = true; }

        if (keys['a'] || keys['arrowleft']) {
            myTankYaw += rotateSpeed;
            moved = true;
        }
        if (keys['d'] || keys['arrowright']) {
            myTankYaw -= rotateSpeed;
            moved = true;
        }

        // First-Person Camera behavior
        // Camera stays fixed to the tank hull (body) looking forward
        const cameraPos = cameraOffset.clone().applyMatrix4(myTank.matrixWorld);
        camera.position.copy(cameraPos);
        const lookTarget = new THREE.Vector3(0, 2.4, -100).applyMatrix4(myTank.matrixWorld);
        camera.lookAt(lookTarget);

        // ---- Terrain following: snap Y and tilt to slope ----
        snapToTerrain(myTank, myTankYaw);

        // Turret Aiming
        if (myTank.userData.turret) {
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(groundPlane);
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
                ry: myTankYaw
            }));
            timeSinceLastSend = 0;
        }
    }

    // Interpolate other players to their target network position
    for (const id in otherTanks) {
        const tank = otherTanks[id];
        if (tank.userData.targetPosition) {
            tank.position.lerp(tank.userData.targetPosition, 0.3);
            // Lerp yaw stored explicitly in userData to avoid quaternion feedback
            if (tank.userData.yaw === undefined) tank.userData.yaw = tank.userData.targetRotationY;
            const diff = tank.userData.targetRotationY - tank.userData.yaw;
            const shortDiff = Math.atan2(Math.sin(diff), Math.cos(diff));
            tank.userData.yaw += shortDiff * 0.3;
            // Snap other tanks to terrain height too
            snapToTerrain(tank, tank.userData.yaw);
        }
    }

    // Move projectiles
    for (const [pId, mesh] of Object.entries(activeProjectiles)) {
        mesh.position.x += mesh.userData.vx * dt;
        mesh.position.z += mesh.userData.vz * dt;
    }

    // Update infinite terrain chunks around the player
    if (myTank) {
        updateChunks(myTank.position.x, myTank.position.z);
    }

    // Draw minimap
    drawMinimap();

    renderer.render(scene, camera);
}

// ----------------------------------------------------
// MINIMAP DRAW
// ----------------------------------------------------
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
const MINIMAP_SCALE = 1.2;  // world units per minimap pixel (lower = more zoomed in)
const MINIMAP_RANGE = 90;   // world unit radius shown on map

function drawMinimap() {
    if (!minimapCtx || !myTank) return;
    const W = minimapCanvas.width;
    const H = minimapCanvas.height;
    const cx = W / 2;
    const cy = H / 2;

    // Clear
    minimapCtx.clearRect(0, 0, W, H);

    // Circular clip
    minimapCtx.save();
    minimapCtx.beginPath();
    minimapCtx.arc(cx, cy, W / 2, 0, Math.PI * 2);
    minimapCtx.clip();

    // Background
    minimapCtx.fillStyle = 'rgba(10, 40, 10, 0.8)';
    minimapCtx.fillRect(0, 0, W, H);

    // Draw arena centre marker
    const arenaX = cx + (-myTank.position.x) / MINIMAP_SCALE * (W / MINIMAP_RANGE / 2);
    const arenaZ = cy + (-myTank.position.z) / MINIMAP_SCALE * (H / MINIMAP_RANGE / 2);
    minimapCtx.beginPath();
    minimapCtx.arc(arenaX, arenaZ, 3, 0, Math.PI * 2);
    minimapCtx.fillStyle = 'rgba(255,255,255,0.15)';
    minimapCtx.fill();

    const toMapX = (wx) => cx + (wx - myTank.position.x) / MINIMAP_RANGE * W;
    const toMapZ = (wz) => cy + (wz - myTank.position.z) / MINIMAP_RANGE * H;

    // Other players
    for (const [id, state] of Object.entries(gameState.players)) {
        if (id === gameState.myId) continue;
        if (state.dead) continue;
        const mx = toMapX(state.x);
        const mz = toMapZ(state.z);
        // teammates are my team color, enemies are opposite
        const isTeammate = state.team === gameState.team;
        minimapCtx.beginPath();
        minimapCtx.arc(mx, mz, 5, 0, Math.PI * 2);
        minimapCtx.fillStyle = isTeammate
            ? (gameState.team === 'red' ? '#ff6b6b' : '#54a0ff')
            : (gameState.team === 'red' ? '#54a0ff' : '#ff6b6b');
        minimapCtx.fill();
        minimapCtx.strokeStyle = '#fff';
        minimapCtx.lineWidth = 1;
        minimapCtx.stroke();
    }

    // My tank as a triangle pointing forward
    minimapCtx.save();
    minimapCtx.translate(cx, cy);
    minimapCtx.rotate(-myTank.rotation.y);
    minimapCtx.beginPath();
    minimapCtx.moveTo(0, -9);
    minimapCtx.lineTo(6, 7);
    minimapCtx.lineTo(-6, 7);
    minimapCtx.closePath();
    minimapCtx.fillStyle = '#ffffff';
    minimapCtx.fill();
    minimapCtx.restore();

    minimapCtx.restore(); // End clip
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

                    // Hide local tank meshes to prevent camera clipping in first-person
                    myTank.traverse((child) => {
                        if (child.isMesh) {
                            child.visible = false;
                        }
                    });

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
                    // Cache all positions for minimap rendering
                    gameState.players[id] = state;
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
            myTank.traverse((child) => { if (child.isMesh) child.visible = false; });
            scene.add(myTank);
        }
    }
}
