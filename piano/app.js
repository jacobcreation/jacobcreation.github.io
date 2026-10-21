const KEYBOARD = document.getElementById('keyboard');
const WRAPPER = document.getElementById('wrapper');
const TOGGLE_LABELS = document.getElementById('toggleLabels');
const STATUS = document.getElementById('status');
const RECORD_BUTTON = document.getElementById('recordButton');
const PLAY_BUTTON = document.getElementById('playButton');
const CLEAR_BUTTON = document.getElementById('clearButton');
const VOLUME = document.getElementById('volume');
const SUSTAIN_BUTTON = document.getElementById('sustainButton');
const OCTAVE_LABEL = document.getElementById('octaveLabel');

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_INDICES = new Set([1, 3, 6, 8, 10]);
const FIRST_MIDI = 21;
const LAST_MIDI = 108;
const WHITE_COUNT = 52;

const sampler = new Tone.Sampler({
    urls: {
        A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3', A1: 'A1.mp3',
        C2: 'C2.mp3', 'D#2': 'Ds2.mp3', A2: 'A2.mp3', 'F#2': 'Fs2.mp3', C3: 'C3.mp3',
        'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3',
        'F#4': 'Fs4.mp3', A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
        A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3', A6: 'A6.mp3',
        C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3', A7: 'A7.mp3', C8: 'C8.mp3'
    }, release: 1, baseUrl: 'https://tonejs.github.io/audio/salamander/',
    onload: () => { STATUS.textContent = 'Ready'; setTimeout(() => STATUS.classList.add('status-hidden'), 900); }
}).toDestination();

const activePointers = new Map();
const pressedPointers = new Set();
const midiPointers = new Map();
const sustainedNotes = new Set();
const computerKeys = new Map([
    ['a', 0], ['w', 1], ['s', 2], ['e', 3], ['d', 4], ['f', 5], ['t', 6], ['g', 7],
    ['y', 8], ['h', 9], ['u', 10], ['j', 11], ['k', 12], ['o', 13], ['l', 14], ['p', 15], [';', 16]
]);
const computerPointers = new Map();
let computerOctave = 4;
let sustain = false;
let recording = false;
let recordStartedAt = 0;
let recordedEvents = [];
let playbackTimers = [];

function getWhiteKeyWidth() {
    const landscape = window.innerWidth > window.innerHeight;
    const width = window.innerWidth <= 480 ? Math.max(34, Math.min(48, (window.innerWidth - 24) / 10))
        : landscape ? Math.max(38, Math.min(52, (window.innerWidth - 24) / 18))
            : Math.max(38, Math.min(56, (window.innerWidth - 24) / 14));
    return Math.round(width * 10) / 10;
}

function buildKeyboard() {
    const ww = getWhiteKeyWidth();
    KEYBOARD.replaceChildren();
    document.documentElement.style.setProperty('--wk-w', `${ww}px`);
    document.documentElement.style.setProperty('--bk-w', `${ww * 0.6}px`);
    KEYBOARD.style.width = `${WHITE_COUNT * ww}px`;
    let whiteIndex = -1;
    for (let midi = FIRST_MIDI; midi <= LAST_MIDI; midi += 1) {
        const noteIndex = midi % 12;
        if (BLACK_INDICES.has(noteIndex)) continue;
        whiteIndex += 1;
        const key = document.createElement('div');
        key.className = 'white-key'; key.dataset.midi = midi; key.setAttribute('role', 'button');
        key.setAttribute('aria-label', `${NOTES[noteIndex]}${Math.floor(midi / 12) - 1}`);
        const label = document.createElement('span');
        label.className = `key-label${noteIndex === 0 ? ' octave-start' : ''}`;
        label.textContent = key.getAttribute('aria-label'); key.appendChild(label); KEYBOARD.appendChild(key);
    }
    whiteIndex = -1;
    for (let midi = FIRST_MIDI; midi <= LAST_MIDI; midi += 1) {
        const noteIndex = midi % 12;
        if (!BLACK_INDICES.has(noteIndex)) { whiteIndex += 1; continue; }
        const key = document.createElement('div');
        key.className = 'black-key'; key.dataset.midi = midi;
        key.style.left = `${(whiteIndex + 0.7) * ww}px`; key.style.width = `${ww * 0.6}px`;
        key.setAttribute('role', 'button'); key.setAttribute('aria-label', `${NOTES[noteIndex]}${Math.floor(midi / 12) - 1}`);
        KEYBOARD.appendChild(key);
    }
    KEYBOARD.classList.toggle('show-labels', TOGGLE_LABELS.checked);
    if (WRAPPER.clientWidth < KEYBOARD.scrollWidth) WRAPPER.scrollLeft = Math.max(0, 24 * ww - WRAPPER.clientWidth / 2);
    checkOverflow();
}

function getKeyByMidi(midi) { return KEYBOARD.querySelector(`[data-midi="${midi}"]`); }
function noteEvent(type, midi) { if (recording) recordedEvents.push({ type, midi, time: performance.now() - recordStartedAt }); }

function playNote(midi, shouldRecord = true) {
    if (midi < FIRST_MIDI || midi > LAST_MIDI) return;
    sampler.triggerAttack(Tone.Frequency(midi, 'midi').toNote());
    getKeyByMidi(midi)?.classList.add('active');
    if (shouldRecord) noteEvent('on', midi);
}

