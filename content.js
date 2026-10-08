// Obeys {type:'ff', on} from the service worker. Re-queries <video> each time: YouTube is an SPA.
let saved = null;
chrome.runtime.onMessage.addListener(({ type, on }) => {
  if (type !== 'ff') return;
  const v = document.querySelector('video.html5-main-video') ?? document.querySelector('video');
  if (!v) return;
  if (on) {
    saved ??= { rate: v.playbackRate, muted: v.muted };
    v.playbackRate = 16;
    v.muted = true;
  } else if (saved) {
    v.playbackRate = saved.rate;
    v.muted = saved.muted;
    saved = null;
  }
});
