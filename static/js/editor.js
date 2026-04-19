document.addEventListener('DOMContentLoaded', () => {
    // --- State & Constants ---
    const DEFAULTS = {
        exposure: 0, brightness: 200, contrast: 200,
        highlights: 0, shadows: 0, whites: 0, blacks: 0,
        temperature: 0, tint: 0, vibrance: 0, saturation: 200,
        clarity: 0, dehaze: 0,
        red: 500, green: 500, blue: 500,
        rotation: 0, sharpness: 100, crop: null
    };

    let currentState = { ...DEFAULTS };
    let history = [JSON.stringify(DEFAULTS)];
    let historyIndex = 0;
    let isUpdatingFromCode = false;
    let isUpdatingFromUI = false;
    let activePresetId = null;

    // --- DOM Elements ---
    const mainPreview = document.getElementById('mainPreview');
    const canvasContainer = document.getElementById('canvasContainer');
    const dropZone = document.getElementById('dropZone');

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

        activePresetId = null; // Clear active preset on manual adjustment
        syncStateToEditor();
        renderPreview();
        renderPresets();
    });

    // --- Step Buttons (+/-) ---
    document.querySelectorAll('.step-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const param = btn.getAttribute('data-param');
            const input = document.querySelector(`input[data-param="${param}"]`);
            if (!input) return;

            const step = parseFloat(input.getAttribute('step')) || 1;
            const currentVal = parseFloat(input.value) || 0;
            const isMinus = btn.classList.contains('minus');
            
            let newVal = isMinus ? currentVal - step : currentVal + step;
            
            const min = parseFloat(input.getAttribute('min'));
            const max = parseFloat(input.getAttribute('max'));
            if (!isNaN(min)) newVal = Math.max(min, newVal);
            if (!isNaN(max)) newVal = Math.min(max, newVal);

            input.value = newVal;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
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
            activePresetId = null; // Clear active state on manual JSON edit
            updateUIFromState(currentState);
            jsonStatus.textContent = "State Synced";
            jsonStatus.classList.remove('error');
            renderPreview();
            renderPresets(); // Update visual active state
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

    document.getElementById('resetAllBtn').addEventListener('click', () => {
        activePresetId = null;
        hardReset();
        renderPresets();
    });

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
    let presets = [];

    function renderPresets() {
        const presetsLibrary = document.getElementById('presetsLibrary');
        const emptyState = document.getElementById('presetsEmptyState');
        const clearBtn = document.getElementById('clearPresetsBtn');
        
        presetsLibrary.innerHTML = '';
        
        if (presets.length === 0) {
            presetsLibrary.style.display = 'none';
            emptyState.style.display = 'flex';
            clearBtn.style.opacity = '0.3';
            clearBtn.style.pointerEvents = 'none';
            return;
        }

        presetsLibrary.style.display = 'grid';
        emptyState.style.display = 'none';
        clearBtn.style.opacity = '1';
        clearBtn.style.pointerEvents = 'all';

        presets.forEach((p, index) => {
            const tile = document.createElement('div');
            tile.className = `preset-tile ${activePresetId === index ? 'active' : ''}`;
            tile.innerHTML = `
                <div class="info">
                    <h4>${p.name}</h4>
                    <p>${p.desc}</p>
                </div>
            `;
            tile.addEventListener('click', () => {
                activePresetId = index;
                hardReset({ ...DEFAULTS, ...p.settings });
                renderPresets();
            });
            presetsLibrary.appendChild(tile);
        });
    }

    // --- Clear All Presets ---
    document.getElementById('clearPresetsBtn').addEventListener('click', () => {
        if (presets.length === 0) return;
        
        const confirmClear = confirm("Are you sure you want to clear all presets? This cannot be undone.");
        if (confirmClear) {
            presets = [];
            activePresetId = null;
            renderPresets();
            
            importStatus.textContent = "All presets cleared.";
            importStatus.className = "status-msg";
            setTimeout(() => importStatus.textContent = '', 3000);
        }
    });

    renderPresets();

    // --- Bulk Import Logic ---
    const importArea = document.getElementById('presetImportArea');
    const applyImportBtn = document.getElementById('applyImportBtn');
    const importStatus = document.getElementById('importStatus');

    const placeholderPresets = [
        {
            name: "Neon Nights",
            desc: "Vibrant city vibes with deep blues and neons",
            settings: {
                exposure: 10, brightness: 180, contrast: 240, 
                highlights: -50, shadows: 40, blacks: -20,
                temperature: -120, tint: 80, vibrance: 60, saturation: 240,
                clarity: 20
            }
        },
        {
            name: "Desert Sun",
            desc: "Warm, high-contrast look for golden hour",
            settings: {
                exposure: 30, contrast: 210, 
                highlights: 60, shadows: -20,
                temperature: 150, tint: 20, vibrance: 40, saturation: 220,
                clarity: 15, dehaze: 10
            }
        },
        {
            name: "Moody Forest",
            desc: "Subdued colors with rich greens and cool shadows",
            settings: {
                exposure: -20, brightness: 170, contrast: 210, 
                highlights: -80, shadows: 60, whites: -10, blacks: 20,
                temperature: 20, tint: -40, vibrance: -20, saturation: 160,
                clarity: 25
            }
        },
        {
            name: "Normal",
            desc: "Original unedited photo settings",
            settings: {
                exposure: 0, brightness: 200, contrast: 200, 
                highlights: 0, shadows: 0, whites: 0, blacks: 0,
                temperature: 0, tint: 0, vibrance: 0, saturation: 200,
                clarity: 0, dehaze: 0, red: 500, green: 500, blue: 500,
                rotation: 0, sharpness: 100
            }
        }
    ];

    importArea.placeholder = "Example JSON Format:\n\n" + JSON.stringify(placeholderPresets, null, 2);

    applyImportBtn.addEventListener('click', () => {
        const rawJson = importArea.value.trim();
        if (!rawJson) {
            importStatus.textContent = "Please paste some JSON data first.";
            importStatus.className = "status-msg error";
            return;
        }

        try {
            const imported = JSON.parse(rawJson);
            if (!Array.isArray(imported)) {
                throw new Error("Input must be a JSON array of presets.");
            }

            // Simple validation and import
            imported.forEach(p => {
                if (p.name && p.settings) {
                    presets.push(p);
                }
            });

            renderPresets();
            importArea.value = '';
            importStatus.textContent = `Successfully imported ${imported.length} presets!`;
            importStatus.className = "status-msg success";
            
            setTimeout(() => {
                importStatus.textContent = '';
            }, 3000);

        } catch (e) {
            importStatus.textContent = "Error: " + e.message;
            importStatus.className = "status-msg error";
        }
    });
    
    document.getElementById('copyTemplateBtn').addEventListener('click', () => {
        const templateJson = JSON.stringify(placeholderPresets, null, 4);
        navigator.clipboard.writeText(templateJson).then(() => {
            const btn = document.getElementById('copyTemplateBtn');
            const originalText = btn.textContent;
            btn.textContent = "Copied Template!";
            setTimeout(() => btn.textContent = originalText, 2000);
        });
    });

    // --- Image Handling & Rendering ---
    let currentFilename = null;

    async function handleUpload(file) {
        const formData = new FormData();
        formData.append('file', file);


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
        finally {}
    }

    function loadImage(url) {
        mainPreview.src = url;
        mainPreview.style.display = 'block';
        canvasContainer.classList.add('has-image');
        renderPreview();
    }

    // Debounced high-quality backend preview
    let previewTimeout = null;
    function renderPreview() {
        if (!currentFilename) return;

        // Perform backend preview for precision (debounced)
        clearTimeout(previewTimeout);
        previewTimeout = setTimeout(fetchBackendPreview, 500);
    }

    let lastPreviewId = 0;
    async function fetchBackendPreview() {
        if (!currentFilename) return;
        
        const previewId = ++lastPreviewId;
        const config = btoa(JSON.stringify(currentState));
        const previewUrl = `/preview?config=${config}&v=${Date.now()}`;
        
        const img = new Image();
        img.onload = () => {
            // Only update if this is still the latest request
            if (previewId !== lastPreviewId) return;

            mainPreview.src = previewUrl;
        };
        img.src = previewUrl;
    }

    // --- Workspace Events ---
    document.getElementById('uploadBtn').addEventListener('click', () => document.getElementById('imageInput').click());
    document.getElementById('imageInput').addEventListener('change', (e) => {
        if (e.target.files[0]) handleUpload(e.target.files[0]);
    });

    // Drag and Drop implementation on canvasContainer for better UX
    canvasContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        canvasContainer.classList.add('drag-hover');
    });

    canvasContainer.addEventListener('dragleave', (e) => {
        // Only remove if we're actually leaving the container, not entering a child
        if (e.relatedTarget === null || !canvasContainer.contains(e.relatedTarget)) {
            canvasContainer.classList.remove('drag-hover');
        }
    });

    canvasContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        canvasContainer.classList.remove('drag-hover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleUpload(file);
        }
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

    document.getElementById('copyPresetBtn').addEventListener('click', () => {
        const presetJson = JSON.stringify(currentState, null, 4);
        navigator.clipboard.writeText(presetJson).then(() => {
            const btn = document.getElementById('copyPresetBtn');
            const originalText = btn.textContent;
            btn.textContent = "Copied!";
            setTimeout(() => btn.textContent = originalText, 1500);
        });
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



    // --- Export ---
    document.getElementById('exportBtn').addEventListener('click', async () => {

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
        finally {}
    });
});
