// Relay between popup, offscreen doc (no chrome.storage/tabs there) and content script.
import { tick } from './skipper.js';

const status = (text) => chrome.storage.session.set({ status: text });
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m.to !== 'sw') return;
  handle(m, sender).finally(() => reply());
  return true; // popup awaits 'stop' before capturing again
});

// Closing the offscreen doc releases the tab capture; a tab can only be captured once at a time.
async function stop(text = 'stopped') {
  const { tabId } = await chrome.storage.session.get('tabId');
  if (tabId) chrome.tabs.sendMessage(tabId, { type: 'stop' }).catch(() => {});
  await chrome.offscreen.closeDocument().catch(() => {});
  chrome.action.setBadgeText({ text: '' });
  return status(text);
}

// Only sw.js writes `voices`; edits run one at a time so concurrent ones can't overwrite each other.
let queue = Promise.resolve();
function editVoices(fn) {
  return (queue = queue.then(async () => {
    const s = await chrome.storage.local.get(['voices', 'multi', 'nextId']);
    await chrome.storage.local.set(fn({ voices: [], multi: false, nextId: 1, ...s }));
  }));
}

async function handle(m, sender) {
  switch (m.cmd ?? m.type) {
    case 'enroll':
    case 'start': {
      const { voices = [], threshold = 0.85 } = await chrome.storage.local.get(['voices', 'threshold']);
      const targets = voices.filter((v) => v.skip).map((v) => v.embedding);
      if (m.cmd === 'start' && !targets.length) return status('tick a voice to skip first');
      if (!(await chrome.offscreen.hasDocument())) {
        await chrome.offscreen.createDocument({
          url: 'offscreen.html',
          reasons: ['USER_MEDIA'],
          justification: 'Analyze tab audio to detect the enrolled speaker',
        });
      }
      await chrome.storage.session.set({ tabId: m.tabId, mode: m.cmd });
      chrome.runtime.sendMessage({ ...m, to: 'offscreen', targets, threshold });
      return chrome.action.setBadgeText({ text: m.cmd === 'start' ? 'ON' : 'REC' });
    }
    case 'stop':
      return stop();
    case 'videoChanged': {
      // Skipping carries on to the next video in the same tab (capture follows the tab);
      // an enrollment's marked range belonged to the old video, so that one is cancelled.
      const { tabId, mode } = await chrome.storage.session.get(['tabId', 'mode']);
      if (sender.tab?.id !== tabId || !(await chrome.offscreen.hasDocument())) return;
      return mode === 'enroll' ? stop('enrollment cancelled: video changed') : status('listening on new video');
    }
    case 'ff':
      return chrome.tabs.sendMessage(m.tabId, m).catch(() => status('reload the YouTube tab (content script missing)'));
    case 'recording':
      chrome.tabs.sendMessage(m.tabId, { type: 'record', ...m.range })
        .then((ok) => ok || stop('no video on this tab'))
        .catch(() => stop('reload the YouTube tab, then enroll again'));
      return status(`recording ${fmt(m.range.start)}–${fmt(m.range.end)}…`);
    case 'rangeStarted':
    case 'rangeDone':
      return chrome.runtime
        .sendMessage({ to: 'offscreen', cmd: m.type === 'rangeStarted' ? 'begin' : 'finish' })
        .catch(() => {});
    case 'enrolled': // new voices join the list; the one with the most speech gets ticked
      return editVoices(({ voices, multi, nextId }) => {
        const added = m.voices.map((v, i) => ({ ...v, id: nextId + i, skip: false }));
        return { voices: tick([...voices, ...added], nextId, true, multi), nextId: nextId + added.length };
      });
    case 'tick':
      return editVoices(({ voices, multi }) => ({ voices: tick(voices, m.id, m.on, multi) }));
    case 'rename':
      return editVoices(({ voices }) => ({ voices: voices.map((v) => (v.id === m.id ? { ...v, name: m.name || undefined } : v)) }));
    case 'delete':
      return editVoices(({ voices }) => ({ voices: voices.filter((v) => v.id !== m.id) }));
    case 'multi': // turning multi off keeps only the first ticked voice
      return editVoices(({ voices }) => {
        const first = voices.find((v) => v.skip);
        return { multi: m.on, voices: m.on || !first ? voices : tick(voices, first.id, true, false) };
      });
    case 'status':
      return status(m.text);
    case 'stopped':
      return stop(m.text);
  }
}
