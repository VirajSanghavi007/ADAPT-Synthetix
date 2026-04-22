import time
import os
import torch
import numpy as np
from transformers import pipeline
from scipy.io.wavfile import write

def run_tts():
    text = "Hello, this is ADAPT-Synthetix. The speech recognition pipeline is active."
    output_path = "Model/tts_output.wav"
    os.makedirs("Model", exist_ok=True)
    
    start_time = time.time()
    
    try:
        print("Attempting to load suno/bark-small...")
        # Use Bark-small
        tts = pipeline("text-to-speech", model="suno/bark-small")
        # Bark generates speech with some variation; setting a fixed seed if possible or just running
        output = tts(text)
        
        # Save output
        # Bark output is a dict with 'audio' (numpy array) and 'sampling_rate'
        write(output_path, output["sampling_rate"], output["audio"])
        
        model_used = "suno/bark-small"
        
    except Exception as e:
        print(f"Bark failed: {e}")
        print("Falling back to microsoft/speecht5_tts...")
        
        try:
            from datasets import load_dataset
            
            # Load SpeechT5
            tts = pipeline("text-to-speech", model="microsoft/speecht5_tts")
            
            # Load speaker embeddings
            print("Loading speaker embeddings (Matthijs/cmu-arctic-xvectors)...")
            embeddings_dataset = load_dataset("Matthijs/cmu-arctic-xvectors", split="validation")
            speaker_embeddings = torch.tensor(embeddings_dataset[7306]["xvector"]).unsqueeze(0)
            
            # Generate
            output = tts(text, forward_params={"speaker_embeddings": speaker_embeddings})
            
            # Save
            write(output_path, output["sampling_rate"], output["audio"])
            
            model_used = "microsoft/speecht5_tts"
            
        except Exception as e2:
            print(f"Fallback also failed: {e2}")
            return
            
    end_time = time.time()
    duration = end_time - start_time
    
    print("\n" + "="*30)
    print(f"MODEL USED: {model_used}")
    print(f"INFERENCE TIME: {duration:.2f} seconds")
    print(f"SUCCESS: Audio saved to {output_path}")
    print("="*30)

if __name__ == "__main__":
    run_tts()
