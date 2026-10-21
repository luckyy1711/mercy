# MERCY — Voice V1

MERCY is a gothic animatronic character project. **The first version is voice-only**: she uses a laptop microphone to recognize English speech and a laptop speaker to respond.

## Features
- Offline speech recognition with Vosk (requires a downloaded English model)
- Offline synthesized voice with espeak-ng
- Built-in basic responses to greetings, name, date/time and goodbyes
- Optional open-ended conversation via a separately installed local Ollama model
- Unit tests for response logic

**Not yet included:** camera, face recognition, eye movements, motor control, ESP32 firmware or human-like consciousness.

## Run later on your Arch Linux laptop

No action required on your current computer. The code is stored here until you're ready.

On the Arch Linux laptop, run:

```bash
sudo pacman -S --needed python python-pip portaudio espeak-ng unzip git curl
git clone https://github.com/luckyy1711/mercy.git
cd mercy
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
mkdir -p models
curl -L -o /tmp/mercy-vosk.zip https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip /tmp/mercy-vosk.zip -d models
python main.py
```

Say: **hello mercy**, **who are you**, **can you hear me**, **what time is it**, or **goodbye mercy**.

The base speech system runs offline after setup. Without a local Ollama model Mercy follows only her built-in responses, not general conversation.

To use an already installed, running Ollama model, set `MERCY_OLLAMA_MODEL` to its installed model name before launching Mercy.

## Tests

```bash
python -m unittest discover -s tests -v
```

## Architecture

Laptop microphone → Vosk → `mercy/brain.py` → espeak-ng → laptop speaker.

In a later phase, a laptop or other powerful computer will handle voice/AI and send movement instructions to an ESP32. A regular ESP32-WROOM-32 cannot run this whole voice/AI stack by itself.

## Roadmap

1. Voice-only prototype (current)
2. More expressive, whisper-like speech and personality
3. Camera/eyes, separate module
4. ESP32-connected movement, separate firmware

Audio is processed locally by default. Tell people when an active microphone is in use.
