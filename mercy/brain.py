"""Text-in/text-out voice behavior: simple replies or optional local AI."""
import json
import os
import urllib.error
import urllib.request
from datetime import datetime

NAME = "Mercy"

def fallback_reply(text: str) -> str:
    """Offline scripted responses; not an open-ended conversational AI."""
    command = text.strip().lower().rstrip("?.!")
    if not command:
        return ""
    if command in {"quit", "exit", "goodbye mercy", "mercy goodbye"}:
        return "Goodbye."
    if any(phrase in command for phrase in ("what is your name", "who are you")):
        return "My name is Mercy. I am listening."
    if "time" in command:
        return f"The time is {datetime.now():%I:%M %p}."
    if "date" in command or "today" in command:
        return f"Today is {datetime.now():%A, %B %d}."
    if any(phrase in command for phrase in ("hello", "hey mercy", "hi mercy")):
        return "Hello. I heard you."
    if "can you hear me" in command:
        return "Every word."
    return "I heard you say: " + text.strip() + ". My conversational brain is not connected yet."

def ollama_reply(text: str) -> str | None:
    """Optional local AI via a separately configured Ollama service."""
    model = os.environ.get("MERCY_OLLAMA_MODEL", "").strip()
    if not model:
        return None
    endpoint = os.environ.get("MERCY_OLLAMA_URL", "http://127.0.0.1:11434/api/generate")
    payload = json.dumps({
        "model": model,
        "system": (
            "You are Mercy, a mysterious but kind gothic animatronic sculpture. "
            "Respond naturally, without markdown, in one or two short sentences. "
            "You have no sight or motors connected yet. Never claim otherwise."
        ),
        "prompt": text,
        "stream": False,
        "options": {"num_predict": 90},
    }).encode("utf-8")
    request = urllib.request.Request(endpoint, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            result = json.load(response)
        return str(result.get("response", "")).strip() or None
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as error:
        print(f"[AI unavailable: {error}. Using simple responses.]")
        return None

def reply(text: str) -> str:
    return ollama_reply(text) or fallback_reply(text)

def should_stop(text: str) -> bool:
    return text.strip().lower().rstrip("?.!") in {"quit", "exit", "goodbye mercy", "mercy goodbye"}
