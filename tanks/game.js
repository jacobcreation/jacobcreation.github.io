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
const TANK_HALF_LENGTH = 2.15;
const TANK_HALF_WIDTH = 1.32;
const TANK_CLEARANCE = 0.62;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const CAMERA_POSITION_LAG = 6.5;
const CAMERA_LOOK_LAG = 9.5;
const TERRAIN_FOLLOW_LAG = 12;
const TERRAIN_NORMAL_SOFTEN = 0.08;

// ---- Infinite Terrain Chunk System ----
const CHUNK_SIZE = 64;     // world units per chunk
const CHUNK_SEGS = 24;     // geometry segments per chunk
const CHUNK_RADIUS = 3;    // how many chunks to keep loaded around the player
const loadedChunks = {};   // key = "cx_cz"
const loadedGroundMeshes = [];
const cameraLookTarget = new THREE.Vector3();

const terrainPalette = {
    sand: new THREE.Color(0xcbb48b),
    grassLow: new THREE.Color(0x87a86a),
    grassHigh: new THREE.Color(0x587341),
    rock: new THREE.Color(0x7c756c),
    snow: new THREE.Color(0xf4f7fb)
};

function dampAlpha(speed, dt) {
    return 1 - Math.exp(-speed * dt);
}

function getForwardVectorFromYaw(yaw, target = new THREE.Vector3()) {
    return target.set(-Math.sin(yaw), 0, -Math.cos(yaw));
}

function getRightVectorFromYaw(yaw, target = new THREE.Vector3()) {
    return target.set(Math.cos(yaw), 0, -Math.sin(yaw));
}

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
const bgColor = 0xc9e5fb;
scene.background = new THREE.Color(bgColor); 
scene.fog = new THREE.Fog(bgColor, 90, 340);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
document.body.appendChild(renderer.domElement);

// Post-Processing (Bloom)
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.45, 0.88);
bloomPass.threshold = 0.35;
bloomPass.strength = 0.22;
bloomPass.radius = 0.55;

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
const ambientLight = new THREE.AmbientLight(0xffffff, 0.42);
scene.add(ambientLight);

const hemisphereLight = new THREE.HemisphereLight(0xe9f6ff, 0x3b3427, 0.9); 
scene.add(hemisphereLight);

const dirLight = new THREE.DirectionalLight(0xfff0ca, 1.8);
dirLight.position.set(-120, 170, -90);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 4096;
dirLight.shadow.mapSize.height = 4096;
dirLight.shadow.camera.left = -180;
dirLight.shadow.camera.right = 180;
dirLight.shadow.camera.top = 180;
dirLight.shadow.camera.bottom = -180;
dirLight.shadow.bias = -0.00018;
scene.add(dirLight);

const accentLight = new THREE.PointLight(0x69d5ff, 0.28, 220);
accentLight.position.set(0, 45, 0);
scene.add(accentLight);

// Chunk material
const groundMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.03,
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

const tankShadowTexture = new THREE.CanvasTexture((() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.34)');
    gradient.addColorStop(0.55, 'rgba(0, 0, 0, 0.16)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    return canvas;
})());

