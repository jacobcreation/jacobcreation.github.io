const KEYBOARD = document.getElementById('keyboard');
const WRAPPER = document.getElementById('wrapper');
const TOGGLE_LABELS = document.getElementById('toggleLabels');

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_INDICES = new Set([1, 3, 6, 8, 10]);
const FIRST_MIDI = 21;
const LAST_MIDI = 108;
const WHITE_COUNT = 52;

let audioCtx = null;
const activeNotes = new Map();

function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function getWhiteKeyWidth() {
    const isLandscape = window.innerWidth > window.innerHeight;
    const w = window.innerWidth <= 480
        ? Math.max(34, Math.min(48, (window.innerWidth - 24) / 10))
        : isLandscape
            ? Math.max(38, Math.min(52, (window.innerWidth - 24) / 18))
            : Math.max(38, Math.min(56, (window.innerWidth - 24) / 14));
    return Math.round(w * 10) / 10;
}

function buildKeyboard() {
    KEYBOARD.innerHTML = '';
    const ww = getWhiteKeyWidth();
    const bw = ww * 0.6;

    document.documentElement.style.setProperty('--wk-w', ww + 'px');
    document.documentElement.style.setProperty('--bk-w', bw + 'px');

    KEYBOARD.style.width = (WHITE_COUNT * ww) + 'px';

    let wi = -1;

    for (let midi = FIRST_MIDI; midi <= LAST_MIDI; midi++) {
        const ni = midi % 12;
        const octave = Math.floor(midi / 12) - 1;
        const name = NOTES[ni];
        const isBlack = BLACK_INDICES.has(ni);

        if (!isBlack) {
            wi++;
            const key = document.createElement('div');
            key.className = 'white-key';
            key.dataset.midi = midi;

            const label = document.createElement('span');
            label.className = 'key-label' + (ni === 0 ? ' octave-start' : '');
            label.textContent = name + octave;
            key.appendChild(label);

            KEYBOARD.appendChild(key);
        }
    }

    wi = -1;
    for (let midi = FIRST_MIDI; midi <= LAST_MIDI; midi++) {
        const ni = midi % 12;
        if (!BLACK_INDICES.has(ni)) {
            wi++;
            continue;
        }

        const octave = Math.floor(midi / 12) - 1;
        const name = NOTES[ni];

        const key = document.createElement('div');
        key.className = 'black-key';
        key.dataset.midi = midi;
        key.style.left = ((wi + 0.7) * ww) + 'px';
        key.style.width = bw + 'px';

        KEYBOARD.appendChild(key);
    }

    attachKeyListeners();

    const containerW = WRAPPER.clientWidth;
    if (containerW < WHITE_COUNT * ww) {
        const middleCWhiteIndex = 24;
        const scrollTarget = middleCWhiteIndex * ww - containerW / 2;
        WRAPPER.scrollLeft = Math.max(0, scrollTarget);
    }

    checkOverflow();

    if (TOGGLE_LABELS.checked) {
        KEYBOARD.classList.add('show-labels');
    }
}

function getKeyByMidi(midi) {
    return KEYBOARD.querySelector(`[data-midi="${midi}"]`);
}

function attachKeyListeners() {
    const allKeys = KEYBOARD.querySelectorAll('.white-key, .black-key');

    allKeys.forEach(key => {
        key.addEventListener('pointerdown', onPointerDown);
        key.addEventListener('pointerup', onPointerUp);
        key.addEventListener('pointercancel', onPointerUp);
    });
}

function onPointerDown(e) {
    e.preventDefault();
    const ctx = getAudioCtx();
    const key = e.currentTarget;
    const midi = parseInt(key.dataset.midi);

    if (activeNotes.has(midi)) return;

    key.classList.add('active');
    key.setPointerCapture(e.pointerId);
    playNote(midi);
}

function onPointerUp(e) {
    const key = e.currentTarget;
    const midi = parseInt(key.dataset.midi);

    key.classList.remove('active');
    stopNote(midi);
}

function playNote(midi) {
    const ctx = getAudioCtx();
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq, now);

    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.4, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 2);

    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.linearRampToValueAtTime(0.1, now + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 2);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 1);

    activeNotes.set(midi, { gain1, gain2, releaseTimer: null });
}

function stopNote(midi) {
    if (!activeNotes.has(midi)) return;
    const data = activeNotes.get(midi);
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    [data.gain1, data.gain2].forEach(gain => {
        try {
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(gain.gain.value || 0.001, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        } catch (e) {}
    });

    activeNotes.delete(midi);
}

TOGGLE_LABELS.addEventListener('change', () => {
    KEYBOARD.classList.toggle('show-labels', TOGGLE_LABELS.checked);
});

function checkOverflow() {
    const s = WRAPPER;
    s.classList.toggle('scrollable-right', s.scrollLeft + s.clientWidth < s.scrollWidth);
    s.classList.toggle('scrollable-left', s.scrollLeft > 0);
}

WRAPPER.addEventListener('scroll', checkOverflow, { passive: true });

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildKeyboard, 150);
});

buildKeyboard();
