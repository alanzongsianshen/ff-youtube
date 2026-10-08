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
3. Tune **Threshold** using the live score shown in the popup. See [Tuning](#tuning-sentences-not-skipped).

Enrolled voices and your ticks are saved in the browser and kept across videos and restarts. A running session keeps skipping when you move to the next video in the same tab.

## Tuning: sentences not skipped

Look at the status line while the person talks before you change anything:

- **`listening, score 0.78`** (below your threshold): the voice is just under the cut-off. Lower the threshold.
- **`listening (quiet)`**: the speech was too soft for the loudness check, so the model never ran. The threshold won't help.
- **High scores, but the start of each sentence still plays:** expected. Each check needs 1.5s of audio plus inference time, so roughly the first 1.5–2s of each stretch of speech is always heard. After every 16x burst it also plays 1.5s at 1x to check again. Remarks shorter than about 2s often get through at any threshold.

How far to lower it: in tests, windows from the same voice scored 0.83–0.98 and different voices 0.45–0.76. About **0.80** is a sensible floor; below roughly 0.78, other (especially similar-sounding) voices start to trigger skips. Lower it 0.02 at a time, then press **Stop** and **Start**, since a new threshold only applies on the next Start.

A better fix than a lower threshold is to enroll the person again from a different stretch (different mood, mic or background). Turn on **Skip multiple voices**, enroll a second range, and tick both voices. Skipping triggers if either matches, so the threshold can stay high.

Misses during background music or crosstalk come from the simple loudness check standing in for real voice activity detection. Adding Silero VAD is the upgrade for that.

## 調整：有些句子沒被跳過（繁體中文）

先別急著調門檻，說話時先看彈出視窗的狀態列：

- **「監聽中，分數 0.78」**（低於你設定的門檻）：聲音差一點就達標，調低**靈敏度門檻**就有用。
- **「監聽中（安靜）」**：講話太小聲，音量檢查沒過，模型根本沒跑。調門檻沒用。
- **分數很高，但每句開頭還是會播出來**：這是設計使然。每次判斷需要 1.5 秒音訊加上推論時間，所以每段發言的前 1.5～2 秒一定會聽到；每次 16 倍速快轉後，也會用 1 倍速播 1.5 秒重新確認。短於約 2 秒的話，不管門檻多少都常常會漏掉。

可以調多低：測試中同一個人的片段分數為 0.83～0.98，不同人為 0.45～0.76。**0.80** 左右是合理下限；低於約 0.78，其他人（尤其聲音相近的）就會開始被誤跳。每次調降 0.02，然後按**停止**再按**開始跳過**，新門檻要下次開始才生效。

比調低門檻更好的做法：從另一段（不同情緒、麥克風或背景）再錄一次同一個人。勾選**可跳過多個聲音**，用**標記開始**／**標記結束**錄第二段，兩個聲音都勾起來。任一個符合就會跳過，門檻就能維持在高一點。

如果多半是在背景音樂或多人同時講話時漏掉，原因是目前用簡單的音量檢查代替真正的語音活動偵測（VAD）；改用 Silero VAD 就是針對這個的升級。

Limits:
- You must click the icon to start on each tab, because Chrome's tabCapture requires it.
- Only one tab at a time.
- The first run downloads the model from Hugging Face. WebGPU uses fp32 (~400MB); wasm uses q8 (~100MB). It is cached after that.

Debug: while a session runs, open `chrome://extensions`, find this extension, and click **Inspect views: offscreen.html**. Model and audio errors show up in that console.
