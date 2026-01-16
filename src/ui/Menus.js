/**
 * Menus - Main menu, pause menu, and game screens
 */
export class Menus {
    constructor() {
        this.currentScreen = 'start';
        this.setupEventListeners();
    }

    /**
     * Setup menu event listeners
     */
    setupEventListeners() {
        // Tab switching
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.getAttribute('data-tab');
                if (tab) this.switchTab(tab);
            });
        });
    }

    /**
     * Switch between menu tabs
     */
    switchTab(tab) {
        // Remove active from all tabs
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

        // Hide all tab contents
        document.getElementById('tab-play')?.classList.add('hidden');
        document.getElementById('tab-config')?.classList.add('hidden');
        document.getElementById('tab-skins')?.classList.add('hidden');

        // Show selected tab
        const tabElement = document.getElementById(`tab-${tab}`);
        if (tabElement) {
            tabElement.classList.remove('hidden');
        }

        // 🌐 NETWORK CLEAUNUP
        if (tab !== 'multi' && window.gameNetwork) {
            window.gameNetwork.disconnect();
        }

        // Activate button
        const activeBtn = document.querySelector(`[data-tab="${tab}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }

    /**
     * Show start screen
     */
    showStartScreen() {
        document.getElementById('start-screen').style.display = 'flex';
        document.getElementById('game-container').style.display = 'none';
        document.getElementById('hud').style.display = 'none';
        this.currentScreen = 'start';
    }

    /**
     * Hide start screen and show game
     */
    hideStartScreen() {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('game-container').style.display = 'block';
        document.getElementById('hud').style.display = 'block';
        this.currentScreen = 'game';
    }

    /**
     * Show pause menu
     */
    showPauseMenu() {
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu) {
            pauseMenu.style.display = 'flex';
        }
        this.currentScreen = 'pause';
    }

    /**
     * Hide pause menu
     */
    hidePauseMenu() {
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu) {
            pauseMenu.style.display = 'none';
        }
        this.currentScreen = 'game';
    }

    /**
     * Show game over screen
     */
    showGameOver(stats) {
        const gameOverScreen = document.getElementById('game-over-screen');
        if (!gameOverScreen) return;

        gameOverScreen.style.display = 'flex';

        // Update stats
        if (stats) {
            const killsEl = gameOverScreen.querySelector('.final-kills');
            const rankEl = gameOverScreen.querySelector('.final-rank');

            if (killsEl) killsEl.textContent = stats.kills || 0;
            if (rankEl) rankEl.textContent = stats.rank || 1;
        }

        this.currentScreen = 'gameover';
    }

    /**
     * Hide game over screen
     */
    hideGameOver() {
        const gameOverScreen = document.getElementById('game-over-screen');
        if (gameOverScreen) {
            gameOverScreen.style.display = 'none';
        }
    }

    /**
     * Show victory screen
     */
    showVictory(stats) {
        const victoryScreen = document.getElementById('victory-screen');
        if (!victoryScreen) return;

        victoryScreen.style.display = 'flex';

        // Update stats
        if (stats) {
            const killsEl = victoryScreen.querySelector('.final-kills');
            if (killsEl) killsEl.textContent = stats.kills || 0;
        }

        this.currentScreen = 'victory';
    }

    /**
     * Hide victory screen
     */
    hideVictory() {
        const victoryScreen = document.getElementById('victory-screen');
        if (victoryScreen) {
            victoryScreen.style.display = 'none';
        }
    }

    /**
     * Get config values from menu
     */
    getConfig() {
        return {
            playerName: document.getElementById('player-name')?.value || 'SOLDADO',
            botCount: parseInt(document.getElementById('bot-count')?.value || 10),
            botDifficulty: parseInt(document.getElementById('bot-diff')?.value || 2),
            sensitivity: parseInt(document.getElementById('cfg-sens')?.value || 50) * 0.0003,
            fov: parseInt(document.getElementById('cfg-fov')?.value || 75),
            graphics: document.getElementById('cfg-graphics')?.value || 'low'
        };
    }

    /**
     * Update HUD element values
     */
    updateHudValue(elementId, value) {
        const el = document.getElementById(elementId);
        if (el) {
            if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
                el.value = value;
            } else {
                el.textContent = value;
            }
        }
    }

    /**
     * Show notification
     */
    showNotification(message, duration = 3000) {
        const notif = document.createElement('div');
        notif.className = 'notification';
        notif.textContent = message;
        notif.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px 30px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            font-size: 16px;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;

        document.body.appendChild(notif);

        setTimeout(() => {
            notif.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => notif.remove(), 300);
        }, duration);
    }

    /**
     * Add kill to kill log
     */
    addKillToLog(killerName, victimName, weapon) {
        const killLog = document.getElementById('kill-log');
        if (!killLog) return;

        const entry = document.createElement('div');
        entry.className = 'kill-entry';
        entry.style.cssText = `
            font-size: 12px;
            color: white;
            margin: 2px 0;
            text-shadow: 1px 1px 2px black;
        `;
        entry.textContent = `${killerName} [${weapon}] ${victimName}`;

        killLog.appendChild(entry);

        // Keep only last 5 kills
        while (killLog.children.length > 5) {
            killLog.removeChild(killLog.firstChild);
        }
    }

    /**
     * Update player stats display
     */
    updateStats(stats) {
        if (stats.health !== undefined) {
            const healthBar = document.getElementById('hp-bar');
            if (healthBar) healthBar.style.width = stats.health + '%';
        }

        if (stats.armor !== undefined) {
            const armorBar = document.getElementById('armor-bar');
            if (armorBar) armorBar.style.width = stats.armor + '%';
        }

        if (stats.kills !== undefined) {
            const killsEl = document.getElementById('count-kills');
            if (killsEl) killsEl.textContent = stats.kills;
        }

        if (stats.ammo !== undefined) {
            const ammoEl = document.getElementById('ammo-count');
            if (ammoEl) ammoEl.textContent = `${stats.ammo}/${stats.reserveAmmo || 0}`;
        }

        if (stats.alive !== undefined) {
            const aliveEl = document.getElementById('count-alive');
            if (aliveEl) aliveEl.textContent = stats.alive;
        }
    }
}
