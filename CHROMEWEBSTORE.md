# Chrome Web Store Listing — Hush Skip for YouTube

> Last Updated: 2026-10-08

## Store Listing

**Extension Name**
Hush Skip for YouTube
<!-- From _locales/*/messages.json `extName`. zh_TW: 跳過他說話, zh_CN: 跳过他说话. -->

**Short Description**
Fast-forwards YouTube videos while one person you choose is talking, then returns to normal speed when they stop.

**Detailed Description**

Skip one speaker in YouTube videos. Pick a voice once, and the extension fast-forwards through their lines every time they speak.

Features:
Learns a voice from a stretch of the video you mark with "Mark start" and "Mark end"
Splits the sample into separate voices so you can listen, name them, and pick the right one
Keeps a list of voices across videos; optionally skip several voices at once
Fast-forwards and mutes while a chosen voice is talking, then resumes normal playback
Keeps skipping when you move to the next video in the same tab
Adjustable sensitivity, with a live match score to help you tune it
All listening happens on your computer; audio is never uploaded

How to use:
1. Open a YouTube video where the person you want to skip is talking.
2. Click the extension icon, then "Mark start" and "Mark end" around a stretch where they speak. Without marks, it records from now for a set number of seconds.
3. Choose "Enroll voices from range". The video replays that stretch once while the extension listens.
4. Play each voice sample and tick the one(s) you want to skip. You can rename or delete voices.
5. On any YouTube tab, click the icon and choose "Start skipping".

Privacy:
Tab audio is analyzed on your device only. Saved voice samples and settings stay in your browser and are never sent anywhere. The first run downloads a speech model once; after that it works from cache.

Limits:
You start skipping per tab by clicking the icon. Works on one tab at a time.

**Category**
Fun
<!-- Alternative: Accessibility. -->

**Single Purpose**
Fast-forwards YouTube playback while a user-selected speaker is talking.

**Primary Language**
English

**Localized**: en, zh_TW, zh_CN, ja, ko, es (name + description come from `_locales/`; add a translated listing per language in the dashboard).

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128×128 PNG | ✅ Ready | icons/icon128.png |
| Screenshot 1 | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile | 440×280 | ⬜ Not created | |

### Screenshot Notes
1. YouTube video playing with the popup open: start/end marks set, voice cards with one ticked.
2. Popup during skipping: green "listening, score 0.91" status, threshold slider.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| tabCapture | permissions | Captures the audio of the YouTube tab the user clicked the icon on, so the extension can hear who is speaking. Capture starts only when the user clicks "Enroll" or "Start skipping" in the popup and stops on "Stop". |
| offscreen | permissions | Runs the on-device voice matching on the captured tab audio. Background service workers cannot play or process audio streams, so a hidden page is needed for this. |
| storage | permissions | Saves the user's enrolled voices (names, short audio samples, voice fingerprints), which ones to skip, the marked start/end times, and the sensitivity setting locally so they persist between sessions. Nothing is synced or uploaded. |
| unlimitedStorage | permissions | Each enrolled voice keeps a short WAV sample (~200 KB) so the user can hear it again. Voices accumulate across enrollments, so the list can outgrow the default 10 MB local storage quota. Data stays local. |
| activeTab | permissions | Grants temporary access to the tab where the user opened the popup, which is required before that tab's audio can be captured. No access to other tabs. |
| https://www.youtube.com/* | content_scripts | Changes the video's playback speed and mute state on YouTube pages while the chosen speaker is talking, then restores the original settings. During enrollment it reads the video's current time for the start/end marks and replays that range once. Does not read page content. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No — nothing is transmitted off the device.

Handled locally only:
- Tab audio: analyzed in memory to detect the chosen speaker; not recorded beyond the enroll step.
- Enroll step: each enrollment adds up to 4 short voice clips plus numeric voice fingerprints (and optional user-typed names) to `chrome.storage.local` so the user can review and pick voices. They stay until the user deletes them (✕) or uninstalls the extension.
- Start/end marks: two video timestamps kept in `chrome.storage.session`; cleared when the browser closes.

Network: on first use the extension downloads a public speech model file from Hugging Face (huggingface.co). No user data is sent with that request; it is a plain file download (the user's IP address is visible to Hugging Face, as with any download).

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Website content (tab audio) | Processed locally | No | Detect chosen speaker | No |
| All other types | No | No | — | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL**
TODO — host a short policy (e.g. GitHub Pages) stating: audio processed on device, voice samples stored locally only, one-time model download from Hugging Face, no analytics, no data sharing.

## Distribution

**Visibility**: TODO (Public / Unlisted)
**Regions**: All regions

## Developer Info

**Publisher Name**: TODO
**Contact Email**: TODO (shown publicly)
**Support URL**: https://github.com/alanzongsianshen/ff-youtube/issues
**Homepage URL**: https://github.com/alanzongsianshen/ff-youtube

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.1.0 | 2026-10-08 | First version: voice enroll from a marked start/end range, saved voice list (rename, delete, multi-voice skip), fast-forward skipping that follows the tab across videos, icon, popup UI, 6 languages. | Draft |

## Review Notes

### Known Issues / Limitations
- **Trademark:** name uses the "for YouTube" form to avoid implying affiliation.
- **Remote model:** the speech model (weights, not code) is downloaded from Hugging Face at runtime. All JS/wasm is bundled. If a reviewer flags it, explain it is a data file, or bundle the model in the ZIP.
- **ZIP contents:** include `vendor/` (built by `npm install`); exclude `.git/`, `node_modules/`, `test/`, `scripts/`, `.agents/`, `.claude/`, `CHROMEWEBSTORE.md`.
- Capture requires a click on the icon per tab (Chrome tabCapture rule); one tab at a time.

### Rejection History
None yet.
