import * as THREE from 'three';
import { Buildings } from './Buildings.js';
import { ModelLoader } from '../utils/ModelLoader.js';

/**
 * World - Orchestrates all world systems (terrain, buildings, environment)
 */
export class World {
    constructor(game) {
        this.game = game;
        this.buildings = null;
        this.obstacles = [];
        this.trees = [];
        this.proceduralObjects = []; // Track procedural objects for cleanup
    }

    /**
     * Create the entire game world
     */
    create() {
        console.log('🌍 Creating world...');

        this.createLighting();

        // 1. Start procedural generation (Fallback)
        this.createProceduralWorld();

        // 2. Try to load custom map
        this.loadCustomMap();

        // Buildings (with instanced rendering)
        this.buildings = new Buildings(this.game);
        this.buildings.generateAll();

        // Add building obstacles to world obstacles
        // Note: If map loads, we might want to keep or remove buildings. 
        // For now, we assume buildings are separate entities (gameplay).
        this.obstacles.push(...this.buildings.getObstacles());

        console.log('✅ World created');
    }

    /**
     * Create procedural world elements
     */
    createProceduralWorld() {
        this.createTerrain();
        this.createMountains();
        this.createRoads();
        this.createTrees();
        this.createLighthouse();
    }

    /**
     * Try to load custom map and replace procedural world
     */
    async loadCustomMap() {
        const mapModel = await ModelLoader.load('maps', 'map');

        if (mapModel) {
            console.log('🗺️ Custom map loaded! Replacing procedural world...');

            // Remove procedural objects
            this.proceduralObjects.forEach(obj => {
                this.game.scene.remove(obj);

                // Remove from obstacles if present
                const idx = this.obstacles.indexOf(obj);
                if (idx > -1) this.obstacles.splice(idx, 1);

                // Dispose geometry/material
                obj.traverse(child => {
                    if (child.isMesh) {
                        child.geometry.dispose();
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                });
            });
            this.proceduralObjects = [];

            // Add custom map
            this.game.scene.add(mapModel);

            // Register map colliders
            // We assume meshes in the map are static obstacles unless named otherwise
            const mapObstacles = [];
            mapModel.traverse(child => {
                if (child.isMesh) {
                    child.receiveShadow = true;
                    child.castShadow = true;
                    // Optional: Check for naming conventions like "ground", "wall"
                    mapObstacles.push(child);

                    if (child.name.includes('ground') || child.name.includes('floor')) {
                        child.userData.isGround = true;
                    }
                }
            });

            this.obstacles.push(...mapObstacles);
        }
    }

    /**
     * Create terrain/ground
     */
    createTerrain() {
        const mapSize = 1000;
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(mapSize * 2.5, mapSize * 2.5),
            new THREE.MeshStandardMaterial({ color: 0x3d7a3d, roughness: 1 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floor.userData.isGround = true;

        this.game.scene.add(floor);
        this.obstacles.push(floor);
        this.proceduralObjects.push(floor);
    }

    /**
     * Create lighting (sun, ambient)
     */
    createLighting() {
        // Ambient light
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.game.scene.add(ambient);

        // Directional light (sun)
        const sun = new THREE.DirectionalLight(0xffffff, 1.1);
        sun.position.set(300, 500, 100);
        sun.castShadow = true;

        const shadowRes = this.game.config.graphics === 'low' ? 256 : 1024;
        sun.shadow.mapSize.width = shadowRes;
        sun.shadow.mapSize.height = shadowRes;
        sun.shadow.camera.left = -500;
        sun.shadow.camera.right = 500;
        sun.shadow.camera.top = 500;
        sun.shadow.camera.bottom = -500;

        this.game.scene.add(sun);

        // Visual sun sphere
        const sunMesh = new THREE.Mesh(
            new THREE.SphereGeometry(25, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xffff00 })
        );
        sunMesh.position.set(400, 600, 200);
        this.game.scene.add(sunMesh);
    }

    /**
     * Create mountains around perimeter
     */
    createMountains() {
        const mountainMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 1 });

        for (let i = 0; i < 48; i++) {
            const angle = (i / 48) * Math.PI * 2;
            const dist = 1000 + Math.random() * 400;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            const height = 180 + Math.random() * 250;
            const width = 250 + Math.random() * 300;

            const mountain = new THREE.Mesh(
                new THREE.ConeGeometry(width, height, 4),
                mountainMat
            );
            mountain.position.set(x, height / 2 - 5, z);
            mountain.rotation.y = Math.random() * Math.PI;
            mountain.userData.isMountain = true;

            this.game.scene.add(mountain);
            this.proceduralObjects.push(mountain);
        }
    }

