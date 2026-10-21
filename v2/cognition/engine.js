"use strict";
/**
 * MERCY Cognition v2: explainable, local-first beliefs and episodic evidence.
 * Not a sentience simulator, a language model, or a hidden recording service.
 * Compatible with a normal browser script and Node's CommonJS test runner.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MercyCognition = api;
})(typeof window !== "undefined" ? window : null, function () {
  const VERSION = 2;
  const KEY = "mercy-cognition-v2";
  const MAX_EVENTS = 120;
  const MAX_BELIEFS = 120;
  const MAX_QUESTIONS = 40;
  const IDENTIFIER = /^[\p{L}\p{N}][\p{L}\p{N} _'/-]*$/u;

  const fresh = () => ({version: VERSION, serial: 0, events: [], beliefs: [], questions: []});
  const compact = (text, max) => String(text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const canonical = text => compact(text, 72).toLocaleLowerCase("en");
  const clone = value => JSON.parse(JSON.stringify(value));
  const validText = (value, limit) =>
    typeof value === "string" && value.trim().length > 0 && value.trim().length <= limit;

  function create(options = {}) {
    const storage = options.storage ?? (typeof localStorage === "undefined" ? null : localStorage);
    const clock = options.now ?? (() => Date.now());
    const onChange = typeof options.onChange === "function" ? options.onChange : () => {};
    let state = fresh();

    function validBelief(b) {
      return b && Number.isSafeInteger(b.id) && validText(b.subject, 72) &&
        validText(b.predicate, 40) && validText(b.value, 200) &&
        ["active", "superseded"].includes(b.status) &&
        Number.isFinite(b.at) && ["user", "inferred"].includes(b.source);
    }

    function load() {
      try {
        const raw = storage?.getItem(KEY);
        if (!raw || raw.length > 350000) return;
        const parsed = JSON.parse(raw);
        if (parsed?.version !== VERSION) return;
        state = {
          version: VERSION,
          serial: Number.isSafeInteger(parsed.serial) && parsed.serial >= 0 ? parsed.serial : 0,
          events: Array.isArray(parsed.events) ? parsed.events.filter(e =>
            e && Number.isSafeInteger(e.id) && Number.isFinite(e.at) &&
            validText(e.kind, 30) && validText(e.content, 300)).slice(-MAX_EVENTS) : [],
          beliefs: Array.isArray(parsed.beliefs) ? parsed.beliefs.filter(validBelief).slice(-MAX_BELIEFS) : [],
          questions: Array.isArray(parsed.questions) ? parsed.questions.filter(q =>
            q && Number.isSafeInteger(q.id) && validText(q.subject, 72) &&
            validText(q.missing, 40) && Number.isFinite(q.at)).slice(-MAX_QUESTIONS) : []
        };
        state.serial = Math.max(state.serial, ...state.events.map(e => e.id),
          ...state.beliefs.map(b => b.id), ...state.questions.map(q => q.id), 0);
      } catch (_) {
        state = fresh();
      }
    }

    function persist() {
      try { storage?.setItem(KEY, JSON.stringify(state)); } catch (_) {
        // Private browsing and storage quotas can block persistence.
      }
      onChange(snapshot());
    }

    function record(kind, content, source = "user") {
      const entry = {id: ++state.serial, at: clock(), kind: compact(kind, 30),
        content: compact(content, 300), source: compact(source, 24)};
      state.events.push(entry);
      state.events = state.events.slice(-MAX_EVENTS);
      return entry;
    }

    function observe(content, {kind = "conversation", source = "user"} = {}) {
      if (!validText(content, 300) || !validText(kind, 30)) return null;
      const entry = record(kind, content, source);
      persist();
      return clone(entry);
    }

    function learn({subject, predicate = "is", value, source = "user"} = {}) {
      const s = compact(subject, 72), p = compact(predicate, 40), v = compact(value, 200);
      if (!validText(subject, 72) || !validText(predicate, 40) ||
          !validText(value, 200) || !IDENTIFIER.test(s) || !IDENTIFIER.test(p) ||
          !["user", "inferred"].includes(source)) {
        return {ok: false, error: "A fact needs a short subject, relation and value."};
      }
      const key = canonical(s) + "\0" + canonical(p);
      const current = state.beliefs.findLast(b => b.status === "active" &&
        canonical(b.subject) + "\0" + canonical(b.predicate) === key);
      if (current && canonical(current.value) === canonical(v)) {
        record("confirmation", s + " " + p + " " + v, source);
        persist();
        return {ok: true, unchanged: true, belief: clone(current)};
      }
      const evidence = record(current ? "correction" : "fact", s + " " + p + " " + v, source);
      if (current) { current.status = "superseded"; current.replacedAt = evidence.at; }
      const belief = {id: ++state.serial, at: evidence.at, subject: s, predicate: p,
        value: v, status: "active", source, evidenceId: evidence.id,
        supersedes: current?.id ?? null};
      state.beliefs.push(belief);
      state.beliefs = state.beliefs.slice(-MAX_BELIEFS);
      persist();
      return {ok: true, corrected: !!current, belief: clone(belief)};
    }

    function recall(subject, predicate = "is") {
      const s = canonical(subject), p = canonical(predicate);
      const match = state.beliefs.findLast(b => b.status === "active" &&
        canonical(b.subject) === s && canonical(b.predicate) === p);
      return match ? clone(match) : null;
    }

    function reason(subject, predicate = "part_of") {
      if (canonical(predicate) !== "part_of") return [];
      const queue = [{name: canonical(subject), depth: 0, supports: []}];
      const visited = new Set([canonical(subject)]);
      const found = [];
      while (queue.length) {
        const item = queue.shift();
        if (item.depth >= 4) continue;
        for (const b of state.beliefs) {
          if (b.status !== "active" || canonical(b.predicate) !== "part_of" ||
              canonical(b.subject) !== item.name) continue;
          const next = canonical(b.value);
          if (visited.has(next)) continue;
          visited.add(next);
          const supports = item.supports.concat(b.id);
          found.push({subject: compact(subject, 72), predicate: "part_of", value: b.value,
            supports, inferred: supports.length > 1});
          queue.push({name: next, depth: item.depth + 1, supports});
        }
      }
      return found.slice(0,20);
    }

    // A conservative text interface: only explicit "remember" and "correction"
    // instructions become verified user-supplied beliefs. Ordinary chatter is
    // recorded as an episode, NOT automatically promoted to certain knowledge.
    function parseStatement(text) {
      const input = compact(text, 300);
      const m = input.match(/^(remember(?: that)?|correction:|correct this:|actually[, :]*)\s+(.+)$/i);
      if (!m) return null;
      let claim = m[2].replace(/[.!?]+$/, "").trim();
      let parts = claim.match(/^([\p{L}\p{N}][\p{L}\p{N} _'/-]{0,65})\s*=\s*(.{1,180})$/u);
      if (parts) return {subject: parts[1], predicate: "is", value: parts[2]};
      parts = claim.match(/^(?:the |my )?([\p{L}\p{N}][\p{L}\p{N} _'/-]{0,60})\s+(?:is|was)\s+(.{1,180})$/iu);
      if (parts) return {subject: parts[1], predicate: "is", value: parts[2]};
      return null;
    }

    function questionFromText(text) {
      const raw = compact(text, 230).replace(/[?.!]+$/, "");
      const m = raw.match(/^(?:(?:what|tell me)\s+is|do you (?:know|remember))\s+(?:the |my )?(.+)$/i);
      if (!m) return null;
      const subject = m[1].replace(/^about\s+/i, "");
      return IDENTIFIER.test(subject) ? recall(subject) : null;
    }

    function processText(text) {
      const stmt = parseStatement(text);
      if (stmt) {
        const result = learn(stmt);
        if (!result.ok) return {handled: true, text: result.error};
        return {handled: true, text: result.corrected
          ? "Understood. I've updated " + stmt.subject + " to " + stmt.value + "."
          : "I'll remember that " + stmt.subject + " is " + stmt.value + "."};
      }
      // Only answer a grounded factual question when an exact fact exists;
      // otherwise let Mercy's language model answer without inventing memory.
      const remembered = questionFromText(text);
      if (remembered) return {handled: true,
        text: remembered.subject + " is " + remembered.value + "."};
      return {handled: false};
    }

    function chooseQuestion() {
      // Curiosity is driven by an unresolved relation on a *known* subject.
      // No unprompted questions about people or camera observations.
      const candidates = state.beliefs.filter(b => b.status === "active" &&
        b.source === "user" && /(project|skull|build|design)/i.test(b.subject));
      for (const b of candidates.slice().reverse()) {
        if (recall(b.subject, "progress")) continue;
        const asked = state.questions.some(q =>
          canonical(q.subject) === canonical(b.subject) && q.missing === "progress");
        if (!asked) return {action: "ask", subject: b.subject, missing: "progress",
          purpose: "Learn how an existing user-mentioned project is progressing.",
          evidenceId: b.evidenceId};
      }
      return {action: "silent", reason: "No useful, unasked knowledge gap."};
    }

    function markAsked(plan) {
      if (!plan || plan.action !== "ask" || !validText(plan.subject, 72)) return false;
      if (state.questions.some(q => canonical(q.subject) === canonical(plan.subject) &&
          q.missing === plan.missing)) return false;
      state.questions.push({id: ++state.serial, at: clock(),
        subject: compact(plan.subject, 72), missing: compact(plan.missing, 40)});
      state.questions = state.questions.slice(-MAX_QUESTIONS);
      persist();
      return true;
    }

    function context(query = "", count = 4) {
      const queryWords = new Set(canonical(query).split(/\W+/).filter(w => w.length >= 3));
      return state.beliefs.filter(b => b.status === "active")
        .map(b => ({belief: b, score: canonical(b.subject).split(/\W+/)
          .filter(w => queryWords.has(w)).length}))
        .sort((a, b) => b.score - a.score || b.belief.at - a.belief.at)
        .slice(0, Math.max(0, Math.min(6, count)))
        .map(x => ({subject: x.belief.subject, relation: x.belief.predicate,
          value: x.belief.value, source: x.belief.source}));
    }

    function snapshot() { return clone(state); }
    function clear() { state = fresh(); persist(); }
    function stats() {
      return {events: state.events.length,
        knownFacts: state.beliefs.filter(b => b.status === "active").length,
        corrections: state.beliefs.filter(b => b.status === "superseded").length,
        askedQuestions: state.questions.length};
    }

    load();
    return Object.freeze({observe, learn, recall, reason, processText, chooseQuestion,
      markAsked, context, snapshot, stats, clear, key: KEY});
  }
  return Object.freeze({create, VERSION});
});
