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
    return render_template('index.html')

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

if __name__ == '__main__':
    app.run(debug=True)
