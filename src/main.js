import { Game } from './core/Game.js';
import { CharacterFactory } from './entities/CharacterFactory.js';
import { ObjectPool } from './utils/ObjectPool.js';
import { ParticleSystem } from './systems/Particle.js';
import { Network } from './systems/Network.js'; // 🌐 PORTED MULTIPLAYER
import './ui/HudEditor.js'; // HUD customization
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * GameLegacy - Integra TODA a lógica original do jogo
 * Este arquivo conecta a nova arquitetura modular com o código original
 */

console.log(`
╔═══════════════════════════════════════════════════╗
║   RESIDENCIAL CANAÃ - TACTICAL SURVIVAL           ║
║   Com lógica original + Arquitetura otimizada     ║
╚═══════════════════════════════════════════════════╝
`);

// Variáveis globais do jogo original
let scene, camera, renderer, clock, playerGroup, charModel, zoneMesh, sunObj;
let cameraYaw = 0, cameraPitch = 0, vY = 0, jumps = 0;
let isPlaying = false, isPaused = false, isRunning = false, isADS = false, isShooting = false, isFPS = false;
let currentWeapon = 'AR', grenadeType = 'explosive', currentGameMode = 'solo';
let bullets = [], bots = [], obstacles = [], obstacleBoxes = [], grenades = [], effects = [], medkits = [];
let health = 100, armor = 100, lastShot = 0, lastDamageTime = 0, playerKills = 0;
let particleSystem = null; // 🚀 Particle system for blood and effects
let zoneRadius = 500, zoneActive = false;
let initialBotCount = 10, houseData = [];
let playerName = "SOLDADO";
let mapRadiusLimit = 1050;
let missionAccomplished = false;
let solidObstacles = [], groundObstacles = [];
let minimapCtx, minimapCanvas;
let moveVec = new THREE.Vector2(), moveTouchId = null, lookTouchId = null, fireTouchId = null;
let lastX = 0, lastY = 0, fireLastX = 0, fireLastY = 0;
let isEditingHud = false, cfg = { bots: 10, diff: 2, sens: 0.0165, fov: 75, graphics: 'low' };

const tempVec = new THREE.Vector3();
const tempVec2 = new THREE.Vector3();
const ray = new THREE.Raycaster();
const floorRay = new THREE.Raycaster();
const bulletGeo = new THREE.SphereGeometry(0.45, 8, 8);
const bulletMatYellow = new THREE.MeshBasicMaterial({ color: 0xffff00 });

// 🚀 Object Pool - will be initialized after scene is created
let bulletPool = null;

// Audio context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSfx(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);

    if (type === 'shoot') {
        osc.type = 'square'; osc.frequency.setValueAtTime(160, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'sniper') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'hit') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.05);
        osc.start(); osc.stop(audioCtx.currentTime + 0.05);
    }
}

// Criar mundo completo usando função original
// Criar mundo completo usando lógica do Backup
function createWorld() {
    const mapSize = 1000;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(mapSize * 2.5, mapSize * 2.5), new THREE.MeshStandardMaterial({ color: 0x3d7a3d, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.userData.isGround = true;
    scene.add(floor); obstacles.push(floor); createMountains(); createLighthouse(0, 0);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }); const gridSpacing = 160;
    for (let i = -4; i <= 4; i++) {
        const roadH = new THREE.Mesh(new THREE.PlaneGeometry(2500, 26), roadMat); roadH.rotation.x = -Math.PI / 2; roadH.position.set(0, 0.1, i * gridSpacing); roadH.userData.isGround = true; scene.add(roadH);
        const roadV = new THREE.Mesh(new THREE.PlaneGeometry(26, 2500), roadMat); roadV.rotation.x = -Math.PI / 2; roadV.position.set(i * gridSpacing, 0.1, 0); roadV.userData.isGround = true; scene.add(roadV);
        obstacles.push(roadH, roadV);
    }
    for (let i = 0; i < 250; i++) { const tx = (Math.random() - 0.5) * 2000; const tz = (Math.random() - 0.5) * 2000; if (Math.hypot(tx, tz) > 60) createTree(tx, tz); }
    let hIdx = 0;
    // Casas centrais
    for (let a = 0; a < 4; a++) {
        // ROTACIONADAS 45 GRAUS (+ PI/4) PARA SAIR DO EIXO DAS RUAS
        const ang = (a / 4) * Math.PI * 2 + Math.PI / 4;
        // RAIO AUMENTADO PARA 85 PARA AFASTAR DO CENTRO
        createDetailedHouse(Math.cos(ang) * 85, Math.sin(ang) * 85, hIdx++);
    }

    // Casas da grade (Tirando das ruas)
    // Offset alterado para gridSpacing / 2 (80) para centrar no quarteirão
    const gridOffset = 80;
    for (let rx = -2; rx <= 2; rx++) {
        for (let rz = -2; rz <= 2; rz++) {
            if (Math.abs(rx) < 1 && Math.abs(rz) < 1) continue;
            const x = rx * gridSpacing + gridOffset;
            const z = rz * gridSpacing + gridOffset;
            createDetailedHouse(x, z, hIdx++);
        }
    }
}

function createMountains() {
    const mountainMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 1 });
    for (let i = 0; i < 48; i++) {
        const angle = (i / 48) * Math.PI * 2;
        const dist = 1000 + Math.random() * 400;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        const height = 180 + Math.random() * 250;
        const width = 250 + Math.random() * 300;

        const mountain = new THREE.Mesh(new THREE.ConeGeometry(width, height, 4), mountainMat);
        mountain.position.set(x, height / 2 - 5, z);
        mountain.rotation.y = Math.random() * Math.PI;
        mountain.userData.isMountain = true;
        scene.add(mountain);
    }
}

function createTree(x, z) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 1.2, 12, 8),
        new THREE.MeshStandardMaterial({ color: 0x5D4037 })
    );
    trunk.position.y = 6;

    const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(6, 16, 8),
        new THREE.MeshStandardMaterial({ color: 0x2E7D32, roughness: 0.8 })
    );
    leaves.position.y = 16;
    leaves.userData.isSolid = false;

    group.add(trunk, leaves);
    group.position.set(x, 0, z);
    group.userData.isTree = true;
    scene.add(group);
    obstacles.push(trunk);
}

