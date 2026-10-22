# MERCY v2 — Cognitive learning

**Current live version (early cognitive prototype).** The legacy v1 archive is unchanged, and the live root app remains the production entry point.

The pure JavaScript [cognitive engine](cognition/engine.js) persists evidence-backed facts and episodes in browser localStorage, supports explicit user corrections with a superseded-fact history, recalls exact facts offline, performs bounded `part_of` transitive inference and selects useful one-time curiosity goals. It is usable without the language model.

Try in Mercy chat:

```text
remember that the skull material is PLA
what is the skull material?
correction: the skull material is resin
what is the skull material?
```

The Cognitive Lab can also teach a subject/value pair explicitly. Regular casual dialogue is journaled as an observation only; it is **not silently promoted to factual knowledge**. Facts come from explicit teaching, not uncertain LLM extraction.

Storage key: `mercy-cognition-v2`. Legacy user-name and chat memory remain stored under `mercy-identity-memory-v1`. Both are kept **only in the visitor's browser**, not pushed to GitHub or a server. The lab supports JSON export and clearing cognitive memory. "Clear Mercy's memory" clears both stores.

Current limitations: compact localStorage (bounded to 120 events and beliefs); simple grammar for text teaching; no semantic generalization or neural training. Saving a fact isn't equivalent to updating model weights. See [architecture](cognition/ARCHITECTURE.md). Future experiments remain separate until a later version is approved.

## Version scope

The v2 website loads **only v2 cognition plus the original v1 voice/model/presence**. It has no camera, hardware-actuation, or future-research panels. Development proceeds incrementally instead of publishing all future versions at once.
