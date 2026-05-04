document.addEventListener('DOMContentLoaded', () => {
    const DEFAULTS = {
        exposure: 0, brightness: 200, contrast: 200,
        highlights: 0, shadows: 0, whites: 0, blacks: 0,
        temperature: 0, tint: 0, vibrance: 0, saturation: 200,
        clarity: 0, dehaze: 0,
        red: 500, green: 500, blue: 500,
        rotation: 0, flip_h: false, flip_v: false, sharpness: 100, crop: null
    };
    const PRESETS_STORAGE_KEY = 'photoEditor.presets.v2';

    const builtinPresets = [
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
            name: "Clean Reset",
            desc: "Original unedited photo settings",
            settings: { ...DEFAULTS }
        }
    ];

    let currentState = { ...DEFAULTS };
    let history = [JSON.stringify(DEFAULTS)];
    let historyIndex = 0;
    let isUpdatingFromCode = false;
    let isUpdatingFromUI = false;
    let activePresetId = null;
    let currentFilename = null;
    let originalImageUrl = null;
    let originalImageInfo = null;
    let previewTimeout = null;
    let historyTimeout = null;
    let lastPreviewId = 0;

    const mainPreview = document.getElementById('mainPreview');
    const originalPreview = document.getElementById('originalPreview');
    const compareLayer = document.getElementById('compareLayer');
    const compareSlider = document.getElementById('compareSlider');
    const compareBtn = document.getElementById('compareBtn');
    const canvasContainer = document.getElementById('canvasContainer');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const editorForm = document.getElementById('editorForm');
    const jsonStatus = document.getElementById('jsonStatus');
    const imageMeta = document.getElementById('imageMeta');
    const histogramCanvas = document.getElementById('histogramCanvas');
    const exportFormat = document.getElementById('exportFormat');
    const exportQuality = document.getElementById('exportQuality');
    const exportWidth = document.getElementById('exportWidth');
    const exportHeight = document.getElementById('exportHeight');
    const lockAspect = document.getElementById('lockAspect');
    const useOriginalSizeBtn = document.getElementById('useOriginalSizeBtn');
    const importArea = document.getElementById('presetImportArea');
    const applyImportBtn = document.getElementById('applyImportBtn');
    const importStatus = document.getElementById('importStatus');
    const presetNameInput = document.getElementById('presetNameInput');
    const savePresetBtn = document.getElementById('savePresetBtn');
    const savePresetStatus = document.getElementById('savePresetStatus');
    const paramInputs = document.querySelectorAll('[data-param]');

    const jsonEditor = CodeMirror(document.getElementById('jsonEditorContainer'), {
        value: JSON.stringify(currentState, null, 4),
        mode: "application/json",
        theme: "dracula",
        lineNumbers: true,
        tabSize: 4,
        viewportMargin: Infinity
    });

    let presets = loadPresets();

    function loadPresets() {
        try {
            const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
            if (!raw) return [...builtinPresets];
            const saved = JSON.parse(raw);
            return Array.isArray(saved) ? saved : [...builtinPresets];
        } catch {
            return [...builtinPresets];
        }
    }

    function savePresets() {
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[char]));
    }

    function updateUIFromState(state) {
        isUpdatingFromUI = true;
        paramInputs.forEach(input => {
            const param = input.getAttribute('data-param');
            if (state[param] !== undefined) input.value = state[param];
        });
        document.getElementById('flipHorizontal').classList.toggle('active', Boolean(state.flip_h));
        document.getElementById('flipVertical').classList.toggle('active', Boolean(state.flip_v));
        document.getElementById('cropBtn').classList.toggle('active', Boolean(state.crop));
        isUpdatingFromUI = false;
    }

    function syncStateToEditor() {
        isUpdatingFromCode = true;
        jsonEditor.setValue(JSON.stringify(currentState, null, 4));
        isUpdatingFromCode = false;
        jsonStatus.textContent = "State Synced";
        jsonStatus.classList.remove('error');
        updateUIFromState(currentState);
    }

    function saveHistory() {
        const stateStr = JSON.stringify(currentState);
        if (stateStr === history[historyIndex]) return;
        history = history.slice(0, historyIndex + 1);
        history.push(stateStr);
        historyIndex++;
        updateHistoryButtons();
    }

    function scheduleHistorySave() {
        clearTimeout(historyTimeout);
        historyTimeout = setTimeout(saveHistory, 650);
    }

    function updateHistoryButtons() {
        document.getElementById('undoBtn').disabled = historyIndex <= 0;
        document.getElementById('redoBtn').disabled = historyIndex >= history.length - 1;
    }

    function hardReset(toState = DEFAULTS) {
        currentState = { ...DEFAULTS, ...toState };
        syncStateToEditor();
        renderPreview();
        saveHistory();
    }

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

        presets.forEach((preset, index) => {
            const tile = document.createElement('div');
            tile.className = `preset-tile ${activePresetId === index ? 'active' : ''}`;
            tile.innerHTML = `
                <div class="info">
                    <h4>${escapeHtml(preset.name)}</h4>
                    <p>${escapeHtml(preset.desc || 'Custom style')}</p>
                </div>
                <button type="button" class="preset-delete" title="Delete preset">Delete</button>
            `;

            tile.addEventListener('click', () => {
                activePresetId = index;
                hardReset({ ...DEFAULTS, ...preset.settings });
                renderPresets();
            });

            tile.querySelector('.preset-delete').addEventListener('click', event => {
                event.stopPropagation();
                presets.splice(index, 1);
                if (activePresetId === index) activePresetId = null;
                savePresets();
                renderPresets();
            });

            presetsLibrary.appendChild(tile);
        });
    }

    function renderPreview() {
        if (!currentFilename) return;
        clearTimeout(previewTimeout);
        previewTimeout = setTimeout(fetchBackendPreview, 450);
    }

    async function fetchBackendPreview() {
        if (!currentFilename) return;

        loadingOverlay.style.display = 'flex';
        const previewId = ++lastPreviewId;
        const config = encodeURIComponent(btoa(JSON.stringify(currentState)));
        const previewUrl = `/preview?config=${config}&v=${Date.now()}`;

        const img = new Image();
        img.onload = () => {
            if (previewId !== lastPreviewId) return;
            mainPreview.src = previewUrl;
            loadingOverlay.style.display = 'none';
        };
        img.onerror = () => {
            if (previewId === lastPreviewId) loadingOverlay.style.display = 'none';
        };
        img.src = previewUrl;
    }

    async function fetchMetadata() {
        try {
            const resp = await fetch('/metadata');
            if (!resp.ok) return;
            originalImageInfo = await resp.json();
            updateMetadataPanel();
            updateExportPlaceholders();
        } catch (error) {
            console.error(error);
        }
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes)) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    function updateMetadataPanel() {
        if (!originalImageInfo) {
            imageMeta.textContent = 'No image loaded';
            return;
        }

        imageMeta.innerHTML = `
            <strong>${escapeHtml(originalImageInfo.format || 'Image')}</strong>
            ${originalImageInfo.width} x ${originalImageInfo.height}px
            · ${originalImageInfo.megapixels} MP
            · ${formatBytes(originalImageInfo.file_size)}
        `;
    }

    function updateExportPlaceholders() {
        if (!originalImageInfo) return;
        exportWidth.placeholder = String(originalImageInfo.width);
        exportHeight.placeholder = String(originalImageInfo.height);
    }

    function getExportOptions() {
        return {
            format: exportFormat.value,
            quality: parseInt(exportQuality.value, 10) || 95,
            width: exportWidth.value ? parseInt(exportWidth.value, 10) : null,
            height: exportHeight.value ? parseInt(exportHeight.value, 10) : null
        };
    }

    function setAspectHeightFromWidth() {
        if (!lockAspect.checked || !originalImageInfo || !exportWidth.value) return;
        const ratio = originalImageInfo.height / originalImageInfo.width;
        exportHeight.value = Math.max(1, Math.round(parseInt(exportWidth.value, 10) * ratio));
    }

    function setAspectWidthFromHeight() {
        if (!lockAspect.checked || !originalImageInfo || !exportHeight.value) return;
        const ratio = originalImageInfo.width / originalImageInfo.height;
        exportWidth.value = Math.max(1, Math.round(parseInt(exportHeight.value, 10) * ratio));
    }

    function loadImage(url) {
        originalImageUrl = url;
        originalPreview.src = url;
        mainPreview.src = url;
        mainPreview.style.display = 'block';
        canvasContainer.classList.add('has-image');
        compareBtn.disabled = false;
        renderPreview();
    }

    async function handleUpload(file) {
        const formData = new FormData();
        formData.append('file', file);
        loadingOverlay.style.display = 'flex';

        try {
            const resp = await fetch('/upload', { method: 'POST', body: formData });
            const data = await resp.json();
            if (data.success) {
                currentFilename = data.filename;
                document.getElementById('exportBtn').disabled = false;
                loadImage(data.url);
                hardReset();
                await fetchMetadata();
            }
        } catch (error) {
            console.error(error);
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }

    function drawHistogram() {
        const ctx = histogramCanvas.getContext('2d');
        const width = histogramCanvas.width;
        const height = histogramCanvas.height;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#0a0a0b';
        ctx.fillRect(0, 0, width, height);

        if (!mainPreview.complete || !mainPreview.naturalWidth) return;

        const sample = document.createElement('canvas');
        const sampleSize = 160;
        sample.width = sampleSize;
        sample.height = sampleSize;
        const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
        sampleCtx.drawImage(mainPreview, 0, 0, sampleSize, sampleSize);

        let pixels;
        try {
            pixels = sampleCtx.getImageData(0, 0, sampleSize, sampleSize).data;
        } catch {
            return;
        }

        const bins = 64;
        const channels = [
            { values: new Array(bins).fill(0), color: 'rgba(255, 88, 88, 0.85)' },
            { values: new Array(bins).fill(0), color: 'rgba(77, 222, 128, 0.75)' },
            { values: new Array(bins).fill(0), color: 'rgba(76, 201, 240, 0.85)' }
        ];

        for (let i = 0; i < pixels.length; i += 4) {
            channels[0].values[Math.floor(pixels[i] / 4)]++;
            channels[1].values[Math.floor(pixels[i + 1] / 4)]++;
            channels[2].values[Math.floor(pixels[i + 2] / 4)]++;
        }

        const max = Math.max(...channels.flatMap(channel => channel.values), 1);
        channels.forEach(channel => {
            ctx.beginPath();
            ctx.strokeStyle = channel.color;
            ctx.lineWidth = 1.5;
            channel.values.forEach((value, index) => {
                const x = (index / (bins - 1)) * width;
                const y = height - (value / max) * (height - 8) - 4;
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        });
    }

    function updateCompareClip() {
        const value = compareSlider.value;
        compareLayer.style.clipPath = `inset(0 ${100 - value}% 0 0)`;
        canvasContainer.style.setProperty('--compare-position', `${value}%`);
    }

    function setCompareActive(isActive) {
        if (!originalImageUrl) return;
        compareLayer.style.display = isActive ? 'flex' : 'none';
        compareSlider.style.display = isActive ? 'block' : 'none';
        compareBtn.classList.toggle('active', isActive);
        canvasContainer.classList.toggle('compare-active', isActive);
        updateCompareClip();
    }

    editorForm.addEventListener('input', event => {
        if (isUpdatingFromUI) return;
        const input = event.target;
        const param = input.getAttribute('data-param');
        if (!param) return;

        const value = parseFloat(input.value);
        if (Number.isNaN(value)) return;

        currentState[param] = value;
        activePresetId = null;
        syncStateToEditor();
        renderPreview();
        renderPresets();
        scheduleHistorySave();
    });

    document.querySelectorAll('.step-btn[data-param]').forEach(btn => {
        btn.addEventListener('click', () => {
            const param = btn.getAttribute('data-param');
            const input = document.querySelector(`input[data-param="${param}"]`);
            if (!input) return;

            const step = parseFloat(input.getAttribute('step')) || 1;
            const currentVal = parseFloat(input.value) || 0;
            let newVal = btn.classList.contains('minus') ? currentVal - step : currentVal + step;
            const min = parseFloat(input.getAttribute('min'));
            const max = parseFloat(input.getAttribute('max'));
            if (!Number.isNaN(min)) newVal = Math.max(min, newVal);
            if (!Number.isNaN(max)) newVal = Math.min(max, newVal);

            input.value = newVal;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
    });

    document.querySelectorAll('.export-step').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-export-param');
            const input = document.getElementById(`export${key.charAt(0).toUpperCase()}${key.slice(1)}`);
            const step = parseFloat(input.getAttribute('step')) || 1;
            const currentVal = parseFloat(input.value || input.placeholder) || 0;
            let next = btn.classList.contains('minus') ? currentVal - step : currentVal + step;
            const min = parseFloat(input.getAttribute('min'));
            const max = parseFloat(input.getAttribute('max'));
            if (!Number.isNaN(min)) next = Math.max(min, next);
            if (!Number.isNaN(max)) next = Math.min(max, next);
            input.value = Math.round(next);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
    });

    jsonEditor.on('change', () => {
        if (isUpdatingFromCode) return;

        try {
            const newState = JSON.parse(jsonEditor.getValue());
            const filteredState = {};
            Object.keys(DEFAULTS).forEach(key => {
                filteredState[key] = newState[key] !== undefined ? newState[key] : DEFAULTS[key];
            });

            currentState = filteredState;
            activePresetId = null;
            updateUIFromState(currentState);
            jsonStatus.textContent = "State Synced";
            jsonStatus.classList.remove('error');
            renderPreview();
            renderPresets();
            scheduleHistorySave();
        } catch {
            jsonStatus.textContent = "Invalid JSON Structure";
            jsonStatus.classList.add('error');
        }
    });

    document.getElementById('resetAllBtn').addEventListener('click', () => {
        activePresetId = null;
        hardReset();
        renderPresets();
    });

    document.getElementById('undoBtn').addEventListener('click', () => {
        if (historyIndex <= 0) return;
        historyIndex--;
        currentState = JSON.parse(history[historyIndex]);
        activePresetId = null;
        syncStateToEditor();
        renderPreview();
        renderPresets();
        updateHistoryButtons();
    });

    document.getElementById('redoBtn').addEventListener('click', () => {
        if (historyIndex >= history.length - 1) return;
        historyIndex++;
        currentState = JSON.parse(history[historyIndex]);
        activePresetId = null;
        syncStateToEditor();
        renderPreview();
        renderPresets();
        updateHistoryButtons();
    });

    document.getElementById('clearPresetsBtn').addEventListener('click', () => {
        if (presets.length === 0) return;
        if (!confirm("Clear all presets?")) return;

        presets = [];
        activePresetId = null;
        savePresets();
        renderPresets();
        importStatus.textContent = "All presets cleared.";
        importStatus.className = "status-msg";
        setTimeout(() => importStatus.textContent = '', 3000);
    });

    savePresetBtn.addEventListener('click', () => {
        const name = presetNameInput.value.trim();
        if (!name) {
            savePresetStatus.textContent = "Name the preset first.";
            savePresetStatus.className = "status-msg error";
            return;
        }

        presets.unshift({
            name,
            desc: "Saved from current settings",
            settings: { ...currentState }
        });
        presetNameInput.value = '';
        activePresetId = 0;
        savePresets();
        renderPresets();
        savePresetStatus.textContent = "Preset saved.";
        savePresetStatus.className = "status-msg success";
        setTimeout(() => savePresetStatus.textContent = '', 2500);
    });

    importArea.placeholder = "Example JSON Format:\n\n" + JSON.stringify(builtinPresets, null, 2);

    applyImportBtn.addEventListener('click', () => {
        const rawJson = importArea.value.trim();
        if (!rawJson) {
            importStatus.textContent = "Please paste some JSON data first.";
            importStatus.className = "status-msg error";
            return;
        }

        try {
            const imported = JSON.parse(rawJson);
            if (!Array.isArray(imported)) throw new Error("Input must be a JSON array of presets.");

            const valid = imported.filter(preset => preset.name && preset.settings);
            presets.push(...valid);
            savePresets();
            renderPresets();
            importArea.value = '';
            importStatus.textContent = `Imported ${valid.length} presets.`;
            importStatus.className = "status-msg success";
            setTimeout(() => importStatus.textContent = '', 3000);
        } catch (error) {
            importStatus.textContent = "Error: " + error.message;
            importStatus.className = "status-msg error";
        }
    });

    document.getElementById('copyTemplateBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(JSON.stringify(builtinPresets, null, 4)).then(() => {
            const btn = document.getElementById('copyTemplateBtn');
            const originalText = btn.textContent;
            btn.textContent = "Copied Template!";
            setTimeout(() => btn.textContent = originalText, 2000);
        });
    });

    document.getElementById('uploadBtn').addEventListener('click', () => document.getElementById('imageInput').click());
    document.getElementById('imageInput').addEventListener('change', event => {
        if (event.target.files[0]) handleUpload(event.target.files[0]);
    });

    canvasContainer.addEventListener('dragover', event => {
        event.preventDefault();
        canvasContainer.classList.add('drag-hover');
    });

    canvasContainer.addEventListener('dragleave', event => {
        if (event.relatedTarget === null || !canvasContainer.contains(event.relatedTarget)) {
            canvasContainer.classList.remove('drag-hover');
        }
    });

    canvasContainer.addEventListener('drop', event => {
        event.preventDefault();
        canvasContainer.classList.remove('drag-hover');
        const file = event.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) handleUpload(file);
    });

    document.getElementById('rotateRight').addEventListener('click', () => {
        currentState.rotation = (currentState.rotation + 90) % 360;
        activePresetId = null;
        syncStateToEditor();
        renderPreview();
        saveHistory();
        renderPresets();
    });

    document.getElementById('rotateLeft').addEventListener('click', () => {
        currentState.rotation = (currentState.rotation - 90) % 360;
        activePresetId = null;
        syncStateToEditor();
        renderPreview();
        saveHistory();
        renderPresets();
    });

    document.getElementById('flipHorizontal').addEventListener('click', () => {
        currentState.flip_h = !currentState.flip_h;
        activePresetId = null;
        syncStateToEditor();
        renderPreview();
        saveHistory();
        renderPresets();
    });

    document.getElementById('flipVertical').addEventListener('click', () => {
        currentState.flip_v = !currentState.flip_v;
        activePresetId = null;
        syncStateToEditor();
        renderPreview();
        saveHistory();
        renderPresets();
    });

    document.getElementById('cropBtn').addEventListener('click', () => {
        if (!originalImageInfo) return;

        if (currentState.crop) {
            currentState.crop = null;
        } else {
            const side = Math.min(originalImageInfo.width, originalImageInfo.height);
            currentState.crop = {
                x: Math.round((originalImageInfo.width - side) / 2),
                y: Math.round((originalImageInfo.height - side) / 2),
                width: side,
                height: side
            };
        }

        activePresetId = null;
        syncStateToEditor();
        renderPreview();
        saveHistory();
        renderPresets();
    });

    compareBtn.addEventListener('click', () => {
        setCompareActive(compareLayer.style.display === 'none');
    });

    compareSlider.addEventListener('input', updateCompareClip);
    mainPreview.addEventListener('load', drawHistogram);

    exportWidth.addEventListener('input', setAspectHeightFromWidth);
    exportHeight.addEventListener('input', setAspectWidthFromHeight);
    useOriginalSizeBtn.addEventListener('click', () => {
        exportWidth.value = '';
        exportHeight.value = '';
        updateExportPlaceholders();
    });
    exportFormat.addEventListener('change', () => {
        exportQuality.disabled = exportFormat.value === 'png';
    });

    document.getElementById('copyJsonBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(jsonEditor.getValue());
        const btn = document.getElementById('copyJsonBtn');
        btn.textContent = "Copied!";
        setTimeout(() => btn.textContent = "Copy", 1000);
    });

    document.getElementById('copyPresetBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(JSON.stringify(currentState, null, 4)).then(() => {
            const btn = document.getElementById('copyPresetBtn');
            const originalText = btn.textContent;
            btn.textContent = "Copied!";
            setTimeout(() => btn.textContent = originalText, 1500);
        });
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}Tab`).classList.add('active');
        });
    });

    document.getElementById('exportBtn').addEventListener('click', async () => {
        try {
            const options = getExportOptions();
            const resp = await fetch('/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: currentState, export_options: options })
            });
            if (!resp.ok) throw new Error('Export failed');

            const blob = await resp.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `edited-photo.${options.format === 'jpeg' ? 'jpg' : options.format}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error(error);
        }
    });

    renderPresets();
    updateHistoryButtons();
    updateCompareClip();
});