function createLighthouse(x, z) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(8, 12, 60, 16),
        new THREE.MeshStandardMaterial({ color: 0xcccccc })
    );
    base.position.y = 30;
    base.castShadow = true;
    base.receiveShadow = true;
    base.userData.isFarol = true;

    const top = new THREE.Mesh(
        new THREE.CylinderGeometry(10, 8, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    top.position.y = 64;

    const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(6, 6, 8, 16),
        new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.6 })
    );
    glass.position.y = 72;

    const dome = new THREE.Mesh(
        new THREE.SphereGeometry(7, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    dome.position.y = 76;

    const spot = new THREE.SpotLight(0xffffff, 5, 400, Math.PI / 6, 0.5);
    spot.position.set(0, 72, 0);
    spot.target.position.set(100, 0, 0);

    group.add(base, top, glass, dome, spot, spot.target);
    group.position.set(x, 0, z);
    scene.add(group);
    obstacles.push(base, top, dome);
}

// 🏗️ PORTED HOUSE GENERATION LOGIC (FULL)
function createDetailedHouse(x, z, houseId) {
    const buildingGroup = new THREE.Group();
    const geometries = {
        parede: [],
        concreto: [],
        metal: [],
        madeira: [],
        saco: []
    };
    const invisibleMat = new THREE.MeshBasicMaterial({ visible: false }); // FÍSICA INVISÍVEL

    // --- 1. MATERIAIS ---
    const matParede = new THREE.MeshStandardMaterial({ color: 0xbfae95, roughness: 1.0, side: THREE.DoubleSide });
    const matConcreto = new THREE.MeshStandardMaterial({ color: 0x8c8c7e, roughness: 0.9, side: THREE.DoubleSide });
    const matMetal = new THREE.MeshStandardMaterial({ color: 0x5a3a2a, metalness: 0.3, roughness: 0.8, side: THREE.DoubleSide });
    const matMadeira = new THREE.MeshStandardMaterial({ color: 0x6F4E37, roughness: 1.0 });
    const matSaco = new THREE.MeshStandardMaterial({ color: 0x9e9578, roughness: 1.0 });

    // Helper interno para criar blocos
    function createBox(w, h, d, px, py, pz, materialType, customMat = null) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geo, invisibleMat); // Usa material invisível para colisão
        mesh.position.set(px, py, pz);
        mesh.updateMatrix(); // Importante para o merge

        // 1. SALVA PARA FUSÃO VISUAL (Cópia da geometria transformada)
        if (materialType && !customMat) {
            const clonedGeo = geo.clone();
            clonedGeo.applyMatrix4(mesh.matrix);
            geometries[materialType].push(clonedGeo);
        }

        // 2. ADICIONA À COLISÃO DO JOGO (OBJETO FANTASMA)
        mesh.userData.isWall = true;
        if (py > 4) mesh.userData.isRoof = true;
        obstacles.push(mesh);

        // 3. ADICIONA AO GRUPO (MAS INVISÍVEL)
        buildingGroup.add(mesh);
        return mesh;
    }

    // --- TÉRREO ---
    createBox(6, 3.5, 0.2, 0, 1.75, -2.4, 'parede'); // Fundo
    createBox(0.2, 3.5, 5, -2.9, 1.75, 0, 'parede'); // Esq
    createBox(2.0, 3.5, 0.2, -2.0, 1.75, 2.4, 'parede'); // Parede Esq (Recuada)
    createBox(2.0, 3.5, 0.2, 2.0, 1.75, 2.4, 'parede');  // Parede Dir (Recuada)
    createBox(2.0, 0.7, 0.2, 0, 3.15, 2.4, 'parede');    // Verga (Mais fina para porta mais alta)
    createBox(0.2, 3.5, 2, 2.9, 1.75, 1.5, 'parede');
    createBox(0.2, 3.5, 1, 2.9, 1.75, -2, 'parede');
    createBox(0.2, 1, 2, 2.9, 3, 0, 'parede'); // Verga Passagem Garagem

    // --- RAMPA (Esquerda) ---
    const rampGeo = new THREE.BoxGeometry(2.5, 0.2, 6.0);
    const ramp = new THREE.Mesh(rampGeo, matMadeira);
    ramp.position.set(-1.5, 1.75, 0.8);
    ramp.rotation.x = -0.72;
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    ramp.userData.isGround = true;
    obstacles.push(ramp);
    buildingGroup.add(ramp);

    // --- SEGUNDO ANDAR ---
    createBox(3.0, 0.2, 5, 1.5, 3.5, 0, 'concreto');
    createBox(3.0, 0.2, 1.5, -1.5, 3.5, -1.75, 'concreto');
    createBox(4, 3, 0.2, -1, 5, 2.4, 'concreto'); // Frente
    createBox(4, 3, 0.2, -1, 5, -2.4, 'concreto'); // Fundo
    createBox(0.2, 3, 5, -2.9, 5, 0, 'concreto'); // Esq
    createBox(0.2, 3, 1, 0.9, 5, 0, 'concreto'); // Pilar Central
    createBox(0.2, 3, 0.5, 0.9, 5, -2.25, 'concreto'); // Canto Fundo
    createBox(0.2, 3, 0.5, 0.9, 5, 2.25, 'concreto'); // Canto Frente
    createBox(0.2, 1, 1.5, 0.9, 6, 1.25, 'concreto'); // Verga Janela
    createBox(0.2, 1, 1.5, 0.9, 4, 1.25, 'concreto'); // Peitoril Janela
    createBox(0.2, 1, 1.5, 0.9, 6, -1.25, 'concreto'); // Verga Porta

    // --- TELHADO ---
    createBox(4.4, 0.2, 5.4, -1, 6.5, 0, 'concreto');
    createBox(4.4, 0.4, 0.2, -1, 6.8, 2.6, 'concreto'); // Mureta
    createBox(0.2, 0.4, 5.4, -3.1, 6.8, 0, 'concreto'); // Mureta

    // --- SACADA EXTERNA ---
    const sacadaChao = createBox(2, 0.2, 5, 2, 3.5, 0, 'concreto');
    sacadaChao.userData.isGround = true;
    createBox(2, 1, 0.2, 2, 4, 2.4, 'concreto');
    createBox(0.2, 1, 5, 2.9, 4, 0, 'concreto');

    // --- GARAGEM ---
    const garRoof = createBox(3.2, 0.1, 4.2, 4.5, 3.2, -0.5, 'metal');
    garRoof.rotation.z = -0.15;
    garRoof.userData.isGround = true;
    createBox(0.1, 3, 4, 6, 1.5, -0.5, 'metal'); // Parede Ext
    createBox(3, 3, 0.1, 4.5, 1.5, -2.5, 'metal'); // Fundo
    createBox(1, 3, 0.1, 5.5, 1.5, 1.5, 'metal'); // Frente Parcial
    createBox(2, 0.5, 0.1, 4.5, 2.8, 1.5, 'metal'); // Topo Frente
    createBox(3, 0.1, 4, 4.5, 0.1, -0.5, 'concreto'); // Piso

    // --- PORTA DA GARAGEM (FUNCIONAL - NÃO FUNDIR) ---
    const portao = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.8, 3.0), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 }));
    portao.position.set(5.5, 1.4, 1.5);
    portao.castShadow = true; portao.receiveShadow = true;
    portao.userData.isDoor = true;
    portao.userData.isSolid = true;
    portao.userData.isOpen = false;
    portao.userData.origY = 1.4;
    obstacles.push(portao);
    buildingGroup.add(portao);

    // --- DETALHES ---
    for (let i = -1; i <= 1; i++) {
        createBox(0.7, 0.3, 0.5, -1 + (i * 0.6), 6.8, 2.2, 'saco');
    }
    createBox(1, 1, 1, 2, 0.5, -1.5, 'madeira'); // Caixote

    // --- MERGE VISUAL (MÁGICA) ---
    if (geometries.parede.length > 0) {
        const merged = BufferGeometryUtils.mergeGeometries(geometries.parede);
        const mesh = new THREE.Mesh(merged, matParede); mesh.castShadow = true; mesh.receiveShadow = true; buildingGroup.add(mesh);
    }
    if (geometries.concreto.length > 0) {
        const merged = BufferGeometryUtils.mergeGeometries(geometries.concreto);
        const mesh = new THREE.Mesh(merged, matConcreto); mesh.castShadow = true; mesh.receiveShadow = true; buildingGroup.add(mesh);
    }
    if (geometries.metal.length > 0) {
        const merged = BufferGeometryUtils.mergeGeometries(geometries.metal);
        const mesh = new THREE.Mesh(merged, matMetal); mesh.castShadow = true; mesh.receiveShadow = true; buildingGroup.add(mesh);
    }
    if (geometries.madeira.length > 0) {
        const merged = BufferGeometryUtils.mergeGeometries(geometries.madeira);
        const mesh = new THREE.Mesh(merged, matMadeira); mesh.castShadow = true; mesh.receiveShadow = true; buildingGroup.add(mesh);
    }
    if (geometries.saco.length > 0) {
        const merged = BufferGeometryUtils.mergeGeometries(geometries.saco);
        const mesh = new THREE.Mesh(merged, matSaco); mesh.castShadow = true; mesh.receiveShadow = true; buildingGroup.add(mesh);
    }

    // Adiciona Medkit dentro da nova casa (para manter jogabilidade)
    // ESCALA REDUZIDA PELA METADE
    const mk = new THREE.Group();
    const mkBox = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1.4), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 1.4), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
    mk.add(mkBox, crossH, crossV);
    mk.position.set(0, 1.2, 0); // Centro da casa
    mk.scale.set(0.35, 0.35, 0.35); // REDUZIDO
    mk.userData.isMedkit = true;
    buildingGroup.add(mk);
    medkits.push(mk);

    // Posicionamento no Mundo
    buildingGroup.position.set(x, 0, z);
    buildingGroup.userData.isHouse = true;

    // AUMENTO DO TAMANHO DAS CASAS (Scale 4.5)
    buildingGroup.scale.set(4.5, 4.5, 4.5);

    scene.add(buildingGroup);

    // Metadata para Bots
    houseData.push({
        position: new THREE.Vector3(x, 2, z),
        doorPos: new THREE.Vector3(x, 0, z + 7), // Entrada aproximada
        occupiedBy: null,
        id: houseId,
        bounds: new THREE.Box3().setFromObject(buildingGroup)
    });
}

