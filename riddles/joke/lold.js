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
		this.onVolumeChange = options.onVolumeChange || null;

		this.audioContext = null;
		this.analyser = null;
		this.microphone = null;
		this.dataArray = null;
		this.isListening = false;
		this.laughDetected = false;
		this.animationFrameId = null;

		// Pulse detection for rhythmic laughter
		this.lastPulseTime = 0;
		this.pulseCount = 0;
	}

	async start() {
		if (this.audioContext) return true;
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
			this.analyser = this.audioContext.createAnalyser();
			this.microphone = this.audioContext.createMediaStreamSource(stream);
			this.microphone.connect(this.analyser);

			this.analyser.fftSize = 256;
			this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
			return true;
		} catch (err) {
			console.error("LOLD: Microphone access denied", err);
			return false;
		}
	}

	stop() {
		this.setListening(false);
		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
		}
	}

	setListening(val) {
		this.isListening = val;
		if (val) {
			this.laughDetected = false;
			this.pulseCount = 0;
			this.lastPulseTime = 0;
			if (!this.animationFrameId) {
				this.tick();
			}
		} else {
			if (this.animationFrameId) {
				cancelAnimationFrame(this.animationFrameId);
				this.animationFrameId = null;
			}
		}
	}

	tick() {
		if (!this.isListening) return;

		this.analyser.getByteFrequencyData(this.dataArray);

		let sum = 0;
		let max = 0;
		for (let i = 0; i < this.dataArray.length; i++) {
			sum += this.dataArray[i];
			if (this.dataArray[i] > max) max = this.dataArray[i];
		}
		let average = sum / this.dataArray.length;

		// Advanced Pulse Detection (Looking for 'ha ha ha')
		const now = Date.now();
		if (average > this.threshold) {
			const timeDiff = now - this.lastPulseTime;
			if (timeDiff > 80 && timeDiff < 500) {
				this.pulseCount++;
			} else if (timeDiff >= 500) {
				this.pulseCount = 1;
			}
			this.lastPulseTime = now;
		}

		// Trigger Laughter: Rhythmic pulses or sudden sharp sound
		const rhythmicLaugh = this.pulseCount >= 3;
		const loudLaugh = average > this.threshold * 2.5;
		const peakLaugh = max > 200; // Sudden sharp peak

		if ((rhythmicLaugh || loudLaugh || peakLaugh) && !this.laughDetected) {
			this.laughDetected = true;
			this.onLaugh(average);
		}

		if (this.onVolumeChange) {
			this.onVolumeChange(average, max);
		}

		this.animationFrameId = requestAnimationFrame(() => this.tick());
	}
}

window.LOLD = LOLD;
