const $ = (id) => document.getElementById(id);
const t = (key, subs) => chrome.i18n.getMessage(key, subs?.map(String));
for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);

const fmt = (s) => (s == null ? '–' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);
const activeTab = async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
const videoTime = (tab) => chrome.tabs.sendMessage(tab.id, { type: 'time' });
const toSw = (m) => chrome.runtime.sendMessage({ to: 'sw', ...m }); // sw.js is the only writer of voices
const voiceName = (v) => v.name ?? t('voiceN', [v.id]);

// sw.js/offscreen.js emit English status text (offscreen docs have no chrome.i18n); translate known patterns here.
const STATUS = [
  [/^idle$/, 'stIdle'], [/^stopped$/, 'stStopped'], [/^tick a voice to skip first$/, 'stTickFirst'], [/^reload the YouTube tab/, 'stReload'],
  [/^loading model/, 'stLoading'], [/^recording ([\d:]+)–([\d:]+)/, 'stRecording'], [/^listening \(quiet\)$/, 'stQuiet'],
  [/^listening, score (\S+)$/, 'stScore'], [/^listening on new video$/, 'stNewVideo'], [/^found (\d+) voice/, 'stFound'],
  [/^enrollment cancelled/, 'stCancelled'], [/^no video on this tab$/, 'stNoVideo'], [/^(?:model )?error: (.*)$/s, 'stError'],
];
const translate = (s) => {
  for (const [re, key] of STATUS) {
    const m = s.match(re);
    if (m) return t(key, m.slice(1)) || s;
  }
  return s; // e.g. raw Chrome errors from tabCapture
};

// Status is free text from sw.js/offscreen.js; map it to a dot color.
const stateOf = (s) =>
  /^listening/.test(s) ? 'live' : /^(recording|loading)/.test(s) ? 'busy' : /error|reload|first|captur|cancel|no video/i.test(s) ? 'error' : 'idle';
const fail = (msg) => {
  $('status').textContent = msg;
  $('statusbox').dataset.state = 'error';
};

async function show() {
  const { voices = [], threshold = 0.85, multi = false } = await chrome.storage.local.get(['voices', 'threshold', 'multi']);
  const { status = 'idle', marks = {} } = await chrome.storage.session.get(['status', 'marks']);
  const ticked = voices.filter((v) => v.skip).map(voiceName);
  $('voice').textContent = ticked.length ? ticked.join(', ') : t('none');
  $('status').textContent = translate(status);
  $('statusbox').dataset.state = stateOf(status);
  $('thr').value = threshold;
  $('thrv').textContent = (+threshold).toFixed(2);
  $('multi').checked = multi;
  $('ms').textContent = fmt(marks.start);
  $('me').textContent = fmt(marks.end);
}
async function showVoices() {
  const { voices = [] } = await chrome.storage.local.get('voices');
  $('voices').replaceChildren(...voices.map((v) => {
    const skip = Object.assign(document.createElement('input'), { type: 'checkbox', checked: v.skip, title: t('skipThis') });
    skip.onchange = () => toSw({ cmd: 'tick', id: v.id, on: skip.checked });
    const name = Object.assign(document.createElement('input'), { type: 'text', value: voiceName(v), placeholder: t('namePh') });
    name.onchange = () => toSw({ cmd: 'rename', id: v.id, name: name.value.trim() });
    const meta = Object.assign(document.createElement('span'), { className: 'muted', textContent: t('speechSeconds', [v.seconds]) });
    const del = Object.assign(document.createElement('button'), { textContent: '✕', title: t('deleteVoice') });
    del.onclick = () => toSw({ cmd: 'delete', id: v.id });
    const top = Object.assign(document.createElement('div'), { className: 'top' });
    top.append(skip, name, meta, del);
    const row = Object.assign(document.createElement('div'), { className: v.skip ? 'voice picked' : 'voice' });
    row.append(top, Object.assign(document.createElement('audio'), { controls: true, src: v.clip }));
    return row;
  }));
}
show();
showVoices();
chrome.storage.onChanged.addListener((changes) => {
  show();
  if (changes.voices) showVoices(); // not on status ticks: re-rendering would stop sample playback
});

$('thr').oninput = () => chrome.storage.local.set({ threshold: +$('thr').value });
$('multi').onchange = () => toSw({ cmd: 'multi', on: $('multi').checked });

// The popup closes when the user clicks the page; marks live in session storage so they survive that.
async function mark(key) {
  try {
    const s = await videoTime(await activeTab());
    const { marks = {} } = await chrome.storage.session.get('marks');
    await chrome.storage.session.set({ marks: { ...marks, [key]: s } });
  } catch {
    fail(t('stNoYT'));
  }
}
$('markStart').onclick = () => mark('start');
$('markEnd').onclick = () => mark('end');
$('clearMarks').onclick = () => chrome.storage.session.remove('marks');

// Opening the popup grants activeTab, which tabCapture needs; there is no auto-start on page load.
async function run(cmd) {
  const tab = await activeTab();
  try {
    let range;
    if (cmd === 'enroll') {
      const { marks = {} } = await chrome.storage.session.get('marks');
      const start = marks.start ?? (await videoTime(tab));
      const end = marks.end ?? start + +$('sec').value;
      if (!(end - start >= 3)) throw new Error(t('stRange'));
      range = { start, end };
    }
    await toSw({ cmd: 'stop' }); // free any previous capture first
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    toSw({ cmd, tabId: tab.id, streamId, range });
  } catch (e) {
    fail(e.message); // e.g. tab already captured: press Stop first
  }
}
$('enroll').onclick = () => run('enroll');
$('start').onclick = () => run('start');
$('stop').onclick = () => toSw({ cmd: 'stop' });
