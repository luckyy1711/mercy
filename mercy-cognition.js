"use strict";
/**
 * MERCY v2 composition root. Do not load future experimental modules here.
 * Only explicit user-provided facts are promoted to beliefs.
 */
(function () {
  const Cognition = window.MercyCognition;
  if (!Cognition) return;

  const cognition = Cognition.create({
    onChange: () => {
      if (typeof window.dispatchEvent === "function" && typeof Event === "function") {
        window.dispatchEvent(new Event("mercy:cognition-change"));
      }
    }
  });

  function selfCheck() {
    // Self-tests use temporary memory; they cannot modify Mercy's saved facts.
    const values = new Map();
    const storage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value)
    };
    const checks = [];
    const check = (name, passed) => checks.push({name, ok: passed === true});
    let timestamp = 100;
    try {
      const first = Cognition.create({storage, now: () => ++timestamp});
      check("Starts without facts", first.stats().knownFacts === 0);
      check("Learns an explicit fact",
        first.processText("remember that the skull material is PLA").handled &&
        first.recall("skull material")?.value === "PLA");
      check("Corrects an existing belief",
        first.processText("correction: the skull material is resin").handled &&
        first.recall("skull material")?.value === "resin");
      check("Retains correction provenance", first.stats().corrections === 1);
      const restored = Cognition.create({storage, now: () => ++timestamp});
      check("Persists across reloads", restored.recall("skull material")?.value === "resin");
      const question = restored.chooseQuestion();
      check("Identifies a relevant question", question.action === "ask");
      check("Records a question only once",
        restored.markAsked(question) && !restored.markAsked(question));
      check("Chooses silence after resolving the gap", restored.chooseQuestion().action === "silent");
      check("Does not invent unknown facts", restored.recall("unknown") === null);
      check("Does not treat casual chat as fact", !restored.processText("hello").handled);
      restored.clear();
      check("Clears its own memory", restored.stats().knownFacts === 0);
    } catch (error) {
      checks.push({name: "Self-check encountered an error", ok: false});
    }
    const passed = checks.filter(c => c.ok).length;
    return {passed, total: checks.length, success: passed === checks.length, checks};
  }

  window.MercyBrain = Object.freeze({cognition, selfCheck});
})();