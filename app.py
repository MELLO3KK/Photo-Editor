import io
import os
import uuid
from flask import Flask, render_template, request, jsonify, session
from werkzeug.utils import secure_filename
from processor import ImageProcessor
from PIL import Image

app = Flask(__name__)
app.secret_key = os.urandom(24)

# In-memory storage for images (filename: bytes)
image_store = {}
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
EXPORT_FORMATS = {
    'jpeg': ('JPEG', 'image/jpeg', 'jpg'),
    'jpg': ('JPEG', 'image/jpeg', 'jpg'),
    'png': ('PNG', 'image/png', 'png'),
    'webp': ('WEBP', 'image/webp', 'webp'),
}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def image_mimetype(filename):
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'jpg'
    return EXPORT_FORMATS.get(ext, EXPORT_FORMATS['jpg'])[1]

def normalize_settings(settings):
    defaults = ImageProcessor.get_default_settings()
    normalized = {**defaults, **(settings or {})}

    for key, default_value in defaults.items():
        if key == 'crop':
            continue
        if isinstance(default_value, bool):
            normalized[key] = bool(normalized.get(key))
            continue
        try:
            normalized[key] = float(normalized[key])
        except (ValueError, TypeError, KeyError):
            normalized[key] = default_value

    return normalized

def resize_to_fit(image, export_options):
    width = export_options.get('width')
    height = export_options.get('height')
    try:
        width = int(width) if width not in (None, '') else None
        height = int(height) if height not in (None, '') else None
    except (ValueError, TypeError):
        return image

    if (width is None or width <= 0) and (height is None or height <= 0):
        return image

    original_width, original_height = image.size
    if width is None or width <= 0:
        ratio = height / original_height
        width = max(1, round(original_width * ratio))
    elif height is None or height <= 0:
        ratio = width / original_width
        height = max(1, round(original_height * ratio))

    return image.resize((max(1, width), max(1, height)), Image.Resampling.LANCZOS)

def serialize_image(image, export_options=None):
    export_options = export_options or {}
    requested = str(export_options.get('format', 'jpeg')).lower()
    format_name, mimetype, extension = EXPORT_FORMATS.get(requested, EXPORT_FORMATS['jpeg'])

    image = resize_to_fit(image, export_options)
    if format_name in {'JPEG', 'WEBP'} and image.mode != 'RGB':
        image = image.convert('RGB')

    try:
        quality = int(export_options.get('quality', 95))
    except (ValueError, TypeError):
        quality = 95
    quality = min(100, max(1, quality))

    img_io = io.BytesIO()
    save_kwargs = {}
    if format_name in {'JPEG', 'WEBP'}:
        save_kwargs['quality'] = quality
    if format_name == 'JPEG':
        save_kwargs['optimize'] = True

    image.save(img_io, format_name, **save_kwargs)
    img_io.seek(0)
    return img_io, mimetype, extension

@app.route('/')
def index():
    # Get default settings from processor
    defaults = ImageProcessor.get_default_settings()
    settings = {k: request.args.get(k, str(v)) for k, v in defaults.items() if k != 'crop'}
    
    # Cast to appropriate types
    for k, v in settings.items():
        try:
            settings[k] = float(v) if '.' in v or v in ['0', '200', '500'] else v
        except:
            pass
    
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
    data = request.json or {}
    settings = normalize_settings(data.get('settings', {}))
    
    original_filename = session.get('original_file')
    if not original_filename or original_filename not in image_store:
        return jsonify({'error': 'No image found'}), 404
        
    original_img = Image.open(io.BytesIO(image_store[original_filename]))
    
    # Process the image
    processed_img = ImageProcessor.apply_adjustments(original_img, settings)
    
    # Store processed image in memory temporarily if needed, 
    # but the current app architecture expects a URL to display.
    # We'll generate a temporary UUID for the processed image in memory.
    processed_filename = f"proc_{uuid.uuid4()}.jpg"
    
    img_io, _, _ = serialize_image(processed_img, {'format': 'jpeg', 'quality': 95})
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
    allowed_images = list(session.get('history', []))
    if session.get('original_file'):
        allowed_images.append(session.get('original_file'))
        
    if filename not in image_store or filename not in allowed_images:
        return "Not found or unauthorized", 404
    
    from flask import send_file
    return send_file(io.BytesIO(image_store[filename]), mimetype=image_mimetype(filename))

@app.route('/metadata')
def image_metadata():
    filename = session.get('original_file')
    if not filename or filename not in image_store:
        return jsonify({'error': 'No image uploaded'}), 400

    img = Image.open(io.BytesIO(image_store[filename]))
    return jsonify({
        'filename': filename,
        'width': img.width,
        'height': img.height,
        'format': img.format or filename.rsplit('.', 1)[-1].upper(),
        'mode': img.mode,
        'megapixels': round((img.width * img.height) / 1_000_000, 2),
        'file_size': len(image_store[filename]),
    })

@app.route('/preview')
def preview_image():
    filename = session.get('original_file')
    if not filename or filename not in image_store:
        return "No image uploaded", 400
        
    # Extract settings from query parameters or a JSON config
    config_param = request.args.get('config')
    if config_param:
        import base64
        import json
        try:
            settings = json.loads(base64.b64decode(config_param).decode('utf-8'))
        except Exception:
            settings = ImageProcessor.get_default_settings()
    else:
        # Use defaults from processor
        settings = ImageProcessor.get_default_settings()
        
        # Override with query parameters if present
        for key in settings:
            if key in request.args:
                try:
                    settings[key] = float(request.args.get(key))
                except (ValueError, TypeError):
                    pass
    
    # Ensure all relevant settings are floats (especially if from config JSON)
    defaults = ImageProcessor.get_default_settings()
    for k in defaults:
        if k in settings and k != 'crop':
            try:
                settings[k] = float(settings[k])
            except (ValueError, TypeError):
                pass
    
    original_img = Image.open(io.BytesIO(image_store[filename]))
    processed_img = ImageProcessor.apply_adjustments(original_img, settings)
    
    # Return image directly
    from flask import send_file
    img_io, mimetype, _ = serialize_image(processed_img, {'format': 'jpeg', 'quality': 95})
    return send_file(img_io, mimetype=mimetype)

@app.route('/export', methods=['POST'])
def export_image():
    data = request.json or {}
    settings = normalize_settings(data.get('settings', {}))
    export_options = data.get('export_options', {})
    filename = session.get('original_file')
    
    if not filename or filename not in image_store:
        return jsonify({'error': 'No image to export'}), 400
        
    from flask import send_file
    
    original_img = Image.open(io.BytesIO(image_store[filename]))
    processed_img = ImageProcessor.apply_adjustments(original_img, settings)
    
    img_io, mimetype, extension = serialize_image(processed_img, export_options)
    
    return send_file(
        img_io,
        mimetype=mimetype,
        as_attachment=True,
        download_name=f'edited_image.{extension}'
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