    /**
     * Create road grid
     */
    createRoads() {
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
        const gridSpacing = 160;

        // Container for cleanup
        const roadGroup = new THREE.Group();
        this.game.scene.add(roadGroup);
        this.proceduralObjects.push(roadGroup);

        for (let i = -4; i <= 4; i++) {
            // Horizontal road
            const roadH = new THREE.Mesh(
                new THREE.PlaneGeometry(2500, 26),
                roadMat
            );
            roadH.rotation.x = -Math.PI / 2;
            roadH.position.set(0, 0.1, i * gridSpacing);
            roadH.userData.isGround = true;
            roadGroup.add(roadH); // Add to group instead of scene directly

            // Vertical road
            const roadV = new THREE.Mesh(
                new THREE.PlaneGeometry(26, 2500),
                roadMat
            );
            roadV.rotation.x = -Math.PI / 2;
            roadV.position.set(i * gridSpacing, 0.1, 0);
            roadV.userData.isGround = true;
            roadGroup.add(roadV);

            this.obstacles.push(roadH, roadV);
        }
    }

    /**
     * Create trees
     */
    createTrees() {
        const trunkGeo = new THREE.CylinderGeometry(0.8, 1.2, 12, 8);
        const leavesGeo = new THREE.ConeGeometry(6, 16, 8);

        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5D4037 });
        const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2E7D32, roughness: 0.8 });

        const treeGroup = new THREE.Group();
        this.game.scene.add(treeGroup);
        this.proceduralObjects.push(treeGroup);

        for (let i = 0; i < 250; i++) {
            const tx = (Math.random() - 0.5) * 2000;
            const tz = (Math.random() - 0.5) * 2000;

            // Don't spawn too close to center
            if (Math.hypot(tx, tz) < 60) continue;

            const tree = new THREE.Group();

            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 6;
            trunk.castShadow = true;

            const leaves = new THREE.Mesh(leavesGeo, leavesMat);
            leaves.position.y = 16;
            leaves.userData.isSolid = false;

            tree.add(trunk, leaves);
            tree.position.set(tx, 0, tz);
            tree.userData.isTree = true;

            treeGroup.add(tree);
            this.obstacles.push(trunk);
            this.trees.push(tree);
        }
    }

    /**
     * Create central lighthouse
     */
    createLighthouse() {
        const group = new THREE.Group();

        // Base
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(8, 12, 60, 16),
            new THREE.MeshStandardMaterial({ color: 0xcccccc })
        );
        base.position.y = 30;
        base.castShadow = true;
        base.receiveShadow = true;
        base.userData.isFarol = true;

        // Top
        const top = new THREE.Mesh(
            new THREE.CylinderGeometry(10, 8, 8, 16),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        top.position.y = 64;

        // Glass
        const glass = new THREE.Mesh(
            new THREE.CylinderGeometry(6, 6, 8, 16),
            new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.6 })
        );
        glass.position.y = 72;

        // Dome
        const dome = new THREE.Mesh(
            new THREE.SphereGeometry(7, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        dome.position.y = 76;

        // Spotlight
        const spot = new THREE.SpotLight(0xffffff, 5, 400, Math.PI / 6, 0.5);
        spot.position.set(0, 72, 0);
        spot.target.position.set(100, 0, 0);

        group.add(base, top, glass, dome, spot, spot.target);
        group.position.set(0, 0, 0);

        this.game.scene.add(group);
        this.obstacles.push(base, top, dome);

        // Lighthouse is distinct enough to maybe keep, but let's treat it as procedural for now
        this.proceduralObjects.push(group);
    }

    /**
     * Update world (e.g., lighthouse rotation)
     */
    update(deltaTime) {
        // Placeholder for dynamic world updates
    }

    /**
     * Get all obstacles for physics
     */
    getObstacles() {
        return this.obstacles;
    }

    /**
     * Get house data for bots
     */
    getHouseData() {
        return this.buildings ? this.buildings.getHouseData() : [];
    }
}
