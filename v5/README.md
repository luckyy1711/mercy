# MERCY v5 — Bounded autonomy and research tools

**Implemented:** a pure-JavaScript supervisor that selects one relevant question from the v2 curiosity plan only when enabled, available and beyond its cooldown; an in-browser cognitive self-check; and a locally persistent experiment proposal ledger to capture a title, hypothesis, measurable metric, estimated cost and approval-for-testing status.

The site's existing autonomous speech switch enables the supervisor. When it has a specific, grounded question, the local language model expresses the intention naturally. If no suitable fact is available, the old opt-in spontaneous conversation mode can still operate. No continuous hidden background operation is implied.

**Not implemented:** autonomous neural weight updates, code self-modification, perpetual self-training, scientifically verified consciousness, AGI, or unattended scientific research. Proposals cannot modify software or hardware. Approval-for-testing is a label, not permission for automated deployments. The self-check checks deterministic cognition operations; it is not a general-intelligence benchmark.

Code: [research.js](research.js). Automated tests cover supervised decisions, learned-fact recall, correction, camera privacy behaviors and guarded simulator commands.

**Future research:** held-out evaluations of conversational relevance, calibration, incremental learning/forgetting, perception-model accuracy, battery benchmarks on the iPhone 11, and independently checked model update/rollback pipelines.