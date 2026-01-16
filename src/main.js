import { Game } from './core/Game.js';
import { CharacterFactory } from './entities/CharacterFactory.js';
import { ObjectPool } from './utils/ObjectPool.js';
import { ParticleSystem } from './systems/Particle.js';
import { Network } from './systems/Network.js'; // 🌐 PORTED MULTIPLAYER
import { openHudEditor, initHudEditor, loadHudLayout } from './ui/HudEditor.js'; // HUD customization
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * GameLegacy - Integra TODA a lógica original do jogo
    * Este arquivo conecta a nova arquitetura modular com o código original
        */

// 🌍 EXPOSE FACTORY FOR NETWORK
window.createHumanoid = (color, id) => CharacterFactory.createHumanoid(color, id);

console.log(`
╔═══════════════════════════════════════════════════╗
║   RESIDENCIAL CANAÃ - TACTICAL SURVIVAL           ║
║   Com lógica original + Arquitetura otimizada     ║
╚═══════════════════════════════════════════════════╝
`);

// Variáveis globais do jogo original
let scene, camera, renderer, clock, playerGroup, charModel, zoneMesh, sunObj;
let cameraYaw = 0, cameraPitch = 0, vY = 0, jumps = 0;
let isPlaying = false, isPaused = false, isRunning = false, isADS = false, isShooting = false, isFPS = false, isMultiplayer = false;
let currentWeapon = 'AR', grenadeType = 'explosive', currentGameMode = 'solo';
let bullets = [], bots = [], obstacles = [], obstacleBoxes = [], grenades = [], effects = [], medkits = [];
let otherPlayers = {}; // 🌐 Multiplayer peers
let health = 100, armor = 100, lastShot = 0, lastDamageTime = 0, playerKills = 0;
let particleSystem = null; // 🚀 Particle system for blood and effects
let zoneRadius = 500, zoneActive = false;
let initialBotCount = 10, houseData = [];
let playerName = "SOLDADO";
let mapRadiusLimit = 1050;
let missionAccomplished = false;
let initialBotsSpawned = false; // Logic Restore
let matchStartTime = 0; // Logic Restore
let solidObstacles = [], groundObstacles = [];
let minimapCtx, minimapCanvas;
let moveVec = new THREE.Vector2(), keyMoveVec = new THREE.Vector2(); // Separated inputs
let moveTouchId = null, lookTouchId = null, fireTouchId = null;
let lastX = 0, lastY = 0, fireLastX = 0, fireLastY = 0;
// isEditingHud removed (using window.isEditingHud)
let cfg = { bots: 10, diff: 2, sens: 0.0165, fov: 75, graphics: 'low' };

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
    // FIX: visible:false objects are ignored by Raycaster by default. Use transparent/opacity 0 instead.
    const invisibleMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }); // FÍSICA INVISÍVEL

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

    // 🖥️ RESIZE HANDLER (Fix for Fullscreen/Orientation issues)
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

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
    playerGroup.position.set(100, 100, 100); // Safe Spawn High Up

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

    console.log(`📦 Collision Boxes Generated: ${obstacleBoxes.length}`);
    setInterval(() => {
        if (isPlaying && !isPaused) {
            console.log(`📍 Pos: ${playerGroup.position.x.toFixed(1)}, ${playerGroup.position.y.toFixed(1)}, ${playerGroup.position.z.toFixed(1)} | vY: ${vY.toFixed(2)} | Ground: ${groundObstacles.length}`);
        }
    }, 2000);

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
        if (window.isEditingHud || isPaused) return;
        for (let t of e.changedTouches) {
            // DYNAMIC JOYSTICK LOGIC
            // Only trigger if on left half and NOT on a hud element
            const isLeftHalf = t.clientX < window.innerWidth / 2;
            const isHudButton = t.target.classList.contains('hud-el');

            if (isLeftHalf && !isHudButton && moveTouchId === null) {
                moveTouchId = t.identifier;

                // Position Joystick at touch point
                const zone = document.getElementById('joy-zone');
                const knob = document.getElementById('joy-knob');

                zone.style.display = 'block';
                zone.style.left = (t.clientX - 70) + 'px'; // Center 140px zone
                zone.style.top = (t.clientY - 70) + 'px';

                knob.style.transform = 'translate(-50%, -50%)';
                moveVec.set(0, 0);
            }
            // Fire/Look Logic
            else if (t.target.closest('#btn-fire-ads')) { fireTouchId = t.identifier; fireLastX = t.clientX; fireLastY = t.clientY; isShooting = true; isADS = true; camera.fov = currentWeapon === 'SNIPER' ? 12 : 30; camera.updateProjectionMatrix(); if (currentWeapon === 'SNIPER') document.getElementById('sniper-scope').style.display = 'block'; }
            else if (t.target.closest('#btn-fire-hip')) { fireTouchId = t.identifier; fireLastX = t.clientX; fireLastY = t.clientY; isShooting = true; isADS = false; camera.fov = cfg.fov; camera.updateProjectionMatrix(); }
            else if (!t.target.classList.contains('hud-el')) {
                // INTERAÇÃO DE TOQUE (TIRO OU PORTA)
                ray.setFromCamera({ x: (t.clientX / window.innerWidth) * 2 - 1, y: -(t.clientY / window.innerHeight) * 2 + 1 }, camera);
                const doorHits = ray.intersectObjects(obstacles);
                let hitDoor = false;
                for (let hit of doorHits) {
                    if (hit.object.userData.isDoor && hit.distance < 20) {
                        hit.object.userData.isOpen = !hit.object.userData.isOpen;
                        // Animação simples (Teleporte para cima)
                        if (hit.object.userData.isOpen) hit.object.position.y += 3;
                        else hit.object.position.y -= 3;
                        playSfx('hit'); // Som de feedback
                        hitDoor = true;
                        break;
                    }
                }
                if (!hitDoor) {
                    lookTouchId = t.identifier; lastX = t.clientX; lastY = t.clientY;
                }
            }
        }
    }, { passive: false });

    document.querySelectorAll('.hud-el').forEach(el => {
        el.addEventListener('pointerdown', e => {
            if (window.isEditingHud) return;
            if (el.id === 'btn-jump') { if (!isPaused && jumps < 2) { vY = 0.8; jumps++; } }
            if (el.id === 'btn-ads') { if (!isPaused) { isADS = true; camera.fov = currentWeapon === 'SNIPER' ? 12 : 30; camera.updateProjectionMatrix(); if (currentWeapon === 'SNIPER') document.getElementById('sniper-scope').style.display = 'block'; } }
            if (el.id === 'btn-nade') { throwGrenade(); }
            if (el.id === 'btn-run') { isRunning = !isRunning; el.classList.toggle('active', isRunning); }
            if (el.id === 'btn-medkit') { useMedkit(); }
            if (el.id === 'btn-settings') { togglePauseMenu(); }
            if (el.id === 'btn-eye') { isFPS = !isFPS; }
            if (el.id === 'btn-swap-nade') { grenadeType = (grenadeType === 'explosive' ? 'smoke' : 'explosive'); el.innerHTML = `BOMBA<br>(${grenadeType === 'explosive' ? 'EXPL' : 'FUMA'})`; }
            if (el.id === 'btn-switch-weapon') { currentWeapon = currentWeapon === 'AR' ? 'SNIPER' : 'AR'; el.innerHTML = `ARMA<br>(${currentWeapon === 'AR' ? 'FUSIL' : 'SNIPER'})`; }
        });
        el.addEventListener('pointerup', e => { if (window.isEditingHud) return; if (el.id === 'btn-ads') { isADS = false; camera.fov = cfg.fov; camera.updateProjectionMatrix(); document.getElementById('sniper-scope').style.display = 'none'; } });
    });

    window.addEventListener('touchmove', e => {
        if (window.isEditingHud || isPaused) return;
        for (let t of e.changedTouches) {
            if (t.identifier === moveTouchId) {
                const zone = document.getElementById('joy-zone');
                // Calculate from center of the DYNAMIC zone position
                const rect = zone.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                let dx = t.clientX - centerX;
                let dy = t.clientY - centerY;
                const d = Math.hypot(dx, dy);
                const maxRad = 65;

                if (d > maxRad) {
                    dx *= maxRad / d;
                    dy *= maxRad / d;
                }

                document.getElementById('joy-knob').style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                // Normalize speed (0 to 1)
                moveVec.set(dx / maxRad, -dy / maxRad);
            }
            if (t.identifier === fireTouchId) { cameraYaw -= (t.clientX - fireLastX) * cfg.sens * 0.8; cameraPitch = Math.max(-1.5, Math.min(1.5, cameraPitch - (t.clientY - fireLastY) * cfg.sens * 1.2)); fireLastX = t.clientX; fireLastY = t.clientY; }
            if (t.identifier === lookTouchId) { cameraYaw -= (t.clientX - lastX) * cfg.sens; cameraPitch = Math.max(-1.5, Math.min(1.5, cameraPitch - (t.clientY - lastY) * cfg.sens)); lastX = t.clientX; lastY = t.clientY; }
        }
    }, { passive: false });

    window.addEventListener('touchend', e => {
        for (let t of e.changedTouches) {
            if (t.identifier === moveTouchId) {
                moveTouchId = null;
                moveVec.set(0, 0);
                // Hide or Reset Joystick
                document.getElementById('joy-zone').style.display = 'none';
                document.getElementById('joy-knob').style.transform = 'translate(-50%, -50%)';
            } if (t.identifier === fireTouchId) { fireTouchId = null; isShooting = false; isADS = false; camera.fov = cfg.fov; camera.updateProjectionMatrix(); document.getElementById('sniper-scope').style.display = 'none'; } if (t.identifier === lookTouchId) lookTouchId = null;
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

        keyMoveVec.set(dx, dy); // Use separate vector
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

    // Combine Touch + Keyboard Input
    let inputX = moveVec.x + keyMoveVec.x;
    let inputY = moveVec.y + keyMoveVec.y;

    // Clamp magnitude to 1.0 to prevent double speed
    const currentLen = Math.hypot(inputX, inputY);
    if (currentLen > 1) { inputX /= currentLen; inputY /= currentLen; }

    // Use COMBINED input for moving check
    const isMoving = Math.hypot(inputX, inputY) > 0.1;

    // Debug for User
    if (window._debugMode) {
        console.log(`Input: ${inputX.toFixed(2)}, ${inputY.toFixed(2)} | Moving? ${isMoving}`);
    }

    // --- ANIMAÇÃO DO JOGADOR LOCAL ---
    const playerAnimSpeed = isRunning ? 15 : 10;
    const playerCycle = time * playerAnimSpeed;

    // 🌍 GRAVITY & FLOOR DETECTION (Moved up to fix ReferenceError)
    floorRay.ray.origin.copy(playerGroup.position).add(tempVec.set(0, 1.5, 0)); floorRay.ray.direction.set(0, -1, 0);
    const floorHits = floorRay.intersectObjects(groundObstacles);
    let floorY = (floorHits.length > 0) ? floorHits[0].point.y : 0;

    // Gravity Application
    playerGroup.position.y += vY * fpsScale;
    if (playerGroup.position.y > floorY + 0.15) vY -= 0.025 * fpsScale;
    else { playerGroup.position.y = floorY; vY = 0; jumps = 0; }

    // 🏃 MOVEMENT SPEED CALCULATION
    // Original values from backup: Run=1.19, Walk=0.8, ADS=40%
    // UPDATED: Walk=0.7 (was 0.45), Sprint=1.9 (was 1.35) - Faster Player
    const speed = (isRunning ? 1.9 : 0.7) * (isADS ? 0.5 : 1) * fpsScale;
    // NOTE: Lowered values slightly for new scale, verified 1.19 was too fast for 0.1 step



    // Jump Detection
    const isInAir = (playerGroup.position.y - floorY) > 0.5;

    // Pass isInAir as 4th argument (replacing unused 'angle')
    CharacterFactory.animateLimbs(charModel, delta, isMoving, isInAir, cameraPitch);

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
                if (boxX.intersectsBox(box)) {
                    hitX = true;
                    break;
                }
            }
            // Z Check
            const boxZ = new THREE.Box3().setFromCenterAndSize(tempVec.set(playerGroup.position.x, playerGroup.position.y + 2.5, finalZ), pBoxSize);
            for (let i = 0; i < obstacleBoxes.length; i++) {
                const box = obstacleBoxes[i];
                if (playerGroup.position.y >= box.max.y - 0.2) continue;
                if (box.userData.isDoor && box.userData.isOpen) continue;
                if (boxZ.intersectsBox(box)) {
                    hitZ = true;
                    break;
                }
            }
            if (!hitX) playerGroup.position.x = finalX;
            if (!hitZ) playerGroup.position.z = finalZ;
        }
    }

    // Gravity (Simple Physics) - MOVED UP
    // Logic was moved to line ~740 to support animation and physics consistency

    // Hit/Zone Logic...
    if (zoneActive && zoneRadius > 5) {
        zoneRadius -= 0.05 * fpsScale; zoneMesh.scale.set(zoneRadius, 1, zoneRadius);
        if (Math.hypot(playerGroup.position.x, playerGroup.position.z) > zoneRadius) { health -= 0.1 * fpsScale; }
    }

    document.getElementById('hp-bar').style.width = Math.max(0, health) + '%';
    document.getElementById('armor-bar').style.width = armor + '%';

    // --- GRENADES PHYSICS & EFFECTS ---
    for (let i = grenades.length - 1; i >= 0; i--) {
        const g = grenades[i];
        if (!g.userData.hasStopped) {
            const moveDelta = tempVec.copy(g.userData.vel).multiplyScalar(fpsScale);
            const nextPos = tempVec2.copy(g.position).add(moveDelta);

            ray.ray.origin.copy(g.position);
            ray.ray.direction.copy(g.userData.vel).normalize();
            ray.far = moveDelta.length() + 0.6;
            const hits = ray.intersectObjects(solidObstacles);

            if (hits.length > 0) {
                g.userData.hasStopped = true;
                g.userData.vel.set(0, 0, 0);
                g.position.copy(hits[0].point).add(hits[0].face.normal.multiplyScalar(0.4));
            } else {
                g.position.copy(nextPos);
                g.userData.vel.y -= 0.025 * fpsScale; // Gravity
            }
            if (g.position.y < 0.25) {
                g.userData.hasStopped = true;
                g.userData.vel.set(0, 0, 0);
                g.position.y = 0.25;
            }
        }
        g.userData.life -= 1 * fpsScale;

        // DETONATION
        if (g.userData.life <= 0) {
            if (g.userData.type === 'explosive') {
                playSfx('exp');
                // Explosion particles
                for (let k = 0; k < 15; k++) {
                    const p = new THREE.Mesh(new THREE.SphereGeometry(1.2, 4, 4), new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.9 }));
                    p.position.copy(g.position).add(tempVec.set((Math.random() - 0.5) * 5, Math.random() * 3, (Math.random() - 0.5) * 5));
                    scene.add(p);
                    effects.push({ m: p, l: 45, type: 'explosion' });
                }
                // Damage Logic
                // Damage Logic
                bots.forEach(b => {
                    const dist = b.position.distanceTo(g.position);
                    if (dist < 60) { // Increased from 30 to 60 for better hit detection
                        // Apply damage based on distance
                        const dmg = 250 * (1 - dist / 60);
                        if (g.userData.owner !== 'player' || !b.userData.isAlly) {
                            b.userData.hp -= dmg;
                            if (b.userData.hp <= 0 && b.userData.active && g.userData.owner === 'player') {
                                playerKills++;
                                document.getElementById('count-kills').innerText = playerKills;
                                scene.remove(b);
                                b.userData.active = false; // Mark as inactive so splice removes it next frame
                            }
                        }
                    }
                });
                if (g.position.distanceTo(playerGroup.position) < 25 && g.userData.owner !== 'player') {
                    health -= 30 * fpsScale; lastDamageTime = time;
                }
            } else {
                // SMOKE GRENADE
                for (let j = 0; j < 15; j++) {
                    const smk = new THREE.Mesh(new THREE.SphereGeometry(12, 8, 8), new THREE.MeshStandardMaterial({ color: 0x999999, transparent: true, opacity: 0.8 }));
                    smk.position.copy(g.position).add(tempVec.set((Math.random() - 0.5) * 20, Math.random() * 10, (Math.random() - 0.5) * 20));
                    scene.add(smk);
                    effects.push({ m: smk, l: 400, type: 'smoke' });
                }
            }
            scene.remove(g);
            grenades.splice(i, 1);
        }
    }

    // --- EFFECTS UPDATE (Smoke / Explosion) ---
    for (let i = effects.length - 1; i >= 0; i--) {
        const ef = effects[i];
        if (ef.type === 'explosion') {
            ef.m.scale.multiplyScalar(1 + (0.08 * fpsScale));
            ef.m.material.opacity *= (1 - (0.1 * fpsScale));
        }
        if (ef.type === 'smoke') {
            ef.m.scale.multiplyScalar(1 + (0.002 * fpsScale));
            ef.m.material.opacity *= (1 - (0.002 * fpsScale));
        }
        if (ef.l !== undefined) {
            ef.l -= 1 * fpsScale;
            if (ef.l <= 0) { scene.remove(ef.m); effects.splice(i, 1); }
        }
    }

    // Medkits interaction
    medkits.forEach((mk) => {
        if (mk.visible && playerGroup.position.distanceTo(mk.getWorldPosition(tempVec)) < 6) {
            if (health < 100) { health = Math.min(100, health + 50); mk.visible = false; playSfx('hit'); }
        }
    });

    // Camera - PORTED LOGIC (WITH CLAMP FIX)
    if (isFPS || (isADS && currentWeapon === 'SNIPER')) {
        charModel.visible = false;
        // CORREÇÃO ALTURA DA MIRA FPS 5.3
        camera.position.copy(playerGroup.position).add(tempVec.set(0, 5.3, 0));
        camera.rotation.set(cameraPitch, cameraYaw, 0, 'YXZ');
    } else {
        charModel.visible = true;
        const dist = isADS ? 10.0 : 16.0;
        const orbitY = Math.sin(-cameraPitch) * dist;
        const orbitXZ = Math.cos(-cameraPitch) * dist;
        const rightDir = tempVec.set(1, 0, 0).applyAxisAngle(tempVec2.set(0, 1, 0), cameraYaw);
        // CORREÇÃO ALTURA DA MIRA TPS 5.3
        camera.position.copy(playerGroup.position).add(tempVec2.set(Math.sin(cameraYaw) * orbitXZ, Math.max(1.0, 5.3 + orbitY), Math.cos(cameraYaw) * orbitXZ).add(rightDir.clone().multiplyScalar(3.0)));
        camera.lookAt(playerGroup.position.x + rightDir.x * 3, playerGroup.position.y + 5.3, playerGroup.position.z + rightDir.z * 3);
    }

    // Shooting
    if (isShooting && Date.now() - lastShot > (currentWeapon === 'SNIPER' ? 1200 : 120)) {
        lastShot = Date.now();
        shootBullet();
    }

    // 🔫 BULLET PHYSICS & COLLISION
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        const moveStep = tempVec.copy(b.userData.vel).multiplyScalar(fpsScale);
        const prevPos = b.position.clone();

        ray.ray.origin.copy(prevPos);
        ray.ray.direction.copy(b.userData.vel).normalize();
        ray.far = moveStep.length();
        const wallHits = ray.intersectObjects(solidObstacles);

        b.position.add(moveStep);

        // Wall Collision
        if (wallHits.length > 0) {
            // Spawn impact particle if needed
            // scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.5), new THREE.MeshBasicMaterial({color:0xff0000})).position.copy(wallHits[0].point)); // DEBUG IMPACT
            scene.remove(b);
            if (b.userData.active && bulletPool) bulletPool.release(b); // Return to pool
            else bullets.splice(i, 1); // Fallback
            continue;
        }

        // Target Collision (Bots)
        let hitTarget = false;
        if (b.userData.owner === 'player') {
            for (let bot of bots) {
                if (bot.userData.hp <= 0) continue;
                // INCREASED HITBOX: Was 1.0, User requested fix. Increased to 3.5 (Generous)
                if (Math.abs(b.position.y - bot.position.y - 1.5) < 3.0 && b.position.distanceTo(bot.position) < 3.5) {
                    bot.userData.hp -= b.userData.damage || 30;
                    bot.userData.isAlerted = true;
                    triggerHitmarker();
                    hitTarget = true;

                    // Visual Feedack
                    if (particleSystem) {
                        particleSystem.spawnBlood(bot.position.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3(0, 1, 0), 5);
                    }

                    if (bot.userData.hp <= 0) {
                        // Kill Logic
                        scene.remove(bot);
                        // Remove from bots array logic is handled in udpateBots usually, but bullet loop needs to handle kill count
                        // Better to just set HP to 0 and let updateBots clean up?
                        // updateBots cleans up? Let's check.
                        // Actually updateBots logic currently doesn't remove instantly?
                        // Let's rely on updateBots to remove or remove here.
                        playerKills++;
                        document.getElementById('count-kills').innerText = playerKills;
                        scene.remove(bot); // Remove visual immediately
                    }
                    break;
                }
            }
        }

        // Remove if too old or hit
        if (hitTarget) {
            scene.remove(b);
            if (b.userData.active && bulletPool) bulletPool.release(b);
            else bullets.splice(i, 1);
            continue;
        }

        b.userData.life -= 1 * fpsScale;
        if (b.userData.life <= 0) {
            scene.remove(b);
            if (b.userData.active && bulletPool) bulletPool.release(b);
            else bullets.splice(i, 1);
        }
    }

    // --- GAME LOOP LOGIC RESTORED ---
    // 1. Armor Regen
    if (time - lastDamageTime > 6 && armor < 100) armor = Math.min(100, armor + 0.15 * fpsScale);

    // 2. Zone UI & Spawn Protection
    if (zoneActive && zoneRadius > 5) {
        const isSpawnProtected = (Date.now() - matchStartTime < 10000);
        document.getElementById('timer-display').innerText = isSpawnProtected ? `SPAWN PROTECTED` : `ZONA EM MOVIMENTO`;
    }

    // 3. Win Condition & Bot Count Update
    let enemyBots = bots.filter(b => !b.userData.isAlly);
    let alliedBots = bots.filter(b => b.userData.isAlly);

    // Check if bots were spawned at least once
    if (isPlaying && bots.length > 0 && !initialBotsSpawned) initialBotsSpawned = true;

    // Update Counts
    const elEnemies = document.getElementById('count-alive');
    const elAllies = document.getElementById('count-allies');
    if (elEnemies) elEnemies.innerText = enemyBots.length;
    if (elAllies) elAllies.innerText = alliedBots.length;

    // Mission Accomplished Check
    // Mission Accomplished Check
    // Check if ALL enemies are dead (and we had some to begin with)
    if (!isMultiplayer && isPlaying && initialBotsSpawned && time > 3 && health > 0) {
        // Recalculate alive enemies just to be sure
        const livingEnemies = bots.filter(b => !b.userData.isAlly && b.userData.hp > 0).length;
        if (livingEnemies === 0 && initialBotCount > 0) {
            showMsg("MISSÃO CUMPRIDA", "Ameaças eliminadas. Operação bem-sucedida!");
        }
    }

    // Game Over Check (Implicitly handled by showMsg called when dead, but backup adds a check here?)
    // Backup doesn't have explicit game over check in animate, it relies on health <= 0 somewhere.
    // Let's add explicit check if we die
    if (isPlaying && health <= 0) {
        showMsg("ELIMINADO", "Você foi abatido em combate.");
    }

    updateBots(delta); // AI

    // Update minimap
    updateMinimap();

    if (particleSystem) particleSystem.update(delta);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

