# MERCY v2.0 — Cognition

**Status: PLANNING / DEVELOPMENT. Not a published new AI brain yet.**

This is Mercy's next major version: a learning and curiosity system. All code and decisions here will be developed and tested separately while the existing GitHub Pages site remains functional.

## Mission

Mercy should gradually learn **what she encounters**, connect information to memories, notice uncertainty, ask relevant questions, correct mistaken beliefs and decide whether a useful action is warranted. The intention is to build an *autonomous cognitive architecture*, not claim or simulate proof of consciousness.

## Version 2 milestones

1. **Structured knowledge and episodic memory** — persist events and verified facts separately from generated chat text. Track sources and uncertainty.
2. **Reasoning and correction** — derive simple relationships, detect contradictions, accept user corrections, and avoid making up missing facts.
3. **Curiosity engine** — identify a knowledge gap relevant to an ongoing task, decide whether asking would help, and respect silence and consent.
4. **Small goal/decision engine** — propose a goal, evaluate available actions and constraints, keep a record of decisions, or deliberately do nothing.
5. **Natural speech interface** — keep the language model as a flexible voice interface while the cognitive modules decide what to learn, say, or do.
6. **Sensors and embodiment later** — optional iPhone 11 camera/microphone and future skull movement hardware when they exist and have permission.

## Rules for development

- **v1 is preserved** in the [v1 folder](../v1/README.md) and the complete [archive/v1.0 branch](https://github.com/luckyy1711/mercy/tree/archive/v1.0).
- **No unauthorized sensing.** Camera and microphone capture require explicit permissions and visible controls.
- **Do not overwrite memories silently.** Store provenance and corrections; provide a user-controlled reset and export before replacing storage formats.
- **No unbounded background loops.** The iPhone 11 has iOS background-execution and memory limits. Our first tests will run with text input in a browser.
- **No automatic self-retraining** without evaluation and rollback. Continual neural learning is a separate research effort.
- Keep the currently deployed site in the repository root until a v2 build passes tests and is ready for promotion.

[Technical cognition design](cognition/ARCHITECTURE.md)
