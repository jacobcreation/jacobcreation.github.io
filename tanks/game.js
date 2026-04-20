import * as THREE from 'three';
import PartySocket from 'partysocket';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

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
    spells: { dash: 0, shield: 0, blast: 0, teleport: 0 },
    dashEndTime: 0
};

// Controls
const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
    space: false
};
const touchControls = {
    drive: { active: false, pointerId: null, x: 0, y: 0 },
    fire: false
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
let crates = [];
let myTankYaw = 0; // Track yaw separately to avoid quaternion/Euler feedback loop
let mobileAimInitialized = false;

// Physics / Camera Smoothing
let tankVelocity = 0;
const ACCEL = 40;
const DECEL = 25;
const MAX_SPEED = 18;
const MAX_DASH_SPEED = 45;

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
const bgColor = 0xb4d6f1; // Sky blue
scene.background = new THREE.Color(bgColor); 
scene.fog = new THREE.Fog(bgColor, 50, 250);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// cameraOffset is now for third-person follow
const cameraOffset = new THREE.Vector3(0, 5, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// Post-Processing (Bloom)
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.35;
bloomPass.strength = 0.4;
bloomPass.radius = 0.4;

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// Raycaster for aiming
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const driveStick = document.getElementById('drive-stick');
const driveStickKnob = document.getElementById('drive-stick-knob');
const fireBtn = document.getElementById('fire-btn');
const dashBtn = document.getElementById('dash-btn');
const shieldBtn = document.getElementById('shield-btn');
const blastBtn = document.getElementById('blast-btn');

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // Slightly dimmer ambient
scene.add(ambientLight);

const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5); 
scene.add(hemisphereLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0); // Balanced sun intensity
dirLight.position.set(100, 200, 50);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 4096;
dirLight.shadow.mapSize.height = 4096;
dirLight.shadow.camera.left = -150;
dirLight.shadow.camera.right = 150;
dirLight.shadow.camera.top = 150;
dirLight.shadow.camera.bottom = -150;
dirLight.shadow.bias = -0.0001;
scene.add(dirLight);

// Accent lights (subtle cyan highlight)
const accentLight = new THREE.PointLight(0x00ffff, 0.3, 150);
accentLight.position.set(0, 30, 0);
scene.add(accentLight);

// Chunk material
const groundMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.8,
    metalness: 0.1,
    flatShading: false
});

// Helper for ground grid overlay
const gridTexture = new THREE.CanvasTexture((() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 64, 64);
    return canvas;
})());
gridTexture.wrapS = THREE.RepeatWrapping;
gridTexture.wrapT = THREE.RepeatWrapping;
gridTexture.repeat.set(CHUNK_SIZE / 4, CHUNK_SIZE / 4);

// Starfield Background - Disabled for daytime
/*
function createStarfield() {
    const starGeo = new THREE.BufferGeometry();
...
createStarfield();
*/

function terrainColor(height) {
    // Natural daytime palette
    if (height < 0.5) return new THREE.Color(0xd2b48c); // Sand
    if (height < 4) return new THREE.Color(0x91a06d);   // Light Green
    if (height < 10) return new THREE.Color(0x6b8e23);  // Grass Green
    if (height < 16) return new THREE.Color(0x8b8b83);  // Rock
    return new THREE.Color(0xffffff);                   // Snow Peak
}

