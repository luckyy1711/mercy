"use strict";
/* Progressive enhancement for MERCY cognitive laboratory; no model imports. */
(function () {
  const brain = window.MercyBrain;
  if (!brain) return;
  const $ = id => document.getElementById(id);
  const {cognition, simulator, experiments} = brain;
  const message = (id, text) => { $(id).textContent = text; };

  function refresh() {
    const s = cognition.stats();
    message("cogStats", s.knownFacts + " facts · " + s.corrections +
      " corrections · " + s.events + " evidence events · " +
      s.askedQuestions + " questions tracked");
    const sim = simulator.state();
    message("simState", "Simulation only · " + (sim.emergency ? "Emergency stopped" :
      sim.armed ? "Armed" : "Disarmed") + " · jaw " + sim.position.jaw + "°");
    $("simArm").textContent = sim.armed ? "Disarm simulation" : "Arm simulation";
  }

  $("cogLearn").addEventListener("click", () => {
    const subject = $("cogSubject").value.trim();
    const value = $("cogValue").value.trim();
    const result = cognition.learn({subject, predicate: "is", value});
    message("cogResult", result.ok ? (result.corrected ? "Corrected: " :
      result.unchanged ? "Already known: " : "Learned: ") +
      result.belief.subject + " is " + result.belief.value : result.error);
    if (result.ok) $("cogValue").value = "";
    refresh();
  });

  $("cogQuestion").addEventListener("click", () => {
    const plan = cognition.chooseQuestion();
    message("cogResult", plan.action === "ask" ?
      "Curiosity candidate: ask about " + plan.subject + " (" +
      plan.missing + "). Mercy will phrase it using her language model when autonomous speech is enabled." :
      "Mercy chooses silence: " + plan.reason);
  });

  $("cogTest").addEventListener("click", () => {
    const result = brain.selfCheck();
    message("cogResult", "Cognition self-check: " + result.passed +
      "/" + result.total + " passed. " +
      result.checks.filter(c => !c.ok).map(c => c.name).join("; "));
  });

  $("cogExport").addEventListener("click", () => {
    const json = JSON.stringify({
      exportedAt: new Date().toISOString(), schema: 2,
      cognition: cognition.snapshot()
    }, null, 2);
    const url = URL.createObjectURL(new Blob([json], {type: "application/json"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = "mercy-cognition-v2-backup.json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    message("cogResult", "Cognition backup exported. Keep it private.");
  });

  $("cogClear").addEventListener("click", () => {
    if (!window.confirm("Delete the cognition facts and evidence in this browser? v1 chat memory remains unchanged.")) return;
    cognition.clear();
    message("cogResult", "Cognition data cleared. Legacy chat memory was not changed.");
    refresh();
  });

  const cameraPreview = $("cogPreview"), cameraButton = $("cogCamera");
  const perception = window.MercyPerception.create({
    video: cameraPreview,
    onStatus: state => {
      message("cogCameraState", "Camera: " + state +
        ". No images or audio leave the device.");
      cameraButton.textContent = state.startsWith("camera on") ?
        "Stop camera" : "Enable camera";
    },
    onObservation: observation => {
      message("cogLastSense", observation.content);
      // Even camera metadata is not persisted without this second opt-in.
      if ($("cogStoreSensors").checked) {
        cognition.observe(observation.content, {
          kind: observation.kind, source: observation.source
        });
        refresh();
      }
    }
  });
  cameraButton.addEventListener("click", async () => {
    cameraButton.disabled = true;
    try {
      if (perception.running()) perception.stop();
      else await perception.start();
    } finally { cameraButton.disabled = false; }
  });

  $("simArm").addEventListener("click", () => {
    const state = simulator.state();
    if (state.armed) simulator.disarm();
    else if (!simulator.arm()) message("cogResult",
      "Simulation emergency stop is active. Reset it explicitly.");
    refresh();
  });
  let jawClosing = false;
  $("simMove").addEventListener("click", async () => {
    const current = simulator.state().position.jaw;
    if (current >= 28) jawClosing = true;
    if (current <= 0) jawClosing = false;
    // Always move in safe increments, never jump back to zero.
    const next = jawClosing ? Math.max(0, current - 7) :
      Math.min(28, current + 7);
    const result = await simulator.command("jaw", next);
    message("cogResult", result.ok ?
      "Virtual jaw moved to " + next + "°. No hardware command sent." :
      "Simulation blocked: " + result.reason);
    refresh();
  });
  $("simEmergency").addEventListener("click", () => {
    simulator.emergencyStop();
    message("cogResult", "Simulation emergency stop activated.");
    refresh();
  });
  $("simReset").addEventListener("click", () => {
    const success = simulator.resetEmergency();
    message("cogResult", success ?
      "Emergency stop reset. Simulation remains disarmed." : "Reset unavailable.");
    refresh();
  });

  $("cogExperiment").addEventListener("click", () => {
    const s = cognition.stats();
    const proposal = experiments.propose({
      title: "Measure retrieval reliability",
      hypothesis: "Evidence-backed recall reduces factual errors compared with raw chat context.",
      metric: "Correct answers on unseen, manually labeled recall cases",
      cost: Math.max(1, Math.min(20, s.knownFacts))
    });
    message("cogResult", proposal.ok ?
      "Research idea #" + proposal.proposal.id + " recorded for review. No code or model weights were changed." :
      proposal.error);
  });

  window.addEventListener("mercy:cognition-change", refresh);
  refresh();
})();
