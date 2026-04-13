import os
import uuid
from flask import Flask, render_template, request, jsonify, send_from_directory, session
from werkzeug.utils import secure_filename
from processor import ImageProcessor

app = Flask(__name__)
app.secret_key = os.urandom(24)

# In-memory storage for images (filename: bytes)
image_store = {}
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    # Get settings from query parameters for the Python-only preview
    settings = {
        'brightness': request.args.get('brightness', '200'),
        'contrast': request.args.get('contrast', '200'),
        'saturation': request.args.get('saturation', '200'),
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
        'red': request.args.get('red', '500'),
        'green': request.args.get('green', '500'),
        'blue': request.args.get('blue', '500'),
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
        
        # Store image in memory
        image_store[filename] = file.read()
        
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
    settings = data.get('settings', {})
    
    original_filename = session.get('original_file')
    if not original_filename or original_filename not in image_store:
        return jsonify({'error': 'No image found'}), 404
        
    import io
    from PIL import Image
    original_img = Image.open(io.BytesIO(image_store[original_filename]))
    
    # Process the image
    processed_img = ImageProcessor.apply_adjustments(original_img, settings)
    
    # Store processed image in memory temporarily if needed, 
    # but the current app architecture expects a URL to display.
    # We'll generate a temporary UUID for the processed image in memory.
    processed_filename = f"proc_{uuid.uuid4()}.jpg"
    
    img_io = io.BytesIO()
    processed_img.save(img_io, 'JPEG', quality=95)
    image_store[processed_filename] = img_io.getvalue()
    
    # Track this filename in session to allow access
    if 'history' not in session:
        session['history'] = []
    session['history'].append(processed_filename)
    session.modified = True
    
    return jsonify({
        'success': True,
        'url': f'/uploads/{processed_filename}',
        'filename': processed_filename
    })

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    # Security: Ensure the image belongs to the current session
    allowed_images = session.get('history', [])
    if session.get('original_file'):
        allowed_images.append(session.get('original_file'))
        
    if filename not in image_store or filename not in allowed_images:
        return "Not found or unauthorized", 404
    
    import io
    from flask import send_file
    return send_file(io.BytesIO(image_store[filename]), mimetype='image/jpeg')

@app.route('/preview')
def preview_image():
    filename = session.get('original_file')
    if not filename or filename not in image_store:
        return "No image uploaded", 400
        
    # Extract settings from query parameters
    # ... (rest of settings extraction)
    settings = {
        'brightness': float(request.args.get('brightness', 200.0)),
        'contrast': float(request.args.get('contrast', 200.0)),
        'saturation': float(request.args.get('saturation', 200.0)),
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
        'red': float(request.args.get('red', 500.0)),
        'green': float(request.args.get('green', 500.0)),
        'blue': float(request.args.get('blue', 500.0)),
    }
    
    import io
    from PIL import Image
    original_img = Image.open(io.BytesIO(image_store[filename]))
    processed_img = ImageProcessor.apply_adjustments(original_img, settings)
    
    # Return image directly
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
    
    if not filename or filename not in image_store:
        return jsonify({'error': 'No image to export'}), 400
        
    import io
    from PIL import Image
    from flask import send_file
    
    original_img = Image.open(io.BytesIO(image_store[filename]))
    processed_img = ImageProcessor.apply_adjustments(original_img, settings)
    
    img_io = io.BytesIO()
    processed_img.save(img_io, 'JPEG', quality=100)
    img_io.seek(0)
    
    return send_file(
        img_io,
        mimetype='image/jpeg',
        as_attachment=True,
        download_name='edited_image.jpg'
    )

@app.route('/clear', methods=['POST'])
def clear_session():
    # Remove from memory store
    original = session.get('original_file')
    if original and original in image_store:
        del image_store[original]
        
    # Remove any history items from store
    for item in session.get('history', []):
        if item in image_store:
            del image_store[item]

    session.pop('original_file', None)
    session.pop('history', None)
    session.pop('history_index', None)
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True)
