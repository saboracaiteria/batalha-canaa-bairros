import * as THREE from 'three';

/**
 * Input - Centralized input handling for touch, joystick, and keyboard
 */
export class Input {
    constructor(game) {
        this.game = game;

        // Touch tracking
        this.moveTouchId = null;
        this.lookTouchId = null;
        this.fireTouchId = null;

        // Movement vector
        this.moveVector = new THREE.Vector2(0, 0);

        // Look deltas
        this.lookDelta = new THREE.Vector2(0, 0);
        this.lastX = 0;
        this.lastY = 0;
        this.fireLastX = 0;
        this.fireLastY = 0;

        // Button states
        this.buttons = {
            jump: false,
            run: false,
            ads: false,
            shoot: false,
            grenade: false
        };

        this.setupListeners();
    }

    /**
     * Setup event listeners
     */
    setupListeners() {
        // Touch events
        window.addEventListener('touchstart', (e) => this.onTouchStart(e));
        window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        window.addEventListener('touchend', (e) => this.onTouchEnd(e));

        // Keyboard events (for PC testing)
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
    }

    /**
     * Handle touch start
     */
    onTouchStart(e) {
        if (this.game.isPaused) return;

        for (let touch of e.changedTouches) {
            // Left side = movement joystick
            if (touch.clientX < window.innerWidth / 2.5) {
                this.moveTouchId = touch.identifier;
            }
            // Right side = look/aim
            else if (!touch.target.classList.contains('hud-el')) {
                this.lookTouchId = touch.identifier;
                this.lastX = touch.clientX;
                this.lastY = touch.clientY;
            }
        }
    }

    /**
     * Handle touch move
     */
    onTouchMove(e) {
        if (this.game.isPaused) return;

        for (let touch of e.changedTouches) {
            // Movement joystick
            if (touch.identifier === this.moveTouchId) {
                const joyZone = document.getElementById('joy-zone');
                if (!joyZone) continue;

                const rect = joyZone.getBoundingClientRect();
                let dx = touch.clientX - (rect.left + rect.width / 2);
                let dy = touch.clientY - (rect.top + rect.height / 2);

                // Clamp to circle
                const distance = Math.hypot(dx, dy);
                if (distance > 65) {
                    dx *= 65 / distance;
                    dy *= 65 / distance;
                }

                // Update knob position
                const knob = document.getElementById('joy-knob');
                if (knob) {
                    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                }

                // Update movement vector
                this.moveVector.set(dx / 65, -dy / 65);
            }

            // Fire button (with look)
            else if (touch.identifier === this.fireTouchId) {
                const sensitivity = this.game.config.sensitivity * 0.8;
                this.lookDelta.x -= (touch.clientX - this.fireLastX) * sensitivity;
                this.lookDelta.y -= (touch.clientY - this.fireLastY) * sensitivity;
                this.fireLastX = touch.clientX;
                this.fireLastY = touch.clientY;
            }

            // Regular look
            else if (touch.identifier === this.lookTouchId) {
                const sensitivity = this.game.config.sensitivity;
                this.lookDelta.x -= (touch.clientX - this.lastX) * sensitivity;
                this.lookDelta.y -= (touch.clientY - this.lastY) * sensitivity;
                this.lastX = touch.clientX;
                this.lastY = touch.clientY;
            }
        }
    }

    /**
     * Handle touch end
     */
    onTouchEnd(e) {
        for (let touch of e.changedTouches) {
            if (touch.identifier === this.moveTouchId) {
                this.moveTouchId = null;
                this.moveVector.set(0, 0);

                const knob = document.getElementById('joy-knob');
                if (knob) {
                    knob.style.transform = 'translate(-50%, -50%)';
                }
            }

            if (touch.identifier === this.fireTouchId) {
                this.fireTouchId = null;
                this.buttons.shoot = false;
                this.buttons.ads = false;
            }

            if (touch.identifier === this.lookTouchId) {
                this.lookTouchId = null;
            }
        }
    }

    /**
     * Handle keyboard down (PC testing)
     */
    onKeyDown(e) {
        switch (e.code) {
            case 'Space': this.buttons.jump = true; break;
            case 'ShiftLeft': this.buttons.run = true; break;
            case 'KeyE': this.buttons.grenade = true; break;

            // WASD Movement
            case 'KeyW': this.moveVector.y = 1; break;
            case 'KeyS': this.moveVector.y = -1; break;
            case 'KeyA': this.moveVector.x = -1; break;
            case 'KeyD': this.moveVector.x = 1; break;
        }
    }

    /**
     * Handle keyboard up
     */
    onKeyUp(e) {
        switch (e.code) {
            case 'Space': this.buttons.jump = false; break;
            case 'ShiftLeft': this.buttons.run = false; break;
            case 'KeyE': this.buttons.grenade = false; break;

            // WASD Stop
            case 'KeyW': if (this.moveVector.y > 0) this.moveVector.y = 0; break;
            case 'KeyS': if (this.moveVector.y < 0) this.moveVector.y = 0; break;
            case 'KeyA': if (this.moveVector.x < 0) this.moveVector.x = 0; break;
            case 'KeyD': if (this.moveVector.x > 0) this.moveVector.x = 0; break;
        }
    }

    /**
     * Get movement vector (-1 to 1 on each axis)
     */
    getMovementVector() {
        return this.moveVector;
    }

    /**
     * Get look delta and reset
     */
    getLookDelta() {
        const delta = this.lookDelta.clone();
        this.lookDelta.set(0, 0);
        return delta;
    }

    /**
     * Check if button is pressed
     */
    isButtonPressed(button) {
        return this.buttons[button] || false;
    }

    /**
     * Set button state (for HUD buttons)
     */
    setButton(button, state) {
        this.buttons[button] = state;
    }
}
