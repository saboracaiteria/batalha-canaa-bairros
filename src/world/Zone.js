import * as THREE from 'three';

/**
 * Zone - Battle Royale safe zone system
 */
export class Zone {
    constructor(scene) {
        this.scene = scene;
        this.active = false;
        this.radius = 500;
        this.targetRadius = 500;
        this.center = new THREE.Vector3(0, 0, 0);
        this.shrinkSpeed = 0.05;
        this.damagePerSecond = 5;

        // Visual cylinder mesh
        this.mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(1, 1, 1500, 32, 1, true),
            new THREE.MeshBasicMaterial({
                color: 0x00d4ff,
                transparent: true,
                opacity: 0.2,
                side: THREE.DoubleSide
            })
        );
        this.mesh.scale.set(this.radius, 1, this.radius);
        this.mesh.position.y = 750;
        this.scene.add(this.mesh);
    }

    /**
     * Start zone shrinking
     */
    activate() {
        this.active = true;
        console.log('⚠️ Zone is shrinking!');
    }

    /**
     * Set target radius (zone will shrink to this size)
     */
    shrinkTo(targetRadius, duration = 60) {
        this.targetRadius = targetRadius;
        this.shrinkSpeed = (this.radius - targetRadius) / (duration * 60); // 60 FPS
    }

    /**
     * Update zone (call every frame)
     */
    update(deltaTime) {
        if (!this.active) return;

        // Shrink zone
        if (this.radius > this.targetRadius) {
            this.radius -= this.shrinkSpeed;
            this.radius = Math.max(this.targetRadius, this.radius);

            // Update visual
            this.mesh.scale.set(this.radius, 1, this.radius);
        }
    }

    /**
     * Check if position is inside zone
     */
    isInside(position) {
        const dist = position.distanceTo(this.center);
        return dist <= this.radius;
    }

    /**
     * Get damage for position outside zone
     */
    getDamage(position, deltaTime) {
        if (this.isInside(position)) return 0;
        return this.damagePerSecond * deltaTime;
    }

    /**
     * Get zone stats
     */
    getStats() {
        return {
            active: this.active,
            radius: this.radius,
            targetRadius: this.targetRadius,
            center: this.center.clone()
        };
    }
}
