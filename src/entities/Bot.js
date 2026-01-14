import * as THREE from 'three';
import { CharacterFactory } from './CharacterFactory.js';

/**
 * Bot - AI-controlled enemy/ally characters
 */
export class Bot {
    constructor(scene, position, isAlly = false, difficulty = 2) {
        this.scene = scene;
        this.isAlly = isAlly;
        this.difficulty = difficulty;

        // Create bot model
        const color = isAlly ? 0x3b82f6 : 0xff0000;
        this.model = CharacterFactory.createHumanoid(color, 'bot' + Math.random(), 'bot');
        this.model.position.copy(position);
        this.scene.add(this.model);

        // Bot stats
        this.hp = 100;
        this.maxHp = 100;

        // AI state
        this.state = 'idle'; // idle, patrol, chase, attack
        this.target = null;
        this.lastShot = 0;
        this.patrolPoint = null;
        this.stuckTimer = 0;

        // Movement
        this.velocity = new THREE.Vector3();
        this.moveSpeed = 0.1;
        this.attackRange = 20;
        this.detectionRange = 80;
    }

    /**
     * Update bot AI (call every frame)
     */
    update(deltaTime, playerPosition, obstacles) {
        if (this.hp <= 0) return;

        // Update AI behavior
        this.updateAI(playerPosition);

        // Move bot
        this.updateMovement(deltaTime);

        // Animate limbs
        const isMoving = this.velocity.length() > 0.01;
        CharacterFactory.animateLimbs(this.model, deltaTime, isMoving);
    }

    /**
     * AI behavior logic
     */
    updateAI(playerPosition) {
        if (!playerPosition) return;

        // Calculate distance to player
        const distToPlayer = this.model.position.distanceTo(playerPosition);

        // Enemy behavior
        if (!this.isAlly) {
            if (distToPlayer < this.attackRange) {
                // Attack mode
                this.state = 'attack';
                this.velocity.set(0, 0, 0);
                this.lookAt(playerPosition);
            } else if (distToPlayer < this.detectionRange) {
                // Chase mode
                this.state = 'chase';
                this.moveTowards(playerPosition);
            } else {
                // Idle/Patrol
                this.state = 'idle';
                this.velocity.multiplyScalar(0.9);
            }
        } else {
            // Ally behavior - follow player
            if (distToPlayer > 30) {
                this.moveTowards(playerPosition);
            } else {
                this.velocity.multiplyScalar(0.9);
            }
        }
    }

    /**
     * Move towards target
     */
    moveTowards(targetPos) {
        const dir = new THREE.Vector3().subVectors(targetPos, this.model.position);
        dir.y = 0;
        dir.normalize();

        this.velocity.copy(dir).multiplyScalar(this.moveSpeed * (this.difficulty * 0.5));
        this.lookAt(targetPos);
    }

    /**
     * Look at target
     */
    lookAt(targetPos) {
        const dir = new THREE.Vector3().subVectors(targetPos, this.model.position);
        this.model.rotation.y = Math.atan2(dir.x, dir.z);
    }

    /**
     * Update movement physics
     */
    updateMovement(deltaTime) {
        if (this.velocity.length() > 0) {
            this.model.position.add(this.velocity);
        }
    }

    /**
     * Take damage
     */
    takeDamage(amount) {
        this.hp -= amount;
        this.hp = Math.max(0, this.hp);
        return this.hp <= 0;
    }

    /**
     * Should bot shoot?
     */
    shouldShoot(currentTime) {
        if (this.state !== 'attack') return false;

        const fireRate = this.difficulty === 1 ? 800 : this.difficulty === 2 ? 500 : 300;
        if (currentTime - this.lastShot > fireRate) {
            this.lastShot = currentTime;
            return true;
        }
        return false;
    }

    /**
     * Get shooting direction
     */
    getShootDirection(targetPos) {
        const dir = new THREE.Vector3().subVectors(targetPos, this.model.position);
        dir.normalize();

        // Add inaccuracy based on difficulty
        const accuracy = this.difficulty === 1 ? 0.3 : this.difficulty === 2 ? 0.15 : 0.05;
        dir.x += (Math.random() - 0.5) * accuracy;
        dir.y += (Math.random() - 0.5) * accuracy;
        dir.z += (Math.random() - 0.5) * accuracy;
        dir.normalize();

        return dir;
    }

    /**
     * Get position
     */
    getPosition() {
        return this.model.position;
    }

    /**
     * Destroy bot
     */
    destroy() {
        this.scene.remove(this.model);
    }
}

/**
 * BotManager - Manages all bots in the game
 */
export class BotManager {
    constructor(scene) {
        this.scene = scene;
        this.bots = [];
        this.spawnedCount = 0;
    }

    /**
     * Spawn bots around the periphery
     */
    spawnBots(count, difficulty = 2, gameMode = 'solo') {
        // Spawn enemies
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 100 + Math.random() * 200;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;

            const bot = new Bot(
                this.scene,
                new THREE.Vector3(x, 2, z),
                false,
                difficulty
            );
            this.bots.push(bot);
            this.spawnedCount++;
        }

        // Spawn allies based on game mode
        if (gameMode === 'duo') {
            this.spawnAlly();
        } else if (gameMode === 'squad') {
            for (let i = 0; i < 3; i++) {
                this.spawnAlly();
            }
        }
    }

    /**
     * Spawn ally bot
     */
    spawnAlly() {
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 10;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;

        const bot = new Bot(
            this.scene,
            new THREE.Vector3(x, 2, z),
            true,
            2
        );
        this.bots.push(bot);
    }

    /**
     * Update all bots
     */
    updateAll(deltaTime, playerPosition, obstacles) {
        for (let i = this.bots.length - 1; i >= 0; i--) {
            const bot = this.bots[i];

            if (bot.hp <= 0) {
                bot.destroy();
                this.bots.splice(i, 1);
                continue;
            }

            bot.update(deltaTime, playerPosition, obstacles);
        }
    }

    /**
     * Get all active bots
     */
    getBots() {
        return this.bots;
    }

    /**
     * Get enemy bots
     */
    getEnemies() {
        return this.bots.filter(b => !b.isAlly);
    }

    /**
     * Get ally bots
     */
    getAllies() {
        return this.bots.filter(b => b.isAlly);
    }

    /**
     * Remove all bots
     */
    clearAll() {
        this.bots.forEach(bot => bot.destroy());
        this.bots = [];
    }
}