// Toggle pause menu
window.togglePause = function () {
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
// [Legacy grenade logic removed to avoid conflict with restored backup logic]

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
            // Fix Hitbox: Check distance to CENTER of bot (height 2.0), not feet (0.0)
            const botCenter = bots[j].position.clone().add(new THREE.Vector3(0, 2.0, 0));
            // Increased radius slightly for easier hits (2 -> 3)
            if (bullet.position.distanceTo(botCenter) < 3.0) {
                // Hit!
                let damage = currentWeapon === 'SNIPER' ? 75 : 25;

                // 🤯 HEADSHOT CHECK
                // If bullet is high relative to bot feet
                const isHeadshot = (bullet.position.y - bots[j].position.y) > 1.6;
                if (isHeadshot) {
                    damage *= 2;
                    playSfx('hit'); // Double sound for feedback?
                    // Ideally show "HEADSHOT" UI or separate hitmarker sound
                }

                bots[j].userData.hp -= damage;

                // 🚀 Spawn blood splatter particles
                if (particleSystem) {
                    particleSystem.spawnBlood(
                        bots[j].position.clone().add(new THREE.Vector3(0, isHeadshot ? 1.7 : 1.2, 0)),
                        bullet.userData.vel.clone().normalize(),
                        isHeadshot ? 8 : 4
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
    // 🌐 CLIENT SYNC: Helper to request spawn from Leader
    if (window.gameNetwork && window.gameNetwork.isMultiplayer && !window.gameNetwork.isLeader) {
        window.gameNetwork.requestSpawnBot(isAlly);
        return;
    }

    const angle = Math.random() * Math.PI * 2;
    const dist = 100 + Math.random() * 200;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    const bot = CharacterFactory.createHumanoid(isAlly ? 0x3b82f6 : 0xff0000, 'bot' + Math.random());
    bot.position.set(x, 0, z);
    bot.userData.isAlly = isAlly;
    bot.userData.hp = 100;
    bot.userData.maxHP = 100;
    bot.userData.vel = new THREE.Vector3();
    bot.userData.lastKnownPos = new THREE.Vector3(x, 0, z); // Fix for crash at line 1306
    bot.userData.targetPos = new THREE.Vector3(x, 0, z); // Fix for crash at line 1364

    const hb = createNPCHealthBar();
    bot.add(hb);
    bot.userData.hBar = hb.children[1]; // Store FG ref for scaling? No, store group checks children?
    // Actually createNPCHealthBar returns a group. 
    // Let's modify createNPCHealthBar to allow easy scaling.
    // Re-implementation below uses fg.geometry.translate so we can scale the MESH directly.
    bot.userData.hBar = hb.children[1]; // The Red Foreground

    bots.push(bot);
}
window.spawnBot = spawnBot;
window.spawnBotManual = spawnBot;

function setupBotsPeriphery() {
    console.log("🤖 Inicializando Bots...");
    for (let i = 0; i < (cfg.bots || 10); i++) {
        spawnBot(false);
    }
    initialBotsSpawned = true;
}

// 🧠 ADVANCED AI (PORTED FROM BACKUP)
// 🤖 ATUALIZAÇÃO DOS BOTS (I.A. ORIGINAL PORTADA)
function updateBots(deltaTime) {
    const time = clock.getElapsedTime();
    const fpsScale = deltaTime * 60;
    const playerTargetCounts = {};
    const enemyBots = bots.filter(b => !b.userData.isAlly);
    const realEnemies = Object.values(otherPlayers).filter(p => !p.userData.isAlly && p.userData.hp > 0); // Simplified for now

    bots.forEach((bot, bi) => {
        if (!bot.userData.aiTick) bot.userData.aiTick = 0;

        // --- 1. STATUS & PERCEPÇÃO ---
        const decisionSpeed = [20, 10, 5][cfg.diff - 1] || 10;
        bot.userData.aiTick += 1 * fpsScale;
        const bDistFromCenter = Math.hypot(bot.position.x, bot.position.z);
        const bInGas = bDistFromCenter > zoneRadius;

        // Gas Damage
        if (bInGas && zoneActive) bot.userData.hp -= 0.8 * fpsScale;

        // Line Of Sight (LOS)
        ray.ray.origin.copy(bot.position).add(tempVec.set(0, 3, 0));
        ray.ray.direction.copy(playerGroup.position).sub(bot.position).normalize();
        ray.far = 400;
        const losHits = ray.intersectObjects(solidObstacles);
        const hasLOS = losHits.length === 0;

        // Alert Logic
        if (hasLOS) {
            bot.userData.lastKnownPos.copy(playerGroup.position);
            if (!bot.userData.isAlly) bot.userData.isAlerted = true;
        }

        // --- 2. DECISÃO (IA TÁTICA) ---
        if (bot.userData.aiTick > decisionSpeed) {
            bot.userData.aiTick = 0;
            if (bInGas && bDistFromCenter > zoneRadius - 30) {
                // Flee from gas
                bot.userData.targetPos.set(0, bot.position.y, 0);
                bot.userData.isAlerted = true;
            } else if (hasLOS) {
                // Flanking Logic
                if (!bot.userData.flankAngle) bot.userData.flankAngle = 0;
                bot.userData.flankAngle += 0.05;
                const flankDist = bot.userData.isAlly ? 15 : 45;
                tempVec.set(Math.cos(bot.userData.flankAngle), 0, Math.sin(bot.userData.flankAngle)).multiplyScalar(flankDist);

                if (bot.userData.isAlly) {
                    // Ally Logic: Follow Player or Engage Closest Enemy
                    let closestEnemy = null; let minDist = 500;
                    enemyBots.forEach(eb => { let d = bot.position.distanceTo(eb.position); if (d < minDist) { minDist = d; closestEnemy = eb; } });
                    // Checking real enemies too if needed, simplified here
                    if (closestEnemy) bot.userData.targetPos.copy(closestEnemy.position).add(tempVec);
                    else bot.userData.targetPos.copy(playerGroup.position).add(tempVec.multiplyScalar(0.5));
                } else {
                    // Enemy Logic: Slot System
                    const targetID = 'player';
                    if (!playerTargetCounts[targetID]) playerTargetCounts[targetID] = 0;

                    // Attack Slots Limit
                    if (playerTargetCounts[targetID] < 2) {
                        bot.userData.targetPos.copy(playerGroup.position).add(tempVec);
                        playerTargetCounts[targetID]++;
                    } else {
                        // Patrol/Wait
                        bot.userData.targetPos.copy(bot.userData.lastKnownPos || bot.position);
                    }
                }
                bot.userData.suppressionTimer = bot.userData.isAlerted ? 1 : 0;
            } else {
                // No LOS: Seek Cover or Last Known Pos
                if (bot.userData.isAlerted && (!bot.userData.blindSpotTimer || bot.userData.blindSpotTimer <= 0)) {
                    // Simple Cover Search (Shadow Point)
                    // Simplified: Just go to last known pos for now to save rays
                    bot.userData.targetPos.copy(bot.userData.lastKnownPos || bot.position);
                } else {
                    bot.userData.targetPos.copy(bot.userData.lastKnownPos || bot.position);
                }
            }
        }

        // --- 3. MOVIMENTO ---
        let botSpeed = (bot.userData.isAlly ? 2.8 : 2.1) * fpsScale;
        if (bot.userData.isAlerted || bInGas) botSpeed *= (cfg.diff === 3 ? 2.3 : 1.9);

        // Rotation
        const angleToTarget = Math.atan2(bot.userData.targetPos.x - bot.position.x, bot.userData.targetPos.z - bot.position.z);
        bot.rotation.y = THREE.MathUtils.lerp(bot.rotation.y, angleToTarget, 0.15 * fpsScale);

        const isBotMoving = bot.position.distanceTo(bot.userData.targetPos) > 3;

        // Animation
        const botCycle = time * 10;
        CharacterFactory.animateLimbs(bot, deltaTime, isBotMoving, false, 0); // Assuming 0 pitch for now

        if (isBotMoving) {
            const distToPlayer = bot.position.distanceTo(playerGroup.position);
            // Engage rule: Only move if ally OR enemy far away (>12m) OR not alerted
            const shouldMove = bot.userData.isAlly || (!bot.userData.isAlly && distToPlayer > 12) || !bot.userData.isAlerted || bInGas;

            if (shouldMove) {
                const step = botSpeed * 0.15;
                let nextX = bot.position.x + Math.sin(bot.rotation.y) * step;
                let nextZ = bot.position.z + Math.cos(bot.rotation.y) * step;

                // Strafing when alerted
                if (bot.userData.isAlerted && !bInGas) {
                    const sideVec = tempVec2.set(Math.cos(bot.rotation.y), 0, -Math.sin(bot.rotation.y));
                    const freq = (cfg.diff === 3 ? 12 : 8);
                    const strafe = Math.sin(time * freq) * 0.4 * step;
                    nextX += sideVec.x * strafe;
                    nextZ += sideVec.z * strafe;
                }

                // Simple Wall Collision for Bots
                const botBox = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(nextX, bot.position.y + 2, nextZ), new THREE.Vector3(1.5, 4, 1.5));
                let hitWall = false;
                for (let i = 0; i < obstacleBoxes.length; i++) {
                    // Optimization: Check distance first?
                    if (botBox.intersectsBox(obstacleBoxes[i])) { hitWall = true; break; }
                }

                if (!hitWall) {
                    bot.position.x = nextX;
                    bot.position.z = nextZ;
                }
            }
        }

        // --- 4. GRAVIDADE (Already fixed) ---
        // Reuse floor detection from previous fix, but adapted
        const botRay = new THREE.Raycaster(bot.position.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3(0, -1, 0));
        botRay.far = 10;
        const bHits = botRay.intersectObjects(groundObstacles);
        const bFloorY = (bHits.length > 0) ? bHits[0].point.y : 0;

        if (!bot.userData.vY) bot.userData.vY = 0;
        bot.position.y += bot.userData.vY * fpsScale;
        if (bot.position.y > bFloorY + 0.1) {
            bot.userData.vY -= 0.025 * fpsScale;
        } else {
            bot.position.y = bFloorY;
            bot.userData.vY = 0;
        }

        // --- 5. TIRO ---
        const baseShotCooldown = [1.8, 0.8, 0.4][cfg.diff - 1] || 1.0;
        const shootCooldown = bot.userData.isAlerted ? baseShotCooldown : 2.5;

        // Init lastShot if undefined
        if (!bot.userData.lastShot) bot.userData.lastShot = 0;

        if (time - bot.userData.lastShot > shootCooldown && (hasLOS || (bot.userData.suppressionTimer && bot.userData.suppressionTimer > 0))) {
            const dmg = bot.userData.isAlly ? 35 : (5 * cfg.diff + 1);
            let validTargetPoint = null;

            if (bot.userData.isAlly) {
                // Ally targets enemies
                let closestEnemy = null; let minDist = 300;
                enemyBots.forEach(eb => { let d = bot.position.distanceTo(eb.position); if (d < minDist) { minDist = d; closestEnemy = eb; } });
                if (closestEnemy) validTargetPoint = closestEnemy.position.clone().add(new THREE.Vector3(0, 1.4, 0)); // Aim at CHEST/HEAD
            } else {
                // Enemy targets Player
                validTargetPoint = hasLOS ? playerGroup.position.clone() : bot.userData.lastKnownPos.clone();
            }

            if (validTargetPoint && bot.position.distanceTo(validTargetPoint) < 250) {
                // Add randomness to aim
                const spread = hasLOS ? 0.03 : 0.1;
                // spawnBullet(owner, start, end, id, damage, spread)
                // Note: Our spawnBullet signature might be different. Let's check: 
                // spawnBullet(owner, position, targetPos, shooterId, damage) from previous view
                spawnBullet('bot', bot.position.clone().add(new THREE.Vector3(0, 1.5, 0)), validTargetPoint, bot.userData.id, dmg);

                bot.userData.lastShot = time;
                if (!hasLOS && bot.userData.suppressionTimer) bot.userData.suppressionTimer -= 0.1;
            }
        }

        // --- 6. VISUAIS (HP Bar) ---
        if (bot.userData.hBar) {
            const hpPct = bot.userData.hp / (bot.userData.maxHP || 100);
            bot.userData.hBar.scale.x = Math.max(0, hpPct);
            bot.userData.hBar.visible = bot.userData.hp < (bot.userData.maxHP || 100);

            // Color Transition: Green (>50%) -> Yellow -> Red (<25%)
            if (hpPct > 0.5) bot.userData.hBar.material.color.setHex(0x00ff00);
            else if (hpPct > 0.25) bot.userData.hBar.material.color.setHex(0xffff00);
            else bot.userData.hBar.material.color.setHex(0xff0000);

            if (bot.userData.hBar.parent) bot.userData.hBar.parent.lookAt(camera.position);
        }

    });
}

// Helper for creating health bars
function createNPCHealthBar() {
    const group = new THREE.Group();
    // Background (Black) - REMOVED per user request "nao quero a barra de vida preta"
    // const bg = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.8), new THREE.MeshBasicMaterial({ color: 0x000000 }));


    // Foreground (Green initially)
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
    // Reduced scale: 3.0 wide, 0.4 high (was 5.6, 0.6)
    fg.scale.set(3.0, 0.4, 1);
    fg.position.z = 0.1;
    // Pivot hack
    fg.geometry.translate(0.5, 0, 0);
    fg.position.x = -1.5; // Half of 3.0

    group.add(fg); // bg removed
    group.position.y = 4.0; // Slightly lower
    return group;
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
        console.log(`🤖 SYNC-BOT: Created ${id} at ${data.x},${data.y},${data.z}`);
    }
    bot.position.set(data.x, data.y, data.z);
    bot.rotation.y = data.ry;
    bot.userData.hp = data.hp;
};

// Initialize game

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

    // 🌐 LOBBY CONNECTION (Fix for "Not Connecting")
    if (tab === 'multi') {
        ensureNetwork().then(net => {
            if (net.listenToPublicPresence) net.listenToPublicPresence();
        });
    }
};

