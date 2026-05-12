/**
 * Pixel Art Studio - Mobile & Brush Edition
 */

// Configuration
const GRID_SIZE = 32;

// Templates Data (32x32 maps)
const TEMPLATES = {
    heart: [
        {x: 16, y: 10}, {x: 15, y: 9}, {x: 14, y: 9}, {x: 13, y: 10}, {x: 12, y: 11}, {x: 12, y: 12}, {x: 12, y: 13}, {x: 13, y: 14}, {x: 14, y: 15}, {x: 15, y: 16}, {x: 16, y: 17},
        {x: 17, y: 16}, {x: 18, y: 15}, {x: 19, y: 14}, {x: 20, y: 13}, {x: 20, y: 12}, {x: 20, y: 11}, {x: 19, y: 10}, {x: 18, y: 9}, {x: 17, y: 9}
    ],
    star: [
        {x: 16, y: 8}, {x: 17, y: 11}, {x: 20, y: 11}, {x: 18, y: 13}, {x: 19, y: 16}, {x: 16, y: 14}, {x: 13, y: 16}, {x: 14, y: 13}, {x: 12, y: 11}, {x: 15, y: 11}
    ],
    ghost: [
        {x: 13, y: 10}, {x: 14, y: 9}, {x: 15, y: 9}, {x: 16, y: 9}, {x: 17, y: 9}, {x: 18, y: 10}, {x: 19, y: 11}, {x: 19, y: 12}, {x: 19, y: 13}, {x: 19, y: 14}, {x: 19, y: 15}, {x: 19, y: 16},
        {x: 18, y: 17}, {x: 17, y: 16}, {x: 16, y: 17}, {x: 15, y: 16}, {x: 14, y: 17}, {x: 13, y: 16}, {x: 12, y: 15}, {x: 12, y: 14}, {x: 12, y: 13}, {x: 12, y: 12}, {x: 12, y: 11}
    ]
};

// State
let isDrawing = false;
let currentTool = 'pen';
let currentColor = '#000000';
let brushSize = 1;
let showGrid = true;

// DOM Elements - Layers
const paintCanvas = document.getElementById('paint-canvas');
const paintCtx = paintCanvas.getContext('2d', { alpha: true });
const templateCanvas = document.getElementById('template-canvas');
const templateCtx = templateCanvas.getContext('2d', { alpha: true });
const gridOverlay = document.getElementById('grid-overlay');

// DOM Elements - UI
const penTool = document.getElementById('pen-tool');
const eraserTool = document.getElementById('eraser-tool');
const clearTool = document.getElementById('clear-tool');
const colorPicker = document.getElementById('color-picker');
const swatches = document.querySelectorAll('.swatch');
const gridToggle = document.getElementById('grid-toggle');
const exportBtn = document.getElementById('export-btn');
const templateBtns = document.querySelectorAll('.tmpl-btn');
const importTrigger = document.getElementById('import-trigger');
const imageImport = document.getElementById('image-import');
const saveTmplBtn = document.getElementById('save-tmpl-btn');
const loadTmplBtn = document.getElementById('load-tmpl-btn');
const templateOpacity = document.getElementById('template-opacity');
const brushSizeInput = document.getElementById('brush-size');
const brushSizeVal = document.getElementById('brush-size-val');

/**
 * Initialize
 */
function init() {
    paintCanvas.width = GRID_SIZE;
    paintCanvas.height = GRID_SIZE;
    templateCanvas.width = GRID_SIZE;
    templateCanvas.height = GRID_SIZE;

    clearPaintCanvas();
    clearTemplateCanvas();
    setupEventListeners();
}

function clearPaintCanvas() {
    paintCtx.clearRect(0, 0, GRID_SIZE, GRID_SIZE);
}

function clearTemplateCanvas() {
    templateCtx.fillStyle = '#ffffff';
    templateCtx.fillRect(0, 0, GRID_SIZE, GRID_SIZE);
}

/**
 * Event Listeners
 */
