import * as THREE from 'three';

/**
 * MathUtils - Shared math helpers and optimizations
 */

// Reusable vectors to avoid allocations
const _tempVec1 = new THREE.Vector3();
const _tempVec2 = new THREE.Vector3();
const _tempVec3 = new THREE.Vector3();

export const MathUtils = {
    /**
     * Get a temporary vector (reuse, don't store!)
     */
    getTempVector(index = 0) {
        if (index === 0) return _tempVec1;
        if (index === 1) return _tempVec2;
        if (index === 2) return _tempVec3;
        return new THREE.Vector3();
    },

    /**
     * Random float between min and max
     */
    randomRange(min, max) {
        return min + Math.random() * (max - min);
    },

    /**
     * Random integer between min and max (inclusive)
     */
    randomInt(min, max) {
        return Math.floor(this.randomRange(min, max + 1));
    },

    /**
     * Clamp value between min and max
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    /**
     * Linear interpolation
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    /**
     * Check if point is within radius of target
     */
    isWithinDistance(point1, point2, radius) {
        const dx = point1.x - point2.x;
        const dz = point1.z - point2.z;
        return (dx * dx + dz * dz) < (radius * radius);
    },

    /**
     * Get distance between two points (2D, ignoring Y)
     */
    distance2D(point1, point2) {
        const dx = point1.x - point2.x;
        const dz = point1.z - point2.z;
        return Math.sqrt(dx * dx + dz * dz);
    },

    /**
     * Get angle from point1 to point2 (radians)
     */
    angleTo(from, to) {
        return Math.atan2(to.z - from.z, to.x - from.x);
    },

    /**
     * Wrap angle to -PI to PI range
     */
    wrapAngle(angle) {
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        return angle;
    },

    /**
     * Get random point on circle
     */
    randomPointOnCircle(center, radius, result = new THREE.Vector3()) {
        const angle = Math.random() * Math.PI * 2;
        result.x = center.x + Math.cos(angle) * radius;
        result.y = center.y;
        result.z = center.z + Math.sin(angle) * radius;
        return result;
    },

    /**
     * Smooth damp (like Unity's SmoothDamp)
     */
    smoothDamp(current, target, velocity, smoothTime, deltaTime, maxSpeed = Infinity) {
        smoothTime = Math.max(0.0001, smoothTime);
        const omega = 2 / smoothTime;
        const x = omega * deltaTime;
        const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
        let change = current - target;
        const originalTo = target;
        const maxChange = maxSpeed * smoothTime;
        change = this.clamp(change, -maxChange, maxChange);
        target = current - change;
        const temp = (velocity + omega * change) * deltaTime;
        velocity = (velocity - omega * temp) * exp;
        let output = target + (change + temp) * exp;

        if (originalTo - current > 0.0 === output > originalTo) {
            output = originalTo;
            velocity = (output - originalTo) / deltaTime;
        }

        return { value: output, velocity };
    }
};