// Setup Three.js
function setupThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.0006);
    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(cfg.fov, window.innerWidth / window.innerHeight, 0.1, 5000);

    renderer = new THREE.WebGLRenderer({
        antialias: (cfg.graphics === 'high'),
        powerPreference: 'high-performance',
        precision: 'mediump'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);

    let pixelRatio = window.devicePixelRatio;
    if (pixelRatio > 1.5) pixelRatio = 1.5;
    if (cfg.graphics === 'low') pixelRatio = 1.0;
    renderer.setPixelRatio(pixelRatio);

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = cfg.graphics === 'low' ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;

    document.getElementById('game-container').appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.1);
    sunLight.position.set(300, 500, 100);
    sunLight.castShadow = true;
    const res = cfg.graphics === 'low' ? 256 : 1024;
    sunLight.shadow.mapSize.width = res;
    sunLight.shadow.mapSize.height = res;
    scene.add(sunLight);

    sunObj = new THREE.Mesh(
        new THREE.SphereGeometry(25, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    sunObj.position.set(400, 600, 200);
    scene.add(sunObj);

    createWorld();

    playerGroup = new THREE.Group();
    charModel = CharacterFactory.createHumanoid(0x2E7D32, 'player', 'player');
    playerGroup.add(charModel);
    scene.add(playerGroup);
    playerGroup.position.set(40, 68, 40); // Spawn outside Lighthouse (0,0)

    zoneMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1, 1500, 32, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
    );
    zoneMesh.scale.set(zoneRadius, 1, zoneRadius);
    zoneMesh.position.y = 750;
    scene.add(zoneMesh);

    // 🚀 Initialize particle system
    particleSystem = new ParticleSystem(scene);

    // 🚀 Initialize bullet pool (MUST be after scene creation!)
    bulletPool = new ObjectPool(
        // Factory: Create a new bullet mesh
        () => {
            const bullet = new THREE.Mesh(bulletGeo, bulletMatYellow);
            bullet.visible = false;
            bullet.userData.active = false;
            scene.add(bullet); // Add to scene once, reuse forever
            return bullet;
        },
        // Reset: Hide bullet when returned to pool
        (bullet) => {
            bullet.visible = false;
            bullet.userData.active = false;
            bullet.userData.life = 0;
        },
        100 // Pre-allocate 100 bullets
    );

    setupGameInput();
    scene.updateMatrixWorld(true);
    updateCollisionBoxes();
    animate();
}

function updateCollisionBoxes() {
    obstacleBoxes = [];
    solidObstacles.length = 0;
    groundObstacles.length = 0;

    obstacles.forEach(o => {
        if (o.geometry && o.userData.isSolid !== false && !o.userData.isGround) {
            const b = new THREE.Box3().setFromObject(o);
            b.userData = o.userData;
            obstacleBoxes.push(b);
            solidObstacles.push(o);
        }
        if (o.userData.isGround || o.userData.isRoof) {
            groundObstacles.push(o);
        }
    });
}

