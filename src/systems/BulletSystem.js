import * as THREE from 'three';

/**
 * BulletSystem - Handles shooting, bullet trails, and impacts
 * Ported from VibeFPS BulletPhysics.js
 */
export class BulletSystem {
    constructor(game) {
        this.game = game;
        this.activeBullets = [];
        this.bulletSpeed = 300; // m/s
        this.onHit = null; // Callback for damage logic

        // Effects configuration
        this.maxTrailPoints = 20;
    }

    init() {
        if (this.game.onHit) this.onHit = this.game.onHit;
        console.log('🔫 BulletSystem initialized');
    }

    createBullet(origin, direction) {
        const bullet = {
            position: origin.clone(),
            velocity: direction.clone().normalize().multiplyScalar(this.bulletSpeed),
            trail: this.createBulletTrail(origin),
            mesh: this.createBulletMesh(origin), // Create Visual
            life: 2.0, // Seconds
            distanceTraveled: 0
        };

        this.activeBullets.push(bullet);

        // Muzzle flash
        if (this.game.particleSystem) {
            this.game.particleSystem.spawnMuzzleFlash(origin, direction);
        }

        return bullet;
    }

    createBulletTrail(startPosition) {
        const material = new THREE.LineBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(3 * 2); // Start with 2 points

        // Initialize at start position
        for (let i = 0; i < 2; i++) {
            positions[i * 3] = startPosition.x;
            positions[i * 3 + 1] = startPosition.y;
            positions[i * 3 + 2] = startPosition.z;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const line = new THREE.Line(geometry, material);
        this.game.scene.add(line);

        return line;
    }

    createBulletMesh(position) {
        const geometry = new THREE.SphereGeometry(0.2, 4, 4);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        this.game.scene.add(mesh);
        return mesh;
    }

    update(deltaTime) {
        for (let i = this.activeBullets.length - 1; i >= 0; i--) {
            const bullet = this.activeBullets[i];

            // Move bullet
            const moveStep = bullet.velocity.clone().multiplyScalar(deltaTime);
            const nextPosition = bullet.position.clone().add(moveStep);

            // Raycast for collision
            const direction = moveStep.clone().normalize();
            const distance = moveStep.length();

            // Check collision using game physics
            let hit = null;
            if (this.game.physics) {
                hit = this.game.physics.raycast(bullet.position, direction, distance);
            }

            if (hit) {
                // Hit something!
                this.handleHit(hit, bullet);
                this.removeBullet(i);
                continue;
            }

            // No hit, update position
            bullet.position.copy(nextPosition);
            if (bullet.mesh) bullet.mesh.position.copy(nextPosition);
            bullet.life -= deltaTime;

            // Update trail
            this.updateTrail(bullet);

            if (bullet.life <= 0) {
                this.removeBullet(i);
            }
        }
    }

    updateTrail(bullet) {
        if (!bullet.trail) return;

        const positions = bullet.trail.geometry.attributes.position.array;
        // Shift old points
        for (let i = 0; i < positions.length - 3; i++) {
            positions[i] = positions[i + 3];
        }

        // Set last point to current position
        const idx = positions.length - 3;
        positions[idx] = bullet.position.x;
        positions[idx + 1] = bullet.position.y;
        positions[idx + 2] = bullet.position.z;

        bullet.trail.geometry.attributes.position.needsUpdate = true;
    }

    handleHit(hit, bullet) {
        // Impact effect
        if (this.game.particleSystem) {
            // Determine surface type if possible, default to generic
            this.game.particleSystem.spawnExplosion(hit.point, 0xcccccc);
        }

        // Bullet hole decal (simplified)
        // Only if it's static geometry (not an entity that moves away)
        if (!hit.object.userData.isEntity) {
            this.createBulletHole(hit.point, hit.face.normal);
        }

        // Damage Logic callback
        if (this.onHit) {
            this.onHit(hit, bullet);
        }
    }

    createBulletHole(position, normal) {
        const geometry = new THREE.CircleGeometry(0.05, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0x111111,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -1 // Pull forward to avoid z-fighting
        });

        const decal = new THREE.Mesh(geometry, material);
        decal.position.copy(position);

        // Align to surface normal
        decal.lookAt(position.clone().add(normal));

        // Offset slightly
        decal.position.add(normal.clone().multiplyScalar(0.02));

        this.game.scene.add(decal);

        // Remove after 10 seconds
        setTimeout(() => {
            this.game.scene.remove(decal);
            geometry.dispose();
            material.dispose();
        }, 10000);
    }

    removeBullet(index) {
        const bullet = this.activeBullets[index];
        if (bullet.trail) {
            this.game.scene.remove(bullet.trail);
            bullet.trail.geometry.dispose();
            bullet.trail.material.dispose();
        }
        if (bullet.mesh) {
            this.game.scene.remove(bullet.mesh);
            bullet.mesh.geometry.dispose();
            bullet.mesh.material.dispose();
        }
        this.activeBullets.splice(index, 1);
    }
}
