// Relay between popup, offscreen doc (no chrome.storage/tabs there) and content script.
const status = (text) => chrome.storage.session.set({ status: text });

chrome.runtime.onMessage.addListener((m, _, reply) => {
  if (m.to !== 'sw') return;
  handle(m).finally(() => reply());
  return true; // popup awaits 'stop' before capturing again
});

// Closing the offscreen doc releases the tab capture; a tab can only be captured once at a time.
async function stop(text = 'stopped') {
  const { tabId } = await chrome.storage.session.get('tabId');
  if (tabId) chrome.tabs.sendMessage(tabId, { type: 'ff', on: false }).catch(() => {});
  await chrome.offscreen.closeDocument().catch(() => {});
  chrome.action.setBadgeText({ text: '' });
  return status(text);
}

async function handle(m) {
  switch (m.cmd ?? m.type) {
    case 'enroll':
    case 'start': {
      const { target, threshold = 0.85 } = await chrome.storage.local.get(['target', 'threshold']);
      if (m.cmd === 'start' && !target) return status('enroll a voice first');
      if (!(await chrome.offscreen.hasDocument())) {
        await chrome.offscreen.createDocument({
          url: 'offscreen.html',
          reasons: ['USER_MEDIA'],
          justification: 'Analyze tab audio to detect the enrolled speaker',
        });
      }
      await chrome.storage.session.set({ tabId: m.tabId });
      chrome.runtime.sendMessage({ ...m, to: 'offscreen', target, threshold });
      return chrome.action.setBadgeText({ text: m.cmd === 'start' ? 'ON' : 'REC' });
    }
    case 'stop':
      return stop();
    case 'ff':
      return chrome.tabs.sendMessage(m.tabId, m).catch(() => status('reload the YouTube tab (content script missing)'));
    case 'enrolled': // default to the voice with the most speech; the popup lets the user change it
      return chrome.storage.local.set({ voices: m.voices, picked: 0, target: m.voices[0].embedding });
    case 'status':
      return status(m.text);
    case 'stopped':
      return stop(m.text);
  }
}