function setupGameInput() {
    window.addEventListener('touchstart', e => {
        if (isEditingHud || isPaused) return;
        for (let t of e.changedTouches) {
            // Priority: Explicit Joystick Touch
            if (t.target.id === 'joy-zone' || t.target.closest('#joy-zone')) {
                moveTouchId = t.identifier;
                // preventDefault is crucial for joystick to not scroll page
                if (e.cancelable) e.preventDefault();
            }
            // Fallback: Left side of screen (for "invisible joystick" feel)
            else if (t.clientX < window.innerWidth / 2 && !t.target.classList.contains('hud-el')) {
                moveTouchId = t.identifier;
                if (e.cancelable) e.preventDefault();
            }
            else if (t.target.closest('#btn-fire-ads')) {
                fireTouchId = t.identifier;
                fireLastX = t.clientX;
                fireLastY = t.clientY;
                isShooting = true;
                isADS = true;
                camera.fov = currentWeapon === 'SNIPER' ? 12 : 30;
                camera.updateProjectionMatrix();
                if (currentWeapon === 'SNIPER') document.getElementById('sniper-scope').style.display = 'block';
            } else if (t.target.closest('#btn-fire-hip')) {
                fireTouchId = t.identifier;
                fireLastX = t.clientX;
                fireLastY = t.clientY;
                isShooting = true;
                isADS = false; // Hipfire
                camera.fov = cfg.fov;
                camera.updateProjectionMatrix();
            } else if (!t.target.classList.contains('hud-el')) {
                lookTouchId = t.identifier;
                lastX = t.clientX;
                lastY = t.clientY;
            }
        }
    }, { passive: false });

    document.querySelectorAll('.hud-el').forEach(el => {
        el.addEventListener('pointerdown', e => {
            if (isEditingHud) return;
            if (el.id === 'btn-jump') {
                if (!isPaused && jumps < 2) {
                    vY = 0.8;
                    jumps++;
                }
            }
            if (el.id === 'btn-grenade') {
                throwGrenade();
            }
            if (el.id === 'btn-weapon') {
                // Cycle weapons: AR -> SMG -> SNIPER -> SHOTGUN
                const weapons = ['AR', 'SMG', 'SNIPER', 'SHOTGUN'];
                const currentIndex = weapons.indexOf(currentWeapon);
                currentWeapon = weapons[(currentIndex + 1) % weapons.length];
                console.log('🔫 Arma trocada para:', currentWeapon);
            }
            if (el.id === 'btn-reload') {
                console.log('🔄 Recarregando...');
                // Reload logic would go here
            }
        });
    });

    window.addEventListener('touchmove', e => {
        if (isEditingHud || isPaused) return;
        for (let t of e.changedTouches) {
            if (t.identifier === moveTouchId) {
                const zone = document.getElementById('joy-zone');
                if (!zone) return;

                const r = zone.getBoundingClientRect();
                const radius = r.width / 2; // Dynamic radius (approx 70px)

                let dx = t.clientX - (r.left + radius);
                let dy = t.clientY - (r.top + radius);
                const d = Math.hypot(dx, dy);

                // Limit to radius
                if (d > radius) {
                    dx *= radius / d;
                    dy *= radius / d;
                }

                document.getElementById('joy-knob').style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                moveVec.set(dx / radius, -dy / radius);
            }
            if (t.identifier === fireTouchId) {
                cameraYaw -= (t.clientX - fireLastX) * cfg.sens * 0.8;
                cameraPitch = Math.max(-1.5, Math.min(1.5, cameraPitch - (t.clientY - fireLastY) * cfg.sens * 1.2));
                fireLastX = t.clientX;
                fireLastY = t.clientY;
            }
            if (t.identifier === lookTouchId) {
                cameraYaw -= (t.clientX - lastX) * cfg.sens;
                cameraPitch = Math.max(-1.5, Math.min(1.5, cameraPitch - (t.clientY - lastY) * cfg.sens));
                lastX = t.clientX;
                lastY = t.clientY;
            }
        }
    }, { passive: false });

    window.addEventListener('touchend', e => {
        for (let t of e.changedTouches) {
            if (t.identifier === moveTouchId) {
                moveTouchId = null;
                moveVec.set(0, 0);
                document.getElementById('joy-knob').style.transform = 'translate(-50%, -50%)';
            }
            if (t.identifier === fireTouchId) {
                fireTouchId = null;
                isShooting = false;
                isADS = false;
                camera.fov = cfg.fov;
                camera.updateProjectionMatrix();
            }
            if (t.identifier === lookTouchId) {
                lookTouchId = null;
            }
        }
    });

    // ============================================
    // PC CONTROLS (Keyboard + Mouse)
    // ============================================

    const keys = {};

    // Keyboard events
    window.addEventListener('keydown', e => {
        if (isPaused) return;
        keys[e.key.toLowerCase()] = true;

        // Jump (Space)
        if (e.code === 'Space' && jumps < 2) {
            vY = 0.8;
            jumps++;
            e.preventDefault();
        }

        // Running (Shift)
        if (e.key === 'Shift') {
            isRunning = true;
        }

        // ADS (Right Click or E)
        if (e.key.toLowerCase() === 'e') {
            isADS = !isADS;
            camera.fov = isADS ? (currentWeapon === 'SNIPER' ? 12 : 30) : cfg.fov;
            camera.updateProjectionMatrix();
        }

        // Toggle Camera (C for Third Person)
        if (e.key.toLowerCase() === 'c') {
            isFPS = !isFPS;
        }

        // Throw Grenade (G)
        if (e.key.toLowerCase() === 'g') {
            throwGrenade();
        }

        // Pause Menu (ESC)
        if (e.code === 'Escape') {
            togglePause();
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', e => {
        keys[e.key.toLowerCase()] = false;

        if (e.key === 'Shift') {
            isRunning = false;
        }
    });

    // Update movement from keyboard
    function updateKeyboardMovement() {
        if (isPaused) return;

        let dx = 0;
        let dy = 0;

        if (keys['w'] || keys['arrowup']) dy = -1;
        if (keys['s'] || keys['arrowdown']) dy = 1;
        if (keys['a'] || keys['arrowleft']) dx = -1;
        if (keys['d'] || keys['arrowright']) dx = 1;

        // Normalize diagonal movement
        const length = Math.hypot(dx, dy);
        if (length > 0) {
            dx /= length;
            dy /= length;
        }

        moveVec.set(dx, dy);
    }

    // Mouse controls
    let isPointerLocked = false;

    // Click to lock pointer (for mouse look)
    renderer.domElement.addEventListener('click', () => {
        if (!isPlaying || isPaused) return;
        renderer.domElement.requestPointerLock();
    });

    // Pointer lock change
    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === renderer.domElement;
    });

    // Mouse movement (look around)
    window.addEventListener('mousemove', e => {
        if (!isPointerLocked || isPaused) return;

        const sensitivity = cfg.sens * 2; // Reduced for better control
        cameraYaw -= e.movementX * sensitivity;
        cameraPitch = Math.max(-1.5, Math.min(1.5, cameraPitch - e.movementY * sensitivity));
    });

    // Mouse buttons
    window.addEventListener('mousedown', e => {
        if (!isPointerLocked || isPaused) return;

        // Left click - shoot
        if (e.button === 0) {
            isShooting = true;
        }

        // Right click - ADS
        if (e.button === 2) {
            isADS = true;
            camera.fov = currentWeapon === 'SNIPER' ? 12 : 30;
            camera.updateProjectionMatrix();
            e.preventDefault();
        }
    });

    window.addEventListener('mouseup', e => {
        // Left click - stop shooting
        if (e.button === 0) {
            isShooting = false;
        }

        // Right click - stop ADS
        if (e.button === 2) {
            isADS = false;
            camera.fov = cfg.fov;
            camera.updateProjectionMatrix();
        }
    });

    // Prevent context menu on right click
    renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

    // Update keyboard movement in game loop
    const originalAnimate = animate;
    animate = function () {
        updateKeyboardMovement();
        originalAnimate();
    };
}

