document.addEventListener('DOMContentLoaded', () => {
    const mainCanvas = document.getElementById('mainCanvas');
    const ctx = mainCanvas.getContext('2d');
    const canvasContainer = document.getElementById('canvasContainer');
    const uploadBtn = document.getElementById('uploadBtn');
    const imageInput = document.getElementById('imageInput');
    const dropZone = document.getElementById('dropZone');
    const exportBtn = document.getElementById('exportBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const clearWorkspaceBtn = document.getElementById('clearWorkspaceBtn');

    const sliders = {
        exposure: { el: document.getElementById('exposure'), slider: document.getElementById('exposure_slider'), value: 0.00 },
        brightness: { el: document.getElementById('brightness'), slider: document.getElementById('brightness_slider'), value: 1.00 },
        contrast: { el: document.getElementById('contrast'), slider: document.getElementById('contrast_slider'), value: 1.00 },
        highlights: { el: document.getElementById('highlights'), slider: document.getElementById('highlights_slider'), value: 0.00 },
        shadows: { el: document.getElementById('shadows'), slider: document.getElementById('shadows_slider'), value: 0.00 },
        temperature: { el: document.getElementById('temperature'), slider: document.getElementById('temperature_slider'), value: 0.00 },
        vibrance: { el: document.getElementById('vibrance'), slider: document.getElementById('vibrance_slider'), value: 0.00 },
        saturation: { el: document.getElementById('saturation'), slider: document.getElementById('saturation_slider'), value: 1.00 },
        red: { el: document.getElementById('red'), value: 1.00 },
        green: { el: document.getElementById('green'), value: 1.00 },
        blue: { el: document.getElementById('blue'), value: 1.00 }
    };

    let originalImage = null;
    let currentImageFilename = null;
    let rotation = 0;
    let history = [];
    let historyIndex = -1;
    let currentCrop = null;
    let isCropping = false;
    let cropStart = null;
    let cropEnd = null;

    // Initialization
    if (uploadBtn) uploadBtn.addEventListener('click', () => imageInput.click());

    // Check if we have a preview on load (from Python Preview)
    const pyPreviewImg = document.getElementById('pythonPreviewImg');
    if (pyPreviewImg) {
        loadImage(pyPreviewImg.src, true);
    }

    imageInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleUpload(e.target.files[0]);
        }
    });

    // Sidebar Slide-in effect
    document.querySelectorAll('.control-group').forEach((group, i) => {
        group.style.opacity = '0';
        group.style.transform = 'translateX(-20px)';
        setTimeout(() => {
            group.style.transition = 'all 0.5s ease';
            group.style.opacity = '1';
            group.style.transform = 'translateX(0)';
        }, 100 + i * 50);
    });

    function saveState() {
        const state = {
            exposure: sliders.exposure.value,
            brightness: sliders.brightness.value,
            contrast: sliders.contrast.value,
            highlights: sliders.highlights.value,
            shadows: sliders.shadows.value,
            temperature: sliders.temperature.value,
            vibrance: sliders.vibrance.value,
            saturation: sliders.saturation.value,
            red: sliders.red.value,
            green: sliders.green.value,
            blue: sliders.blue.value,
            rotation: rotation,
            crop: currentCrop
        };
        
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        
        history.push(JSON.stringify(state));
        historyIndex++;
        updateHistoryButtons();
    }

    function applyState(state) {
        Object.keys(sliders).forEach(key => {
            sliders[key].value = state[key];
            if (sliders[key].el) sliders[key].el.value = state[key].toFixed(2);
            if (sliders[key].slider) sliders[key].slider.value = state[key];
            
            // Update value span if exists
            const valSpan = document.getElementById(`val-${key}`);
            if (valSpan) valSpan.textContent = state[key].toFixed(2);
        });

        rotation = state.rotation;
        currentCrop = state.crop;
        
        const resetCropBtn = document.getElementById('resetCrop');
        if (resetCropBtn) resetCropBtn.disabled = !currentCrop;

        render();
    }

    function updateHistoryButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        if (undoBtn) undoBtn.disabled = historyIndex <= 0;
        if (redoBtn) redoBtn.disabled = historyIndex >= history.length - 1;
    }

    // Drag & Drop
    const dropOverlay = document.getElementById('dropOverlay');
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        if (dragCounter === 1) dropOverlay.classList.add('active');
    });

    window.addEventListener('dragover', (e) => e.preventDefault());

    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter === 0) dropOverlay.classList.remove('active');
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        dropOverlay.classList.remove('active');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleUpload(e.dataTransfer.files[0]);
        }
    });

    async function handleUpload(file) {
        const formData = new FormData();
        formData.append('file', file);

        showLoading(true);
        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                currentImageFilename = data.filename;
                
                // Hide Python preview if it exists
                const pyPreview = document.getElementById('pythonPreviewContainer');
                if (pyPreview) pyPreview.style.display = 'none';

                loadImage(data.url);
                exportBtn.disabled = false;
                history = [];
                historyIndex = -1;
                rotation = 0;
                currentCrop = null;
                saveState();
            } else {
                alert(data.error);
            }
        } catch (err) {
            console.error(err);
        } finally {
            showLoading(false);
        }
    }

    function loadImage(url, fromPreview = false) {
        const img = new Image();
        img.onload = () => {
            originalImage = img;
            
            // UI Transitions
            dropZone.style.opacity = '0';
            setTimeout(() => {
                dropZone.style.display = 'none';
                canvasContainer.style.display = 'block';
                canvasContainer.style.opacity = '0';
                canvasContainer.style.transform = 'scale(0.95)';
                mainCanvas.style.display = 'block';
                
                requestAnimationFrame(() => {
                    canvasContainer.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                    canvasContainer.style.opacity = '1';
                    canvasContainer.style.transform = 'scale(1)';
                    render();
                });
            }, 300);
            
            if (fromPreview) {
                exportBtn.disabled = false;
                saveState();
            }
        };
        img.src = url;
    }

    // Clear Workspace
    if (clearWorkspaceBtn) {
        clearWorkspaceBtn.addEventListener('click', async () => {
            if (!originalImage) return;
            if (!confirm("Are you sure you want to clear the workspace? This will reset all changes.")) return;
            
            try {
                const response = await fetch('/clear', { method: 'POST' });
                const data = await response.json();
                if (data.success) {
                    // Reset UI
                    originalImage = null;
                    mainCanvas.style.display = 'none';
                    canvasContainer.style.display = 'none';
                    const pyPreview = document.getElementById('pythonPreviewContainer');
                    if (pyPreview) pyPreview.style.display = 'none';
                    
                    dropZone.style.display = 'flex';
                    dropZone.style.opacity = '1';
                    exportBtn.disabled = true;
                    history = [];
                    historyIndex = -1;
                    
                    // Reset URL to clean / if needed
                    if (window.location.search) {
                        window.location.href = '/';
                    }
                }
            } catch (err) {
                console.error(err);
            }
        });
    }

    // Sync Sliders and Inputs
    Object.keys(sliders).forEach(key => {
        const config = sliders[key];
        
        // Handle Slider Input
        if (config.slider) {
            config.slider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                config.value = val;
                if (config.el) config.el.value = val.toFixed(2);
                const valSpan = document.getElementById(`val-${key}`);
                if (valSpan) valSpan.textContent = val.toFixed(2);
                render();
            });
            
            config.slider.addEventListener('change', () => saveState());
        }
        
        // Handle Numeric Input
        if (config.el) {
            config.el.addEventListener('input', (e) => {
                let val = parseFloat(e.target.value);
                if (!isNaN(val)) {
                    config.value = val;
                    if (config.slider) config.slider.value = val;
                    const valSpan = document.getElementById(`val-${key}`);
                    if (valSpan) valSpan.textContent = val.toFixed(2);
                    render();
                }
            });
            
            config.el.addEventListener('change', () => saveState());
        }
    });

    // Numeric Buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('step-btn')) {
            const targetId = e.target.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;

            const step = parseFloat(input.getAttribute('step')) || 0.1;
            const min = parseFloat(input.getAttribute('min'));
            const max = parseFloat(input.getAttribute('max'));
            let currentVal = parseFloat(input.value) || 0;

            if (e.target.classList.contains('inc')) currentVal += step;
            else if (e.target.classList.contains('dec')) currentVal -= step;

            if (!isNaN(min)) currentVal = Math.max(min, currentVal);
            if (!isNaN(max)) currentVal = Math.min(max, currentVal);

            input.value = currentVal.toFixed(2);
            sliders[targetId].value = currentVal;
            if (sliders[targetId].slider) sliders[targetId].slider.value = currentVal;
            
            const valSpan = document.getElementById(`val-${targetId}`);
            if (valSpan) valSpan.textContent = currentVal.toFixed(2);
            
            render();
            saveState();
        }
    });

    // History controls
    document.getElementById('undoBtn').addEventListener('click', () => {
        if (historyIndex > 0) {
            historyIndex--;
            applyState(JSON.parse(history[historyIndex]));
            updateHistoryButtons();
        }
    });

    document.getElementById('redoBtn').addEventListener('click', () => {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            applyState(JSON.parse(history[historyIndex]));
            updateHistoryButtons();
        }
    });

    // Transform
    document.getElementById('rotateLeft').addEventListener('click', () => {
        rotation = (rotation - 90) % 360;
        currentCrop = null;
        render();
        saveState();
    });

    document.getElementById('rotateRight').addEventListener('click', () => {
        rotation = (rotation + 90) % 360;
        currentCrop = null;
        render();
        saveState();
    });

    // Crop Logic
    const aspectRatioSelect = document.getElementById('aspectRatio');
    const resetCropBtn = document.getElementById('resetCrop');
    const cropBtn = document.getElementById('cropBtn');

    cropBtn.addEventListener('click', () => {
        isCropping = !isCropping;
        cropBtn.classList.toggle('active', isCropping);
        cropBtn.textContent = isCropping ? 'Cancel Crop' : 'Start Crop';
        if (!isCropping) {
            cropStart = null;
            cropEnd = null;
            render();
        }
    });

    resetCropBtn.addEventListener('click', () => {
        currentCrop = null;
        resetCropBtn.disabled = true;
        render();
        saveState();
    });

    mainCanvas.addEventListener('mousedown', (e) => {
        if (!isCropping || !originalImage) return;
        const rect = mainCanvas.getBoundingClientRect();
        cropStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        cropEnd = { ...cropStart };
    });

    mainCanvas.addEventListener('mousemove', (e) => {
        if (!isCropping || !cropStart) return;
        const rect = mainCanvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        const ratio = aspectRatioSelect.value;
        if (ratio !== 'free') {
            const [wRatio, hRatio] = ratio.split(':').map(Number);
            const targetAspect = wRatio / hRatio;
            let dx = x - cropStart.x;
            let dy = y - cropStart.y;
            if (Math.abs(dx / dy) > targetAspect) dx = dy * targetAspect * Math.sign(dx);
            else dy = dx / targetAspect * Math.sign(dy);
            x = cropStart.x + dx;
            y = cropStart.y + dy;
        }

        cropEnd = { x, y };
        render();
        drawCropRect();
    });

    mainCanvas.addEventListener('mouseup', () => {
        if (!isCropping || !cropStart) return;
        confirmCrop();
    });

    function confirmCrop() {
        if (!cropStart || !cropEnd) return;
        const x = Math.min(cropStart.x, cropEnd.x);
        const y = Math.min(cropStart.y, cropEnd.y);
        const w = Math.abs(cropStart.x - cropEnd.x);
        const h = Math.abs(cropStart.y - cropEnd.y);
        
        if (w > 10 && h > 10) {
            const isSideways = Math.abs(rotation % 180) === 90;
            const rotatedW = isSideways ? originalImage.height : originalImage.width;
            const rotatedH = isSideways ? originalImage.width : originalImage.height;
            const scaleX = rotatedW / mainCanvas.width;
            const scaleY = rotatedH / mainCanvas.height;

            currentCrop = { x: x * scaleX, y: y * scaleY, width: w * scaleX, height: h * scaleY };
            resetCropBtn.disabled = false;
            saveState();
        }
        
        isCropping = false;
        cropStart = null;
        cropEnd = null;
        cropBtn.classList.remove('active');
        cropBtn.textContent = 'Start Crop';
        render();
    }

    function drawCropRect() {
        if (!cropStart || !cropEnd) return;
        ctx.strokeStyle = '#0078d4';
        ctx.lineWidth = 2;
        ctx.strokeRect(cropStart.x, cropStart.y, cropEnd.x - cropStart.x, cropEnd.y - cropStart.y);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, mainCanvas.width, Math.min(cropStart.y, cropEnd.y));
        ctx.fillRect(0, Math.max(cropStart.y, cropEnd.y), mainCanvas.width, mainCanvas.height - Math.max(cropStart.y, cropEnd.y));
        ctx.fillRect(0, Math.min(cropStart.y, cropEnd.y), Math.min(cropStart.x, cropEnd.x), Math.abs(cropEnd.y - cropStart.y));
        ctx.fillRect(Math.max(cropStart.x, cropEnd.x), Math.min(cropStart.y, cropEnd.y), mainCanvas.width - Math.max(cropStart.x, cropEnd.x), Math.abs(cropEnd.y - cropStart.y));
    }

    function render() {
        if (!originalImage) return;

        let sourceX = 0, sourceY = 0;
        let sourceW = originalImage.width;
        let sourceH = originalImage.height;
        if (currentCrop) {
            sourceX = currentCrop.x; sourceY = currentCrop.y;
            sourceW = currentCrop.width; sourceH = currentCrop.height;
        }

        let displayWidth = sourceW;
        let displayHeight = sourceH;
        const maxW = canvasContainer.offsetWidth || 800;
        const maxH = canvasContainer.offsetHeight || 600;
        const ratio = Math.min(maxW / displayWidth, maxH / displayHeight, 1);
        displayWidth *= ratio; displayHeight *= ratio;

        const isSideways = Math.abs(rotation % 180) === 90;
        if (isSideways) {
            mainCanvas.width = displayHeight; mainCanvas.height = displayWidth;
        } else {
            mainCanvas.width = displayWidth; mainCanvas.height = displayHeight;
        }

        ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        
        // Update SVG Filter
        const colorMatrix = document.getElementById('colorMatrix');
        if (colorMatrix) {
            let r = sliders.red.value, g = sliders.green.value, b = sliders.blue.value;
            const temp = sliders.temperature.value;
            if (temp > 0) { r += temp * 0.2; b -= temp * 0.2; }
            else { r += temp * 0.2; b -= temp * 0.2; }
            colorMatrix.setAttribute('values', `${r} 0 0 0 0 0 ${g} 0 0 0 0 0 ${b} 0 0 0 0 0 1 0`);
        }

        const exposureBrightness = Math.pow(2, sliders.exposure.value);
        const totalSaturation = sliders.saturation.value + (sliders.vibrance.value * 0.3);
        ctx.filter = `url(#colorBalance) brightness(${sliders.brightness.value * exposureBrightness}) contrast(${sliders.contrast.value}) saturate(${totalSaturation})`;
        
        ctx.save();
        if (currentCrop) {
            const offCanvas = document.createElement('canvas');
            offCanvas.width = isSideways ? originalImage.height : originalImage.width;
            offCanvas.height = isSideways ? originalImage.width : originalImage.height;
            const offCtx = offCanvas.getContext('2d');
            offCtx.translate(offCanvas.width / 2, offCanvas.height / 2);
            offCtx.rotate((rotation * Math.PI) / 180);
            offCtx.drawImage(originalImage, -originalImage.width / 2, -originalImage.height / 2);
            ctx.drawImage(offCanvas, currentCrop.x, currentCrop.y, currentCrop.width, currentCrop.height, 0, 0, mainCanvas.width, mainCanvas.height);
        } else {
            ctx.translate(mainCanvas.width / 2, mainCanvas.height / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.drawImage(originalImage, -displayWidth / 2, -displayHeight / 2, displayWidth, displayHeight);
        }
        ctx.restore();
    }

    exportBtn.addEventListener('click', async () => {
        showLoading(true);
        try {
            const settings = {};
            Object.keys(sliders).forEach(key => settings[key] = sliders[key].value);
            settings.rotation = rotation;
            settings.crop = currentCrop;

            const response = await fetch('/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings })
            });
            const data = await response.json();
            if (data.success) {
                const link = document.createElement('a');
                link.href = data.url;
                link.download = 'edited_image.jpg';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (err) {
            console.error(err);
        } finally {
            showLoading(false);
        }
    });

    // Presets
    const presetJsonInput = document.getElementById('presetJsonInput');
    const loadExampleBtn = document.getElementById('loadExampleBtn');
    const applyPresetsBtn = document.getElementById('applyPresetsBtn');
    const presetsContainer = document.getElementById('presetsContainer');

    const examplePresets = [
        { "name": "Golden Hour", "settings": { "exposure": 0.2, "temperature": 0.6, "vibrance": 0.3 } },
        { "name": "Cool B&W", "settings": { "saturation": 0, "contrast": 1.2, "temperature": -0.4 } },
        { "name": "Vivid", "settings": { "vibrance": 0.5, "saturation": 1.2, "exposure": 0.1 } },
        { "name": "Dark Matte", "settings": { "exposure": -0.3, "contrast": 0.8, "saturation": 0.7 } },
        {
            "name": "Comprehensive Example",
            "settings": {
                "exposure": 0.5,
                "brightness": 1.1,
                "contrast": 1.2,
                "highlights": -0.2,
                "shadows": 0.3,
                "whites": 0.1,
                "blacks": -0.1,
                "temperature": 0.4,
                "tint": 0.1,
                "vibrance": 0.6,
                "saturation": 1.1,
                "clarity": 0.2,
                "dehaze": 0.1,
                "red": 1.05,
                "green": 1.0,
                "blue": 0.95,
                "rotation": 90,
                "crop": {
                    "x": 100,
                    "y": 100,
                    "width": 800,
                    "height": 600
                }
            }
        }
    ];

    if (loadExampleBtn) loadExampleBtn.addEventListener('click', () => {
        presetJsonInput.value = JSON.stringify(examplePresets, null, 4);
    });

    if (applyPresetsBtn) applyPresetsBtn.addEventListener('click', () => {
        try {
            const presets = JSON.parse(presetJsonInput.value);
            presetsContainer.innerHTML = '';
            presets.forEach(preset => {
                const card = document.createElement('div');
                card.className = 'preset-card';
                card.innerHTML = `<div class="preset-icon">✨</div><h4>${preset.name}</h4>`;
                card.addEventListener('click', () => {
                    const defaults = { exposure: 0, brightness: 1, contrast: 1, highlights: 0, shadows: 0, temperature: 0, vibrance: 0, saturation: 1, red: 1, green: 1, blue: 1, rotation: 0, crop: null };
                    applyState({ ...defaults, ...preset.settings });
                    saveState();
                });
                presetsContainer.appendChild(card);
            });
        } catch (e) { alert("Invalid JSON"); }
    });

    function showLoading(show) {
        loadingOverlay.classList.toggle('active', show);
    }
});
