# 📸 PhotoEditor Pro - Professional Lightroom-Style Web Editor

![PhotoEditor Pro](https://img.shields.io/badge/PhotoEditor-Pro-blue?style=for-the-badge&logo=adobephotoshop)
![Flask](https://img.shields.io/badge/Flask-3.0-green?style=for-the-badge&logo=flask)
![NumPy](https://img.shields.io/badge/NumPy-1.26-blue?style=for-the-badge&logo=numpy)
![OpenCV](https://img.shields.io/badge/OpenCV-4.10-red?style=for-the-badge&logo=opencv)

**PhotoEditor Pro** is a high-performance, Flask-based professional photo editor that brings desktop-grade Lightroom-style controls to the web. It features high-precision backend processing using NumPy and OpenCV, a real-time bi-directional sync system, and a robust preset management engine.

---

## 🌟 Key Features

### 🎨 Professional Adjustments Engine
Powered by **NumPy** and **PIL** for lossless precision processing:
- **Exposure & Contrast**: Global exposure control with logarithmic gain and contrast enhancement.
- **Tone Control**: Fine-grained control over **Highlights, Shadows, Whites,** and **Blacks** using luminance masking.
- **Color Grading**: 
    - **White Balance**: Precise Temperature (Blue-Yellow) and Tint (Green-Magenta) adjustments.
    - **Smart Saturation**: **Vibrance** control that intelligently targets sub-saturated pixels.
    - **RGB Balancing**: Direct gain control for Red, Green, and Blue channels.
- **Presence & Detail**: 
    - **Clarity**: Local contrast enhancement using Gaussian-blurred masks.
    - **Dehaze**: Atmospheric scattering correction.
    - **Sharpness**: High-frequency detail reinforcement.

### 📋 Preset Management System
- **Preset Library**: Instant application of complex adjustment stacks.
- **Bulk Import/Export**: Highly portable JSON-based preset format.
- **Format Template**: Built-in template generator for creating custom preset packs.

### ⚙️ Hybrid UX & Synchronization
- **Real-time Sync**: Bi-directional synchronization between UI sliders and a raw JSON configuration editor (powered by **CodeMirror**).
- **Hybrid Preview**: Instant local feedback combined with a debounced, high-fidelity backend preview for final accuracy.
- **History Stack**: Comprehensive Undo/Redo system tracking every adjustment.
- **Advanced Transformations**: Non-destructive 90° rotation and precision cropping.

---

## 🏗️ Technical Architecture

### Project Structure
```text
Photo-Editor/
├── app.py              # Flask Application (API & Routing)
├── processor.py        # Image Processing Engine (NumPy/OpenCV)
├── requirements.txt    # Project Dependencies
├── static/
│   ├── css/            # Vanilla CSS Styles
│   └── js/
│       └── editor.js   # Core Frontend Logic & Sync
├── templates/
│   └── index.html      # Main Application UI
├── tests/              # Pytest Suite
└── uploads/            # Temporary File Storage (Session-based)
```

### Technical Stack
- **Backend**: Python 3.9+, Flask, Pillow, NumPy, OpenCV-Python.
- **Frontend**: Vanilla JavaScript (ES6+), CodeMirror 5, CSS3 (Modern Flex/Grid).
- **Testing**: Pytest for core algorithm verification.

---

## 🚀 Quick Start

### 1. Environment Setup
```bash
# Clone the repository
git clone <repository-url>
cd Photo-Editor

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate  # Windows
source venv/bin/activate # macOS/Linux
```

### 2. Installation
```bash
pip install -r requirements.txt
```

### 3. Run the App
```bash
python app.py
```
Visit `http://localhost:5000` to start editing.

---

## 🔌 API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/` | GET | Main workspace UI. |
| `/upload` | POST | Uploads image and initializes session state. |
| `/process` | POST | Returns a processed temporary URL for the current settings. |
| `/preview` | GET | Generates a high-precision backend preview image. |
| `/export` | POST | Final 100% quality download of the edited image. |
| `/clear` | POST | Flushes session data and temporary files. |

---

## 📜 Preset Format
Presets use a flat JSON structure for maximum portability:
```json
{
  "name": "Golden Hour",
  "desc": "Warm, high-contrast evening look",
  "settings": {
    "exposure": 30,
    "contrast": 210,
    "temperature": 150,
    "vibrance": 40
  }
}
```

---
*Built with precision for photographers and developers.*