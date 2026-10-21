"use strict";
/**
 * Browser composition root. Operates offline and never starts a camera or motor.
 * Keeps cognition independent of the language model and UI implementation.
 */
(function () {
  const cognition = window.MercyCognition?.create({
    onChange: () => {
      if (typeof window.dispatchEvent === "function" && typeof Event === "function")
        window.dispatchEvent(new Event("mercy:cognition-change"));
    }
  });
  if (!cognition) return;
  const supervisor = window.MercyResearch.createSupervisor({cognition});
  const experiments = window.MercyResearch.createExperiments();
  const simulator = window.MercyEmbodiment.create();
  // A physical ESP32 transport is intentionally absent and DISABLED.
  window.MercyBrain = Object.freeze({cognition, supervisor, experiments, simulator,
    selfCheck: () => window.MercyResearch.selfCheck(window.MercyCognition)});
})();
