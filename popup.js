const $ = (id) => document.getElementById(id);

// Status is free text from sw.js/offscreen.js; map it to a dot color.
const stateOf = (s) =>
  /^listening/.test(s) ? 'live' : /^(recording|loading)/.test(s) ? 'busy' : /error|reload|first|captur/i.test(s) ? 'error' : 'idle';

async function show() {
  const { target, picked = 0, threshold = 0.85 } = await chrome.storage.local.get(['target', 'picked', 'threshold']);
  const { status = 'idle' } = await chrome.storage.session.get('status');
  $('voice').textContent = target ? `voice ${picked + 1}` : 'none';
  $('status').textContent = status;
  $('statusbox').dataset.state = stateOf(status);
  $('thr').value = threshold;
  $('thrv').textContent = (+threshold).toFixed(2);
}
async function showVoices() {
  const { voices = [], picked = 0 } = await chrome.storage.local.get(['voices', 'picked']);
  $('voices').replaceChildren(...voices.map((v, i) => {
    const row = Object.assign(document.createElement('div'), { className: i === picked ? 'voice picked' : 'voice' });
    const title = document.createElement('div');
    title.innerHTML = `<b>Voice ${i + 1}</b> <span class="muted">· ${v.seconds}s of speech</span>`;
    const audio = Object.assign(document.createElement('audio'), { controls: true, src: v.clip });
    const btn = Object.assign(document.createElement('button'), {
      textContent: i === picked ? '✓ Skipping this voice' : 'Skip this voice',
      disabled: i === picked,
      onclick: () => chrome.storage.local.set({ picked: i, target: v.embedding }),
    });
    row.append(title, audio, btn);
    return row;
  }));
}
show();
showVoices();
chrome.storage.onChanged.addListener((changes) => {
  show();
  if (changes.voices || changes.picked) showVoices(); // not on status ticks: re-rendering would stop playback
});

$('thr').oninput = () => chrome.storage.local.set({ threshold: +$('thr').value });

// Opening the popup grants activeTab, which tabCapture needs; there is no auto-start on page load.
async function run(cmd) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.runtime.sendMessage({ to: 'sw', cmd: 'stop' }); // free any previous capture first
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    chrome.runtime.sendMessage({ to: 'sw', cmd, tabId: tab.id, streamId, seconds: +$('sec').value });
  } catch (e) {
    $('status').textContent = e.message; // e.g. tab already captured: press Stop first
    $('statusbox').dataset.state = 'error';
  }
}
$('enroll').onclick = () => run('enroll');
$('start').onclick = () => run('start');
$('stop').onclick = () => chrome.runtime.sendMessage({ to: 'sw', cmd: 'stop' });
