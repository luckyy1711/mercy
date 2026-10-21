"use strict";
/**
 * MERCY v3: permissioned camera sampling. No faces, identity recognition,
 * uploads, or background camera activity. This is NOT an object vision model.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MercyPerception = api;
})(typeof window !== "undefined" ? window : null, function () {
  function analyzeFrame(data, previous = null) {
    if (!data || data.length < 4 || data.length % 4 !== 0) {
      throw new TypeError("RGBA frame expected");
    }
    let brightness = 0, changed = 0, total = 0;
    const comparable = previous && previous.length === data.length;
    // Sampling every fourth pixel is sufficient for a low-cost motion hint.
    for (let i = 0; i < data.length; i += 16) {
      const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] +
        0.0722 * data[i + 2]) / 255;
      brightness += lum;
      if (comparable) {
        const earlier = (0.2126 * previous[i] + 0.7152 * previous[i + 1] +
          0.0722 * previous[i + 2]) / 255;
        if (Math.abs(lum - earlier) > 0.15) changed++;
      }
      total++;
    }
    const light = brightness / total;
    const motion = comparable ? changed / total : null;
    return {
      light: light < 0.22 ? "dim" : light > 0.72 ? "bright" : "moderate",
      motion: motion === null ? "unknown" : motion > 0.13 ? "change detected" : "little change",
      brightness: Number(light.toFixed(2)),
      changeFraction: motion === null ? null : Number(motion.toFixed(2))
    };
  }

  function create(options = {}) {
    const video = options.video;
    const media = options.mediaDevices ?? (typeof navigator !== "undefined" ?
      navigator.mediaDevices : null);
    const doc = options.document ?? (typeof document !== "undefined" ? document : null);
    const onStatus = options.onStatus ?? (() => {});
    const onObservation = options.onObservation ?? (() => {});
    const now = options.now ?? (() => Date.now());
    const timerSet = options.setInterval ?? setInterval;
    const timerClear = options.clearInterval ?? clearInterval;
    const makeCanvas = options.createCanvas ?? (() => doc.createElement("canvas"));
    let stream = null, timer = null, pending = false, revision = 0;
    let previous = null, lastEvent = 0, status = "off";

    function setStatus(value) { status = value; onStatus(value); }
    function running() { return !!stream; }

    function sample() {
      if (!stream || !video || (doc && doc.hidden) || video.readyState < 2) return null;
      try {
        const canvas = makeCanvas();
        canvas.width = 64;
        canvas.height = 48;
        const ctx = canvas.getContext("2d", {willReadFrequently: true});
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0, 64, 48);
        const frame = ctx.getImageData(0, 0, 64, 48).data;
        const result = analyzeFrame(frame, previous);
        previous = new Uint8ClampedArray(frame);
        const shouldPublish = result.motion === "change detected" ||
          (result.light === "dim" && now() - lastEvent > 30000);
        if (shouldPublish && now() - lastEvent >= 12000) {
          lastEvent = now();
          // Publish only non-identifying metadata. No raw images are saved.
          onObservation({kind: "camera-metadata", source: "consented-camera",
            content: "Lighting: " + result.light + "; movement: " + result.motion,
            at: now()});
        }
        return result;
      } catch (_) {
        setStatus("camera sampling unavailable");
        return null;
      }
    }

    function stop() {
      revision++;
      if (timer !== null) { timerClear(timer); timer = null; }
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
        stream = null;
      }
      if (video) {
        try { video.pause?.(); video.srcObject = null; } catch (_) {}
      }
      previous = null;
      setStatus("off");
    }

    async function start() {
      if (stream || pending) return !!stream;
      if (!media?.getUserMedia || !video || !doc || doc.hidden) {
        setStatus("camera unavailable");
        return false;
      }
      // Must only be called by a user-initiated UI event.
      const token = ++revision;
      pending = true;
      setStatus("requesting camera permission");
      let acquired = null;
      try {
        acquired = await media.getUserMedia({
          audio: false,
          video: {facingMode: {ideal: "environment"}, width: {ideal: 640},
            height: {ideal: 480}, frameRate: {ideal: 10, max: 15}}
        });
        if (token !== revision || doc.hidden) {
          acquired.getTracks().forEach(t => t.stop());
          return false;
        }
        stream = acquired;
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        await video.play();
        if (token !== revision || doc.hidden) { stop(); return false; }
        previous = null;
        setStatus("camera on · local lighting/motion only");
        timer = timerSet(sample, 1600);
        return true;
      } catch (_) {
        acquired?.getTracks().forEach(t => t.stop());
        if (stream === acquired) stream = null;
        if (token === revision) setStatus("camera denied or unsupported");
        return false;
      } finally { pending = false; }
    }

    const visibilityChanged = () => { if (doc?.hidden) stop(); };
    doc?.addEventListener?.("visibilitychange", visibilityChanged);
    setStatus("off");
    return Object.freeze({start, stop, sample, running, getStatus: () => status});
  }
  return Object.freeze({create, analyzeFrame});
});
