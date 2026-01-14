/**
 * Audio - 3D sound manager using Web Audio API
 */
export class Audio {
    constructor() {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
    }

    /**
     * Play sound effect
     */
    playSfx(type) {
        if (this.context.state === 'suspended') this.context.resume();

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.connect(gain);
        gain.connect(this.context.destination);

        if (type === 'shoot') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(160, this.context.currentTime);
            gain.gain.setValueAtTime(0.08, this.context.currentTime);
            gain.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.1);
            osc.start();
            osc.stop(this.context.currentTime + 0.1);
        }
    }
}