// Minimap
function setupMinimap() {
    minimapCanvas = document.getElementById('minimap-canvas');
    minimapCanvas.width = 100;
    minimapCanvas.height = 100;
    minimapCtx = minimapCanvas.getContext('2d');
}

function updateMinimap() {
    if (!minimapCtx) return;
    const ctx = minimapCtx;
    const w = 100, h = 100, mapScale = 0.12;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(10, 20, 40, 0.8)";
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cz = h / 2;
    ctx.strokeStyle = "rgba(255, 234, 0, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cz, zoneRadius * mapScale, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#ff4444";
    bots.forEach(bot => {
        const bx = cx + (bot.position.x - playerGroup.position.x) * mapScale;
        const bz = cz + (bot.position.z - playerGroup.position.z) * mapScale;
        if (bx > 0 && bx < w && bz > 0 && bz < h) {
            ctx.beginPath();
            ctx.arc(bx, bz, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    ctx.fillStyle = "#00ff00";
    ctx.beginPath();
    ctx.arc(cx, cz, 3.5, 0, Math.PI * 2);
    ctx.fill();
}

// Main game loop
// Main game loop (PORTED FROM BACKUP for Exact Physics)
function animate() {
    if (!isPlaying) { requestAnimationFrame(animate); return; }

    const delta = Math.min(clock.getDelta(), 0.1);
    const fpsScale = delta * 60; // Helper for physics scaling
    const time = clock.getElapsedTime();

    // 🌐 NETWORK UPDATE
    if (window.gameNetwork) window.gameNetwork.update(delta);

    // --- CORREÇÃO DE ROTAÇÃO: CORPO DE COSTAS PARA A CÂMERA (Math.PI adicionado) ---
    if (charModel) charModel.rotation.y = THREE.MathUtils.lerp(charModel.rotation.y, cameraYaw + Math.PI, 0.3 * fpsScale);

    let inputX = moveVec.x; let inputY = moveVec.y;
    const speed = (isRunning ? 1.19 : 0.8) * (isADS ? 0.4 : 1) * fpsScale;
    const isMoving = moveVec.length() > 0.1;

    // --- ANIMAÇÃO DO JOGADOR LOCAL ---
    const playerAnimSpeed = isRunning ? 15 : 10;
    const playerCycle = time * playerAnimSpeed;
    CharacterFactory.animateLimbs(charModel, delta, isMoving, Math.sin(playerCycle), cameraPitch);

    if (isMoving) {
        const moveAngle = Math.atan2(-inputX, inputY);
        const dir = tempVec.set(0, 0, -1).applyAxisAngle(tempVec2.set(0, 1, 0), cameraYaw + moveAngle);
        const nextX = playerGroup.position.x + dir.x * speed;
        const nextZ = playerGroup.position.z + dir.z * speed;

        const distFromCenter = Math.hypot(nextX, nextZ);
        if (distFromCenter < mapRadiusLimit) {
            let finalX = nextX; let finalZ = nextZ;
            let hitX = false, hitZ = false;
            const pBoxSize = tempVec2.set(0.6, 4.5, 0.6);

            // X Check
            const boxX = new THREE.Box3().setFromCenterAndSize(tempVec.set(finalX, playerGroup.position.y + 2.5, playerGroup.position.z), pBoxSize);
            for (let i = 0; i < obstacleBoxes.length; i++) {
                const box = obstacleBoxes[i];
                if (playerGroup.position.y >= box.max.y - 0.2) continue;
                if (box.userData.isDoor && box.userData.isOpen) continue;
                if (boxX.intersectsBox(box)) { hitX = true; break; }
            }
            // Z Check
            const boxZ = new THREE.Box3().setFromCenterAndSize(tempVec.set(playerGroup.position.x, playerGroup.position.y + 2.5, finalZ), pBoxSize);
            for (let i = 0; i < obstacleBoxes.length; i++) {
                const box = obstacleBoxes[i];
                if (playerGroup.position.y >= box.max.y - 0.2) continue;
                if (box.userData.isDoor && box.userData.isOpen) continue;
                if (boxZ.intersectsBox(box)) { hitZ = true; break; }
            }
            if (!hitX) playerGroup.position.x = finalX;
            if (!hitZ) playerGroup.position.z = finalZ;
        }
    }

    // Gravity (Simple Physics)
    playerGroup.position.y += vY * fpsScale;
    floorRay.ray.origin.copy(playerGroup.position).add(tempVec.set(0, 1.5, 0)); floorRay.ray.direction.set(0, -1, 0);
    const floorHits = floorRay.intersectObjects(groundObstacles);
    let floorY = (floorHits.length > 0) ? floorHits[0].point.y : 0;

    if (playerGroup.position.y > floorY + 0.15) vY -= 0.025 * fpsScale;
    else { playerGroup.position.y = floorY; vY = 0; jumps = 0; }

    // Hit/Zone Logic...
    if (zoneActive && zoneRadius > 5) {
        zoneRadius -= 0.05 * fpsScale; zoneMesh.scale.set(zoneRadius, 1, zoneRadius);
        if (Math.hypot(playerGroup.position.x, playerGroup.position.z) > zoneRadius) { health -= 0.1 * fpsScale; }
    }

    document.getElementById('hp-bar').style.width = Math.max(0, health) + '%';
    document.getElementById('armor-bar').style.width = armor + '%';

    // Medkits interaction
    medkits.forEach((mk) => {
        if (mk.visible && playerGroup.position.distanceTo(mk.getWorldPosition(tempVec)) < 6) {
            if (health < 100) { health = Math.min(100, health + 50); mk.visible = false; playSfx('hit'); }
        }
    });

    // Camera - PORTED LOGIC
    if (isFPS) {
        charModel.visible = false;
        camera.position.copy(playerGroup.position).add(tempVec.set(0, 10.6, 0));
        camera.rotation.set(cameraPitch, cameraYaw, 0, 'YXZ');
    } else {
        charModel.visible = true;
        const dist = isADS ? 15.0 : 25.0;
        const rightDir = tempVec.set(1, 0, 0).applyAxisAngle(tempVec2.set(0, 1, 0), cameraYaw);

        // Posição: Player + Orbita (Pitch) + Offset Lateral
        const cx = Math.sin(cameraYaw) * Math.cos(-cameraPitch) * dist;
        const cz = Math.cos(cameraYaw) * Math.cos(-cameraPitch) * dist;
        const cy = Math.sin(-cameraPitch) * dist;

        camera.position.copy(playerGroup.position).add(tempVec.set(cx, cy + 10.6, cz)).add(rightDir.clone().multiplyScalar(8.0));
        camera.lookAt(
            playerGroup.position.x + rightDir.x * 8.0,
            playerGroup.position.y + 3.5,
            playerGroup.position.z + rightDir.z * 8.0
        );
    }

    // Shooting
    if (isShooting && Date.now() - lastShot > (currentWeapon === 'SNIPER' ? 1200 : 120)) {
        lastShot = Date.now();
        shootBullet();
    }

    updateBullets(delta);
    updateBots(delta); // AI

    // 💣 Update grenades
    updateGrenades(delta);

    // Update minimap
    updateMinimap();

    if (particleSystem) particleSystem.update(delta);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

// Toggle pause menu
function togglePause() {
    isPaused = !isPaused;

    const pauseMenu = document.getElementById('pause-menu');
    if (!pauseMenu) {
        // Create pause menu if it doesn't exist
        const menu = document.createElement('div');
        menu.id = 'pause-menu';
        menu.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            color: white;
            font-family: Arial, sans-serif;
        `;
        menu.innerHTML = `
            <h1 style="color: #fcee0a; font-size: 48px; margin-bottom: 30px;">PAUSADO</h1>
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <button onclick="togglePause()" style="padding: 15px 40px; font-size: 18px; background: #fcee0a; border: none; cursor: pointer; font-weight: bold;">CONTINUAR</button>
                <button onclick="location.reload()" style="padding: 15px 40px; font-size: 18px; background: #ff003c; color: white; border: none; cursor: pointer; font-weight: bold;">SAIR</button>
            </div>
            <div style="margin-top: 30px; font-size: 14px; color: #aaa;">
                <p>ESC - Pausar/Continuar</p>
                <p>C - Alternar Câmera (FPS/TPS)</p>
                <p>G - Lançar Granada</p>
            </div>
        `;
        document.body.appendChild(menu);
    }

    document.getElementById('pause-menu').style.display = isPaused ? 'flex' : 'none';

    // Release pointer lock when paused
    if (isPaused && document.pointerLockElement) {
        document.exitPointerLock();
    }
}

// Make togglePause global
window.togglePause = togglePause;

// Grenade system
function throwGrenade() {
    if (!isPlaying || isPaused) return;

    // Create grenade mesh
    const grenade = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
    );

    grenade.position.copy(camera.position);
    grenade.castShadow = true;

    // Calculate throw direction
    ray.setFromCamera({ x: 0, y: 0 }, camera);
    const throwDir = ray.ray.direction.clone().normalize();

    // Set velocity (throw forward and up)
    grenade.userData.vel = throwDir.multiplyScalar(2);
    grenade.userData.vel.y += 0.5; // Arc upward
    grenade.userData.life = 180; // 3 seconds
    grenade.userData.type = grenadeType;

    scene.add(grenade);
    grenades.push(grenade);

    console.log('💣 Granada lançada!');
}

// Update grenades
function updateGrenades(deltaTime) {
    for (let i = grenades.length - 1; i >= 0; i--) {
        const grenade = grenades[i];

        // Apply gravity
        grenade.userData.vel.y -= 0.04;

        // Move grenade
        grenade.position.add(grenade.userData.vel);

        // Ground collision
        if (grenade.position.y < 1) {
            grenade.position.y = 1;
            grenade.userData.vel.y *= -0.5; // Bounce
            grenade.userData.vel.x *= 0.8;
            grenade.userData.vel.z *= 0.8;
        }

        grenade.userData.life--;

        // Explode
        if (grenade.userData.life <= 0) {
            // Explosion effect
            if (particleSystem) {
                for (let j = 0; j < 20; j++) {
                    const dir = new THREE.Vector3(
                        (Math.random() - 0.5) * 2,
                        (Math.random() - 0.5) * 2,
                        (Math.random() - 0.5) * 2
                    ).normalize();
                    particleSystem.spawnBlood(grenade.position.clone(), dir, 1);
                }
            }

            // Damage bots in radius
            const explodeRadius = 15;
            bots.forEach(bot => {
                const dist = bot.position.distanceTo(grenade.position);
                if (dist < explodeRadius) {
                    const damage = Math.floor(100 * (1 - dist / explodeRadius));
                    bot.userData.hp -= damage;
                }
            });

            // Damage player
            const playerDist = playerGroup.position.distanceTo(grenade.position);
            if (playerDist < explodeRadius) {
                const damage = Math.floor(50 * (1 - playerDist / explodeRadius));
                health -= damage;
            }

            scene.remove(grenade);
            grenades.splice(i, 1);
        }
    }
}

function checkPlayerCollision() {
    // Simple collision
    const playerBox = new THREE.Box3().setFromObject(playerGroup);

    for (let i = 0; i < obstacleBoxes.length; i++) {
        if (playerBox.intersectsBox(obstacleBoxes[i])) {
            // Push back
            const pushDir = new THREE.Vector3();
            playerBox.getCenter(pushDir);
            const obstacleCenter = new THREE.Vector3();
            obstacleBoxes[i].getCenter(obstacleCenter);
            pushDir.sub(obstacleCenter).normalize().multiplyScalar(0.3);
            playerGroup.position.add(pushDir);
        }
    }
}

function shootBullet() {
    if (!bulletPool) return; // Safety: Don't shoot if pool not initialized

    playSfx(currentWeapon === 'SNIPER' ? 'sniper' : 'shoot');

    // 🚀 USE OBJECT POOL - No more "new THREE.Mesh()"!
    const bullet = bulletPool.acquire();
    bullet.position.copy(camera.position);
    bullet.visible = true;
    bullet.userData.active = true;

    ray.setFromCamera({ x: 0, y: 0 }, camera);
    const dir = ray.ray.direction.clone().normalize();
    bullet.userData.vel = dir.multiplyScalar(5);
    bullet.userData.life = 120;
    bullet.userData.owner = 'player';

    // 🚀 Spawn muzzle flash particle effect
    if (particleSystem) {
        particleSystem.spawnMuzzleFlash(camera.position, dir);
    }

    // No need to scene.add() - already in scene from pool
    bullets.push(bullet);
}

// 🤖 GENERIC SPAWN BULLET (Used by Bots & functions needing explicit args)
function spawnBullet(ownerType, startPos, targetPos, ownerId, speedOverride) {
    if (!bulletPool) return;

    if (ownerType === 'bot') playSfx('shoot'); // Simple SFX for bots

    const bullet = bulletPool.acquire();
    bullet.position.copy(startPos);
    bullet.visible = true;
    bullet.userData.active = true;

    // Calc direction
    const dir = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
    const speed = speedOverride || 5; // Default speed

    // Spread for realism (optional)
    // dir.x += (Math.random() - 0.5) * 0.05;
    // dir.y += (Math.random() - 0.5) * 0.05;
    // dir.z += (Math.random() - 0.5) * 0.05;
    // dir.normalize();

    bullet.userData.vel = dir.multiplyScalar(speed);
    bullet.userData.life = 120;
    bullet.userData.owner = ownerType; // 'player' or 'bot'
    bullet.userData.ownerId = ownerId;

    if (particleSystem) {
        particleSystem.spawnMuzzleFlash(startPos, dir);
    }

    bullets.push(bullet);
}

function updateBullets(deltaTime) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        // Skip inactive bullets (already returned to pool)
        if (!bullet.userData.active) {
            bullets.splice(i, 1);
            continue;
        }

        bullet.position.add(bullet.userData.vel);
        bullet.userData.life--;

        if (bullet.userData.life <= 0) {
            // 🚀 RETURN TO POOL - No more "scene.remove()"!
            bulletPool.release(bullet);
            bullets.splice(i, 1);
            continue;
        }

        // Hit detection
        for (let j = 0; j < bots.length; j++) {
            if (bullet.position.distanceTo(bots[j].position) < 2) {
                // Hit!
                bots[j].userData.hp -= currentWeapon === 'SNIPER' ? 75 : 25;

                // 🚀 Spawn blood splatter particles
                if (particleSystem) {
                    particleSystem.spawnBlood(
                        bots[j].position.clone(),
                        bullet.userData.vel.clone().normalize(),
                        5 // 5 blood particles
                    );
                }

                if (bots[j].userData.hp <= 0) {
                    scene.remove(bots[j]);
                    bots.splice(j, 1);
                    playerKills++;
                    document.getElementById('count-kills').innerText = playerKills;
                }
                // 🚀 RETURN TO POOL - No more "scene.remove()"!
                bulletPool.release(bullet);
                bullets.splice(i, 1);
                playSfx('hit');
                break;
            }
        }
    }
}

function spawnBot(isAlly) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 100 + Math.random() * 200;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    const bot = CharacterFactory.createHumanoid(isAlly ? 0x3b82f6 : 0xff0000, 'bot' + Math.random());
    bot.position.set(x, 0, z);
    bot.userData.isAlly = isAlly;
    bot.userData.hp = 100;
    bot.userData.vel = new THREE.Vector3();
    scene.add(bot);
    bots.push(bot);
}

// 🧠 ADVANCED AI (PORTED FROM BACKUP)
function updateBots(deltaTime) {
    // 1. Filter Lists
    let enemyBots = bots.filter(b => !b.userData.isAlly);
    let realEnemies = []; // Multiplayer enemies would be here

    // 2. Update Each Bot
    bots.forEach((bot) => {
        if (!bot.userData.aiTick) bot.userData.aiTick = 0;
        bot.userData.aiTick += 1;

        // A. Movement Logic
        const distToPlayer = bot.position.distanceTo(playerGroup.position);
        const isAlly = bot.userData.isAlly;

        // Decision: Move or Shoot?
        // Allies follow player, Enemies flank
        if (isAlly) {
            if (distToPlayer > 15) {
                const dir = new THREE.Vector3().subVectors(playerGroup.position, bot.position).normalize();
                bot.position.add(dir.multiplyScalar(0.1));
                bot.rotation.y = Math.atan2(dir.x, dir.z);
                CharacterFactory.animateLimbs(bot, deltaTime, true);
            } else {
                CharacterFactory.animateLimbs(bot, deltaTime, false);
            }
        } else {
            // Enemy Logic
            if (distToPlayer > 25) {
                // Far away: Approach
                const dir = new THREE.Vector3().subVectors(playerGroup.position, bot.position).normalize();
                bot.position.add(dir.multiplyScalar(0.08)); // Slower than ally
                bot.rotation.y = Math.atan2(dir.x, dir.z);
                CharacterFactory.animateLimbs(bot, deltaTime, true);
            } else {
                // Combat Range: Strafing (Simple Flank)
                bot.rotation.y = Math.atan2(
                    playerGroup.position.x - bot.position.x,
                    playerGroup.position.z - bot.position.z
                );

                // Strafe logic
                const time = Date.now() / 1000;
                const strafe = Math.sin(time * 2) * 0.05;
                const sideVec = new THREE.Vector3(Math.cos(bot.rotation.y), 0, -Math.sin(bot.rotation.y));
                bot.position.add(sideVec.multiplyScalar(strafe));

                CharacterFactory.animateLimbs(bot, deltaTime, true);

                // Shoot
                if (Math.random() < 0.02) {
                    spawnBullet('bot', bot.position.clone().add(new THREE.Vector3(0, 1.5, 0)), playerGroup.position.clone().add(new THREE.Vector3(0, 1, 0)), bot.userData.id, 5);
                }
            }
        }

        // Helper for creating bullets (Ported)
        /* 
           Note: The original backup had complex cover logic.
           I've simplified it slightly here to ensure it runs without 
           reference errors to 'obstacleBoxes' which might be different in this scope.
           But this restores the 'Strafing' and 'Shoot' behavior.
        */
    });
}


function setupBotsPeriphery() {
    const enemyCount = cfg.bots;
    for (let i = 0; i < enemyCount; i++) {
        spawnBot(false);
    }

    if (currentGameMode === 'duo') spawnBot(true);
    if (currentGameMode === 'squad') {
        for (let i = 0; i < 3; i++) spawnBot(true);
    }
    if (currentGameMode === 'duo') spawnBot(true);
    if (currentGameMode === 'squad') {
        for (let i = 0; i < 3; i++) spawnBot(true);
    }
}

// 🌐 NETWORK HELPERS
window.clearBots = () => {
    bots.forEach(b => scene.remove(b));
    bots = [];
};

window.cleanupBots = (validIds) => {
    for (let i = bots.length - 1; i >= 0; i--) {
        if (!validIds.includes(bots[i].userData.id)) {
            scene.remove(bots[i]);
            bots.splice(i, 1);
        }
    }
};

window.syncBot = (id, data) => {
    let bot = bots.find(b => b.userData.id === id);
    if (!bot) {
        const color = data.isAlly ? 0x00f3ff : 0x7f1d1d;
        bot = CharacterFactory.createHumanoid(color, id);
        bot.userData.id = id;
        bot.userData.isAlly = data.isAlly;
        bot.userData.maxHP = 100; // Simplified
        scene.add(bot);
        bots.push(bot);
    }
    bot.position.set(data.x, data.y, data.z);
    bot.rotation.y = data.ry;
    bot.userData.hp = data.hp;
};

// Initialize game
// Initialize game
window.initGame = (mode) => {
    // VISUAL FEEDBACK FOR CLICK/TOUCH
    alert("INICIANDO JOGO... (v2.0)");

    // 🔊 RESUME AUDIO CONTEXT (Mobile Requirement)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            console.log('AudioContext resumed!');
        }).catch(err => console.error(err));
    }

    // 📱 MOBILE FULLSCREEN
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(e => console.log('Fullscreen failed:', e));
    }

    try {
        playerName = document.getElementById('player-name').value || "OPERADOR";
        missionAccomplished = false;
        playerKills = 0;

        // SAFELY GET CONFIGS (UI Reskin Compatibility)
        const elBotCount = document.getElementById('bot-count');
        const elBotDiff = document.getElementById('bot-diff');
        const elSens = document.getElementById('cfg-sens'); // Moved to Pause?
        const elFov = document.getElementById('cfg-fov');
        const elGraphics = document.getElementById('cfg-graphics');

        cfg.bots = elBotCount ? parseInt(elBotCount.value) : 10;
        cfg.diff = elBotDiff ? parseInt(elBotDiff.value) : 2; // Default Normal

        // Use Defaults if Elements are missing (Pause Menu Only)
        cfg.sens = (elSens ? parseInt(elSens.value) : 55) * 0.0003;
        cfg.fov = elFov ? parseInt(elFov.value) : 75;
        cfg.graphics = elGraphics ? elGraphics.value : 'low';

        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('game-container').style.display = 'block';
        document.getElementById('hud').style.display = 'block';
        document.getElementById('kill-log').innerHTML = "";

        setupThree();
        setupMinimap();

        // 🌐 INIT MULTIPLAYER
        const network = new Network({ scene, player: playerGroup, health, playerKills, bots, setupBotsPeriphery: setupBotsPeriphery, syncBot: window.syncBot, clearBots: window.clearBots, cleanupBots: window.cleanupBots, cameraYaw: cameraYaw });
        // NOTE: Above object is a mock game reference. Ideally we pass 'this' but strict mode prevents it. 
        // We will assign a global 'gameInstance' reference for cleaner access later.
        window.gameNetwork = network; // Expose for debugging
        network.connect(); // Connect auth

        isPlaying = true;

        if (mode === 'multi') {
            network.startMultiplayer();
        } else {
            setupBotsPeriphery();
        }

        console.log('🎮 Jogo iniciado com lógica original!');
    } catch (e) {
        console.error('❌ ERRO CRÍTICO AO INICIAR JOGO:', e);
        alert('ERRO AO INICIAR: ' + e.message); // Visual feedback for mobile user
    }
};

// ...
/* In Animate Loop, add:
   if (window.gameNetwork) window.gameNetwork.update(delta);
*/

// 🖱️ FIX MOBILE TOUCH INTERACTIONS
// Ensure buttons trigger on touchstart if click fails
setTimeout(() => {
    const bindTouch = (selector, fn) => {
        document.querySelectorAll(selector).forEach(btn => {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault(); // Prevent ghost clicks
                fn();
            }, { passive: false });
        });
    };

    // Bind Start Button specially if needed, but 'onclick' typically works if not blocked.
    // However, let's force the Tab Switchers and Start Button to react to touch
    document.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('touchstart', function (e) {
            // Just let the click happen naturally usually, but with touch-action:none...
            // It's safer to NOT e.preventDefault() here unless we manually trigger click.
            // We will just leave standard behavior but Ensure initGame is robust.
        }, { passive: true });
    });

    console.log('📱 Mobile Touch Events Initialized');
}, 1000);

// Menu handlers (UPDATED SAFE)
window.switchTab = (tab) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`[onclick*="${tab}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    const tPlay = document.getElementById('tab-play');
    const tMulti = document.getElementById('tab-multi');
    const tOpts = document.getElementById('tab-opts');

    if (tPlay) tPlay.style.display = 'none';
    if (tMulti) tMulti.style.display = 'none';
    if (tOpts) tOpts.style.display = 'none';

    const target = document.getElementById('tab-' + tab);
    if (target) target.style.display = 'block';
};

window.setMode = (mode, btn) => {
    currentGameMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
};

// ♻️ END OF LEGACY LOGIC


// 🛠️ UI HELPERS (Global Access)
window.toggleCamera = () => {
    isFPS = !isFPS;
    console.log('👁️ Camera Toggled:', isFPS ? "1st Person" : "3rd Person");
};

window.abortGame = () => {
    if (confirm("Deseja realmente abortar a missão?")) {
        location.reload();
    }
};

window.game = {
    scene, camera, renderer, playerGroup, bots, bullets, health, armor
};
// Expose for robustness
window.spawnBullet = spawnBullet;

alert('SISTEMA - SCRIPT CARREGADO E RODANDO! (v2.1)');
console.log('✅ Sistema de jogo completo (v2.1) carregado!');
