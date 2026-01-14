import * as THREE from 'three';
import { ModelLoader } from '../utils/ModelLoader.js';

/**
 * CharacterFactory - Creates humanoid characters with limb animations
 * Extracted from original game code
 */
export class CharacterFactory {
    /**
     * Create humanoid character with procedural geometry
     * @param {number} color - Body color
     * @param {string} id - Unique identifier
     * @param {string} modelName - Optional model filename to try loading
     * @returns {THREE.Group} Character group with limb references
     */
    static createHumanoid(color, id, modelName = null) {
        const group = new THREE.Group();
        const bodyContainer = new THREE.Group();
        group.add(bodyContainer);

        // --- PROCUDURAL GENERATION (FALLBACK) ---
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0ac69 });
        const shirtMat = new THREE.MeshStandardMaterial({ color: color });
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x251a15 });
        const jointMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
        const gunMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.5, roughness: 0.2 });

        // Hips
        const hips = new THREE.Group();
        hips.position.y = 1.25;
        bodyContainer.add(hips);
        hips.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.25), shirtMat));

        // Torso
        const waist = new THREE.Group();
        waist.position.y = 0.1;
        hips.add(waist);

        const wMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.35, 12), shirtMat);
        wMesh.position.y = 0.17; wMesh.scale.z = 0.55; waist.add(wMesh);

        const chest = new THREE.Group();
        chest.position.y = 0.35;
        waist.add(chest);

        const cMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.16, 0.55, 12), shirtMat);
        cMesh.position.y = 0.27; cMesh.scale.z = 0.6; chest.add(cMesh);

        // Cabeça
        const head = new THREE.Group();
        head.position.y = 0.82;
        chest.add(head);
        head.add(new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 16), skinMat));

        const hTop = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 12), hairMat);
        hTop.scale.set(0.95, 0.7, 1.15); hTop.position.y = 0.08; head.add(hTop);
        const hBack = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 12), hairMat);
        hBack.scale.set(0.92, 1.0, 1.0); hBack.position.set(0, -0.05, -0.08); head.add(hBack);

        // Braços e Pernas
        const limbs = {};

        function makeArm(isLeft) {
            const side = isLeft ? 1 : -1;
            const root = new THREE.Group();
            root.position.set(0.38 * side, 0.5, 0);
            chest.add(root);
            const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4), skinMat);
            upper.position.y = -0.2; root.add(upper);
            const elbow = new THREE.Group();
            elbow.position.y = -0.4; root.add(elbow);
            elbow.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8), jointMat));
            const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.4), skinMat);
            lower.position.y = -0.2; elbow.add(lower);

            if (!isLeft) {
                // Procedural Gun Group (Initial)
                const gun = new THREE.Group();
                gun.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.5), gunMat));
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6), gunMat);
                barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.7; gun.add(barrel);
                gun.position.set(0, -0.4, 0.2); gun.rotation.x = Math.PI / 2;
                elbow.add(gun);
                limbs.weapon = gun; limbs.rightElbow = elbow; limbs.rightArm = root;

                // Try to load weapon model (Async replacement)
                ModelLoader.load('weapons', 'ar').then(weaponModel => {
                    if (weaponModel) {
                        gun.clear();
                        gun.add(weaponModel);

                        // Adjust rotation if needed for imported models
                        // Standard GLB often face +Z, we might need rotation
                        weaponModel.rotation.y = Math.PI;
                        console.log('🔫 Loaded weapon model');
                    }
                });
            } else {
                limbs.leftElbow = elbow; limbs.leftArm = root;
            }
        }

        function makeLeg(isLeft) {
            const side = isLeft ? 1 : -1;
            const root = new THREE.Group();
            root.position.set(0.16 * side, 0, 0);
            hips.add(root);
            const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.6), skinMat);
            thigh.position.y = -0.3; root.add(thigh);
            const knee = new THREE.Group();
            knee.position.y = -0.6; root.add(knee);
            knee.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8), jointMat));
            const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.55), skinMat);
            calf.position.y = -0.27; knee.add(calf);
            const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.25), skinMat);
            foot.position.set(0, -0.55, 0.08); knee.add(foot);

            if (isLeft) { limbs.leftLeg = root; limbs.leftKnee = knee; }
            else { limbs.rightLeg = root; limbs.rightKnee = knee; }
        }

        makeArm(true); makeArm(false);
        makeLeg(true); makeLeg(false);

        // Mapeamento compatível
        group.userData = {
            limbs: limbs,
            bodyContainer: bodyContainer,
            waist: waist,
            chest: chest,
            head: head,
            hp: 100,
            id: id || Math.random(),
            vY: 0,
            isAlly: false,
            isProcedural: true
        };
        group.scale.set(2, 2, 2);

        // --- DUAL MODE LOADING ---
        /* DISABLED BY USER REQUEST - SKINS ARE UNSTABLE
        if (modelName) {
            ModelLoader.load('characters', modelName).then(model => {
                if (model) {
                    console.log(`✅ Loaded skin for ${modelName}`);

                    // Remove procedural content
                    bodyContainer.clear();

                    // PREPARE MODEL (Center and Scale)
                    const box = new THREE.Box3().setFromObject(model);
                    const size = box.getSize(new THREE.Vector3());
                    const center = box.getCenter(new THREE.Vector3());

                    // 1. Center the model at 0,0,0
                    model.position.x += (model.position.x - center.x);
                    model.position.y += (model.position.y - center.y);
                    model.position.z += (model.position.z - center.z);

                    // 2. Normalize height
                    const targetHeight = 1.8; 
                    const scaleFactor = targetHeight / size.y;
                    
                    if (Number.isFinite(scaleFactor) && scaleFactor > 0) {
                        model.scale.multiplyScalar(scaleFactor);
                    }

                    // 3. Align bottom to 0
                    model.position.y += targetHeight / 2;

                    // Add loaded model
                    bodyContainer.add(model);

                    // Clear limbs mapping to disable procedural animation
                    group.userData.limbs = null;
                    group.userData.isProcedural = false;

                } else {
                    console.error(`❌ Failed to load skin for ${modelName}`);
                }
            });
        }
        */

        return group;
    }

    /**
     * Animate character limbs based on movement
     */
    static animateLimbs(character, deltaTime, isMoving) {
        if (!character || !character.userData.limbs) return;

        const limbs = character.userData.limbs;
        const time = Date.now() * 0.005;

        if (isMoving) {
            // Walking animation
            limbs.leftLeg.rotation.x = Math.sin(time * 2) * 0.5;
            limbs.rightLeg.rotation.x = Math.sin(time * 2 + Math.PI) * 0.5;
            limbs.leftArm.rotation.x = Math.sin(time * 2 + Math.PI) * 0.3;
            limbs.rightArm.rotation.x = Math.sin(time * 2) * 0.3;
        } else {
            // Idle - smooth return to neutral
            limbs.leftLeg.rotation.x *= 0.9;
            limbs.rightLeg.rotation.x *= 0.9;
            limbs.leftArm.rotation.x *= 0.9;
            limbs.rightArm.rotation.x *= 0.9;
        }
    }
}
