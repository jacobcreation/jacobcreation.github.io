const KEYBOARD = document.getElementById('keyboard');
const WRAPPER = document.getElementById('wrapper');
const TOGGLE_LABELS = document.getElementById('toggleLabels');
const STATUS = document.getElementById('status');

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_INDICES = new Set([1, 3, 6, 8, 10]);
const FIRST_MIDI = 21;
const LAST_MIDI = 108;
const WHITE_COUNT = 52;

// --- Audio Setup (Tone.js Sampler) ---
const sampler = new Tone.Sampler({
    urls: {
        A0: "A0.mp3",
        C1: "C1.mp3",
        "D#1": "Ds1.mp3",
        "F#1": "Fs1.mp3",
        A1: "A1.mp3",
        C2: "C2.mp3",
        "D#2": "Ds2.mp3",
        "F#2": "Fs2.mp3",
        A2: "A2.mp3",
        C3: "C3.mp3",
        "D#3": "Ds3.mp3",
        "F#3": "Fs3.mp3",
        A3: "A3.mp3",
        C4: "C4.mp3",
        "D#4": "Ds4.mp3",
        "F#4": "Fs4.mp3",
        A4: "A4.mp3",
        C5: "C5.mp3",
        "D#5": "Ds5.mp3",
        "F#5": "Fs5.mp3",
        A5: "A5.mp3",
        C6: "C6.mp3",
        "D#6": "Ds6.mp3",
        "F#6": "Fs6.mp3",
        A6: "A6.mp3",
        C7: "C7.mp3",
        "D#7": "Ds7.mp3",
        "F#7": "Fs7.mp3",
        A7: "A7.mp3",
        C8: "C8.mp3"
    },
    release: 1,
    baseUrl: "https://tonejs.github.io/audio/salamander/",
    onload: () => {
        STATUS.classList.add('status-hidden');
        console.log("Sampler loaded");
    }
}).toDestination();

// --- Input Tracking ---
// Maps pointerId -> midiNumber
const activePointers = new Map();
// Maps midiNumber -> Set of pointerIds (polyphony/overlap support)
const midiPointers = new Map();

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
        key.addEventListener('pointerenter', onPointerEnter);
        key.addEventListener('pointerleave', onPointerLeave);
        key.addEventListener('pointerup', onPointerUp);
        key.addEventListener('pointercancel', onPointerUp);
    });
}

async function onPointerDown(e) {
    e.preventDefault();
    await Tone.start();
    const midi = parseInt(e.currentTarget.dataset.midi);
    handleNoteOn(midi, e.pointerId);
}

function onPointerEnter(e) {
    // buttons is 1 for primary button (usually left click or touch)
    if (e.buttons === 1 || e.pointerType === 'touch') {
        const midi = parseInt(e.currentTarget.dataset.midi);
        handleNoteOn(midi, e.pointerId);
    }
}

function onPointerLeave(e) {
    const midi = parseInt(e.currentTarget.dataset.midi);
    handleNoteOff(midi, e.pointerId);
}

function onPointerUp(e) {
    const midi = parseInt(e.currentTarget.dataset.midi);
    handleNoteOff(midi, e.pointerId);
}

function handleNoteOn(midi, pointerId) {
    if (activePointers.get(pointerId) === midi) return;

    // Release old note if this pointer moved to a new key
    if (activePointers.has(pointerId)) {
        handleNoteOff(activePointers.get(pointerId), pointerId);
    }

    activePointers.set(pointerId, midi);

    if (!midiPointers.has(midi)) {
        midiPointers.set(midi, new Set());
    }
    const pointers = midiPointers.get(midi);

    if (pointers.size === 0) {
        playNote(midi);
    }
    pointers.add(pointerId);
}

function handleNoteOff(midi, pointerId) {
    if (activePointers.get(pointerId) !== midi) return;

    activePointers.delete(pointerId);
    const pointers = midiPointers.get(midi);
    if (pointers) {
        pointers.delete(pointerId);
        if (pointers.size === 0) {
            stopNote(midi);
        }
    }
}

function playNote(midi) {
    const note = Tone.Frequency(midi, "midi").toNote();
    sampler.triggerAttack(note);
    const key = getKeyByMidi(midi);
    if (key) key.classList.add('active');
}

function stopNote(midi) {
    const note = Tone.Frequency(midi, "midi").toNote();
    sampler.triggerRelease(note);
    const key = getKeyByMidi(midi);
    if (key) key.classList.remove('active');
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