window.setMode = (mode, btn) => {
    currentGameMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
};


// 🌐 NETWORK SINGLETON & INITIALIZER
let network = null;

async function ensureNetwork() {
    if (network) return network;

    // Initialize without game first (Lobby Mode)
    network = new Network(null);
    window.gameNetwork = network;

    await network.connect();
    return network;
}


// Initialize game
window.initGame = (mode) => {
    // VISUAL FEEDBACK FOR CLICK/TOUCH
    alert("INICIANDO JOGO... (v2.0)");

    // Load HUD Layout if saved
    if (window.loadHudLayout) window.loadHudLayout();

    // 🔊 RESUME AUDIO CONTEXT (Mobile Requirement)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            console.log('AudioContext resumed!');
        }).catch(err => console.error(err));
    }

    // 📱 MOBILE FULLSCREEN
    try {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(e => {
                // Silent catch, user might have denied or not interacted yet
            });
        }
    } catch (e) { }

    try {
        playerName = document.getElementById('player-name').value || "OPERADOR";
        missionAccomplished = false;
        isMultiplayer = (mode === 'multi');
        playerKills = 0;
        matchStartTime = Date.now(); // Logic Restore

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

        // 🎨 HUD EDITOR INIT
        window.openHudEditor = openHudEditor;
        initHudEditor();
        loadHudLayout(); // Load saved positions

        // PREPARE GAME INTERFACE
        const gameInterface = {
            scene,
            player: playerGroup,
            bots,
            setupBotsPeriphery: setupBotsPeriphery,
            spawnRemoteGrenade: window.spawnRemoteGrenade,
            syncBot: window.syncBot,
            clearBots: window.clearBots,
            cleanupBots: window.cleanupBots,

            // DYNAMIC ACCESSORS
            get isPlaying() { return isPlaying; },
            get health() { return health; },
            get playerKills() { return playerKills; },
            get cameraYaw() { return cameraYaw; },
            toggleBots: (val) => { if (val) setupBotsPeriphery(); }
        };

        isPlaying = true;

        if (mode === 'multi') {
            // 🌐 MULTIPLAYER: Reuse existing network or connect
            ensureNetwork().then(net => {
                net.setGame(gameInterface); // Inject Game logic now
                if (net.listenToPublicPresence) net.listenToPublicPresence();
                net.startMultiplayer();
            });
        } else {
            // 👤 SINGLEPLAYER: Offline Mode
            setupBotsPeriphery();
        }

        console.log('🎮 Jogo iniciado com lógica original!');
    } catch (e) {
        console.error('❌ ERRO CRÍTICO AO INICIAR JOGO:', e);
        alert('ERRO AO INICIAR: ' + e.message); // Visual feedback for mobile user
    }
};

