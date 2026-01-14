/**
 * Loop - Game loop with delta time
 * Manages requestAnimationFrame and provides frame-independent timing
 */
export class Loop {
    constructor(game) {
        this.game = game;
        this.isRunning = false;
        this.lastTime = 0;
        this.deltaTime = 0;
        this.fps = 60;
        this.frameCount = 0;
        this.fpsUpdateTime = 0;

        // Bind the update method to preserve context
        this.boundUpdate = this.update.bind(this);
    }

    /**
     * Start the game loop
     */
    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.lastTime = performance.now();
        this.boundUpdate();

        console.log('🔄 Game loop started');
    }

    /**
     * Stop the game loop
     */
    stop() {
        this.isRunning = false;
        console.log('⏸️ Game loop stopped');
    }

    /**
     * Main update loop
     */
    update() {
        if (!this.isRunning) return;

        // Calculate delta time
        const currentTime = performance.now();
        this.deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap at 100ms
        this.lastTime = currentTime;

        // Update FPS counter
        this.frameCount++;
        if (currentTime - this.fpsUpdateTime > 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsUpdateTime = currentTime;
        }

        // Update game
        this.game.update(this.deltaTime);

        // Render
        this.game.render();

        // Schedule next frame
        requestAnimationFrame(this.boundUpdate);
    }

    /**
     * Get current FPS
     */
    getFPS() {
        return this.fps;
    }
}
