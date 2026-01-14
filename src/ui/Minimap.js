/**
 * Minimap - 2D tactical map renderer
 */
export class Minimap {
    constructor(canvasId = 'minimap-canvas') {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.warn('Minimap canvas not found');
            return;
        }

        this.canvas.width = 100;
        this.canvas.height = 100;
        this.ctx = this.canvas.getContext('2d');
        this.mapScale = 0.12;
    }

    /**
     * Update minimap (call every frame)
     */
    update(playerPos, bots, zoneRadius, zoneCenter) {
        if (!this.ctx) return;

        const w = this.canvas.width;
        const h = this.canvas.height;
        const ctx = this.ctx;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = "rgba(10, 20, 40, 0.8)";
        ctx.fillRect(0, 0, w, h);

        const centerX = w / 2;
        const centerY = h / 2;

        // Draw zone circle
        if (zoneRadius > 0) {
            ctx.strokeStyle = "rgba(255, 234, 0, 0.5)";
            ctx.lineWidth = 2;
            ctx.beginPath();

            // Calculate zone position relative to player
            const zonePosX = centerX + (zoneCenter.x - playerPos.x) * this.mapScale;
            const zonePosY = centerY + (zoneCenter.z - playerPos.z) * this.mapScale;

            ctx.arc(zonePosX, zonePosY, zoneRadius * this.mapScale, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw bots
        bots.forEach(bot => {
            const botPos = bot.getPosition ? bot.getPosition() : bot.position;
            const bx = centerX + (botPos.x - playerPos.x) * this.mapScale;
            const by = centerY + (botPos.z - playerPos.z) * this.mapScale;

            // Only draw if on screen
            if (bx > 0 && bx < w && by > 0 && by < h) {
                // Color based on ally/enemy
                ctx.fillStyle = bot.isAlly ? "#3b82f6" : "#ff4444";
                ctx.beginPath();
                ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // Draw player (always center)
        ctx.fillStyle = "#00ff00";
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Player direction indicator
        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX, centerY - 8);
        ctx.stroke();
    }

    /**
     * Toggle minimap visibility
     */
    toggle() {
        if (this.canvas) {
            const isVisible = this.canvas.style.display !== 'none';
            this.canvas.style.display = isVisible ? 'none' : 'block';
        }
    }

    /**
     * Set map scale
     */
    setScale(scale) {
        this.mapScale = scale;
    }
}
