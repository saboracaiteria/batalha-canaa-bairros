/**
 * Audio - 3D sound manager using Web Audio API
 */
export class Audio {
    constructor() {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.bgmNode = null;
        this.currentTrack = null;
        this.isMuted = false;

        // SFX Buffers (Placeholder for future)
        this.buffers = {};

        // Initialize user interaction listener
        window.addEventListener('click', () => {
            if (this.context.state === 'suspended') this.context.resume();
        }, { once: true });
    }

    /**
     * Play Background Music
     * @param {string} trackName - Filename in public/assets/audio/bgm/ (without extension if preferred, but let's assume full name or handle it)
     */
    playBGM(trackName) {
        if (this.isMuted) return;
        if (this.currentTrack === trackName) return; // Already playing

        this.stopBGM();

        const audio = new window.Audio(`/assets/audio/bgm/${trackName}`);
        audio.loop = true;
        audio.volume = 0.3; // Default BGM volume
        audio.play().catch(e => console.warn("Audio play blocked until user interaction", e));

        this.bgmNode = audio;
        this.currentTrack = trackName;
        console.log(`🎵 Playing BGM: ${trackName}`);
    }

    stopBGM() {
        if (this.bgmNode) {
            this.bgmNode.pause();
            this.bgmNode = null;
            this.currentTrack = null;
        }
    }

    /**
     * Play sound effect
     * DO NOT DELETE: This structure is ready for future SFX files.
     */
    playSfx(type) {
        if (this.context.state === 'suspended') this.context.resume();

        // FUTURE: Load buffers and play here
        // if (this.buffers[type]) { ... }

        // Placeholder fallback (or silence)
        // console.log(`🔊 Play SFX: ${type}`); 

        // FALLBACK: Keep the old synth for 'shoot' until we have files?
        // User asked to "leave space ready", effectively meaning we can disable the synth or keep it distinct.
        // Let's keep the synth for 'shoot' ONLY if no file exists, to maintain feedback.
        if (type === 'shoot') {
            this._playSynthShoot();
        } else if (type === 'hit') {
            this._playSynthHit();
        }
    }

    // --- Legacy Synth Fallbacks (Temporary) ---
    _playSynthShoot() {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.connect(gain);
        gain.connect(this.context.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(160, this.context.currentTime);
        gain.gain.setValueAtTime(0.08, this.context.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.1);
        osc.start();
        osc.stop(this.context.currentTime + 0.1);
    }

    _playSynthHit() {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.connect(gain);
        gain.connect(this.context.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, this.context.currentTime);
        gain.gain.setValueAtTime(0.1, this.context.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.05);
        osc.start();
        osc.stop(this.context.currentTime + 0.05);
    }
}
