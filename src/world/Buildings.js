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

        // Instance data collectors
        this.instances = {
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

            // Procedural generation (Fallback)
            housePositions.forEach(pos => {
                this.addHouseInstances(pos.x, pos.z, pos.angle, pos.id);
            });

            // Create final instanced meshes
            this.createInstancedMeshes();
        }
    }

    /**
     * Add a single house's geometry to instance arrays
     */
    addHouseInstances(x, z, rotation, houseId) {
        const scale = 4.5;
        const matrix = new THREE.Matrix4();

        // Helper to add box instance
        const addBox = (type, w, h, d, px, py, pz) => {
            matrix.compose(
                new THREE.Vector3(x + px * scale, py * scale, z + pz * scale),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotation, 0)),
                new THREE.Vector3(w * scale, h * scale, d * scale)
            );

            this.instances[type].push({
                matrix: matrix.clone(),
                geometry: new THREE.BoxGeometry(1, 1, 1) // Unit cube, scaled by matrix
            });
        };

        // GROUND FLOOR
        addBox('parede', 6, 3.5, 0.2, 0, 1.75, -2.4); // Back wall
        addBox('parede', 0.2, 3.5, 5, -2.9, 1.75, 0); // Left wall
        addBox('parede', 2.0, 3.5, 0.2, -2.0, 1.75, 2.4); // Front left
        addBox('parede', 2.0, 3.5, 0.2, 2.0, 1.75, 2.4); // Front right
        addBox('parede', 2.0, 0.7, 0.2, 0, 3.15, 2.4); // Door lintel
        addBox('parede', 0.2, 3.5, 2, 2.9, 1.75, 1.5);
        addBox('parede', 0.2, 3.5, 1, 2.9, 1.75, -2);
        addBox('parede', 0.2, 1, 2, 2.9, 3, 0); // Garage lintel

        // SECOND FLOOR
        addBox('concreto', 3.0, 0.2, 5, 1.5, 3.5, 0); // Floor
        addBox('concreto', 3.0, 0.2, 1.5, -1.5, 3.5, -1.75);
        addBox('concreto', 4, 3, 0.2, -1, 5, 2.4); // Front
        addBox('concreto', 4, 3, 0.2, -1, 5, -2.4); // Back
        addBox('concreto', 0.2, 3, 5, -2.9, 5, 0); // Left
        addBox('concreto', 0.2, 3, 1, 0.9, 5, 0); // Central pillar

        // ROOF
        addBox('concreto', 4.4, 0.2, 5.4, -1, 6.5, 0);
        addBox('concreto', 4.4, 0.4, 0.2, -1, 6.8, 2.6); // Parapet
        addBox('concreto', 0.2, 0.4, 5.4, -3.1, 6.8, 0); // Parapet

        // BALCONY
        addBox('concreto', 2, 0.2, 5, 2, 3.5, 0);
        addBox('concreto', 2, 1, 0.2, 2, 4, 2.4);
        addBox('concreto', 0.2, 1, 5, 2.9, 4, 0);

        // GARAGE
        addBox('metal', 3.2, 0.1, 4.2, 4.5, 3.2, -0.5);
        addBox('metal', 0.1, 3, 4, 6, 1.5, -0.5);
        addBox('metal', 3, 3, 0.1, 4.5, 1.5, -2.5);
        addBox('metal', 1, 3, 0.1, 5.5, 1.5, 1.5);

        // DETAILS
        addBox('saco', 0.7, 0.3, 0.5, -1, 6.8, 2.2); // Sandbag
        addBox('madeira', 1, 1, 1, 2, 0.5, -1.5); // Crate

        // Store house data for gameplay
        this.houseData.push({
            position: new THREE.Vector3(x, 2, z),
            doorPos: new THREE.Vector3(x, 0, z + 7),
            id: houseId,
            occupied: null
        });
    }

    /**
     * Create the final InstancedMesh objects
     */
    createInstancedMeshes() {
        for (const [type, instances] of Object.entries(this.instances)) {
            if (instances.length === 0) continue;

            const count = instances.length;
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = this.materials[type];

            const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
            instancedMesh.castShadow = true;
            instancedMesh.receiveShadow = true;

            // Set matrices for each instance
            instances.forEach((inst, i) => {
                instancedMesh.setMatrixAt(i, inst.matrix);
            });

            instancedMesh.instanceMatrix.needsUpdate = true;
            this.game.scene.add(instancedMesh);

            // Store for collision (we'll need to implement per-instance collision later)
            this.obstacles.push(instancedMesh);
        }
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
