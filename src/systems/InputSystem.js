import * as THREE from 'three';

/**
 * InputSystem - Handles Keyboard, Mouse, and Touch inputs
 * Ported from VibeFPS InputManager.js
 */
export class InputSystem {
    constructor(game) {
        this.game = game;
        this.keys = {
            moveForward: false,
            moveBackward: false,
            moveLeft: false,
            moveRight: false,
            jump: false,
            sprint: false,
            crouch: false // for Slide Boost
        };
        this.mouse = { x: 0, y: 0 };
        this.touch = {
            joystickActive: false,
            joystickIdentifier: null,
            joystickPosition: { x: 0, y: 0 },
            lookActive: false,
            lookIdentifier: null,
            lookStart: { x: 0, y: 0 },
            lookCurrent: { x: 0, y: 0 }
        };
        this.pointerLocked = false;
        this.isMobile = false;

        // Camera rotation state
        this.cameraPitch = 0;
        this.cameraYaw = 0;

        // Settings
        this.sensitivity = 0.002;
    }

    init() {
        this.checkMobile();

        // Keyboard events
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));

        // Mouse events
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mousedown', this.onMouseDown.bind(this));

        // Pointer lock
        document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));

        if (this.isMobile) {
            this.setupMobileControls();
        }

        console.log('🎮 InputSystem initialized');
    }

    checkMobile() {
        // Force mobile if UI elements exist (for testing on PC or missed agents)
        const hasJoystick = document.getElementById('joy-zone') !== null;
        this.isMobile = hasJoystick || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (this.isMobile) {
            console.log('📱 Mobile mode activated (Device or UI detected)');
            // Ensure mobile controls UI exists (legacy check, can probably remove or keep)
            const mobileControls = document.getElementById('mobileControls');
            if (mobileControls) mobileControls.style.display = 'flex';
        }
    }

    onKeyDown(event) {
        switch (event.code) {
            case 'KeyW': this.keys.moveForward = true; break;
            case 'KeyS': this.keys.moveBackward = true; break;
            case 'KeyA': this.keys.moveLeft = true; break;
            case 'KeyD': this.keys.moveRight = true; break;
            case 'Space': this.keys.jump = true; break;
            case 'ShiftLeft': this.keys.sprint = true; break;
            case 'KeyC': this.keys.crouch = true; break;
            case 'KeyR': if (this.game.player) this.game.player.reload(); break;
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW': this.keys.moveForward = false; break;
            case 'KeyS': this.keys.moveBackward = false; break;
            case 'KeyA': this.keys.moveLeft = false; break;
            case 'KeyD': this.keys.moveRight = false; break;
            case 'Space': this.keys.jump = false; break;
            case 'ShiftLeft': this.keys.sprint = false; break;
            case 'KeyC': this.keys.crouch = false; break;
        }
    }

    onMouseMove(event) {
        if (!this.pointerLocked) return;

        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;

        this.cameraYaw -= movementX * this.sensitivity;
        this.cameraPitch -= movementY * this.sensitivity;

        // Clamp pitch
        this.cameraPitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.cameraPitch));

        this.updateCameraRotation();
    }

    onMouseDown(event) {
        if (!this.pointerLocked) {
            document.body.requestPointerLock();
        } else {
            if (event.button === 0 && this.game.weapon) {
                this.game.weapon.shoot();
            }
        }
    }

    onPointerLockChange() {
        this.pointerLocked = document.pointerLockElement === document.body;
    }

    updateCameraRotation() {
        if (!this.game.camera) return;

        // Order YXZ is important for FPS cameras to prevent gimbal lock
        this.game.camera.rotation.order = 'YXZ';

        // Using Quaternions for smoother rotation
        const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraYaw);
        const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.cameraPitch);

        const qFinal = qYaw.multiply(qPitch);
        this.game.camera.quaternion.copy(qFinal);
    }

    setupMobileControls() {
        const joystick = document.getElementById('joy-zone');
        const joystickKnob = document.getElementById('joy-knob');
        // We will handle shooting via separate buttons in main.js or bind them here
        // For now, let's just make sure joystick works

        if (!joystick || !joystickKnob) {
            console.warn('⚠️ Mobile controls elements not found! Expected IDs: joy-zone, joy-knob');
            return;
        }

        // Helper for UI checks - UPDATED to allow all UI interactions
        const isUIElement = (element) => {
            return element.closest('.ui-button') ||
                element.closest('#hud-container') ||
                element.closest('.icon-btn') ||
                element.closest('.pause-btn') ||
                element.closest('.btn-main') ||
                element.closest('.pause-option') || // For sliders
                element.tagName === 'BUTTON' ||
                element.tagName === 'INPUT' ||
                element.tagName === 'SELECT';
        };

        document.addEventListener('touchstart', (e) => {
            if (isUIElement(e.target)) return;
            e.preventDefault();

            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];

                // Left side: Joystick
                if (touch.clientX < window.innerWidth / 2) {
                    if (!this.touch.joystickActive) {
                        this.touch.joystickActive = true;
                        this.touch.joystickIdentifier = touch.identifier;

                        // Dynamic Joystick Logic
                        joystick.style.display = 'block';
                        // Center is 70px (width 140 / 2)
                        joystick.style.left = (touch.clientX - 70) + 'px';
                        joystick.style.top = (touch.clientY - 70) + 'px';

                        this.updateJoystickPosition(touch, joystick, joystickKnob);
                    }
                }
                // Right side: Look
                else {
                    if (!this.touch.lookActive) {
                        this.touch.lookActive = true;
                        this.touch.lookIdentifier = touch.identifier;
                        this.touch.lookStart.x = touch.clientX;
                        this.touch.lookStart.y = touch.clientY;
                        this.touch.lookCurrent.x = touch.clientX;
                        this.touch.lookCurrent.y = touch.clientY;
                    }
                }
            }
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (isUIElement(e.target)) return;
            e.preventDefault();

            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];

                if (this.touch.joystickActive && touch.identifier === this.touch.joystickIdentifier) {
                    this.updateJoystickPosition(touch, joystick, joystickKnob);
                }

                if (this.touch.lookActive && touch.identifier === this.touch.lookIdentifier) {
                    const deltaX = touch.clientX - this.touch.lookCurrent.x;
                    const deltaY = touch.clientY - this.touch.lookCurrent.y;

                    this.cameraYaw -= deltaX * (this.sensitivity * 2); // Higher sensitivity for touch
                    this.cameraPitch -= deltaY * (this.sensitivity * 2);

                    this.cameraPitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.cameraPitch));
                    this.updateCameraRotation();

                    this.touch.lookCurrent.x = touch.clientX;
                    this.touch.lookCurrent.y = touch.clientY;
                }
            }
        }, { passive: false });

        const endTouch = (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];

                if (this.touch.joystickActive && touch.identifier === this.touch.joystickIdentifier) {
                    this.touch.joystickActive = false;
                    this.touch.joystickIdentifier = null;
                    this.touch.joystickPosition = { x: 0, y: 0 };
                    joystickKnob.style.transform = 'translate(-50%, -50%)';
                    joystick.style.display = 'none'; // Hide Joystick

                    this.keys.moveForward = false;
                    this.keys.moveBackward = false;
                    this.keys.moveLeft = false;
                    this.keys.moveRight = false;
                }

                if (this.touch.lookActive && touch.identifier === this.touch.lookIdentifier) {
                    this.touch.lookActive = false;
                    this.touch.lookIdentifier = null;
                }
            }
        };

        document.addEventListener('touchend', endTouch, { passive: false });
        document.addEventListener('touchcancel', endTouch, { passive: false });

        // Shoot button HANDLED IN MAIN.JS VIA HUD ELEMENTS
        /* 
        if (shootButton) {
            shootButton.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.game.weapon) this.game.weapon.shoot();
            }, { passive: false });
        }
        */
    }

    updateJoystickPosition(touch, joystick, joystickKnob) {
        const rect = joystick.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let deltaX = touch.clientX - centerX;
        let deltaY = touch.clientY - centerY;

        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const maxDistance = rect.width / 2 - 20; // 20px padding

        if (distance > maxDistance) {
            deltaX = (deltaX / distance) * maxDistance;
            deltaY = (deltaY / distance) * maxDistance;
        }

        joystickKnob.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;

        // Update move keys based on joystick position
        const threshold = 0.3;
        const normalizedY = deltaY / maxDistance;
        const normalizedX = deltaX / maxDistance;

        this.keys.moveForward = normalizedY < -threshold;
        this.keys.moveBackward = normalizedY > threshold;
        this.keys.moveLeft = normalizedX < -threshold;
        this.keys.moveRight = normalizedX > threshold;
    }
}
