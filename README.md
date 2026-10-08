# Hush Skip for YouTube (跳過他說話)

Chrome extension (MV3). It fast-forwards YouTube while an enrolled voice is speaking. Detection runs in the browser with WavLM speaker embeddings (transformers.js / onnxruntime-web). It uses WebGPU when available and falls back to wasm q8.

## Setup

    npm install      # also copies transformers.js + ORT wasm into vendor/
    npm test         # state-machine test + model check (downloads ~100MB once)

In Chrome, open `chrome://extensions`, turn on Developer mode, click **Load unpacked**, and pick this folder.

## Use

1. **Enroll:** on a YouTube video, click the icon, then **Mark start** and **Mark end** around a stretch where the person speaks. The popup closes when you click the page, but the marks are kept. Without marks, recording starts now and lasts N seconds. **Enroll voices from range** jumps back to the start, plays the range at 1x while recording, and pauses at the end. The recording is split into voices; each one appears with a sample clip, and the one with the most speech is ticked. Enrollments add to the list; ✕ deletes a voice.
   - **Skip multiple voices** (off by default): when on, you can tick several voices and any of them triggers skipping.
2. **Skip:** on any YouTube tab, click the icon, then **Start skipping on this tab**. When the voice matches, playback runs at 16x muted for 1.5s. Then it listens 1.5s at 1x and decides again.
3. Tune **Threshold** using the live score shown in the popup. Same speaker scored about 0.89–0.98 in tests, different speakers about 0.61–0.77.

Enrolled voices and your ticks are saved in the browser and kept across videos and restarts. A running session keeps skipping when you move to the next video in the same tab.

Limits:
- You must click the icon to start on each tab, because Chrome's tabCapture requires it.
- Only one tab at a time.
- The first run downloads the model from Hugging Face. WebGPU uses fp32 (~400MB); wasm uses q8 (~100MB). It is cached after that.

Debug: while a session runs, open `chrome://extensions`, find this extension, and click **Inspect views: offscreen.html**. Model and audio errors show up in that console.
