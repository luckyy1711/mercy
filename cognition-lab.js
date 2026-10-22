"use strict";
/* MERCY v2's compact, browser-local cognition panel. */
(function () {
  const brain = window.MercyBrain;
  if (!brain) return;

  const cognition = brain.cognition;
  const $ = id => document.getElementById(id);
  const show = text => { $("cogResult").textContent = text; };

  function refresh() {
    const stats = cognition.stats();
    $("cogStats").textContent =
      stats.knownFacts + " known facts · " +
      stats.corrections + " corrections · " +
      stats.events + " evidence events · " +
      stats.askedQuestions + " questions asked";
  }

  $("cogLearn").addEventListener("click", () => {
    const result = cognition.learn({
      subject: $("cogSubject").value.trim(),
      predicate: "is",
      value: $("cogValue").value.trim()
    });
    if (!result.ok) {
      show(result.error);
      return;
    }
    show((result.corrected ? "Corrected: " :
      result.unchanged ? "Already known: " : "Learned: ") +
      result.belief.subject + " is " + result.belief.value);
    $("cogValue").value = "";
    refresh();
  });

  $("cogQuestion").addEventListener("click", () => {
    const idea = cognition.chooseQuestion();
    show(idea.action === "ask" ?
      "Possible curiosity question: How is your " + idea.subject +
      " progressing? Mercy can ask about it when autonomous speech is enabled." :
      "Mercy chooses silence: " + idea.reason);
  });

  $("cogTest").addEventListener("click", () => {
    const outcome = brain.selfCheck();
    const problems = outcome.checks.filter(c => !c.ok).map(c => c.name);
    show("Cognition self-check: " + outcome.passed + "/" +
      outcome.total + " passed." +
      (problems.length ? " Issues: " + problems.join("; ") : ""));
  });

  $("cogExport").addEventListener("click", () => {
    const json = JSON.stringify({
      exportedAt: new Date().toISOString(),
      schema: 2,
      cognition: cognition.snapshot()
    }, null, 2);
    const url = URL.createObjectURL(new Blob([json], {type: "application/json"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = "mercy-v2-memory.json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    show("Memory exported. Store the file privately.");
  });

  $("cogClear").addEventListener("click", () => {
    if (!window.confirm("Clear v2 learned facts and evidence in this browser? Earlier v1 chat history will remain.")) {
      return;
    }
    cognition.clear();
    show("V2 learned facts cleared. Existing v1 chat history was preserved.");
    refresh();
  });

  window.addEventListener("mercy:cognition-change", refresh);
  refresh();
})();