document.addEventListener('DOMContentLoaded', () => {
    const mainCanvas = document.getElementById('mainCanvas');
    const ctx = mainCanvas.getContext('2d');
    const uploadBtn = document.getElementById('uploadBtn');
    const imageInput = document.getElementById('imageInput');
    const dropZone = document.getElementById('dropZone');
    const exportBtn = document.getElementById('exportBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');

    const sliders = {
        exposure: { el: document.getElementById('exposure'), value: 0.00 },
        brightness: { el: document.getElementById('brightness'), value: 1.00 },
        contrast: { el: document.getElementById('contrast'), value: 1.00 },
        highlights: { el: document.getElementById('highlights'), value: 0.00 },
        shadows: { el: document.getElementById('shadows'), value: 0.00 },
        whites: { el: document.getElementById('whites'), value: 0.00 },
        blacks: { el: document.getElementById('blacks'), value: 0.00 },
        temperature: { el: document.getElementById('temperature'), value: 0.00 },
        tint: { el: document.getElementById('tint'), value: 0.00 },
        vibrance: { el: document.getElementById('vibrance'), value: 0.00 },
        saturation: { el: document.getElementById('saturation'), value: 1.00 },
        clarity: { el: document.getElementById('clarity'), value: 0.00 },
        dehaze: { el: document.getElementById('dehaze'), value: 0.00 },
        red: { el: document.getElementById('red'), value: 1.00 },
        green: { el: document.getElementById('green'), value: 1.00 },
        blue: { el: document.getElementById('blue'), value: 1.00 }
    };

    let originalImage = null;
    let currentImageFilename = null;
    let rotation = 0;
    let history = [];
    let historyIndex = -1;

    // Crop state
    let isCropping = false;
    let cropStart = null;
    let cropEnd = null;
    let currentCrop = null; // {x, y, w, h} in original image coordinates

    function saveState() {
        const state = {
            exposure: sliders.exposure.value,
            brightness: sliders.brightness.value,
            contrast: sliders.contrast.value,
            highlights: sliders.highlights.value,
            shadows: sliders.shadows.value,
            whites: sliders.whites.value,
            blacks: sliders.blacks.value,
            temperature: sliders.temperature.value,
            tint: sliders.tint.value,
            vibrance: sliders.vibrance.value,
            saturation: sliders.saturation.value,
            clarity: sliders.clarity.value,
            dehaze: sliders.dehaze.value,
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

    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            applyState(JSON.parse(history[historyIndex]));
            updateHistoryButtons();
        }
    }

    function redo() {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            applyState(JSON.parse(history[historyIndex]));
            updateHistoryButtons();
        }
    }

    function applyState(state) {
        Object.keys(sliders).forEach(key => {
            sliders[key].value = state[key];
            sliders[key].el.value = state[key].toFixed(2);
        });

        rotation = state.rotation;
        currentCrop = state.crop;
        render();
    }

    function updateHistoryButtons() {
        document.getElementById('undoBtn').disabled = historyIndex <= 0;
        document.getElementById('redoBtn').disabled = historyIndex >= history.length - 1;
    }

    // Initialization
    uploadBtn.addEventListener('click', () => imageInput.click());

    imageInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleUpload(e.target.files[0]);
        }
    });

    // Drop zone handlers
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent)';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#444';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#444';
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

    function loadImage(url) {
        const img = new Image();
        img.onload = () => {
            originalImage = img;
            dropZone.style.display = 'none';
            render();
        };
        img.src = url;
    }

    // Real-time Adjustment Listeners
    Object.keys(sliders).forEach(key => {
        // Handle direct input/change on numeric input
        sliders[key].el.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) {
                sliders[key].value = val;
                render();
            }
        });
        
        sliders[key].el.addEventListener('change', () => {
            saveState();
        });
    });

    // Handle increment/decrement buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('step-btn')) {
            const targetId = e.target.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;

            const step = parseFloat(input.getAttribute('step')) || 1;
            const min = parseFloat(input.getAttribute('min'));
            const max = parseFloat(input.getAttribute('max'));
            let currentVal = parseFloat(input.value) || 0;

            if (e.target.classList.contains('inc')) {
                currentVal += step;
            } else if (e.target.classList.contains('dec')) {
                currentVal -= step;
            }

            // Clamp value
            if (!isNaN(min)) currentVal = Math.max(min, currentVal);
            if (!isNaN(max)) currentVal = Math.min(max, currentVal);

            // Update input and trigger change
            input.value = currentVal.toFixed(2);
            
            // Update internal state and render
            sliders[targetId].value = currentVal;
            render();
            saveState();
        }
    });

    // Transform Handlers
    document.getElementById('rotateLeft').addEventListener('click', () => {
        rotation = (rotation - 90) % 360;
        currentCrop = null; // Reset crop on rotation
        resetCropBtn.disabled = true;
        render();
        saveState();
    });

    document.getElementById('rotateRight').addEventListener('click', () => {
        rotation = (rotation + 90) % 360;
        currentCrop = null; // Reset crop on rotation
        resetCropBtn.disabled = true;
        render();
        saveState();
    });

    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('redoBtn').addEventListener('click', redo);

    // Crop System
    const aspectRatioSelect = document.getElementById('aspectRatio');
    const resetCropBtn = document.getElementById('resetCrop');
    
    document.getElementById('cropBtn').addEventListener('click', () => {
        isCropping = !isCropping;
        document.getElementById('cropBtn').classList.toggle('active', isCropping);
        document.getElementById('cropBtn').textContent = isCropping ? 'Cancel Crop' : 'Start Crop';
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
            
            if (Math.abs(dx / dy) > targetAspect) {
                dx = dy * targetAspect * Math.sign(dx);
            } else {
                dy = dx / targetAspect * Math.sign(dy);
            }
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
            
            // If we are already cropped, we crop relative to the current crop
            // But with rotation reset on every rotate, currentCrop will only be set 
            // on the CURRENT rotation state.
            
            // Rotated pixels dimensions
            const rotatedW = isSideways ? originalImage.height : originalImage.width;
            const rotatedH = isSideways ? originalImage.width : originalImage.height;
            
            // Scale between rotated pixels and current canvas size
            const scaleX = rotatedW / mainCanvas.width;
            const scaleY = rotatedH / mainCanvas.height;

            currentCrop = {
                x: x * scaleX,
                y: y * scaleY,
                width: w * scaleX,
                height: h * scaleY
            };
            
            resetCropBtn.disabled = false;
            saveState();
        }
        
        isCropping = false;
        cropStart = null;
        cropEnd = null;
        document.getElementById('cropBtn').classList.remove('active');
        document.getElementById('cropBtn').textContent = 'Start Crop';
        render();
    }

    function drawCropRect() {
        if (!cropStart || !cropEnd) return;
        ctx.strokeStyle = '#0078d4';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
            cropStart.x, 
            cropStart.y, 
            cropEnd.x - cropStart.x, 
            cropEnd.y - cropStart.y
        );
        ctx.setLineDash([]);
        
        // Add semi-transparent overlay around crop area
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        // Top
        ctx.fillRect(0, 0, mainCanvas.width, Math.min(cropStart.y, cropEnd.y));
        // Bottom
        ctx.fillRect(0, Math.max(cropStart.y, cropEnd.y), mainCanvas.width, mainCanvas.height - Math.max(cropStart.y, cropEnd.y));
        // Left
        ctx.fillRect(0, Math.min(cropStart.y, cropEnd.y), Math.min(cropStart.x, cropEnd.x), Math.abs(cropEnd.y - cropStart.y));
        // Right
        ctx.fillRect(Math.max(cropStart.x, cropEnd.x), Math.min(cropStart.y, cropEnd.y), mainCanvas.width - Math.max(cropStart.x, cropEnd.x), Math.abs(cropEnd.y - cropStart.y));
    }

    function render() {
        if (!originalImage) return;

        let sourceX = 0, sourceY = 0;
        let sourceW = originalImage.width;
        let sourceH = originalImage.height;

        if (currentCrop) {
            sourceX = currentCrop.x;
            sourceY = currentCrop.y;
            sourceW = currentCrop.width;
            sourceH = currentCrop.height;
        }

        let displayWidth = sourceW;
        let displayHeight = sourceH;
        const maxW = 800;
        const maxH = 600;

        const ratio = Math.min(maxW / displayWidth, maxH / displayHeight, 1);
        displayWidth *= ratio;
        displayHeight *= ratio;

        const isSideways = Math.abs(rotation % 180) === 90;
        if (isSideways) {
            mainCanvas.width = displayHeight;
            mainCanvas.height = displayWidth;
        } else {
            mainCanvas.width = displayWidth;
            mainCanvas.height = displayHeight;
        }

        ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        
        // Update SVG filter matrix
        const colorMatrix = document.getElementById('colorMatrix');
        if (colorMatrix) {
            colorMatrix.setAttribute('values', `
                ${sliders.red.value} 0 0 0 0
                0 ${sliders.green.value} 0 0 0
                0 0 ${sliders.blue.value} 0 0
                0 0 0 1 0
            `);
        }

        // Update CSS filters for real-time preview (approximation)
        // Exposure can be approximated by brightness boost/cut
        const exposureBrightness = Math.pow(2, sliders.exposure.value);
        ctx.filter = `url(#colorBalance) brightness(${sliders.brightness.value * exposureBrightness}) contrast(${sliders.contrast.value}) saturate(${sliders.saturation.value})`;
        
        ctx.save();
        ctx.translate(mainCanvas.width / 2, mainCanvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        
        if (currentCrop) {
            // If we have a crop, we've already calculated it relative to the rotated image.
            // BUT the drawImage call below applies rotation AFTER drawing the original image.
            // This is confusing. 
            // A better way to render a crop on a rotated canvas is to 
            // NOT use ctx.rotate if we are already using a crop calculated on the rotated view.
            
            // Wait, if currentCrop is relative to the ROTATED image, 
            // we should just draw that portion of the 'rotated original image'.
            // But we don't have a rotated original image in memory, just the original.
            
            // Let's simplify: 
            // If currentCrop is set, it means the user cropped the CURRENT VIEW.
            // The backend will Rotate then Crop.
            // To preview this, we can draw the original image rotated onto an offscreen canvas,
            // then crop that canvas.
            
            const offCanvas = document.createElement('canvas');
            const isSideways = Math.abs(rotation % 180) === 90;
            offCanvas.width = isSideways ? originalImage.height : originalImage.width;
            offCanvas.height = isSideways ? originalImage.width : originalImage.height;
            const offCtx = offCanvas.getContext('2d');
            
            offCtx.translate(offCanvas.width / 2, offCanvas.height / 2);
            offCtx.rotate((rotation * Math.PI) / 180);
            offCtx.drawImage(originalImage, -originalImage.width / 2, -originalImage.height / 2);
            
            ctx.restore(); // Exit the translate/rotate from earlier
            ctx.drawImage(
                offCanvas,
                currentCrop.x, currentCrop.y, currentCrop.width, currentCrop.height,
                0, 0, mainCanvas.width, mainCanvas.height
            );
        } else {
            ctx.drawImage(
                originalImage,
                -displayWidth / 2, -displayHeight / 2, displayWidth, displayHeight
            );
            ctx.restore();
        }
    }

    exportBtn.addEventListener('click', async () => {
        showLoading(true);
        try {
            const response = await fetch('/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    settings: {
                        exposure: sliders.exposure.value,
                        brightness: sliders.brightness.value,
                        contrast: sliders.contrast.value,
                        highlights: sliders.highlights.value,
                        shadows: sliders.shadows.value,
                        whites: sliders.whites.value,
                        blacks: sliders.blacks.value,
                        temperature: sliders.temperature.value,
                        tint: sliders.tint.value,
                        vibrance: sliders.vibrance.value,
                        saturation: sliders.saturation.value,
                        clarity: sliders.clarity.value,
                        dehaze: sliders.dehaze.value,
                        red: sliders.red.value,
                        green: sliders.green.value,
                        blue: sliders.blue.value,
                        rotation: rotation,
                        crop: currentCrop
                    }
                })
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

    function showLoading(show) {
        loadingOverlay.classList.toggle('active', show);
    }
});