function buildChunk(cx, cz) {
    const key = `${cx}_${cz}`;
    if (loadedChunks[key]) return;

    const chunkGroup = new THREE.Group();
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
    mesh.receiveShadow = true;
    chunkGroup.add(mesh);
    
    // Add grid overlay
    const gridGeo = geo.clone();
    const gridMat = new THREE.MeshBasicMaterial({
        map: gridTexture,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending
    });
    const gridMesh = new THREE.Mesh(gridGeo, gridMat);
    gridMesh.position.z = 0.05;
    mesh.add(gridMesh);

    // Deterministic building spawning (15% chance per chunk, skip center)
    if ((Math.abs(cx) > 1 || Math.abs(cz) > 1) && noise(cx, cz, 1234) > 0.85) {
        const bx = (noise(cx, cz, 567) - 0.5) * (CHUNK_SIZE * 0.6);
        const bz = (noise(cx, cz, 890) - 0.5) * (CHUNK_SIZE * 0.6);
        const bWidth = 8 + noise(cx, cz, 111) * 10;
        const bDepth = 8 + noise(cx, cz, 222) * 10;
        
        // Spawn building and add to local group
        const buildingData = { x: cx * CHUNK_SIZE + bx, z: cz * CHUNK_SIZE + bz, width: bWidth, depth: bDepth };
        const bMesh = createBuildingMesh(buildingData);
        chunkGroup.add(bMesh);
        buildings.push(buildingData); // Still keep in list for collision
    }

    chunkGroup.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    scene.add(chunkGroup);
    loadedChunks[key] = chunkGroup;
}

// Separate mesh creation from scene adding to support chunking
function createBuildingMesh(b) {
    const groundY = terrainHeight(b.x, b.z);
    const height = 15 + Math.random() * 15;
    const geo = new THREE.BoxGeometry(b.width, height, b.depth);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x888899,
        roughness: 0.7,
        metalness: 0.3
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(b.x - (Math.round(b.x / CHUNK_SIZE) * CHUNK_SIZE), groundY + height / 2, b.z - (Math.round(b.z / CHUNK_SIZE) * CHUNK_SIZE));
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Windows
    const windowMat = new THREE.MeshStandardMaterial({ color: 0xccedff, emissive: 0x4488ff, emissiveIntensity: 0.5 });
    for (let row = 0; row < Math.floor(height/4); row++) {
        for (let col = -1; col <= 1; col += 2) {
            const wGeo = new THREE.BoxGeometry(1.5, 2, 0.1);
            const win = new THREE.Mesh(wGeo, windowMat);
            win.position.set(col * (b.width/3), -height/2 + 4 + row*5, b.depth/2 + 0.1);
            mesh.add(win);
        }
    }
    return mesh;
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
            const mesh = loadedChunks[key];
            scene.remove(mesh);
            
            // Recursively dispose children (grid overlay)
            mesh.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
            
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

// Particle System for Explosions
class ParticleSystem {
    constructor(count = 200) {
        this.count = count;
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(count * 3);
        this.velocities = new Float32Array(count * 3);
        this.lifetimes = new Float32Array(count);
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.material = new THREE.PointsMaterial({ 
            color: 0xffffff, 
            size: 0.25, 
            transparent: true, 
            opacity: 1.0, 
            blending: THREE.AdditiveBlending 
        });
        this.points = new THREE.Points(this.geometry, this.material);
        scene.add(this.points);
        this.active = false;
    }
    explode(position, color = 0xff4500) {
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;
            this.positions[i3] = position.x;
            this.positions[i3 + 1] = position.y;
            this.positions[i3 + 2] = position.z;
            
            const speed = 0.1 + Math.random() * 0.5;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            this.velocities[i3] = speed * Math.sin(phi) * Math.cos(theta);
            this.velocities[i3 + 1] = speed * Math.cos(phi);
            this.velocities[i3 + 2] = speed * Math.sin(phi) * Math.sin(theta);
            
            this.lifetimes[i] = 0.5 + Math.random() * 1.0;
        }
        this.material.color.setHex(color);
        this.active = true;
        this.material.opacity = 1.0;
    }
    update(delta) {
        if (!this.active) return;
        let allDead = true;
        for (let i = 0; i < this.count; i++) {
            if (this.lifetimes[i] > 0) {
                allDead = false;
                const i3 = i * 3;
                this.positions[i3] += this.velocities[i3] * delta * 60;
                this.positions[i3 + 1] += this.velocities[i3 + 1] * delta * 60;
                this.positions[i3 + 2] += this.velocities[i3 + 2] * delta * 60;
                this.lifetimes[i] -= delta;
                
                // Gravity-ish pull
                this.velocities[i3 + 1] -= 0.005 * delta * 60;
            }
        }
        this.geometry.attributes.position.needsUpdate = true;
        this.material.opacity = Math.max(0, this.material.opacity - delta * 0.8);
        if (allDead) this.active = false;
    }
}
const particleSystem = new ParticleSystem();

