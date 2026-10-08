// YouTube DOM side. Re-queries <video> each time: YouTube is an SPA.
const video = () => document.querySelector('video.html5-main-video') ?? document.querySelector('video');
let saved = null; // user's rate/mute before a fast-forward burst
let rec = null; // active marked-range recording

function restore() {
  const v = video();
  if (v && saved) {
    v.playbackRate = saved.rate;
    v.muted = saved.muted;
  }
  saved = null;
}

function endRecording(notify) {
  if (!rec) return;
  const { v, rate, muted, onTime, onPause } = rec;
  rec = null;
  v.removeEventListener('timeupdate', onTime);
  v.removeEventListener('pause', onPause);
  v.pause();
  v.playbackRate = rate;
  v.muted = muted;
  if (notify) chrome.runtime.sendMessage({ to: 'sw', type: 'rangeDone' });
}

// Play the marked range once at 1x, unmuted (a muted element captures silence). Recording starts only
// after the seek lands, and ends at the end mark, or early if the user pauses or the video ends.
function record(v, { start, end }) {
  endRecording(false);
  rec = { v, rate: v.playbackRate, muted: v.muted };
  rec.onTime = () => v.currentTime >= end && endRecording(true);
  rec.onPause = () => endRecording(true);
  v.pause();
  v.playbackRate = 1;
  v.muted = false;
  v.addEventListener('seeked', () => {
    if (!rec) return;
    v.addEventListener('timeupdate', rec.onTime);
    v.addEventListener('pause', rec.onPause);
    v.play();
    chrome.runtime.sendMessage({ to: 'sw', type: 'rangeStarted' });
  }, { once: true });
  v.currentTime = start;
}

chrome.runtime.onMessage.addListener((m, _, reply) => {
  const v = video();
  if (m.type === 'time') return reply(v?.currentTime);
  if (m.type === 'stop') {
    endRecording(false);
    return restore();
  }
  if (!v) return reply(false);
  if (m.type === 'record') {
    record(v, m);
    return reply(true);
  }
  if (m.type === 'ff') {
    if (!m.on) return restore();
    // ponytail: fixed-step jump, may overshoot into the next speaker; a scanned timeline could jump to the segment end.
    if (m.style === 'jump') return void (v.currentTime = Math.min(v.currentTime + m.jump, v.duration - 1));
    saved ??= { rate: v.playbackRate, muted: v.muted };
    v.playbackRate = m.style === 'fast8' ? 8 : 16;
    v.muted = true;
  }
});

// Another video in the same tab: drop burst/recording state; sw.js keeps skipping but cancels an enrollment.
document.addEventListener('yt-navigate-start', () => {
  endRecording(false);
  restore();
  chrome.runtime.sendMessage({ to: 'sw', type: 'videoChanged' });
});
