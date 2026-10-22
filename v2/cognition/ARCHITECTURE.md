# MERCY cognition architecture — implemented v2 prototype

```text
User message ───► explicit fact parser ─────► belief revision ──► localStorage
       │                    │                       │
       └──────────► episodic observation            ├──► exact factual answer
                                                    ├──► evidence-linked part_of inference
                                                    └──► bounded curiosity candidate
                                                               │
                                       v1 opt-in autonomy toggle ───┘
                                                               │
                                    v1 on-device language model expresses question
```

## Trusted and untrusted knowledge

- Ordinary text chats become **episodes**; they are not verified facts.
- Explicit `remember that ...`, `correction: ...` and Lab Teach actions are stored as **user-provided beliefs**.
- Every stored belief has a source, evidence-event ID and modification time. Corrections mark old belief versions `superseded`.
- Only exact grounded lookups bypass the language model. No belief is fabricated to fill an unknown.
- Curiosity is derived from a known user-mentioned project and an unasked progress gap, not from random timing.
- Inference is deliberately restricted to bounded transitive `part_of` relationships with supporting belief IDs.

## Real limitations

This system is **not** an AGI or a conscious entity. The current text grammar is deliberately conservative to minimize incorrect memory. Confidence calibration, contradiction resolution across untrusted sources, embedded vector search, and model fine-tuning are future research work.

## Privacy and robustness

Browser localStorage is not encrypted. It can be unavailable or cleared by the browser. Cognitive histories are size-bounded and recover from invalid saved JSON without executing it. JSON export requires a button click; imported arbitrary code is not supported. Camera sensing is not part of the deployed v2 website.

The production website uses v1-style local text generation and voice plus the v2 learning module; only autonomous speech is opt-in. Tests: `node --test tests/*.test.cjs`.