// Sound Manager
class SoundManager {
    constructor() {
        this.audioContext = null;
    }
    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }
    playExplosion() {
        this.init();
        if (this.audioContext.state === 'suspended') this.audioContext.resume();
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.5);
    }
    playShoot() {
        this.init();
        if (this.audioContext.state === 'suspended') this.audioContext.resume();
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }
    playTeleport() {
        this.init();
        if (this.audioContext.state === 'suspended') this.audioContext.resume();
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(2000, this.audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.2);
    }
}
const soundManager = new SoundManager();

function setMobileAimCenter() {
    mouse.x = 0;
    mouse.y = 0;
    mobileAimInitialized = true;
}

function updateStickKnob(knob, x, y) {
    if (!knob) return;
    const maxOffset = 32;
    knob.style.transform = `translate(calc(-50% + ${x * maxOffset}px), calc(-50% + ${y * maxOffset}px))`;
}

function bindDriveStick() {
    if (!driveStick || !driveStickKnob) return;
    const base = driveStick.querySelector('.touch-stick-base');
    const state = touchControls.drive;

    function setFromPoint(clientX, clientY) {
        const rect = base.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const radius = rect.width * 0.34;
        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const distance = Math.hypot(dx, dy);
        if (distance > radius) {
            const scale = radius / distance;
            dx *= scale;
            dy *= scale;
        }
        state.x = dx / radius;
        state.y = dy / radius;
        updateStickKnob(driveStickKnob, state.x, state.y);
    }

    function reset() {
        state.active = false;
        state.pointerId = null;
        state.x = 0;
        state.y = 0;
        updateStickKnob(driveStickKnob, 0, 0);
    }

    base.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        state.active = true;
        state.pointerId = event.pointerId;
        base.setPointerCapture(event.pointerId);
        setFromPoint(event.clientX, event.clientY);
    });
    base.addEventListener('pointermove', (event) => {
        if (!state.active || event.pointerId !== state.pointerId) return;
        event.preventDefault();
        setFromPoint(event.clientX, event.clientY);
    });
    base.addEventListener('pointerup', (event) => {
        if (event.pointerId === state.pointerId) reset();
    });
    base.addEventListener('pointercancel', (event) => {
        if (event.pointerId === state.pointerId) reset();
    });
}

function bindTouchActionButton(button, onPress, onRelease = null) {
    if (!button) return;
    const release = () => {
        button.classList.remove('is-active');
        onRelease?.();
    };
    button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.classList.add('is-active');
        button.setPointerCapture(event.pointerId);
        onPress();
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
}

function triggerShoot() {
    if (myTank && partySocket && partySocket.readyState === 1) {
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
        spawnMuzzleFlash(new THREE.Vector3(spawnX, 2.2, spawnZ));
        soundManager.playShoot();
    }
}

