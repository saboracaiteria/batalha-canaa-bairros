import * as THREE from 'three';

/**
 * TrainingArena - VibeFPS Map ported for standalone training
 */
export class TrainingArena {
    constructor(scene) {
        this.scene = scene;
        this.meshes = [];
    }

    /**
     * Generate the arena
     * Returns array of obstacles for collision system
     */
    create() {
        // Floor
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100),
            new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8, metalness: 0.2 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floor.userData.isGround = true;
        this.add(floor);

        // Walls
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7, metalness: 0.1 });
        this.createWall(0, 5, -50, 100, 10, 1, wallMat); // North
        this.createWall(0, 5, 50, 100, 10, 1, wallMat);  // South
        this.createWall(50, 5, 0, 1, 10, 100, wallMat);  // East
        this.createWall(-50, 5, 0, 1, 10, 100, wallMat); // West

        // Obstacles
        for (let i = 0; i < 20; i++) {
            this.createObstacle();
        }

        // Add some lights since this map is small
        const light = new THREE.PointLight(0xffffff, 1, 100);
        light.position.set(0, 20, 0);
        light.castShadow = false; // Perf
        this.scene.add(light);
        // Track light to remove later? maybe just attach to floor

        return this.meshes;
    }

    createWall(x, y, z, w, h, d, mat) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        wall.position.set(x, y, z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        wall.userData.isSolid = true;
        wall.userData.isWall = true;
        this.add(wall);
    }

    createObstacle() {
        const w = Math.random() * 3 + 1;
        const h = Math.random() * 3 + 1;
        const d = Math.random() * 3 + 1;

        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHSL(Math.random(), 0.5, 0.5),
                roughness: 0.7
            })
        );

        mesh.position.set(
            Math.random() * 80 - 40,
            h / 2,
            Math.random() * 80 - 40
        );

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isSolid = true;
        this.add(mesh);
    }

    add(mesh) {
        this.scene.add(mesh);
        this.meshes.push(mesh);
    }
}
