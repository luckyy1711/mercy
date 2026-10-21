# MERCY v1.0 — Browser Voice & Personality

**Frozen source snapshot: 21 October 2026**  
**Complete archival branch:** [archive/v1.0](https://github.com/luckyy1711/mercy/tree/archive/v1.0)  
**Original commit:** [1915f7ac0f55](https://github.com/luckyy1711/mercy/commit/1915f7ac0f554cbd7cb64bfd2d23bc39eccbbe80)

This folder stores all of v1's source code, tests, historical Python prototype, and CI workflow definitions. `ORIGINAL_README.md` is the original README before the version folders were introduced. Its source files should be treated as an archive, not the actively edited app.

**Important:** The large model binaries (over 490 MB combined) are **not duplicated in this folder**. Copying them would needlessly increase the GitHub Pages deployment size and could exceed hosting limits. The complete v1 repository, including every model chunk and its exact bytes, is preserved on the [archive/v1.0 branch](https://github.com/luckyy1711/mercy/tree/archive/v1.0). See [models/README.md](models/README.md).

## What v1 contains

- **Voice and conversation:** Web Speech Recognition for browsers that support it; browser speech synthesis with Mercy's established haunting voice settings (`VOICE_RATE=0.75`, `VOICE_PITCH=0.45`).
- **Local generative AI:** Started with SmolLM2-135M-Instruct; upgraded to SmolLM2-360M-Instruct quantized ONNX, running in the visitor's browser through Transformers.js and WASM. No paid API required.
- **GitHub-hosted model:** Split ONNX files, a manifest, service-worker reassembly, and caching. First use downloads the model; offline availability depends on successfully cached files.
- **Memory:** Local browser storage retains past exchanges, a user-introduced name, and fictional self-reflection, with a memory-clear control.
- **Animated presence:** Gothic skull, gaze following, naturalistic blink timing, speech-linked jaw pulses where browser timing events are available, and reduced-motion support.
- **Optional autonomy:** Mercy may generate a spontaneous short remark during a quiet moment while the page is open and visible; opt-in, cooldown, silence cap, and Stop controls.
- **Coherence improvements:** Shorter contextual prompts, a fresh context for greetings, and a larger model; quality still depends on model capability.
- **Tests and automation:** JavaScript syntax and integration tests, Python legacy tests, a real-model inference smoke test, model-vending workflow, and GitHub Pages deployment.
- **Legacy laptop prototype:** `main.py`, `mercy/brain.py`, `mercy/voice.py`, `requirements.txt` for the separate Python speech experiment.

## Limits of v1

The current site is a static web application, **not an always-awake agent**. There is no camera vision or physical skull control yet. Model mistakes can still occur; the 360M model does not have human-level conversational intelligence. Self-monitoring and autonomous speech do not establish sentience.

**Personal memory is not in GitHub.** Each visitor's browser stores its own memory locally, so code version backups do not include memories or identity details.

## Where new work goes

- [v2 — Cognition](../v2/README.md): the next developmental milestone.
- [Main repository](../README.md): the currently deployed website. We intentionally leave its production entry point at the root until a new release is tested.