// ----------------------------------------------------
// 3. TANK CREATION 
// ----------------------------------------------------
function createTankMesh(colorHex = 0x4a7c3f) {
    const group = new THREE.Group();

    const metalMat = new THREE.MeshStandardMaterial({ 
        color: 0x333333, 
        roughness: 0.2, 
        metalness: 0.9,
        envMapIntensity: 1.0 
    });
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: 0x111111, 
        roughness: 0.3, 
        metalness: 0.8 
    });
    const neonMat = new THREE.MeshStandardMaterial({ 
        color: colorHex, 
        emissive: colorHex, 
        emissiveIntensity: 4.0 
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.6, metalness: 0.5 });
    const barrelMat = new THREE.MeshStandardMaterial({ 
        color: 0x222222, 
        roughness: 0.1, 
        metalness: 1.0 
    });

    // --- Track housings ---
    const trackGeo = new THREE.BoxGeometry(0.55, 0.7, 4.0);
    [-1.1, 1.1].forEach(xOff => {
        const t = new THREE.Mesh(trackGeo, darkMat);
        t.position.set(xOff, 0.35, 0);
        t.castShadow = true;
        group.add(t);

        // Neon side strip
        const stripGeo = new THREE.BoxGeometry(0.05, 0.1, 3.8);
        const strip = new THREE.Mesh(stripGeo, neonMat);
        strip.position.set(xOff > 0 ? 0.28 : -0.28, 0.4, 0);
        t.add(strip);
    });

    // --- Hull body ---
    const hullGeo = new THREE.BoxGeometry(2.0, 0.6, 3.6);
    const hull = new THREE.Mesh(hullGeo, bodyMat);
    hull.position.y = 0.85;
    hull.castShadow = true;
    group.add(hull);

    // Front neon "headlights"
    const lightGeo = new THREE.BoxGeometry(0.4, 0.1, 0.1);
    [-0.7, 0.7].forEach(x => {
        const light = new THREE.Mesh(lightGeo, neonMat);
        light.position.set(x, 0.95, -1.85);
        group.add(light);
    });

    // --- Turret ---
    const turretBaseGeo = new THREE.BoxGeometry(1.6, 0.55, 1.8);
    const turretBase = new THREE.Mesh(turretBaseGeo, bodyMat);
    turretBase.position.set(0, 0, 0);
    turretBase.castShadow = true;

    // Turret neon ring
    const ringGeo = new THREE.BoxGeometry(1.62, 0.05, 1.82);
    const ring = new THREE.Mesh(ringGeo, neonMat);
    ring.position.y = 0.1;
    turretBase.add(ring);

    // --- Barrel ---
    const barrelGeo = new THREE.CylinderGeometry(0.1, 0.12, 3.2, 12);
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.1, -2.4);
    barrel.castShadow = true;
    turretBase.add(barrel);

    // Muzzle brake with neon tip
    const muzzleGeo = new THREE.CylinderGeometry(0.14, 0.12, 0.4, 12);
    const muzzle = new THREE.Mesh(muzzleGeo, barrelMat);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.1, -4.0);
    turretBase.add(muzzle);

    const tipGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 12);
    const tip = new THREE.Mesh(tipGeo, neonMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, 0.1, -4.2);
    turretBase.add(tip);

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

// Crate helper
function spawnCrate(wx, wz) {
    const h = terrainHeight(wx, wz);
    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 });
    const crate = new THREE.Mesh(geo, mat);
    crate.position.set(wx, h + 1, wz);
    crate.castShadow = true;
    crate.receiveShadow = true;
    scene.add(crate);
    crates.push(crate);
}

// Scatter crates
(function seedCrates() {
    const positions = [
        [10, 10], [-10, -10], [20, -5], [-15, 15], [0, 25], [25, 0]
    ];
    for (const [x, z] of positions) {
        spawnCrate(x, z);
    }
})();

// Muzzle flash effect
function spawnMuzzleFlash(worldPos) {
    const geo = new THREE.SphereGeometry(0.8, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 1.0 });
    const flash = new THREE.Mesh(geo, mat);
    flash.position.copy(worldPos);
    scene.add(flash);

    const light = new THREE.PointLight(0x00ffff, 5, 15);
    light.position.copy(worldPos);
    scene.add(light);

    let age = 0;
    const fadeFlash = () => {
        age += 0.15;
        flash.material.opacity = Math.max(0, 1 - age * 4);
        flash.scale.setScalar(1 + age * 6);
        light.intensity = Math.max(0, 5 * (1 - age * 4));
        if (age < 0.5) {
            requestAnimationFrame(fadeFlash);
        } else {
            scene.remove(flash);
            scene.remove(light);
            flash.geometry.dispose();
            flash.material.dispose();
        }
    };
    requestAnimationFrame(fadeFlash);
}

