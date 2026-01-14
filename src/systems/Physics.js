import * as THREE from 'three';

/**
 * Physics - Advanced collision detection and physics simulation
 */
export class Physics {
    constructor(game) {
        this.game = game;
        this.gravity = -0.04;
        this.obstacleBoxes = [];
        this.solidObstacles = [];
        this.groundObstacles = [];

        // Raycasters
        this.raycaster = new THREE.Raycaster();
        this.floorRay = new THREE.Raycaster();
    }

    /**
     * Update collision boxes from obstacles
     */
    updateCollisionBoxes(obstacles) {
        this.obstacleBoxes = [];
        this.solidObstacles = [];
        this.groundObstacles = [];

        obstacles.forEach(obstacle => {
            if (!obstacle.geometry) return;

            // Solid obstacles (walls, buildings)
            if (obstacle.userData.isSolid !== false && !obstacle.userData.isGround) {
                const box = new THREE.Box3().setFromObject(obstacle);
                box.userData = obstacle.userData;
                this.obstacleBoxes.push(box);
                this.solidObstacles.push(obstacle);
            }

            // Ground obstacles (floor, roofs)
            if (obstacle.userData.isGround || obstacle.userData.isRoof) {
                this.groundObstacles.push(obstacle);
            }
        });

        console.log(`📦 Updated collision: ${this.obstacleBoxes.length} solid, ${this.groundObstacles.length} ground`);
    }

    /**
     * Check box collision with obstacles
     */
    checkBoxCollision(box, pushBack = true) {
        const collisions = [];

        for (let i = 0; i < this.obstacleBoxes.length; i++) {
            if (box.intersectsBox(this.obstacleBoxes[i])) {
                collisions.push(this.obstacleBoxes[i]);

                if (pushBack) {
                    // Calculate push direction
                    const pushDir = new THREE.Vector3();
                    box.getCenter(pushDir);

                    const obstacleCenter = new THREE.Vector3();
                    this.obstacleBoxes[i].getCenter(obstacleCenter);

                    pushDir.sub(obstacleCenter).normalize();
                    collisions.push({ pushDirection: pushDir.multiplyScalar(0.3) });
                }
            }
        }

        return collisions;
    }

    /**
     * Raycast for bullet/projectile collision
     */
    raycast(origin, direction, maxDistance = 1000, excludeObjects = []) {
        this.raycaster.set(origin, direction.normalize());
        this.raycaster.far = maxDistance;

        const intersects = this.raycaster.intersectObjects(this.solidObstacles, true);

        // Filter out excluded objects
        const filtered = intersects.filter(hit => {
            return !excludeObjects.includes(hit.object);
        });

        return filtered.length > 0 ? filtered[0] : null;
    }

    /**
     * Check ground below position
     */
    checkGround(position, maxDistance = 10) {
        const down = new THREE.Vector3(0, -1, 0);
        this.floorRay.set(position, down);
        this.floorRay.far = maxDistance;

        const intersects = this.floorRay.intersectObjects(this.groundObstacles, true);
        return intersects.length > 0 ? intersects[0] : null;
    }

    /**
     * Check if line of sight is clear between two points
     */
    hasLineOfSight(from, to) {
        const direction = new THREE.Vector3().subVectors(to, from);
        const distance = direction.length();

        const hit = this.raycast(from, direction, distance);
        return hit === null;
    }

    /**
     * Apply gravity to velocity
     */
    applyGravity(velocity) {
        velocity.y += this.gravity;
        return velocity;
    }

    /**
     * Get all obstacles
     */
    getObstacles() {
        return {
            boxes: this.obstacleBoxes,
            solid: this.solidObstacles,
            ground: this.groundObstacles
        };
    }

    /**
     * Physics update (legacy compatibility)
     */
    update(deltaTime) {
        // Placeholder for future physics updates
    }

    /**
     * Check collision (legacy compatibility)
     */
    checkCollision(position, radius) {
        const box = new THREE.Box3(
            new THREE.Vector3(position.x - radius, position.y - radius, position.z - radius),
            new THREE.Vector3(position.x + radius, position.y + radius, position.z + radius)
        );

        const collisions = this.checkBoxCollision(box, false);
        return collisions.length > 0;
    }
}