function setupEventListeners() {
    // Mouse Events
    paintCanvas.addEventListener('mousedown', startDrawing);
    paintCanvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);

    // Touch Events for Mobile
    paintCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startDrawing(e.touches[0]);
    }, { passive: false });

    paintCanvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        draw(e.touches[0]);
    }, { passive: false });

    paintCanvas.addEventListener('touchend', stopDrawing);

    // Tool Actions
    penTool.addEventListener('click', () => setTool('pen'));
    eraserTool.addEventListener('click', () => setTool('eraser'));
    clearTool.addEventListener('click', () => {
        if (confirm('Clear your drawing?')) clearPaintCanvas();
    });

    colorPicker.addEventListener('input', (e) => {
        currentColor = e.target.value;
        updateActiveSwatch(null);
    });

    swatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            currentColor = swatch.style.backgroundColor;
            colorPicker.value = rgbToHex(currentColor);
            updateActiveSwatch(swatch);
            setTool('pen');
        });
    });

    brushSizeInput.addEventListener('input', (e) => {
        brushSize = parseInt(e.target.value);
        brushSizeVal.textContent = brushSize;
    });

    gridToggle.addEventListener('click', toggleGrid);
    exportBtn.addEventListener('click', exportPNG);

    templateBtns.forEach(btn => {
        btn.addEventListener('click', () => applyTemplate(btn.dataset.template));
    });

    importTrigger.addEventListener('click', () => imageImport.click());
    imageImport.addEventListener('change', handleImageImport);

    saveTmplBtn.addEventListener('click', saveCustomTemplate);
    loadTmplBtn.addEventListener('click', loadCustomTemplate);

    templateOpacity.addEventListener('input', (e) => {
        templateCanvas.style.opacity = e.target.value / 100;
    });

    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'p') setTool('pen');
        if (e.key.toLowerCase() === 'e') setTool('eraser');
    });
}

/**
 * Drawing Logic
 */
function startDrawing(e) {
    isDrawing = true;
    draw(e);
}

function stopDrawing() {
    isDrawing = false;
}

function draw(e) {
    if (!isDrawing) return;

    const tool = (e.shiftKey) ? 'eraser' : currentTool;
    const rect = paintCanvas.getBoundingClientRect();
    const scale = GRID_SIZE / rect.width;
    
    // Get coords relative to canvas
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    const x = Math.floor((clientX - rect.left) * scale);
    const y = Math.floor((clientY - rect.top) * scale);

    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
        if (tool === 'pen') {
            paintCtx.fillStyle = currentColor;
            // Center the brush for sizes > 1
            const offset = Math.floor((brushSize - 1) / 2);
            paintCtx.fillRect(x - offset, y - offset, brushSize, brushSize);
        } else {
            const offset = Math.floor((brushSize - 1) / 2);
            paintCtx.clearRect(x - offset, y - offset, brushSize, brushSize);
        }
    }
}

/**
 * Tool Management
 */
function setTool(tool) {
    currentTool = tool;
    penTool.classList.toggle('active', tool === 'pen');
    eraserTool.classList.toggle('active', tool === 'eraser');
}

/**
 * Template Logic
 */
function applyTemplate(name) {
    const points = TEMPLATES[name];
    if (!points) return;
    clearTemplateCanvas();
    templateCtx.fillStyle = '#cccccc';
    points.forEach(p => templateCtx.fillRect(p.x, p.y, 1, 1));
}

function handleImageImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            clearTemplateCanvas();
            templateCtx.imageSmoothingEnabled = false;
            templateCtx.drawImage(img, 0, 0, GRID_SIZE, GRID_SIZE);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function saveCustomTemplate() {
    localStorage.setItem('pixelArt_customTemplate', paintCanvas.toDataURL());
    alert('Drawing saved as a custom template!');
}

function loadCustomTemplate() {
    const data = localStorage.getItem('pixelArt_customTemplate');
    if (!data) return alert('No saved template found.');
    const img = new Image();
    img.onload = () => {
        clearTemplateCanvas();
        templateCtx.drawImage(img, 0, 0);
    };
    img.src = data;
}

/**
 * UI Helpers
 */
function toggleGrid() {
    showGrid = !showGrid;
    gridOverlay.classList.toggle('hidden', !showGrid);
    gridToggle.textContent = `Grid: ${showGrid ? 'ON' : 'OFF'}`;
    gridToggle.classList.toggle('active', showGrid);
}

function updateActiveSwatch(activeSwatch) {
    swatches.forEach(s => s.classList.remove('active'));
    if (activeSwatch) activeSwatch.classList.add('active');
}

function exportPNG() {
    const link = document.createElement('a');
    link.download = 'pixel-art.png';
    const exportCanvas = document.createElement('canvas');
    const exportCtx = exportCanvas.getContext('2d');
    const exportScale = 16; 
    exportCanvas.width = GRID_SIZE * exportScale;
    exportCanvas.height = GRID_SIZE * exportScale;
    exportCtx.fillStyle = '#ffffff';
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.imageSmoothingEnabled = false;
    exportCtx.drawImage(paintCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
}

function rgbToHex(rgb) {
    if (rgb.startsWith('#')) return rgb;
    const parts = rgb.match(/\d+/g);
    if (!parts) return '#000000';
    return "#" + parts.map(x => {
        const hex = parseInt(x).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }).join("");
}

init();