// Explosion ring on hit
function spawnExplosion(worldPos) {
    particleSystem.explode(worldPos);
    soundManager.playExplosion();
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
    const teleportBtn = document.getElementById('buy-teleport');
    if (dashBtn) dashBtn.innerText = `Dash x${gameState.spells.dash} (50 Coins) [Q]`;
    if (shieldBtn) shieldBtn.innerText = `Shield x${gameState.spells.shield} (100 Coins) [E]`;
    if (blastBtn) blastBtn.innerText = `Big Blast x${gameState.spells.blast} (150 Coins) [F]`;
    if (teleportBtn) teleportBtn.innerText = `Teleport x${gameState.spells.teleport} (200 Coins) [R]`;
}

function updateLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    const players = Object.values(gameState.players).filter(p => !p.dead);
    players.sort((a, b) => b.kills - a.kills);
    list.innerHTML = players.slice(0, 5).map(p => `<div class="leaderboard-item"><span>${p.name || 'Player'}</span><span>${p.kills || 0}</span></div>`).join('');
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
        if (spellId === 'teleport' && myTank) {
            // Use yaw for XZ direction to avoid tilting issues from terrain snapping
            const dx = Math.sin(myTankYaw + Math.PI);
            const dz = Math.cos(myTankYaw + Math.PI);
            
            let targetX = myTank.position.x + dx * 25;
            let targetZ = myTank.position.z + dz * 25;
            
            extraParams = { x: targetX, z: targetZ };
            soundManager.playTeleport();
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
        if (k === 'r') castSpell('teleport');
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
        composer.setSize(window.innerWidth, window.innerHeight);
        setMobileAimCenter();
    });

    const closeShop = document.getElementById('close-shop');
    if (closeShop) closeShop.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        toggleShop();
    });

    const buyDash = document.getElementById('buy-dash');
    const buyShield = document.getElementById('buy-shield');
    const buyBlast = document.getElementById('buy-blast');
    const buyTeleport = document.getElementById('buy-teleport');
    if (buyDash) buyDash.addEventListener('pointerdown', (e) => { e.preventDefault(); buySpell('dash'); });
    if (buyShield) buyShield.addEventListener('pointerdown', (e) => { e.preventDefault(); buySpell('shield'); });
    if (buyBlast) buyBlast.addEventListener('pointerdown', (e) => { e.preventDefault(); buySpell('blast'); });
    if (buyTeleport) buyTeleport.addEventListener('pointerdown', (e) => { e.preventDefault(); buySpell('teleport'); });

    window.addEventListener('mousemove', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('mousedown', (e) => {
        if (e.button === 0) triggerShoot();
    });

    const respawnBtn = document.getElementById('respawn-btn');
    if (respawnBtn) respawnBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        console.log("Respawn button pressed");
        if (partySocket && partySocket.readyState === 1) {
            partySocket.send(JSON.stringify({ type: 'respawn' }));
            // Forced local hide for immediate feedback
            hideDeathScreen();
        }
    });

    const quitBtn = document.getElementById('quit-btn');
    if (quitBtn) quitBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        window.location.href = "../index.html";
    });

    bindDriveStick();
    bindTouchActionButton(fireBtn, () => {
        touchControls.fire = true;
        setMobileAimCenter();
        triggerShoot();
    }, () => {
        touchControls.fire = false;
    });
    bindTouchActionButton(dashBtn, () => castSpell('dash'));
    bindTouchActionButton(shieldBtn, () => castSpell('shield'));
    bindTouchActionButton(blastBtn, () => castSpell('blast'));
    
    const buyTeleportBtn = document.getElementById('buy-teleport');
    if (buyTeleportBtn) buyTeleportBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        buySpell('teleport');
    });
    setMobileAimCenter();

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
    const color = proj.isBlast ? 0xfeca57 : (proj.team === 'red' ? 0xff4757 : 0x54a0ff);
    const mat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 3.0
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(proj.x, proj.y, proj.z);

    // Trail
    const trailGeo = new THREE.BoxGeometry(size * 0.8, size * 0.8, 3.0);
    const trailMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.4
    });
    const trail = new THREE.Mesh(trailGeo, trailMat);
    trail.position.z = 1.5;
    mesh.add(trail);
    mesh.rotation.y = proj.ry;

    // Attach velocity metadata
    mesh.userData = {
        vx: Math.sin(proj.ry) * (proj.isBlast ? 8 : 10),
        vz: Math.cos(proj.ry) * (proj.isBlast ? 8 : 10),
        team: proj.team
    };

    scene.add(mesh);
    activeProjectiles[id] = mesh;
}

