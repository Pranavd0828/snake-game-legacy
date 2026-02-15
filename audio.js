class AudioController {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.4;

        // Reverb/Delay Bus
        this.reverbGain = this.ctx.createGain();
        this.reverbGain.gain.value = 0.3;
        this.delay = this.ctx.createDelay();
        this.delay.delayTime.value = 0.2;
        this.feedback = this.ctx.createGain();
        this.feedback.gain.value = 0.4;

        this.reverbGain.connect(this.delay);
        this.delay.connect(this.feedback);
        this.feedback.connect(this.delay);
        this.delay.connect(this.masterGain);

        this.enabled = true;
    }

    startAmbience() {
        if (!this.enabled) return;
        // Deep Drone
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.frequency.value = 55; // A1
        osc.type = 'sine';

        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.1;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 50; // Filter cutoff modulation depth

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200;

        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        gain.gain.value = 0.1;

        osc.start();
        lfo.start();

        this.ambienceOsc = osc;
    }

    playTone(freq, type, duration, hasReverb = false) {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        // Soft attack
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 2, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(freq * 0.5, this.ctx.currentTime + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        if (hasReverb) {
            gain.connect(this.reverbGain);
        }

        osc.start();
        osc.stop(this.ctx.currentTime + duration + 0.1);
    }

    playEat() {
        // Ethereal chime
        this.playTone(880, 'sine', 0.15, true); // A5
        setTimeout(() => this.playTone(1108, 'sine', 0.2, true), 50); // C#6
    }

    playDie() {
        // Low impact w/ noise
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.8);

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.8);

        osc.connect(gain);
        gain.connect(this.masterGain);
        gain.connect(this.reverbGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 1.0);
    }

    playStart() {
        // Futuristic power up
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.5);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.1);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);

        osc.connect(gain);
        gain.connect(this.masterGain);
        gain.connect(this.reverbGain);

        osc.start();
        osc.stop(now + 0.5);
    }
}

export default new AudioController();
