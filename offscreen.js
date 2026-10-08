// Audio capture + speaker model. Offscreen docs only get chrome.runtime, so all I/O goes through sw.js.
import { createSkipper, clusterVoices, concat, rms, SR, WIN, GATE } from './skipper.js';

const MODEL = 'Xenova/wavlm-base-plus-sv';
const send = (m) => chrome.runtime.sendMessage({ to: 'sw', ...m });

let session = null, hooks = null; // hooks: begin/finish of a marked-range enrollment
const end = (text = 'stopped') => { session?.stop(); session = null; send({ type: 'stopped', text }); };

chrome.runtime.onMessage.addListener((m) => {
  if (m.to !== 'offscreen') return;
  if (m.cmd === 'begin' || m.cmd === 'finish') return hooks?.[m.cmd]();
  start(m).catch((e) => end(`error: ${e.message ?? e}`));
});

let modelP;
const loadModel = () => (modelP ??= (async () => {
  const { env, AutoProcessor, AutoModel } = await import('./vendor/transformers.min.js');
  env.allowLocalModels = false;
  env.useWasmCache = false; // it would import the wasm factory from a blob: URL, which the CSP blocks
  Object.assign(env.backends.onnx.wasm, {
    numThreads: 1, // threaded wasm needs cross-origin isolation, which extension pages lack
    wasmPaths: {
      mjs: chrome.runtime.getURL('vendor/ort-wasm-simd-threaded.asyncify.mjs'),
      wasm: chrome.runtime.getURL('vendor/ort-wasm-simd-threaded.asyncify.wasm'),
    },
  });
  const processor = await AutoProcessor.from_pretrained(MODEL);
  let model;
  if (await navigator.gpu?.requestAdapter()) {
    try {
      model = await AutoModel.from_pretrained(MODEL, { device: 'webgpu', dtype: 'fp32' });
      await model(await processor(new Float32Array(WIN))); // warm-up: some GPU failures only show on first run
    } catch (e) { console.warn('webgpu failed, using wasm', e); model = null; }
  }
  model ??= await AutoModel.from_pretrained(MODEL, { dtype: 'q8' });
  return async (x) => (await model(await processor(x))).embeddings.data;
})());

async function start({ cmd, streamId, tabId, targets, threshold, range }) {
  session?.stop();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
  });
  // Capturing mutes the tab; play it back at the native rate so the user still hears it.
  const play = new AudioContext();
  play.createMediaStreamSource(stream).connect(play.destination);
  // Separate 16 kHz context for analysis; Chrome resamples the stream for us.
  const ctx = new AudioContext({ sampleRate: SR });
  await ctx.audioWorklet.addModule('worklet.js');
  const tap = new AudioWorkletNode(ctx, 'tap', { numberOfOutputs: 0, channelCount: 1, channelCountMode: 'explicit' });
  ctx.createMediaStreamSource(stream).connect(tap);

  let onChunk = null, stopped = false;
  tap.port.onmessage = (e) => onChunk?.(e.data);
  const release = () => {
    if (stopped) return;
    stopped = true;
    stream.getTracks().forEach((t) => t.stop());
    play.close();
    ctx.close();
  };
  stream.getAudioTracks()[0].onended = () => end(); // tab closed
  session = { stop: release };

  send({ type: 'status', text: 'loading model…' });
  const embed = await loadModel();
  if (stopped) return;

  if (cmd === 'enroll') {
    // Capture is live: the content script seeks to the range start ('begin' once the seek lands),
    // plays at 1x, and sends 'finish' at the end mark or when the user pauses.
    const chunks = [];
    await new Promise((finish) => {
      hooks = { begin: () => (onChunk = (c) => chunks.push(c)), finish };
      send({ type: 'recording', tabId, range });
    });
    hooks = null;
    if (stopped) return;
    release();
    const x = concat(chunks), wins = [], vecs = [];
    for (let i = 0; i + WIN <= x.length; i += WIN) {
      const w = x.subarray(i, i + WIN);
      if (rms(w) >= GATE) { wins.push(w); vecs.push(await embed(w)); }
    }
    if (!vecs.length) throw new Error('no speech captured');
    // Recording may hold several people: split into voices, the user picks one by ear in the popup.
    const voices = clusterVoices(vecs)
      .filter((c, _, all) => c.idx.length > 1 || all[0].idx.length === 1) // drop one-off windows (crosstalk, noise)
      .slice(0, 4)
      .map((c) => ({
        embedding: Array.from(c.sum),
        seconds: (c.idx.length * WIN) / SR,
        clip: wavDataUrl(concat(c.idx.slice(0, 3).map((i) => wins[i]))),
      }));
    send({ type: 'enrolled', voices });
    return end(`found ${voices.length} voice(s), tick the one(s) to skip`);
  }

  const sk = createSkipper({
    embed, targets, threshold,
    ff: (on) => send({ type: 'ff', tabId, on }),
    onError: (e) => send({ type: 'status', text: `model error: ${e.message ?? e}` }),
    onScore: (s) => send({ type: 'status', text: s == null ? 'listening (quiet)' : `listening, score ${s.toFixed(2)}` }),
  });
  onChunk = (c) => sk.push(c);
  session = { stop() { sk.stop(); release(); } };
}

// 16-bit mono PCM WAV as a data: URL, so the popup can play a voice sample.
function wavDataUrl(x) {
  const v = new DataView(new ArrayBuffer(44 + x.length * 2));
  const str = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + x.length * 2, true); str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, x.length * 2, true);
  x.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 32767, true));
  let bin = '';
  for (const b of new Uint8Array(v.buffer)) bin += String.fromCharCode(b);
  return `data:audio/wav;base64,${btoa(bin)}`;
}
