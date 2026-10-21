"""Offline microphone -> Vosk recognition -> text-to-speech on laptop."""
import json
import os
import queue
import shutil
import subprocess
import sys
from pathlib import Path

from .brain import reply, should_stop

MODEL_DIR = Path(os.environ.get("MERCY_VOSK_MODEL", "models/vosk-model-small-en-us-0.15"))

def say(text: str) -> None:
    print(f"MERCY: {text}")
    subprocess.run(["espeak-ng", "-s", "135", "-p", "45", text], check=False)

def run() -> None:
    if not shutil.which("espeak-ng"):
        sys.exit("Please install espeak-ng (see README).")
    if not MODEL_DIR.is_dir():
        sys.exit(f"Missing recognition model: {MODEL_DIR} (see README).")
    try:
        import sounddevice as sd
        from vosk import KaldiRecognizer, Model, SetLogLevel
    except ImportError:
        sys.exit("Install Python packages: pip install -r requirements.txt")

    SetLogLevel(-1)
    rate = 16000
    recognizer = KaldiRecognizer(Model(str(MODEL_DIR)), rate)
    audio: queue.Queue[bytes] = queue.Queue()

    def audio_callback(indata, frames, time_info, status):
        if status:
            print(f"[Audio: {status}]", file=sys.stderr)
        audio.put(bytes(indata))

    print("MERCY is ready. Speak clearly; say 'goodbye Mercy' to exit.")
    say("I am Mercy. I am listening.")
    try:
        with sd.RawInputStream(samplerate=rate, blocksize=4000, dtype="int16", channels=1, callback=audio_callback):
            while True:
                data = audio.get()
                if not recognizer.AcceptWaveform(data):
                    continue
                text = json.loads(recognizer.Result()).get("text", "").strip()
                if not text:
                    continue
                print(f"YOU: {text}")
                answer = reply(text)
                if answer:
                    say(answer)
                # Drop microphone frames captured while Mercy was speaking.
                while not audio.empty():
                    try:
                        audio.get_nowait()
                    except queue.Empty:
                        break
                recognizer.Reset()
                if should_stop(text):
                    break
    except KeyboardInterrupt:
        print("\nMERCY shutting down.")
    except Exception as error:
        sys.exit(f"Microphone error: {error}. Check your device and permissions.")

if __name__ == "__main__":
    run()
