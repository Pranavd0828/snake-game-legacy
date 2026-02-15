class AudioController {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.volume = 0.4;
        this.enabled = false;

        // Sequencer
        this.isPlaying = false;
        this.tempo = 120;
        this.nextNoteTime = 0.0;
        this.current16thNote = 0;
        this.scheduleAheadTime = 0.1;
        this.lookahead = 25.0;
        this.timerID = null;

        this.onBeat = null; // Callback for visuals
    }

    startMusic() {
        if (this.isPlaying) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        this.enabled = true;
        this.isPlaying = true;
        this.nextNoteTime = this.ctx.currentTime;
        this.scheduler();
    }

    stopMusic() {
        this.isPlaying = false;
        clearTimeout(this.timerID);
    }

    scheduler() {
        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.current16thNote, this.nextNoteTime);
            this.nextNote();
        }
        this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.tempo;
        this.nextNoteTime += 0.25 * secondsPerBeat; // 16th notes
        this.current16thNote++;
        if (this.current16thNote === 16) {
            this.current16thNote = 0;
        }
    }

    scheduleNote(beatNumber, time) {
        // Kick: 1, 5, 9, 13 (4/4)
        if (beatNumber % 4 === 0) {
            this.playKick(time);

            // Trigger visual pulse on every kick
            if (this.onBeat) this.onBeat('KICK');
        }

        // HiHats: off-beats (3, 7, 11, 15) + random
        if (beatNumber % 4 === 2 || (Math.random() > 0.7 && beatNumber % 2 !== 0)) {
            this.playHat(time);
        }

        // Bass: Off-beats + driving 16ths
        // Simple pattern: X . X . X . X .
        if (beatNumber % 2 === 0) {
            // this.playBass(time, 110); // A2
        }
        // Offwave bass
        if (beatNumber % 4 === 2) {
            this.playBass(time, 55); // A1
            setTimeout(() => { if (this.onBeat) this.onBeat('BASS'); }, (time - this.ctx.currentTime) * 1000);
        }
    }

    // --- SYNTHESIS ---

    playKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

        gain.gain.setValueAtTime(this.volume * 0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

        osc.start(time);
        osc.stop(time + 0.5);
    }

    playHat(time) {
        const bufferSize = this.ctx.sampleRate * 0.1; // 100ms
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 5000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(this.volume * 0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(time);
    }

    playBass(time, freq) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(100, time);
        filter.frequency.linearRampToValueAtTime(800, time + 0.1);
        filter.frequency.linearRampToValueAtTime(100, time + 0.2);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(this.volume * 0.6, time);
        gain.gain.linearRampToValueAtTime(0, time + 0.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(time);
        osc.stop(time + 0.2);
    }

    // SFX
    playTone(freq, type, duration) {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(this.volume * 0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playEat() {
        // High pitch blip
        this.playTone(600, 'sine', 0.1);
        setTimeout(() => this.playTone(900, 'sine', 0.1), 50);
    }

    playDie() {
        // Low crash
        this.playTone(100, 'sawtooth', 0.5);
        this.playTone(50, 'square', 0.5);
    }

    playPowerUp() {
        // Powerup sound (arpeggio)
        const now = this.ctx.currentTime;
        [440, 554, 659, 880].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(this.volume * 0.3, now + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.1);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + i * 0.05);
            osc.stop(now + i * 0.05 + 0.1);
        });
    }
}

const audioController = new AudioController();
export default audioController;