// ♻️ END OF LEGACY LOGIC


// 🛠️ UI HELPERS (Global Access)
// --- GRENADE LOGIC ---
function throwGrenade() {
    if (!isPlaying || isPaused) return;
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), new THREE.MeshStandardMaterial({ color: grenadeType === 'explosive' ? 0x222222 : 0xeeeeee }));
    g.position.copy(playerGroup.position).add(tempVec.set(0, 3.0, 0));

    // Throw direction based on camera
    ray.setFromCamera({ x: 0, y: 0 }, camera);
    const dir = ray.ray.direction.clone().normalize();
    const force = cameraPitch < -0.2 ? 1.2 : 3.8; // Low throw if looking down

    // Metadata
    g.userData = { vel: dir.multiplyScalar(force), life: 120, type: grenadeType, hasStopped: false, owner: 'player' };
    scene.add(g);
    grenades.push(g);

    // Networking
    if (window.gameNetwork && window.gameNetwork.throwGrenade) {
        const vel = g.userData.vel;
        window.gameNetwork.throwGrenade({
            type: grenadeType,
            x: g.position.x, y: g.position.y, z: g.position.z,
            vx: vel.x, vy: vel.y, vz: vel.z,
            owner: window.gameNetwork.currentUser ? window.gameNetwork.currentUser.uid : 'player'
        });
    }
}
// Expose globally for buttons
window.throwGrenade = throwGrenade;

