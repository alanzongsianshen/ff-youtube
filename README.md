# FF YouTube

Chrome extension (MV3). It fast-forwards YouTube while an enrolled voice is speaking. Detection runs in the browser with WavLM speaker embeddings (transformers.js / onnxruntime-web). It uses WebGPU when available and falls back to wasm q8.

## Setup

    npm install      # also copies transformers.js + ORT wasm into vendor/
    npm test         # state-machine test + model check (downloads ~100MB once)

In Chrome, open `chrome://extensions`, turn on Developer mode, click **Load unpacked**, and pick this folder.

## Use

1. **Enroll:** open a YouTube video with the target speaking. Click the extension icon, then **Enroll voice from this tab**. It records N seconds and splits the recording into up to 4 voices. The popup shows each voice with a short sample; play them and click **Skip this voice** on the one to skip. The voice with the most speech is picked by default.
2. **Skip:** on any YouTube tab, click the icon, then **Start skipping on this tab**. When the voice matches, playback runs at 16x muted for 1.5s. Then it listens 1.5s at 1x and decides again.
3. Tune **Threshold** using the live score shown in the popup. Same speaker scored about 0.89–0.98 in tests, different speakers about 0.61–0.77.

Limits:
- You must click the icon to start on each tab, because Chrome's tabCapture requires it.
- Only one tab at a time.
- The first run downloads the model from Hugging Face. WebGPU uses fp32 (~400MB); wasm uses q8 (~100MB). It is cached after that.

Debug: while a session runs, open `chrome://extensions`, find this extension, and click **Inspect views: offscreen.html**. Model and audio errors show up in that console.
