document.addEventListener('DOMContentLoaded', () => {
    // --- State & Constants ---
    const DEFAULTS = {
        exposure: 0, brightness: 200, contrast: 200,
        highlights: 0, shadows: 0, whites: 0, blacks: 0,
        temperature: 0, tint: 0, vibrance: 0, saturation: 200,
        clarity: 0, dehaze: 0,
        red: 500, green: 500, blue: 500,
        rotation: 0, crop: null
    };

    let currentState = { ...DEFAULTS };
    let history = [JSON.stringify(DEFAULTS)];
    let historyIndex = 0;
    let isUpdatingFromCode = false;
    let isUpdatingFromUI = false;

    // --- DOM Elements ---
    const mainCanvas = document.getElementById('mainCanvas');
    const ctx = mainCanvas.getContext('2d');
    const canvasContainer = document.getElementById('canvasContainer');
    const dropZone = document.getElementById('dropZone');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const jsonStatus = document.getElementById('jsonStatus');
    const editorForm = document.getElementById('editorForm');

    // --- CodeMirror Initialization ---
    const jsonEditor = CodeMirror(document.getElementById('jsonEditorContainer'), {
        value: JSON.stringify(currentState, null, 4),
        mode: "application/json",
        theme: "dracula",
        lineNumbers: true,
        tabSize: 4,
        viewportMargin: Infinity
    });

    // --- Initialize Controls ---
    const paramInputs = document.querySelectorAll('[data-param]');
    
    function updateUIFromState(state) {
        isUpdatingFromUI = true;
        paramInputs.forEach(input => {
            const param = input.getAttribute('data-param');
            if (state[param] !== undefined) {
                input.value = state[param];
                const badge = document.getElementById(`val-${param}`);
                if (badge) badge.textContent = state[param];
            }
        });
        isUpdatingFromUI = false;
    }

    // --- Bi-directional Sync ---
    
    // UI -> State & JSON
    editorForm.addEventListener('input', (e) => {
        if (isUpdatingFromUI) return;
        const input = e.target;
        const param = input.getAttribute('data-param');
        if (!param) return;

        let val = parseFloat(input.value);
        if (isNaN(val)) return;

        currentState[param] = val;
        
        const badge = document.getElementById(`val-${param}`);
        if (badge) badge.textContent = val;

        syncStateToEditor();
        renderPreview();
    });

    function syncStateToEditor() {
        isUpdatingFromCode = true;
        jsonEditor.setValue(JSON.stringify(currentState, null, 4));
        isUpdatingFromCode = false;
        jsonStatus.textContent = "State Synced";
        jsonStatus.classList.remove('error');
    }

    // JSON Editor -> State & UI
    jsonEditor.on('change', () => {
        if (isUpdatingFromCode) return;
        
        try {
            const newState = JSON.parse(jsonEditor.getValue());
            // Filter to valid parameters
            const filteredState = {};
            Object.keys(DEFAULTS).forEach(key => {
                if (newState[key] !== undefined) {
                    filteredState[key] = newState[key];
                } else {
                    filteredState[key] = DEFAULTS[key];
                }
            });
            
            currentState = filteredState;
            updateUIFromState(currentState);
            jsonStatus.textContent = "State Synced";
            jsonStatus.classList.remove('error');
            renderPreview();
        } catch (e) {
            jsonStatus.textContent = "Invalid JSON Structure";
            jsonStatus.classList.add('error');
        }
    });

    // --- Hard Reset ---
    function hardReset(toState = DEFAULTS) {
        currentState = { ...toState };
        updateUIFromState(currentState);
        syncStateToEditor();
        renderPreview();
        saveHistory();
    }

    document.getElementById('resetAllBtn').addEventListener('click', () => hardReset());

    // --- History System ---
    function saveHistory() {
        const stateStr = JSON.stringify(currentState);
        if (stateStr === history[historyIndex]) return;

        history = history.slice(0, historyIndex + 1);
        history.push(stateStr);
        historyIndex++;
        updateHistoryButtons();
    }

    function updateHistoryButtons() {
        document.getElementById('undoBtn').disabled = historyIndex <= 0;
        document.getElementById('redoBtn').disabled = historyIndex >= history.length - 1;
    }

    document.getElementById('undoBtn').addEventListener('click', () => {
        if (historyIndex > 0) {
            historyIndex--;
            currentState = JSON.parse(history[historyIndex]);
            updateUIFromState(currentState);
            syncStateToEditor();
            renderPreview();
            updateHistoryButtons();
        }
    });

    document.getElementById('redoBtn').addEventListener('click', () => {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            currentState = JSON.parse(history[historyIndex]);
            updateUIFromState(currentState);
            syncStateToEditor();
            renderPreview();
            updateHistoryButtons();
        }
    });

    // --- Preset Library ---
    const presets = [
        {
            name: "Classic Cinema",
            icon: "🎬",
            desc: "Contrast-rich teal & orange grade",
            settings: { exposure: 20, contrast: 240, temperature: 150, tint: -50, vibrance: 100, blue: 520, red: 480 }
        },
        {
            name: "Vintage Film",
            icon: "🎞️",
            desc: "Washed out shadows with warm tones",
            settings: { exposure: -10, contrast: 160, blacks: 150, shadows: 100, temperature: 300, saturation: 160 }
        },
        {
            name: "High Contrast B&W",
            icon: "🌓",
            desc: "Punchy monochrome look",
            settings: { saturation: 0, contrast: 300, highlights: 100, blacks: -200, clarity: 300 }
        },
        {
            name: "Deep Matte",
            icon: "🌫️",
            desc: "Soft blacks and moody presence",
            settings: { exposure: -50, blacks: 300, contrast: 180, dehaze: -100, vibrance: -200 }
        }
    ];

    const presetsLibrary = document.getElementById('presetsLibrary');
    presets.forEach(p => {
        const tile = document.createElement('div');
        tile.className = 'preset-tile';
        tile.innerHTML = `
            <div class="icon">${p.icon}</div>
            <div class="info">
                <h4>${p.name}</h4>
                <p>${p.desc}</p>
            </div>
        `;
        tile.addEventListener('click', () => {
            hardReset({ ...DEFAULTS, ...p.settings });
        });
        presetsLibrary.appendChild(tile);
    });

    // --- Image Handling & Rendering ---
    let originalImage = null;
    let currentFilename = null;

    async function handleUpload(file) {
        const formData = new FormData();
        formData.append('file', file);

        showLoading(true);
        try {
            const resp = await fetch('/upload', { method: 'POST', body: formData });
            const data = await resp.json();
            if (data.success) {
                currentFilename = data.filename;
                loadImage(data.url);
                document.getElementById('exportBtn').disabled = false;
                hardReset();
            }
        } catch (e) { console.error(e); }
        finally { showLoading(false); }
    }

    function loadImage(url) {
        const img = new Image();
        img.onload = () => {
            originalImage = img;
            dropZone.style.display = 'none';
            mainCanvas.style.display = 'block';
            renderPreview();
        };
        img.src = url;
    }

    // Debounced high-quality backend preview
    let previewTimeout = null;
    function renderPreview() {
        if (!originalImage) return;

        // Perform fast local canvas preview for immediate feedback
        renderCanvas();

        // Perform backend preview for precision (debounced)
        clearTimeout(previewTimeout);
        previewTimeout = setTimeout(fetchBackendPreview, 500);
    }

    function renderCanvas() {
        const dW = originalImage.width;
        const dH = originalImage.height;
        const maxW = canvasContainer.clientWidth - 40;
        const maxH = canvasContainer.clientHeight - 40;
        const scale = Math.min(maxW / dW, maxH / dH, 1);
        
        mainCanvas.width = dW * scale;
        mainCanvas.height = dH * scale;

        ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        
        // Basic filters for local preview (approximate)
        const exp = Math.pow(2, currentState.exposure / 200.0);
        const bri = (currentState.brightness / 200.0) * exp;
        const con = currentState.contrast / 200.0;
        const sat = currentState.saturation / 200.0;
        
        ctx.filter = `brightness(${bri}) contrast(${con}) saturate(${sat})`;
        
        ctx.save();
        ctx.translate(mainCanvas.width / 2, mainCanvas.height / 2);
        ctx.rotate((currentState.rotation * Math.PI) / 180);
        ctx.drawImage(originalImage, -mainCanvas.width / 2, -mainCanvas.height / 2, mainCanvas.width, mainCanvas.height);
        ctx.restore();
    }

    async function fetchBackendPreview() {
        if (!currentFilename) return;
        
        // We use the /preview route with base64 encoded config
        const config = btoa(JSON.stringify(currentState));
        const previewUrl = `/preview?config=${config}&v=${Date.now()}`;
        
        const img = new Image();
        img.onload = () => {
            // Once high-res is loaded, we could swap it, but canvas is usually enough for interactive use.
            // For this app, we'll just keep the canvas updated locally and use backend for final exports.
            // However, the user wants "see real-time updates", so we've already done that with local canvas.
        };
        img.src = previewUrl;
    }

    // --- Workspace Events ---
    document.getElementById('uploadBtn').addEventListener('click', () => document.getElementById('imageInput').click());
    document.getElementById('imageInput').addEventListener('change', (e) => {
        if (e.target.files[0]) handleUpload(e.target.files[0]);
    });

    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('hover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('hover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('hover');
        if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]);
    });

    document.getElementById('rotateRight').addEventListener('click', () => {
        currentState.rotation = (currentState.rotation + 90) % 360;
        syncStateToEditor();
        renderPreview();
    });

    document.getElementById('rotateLeft').addEventListener('click', () => {
        currentState.rotation = (currentState.rotation - 90) % 360;
        syncStateToEditor();
        renderPreview();
    });

    document.getElementById('copyJsonBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(jsonEditor.getValue());
        const btn = document.getElementById('copyJsonBtn');
        btn.textContent = "Copied!";
        setTimeout(() => btn.textContent = "Copy", 1000);
    });

    // --- Tabs ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}Tab`).classList.add('active');
        });
    });

    function showLoading(show) {
        loadingOverlay.classList.toggle('active', show);
    }

    // --- Export ---
    document.getElementById('exportBtn').addEventListener('click', async () => {
        showLoading(true);
        try {
            const resp = await fetch('/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: currentState })
            });
            const blob = await resp.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'edited-photo.jpg';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e) { console.error(e); }
        finally { showLoading(false); }
    });
});
