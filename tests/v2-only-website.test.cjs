"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const C = require("../v2/cognition/engine.js");
const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("v2 browser composition has no future-version dependencies", () => {
  const saved = new Map();
  const storage = {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value)
  };
  const ctx = {window: {MercyCognition: C}, localStorage: storage, Map};
  vm.runInNewContext(read("mercy-cognition.js"), ctx, {filename: "mercy-cognition.js"});

  const brain = ctx.window.MercyBrain;
  assert.ok(brain);
  assert.deepEqual(Object.keys(brain).sort(), ["cognition", "selfCheck"]);
  const check = brain.selfCheck();
  assert.equal(check.success, true, JSON.stringify(check.checks));
  assert.ok(check.total >= 8);
  assert.equal(brain.cognition.stats().knownFacts, 0,
    "Self-check must not write to persistent user memory");
  assert.equal(brain.cognition.learn({subject: "skull material", value: "PLA"}).ok, true);
  assert.equal(brain.cognition.recall("skull material").value, "PLA");
  assert.equal(brain.selfCheck().success, true);
  assert.equal(brain.cognition.recall("skull material").value, "PLA",
    "Running tests must not touch the user's learned fact");
});

test("website only loads v2, never preloads staged or deleted code", () => {
  const html = read("index.html");
  const worker = read("sw.js");
  for (const required of ["v2/cognition/engine.js", "mercy-cognition.js",
    "cognition-lab.js", "mercy-modes.js"]) {
    assert.ok(html.includes('src="' + required + '"'), required + " missing");
    assert.ok(worker.includes('"./' + required + '"'), required + " not cached");
  }
  for (const hidden of ["v3/perception.js", "v5/research.js", "v4/embodiment.js"]) {
    assert.ok(!html.includes(hidden), hidden + " included in live page");
    assert.ok(!worker.includes(hidden), hidden + " included in cache");
  }
  assert.ok(!html.includes("v2–v5"));
  assert.ok(html.includes("Mercy v2 · Learned memory"));
  const config = read("_config.yml");
  for (const parked of ["v1", "v3", "v5"]) {
    assert.ok(config.includes("  - " + parked + "\n"),
      parked + " folder must stay off the published Pages site");
  }
  assert.ok(!config.includes("  - v2\n"), "Current v2 must be published");
  assert.ok(!fs.existsSync(path.join(__dirname, "..", "v4")));
});