function createSkyDome() {
    const skyGeo = new THREE.SphereGeometry(720, 48, 24);
    const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
            topColor: { value: new THREE.Color(0x4a9be8) },
            horizonColor: { value: new THREE.Color(0xf4d9ac) },
            bottomColor: { value: new THREE.Color(0xe6f4ff) },
            sunDirection: { value: new THREE.Vector3(-0.48, 0.77, -0.42).normalize() },
            sunColor: { value: new THREE.Color(0xffefc4) }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 horizonColor;
            uniform vec3 bottomColor;
            uniform vec3 sunDirection;
            uniform vec3 sunColor;
            varying vec3 vWorldPosition;

            void main() {
                vec3 dir = normalize(vWorldPosition);
                float horizonBand = pow(1.0 - abs(dir.y), 3.0);
                float topMix = smoothstep(-0.18, 0.82, dir.y);
                vec3 sky = mix(bottomColor, topColor, topMix);
                sky = mix(sky, horizonColor, horizonBand * 0.95);

                float sunGlow = pow(max(dot(dir, normalize(sunDirection)), 0.0), 28.0);
                float sunCore = pow(max(dot(dir, normalize(sunDirection)), 0.0), 180.0);
                sky += sunColor * (sunGlow * 0.32 + sunCore * 0.48);

                gl_FragColor = vec4(sky, 1.0);
            }
        `
    });
    return new THREE.Mesh(skyGeo, skyMat);
}

const skyDome = createSkyDome();
scene.add(skyDome);

const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(18, 24, 24),
    new THREE.MeshBasicMaterial({
        color: 0xfff1bb,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    })
);
sunDisc.position.copy(dirLight.position).setLength(285);
scene.add(sunDisc);

// Starfield Background - Disabled for daytime
/*
function createStarfield() {
    const starGeo = new THREE.BufferGeometry();
...
createStarfield();
*/

function terrainColor(height, slope, detail, target = new THREE.Color()) {
    if (height < 1.2) {
        target.lerpColors(terrainPalette.sand, terrainPalette.grassLow, THREE.MathUtils.clamp(height / 1.2, 0, 1));
    } else if (height < 9) {
        target.lerpColors(terrainPalette.grassLow, terrainPalette.grassHigh, THREE.MathUtils.clamp((height - 1.2) / 7.8, 0, 1));
    } else if (height < 16) {
        target.lerpColors(terrainPalette.grassHigh, terrainPalette.rock, THREE.MathUtils.clamp((height - 9) / 7, 0, 1));
    } else {
        target.lerpColors(terrainPalette.rock, terrainPalette.snow, THREE.MathUtils.clamp((height - 16) / 5, 0, 1));
    }

    if (slope < 0.86 && height > 3) {
        target.lerp(terrainPalette.rock, THREE.MathUtils.clamp((0.86 - slope) * 2.4, 0, 0.85));
    }
    if (height > 15.5) {
        target.lerp(terrainPalette.snow, THREE.MathUtils.clamp((height - 15.5) / 4, 0, 0.75));
    }

    const shade = (detail - 0.5) * 0.14 + (slope - 0.75) * 0.08;
    target.offsetHSL(0.01 * (detail - 0.5), 0.02, shade);
    return target;
}

function createRockCluster(seed) {
    const rockMaterial = new THREE.MeshStandardMaterial({
        color: 0x7e776c,
        roughness: 0.98,
        metalness: 0.02
    });
    const group = new THREE.Group();
    const pieces = 2 + Math.floor(noise(seed, seed * 0.31, 918) * 3);
    for (let i = 0; i < pieces; i++) {
        const radius = 0.8 + noise(seed, i, 533) * 1.6;
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 0), rockMaterial);
        rock.position.set(
            (noise(seed, i, 672) - 0.5) * 2.8,
            radius * 0.55,
            (noise(seed, i, 111) - 0.5) * 2.8
        );
        rock.rotation.set(
            noise(seed, i, 773) * Math.PI,
            noise(seed, i, 174) * Math.PI,
            noise(seed, i, 991) * Math.PI
        );
        rock.scale.set(
            1 + noise(seed, i, 381) * 0.7,
            0.65 + noise(seed, i, 274) * 0.5,
            0.9 + noise(seed, i, 845) * 0.5
        );
        rock.castShadow = true;
        rock.receiveShadow = true;
        group.add(rock);
    }
    return group;
}

function buildChunk(cx, cz) {
    const key = `${cx}_${cz}`;
    if (loadedChunks[key]) return;

    const chunkGroup = new THREE.Group();
    chunkGroup.userData.buildingData = [];
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
    const normals = geo.attributes.normal;
    const scratchColor = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const localX = pos.getX(i);
        const localY = pos.getY(i);
        const wx = cx * CHUNK_SIZE + localX;
        const wz = cz * CHUNK_SIZE + localY;
        const detail = smoothNoise(wx * 0.05, wz * 0.05);
        const c = terrainColor(heights[i], normals.getY(i), detail, scratchColor);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mesh = new THREE.Mesh(geo, groundMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    loadedGroundMeshes.push(mesh);
    chunkGroup.add(mesh);
    
    // Add grid overlay
    const gridGeo = geo.clone();
    const gridMat = new THREE.MeshBasicMaterial({
        map: gridTexture,
        transparent: true,
        opacity: 0.045,
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
        buildings.push(buildingData);
        chunkGroup.userData.buildingData.push(buildingData);
    }

    if ((Math.abs(cx) > 1 || Math.abs(cz) > 1) && noise(cx, cz, 7342) > 0.58) {
        const rockCluster = createRockCluster(cx * 97 + cz * 131);
        const offsetX = (noise(cx, cz, 847) - 0.5) * CHUNK_SIZE * 0.7;
        const offsetZ = (noise(cx, cz, 921) - 0.5) * CHUNK_SIZE * 0.7;
        const worldX = cx * CHUNK_SIZE + offsetX;
        const worldZ = cz * CHUNK_SIZE + offsetZ;
        rockCluster.position.set(offsetX, terrainHeight(worldX, worldZ), offsetZ);
        chunkGroup.add(rockCluster);
    }

    chunkGroup.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    scene.add(chunkGroup);
    loadedChunks[key] = chunkGroup;
}

// Separate mesh creation from scene adding to support chunking
function createBuildingMesh(b) {
    const groundY = terrainHeight(b.x, b.z);
    const height = 14 + noise(b.x * 0.11, b.z * 0.11, 906) * 18;
    const geo = new THREE.BoxGeometry(b.width, height, b.depth);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x6e727d,
        roughness: 0.76,
        metalness: 0.28
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(b.x - (Math.round(b.x / CHUNK_SIZE) * CHUNK_SIZE), groundY + height / 2, b.z - (Math.round(b.z / CHUNK_SIZE) * CHUNK_SIZE));
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Windows
    const windowMat = new THREE.MeshStandardMaterial({
        color: 0xd5efff,
        emissive: 0x69a8ff,
        emissiveIntensity: 0.75,
        roughness: 0.2,
        metalness: 0.45
    });
    for (let row = 0; row < Math.floor(height/4); row++) {
        for (let col = -1; col <= 1; col += 2) {
            const wGeo = new THREE.BoxGeometry(1.5, 2, 0.1);
            const win = new THREE.Mesh(wGeo, windowMat);
            win.position.set(col * (b.width/3), -height/2 + 4 + row*5, b.depth/2 + 0.1);
            mesh.add(win);
        }
    }

    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(b.width * 0.92, 0.6, b.depth * 0.92),
        new THREE.MeshStandardMaterial({
            color: 0xa7acb6,
            roughness: 0.55,
            metalness: 0.25
        })
    );
    roof.position.y = height / 2 + 0.2;
    roof.castShadow = true;
    mesh.add(roof);

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
            if (mesh.userData.buildingData?.length) {
                for (const data of mesh.userData.buildingData) {
                    const index = buildings.indexOf(data);
                    if (index !== -1) buildings.splice(index, 1);
                }
            }
            mesh.traverse((child) => {
                const groundIndex = loadedGroundMeshes.indexOf(child);
                if (groundIndex !== -1) loadedGroundMeshes.splice(groundIndex, 1);
            });
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
        let shootRy = myTankYaw + Math.PI;
        let spawnX = myTank.position.x;
        let spawnZ = myTank.position.z;

        if (myTank.userData.turret) {
            myTank.updateMatrixWorld(true);
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
    const visualRoot = new THREE.Group();
    visualRoot.position.y = TANK_CLEARANCE;
    group.add(visualRoot);

    const metalMat = new THREE.MeshStandardMaterial({ 
        color: 0x515866, 
        roughness: 0.22, 
        metalness: 0.88,
        envMapIntensity: 1.0 
    });
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: 0x181b22, 
        roughness: 0.34, 
        metalness: 0.72 
    });
    const neonMat = new THREE.MeshStandardMaterial({ 
        color: colorHex, 
        emissive: colorHex, 
        emissiveIntensity: 2.7,
        roughness: 0.3,
        metalness: 0.15
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x090b10, roughness: 0.72, metalness: 0.38 });
    const barrelMat = new THREE.MeshStandardMaterial({ 
        color: 0x2a303a, 
        roughness: 0.12, 
        metalness: 0.96 
    });

    const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(2.65, 24),
        new THREE.MeshBasicMaterial({
            map: tankShadowTexture,
            color: 0x000000,
            transparent: true,
            opacity: 0.38,
            depthWrite: false
        })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.04;
    group.add(shadow);

    // --- Track housings ---
    const trackGeo = new THREE.BoxGeometry(0.64, 0.78, 4.35);
    [-1.1, 1.1].forEach(xOff => {
        const t = new THREE.Mesh(trackGeo, darkMat);
        t.position.set(xOff, 0.35, 0);
        t.castShadow = true;
        visualRoot.add(t);

        // Neon side strip
        const stripGeo = new THREE.BoxGeometry(0.06, 0.12, 4.05);
        const strip = new THREE.Mesh(stripGeo, neonMat);
        strip.position.set(xOff > 0 ? 0.28 : -0.28, 0.4, 0);
        t.add(strip);

        for (let i = -1.55; i <= 1.55; i += 0.78) {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 18), metalMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(0, -0.08, i);
            wheel.castShadow = true;
            t.add(wheel);
        }
    });

    // --- Hull body ---
    const hullGeo = new THREE.BoxGeometry(2.0, 0.6, 3.6);
    const hull = new THREE.Mesh(hullGeo, bodyMat);
    hull.position.y = 0.85;
    hull.castShadow = true;
    visualRoot.add(hull);

    const glacis = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.55, 1.1), bodyMat);
    glacis.position.set(0, 1.02, -1.25);
    glacis.rotation.x = -0.34;
    glacis.castShadow = true;
    visualRoot.add(glacis);

    const engineDeck = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.18, 1.2), metalMat);
    engineDeck.position.set(0, 1.18, 1.05);
    engineDeck.castShadow = true;
    visualRoot.add(engineDeck);

    const sideSkirtGeo = new THREE.BoxGeometry(0.12, 0.38, 3.85);
    [-1.42, 1.42].forEach((xOff) => {
        const skirt = new THREE.Mesh(sideSkirtGeo, bodyMat);
        skirt.position.set(xOff, 0.82, 0);
        skirt.castShadow = true;
        visualRoot.add(skirt);
    });

    // Front neon "headlights"
    const lightGeo = new THREE.BoxGeometry(0.4, 0.1, 0.1);
    [-0.7, 0.7].forEach(x => {
        const light = new THREE.Mesh(lightGeo, neonMat);
        light.position.set(x, 0.95, -1.85);
        visualRoot.add(light);
    });

    // --- Turret ---
    const turretBaseGeo = new THREE.BoxGeometry(1.72, 0.62, 1.95);
    const turretBase = new THREE.Mesh(turretBaseGeo, bodyMat);
    turretBase.position.set(0, 0, 0);
    turretBase.castShadow = true;

    // Turret neon ring
    const ringGeo = new THREE.BoxGeometry(1.76, 0.06, 1.98);
    const ring = new THREE.Mesh(ringGeo, neonMat);
    ring.position.y = 0.1;
    turretBase.add(ring);

    const turretCap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.3, 18), metalMat);
    turretCap.position.set(0, 0.34, -0.05);
    turretCap.castShadow = true;
    turretBase.add(turretCap);

    // --- Barrel ---
    const barrelGeo = new THREE.CylinderGeometry(0.11, 0.14, 3.5, 16);
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.12, -2.58);
    barrel.castShadow = true;
    turretBase.add(barrel);

    const barrelSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.7, 14), metalMat);
    barrelSleeve.rotation.x = Math.PI / 2;
    barrelSleeve.position.set(0, 0.12, -1.1);
    turretBase.add(barrelSleeve);

    // Muzzle brake with neon tip
    const muzzleGeo = new THREE.CylinderGeometry(0.14, 0.12, 0.4, 12);
    const muzzle = new THREE.Mesh(muzzleGeo, barrelMat);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.12, -4.28);
    turretBase.add(muzzle);

    const tipGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 12);
    const tip = new THREE.Mesh(tipGeo, neonMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, 0.12, -4.48);
    turretBase.add(tip);

    const bustle = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.4, 0.72), metalMat);
    bustle.position.set(0, 0.03, 1.1);
    bustle.castShadow = true;
    turretBase.add(bustle);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 8), metalMat);
    antenna.position.set(-0.52, 0.75, 0.68);
    antenna.castShadow = true;
    turretBase.add(antenna);

    const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), neonMat);
    antennaTip.position.set(-0.52, 1.33, 0.68);
    turretBase.add(antennaTip);

    const turretGroup = new THREE.Group();
    turretGroup.add(turretBase);
    turretGroup.position.set(0, 1.5, -0.05);
    visualRoot.add(turretGroup);

    group.userData.visualRoot = visualRoot;
    group.userData.shadow = shadow;
    group.userData.surfaceNormal = new THREE.Vector3(0, 1, 0);
    group.userData.surfaceForward = new THREE.Vector3(0, 0, -1);
    group.userData.terrainReady = false;
    group.userData.turret = turretGroup;
    return group;
}

function spawnBuilding(b) {
    const groundY = terrainHeight(b.x, b.z);
    const height = 12 + noise(b.x * 0.17, b.z * 0.17, 1411) * 8;
    const geo = new THREE.BoxGeometry(b.width, height, b.depth);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x767b86,
        roughness: 0.88,
        metalness: 0.08
    });
    const mesh = new THREE.Mesh(geo, mat);
    // Position so bottom of building sits on terrain surface
    mesh.position.set(b.x, groundY + height / 2, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Window grid (edge geometry overlay)
    const windowMat = new THREE.MeshStandardMaterial({
        color: 0xcaecff,
        emissive: 0x3d73cc,
        emissiveIntensity: 0.45,
        roughness: 0.18,
        metalness: 0.42,
        transparent: true,
        opacity: 0.8
    });
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

    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(b.width * 0.9, 0.45, b.depth * 0.9),
        new THREE.MeshStandardMaterial({ color: 0xadb3bd, roughness: 0.5, metalness: 0.2 })
    );
    roof.position.y = height / 2 + 0.18;
    roof.castShadow = true;
    mesh.add(roof);

    scene.add(mesh);
    buildings.push(b);
}

// Pine tree helper
const treeMeshes = [];
function spawnTree(wx, wz) {
    const h = terrainHeight(wx, wz);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4023, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({
        color: 0x315d2f,
        roughness: 0.92,
        emissive: 0x102410,
        emissiveIntensity: 0.18
    });
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
    treeGroup.rotation.y = noise(wx * 0.11, wz * 0.11, 310) * Math.PI * 2;
    const scale = 0.75 + noise(wx * 0.07, wz * 0.07, 622) * 0.6;
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
    tank.userData = {
        ...tank.userData,
        targetPosition: new THREE.Vector3(state.x, 0, state.z),
        targetRotationY: state.ry,
        yaw: state.ry
    };
    updateTankPose(tank, state.ry, 1 / 60, true);
    otherTanks[id] = tank;
    scene.add(tank);
}

function castSpell(spellId) {
    if (gameState.spells[spellId] > 0 && partySocket && partySocket.readyState === 1) {
        gameState.spells[spellId]--;
        updateSpellUI();

        let extraParams = {};
        if (spellId === 'blast' && myTank) {
            let shootRy = myTankYaw + Math.PI;
            let spawnX = myTank.position.x;
            let spawnZ = myTank.position.z;

            if (myTank.userData.turret) {
                myTank.updateMatrixWorld(true);
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
            const forward = getForwardVectorFromYaw(myTankYaw);
            
            let targetX = myTank.position.x + forward.x * 25;
            let targetZ = myTank.position.z + forward.z * 25;
            
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
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

function sampleTankTerrainFrame(tankGroup, yaw) {
    const x = tankGroup.position.x;
    const z = tankGroup.position.z;
    const planarForward = getForwardVectorFromYaw(yaw);
    const planarRight = getRightVectorFromYaw(yaw);

    function sample(forwardOffset, rightOffset) {
        const sx = x + planarForward.x * forwardOffset + planarRight.x * rightOffset;
        const sz = z + planarForward.z * forwardOffset + planarRight.z * rightOffset;
        return new THREE.Vector3(sx, terrainHeight(sx, sz), sz);
    }

    const frontLeft = sample(TANK_HALF_LENGTH, -TANK_HALF_WIDTH);
    const frontRight = sample(TANK_HALF_LENGTH, TANK_HALF_WIDTH);
    const backLeft = sample(-TANK_HALF_LENGTH, -TANK_HALF_WIDTH);
    const backRight = sample(-TANK_HALF_LENGTH, TANK_HALF_WIDTH);
    const center = sample(0, 0);

    const frontMid = frontLeft.clone().add(frontRight).multiplyScalar(0.5);
    const backMid = backLeft.clone().add(backRight).multiplyScalar(0.5);
    const leftMid = frontLeft.clone().add(backLeft).multiplyScalar(0.5);
    const rightMid = frontRight.clone().add(backRight).multiplyScalar(0.5);

    const slopeForward = frontMid.sub(backMid).normalize();
    const slopeRight = rightMid.sub(leftMid).normalize();
    const normal = new THREE.Vector3().crossVectors(slopeRight, slopeForward).normalize();
    if (normal.y < 0) normal.multiplyScalar(-1);
    normal.lerp(WORLD_UP, TERRAIN_NORMAL_SOFTEN).normalize();

    const terrainForward = planarForward.clone().projectOnPlane(normal);
    if (terrainForward.lengthSq() < 1e-5) {
        terrainForward.copy(planarForward);
    }
    terrainForward.normalize();

    const terrainRight = new THREE.Vector3().crossVectors(terrainForward, normal).normalize();
    const backward = terrainForward.clone().multiplyScalar(-1);
    const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(terrainRight, normal, backward)
    );

    const averageHeight = (frontLeft.y + frontRight.y + backLeft.y + backRight.y) / 4;
    const targetHeight = Math.max(center.y, averageHeight);

    return {
        height: targetHeight,
        normal,
        forward: terrainForward,
        quaternion: targetQuaternion
    };
}

function updateTankPose(tankGroup, yaw, dt, instant = false) {
    const visualRoot = tankGroup.userData.visualRoot || tankGroup;
    const frame = sampleTankTerrainFrame(tankGroup, yaw);
    const alignAlpha = instant || !tankGroup.userData.terrainReady ? 1 : dampAlpha(TERRAIN_FOLLOW_LAG, dt);

    tankGroup.position.y = THREE.MathUtils.lerp(tankGroup.position.y, frame.height, alignAlpha);
    visualRoot.position.y = TANK_CLEARANCE;

    if (alignAlpha >= 1) {
        visualRoot.quaternion.copy(frame.quaternion);
    } else {
        visualRoot.quaternion.slerp(frame.quaternion, alignAlpha);
    }

    if (!tankGroup.userData.surfaceNormal) tankGroup.userData.surfaceNormal = new THREE.Vector3();
    if (!tankGroup.userData.surfaceForward) tankGroup.userData.surfaceForward = new THREE.Vector3();
    tankGroup.userData.surfaceNormal.copy(frame.normal);
    tankGroup.userData.surfaceForward.copy(frame.forward);
    tankGroup.userData.yaw = yaw;
    tankGroup.userData.terrainReady = true;

    if (tankGroup.userData.shadow) {
        const speedInfluence = Math.min(0.22, Math.abs(tankGroup.userData.speed || 0) / MAX_SPEED * 0.22);
        tankGroup.userData.shadow.scale.setScalar(1.02 + speedInfluence);
    }
}

function updateFollowCamera(dt) {
    if (!myTank) return;

    const normal = myTank.userData.surfaceNormal || WORLD_UP;
    const forward = myTank.userData.surfaceForward || getForwardVectorFromYaw(myTankYaw);
    const right = new THREE.Vector3().crossVectors(forward, normal).normalize();
    const desiredPos = myTank.position.clone()
        .addScaledVector(normal, 6.2)
        .addScaledVector(forward, -13.5)
        .addScaledVector(right, 0.4);
    const desiredLook = myTank.position.clone()
        .addScaledVector(normal, 2.2)
        .addScaledVector(forward, 8.5);

    desiredPos.y = Math.max(desiredPos.y, terrainHeight(desiredPos.x, desiredPos.z) + 4.5);

    const positionAlpha = dampAlpha(CAMERA_POSITION_LAG, dt);
    const lookAlpha = dampAlpha(CAMERA_LOOK_LAG, dt);
    if (!camera.userData.followReady) {
        camera.position.copy(desiredPos);
        cameraLookTarget.copy(desiredLook);
        camera.userData.followReady = true;
    } else {
        camera.position.lerp(desiredPos, positionAlpha);
        cameraLookTarget.lerp(desiredLook, lookAlpha);
    }
    camera.up.lerp(normal, positionAlpha).normalize();
    camera.lookAt(cameraLookTarget);
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

        myTank.userData.speed = tankVelocity;
        let moved = Math.abs(tankVelocity) > 0.1;
        const oldPos = myTank.position.clone();

        if (moved) {
            const forward = getForwardVectorFromYaw(myTankYaw);
            myTank.position.x += forward.x * tankVelocity * dt;
            myTank.position.z += forward.z * tankVelocity * dt;
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

        updateTankPose(myTank, myTankYaw, dt);
        myTank.updateMatrixWorld(true);
        updateFollowCamera(dt);

        // Turret Aiming (Smoother)
        if (myTank.userData.turret) {
            raycaster.setFromCamera(mouse, camera);
            let intersects = raycaster.intersectObjects(loadedGroundMeshes, false);
            if (intersects.length === 0) {
                intersects = raycaster.intersectObject(groundPlane);
            }
            if (intersects.length > 0) {
                const target = intersects[0].point;
                const dx = target.x - myTank.position.x;
                const dz = target.z - myTank.position.z;
                const globalAngle = Math.atan2(dx, dz) + Math.PI;
                const targetRot = globalAngle - myTankYaw;
                
                // Lerp turret rotation for smoothness
                const currentRot = myTank.userData.turret.rotation.y;
                const diff = targetRot - currentRot;
                const shortDiff = Math.atan2(Math.sin(diff), Math.cos(diff));
                myTank.userData.turret.rotation.y += shortDiff * 0.18;
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
            tank.position.x = THREE.MathUtils.lerp(tank.position.x, tank.userData.targetPosition.x, 0.3);
            tank.position.z = THREE.MathUtils.lerp(tank.position.z, tank.userData.targetPosition.z, 0.3);
            if (tank.userData.yaw === undefined) tank.userData.yaw = tank.userData.targetRotationY;
            const diff = tank.userData.targetRotationY - tank.userData.yaw;
            const shortDiff = Math.atan2(Math.sin(diff), Math.cos(diff));
            tank.userData.yaw += shortDiff * 0.3;
            tank.userData.speed = tank.userData.targetPosition.distanceTo(tank.position) * 12;
            updateTankPose(tank, tank.userData.yaw, dt);
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

    const gradient = minimapCtx.createRadialGradient(cx, cy, 12, cx, cy, W / 2);
    gradient.addColorStop(0, 'rgba(14, 34, 58, 0.96)');
    gradient.addColorStop(0.65, 'rgba(8, 18, 30, 0.94)');
    gradient.addColorStop(1, 'rgba(4, 8, 14, 0.96)');
    minimapCtx.fillStyle = gradient;
    minimapCtx.fillRect(0, 0, W, H);

    minimapCtx.strokeStyle = 'rgba(125, 231, 255, 0.14)';
    minimapCtx.lineWidth = 1;
    for (const radius of [W * 0.18, W * 0.34, W * 0.48]) {
        minimapCtx.beginPath();
        minimapCtx.arc(cx, cy, radius, 0, Math.PI * 2);
        minimapCtx.stroke();
    }

    minimapCtx.beginPath();
    minimapCtx.moveTo(cx, 0);
    minimapCtx.lineTo(cx, H);
    minimapCtx.moveTo(0, cy);
    minimapCtx.lineTo(W, cy);
    minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    minimapCtx.stroke();

    // Draw arena centre marker
    const arenaX = cx + (-myTank.position.x) / MINIMAP_SCALE * (W / MINIMAP_RANGE / 2);
    const arenaZ = cy + (-myTank.position.z) / MINIMAP_SCALE * (H / MINIMAP_RANGE / 2);
    minimapCtx.beginPath();
    minimapCtx.arc(arenaX, arenaZ, 3, 0, Math.PI * 2);
    minimapCtx.fillStyle = 'rgba(255,255,255,0.15)';
    minimapCtx.fill();

    const toMapX = (wx) => cx + (wx - myTank.position.x) / MINIMAP_RANGE * W;
    const toMapZ = (wz) => cy + (wz - myTank.position.z) / MINIMAP_RANGE * H;

    minimapCtx.fillStyle = 'rgba(125, 231, 255, 0.18)';
    for (const b of buildings) {
        if (Math.abs(b.x - myTank.position.x) > MINIMAP_RANGE || Math.abs(b.z - myTank.position.z) > MINIMAP_RANGE) continue;
        const mx = toMapX(b.x);
        const mz = toMapZ(b.z);
        const mw = Math.max(3, b.width / MINIMAP_RANGE * W);
        const md = Math.max(3, b.depth / MINIMAP_RANGE * H);
        minimapCtx.fillRect(mx - mw / 2, mz - md / 2, mw, md);
    }

    minimapCtx.fillStyle = 'rgba(255, 214, 115, 0.86)';
    for (const crate of crates) {
        if (Math.abs(crate.position.x - myTank.position.x) > MINIMAP_RANGE || Math.abs(crate.position.z - myTank.position.z) > MINIMAP_RANGE) continue;
        minimapCtx.fillRect(toMapX(crate.position.x) - 2, toMapZ(crate.position.z) - 2, 4, 4);
    }

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
    minimapCtx.strokeStyle = 'rgba(125, 231, 255, 0.45)';
    minimapCtx.lineWidth = 1;
    minimapCtx.stroke();
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
                    myTankYaw = myInitialState.ry;
                    updateTankPose(myTank, myTankYaw, 1 / 60, true);
                    camera.userData.followReady = false;

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
                        myTankYaw = myState.ry;
                        updateTankPose(myTank, myTankYaw, 1 / 60, true);
                        camera.userData.followReady = false;
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
                                myTankYaw = myState.ry;
                                updateTankPose(myTank, myTankYaw, 1 / 60, true);
                                camera.userData.followReady = false;
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
            updateTankPose(myTank, myTankYaw, 1 / 60, true);
            camera.userData.followReady = false;
            myTank.traverse((child) => { if (child.isMesh) child.visible = false; });
            scene.add(myTank);
        }
    }
}
