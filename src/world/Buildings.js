import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { ModelLoader } from '../utils/ModelLoader.js';

/**
 * Buildings - Procedurally generated buildings with INSTANCED RENDERING
 */
export class Buildings {
    constructor(game) {
        this.game = game;
        this.houseData = [];
        this.obstacles = [];

        // Materials (shared across all instances)
        this.materials = {
            parede: new THREE.MeshStandardMaterial({ color: 0xbfae95, roughness: 1.0 }),
            concreto: new THREE.MeshStandardMaterial({ color: 0x8c8c7e, roughness: 0.9 }),
            metal: new THREE.MeshStandardMaterial({ color: 0x5a3a2a, metalness: 0.3, roughness: 0.8 }),
            madeira: new THREE.MeshStandardMaterial({ color: 0x6F4E37, roughness: 1.0 }),
            saco: new THREE.MeshStandardMaterial({ color: 0x9e9578, roughness: 1.0 })
        };

        // Buffer collections (Mega Buffer Optimization)
        this.geometriesToMerge = {
            parede: [],
            concreto: [],
            metal: [],
            madeira: [],
            saco: []
        };
    }

    /**
     * Generate all buildings in the map
     */
    async generateAll() {
        console.log('🏠 Generating buildings...');

        const gridSpacing = 160;
        const gridOffset = 80;
        let houseId = 0;
        const housePositions = [];

        // Calculate positions first
        // Central houses (rotated 45 degrees)
        for (let a = 0; a < 4; a++) {
            const angle = (a / 4) * Math.PI * 2 + Math.PI / 4;
            const x = Math.cos(angle) * 85;
            const z = Math.sin(angle) * 85;
            housePositions.push({ x, z, angle, id: houseId++ });
        }

        // Grid houses
        for (let rx = -2; rx <= 2; rx++) {
            for (let rz = -2; rz <= 2; rz++) {
                if (Math.abs(rx) < 1 && Math.abs(rz) < 1) continue;
                const x = rx * gridSpacing + gridOffset;
                const z = rz * gridSpacing + gridOffset;
                housePositions.push({ x, z, angle: 0, id: houseId++ });
            }
        }

        // Try to load custom house model
        const houseModel = await ModelLoader.load('buildings', 'house');

        if (houseModel) {
            console.log('🏠 Custom house model loaded! Placing instances...');

            // Use cloned models for now (simpler than converting arbitrary GLB to InstancedMesh)
            // Optimization for later: Convert to InstancedMesh if geometry allows

            housePositions.forEach(pos => {
                const house = houseModel.clone();
                house.position.set(pos.x, 2, pos.z); // Adjust Y offset as needed
                house.rotation.y = pos.angle;

                this.game.scene.add(house);
                this.obstacles.push(house);

                // Register house data
                this.houseData.push({
                    position: new THREE.Vector3(pos.x, 2, pos.z),
                    doorPos: new THREE.Vector3(pos.x, 0, pos.z + 7), // Approximate
                    id: pos.id,
                    occupied: null
                });

                // Traverse and fix shadows
                house.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
            });

        } else {
            console.log('🏗️ No custom house found. Generating procedural instances...');

            housePositions.forEach(pos => {
                this.addHouseInstances(pos.x, pos.z, pos.angle, pos.id);
            });

            // Finalize Mega Buffer
            this.finalizeMap();
        }
    }

