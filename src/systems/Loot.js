import * as THREE from 'three';

/**
 * Loot - Medkits, ammo, armor pickups
 */
export class Loot {
    constructor(scene, type, position) {
        this.scene = scene;
        this.type = type; // 'medkit', 'ammo', 'armor'
        this.mesh = null;
        this.collected = false;

        this.createMesh(type, position);
    }

    /**
     * Create loot mesh
     */
    createMesh(type, position) {
        const group = new THREE.Group();

        if (type === 'medkit') {
            // White box with red cross
            const box = new THREE.Mesh(
                new THREE.BoxGeometry(1.8, 1.2, 1.2),
                new THREE.MeshStandardMaterial({ color: 0xffffff })
            );

            const crossH = new THREE.Mesh(
                new THREE.BoxGeometry(1.4, 0.4, 1.4),
                new THREE.MeshStandardMaterial({ color: 0xff0000 })
            );

            const crossV = new THREE.Mesh(
                new THREE.BoxGeometry(0.4, 1.4, 1.4),
                new THREE.MeshStandardMaterial({ color: 0xff0000 })
            );

            group.add(box, crossH, crossV);
            group.scale.set(0.35, 0.35, 0.35);

        } else if (type === 'ammo') {
            // Yellow ammo box
            const box = new THREE.Mesh(
                new THREE.BoxGeometry(0.8, 0.6, 0.6),
                new THREE.MeshStandardMaterial({ color: 0xffff00 })
            );
            group.add(box);

        } else if (type === 'armor') {
            // Blue armor vest
            const vest = new THREE.Mesh(
                new THREE.BoxGeometry(1.2, 1.5, 0.6),
                new THREE.MeshStandardMaterial({ color: 0x3b82f6 })
            );
            group.add(vest);
            group.scale.set(0.4, 0.4, 0.4);
        }

        group.position.copy(position);
        group.position.y = 1.2;
        group.userData.isLoot = true;
        group.userData.lootType = type;

        this.mesh = group;
        this.scene.add(group);

        // Add floating animation
        this.animationOffset = Math.random() * Math.PI * 2;
    }

    /**
     * Update loot (floating animation)
     */
    update(deltaTime) {
        if (!this.mesh || this.collected) return;

        const time = Date.now() * 0.001 + this.animationOffset;
        this.mesh.position.y = 1.2 + Math.sin(time * 2) * 0.2;
        this.mesh.rotation.y += deltaTime * 2;
    }

    /**
     * Try to collect loot
     */
    tryCollect(playerPosition, collectDistance = 3) {
        if (this.collected || !this.mesh) return null;

        const dist = this.mesh.position.distanceTo(playerPosition);
        if (dist < collectDistance) {
            this.collected = true;
            this.scene.remove(this.mesh);
            return this.type;
        }

        return null;
    }

    /**
     * Get position
     */
    getPosition() {
        return this.mesh ? this.mesh.position : null;
    }
}

/**
 * LootManager - Spawns and manages all loot
 */
export class LootManager {
    constructor(scene) {
        this.scene = scene;
        this.loots = [];
    }

    /**
     * Spawn random loot around the map
     */
    spawnRandomLoot(count = 30) {
        const types = ['medkit', 'ammo', 'armor'];

        for (let i = 0; i < count; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const angle = Math.random() * Math.PI * 2;
            const dist = 50 + Math.random() * 400;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;

            const loot = new Loot(this.scene, type, new THREE.Vector3(x, 0, z));
            this.loots.push(loot);
        }

        console.log(`📦 Spawned ${count} loot items`);
    }

    /**
     * Spawn loot in houses
     */
    spawnInHouses(houseData) {
        houseData.forEach(house => {
            // Random chance to spawn loot in each house
            if (Math.random() < 0.6) {
                const type = Math.random() < 0.5 ? 'medkit' : (Math.random() < 0.5 ? 'ammo' : 'armor');
                const loot = new Loot(this.scene, type, house.position.clone());
                this.loots.push(loot);
            }
        });
    }

    /**
     * Update all loot
     */
    updateAll(deltaTime, playerPosition) {
        for (let i = this.loots.length - 1; i >= 0; i--) {
            const loot = this.loots[i];
            loot.update(deltaTime);

            // Try to collect
            const collected = loot.tryCollect(playerPosition);
            if (collected) {
                this.loots.splice(i, 1);
                return collected; // Return what was collected
            }
        }

        return null;
    }

    /**
     * Get all active loots
     */
    getLoots() {
        return this.loots.filter(l => !l.collected);
    }

    /**
     * Clear all loot
     */
    clearAll() {
        this.loots.forEach(loot => {
            if (loot.mesh) {
                this.scene.remove(loot.mesh);
            }
        });
        this.loots = [];
    }
}
