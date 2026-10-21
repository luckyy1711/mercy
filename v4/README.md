# MERCY v4 — Embodiment adapter and safe simulator

**Implemented:** a pure JavaScript simulated jaw, head pitch/yaw, and eye axes with explicit arming, position bounds, maximum step sizes, rate limiting, deliberate emergency stop/reset, disarming, and command outcomes. The Cognitive Lab provides a virtual jaw test. A transport adapter can be injected for future hardware development, but **production does not enable any physical transport**.

**Not implemented or tested:** an ESP32 connection, a physical servo, installed iPhone 11 robotics integration, jaw position feedback, hardware watchdog, end-to-end emergency stop, servo power management or real-time actuation.

**Before physical use:** verify voltages, current limits, mechanical range/clearance, thermal conditions, an independent emergency stop, loss-of-signal watchdog, and authenticated transport. Neither a UI button nor software validation alone is an adequate hardware safety system.

Code: [embodiment.js](embodiment.js). Command values are degrees and are strictly limited; raw arbitrary motor commands are rejected. Physical adapters fail closed by default (`hardwareEnabled` must be explicitly set by a future reviewed host).