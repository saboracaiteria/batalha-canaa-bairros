import * as THREE from 'three';
import { Loop } from './Loop.js';
import { Input } from './Input.js';
import { World } from '../world/World.js';
import { Physics } from '../systems/Physics.js';
import { Audio } from '../systems/Audio.js';
import { Network } from '../systems/Network.js';
import { HUD } from '../ui/HUD.js';

/**
 * Game - Main singleton class
 * Initializes and coordinates all game systems
 */
export class Game {
    constructor() {
        if (Game.instance) {
            return Game.instance;
        }
        Game.instance = this;

        // Core Three.js objects
        this.scene = null;
        this.camera = null;
        this.renderer = null;

        // Game systems
        this.loop = null;
        this.input = null;
        this.world = null;
        this.physics = null;
        this.audio = null;
        this.network = null;
        this.hud = null;

        // Game state
        this.isPlaying = false;
        this.isPaused = false;
        this.isMultiplayer = false;

        // Configuration
        this.config = {
            graphics: 'low',
            fov: 75,
            sensitivity: 0.0165,
            bots: 10,
            difficulty: 2
        };
    }

    /**
     * Initialize the game
     */
    async init() {
        console.log('🎮 Initializing Residencial Canaã...');

        // Setup Three.js renderer
        this.setupRenderer();

        // Create systems
        this.loop = new Loop(this);
        this.input = new Input(this);
        this.audio = new Audio();
        this.physics = new Physics(this);
        this.hud = new HUD(this);

        console.log('✅ Game initialized successfully');

        // Show main menu (handled by Menus.js which will be loaded separately)
        return this;
    }

    /**
     * Setup Three.js renderer with mobile optimizations
     */
    setupRenderer() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.0006);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            this.config.fov,
            window.innerWidth / window.innerHeight,
            0.1,
            5000
        );

        // Renderer with mobile optimizations
        this.renderer = new THREE.WebGLRenderer({
            antialias: (this.config.graphics === 'high'),
            powerPreference: 'high-performance',
            precision: 'mediump' // Prevents memory overflow on iOS
        });

        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Pixel ratio clamping for Retina displays
        let pixelRatio = window.devicePixelRatio;
        if (pixelRatio > 1.5) pixelRatio = 1.5;
        if (this.config.graphics === 'low') pixelRatio = 1.0;
        this.renderer.setPixelRatio(pixelRatio);

        // Shadow settings
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = this.config.graphics === 'low'
            ? THREE.BasicShadowMap
            : THREE.PCFSoftShadowMap;

        // Add to DOM
        const container = document.getElementById('game-container');
        container.appendChild(this.renderer.domElement);

        // Handle window resize
        window.addEventListener('resize', () => this.onResize());
    }

    /**
     * Start a game session
     */
    startGame(mode = 'solo', config = {}) {
        console.log(`🚀 Starting game in ${mode} mode`);

        // Update config
        Object.assign(this.config, config);
        this.isMultiplayer = (mode === 'multi');

        // Initialize world
        this.world = new World(this);
        this.world.create();

        // Setup network if multiplayer
        if (this.isMultiplayer) {
            this.network = new Network(this);
            this.network.connect();
        }

        // Start game loop
        this.isPlaying = true;
        this.loop.start();

        // Show HUD
        this.hud.show();
    }

    /**
     * Pause/unpause game
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        // Pause menu handled by Menus.js
    }

    /**
     * Update game (called every frame)
     */
    update(deltaTime) {
        if (!this.isPlaying || this.isPaused) return;

        // Update systems
        if (this.world) this.world.update(deltaTime);
        if (this.physics) this.physics.update(deltaTime);
        if (this.network) this.network.update(deltaTime);
        if (this.hud) this.hud.update(deltaTime);
    }

    /**
     * Render frame
     */
    render() {
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Handle window resize
     */
    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!Game.instance) {
            new Game();
        }
        return Game.instance;
    }
}
