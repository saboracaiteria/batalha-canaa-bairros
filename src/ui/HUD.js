/**
 * HUD - Heads-up display (crosshair, health bars, buttons)
 */
export class HUD {
    constructor(game) {
        this.game = game;
        this.visible = false;
    }

    /**
     * Show HUD
     */
    show() {
        const hudEl = document.getElementById('hud');
        if (hudEl) {
            hudEl.style.display = 'block';
            this.visible = true;
        }
    }

    /**
     * Hide HUD
     */
    hide() {
        const hudEl = document.getElementById('hud');
        if (hudEl) {
            hudEl.style.display = 'none';
            this.visible = false;
        }
    }

    /**
     * Update HUD elements
     */
    update(deltaTime) {
        if (!this.visible) return;

        // Update health bar, ammo, etc.
    }
}
