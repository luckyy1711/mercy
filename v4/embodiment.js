"use strict";
/**
 * MERCY v4: fail-closed motor command interface plus a virtual-only simulator.
 * Actual servo wiring, limits, power and independent emergency-stop hardware
 * must be verified before enabling any real transport.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MercyEmbodiment = api;
})(typeof window !== "undefined" ? window : null, function () {
  const AXES = Object.freeze({
    yaw: Object.freeze({min: -55, max: 55, maxStep: 8}),
    pitch: Object.freeze({min: -20, max: 20, maxStep: 6}),
    jaw: Object.freeze({min: 0, max: 28, maxStep: 8}),
    eyeX: Object.freeze({min: -18, max: 18, maxStep: 5}),
    eyeY: Object.freeze({min: -12, max: 12, maxStep: 5})
  });

  function create(options = {}) {
    const transport = options.transport ?? null;
    const hardwareEnabled = options.hardwareEnabled === true && !!transport;
    const now = options.now ?? (() => Date.now());
    const emit = options.onEvent ?? (() => {});
    const minInterval = Math.max(100, options.minIntervalMs ?? 180);
    const ackTimeoutMs = Math.max(200, Math.min(5000, options.ackTimeoutMs ?? 1200));
    let position = {yaw: 0, pitch: 0, jaw: 0, eyeX: 0, eyeY: 0};
    let armed = false, emergency = false, busy = false, lastCommandAt = -Infinity;
    let generation = 0;
    const history = [];

    function log(type, details = {}) {
      const event = {type, at: now(), ...details};
      history.push(event);
      if (history.length > 50) history.shift();
      emit({...event});
    }
    function state() {
      return {armed, emergency, busy, mode: hardwareEnabled ? "hardware-adapter" : "simulator",
        position: {...position}, axes: AXES, history: history.map(e => ({...e}))};
    }
    function arm() {
      if (emergency || busy) return false;
      armed = true;
      log("armed");
      return true;
    }
    function disarm() {
      armed = false;
      generation++;
      log("disarmed");
      if (hardwareEnabled) {
        try { Promise.resolve(transport.send({type: "stop"})).catch(() => {}); }
        catch (_) {}
      }
    }
    function resetEmergency() {
      // An operator must deliberately reset; never auto-reset after timeout.
      if (busy) return false;
      emergency = false;
      armed = false;
      log("emergency-reset");
      return true;
    }
    function emergencyStop() {
      armed = false;
      emergency = true;
      generation++;
      log("emergency-stop");
      if (hardwareEnabled) {
        // A physical independent watchdog/E-stop is still mandatory.
        try { Promise.resolve(transport.send({type: "estop"})).catch(() => {}); }
        catch (_) {}
      }
    }

    async function command(axis, target) {
      if (!Object.prototype.hasOwnProperty.call(AXES, axis) || !Number.isFinite(target))
        return {ok: false, reason: "invalid axis or value"};
      if (!armed || emergency) return {ok: false, reason: "not armed"};
      if (busy) return {ok: false, reason: "controller busy"};
      const limits = AXES[axis];
      if (target < limits.min || target > limits.max)
        return {ok: false, reason: "mechanical limit exceeded"};
      if (Math.abs(target - position[axis]) > limits.maxStep)
        return {ok: false, reason: "maximum step exceeded"};
      if (now() - lastCommandAt < minInterval)
        return {ok: false, reason: "rate limited"};
      const token = generation;
      lastCommandAt = now();
      busy = true;
      try {
        if (hardwareEnabled) {
          // A broken adapter must not hold the controller busy forever.
          // Hardware still requires its own independent safety watchdog.
          let timeoutHandle;
          let acknowledged;
          try {
            const sending = Promise.resolve(transport.send({type: "move", axis,
              degrees: target, timeoutMs: ackTimeoutMs}));
            acknowledged = await Promise.race([
              sending,
              new Promise((_, reject) => {
                timeoutHandle = setTimeout(() => reject(new Error("ack timeout")), ackTimeoutMs);
              })
            ]);
          } finally {
            if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
          }
          if (acknowledged?.ok !== true) {
            log("rejected", {axis, reason: "hardware did not acknowledge"});
            return {ok: false, reason: "hardware did not acknowledge"};
          }
        }
        if (token !== generation || !armed || emergency) {
          return {ok: false, reason: "command interrupted"};
        }
        position[axis] = target;
        log("moved", {axis, degrees: target});
        return {ok: true, virtual: !hardwareEnabled, axis, degrees: target};
      } catch (_) {
        log("transport-error", {axis});
        emergencyStop();
        return {ok: false, reason: "transport failure: emergency stop"};
      } finally {
        busy = false;
      }
    }

    return Object.freeze({arm, disarm, resetEmergency, emergencyStop, command, state});
  }
  return Object.freeze({create, AXES});
});
