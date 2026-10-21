# MERCY v3 — Perception adapter

**Implemented:** browser camera permission workflow, local low-resolution image sampling (64×48), rough brightness and scene-change metadata, visible preview, automatic shutdown when the tab is hidden, and camera track cleanup. No frames or audio are uploaded. Raw frames are not stored. Saving **metadata** to cognition requires an additional checkbox.

**Not implemented:** identifying objects, reading text in images, recognizing faces or people, a computer-vision neural network, continuous iOS background perception, or full multimodal reasoning. The prototype does not claim otherwise.

The camera begins only after the user clicks **Enable camera** and accepts browser permission. It never requests microphone permission (the original browser voice controls are separate). Run on HTTPS or localhost. Camera support varies with device/browser and user permissions.

Code: [perception.js](perception.js). Tests validate light and motion classification, explicit permission, hidden-tab cleanup and cancellation races. Later, a separately evaluated on-device vision model can publish carefully bounded perception events through `onObservation`.