window.toggleCamera = () => {
    isFPS = !isFPS;
    console.log('👁️ Camera Toggled:', isFPS ? "1st Person" : "3rd Person");
};

window.triggerHitmarker = () => {
    const hm = document.getElementById('hitmarker');
    if (hm) {
        hm.style.display = 'block';
        setTimeout(() => hm.style.display = 'none', 100);
    }
    playSfx('hit');
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

alert('SISTEMA - SCRIPT CARREGADO E RODANDO! (v2.2)');

// 🛡️ GAME LOGIC HELPERS
window.showMsg = (title, body) => {
    if (title === "MISSÃO CUMPRIDA" && missionAccomplished) return;
    if (title === "MISSÃO CUMPRIDA") missionAccomplished = true;

    isPlaying = false;
    const panel = document.getElementById('game-msg');
    const btns = document.getElementById('msg-btns');

    if (document.getElementById('msg-title')) document.getElementById('msg-title').innerText = title;
    if (document.getElementById('msg-body')) document.getElementById('msg-body').innerText = body;

    btns.innerHTML = '';

    // RESTART BUTTON
    const restartBtn = document.createElement('button');
    restartBtn.className = 'btn-main';
    restartBtn.innerText = "RECOMEÇAR";
    restartBtn.onclick = () => location.reload();
    btns.appendChild(restartBtn);

    panel.style.display = 'block';
};

window.spawnBotManual = (isAlly) => {
    if (!isPlaying) return;
    // Manual spawn wrapper
    if (typeof spawnBot === 'function') spawnBot(isAlly); // Uses simplified spawnBot from main logic
    // Or call spawnSingleBot if we expose it?
    // spawnBot in main.js handles spawn logic but doesn't take 'manual' arg.
    // It's fine, HUD buttons call generic spawnBot usually.
};

window.spawnRemoteGrenade = (d) => {
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), new THREE.MeshStandardMaterial({ color: d.type === 'explosive' ? 0x222222 : 0xeeeeee }));
    g.position.set(d.x, d.y, d.z);
    g.userData = { vel: new THREE.Vector3(d.vx, d.vy, d.vz), life: 120, type: d.type, hasStopped: false, owner: 'other', dbId: d.dbId };
    scene.add(g);
    grenades.push(g);
};
console.log('✅ Sistema de jogo completo (v2.2) carregado!');
