// Pure detection logic, shared by offscreen.js and the Node test.
export const SR = 16000;
export const WIN = 1.5 * SR;
// ponytail: RMS energy gate stands in for VAD; swap in Silero VAD if music keeps triggering embeds.
export const GATE = 0.01;

export const rms = (x) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);

export function cos(a, b) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / Math.sqrt(na * nb);
}

export function concat(chunks) {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

// Groups 1.5s window embeddings into voices. Windows of one voice scored 0.83-0.98, different voices 0.45-0.76.
// ponytail: greedy single pass + fixed cut, order-dependent; switch to agglomerative clustering if voices split or merge.
export const SAME_VOICE = 0.8;
export function clusterVoices(vecs) {
  const cs = [];
  vecs.forEach((v, i) => {
    let best = null, bestSim = SAME_VOICE;
    for (const c of cs) { const s = cos(v, c.sum); if (s >= bestSim) { best = c; bestSim = s; } }
    if (!best) cs.push(best = { sum: new Float64Array(v.length), idx: [] });
    for (let j = 0; j < v.length; j++) best.sum[j] += v[j]; // sum ~ mean for cosine
    best.idx.push(i);
  });
  return cs.sort((a, b) => b.idx.length - a.idx.length);
}

// Ticks voice `id` on/off. Ticks are exclusive unless multi-voice mode is on.
export const tick = (voices, id, on, multi) => voices.map((v) => ({ ...v, skip: v.id === id ? on : multi && v.skip }));

// Burst/probe loop: fast-forwarding mutes the tab, so the detector is deaf during a burst.
// On match: ff(true) for burstMs, then ff(false) and listen to a fresh window at 1x before deciding again.
// targets: one embedding per voice to skip; the closest one decides.
export function createSkipper({ embed, targets, threshold, ff, onScore = () => {}, onError = () => {}, burstMs = 1500 }) {
  let chunks = [], len = 0, bursting = false, busy = false, stopped = false, timer;
  return {
    async push(chunk) {
      if (bursting || stopped) return; // burst audio is muted/garbled, drop it
      chunks.push(chunk); len += chunk.length;
      if (busy || len < WIN) return;
      const x = concat(chunks); chunks = []; len = 0;
      if (rms(x) < GATE) return onScore(null);
      busy = true;
      let score;
      try { const e = await embed(x); score = Math.max(...targets.map((t) => cos(e, t))); } catch (e) { return onError(e); } finally { busy = false; }
      if (stopped) return;
      onScore(score);
      if (score < threshold) return;
      bursting = true; ff(true);
      timer = setTimeout(() => { bursting = false; chunks = []; len = 0; ff(false); }, burstMs);
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      if (bursting) ff(false);
      bursting = false;
    },
  };
}