function stopNote(midi, shouldRecord = true) {
    sampler.triggerRelease(Tone.Frequency(midi, 'midi').toNote());
    getKeyByMidi(midi)?.classList.remove('active');
    if (shouldRecord) noteEvent('off', midi);
}

function handleNoteOn(midi, pointerId) {
    if (activePointers.get(pointerId) === midi) return;
    if (activePointers.has(pointerId)) handleNoteOff(activePointers.get(pointerId), pointerId);
    activePointers.set(pointerId, midi);
    const pointers = midiPointers.get(midi) || new Set(); midiPointers.set(midi, pointers);
    if (pointers.size === 0) playNote(midi); pointers.add(pointerId);
}

function handleNoteOff(midi, pointerId) {
    if (activePointers.get(pointerId) !== midi) return;
    activePointers.delete(pointerId); const pointers = midiPointers.get(midi); pointers?.delete(pointerId);
    if (pointers?.size === 0) { midiPointers.delete(midi); if (sustain) sustainedNotes.add(midi); else stopNote(midi); }
}

function onPointerDown(event) {
    event.preventDefault(); pressedPointers.add(event.pointerId);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) { /* not supported */ }
    Tone.start().then(() => { if (pressedPointers.has(event.pointerId)) handleNoteOn(Number(event.currentTarget.dataset.midi), event.pointerId); }).catch(() => {});
}

function onPointerMove(event) {
    if (!pressedPointers.has(event.pointerId)) return;
    const key = document.elementFromPoint(event.clientX, event.clientY)?.closest('.white-key, .black-key');
    if (key) handleNoteOn(Number(key.dataset.midi), event.pointerId);
}

function onPointerUp(event) {
    pressedPointers.delete(event.pointerId); const midi = activePointers.get(event.pointerId);
    if (midi !== undefined) handleNoteOff(midi, event.pointerId);
}

function setSustain(value) {
    sustain = value; SUSTAIN_BUTTON.setAttribute('aria-pressed', String(sustain));
    if (!sustain) { sustainedNotes.forEach((midi) => { stopNote(midi); }); sustainedNotes.clear(); }
}

function checkOverflow() {
    WRAPPER.classList.toggle('scrollable-right', WRAPPER.scrollLeft + WRAPPER.clientWidth < WRAPPER.scrollWidth - 1);
    WRAPPER.classList.toggle('scrollable-left', WRAPPER.scrollLeft > 1);
}

function stopPlayback() { playbackTimers.forEach(clearTimeout); playbackTimers = []; }
function playRecording() {
    if (!recordedEvents.length) return;
    stopPlayback();
    recordedEvents.forEach((event) => {
        playbackTimers.push(setTimeout(
            () => { if (event.type === 'on') playNote(event.midi, false); else stopNote(event.midi, false); },
            event.time,
        ));
    });
}

KEYBOARD.addEventListener('pointerdown', onPointerDown);
WRAPPER.addEventListener('pointermove', onPointerMove, { passive: false });
window.addEventListener('pointerup', onPointerUp); window.addEventListener('pointercancel', onPointerUp);
WRAPPER.addEventListener('scroll', checkOverflow, { passive: true });
TOGGLE_LABELS.addEventListener('change', () => KEYBOARD.classList.toggle('show-labels', TOGGLE_LABELS.checked));
SUSTAIN_BUTTON.addEventListener('click', () => setSustain(!sustain));
VOLUME.addEventListener('input', () => { sampler.volume.value = Number(VOLUME.value); });
RECORD_BUTTON.addEventListener('click', () => {
    recording = !recording;
    if (recording) { recordedEvents = []; recordStartedAt = performance.now(); RECORD_BUTTON.classList.add('recording'); STATUS.textContent = 'Recording'; STATUS.classList.remove('status-hidden'); }
    else { RECORD_BUTTON.classList.remove('recording'); STATUS.textContent = recordedEvents.length ? 'Take saved' : 'No notes'; }
});
PLAY_BUTTON.addEventListener('click', playRecording);
CLEAR_BUTTON.addEventListener('click', () => { stopPlayback(); recordedEvents = []; STATUS.textContent = 'Take cleared'; STATUS.classList.remove('status-hidden'); });

function updateOctave() { OCTAVE_LABEL.textContent = `C${computerOctave}`; }
document.getElementById('octaveDown').addEventListener('click', () => { computerOctave = Math.max(1, computerOctave - 1); updateOctave(); });
document.getElementById('octaveUp').addEventListener('click', () => { computerOctave = Math.min(7, computerOctave + 1); updateOctave(); });
window.addEventListener('keydown', (event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase(); const offset = computerKeys.get(key); if (offset === undefined) return;
    event.preventDefault(); const midi = (computerOctave + 1) * 12 + offset;
    if (midi >= FIRST_MIDI && midi <= LAST_MIDI) { computerPointers.set(key, midi); playNote(midi); }
});
window.addEventListener('keyup', (event) => { const midi = computerPointers.get(event.key.toLowerCase()); if (midi === undefined) return; computerPointers.delete(event.key.toLowerCase()); stopNote(midi); });
window.addEventListener('blur', () => {
    [...computerPointers.values()].forEach((midi) => { stopNote(midi); });
    computerPointers.clear(); pressedPointers.clear();
    [...activePointers.entries()].forEach(([id, midi]) => { handleNoteOff(midi, id); });
});
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(buildKeyboard, 150); });

sampler.volume.value = Number(VOLUME.value); buildKeyboard();
