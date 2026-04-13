import os
import uuid
from flask import Flask, render_template, request, jsonify, send_from_directory, session
from werkzeug.utils import secure_filename
from processor import ImageProcessor

app = Flask(__name__)
app.secret_key = os.urandom(24)

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    # Get settings from query parameters for the Python-only preview
    settings = {
        'brightness': request.args.get('brightness', '1'),
        'contrast': request.args.get('contrast', '1'),
        'saturation': request.args.get('saturation', '1'),
        'exposure': request.args.get('exposure', '0'),
        'temperature': request.args.get('temperature', '0'),
        'tint': request.args.get('tint', '0'),
        'highlights': request.args.get('highlights', '0'),
        'shadows': request.args.get('shadows', '0'),
        'whites': request.args.get('whites', '0'),
        'blacks': request.args.get('blacks', '0'),
        'vibrance': request.args.get('vibrance', '0'),
        'clarity': request.args.get('clarity', '0'),
        'dehaze': request.args.get('dehaze', '0'),
        'red': request.args.get('red', '1'),
        'green': request.args.get('green', '1'),
        'blue': request.args.get('blue', '1'),
    }
    
    # Generate preview URL if there is an original file in session
    preview_url = None
    if session.get('original_file'):
        import urllib.parse
        preview_url = f"/preview?{urllib.parse.urlencode(settings)}"
        
    return render_template('index.html', settings=settings, preview_url=preview_url)

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(f"{uuid.uuid4()}_{file.filename}")
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # Initialize session state for this image
        session['original_file'] = filename
        session['history'] = [filename]
        session['history_index'] = 0
        
        return jsonify({
            'success': True,
            'filename': filename,
            'url': f'/uploads/{filename}'
        })
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/process', methods=['POST'])
def process_image():
    data = request.json
    filename = data.get('filename')
    settings = data.get('settings', {})
    
    original_path = os.path.join(app.config['UPLOAD_FOLDER'], session.get('original_file'))
    
    # Process the image
    processed_img = ImageProcessor.apply_adjustments(original_path, settings)
    
    # Save processed image to a temp file
    processed_filename = f"proc_{uuid.uuid4()}.jpg"
    processed_path = os.path.join(app.config['UPLOAD_FOLDER'], processed_filename)
    processed_img.save(processed_path, quality=95)
    
    return jsonify({
        'success': True,
        'url': f'/uploads/{processed_filename}',
        'filename': processed_filename
    })

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/preview')
def preview_image():
    filename = session.get('original_file')
    if not filename:
        return "No image uploaded", 400
        
    # Extract settings from query parameters
    settings = {
        'brightness': float(request.args.get('brightness', 1.0)),
        'contrast': float(request.args.get('contrast', 1.0)),
        'saturation': float(request.args.get('saturation', 1.0)),
        'exposure': float(request.args.get('exposure', 0.0)),
        'temperature': float(request.args.get('temperature', 0.0)),
        'tint': float(request.args.get('tint', 0.0)),
        'highlights': float(request.args.get('highlights', 0.0)),
        'shadows': float(request.args.get('shadows', 0.0)),
        'whites': float(request.args.get('whites', 0.0)),
        'blacks': float(request.args.get('blacks', 0.0)),
        'vibrance': float(request.args.get('vibrance', 0.0)),
        'clarity': float(request.args.get('clarity', 0.0)),
        'dehaze': float(request.args.get('dehaze', 0.0)),
        'red': float(request.args.get('red', 1.0)),
        'green': float(request.args.get('green', 1.0)),
        'blue': float(request.args.get('blue', 1.0)),
    }
    
    original_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    processed_img = ImageProcessor.apply_adjustments(original_path, settings)
    
    # Return image directly
    import io
    from flask import send_file
    img_io = io.BytesIO()
    processed_img.save(img_io, 'JPEG', quality=80)
    img_io.seek(0)
    return send_file(img_io, mimetype='image/jpeg')

@app.route('/export', methods=['POST'])
def export_image():
    data = request.json
    settings = data.get('settings', {})
    filename = session.get('original_file')
    
    if not filename:
        return jsonify({'error': 'No image to export'}), 400
        
    original_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    processed_img = ImageProcessor.apply_adjustments(original_path, settings)
    
    export_filename = f"export_{filename}"
    export_path = os.path.join(app.config['UPLOAD_FOLDER'], export_filename)
    processed_img.save(export_path, quality=100)
    
    return jsonify({
        'success': True,
        'url': f'/uploads/{export_filename}'
    })

@app.route('/clear', methods=['POST'])
def clear_session():
    session.pop('original_file', None)
    session.pop('history', None)
    session.pop('history_index', None)
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True)
