# Lightroom-Style Photo Editor

A Flask-based web application for professional photo editing with real-time adjustments, crop, rotate, and more.

## Features
- **Image Adjustments**: Brightness, Contrast, Exposure, Highlights, Shadows, Saturation, Vibrance, Temperature, Tint.
- **Transformation Tools**: Crop, Rotate, Resize.
- **Advanced Controls**: Undo/Redo stack, Real-time WebGL preview.
- **Export**: Save edited images in high quality.

## Tech Stack
- **Backend**: Flask, Pillow, OpenCV, NumPy.
- **Frontend**: Vanilla JS, WebGL, Canvas API, CSS3.

## Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Photo-Editor
   ```

2. **Create a virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the application**:
   ```bash
   python app.py
   ```
   The app will be available at `http://localhost:5000`.

## Testing
Run tests using pytest:
```bash
pytest
```