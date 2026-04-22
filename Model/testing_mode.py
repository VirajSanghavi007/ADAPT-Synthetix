import torch
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC
import librosa

processor = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base-960h")
model = Wav2Vec2ForCTC.from_pretrained("facebook/wav2vec2-base-960h")
model.eval()

audio, sr = librosa.load("Dataset/Record.mp3", sr=16000)
inputs = processor(audio, sampling_rate=16000, return_tensors="pt", padding=True)

with torch.no_grad():
    logits = model(**inputs).logits

predicted_ids = torch.argmax(logits, dim=-1)
transcription = processor.batch_decode(predicted_ids)
print(transcription.capitalize())