// Snap a tank group to the current terrain height and tilt it with the slope.
function snapToTerrain(tankGroup, yaw) {
    const x = tankGroup.position.x;
    const z = tankGroup.position.z;

    // Multi-point sampling for stability on hills
    // Note: Mesh forward is -Z
    const dirX = Math.sin(yaw);
    const dirZ = Math.cos(yaw);
    
    const sideX = Math.cos(yaw);
    const sideZ = -Math.sin(yaw);
    
    const length = 1.8; // half-length
    const width = 1.0;  // half-width

    // Front is at -Z (local), Back is at +Z (local)
    const pF = { x: x - dirX * length, z: z - dirZ * length };
    const pB = { x: x + dirX * length, z: z + dirZ * length };
    const pR = { x: x + sideX * width, z: z + sideZ * width };
    const pL = { x: x - sideX * width, z: z - sideZ * width };

    const hF = terrainHeight(pF.x, pF.z);
    const hB = terrainHeight(pB.x, pB.z);
    const hR = terrainHeight(pR.x, pR.z);
    const hL = terrainHeight(pL.x, pL.z);
    const hC = terrainHeight(x, z);

    // Bias height to keep tracks above ground
    const targetH = Math.max(hC, (hF + hB + hL + hR) / 4);
    tankGroup.position.y = targetH + 0.5;

    // Vector Forward (Back to Front)
    const vForward = new THREE.Vector3(pF.x - pB.x, hF - hB, pF.z - pB.z).normalize();
    // Vector Right (Left to Right)
    const vRight = new THREE.Vector3(pR.x - pL.x, hR - hL, pR.z - pL.z).normalize();
    
    // Normal = Right x Forward (gives Up)
    const normal = new THREE.Vector3().crossVectors(vRight, vForward).normalize();

    const up = new THREE.Vector3(0, 1, 0);
    const alignQ = new THREE.Quaternion().setFromUnitVectors(up, normal);
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
        const rotateSpeed = 2.5 * dt;
        const mobileForward = touchControls.drive.y < -0.12;
        const mobileBackward = touchControls.drive.y > 0.12;
        const mobileLeft = touchControls.drive.x < -0.12;
        const mobileRight = touchControls.drive.x > 0.12;

        let targetVel = 0;
        if (keys['w'] || keys['arrowup'] || mobileForward) targetVel = isDashing ? MAX_DASH_SPEED : MAX_SPEED;
        else if (keys['s'] || keys['arrowdown'] || mobileBackward) targetVel = -MAX_SPEED;

        if (tankVelocity < targetVel) {
            tankVelocity = Math.min(targetVel, tankVelocity + ACCEL * dt);
        } else if (tankVelocity > targetVel) {
            tankVelocity = Math.max(targetVel, tankVelocity - DECEL * dt);
        }

        let moved = Math.abs(tankVelocity) > 0.1;
        const oldPos = myTank.position.clone();

        if (moved) {
            myTank.translateZ(-tankVelocity * dt);
        }

        // Build collision prediction
        if (moved) {
            let hitBuilding = false;
            const radius = 1.8;
            for (const b of buildings) {
                if (myTank.position.x > b.x - b.width / 2 - radius && myTank.position.x < b.x + b.width / 2 + radius &&
                    myTank.position.z > b.z - b.depth / 2 - radius && myTank.position.z < b.z + b.depth / 2 + radius) {
                    hitBuilding = true;
                    break;
                }
            }
            if (hitBuilding) {
                myTank.position.copy(oldPos);
                tankVelocity *= -0.5; // bounce back slightly
            }
        }

        if (keys['a'] || keys['arrowleft'] || mobileLeft) {
            myTankYaw += rotateSpeed;
            moved = true;
        }
        if (keys['d'] || keys['arrowright'] || mobileRight) {
            myTankYaw -= rotateSpeed;
            moved = true;
        }

        // Smooth Third-Person Camera follow
        const targetCamPos = cameraOffset.clone().applyMatrix4(myTank.matrixWorld);
        camera.position.lerp(targetCamPos, 0.1);
        const lookTarget = new THREE.Vector3(0, 2.0, -10).applyMatrix4(myTank.matrixWorld);
        camera.lookAt(lookTarget);

        // ---- Terrain following: snap Y and tilt to slope ----
        snapToTerrain(myTank, myTankYaw);

        // Turret Aiming (Smoother)
        if (myTank.userData.turret) {
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(groundPlane);
            if (intersects.length > 0) {
                const target = intersects[0].point;
                const dx = target.x - myTank.position.x;
                const dz = target.z - myTank.position.z;
                const globalAngle = Math.atan2(dx, dz) + Math.PI;
                const targetRot = globalAngle - myTank.rotation.y;
                
                // Lerp turret rotation for smoothness
                const currentRot = myTank.userData.turret.rotation.y;
                const diff = targetRot - currentRot;
                const shortDiff = Math.atan2(Math.sin(diff), Math.cos(diff));
                myTank.userData.turret.rotation.y += shortDiff * 0.15;
            }
        }

        // Send network update
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
            if (tank.userData.yaw === undefined) tank.userData.yaw = tank.userData.targetRotationY;
            const diff = tank.userData.targetRotationY - tank.userData.yaw;
            const shortDiff = Math.atan2(Math.sin(diff), Math.cos(diff));
            tank.userData.yaw += shortDiff * 0.3;
            snapToTerrain(tank, tank.userData.yaw);
        }
    }

    // Move projectiles
    for (const [pId, mesh] of Object.entries(activeProjectiles)) {
        mesh.position.x += mesh.userData.vx * dt;
        mesh.position.z += mesh.userData.vz * dt;
        
        // Update projectile height to follow terrain
        const h = terrainHeight(mesh.position.x, mesh.position.z);
        mesh.position.y = h + 1.2;

        // Check collision with crates (XZ only for reliability on hills)
        for (let i = crates.length - 1; i >= 0; i--) {
            const crate = crates[i];
            const dx = mesh.position.x - crate.position.x;
            const dz = mesh.position.z - crate.position.z;
            const distXZ = Math.sqrt(dx * dx + dz * dz);
            
            if (distXZ < 1.8) {
                scene.remove(crate);
                crates.splice(i, 1);
                spawnExplosion(mesh.position);
                scene.remove(mesh);
                delete activeProjectiles[pId];
                break;
            }
        }

        // Check collision with buildings
        if (activeProjectiles[pId]) {
            for (const b of buildings) {
                const radius = 0.5;
                if (mesh.position.x > b.x - b.width / 2 - radius && mesh.position.x < b.x + b.width / 2 + radius &&
                    mesh.position.z > b.z - b.depth / 2 - radius && mesh.position.z < b.z + b.depth / 2 + radius) {
                    spawnExplosion(mesh.position);
                    scene.remove(mesh);
                    delete activeProjectiles[pId];
                    break;
                }
            }
        }
    }

    if (myTank) {
        updateChunks(myTank.position.x, myTank.position.z);
    }

    drawMinimap();
    particleSystem.update(dt);
    
    // Use composer for bloom rendering
    composer.render();
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
    minimapCtx.rotate(myTankYaw);
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
    // Default to production server for ease of use
    const host = "tanks-backend.jacobcreation.partykit.dev";

    // Set a timeout to show a "Connection taking long" message
    const connectionTimeout = setTimeout(() => {
        const loaderText = document.querySelector('#loading-overlay p');
        if (loaderText && !gameState.myId) {
            loaderText.innerText = "SERVER IS SLEEPING, WAKING IT UP...";
            loaderText.style.color = "#feca57";
        }
    }, 5000);

    try {
        partySocket = new PartySocket({
            host: host,
            room: "global-arena"
        });

        partySocket.addEventListener("message", (e) => {
            const data = JSON.parse(e.data);

            if (data.type === "init") {
                clearTimeout(connectionTimeout);
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
                    const myInitialState = data.state[data.id];
                    myTank = createTankMesh(data.myColor);
                    myTank.position.set(myInitialState.x, 0, myInitialState.z);
                    myTank.rotation.y = myInitialState.ry;

                    // Ensure local tank is visible (third-person)
                    myTank.traverse((child) => {
                        if (child.isMesh) {
                            child.visible = true;
                        }
                    });

                    scene.add(myTank);

                    // Sync initial dead state
                    if (myInitialState.dead) {
                        gameState.dead = true;
                        showDeathScreen();
                        myTank.visible = false;
                    } else {
                        gameState.dead = false;
                        hideDeathScreen();
                        myTank.visible = true;
                    }

                    // Hide loading overlay
                    const loader = document.getElementById('loading-overlay');
                    if (loader) {
                        loader.classList.add('fade-out');
                        setTimeout(() => loader.style.display = 'none', 1000);
                    }

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
                    
                    // Update health and coins
                    if (myState.health < gameState.health) {
                        const hb = document.getElementById('health-bar');
                        if (hb) hb.style.background = 'linear-gradient(90deg, #ff6b6b, #ee5253)';
                        setTimeout(() => {
                            if (hb) hb.style.background = 'linear-gradient(90deg, #1dd1a1, #10ac84)';
                        }, 500);
                    }

                    // Reset position on full health if previously dead or health was 0
                    if (myState.health === 100 && gameState.health <= 0 && myTank) {
                        myTank.position.set(myState.x, 0, myState.z);
                    }

                    gameState.health = myState.health;
                    gameState.coins = myState.coins;

                    if (data.teamScores) {
                        gameState.teamScores = data.teamScores;
                        updateScoreboard();
                    }

                    // Handle Death/Respawn sync
                    if (myState.dead !== gameState.dead) {
                        gameState.dead = myState.dead;
                        if (gameState.dead) {
                            showDeathScreen();
                            if (myTank) myTank.visible = false;
                        } else {
                            hideDeathScreen();
                            if (myTank) {
                                myTank.position.set(myState.x, 0, myState.z);
                                myTank.visible = true;
                                // Reset velocity to prevent sliding after respawn
                                tankVelocity = 0;
                            }
                        }
                    }

                    if (myState.spells) {
                        gameState.spells = {
                            dash: myState.spells.dash || 0,
                            shield: myState.spells.shield || 0,
                            blast: myState.spells.blast || 0,
                            teleport: myState.spells.teleport || 0
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
                updateLeaderboard();

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
