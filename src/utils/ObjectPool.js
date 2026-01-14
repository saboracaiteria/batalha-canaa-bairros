/**
 * ObjectPool - THE SECRET to 60+ FPS on mobile
 * 
 * Prevents garbage collection stutters by reusing objects instead of 
 * constantly creating/destroying them (new/delete).
 * 
 * Usage:
 *   const bulletPool = new ObjectPool(
 *     () => new THREE.Mesh(geometry, material),
 *     (bullet) => bullet.visible = false
 *   );
 *   
 *   const bullet = bulletPool.acquire();
 *   bullet.position.set(x, y, z);
 *   bullet.visible = true;
 *   
 *   // Later...
 *   bulletPool.release(bullet);
 */
export class ObjectPool {
    constructor(createFn, resetFn, initialSize = 100) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.pool = [];
        this.active = new Set();

        // Pre-allocate objects to avoid creation during gameplay
        for (let i = 0; i < initialSize; i++) {
            const obj = this.createFn();
            this.resetFn(obj);
            this.pool.push(obj);
        }
    }

    /**
     * Get an object from the pool (or create new if pool is empty)
     */
    acquire() {
        let obj;

        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            // Pool exhausted, create new (rare case)
            obj = this.createFn();
        }

        this.active.add(obj);
        return obj;
    }

    /**
     * Return an object to the pool for reuse
     */
    release(obj) {
        if (!this.active.has(obj)) {
            console.warn('Attempting to release object not from this pool');
            return;
        }

        this.active.delete(obj);
        this.resetFn(obj);
        this.pool.push(obj);
    }

    /**
     * Release all active objects back to pool
     */
    releaseAll() {
        this.active.forEach(obj => {
            this.resetFn(obj);
            this.pool.push(obj);
        });
        this.active.clear();
    }

    /**
     * Get statistics for debugging
     */
    getStats() {
        return {
            poolSize: this.pool.length,
            activeCount: this.active.size,
            totalCreated: this.pool.length + this.active.size
        };
    }
}
