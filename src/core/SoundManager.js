/**
 * SoundManager - Gerenciador de áudio do jogo
 * Carrega e reproduz sons de background e efeitos
 */

class SoundManager {
    constructor() {
        this.sounds = new Map();
        this.currentBGM = null;
        this.bgmVolume = 0.3;
        this.sfxVolume = 0.5;
        this.isMuted = false;
        this.isInitialized = false;

        // Lista de sons disponíveis
        this.soundPaths = {
            // BGM (Background Music)
            menu: '/assets/sounds/menu.mp3',
            gameplay: '/assets/sounds/gameplay.mp3',
            intense: '/assets/sounds/intense.mp3',
            victory: '/assets/sounds/victory.mp3',
            gameover: '/assets/sounds/gameover.mp3'
        };
    }

    /**
     * Inicializa o SoundManager e carrega todos os sons
     */
    async init() {
        if (this.isInitialized) return;

        console.log('[SoundManager] Inicializando...');

        const loadPromises = Object.entries(this.soundPaths).map(([name, path]) => {
            return this.loadSound(name, path);
        });

        await Promise.allSettled(loadPromises);

        this.isInitialized = true;
        console.log('[SoundManager] Inicializado com sucesso!');
    }

    /**
     * Carrega um som individual
     */
    async loadSound(name, path) {
        try {
            const audio = new Audio(path);
            audio.preload = 'auto';

            return new Promise((resolve, reject) => {
                audio.addEventListener('canplaythrough', () => {
                    this.sounds.set(name, audio);
                    console.log(`[SoundManager] Som carregado: ${name}`);
                    resolve(audio);
                }, { once: true });

                audio.addEventListener('error', (e) => {
                    console.warn(`[SoundManager] Erro ao carregar som: ${name}`, e);
                    reject(e);
                }, { once: true });

                audio.load();
            });
        } catch (error) {
            console.error(`[SoundManager] Falha ao carregar ${name}:`, error);
        }
    }

    /**
     * Reproduz música de fundo (BGM)
     */
    playBGM(name, loop = true) {
        if (this.isMuted) return;

        // Para a música atual se houver
        this.stopBGM();

        const audio = this.sounds.get(name);
        if (!audio) {
            console.warn(`[SoundManager] BGM não encontrada: ${name}`);
            return;
        }

        audio.loop = loop;
        audio.volume = this.bgmVolume;
        audio.currentTime = 0;

        const playPromise = audio.play();
        if (playPromise) {
            playPromise.catch(e => {
                console.warn('[SoundManager] Autoplay bloqueado, aguardando interação do usuário');
            });
        }

        this.currentBGM = audio;
        console.log(`[SoundManager] Tocando BGM: ${name}`);
    }

    /**
     * Para a música de fundo atual
     */
    stopBGM() {
        if (this.currentBGM) {
            this.currentBGM.pause();
            this.currentBGM.currentTime = 0;
            this.currentBGM = null;
        }
    }

    /**
     * Pausa a música de fundo
     */
    pauseBGM() {
        if (this.currentBGM) {
            this.currentBGM.pause();
        }
    }

    /**
     * Resume a música de fundo
     */
    resumeBGM() {
        if (this.currentBGM && !this.isMuted) {
            this.currentBGM.play().catch(() => { });
        }
    }

    /**
     * Reproduz um efeito sonoro
     */
    playSFX(name) {
        if (this.isMuted) return;

        const audio = this.sounds.get(name);
        if (!audio) {
            console.warn(`[SoundManager] SFX não encontrado: ${name}`);
            return;
        }

        // Clona o áudio para permitir múltiplas reproduções simultâneas
        const clone = audio.cloneNode();
        clone.volume = this.sfxVolume;
        clone.play().catch(() => { });
    }

    /**
     * Define o volume da BGM (0.0 a 1.0)
     */
    setBGMVolume(volume) {
        this.bgmVolume = Math.max(0, Math.min(1, volume));
        if (this.currentBGM) {
            this.currentBGM.volume = this.bgmVolume;
        }
    }

    /**
     * Define o volume dos efeitos sonoros (0.0 a 1.0)
     */
    setSFXVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
    }

    /**
     * Alterna o mudo
     */
    toggleMute() {
        this.isMuted = !this.isMuted;

        if (this.isMuted) {
            this.pauseBGM();
        } else {
            this.resumeBGM();
        }

        return this.isMuted;
    }

    /**
     * Define o estado de mudo
     */
    setMute(muted) {
        this.isMuted = muted;

        if (this.isMuted) {
            this.pauseBGM();
        } else {
            this.resumeBGM();
        }
    }

    /**
     * Libera recursos
     */
    dispose() {
        this.stopBGM();
        this.sounds.forEach(audio => {
            audio.pause();
            audio.src = '';
        });
        this.sounds.clear();
        this.isInitialized = false;
    }
}

// Exporta como singleton
const soundManager = new SoundManager();
export { soundManager, SoundManager };
export default soundManager;