    /**
     * Add a single house's geometry to instance arrays
     */
    addHouseInstances(x, z, rotation, houseId) {
        // Transform logic adapted for Buffer system
        // We calculate world position manually before pushing to buffer
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        const addHousePart = (type, w, h, d, lx, ly, lz) => {
            // Scale logic from original (4.5)
            const s = 4.5;
            const finalW = w * s;
            const finalH = h * s;
            const finalD = d * s;

            // Local pos scaled
            const localX = lx * s;
            const localY = ly * s;
            const localZ = lz * s;

            // Rotate position
            // WorldX = HouseX + (LocalX * cos - LocalZ * sin)
            const worldX = x + (localX * cos - localZ * sin);
            const worldZ = z + (localX * sin + localZ * cos);

            // Push
            this.pushToBuffer(type, finalW, finalH, finalD, worldX, localY, worldZ, rotation);
        };

        // GROUND FLOOR
        addHousePart('parede', 6, 3.5, 0.2, 0, 1.75, -2.4); // Back wall
        addHousePart('parede', 0.2, 3.5, 5, -2.9, 1.75, 0); // Left wall
        addHousePart('parede', 2.0, 3.5, 0.2, -2.0, 1.75, 2.4); // Front left
        addHousePart('parede', 2.0, 3.5, 0.2, 2.0, 1.75, 2.4); // Front right
        addHousePart('parede', 2.0, 0.7, 0.2, 0, 3.15, 2.4); // Door lintel
        addHousePart('parede', 0.2, 3.5, 2, 2.9, 1.75, 1.5);
        addHousePart('parede', 0.2, 3.5, 1, 2.9, 1.75, -2);
        addHousePart('parede', 0.2, 1, 2, 2.9, 3, 0); // Garage lintel

        // SECOND FLOOR
        addHousePart('concreto', 3.0, 0.2, 5, 1.5, 3.5, 0); // Floor
        addHousePart('concreto', 3.0, 0.2, 1.5, -1.5, 3.5, -1.75);
        addHousePart('concreto', 4, 3, 0.2, -1, 5, 2.4); // Front
        addHousePart('concreto', 4, 3, 0.2, -1, 5, -2.4); // Back
        addHousePart('concreto', 0.2, 3, 5, -2.9, 5, 0); // Left
        addHousePart('concreto', 0.2, 3, 1, 0.9, 5, 0); // Central pillar

        // ROOF
        addHousePart('concreto', 4.4, 0.2, 5.4, -1, 6.5, 0);
        addHousePart('concreto', 4.4, 0.4, 0.2, -1, 6.8, 2.6); // Parapet
        addHousePart('concreto', 0.2, 0.4, 5.4, -3.1, 6.8, 0); // Parapet

        // BALCONY
        addHousePart('concreto', 2, 0.2, 5, 2, 3.5, 0);
        addHousePart('concreto', 2, 1, 0.2, 2, 4, 2.4);
        addHousePart('concreto', 0.2, 1, 5, 2.9, 4, 0);

        // GARAGE
        addHousePart('metal', 3.2, 0.1, 4.2, 4.5, 3.2, -0.5);
        addHousePart('metal', 0.1, 3, 4, 6, 1.5, -0.5);
        addHousePart('metal', 3, 3, 0.1, 4.5, 1.5, -2.5);
        addHousePart('metal', 1, 3, 0.1, 5.5, 1.5, 1.5);

        // DETAILS
        addHousePart('saco', 0.7, 0.3, 0.5, -1, 6.8, 2.2); // Sandbag
        addHousePart('madeira', 1, 1, 1, 2, 0.5, -1.5); // Crate

        // Store house data for gameplay
        this.houseData.push({
            position: new THREE.Vector3(x, 2, z),
            doorPos: new THREE.Vector3(x, 0, z + 7),
            id: houseId,
            occupied: null
        });
    }

    /**
     * Creates a box and pushes it to the geometry merge buffer
     */
    pushToBuffer(type, w, h, d, x, y, z, rotY = 0) {
        // 1. Create geometry
        const geo = new THREE.BoxGeometry(w, h, d);

        // 2. Position and Rotate
        const matrix = new THREE.Matrix4();
        const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        const position = new THREE.Vector3(x, y, z);
        matrix.compose(position, rotation, new THREE.Vector3(1, 1, 1));
        geo.applyMatrix4(matrix);

        // 3. Save to list
        if (this.geometriesToMerge[type]) {
            this.geometriesToMerge[type].push(geo);
        }

        // 4. Create Invisible Collision Box (Only at player height to optimize)
        if (y < 10) {
            const box = new THREE.Box3().setFromBufferAttribute(geo.attributes.position);
            box.userData = { isWall: true, isSolid: true }; // Flag logic
            if (y > 4) box.userData.isRoof = true; // Flag for ceiling check

            // Add to global collision system (need access to main game's obstacleBoxes)
            if (window.obstacleBoxes) {
                window.obstacleBoxes.push(box);
            }
        }
    }

    /**
     * Finalize map by merging all geometries (Mega Buffer)
     */
    finalizeMap() {
        console.log("🏗️ Mega Buffer: Merging geometries...");

        for (const [type, geoList] of Object.entries(this.geometriesToMerge)) {
            if (geoList.length > 0) {
                // The Magic: Merge thousands of geometries into one
                const mergedGeo = BufferGeometryUtils.mergeGeometries(geoList);
                const mesh = new THREE.Mesh(mergedGeo, this.materials[type]);

                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.matrixAutoUpdate = false; // Optimization: Static map
                mesh.updateMatrix();

                this.game.scene.add(mesh);
                this.obstacles.push(mesh); // Add to general obstacles list (for Raycasting visual checks)

                // Cleanup
                geoList.forEach(g => g.dispose());
                this.geometriesToMerge[type] = [];
            }
        }
        console.log("🚀 MAP OPTIMIZED: 1 Draw Call per Material");
    }

    /**
     * Get house data for bot AI
     */
    getHouseData() {
        return this.houseData;
    }

    /**
     * Get obstacles for physics
     */
    getObstacles() {
        return this.obstacles;
    }
}
