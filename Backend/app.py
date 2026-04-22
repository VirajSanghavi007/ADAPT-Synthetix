import os
import torch
import librosa
from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC
from werkzeug.utils import secure_filename

app = Flask(__name__, 
            static_folder='../Frontend', 
            static_url_path='')
CORS(app)

@app.route('/')
def index():
    return app.send_static_file('index.html')

# Configuration
UPLOAD_FOLDER = 'temp'
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'm4a', 'flac', 'webm', 'ogg'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024 # 32MB max

# Create temp directory if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Load Wav2Vec2 model and processor once at startup
print("Loading ASR model (facebook/wav2vec2-base-960h)...")
PROCESSOR = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base-960h")
MODEL = Wav2Vec2ForCTC.from_pretrained("facebook/wav2vec2-base-960h")
MODEL.eval()
print("Model loaded successfully.")

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio part in the request"}), 400
    
    file = request.files['audio']
    
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if file:
        # Handle files without extensions (default to .webm for chunks)
        filename = secure_filename(file.filename)
        if '.' not in filename:
            filename += '.webm'
            
        if not filename.lower().endswith(tuple(f'.{ext}' for ext in ALLOWED_EXTENSIONS)):
            return jsonify({"error": "Unsupported file format"}), 400

        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        try:
            # 1. Resample to 16kHz mono using librosa
            # librosa.load naturally converts to mono and we force sr=16000
            audio_input, sr = librosa.load(filepath, sr=16000)
            
            # 2. Run through Wav2Vec2
            inputs = PROCESSOR(audio_input, sampling_rate=16000, return_tensors="pt", padding=True)
            
            with torch.no_grad():
                logits = MODEL(**inputs).logits
            
            predicted_ids = torch.argmax(logits, dim=-1)
            transcription = PROCESSOR.batch_decode(predicted_ids)[0] # Extract first result
            
            # 3. Clean up the temporary file
            os.remove(filepath)
            
            return jsonify({
                "transcription": transcription,
                "status": "success"
            })
            
        except Exception as e:
            # Clean up on error
            if os.path.exists(filepath):
                os.remove(filepath)
            return jsonify({"error": str(e)}), 500
    
    return jsonify({"error": "Unsupported file format"}), 400

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "model": "wav2vec2-base-960h"}), 200

if __name__ == '__main__':
    # Using threaded=True to handle multiple connections potentially, 
    # though model inference is synchronous on CPU
    app.run(host='0.0.0.0', port=5000, debug=False)
