import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * ModelLoader - Handles "Try Load or Fallback" logic for assets
 */
export class ModelLoader {
    static loader = new GLTFLoader();
    static cache = new Map();

    /**
     * Try to load a model from standard paths
     * @param {string} category - folder name inside assets/models (e.g., 'characters', 'maps', 'buildings')
     * @param {string} name - filename without extension
     * @returns {Promise<THREE.Group|null>} - The loaded model or null if not found
     */
    static async load(category, name) {
        const cacheKey = `${category}/${name}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey).clone();
        }

        // Try extensions in order: .glb, .gltf
        const extensions = ['glb', 'gltf'];

        for (const ext of extensions) {
            const path = `./assets/models/${category}/${name}.${ext}`;
            const exists = await this.checkFileExists(path);

            if (exists) {
                console.log(`📂 Found custom asset: ${path}`);
                try {
                    const gltf = await this.loadGLTF(path);
                    const model = gltf.scene;

                    // Standardize model
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });

                    this.cache.set(cacheKey, model);
                    return model.clone();
                } catch (e) {
                    console.error(`❌ Error loading ${path}:`, e);
                }
            }
        }

        // Return null to signal fallback to procedural
        return null;
    }

    /**
     * Check if file exists via HEAD request
     */
    static async checkFileExists(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch (e) {
            console.warn(`⚠️ Error checking ${url}:`, e);
            return false;
        }
    }

    /**
     * Wrap GLTFLoader in Promise
     */
    static loadGLTF(url) {
        return new Promise((resolve, reject) => {
            this.loader.load(url, resolve, undefined, reject);
        });
    }
}
