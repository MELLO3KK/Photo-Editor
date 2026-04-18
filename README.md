# PhotoEditor Pro - Professional Lightroom-Style Web Editor

![PhotoEditor Pro](https://img.shields.io/badge/PhotoEditor-Pro-blue?style=for-the-badge)
![Flask](https://img.shields.io/badge/Flask-3.0-green?style=for-the-badge)
![NumPy](https://img.shields.io/badge/NumPy-1.26-yellow?style=for-the-badge)
![OpenCV](https://img.shields.io/badge/OpenCV-4.10-red?style=for-the-badge)

A powerful, Flask-based professional photo editor that brings Lightroom-style controls to the web. Featuring real-time local previews, high-precision backend processing with NumPy and OpenCV, and a robust preset management system.

## 🌟 Key Features

### 🎨 Professional Adjustments
- **Basic Light**: Global Exposure, Brightness, and Contrast controls.
- **Tone Control**: Fine-tuned Highlights, Shadows, Whites, and Blacks adjustment.
- **Color & Presence**: Temperature (WB), Tint, Vibrance (Smart Saturation), Clarity (Local Contrast), Dehaze, and Global Saturation.
- **Precision Balancing**: RGB Channel gain controls for perfect color grading.
- **Sharpness**: High-frequency detail enhancement.

### 🛠️ Transformation Tools
- **Non-Destructive Rotation**: 90-degree increments with real-time preview.
- **Precision Crop**: (Internal structure supported) for perfect framing.

### 📋 Preset Management
- **Preset Library**: Create, manage, and apply custom styles instantly.
- **Bulk Import/Export**: Import custom preset libraries via JSON.
- **State Synchronization**: Bi-directional sync between UI controls and a raw JSON configuration editor (powered by CodeMirror).

### ⚙️ Engine & UX
- **Hybrid Preview System**: Instant local canvas preview combined with debounced high-quality backend processing for maximum accuracy.
- **History System**: Complete Undo/Redo stack tracking every adjustment.
- **Drag & Drop**: Seamlessly import images by dragging them into the workspace.
- **High-Quality Export**: 100% quality JPEG export for professional workflows.

## 🏗️ Technical Stack

- **Backend**: 
  - [Flask](https://flask.palletsprojects.com/) - Python web framework.
  - [Pillow (PIL)](https://python-pillow.org/) - Advanced image manipulation.
  - [NumPy](https://numpy.org/) - Scientific computing for high-precision pixel math.
  - [OpenCV](https://opencv.org/) - Computer vision for advanced filters like Clarity and Dehaze.
- **Frontend**: 
  - **Vanilla JavaScript** - High-performance core logic.
  - **CodeMirror** - Integrated JSON configuration editor.
  - **HTML5 Canvas / CSS3** - Responsive UI and real-time preview rendering.

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- pip

### Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Photo-Editor
   ```

2. **Setup Virtual Environment**:
   ```bash
   python -m venv venv
   # Windows
   .\venv\Scripts\activate
   # macOS/Linux
   source venv/bin/activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Launch the Application**:
   ```bash
   python app.py
   ```
   Open `http://localhost:5000` in your browser.

## 🧪 Testing

The project uses `pytest` for unit testing the image processing core and API endpoints.

```bash
pytest
```

## 📜 Preset Format Example

Custom presets can be imported in the following JSON format:

```json
[
  {
    "name": "Neon Nights",
    "desc": "Vibrant city vibes with deep blues and neons",
    "settings": {
      "exposure": 10,
      "brightness": 180,
      "contrast": 240,
      "highlights": -50,
      "shadows": 40,
      "temperature": -120,
      "vibrance": 60
    }
  }
]
```

---
*Built with ❤️ for photographers and developers.*