/**
 * lold.js - Laughing Out Loud Detector
 * A lightweight library to detect laughter in the browser.
 * Optimized for soft laughs and titters.
 */

class LOLD {
	constructor(options = {}) {
		this.threshold = options.threshold || 15;
		this.sensitivity = options.sensitivity || 0.5;
		this.onLaugh = options.onLaugh || (() => {});

		this.audioContext = null;
		this.analyser = null;
		this.microphone = null;
		this.dataArray = null;
		this.isListening = false;
		this.laughDetected = false;

		// Pulse detection for rhythmic laughter
		this.lastVolumes = [];
		this.pulseCount = 0;
		this.lastPulseTime = 0;
	}

	async start() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			this.audioContext = new (
				window.AudioContext || window.webkitAudioContext
			)();
			this.analyser = this.audioContext.createAnalyser();
			this.microphone = this.audioContext.createMediaStreamSource(stream);
			this.microphone.connect(this.analyser);

			this.analyser.fftSize = 256;
			this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
			this.isListening = true;
			this.tick();
			return true;
		} catch (err) {
			console.error("LOLD: Microphone access denied", err);
			return false;
		}
	}

	stop() {
		this.isListening = false;
		if (this.audioContext) this.audioContext.close();
	}

	setListening(val) {
		this.isListening = val;
		this.laughDetected = false;
		if (val) {
			this.pulseCount = 0;
			this.lastPulseTime = 0;
		}
	}

	tick() {
		if (!this.isListening) {
			requestAnimationFrame(() => this.tick());
			return;
		}

		this.analyser.getByteFrequencyData(this.dataArray);

		// 1. Calculate Average Volume
		let sum = 0;
		for (let i = 0; i < this.dataArray.length; i++) {
			sum += this.dataArray[i];
		}
		let average = sum / this.dataArray.length;

		// 2. Pulse Detection (Looking for 'ha ha ha' rhythmic spikes)
		const now = Date.now();
		if (average > this.threshold) {
			if (now - this.lastPulseTime > 100 && now - this.lastPulseTime < 600) {
				this.pulseCount++;
			} else if (now - this.lastPulseTime >= 600) {
				this.pulseCount = 1;
			}
			this.lastPulseTime = now;
		}

		// 3. Trigger Laughter
		// Detect either a loud burst or a rhythmic sequence (soft laughter)
		const rhythmicLaugh = this.pulseCount >= 3;
		const loudLaugh = average > this.threshold * 2.5;

		if ((rhythmicLaugh || loudLaugh) && !this.laughDetected) {
			this.laughDetected = true;
			this.onLaugh(average);
		}

		// Update debug view if requested
		if (this.onVolumeChange) this.onVolumeChange(average);

		requestAnimationFrame(() => this.tick());
	}
}

window.LOLD = LOLD;
