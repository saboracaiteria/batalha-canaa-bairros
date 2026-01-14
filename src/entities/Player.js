import * as THREE from 'three';
import { CharacterFactory } from './CharacterFactory.js';

/**
 * Player - Manages the local player entity
 */
export class Player {
    constructor(scene, name = "SOLDADO") {
        this.scene = scene;
        this.name = name;

        // Create player group
        this.group = new THREE.Group();
        this.charModel = CharacterFactory.createHumanoid(0x2E7D32, 'player', 'player');
        this.group.add(this.charModel);
        this.scene.add(this.group);

        // Player stats
        this.health = 100;
        this.armor = 100;
        this.kills = 0;

        // Movement state
        this.velocity = new THREE.Vector3();
        this.vY = 0;
        this.jumps = 0;
        this.isRunning = false;
        this.isADS = false;
        this.isShooting = false;

        // Camera angles
        this.yaw = 0;
        this.pitch = 0;

        // Spawn position
        this.group.position.set(0, 68, 0);
    }

    /**
     * Update player movement
     */
    updateMovement(moveVec, deltaTime, cameraYaw) {
        if (moveVec.length() > 0) {
            const speed = this.isRunning ? 0.4 : 0.2;
            const moveDir = new THREE.Vector3(moveVec.x, 0, moveVec.y);
            moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
            this.group.position.add(moveDir.multiplyScalar(speed));

            // Animate
            CharacterFactory.animateLimbs(this.charModel, deltaTime, true);
        } else {
            CharacterFactory.animateLimbs(this.charModel, deltaTime, false);
        }
    }

    /**
     * Apply gravity
     */
    applyGravity() {
        this.vY -= 0.04;
        this.group.position.y += this.vY;

        // Ground check
        if (this.group.position.y < 2) {
            this.group.position.y = 2;
            this.vY = 0;
            this.jumps = 0;
        }
    }

    /**
     * Jump
     */
    jump() {
        if (this.jumps < 2) {
            this.vY = 0.8;
            this.jumps++;
        }
    }

    /**
     * Take damage
     */
    takeDamage(amount) {
        if (this.armor > 0) {
            const armorDamage = Math.min(this.armor, amount);
            this.armor -= armorDamage;
            amount -= armorDamage;
        }

        if (amount > 0) {
            this.health -= amount;
        }

        this.health = Math.max(0, this.health);
        this.armor = Math.max(0, this.armor);

        return this.health <= 0;
    }

    /**
     * Heal player
     */
    heal(amount) {
        this.health = Math.min(100, this.health + amount);
    }

    /**
     * Add armor
     */
    addArmor(amount) {
        this.armor = Math.min(100, this.armor + amount);
    }

    /**
     * Get position
     */
    getPosition() {
        return this.group.position;
    }

    /**
     * Set rotation
     */
    setRotation(yaw) {
        if (this.charModel) {
            this.charModel.rotation.y = yaw + Math.PI;
        }
    }

    /**
     * Check collision with obstacles
     */
    checkCollision(obstacleBoxes) {
        const playerBox = new THREE.Box3().setFromObject(this.group);

        for (let i = 0; i < obstacleBoxes.length; i++) {
            if (playerBox.intersectsBox(obstacleBoxes[i])) {
                // Push back
                const pushDir = new THREE.Vector3();
                playerBox.getCenter(pushDir);
                const obstacleCenter = new THREE.Vector3();
                obstacleBoxes[i].getCenter(obstacleCenter);
                pushDir.sub(obstacleCenter).normalize().multiplyScalar(0.3);
                this.group.position.add(pushDir);
            }
        }
    }

    /**
     * Check if inside safe zone
     */
    isInZone(zoneCenter, zoneRadius) {
        const dist = this.group.position.distanceTo(zoneCenter);
        return dist <= zoneRadius;
    }

    /**
     * Get stats
     */
    getStats() {
        return {
            health: this.health,
            armor: this.armor,
            kills: this.kills,
            position: this.group.position.clone()
        };
    }
}
