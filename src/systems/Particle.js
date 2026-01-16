import * as THREE from 'three';
import { ObjectPool } from '../utils/ObjectPool.js';

/**
 * Particle System - Blood, Muzzle Flash, and Hit Effects
 * 
 * Uses ObjectPool to reuse 100 particle objects instead of creating/destroying.
 * This prevents garbage collection stutters during intense combat.
 */
export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;

        // Materials for different particle types
        this.materials = {
            blood: new THREE.MeshBasicMaterial({
                color: 0xff0000,
                transparent: true
            }),
            muzzle: new THREE.MeshBasicMaterial({
                color: 0xffff00,
                transparent: true
            }),
            dust: new THREE.MeshBasicMaterial({
                color: 0x8b8b8b,
                transparent: true
            })
        };

        // Geometries (shared)
        this.particleGeo = new THREE.SphereGeometry(0.3, 4, 4);

        // 🚀 OBJECT POOL - 100 particles pre-allocated
        this.particlePool = new ObjectPool(
            () => {
                const particle = new THREE.Mesh(
                    this.particleGeo,
                    this.materials.blood.clone() // Each needs own material for opacity
                );
                particle.visible = false;
                particle.userData.active = false;
                this.scene.add(particle);
                return particle;
            },
            (particle) => {
                particle.visible = false;
                particle.userData.active = false;
                particle.userData.life = 0;
                particle.material.opacity = 1.0;
            },
            100
        );

        this.activeParticles = [];
    }

    /**
     * Spawn blood splatter particles
     */
    spawnBlood(position, direction, count = 5) {
        for (let i = 0; i < count; i++) {
            const particle = this.particlePool.acquire();
            particle.position.copy(position);
            particle.visible = true;
            particle.userData.active = true;
            particle.userData.life = 30 + Math.random() * 20; // 30-50 frames
            particle.material.color.setHex(0xff0000);

            // Random spray direction
            const spread = 0.5;
            particle.userData.vel = new THREE.Vector3(
                direction.x + (Math.random() - 0.5) * spread,
                direction.y + (Math.random() - 0.5) * spread,
                direction.z + (Math.random() - 0.5) * spread
            ).multiplyScalar(0.3);

            particle.scale.set(
                0.5 + Math.random() * 0.5,
                0.5 + Math.random() * 0.5,
                0.5 + Math.random() * 0.5
            );

            this.activeParticles.push(particle);
        }
    }

    /**
     * Spawn muzzle flash
     */
    spawnMuzzleFlash(position, direction) {
        const particle = this.particlePool.acquire();
        particle.position.copy(position);
        particle.position.add(direction.clone().multiplyScalar(2));
        particle.visible = true;
        particle.userData.active = true;
        particle.userData.life = 3; // Very short
        particle.material.color.setHex(0xffff00);
        particle.userData.vel = new THREE.Vector3(0, 0, 0);
        particle.scale.set(2, 2, 2);

        this.activeParticles.push(particle);
    }

    /**
     * Spawn explosion/debris
     */
    spawnExplosion(position, color, count = 10) {
        for (let i = 0; i < count; i++) {
            const particle = this.particlePool.acquire();
            particle.position.copy(position);
            particle.visible = true;
            particle.userData.active = true;
            particle.userData.life = 40 + Math.random() * 20;
            particle.material.color.setHex(color);

            const speed = 0.5;
            particle.userData.vel = new THREE.Vector3(
                (Math.random() - 0.5) * speed,
                (Math.random() - 0.5) * speed + 0.2, // Upward bias
                (Math.random() - 0.5) * speed
            );

            particle.scale.set(
                0.8 + Math.random() * 0.5,
                0.8 + Math.random() * 0.5,
                0.8 + Math.random() * 0.5
            );

            this.activeParticles.push(particle);
        }
    }

    /**
     * Update all particles (call every frame)
     */
    update(deltaTime) {
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const particle = this.activeParticles[i];

            if (!particle.userData.active) {
                this.activeParticles.splice(i, 1);
                continue;
            }

            // Move particle
            if (particle.userData.vel) {
                particle.position.add(particle.userData.vel);
                particle.userData.vel.y -= 0.02; // Gravity for blood
            }

            // Fade out
            particle.userData.life--;
            particle.material.opacity = particle.userData.life / 50;

            if (particle.userData.life <= 0) {
                this.particlePool.release(particle);
                this.activeParticles.splice(i, 1);
            }
        }
    }

    /**
     * Get pool statistics (for debugging)
     */
    getStats() {
        return {
            active: this.activeParticles.length,
            poolStats: this.particlePool.getStats()
        };
    }
}
