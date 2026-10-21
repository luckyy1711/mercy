"use strict";
/**
 * MERCY v5: bounded cognitive orchestration, diagnostics and improvement
 * proposals. It never silently edits or retrains the running brain.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MercyResearch = api;
})(typeof window !== "undefined" ? window : null, function () {
  function createSupervisor(options = {}) {
    if (!options.cognition || typeof options.cognition.chooseQuestion !== "function")
      throw new TypeError("A cognition engine is required");
    const cognition = options.cognition;
    const now = options.now ?? (() => Date.now());
    const cooldownMs = Math.max(15000, options.cooldownMs ?? 120000);
    const onDecision = options.onDecision ?? (() => {});
    const history = [];
    let enabled = false, lastDecision = -Infinity;

    function decision(action, reason, plan = null) {
      const entry = {at: now(), action, reason, plan: plan ? {...plan} : null};
      history.push(entry);
      if (history.length > 40) history.shift();
      onDecision({...entry});
      return {...entry};
    }
    function setEnabled(value) { enabled = value === true; }
    function tick({visible = true, userBusy = false, allowQuestions = false} = {}) {
      // No timer here. The host explicitly decides when to call tick.
      if (!enabled || !allowQuestions) return decision("silent", "Autonomy is disabled");
      if (!visible || userBusy) return decision("silent", "Not an appropriate moment");
      if (now() - lastDecision < cooldownMs) return decision("silent", "Cooling down");
      const plan = cognition.chooseQuestion();
      if (plan.action !== "ask") return decision("silent", plan.reason);
      return decision("ask", "Relevant, unanswered project question", plan);
    }
    function completed(plan) {
      if (!enabled || !plan || plan.action !== "ask") return false;
      const didMark = cognition.markAsked(plan);
      if (didMark) lastDecision = now();
      return didMark;
    }
    return Object.freeze({tick, setEnabled, completed,
      history: () => history.map(e => ({...e, plan: e.plan ? {...e.plan} : null})),
      status: () => ({enabled, lastDecision})});
  }

  function createExperiments(options = {}) {
    const now = options.now ?? (() => Date.now());
    const proposals = [];
    let counter = 0;
    function propose({title, hypothesis, metric, cost = 1} = {}) {
      if (![title, hypothesis, metric].every(s => typeof s === "string" &&
          s.trim().length > 2 && s.length <= 220) ||
          !Number.isFinite(cost) || cost < 0 || cost > 100)
        return {ok: false, error: "Provide a bounded hypothesis and measurable metric."};
      const proposal = {id: ++counter, title: title.trim(), hypothesis: hypothesis.trim(),
        metric: metric.trim(), estimatedCost: cost, createdAt: now(),
        status: "proposed"};
      proposals.push(proposal);
      if (proposals.length > 60) proposals.shift();
      return {ok: true, proposal: {...proposal}};
    }
    function decide(id, accepted) {
      const item = proposals.find(p => p.id === id);
      if (!item || item.status !== "proposed") return false;
      item.status = accepted === true ? "approved-for-testing" : "rejected";
      // Approval marks the experiment for HUMAN-controlled testing.
      // This is not permission to rewrite code, deploy, or actuate anything.
      return true;
    }
    return Object.freeze({propose, decide, list: () => proposals.map(p => ({...p}))});
  }

  function selfCheck(cognitionApi) {
    if (!cognitionApi || typeof cognitionApi.create !== "function")
      throw new TypeError("Cognition API required");
    const values = new Map();
    const storage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value)
    };
    let passed = 0;
    const checks = [];
    function check(name, condition) {
      const ok = condition === true;
      checks.push({name, ok});
      if (ok) passed++;
    }
    let time = 100;
    const first = cognitionApi.create({storage, now: () => ++time});
    check("Initially no facts", first.stats().knownFacts === 0);
    const learned = first.processText("remember that the skull material is PLA");
    check("Explicit knowledge acquired", learned.handled &&
      first.recall("skull material")?.value === "PLA");
    const correction = first.processText("correction: the skull material is resin");
    check("Correction overwrites current value", correction.handled &&
      first.recall("skull material")?.value === "resin");
    check("Previous evidence retained", first.stats().corrections === 1);
    const second = cognitionApi.create({storage, now: () => ++time});
    check("Reload persists corrected value", second.recall("skull material")?.value === "resin");
    check("Curiosity has a relevant question", second.chooseQuestion().action === "ask");
    const plan = second.chooseQuestion();
    check("Question can be marked asked", second.markAsked(plan));
    check("Question is not repeated", second.chooseQuestion().action === "silent");
    check("No fabricated unknown facts", second.recall("skull serial number") === null);
    const visitor = second.processText("hello");
    check("Ordinary speech is not silently converted to a fact", visitor.handled === false);
    second.clear();
    check("Knowledge clearing works", second.stats().knownFacts === 0);
    return {passed, total: checks.length, success: passed === checks.length, checks};
  }

  return Object.freeze({createSupervisor, createExperiments, selfCheck});
});
