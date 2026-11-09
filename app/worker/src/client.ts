// Ora Pro Nobis app client. Four tabs: Prayers (the player) ·
// Intentions (the pool) · Examination · Confession. No checklist
// anywhere: no check-offs, no done states, no counters on prayers
// or examination questions (Amendments 8-9).
export const APP_JS = `
'use strict';
var view = document.getElementById('view');
var audioEl = document.getElementById('audio');
var state = { tab: 'intentions', examMode: 'quick', examCat: null, deepIdx: 0, playingUrl: null, queue: [], queueIdx: -1, current: null, storedDay: null, dateLabel: '', pendingResume: null, sleep: { mode: 'off' }, readTracks: {}, dayDescs: [] };

/* ---------------- Playback speed (v336) ----------------
   One rate for the one audio element: a listener preference in
   shell scope, persisted on this device only under the client's
   own key, applied at exactly three points — boot (here, beside
   the element binding), every startDesc (no path can inherit a
   stale element rate), and setRate() on change. Nothing is sent
   to the server; no payload or route knows the rate exists. */
var SPEED_SET = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
function readStoredRate() {
  try {
    var r = Number(localStorage.getItem('opn-speed-v336'));
    return SPEED_SET.indexOf(r) >= 0 ? r : 1;
  } catch (e) { return 1; }
}
state.rate = readStoredRate();
audioEl.playbackRate = state.rate;
function setRate(r) {
  if (SPEED_SET.indexOf(r) < 0) return;
  state.rate = r;
  audioEl.playbackRate = r;
  try { localStorage.setItem('opn-speed-v336', String(r)); } catch (e) {}
  updatePositionState();
  updateNowPlaying();
  var ss = document.querySelector('.speedsheet');
  if (ss) ss.querySelectorAll('[data-rate]').forEach(function (b) { b.classList.toggle('active', Number(b.getAttribute('data-rate')) === r); });
}
function openSpeedSheet() {
  var old = document.querySelector('.speedsheet');
  if (old) old.remove();
  var sheet = document.createElement('div'); sheet.className = 'sheet speedsheet';
  sheet.innerHTML = '<div class="inner"><div class="row"><h1 class="screen grow">Playback speed</h1><button class="btn ghost" id="sp-close">Close</button></div>'
    + '<p class="meta">One speed for everything the app plays — the day&rsquo;s prayers, the downloaded shows, and Intentions alike. It is remembered on this device.</p>'
    + '<div class="chips">' + SPEED_SET.map(function (r) { return '<button class="chip' + (r === state.rate ? ' active' : '') + '" data-rate="' + r + '">' + r + '&times;</button>'; }).join('') + '</div></div>';
  document.body.appendChild(sheet);
  sheet.querySelector('#sp-close').addEventListener('click', function () { sheet.remove(); });
  sheet.querySelectorAll('[data-rate]').forEach(function (b) {
    b.addEventListener('click', function () { setRate(Number(b.getAttribute('data-rate'))); });
  });
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function todayChicago() {
  var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  var p = {}; parts.forEach(function (x) { p[x.type] = x.value; });
  return p.year + '-' + p.month + '-' + p.day;
}
function api(path, opts) {
  return fetch(path, opts || {}).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
      return j;
    });
  });
}
function post(path, body) { return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); }
/* ---------------- Playback engine (v312 E5/E6) ----------------
   One queue builder serves both Play All shapes. A descriptor is
   {episodeId, title, url, available}; the queue holds ALL descriptors
   in payload order, missing ones included — a missing descriptor is
   passed over only at the moment the queue reaches it, and its card
   (with its not-available line) is flashed as the reason. Queue and
   audio state live in this shell scope; no render resets them, so
   switching tabs never stops or resets playback. */
function fmtDur(s) { s = Math.max(0, Math.round(Number(s) || 0)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
function markPlaying(id) {
  document.querySelectorAll('[data-playkey]').forEach(function (b) {
    var on = !!id && b.getAttribute('data-playkey') === id;
    b.classList.toggle('playing', on);
    if (b.classList.contains('playbtn')) b.innerHTML = on ? '&#10073;&#10073;' : '&#9654;';
  });
  state.playingUrl = state.current ? state.current.url : null;
}
function markSkipped(id) {
  var card = document.querySelector('[data-card="' + id + '"]');
  if (!card) return;
  card.style.outline = '2px solid #8a4b2a';
  setTimeout(function () { card.style.outline = ''; }, 2400);
}
function saveResume() {
  if (!state.current || !state.storedDay) return;
  try {
    localStorage.setItem('opn-resume-v312', JSON.stringify({
      date: state.storedDay, episodeId: state.current.episodeId,
      positionS: audioEl.currentTime || 0, savedAt: new Date().toISOString(),
    }));
  } catch (e) {}
}
function readResume() {
  try { return JSON.parse(localStorage.getItem('opn-resume-v312') || 'null'); } catch (e) { return null; }
}
function setMediaSessionFor(desc) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: desc.title, artist: 'Ora Pro Nobis',
      album: 'Ora Pro Nobis — ' + (state.dateLabel || state.storedDay || ''),
      artwork: [{ src: '/logo.png', sizes: '288x288', type: 'image/png' }],
    });
  } catch (e) {}
}
function updatePositionState() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  var d = audioEl.duration;
  if (!isFinite(d) || d <= 0) return;
  try {
    navigator.mediaSession.setPositionState({ duration: d, playbackRate: audioEl.playbackRate || 1, position: Math.min(audioEl.currentTime || 0, d) });
  } catch (e) {}
}
function startDesc(desc) {
  fadeRestore(); // v320 §2.6 restore point (2): every playback start passes through here
  state.current = desc;
  setMediaSessionFor(desc);
  audioEl.src = desc.url;
  audioEl.playbackRate = state.rate; // v336: re-asserted on every start — no stale element rate
  audioEl.play().catch(function () {});
  markPlaying(desc.episodeId);
  updateDock();
}
function playTrack(desc) {
  if (!desc || !desc.available || !desc.url) return;
  if (state.current && state.current.episodeId === desc.episodeId && !audioEl.paused) { audioEl.pause(); return; }
  state.queue = []; state.queueIdx = -1;
  startDesc(desc);
}
function play(url, btn) {
  // Legacy single-play (the Intentions audio bar): a bare URL becomes
  // a one-off descriptor outside any queue.
  if (!url) return;
  playTrack({ episodeId: 'url:' + url, title: 'Intentions', url: url, available: true });
}
function startQueue(descs) {
  if (!descs.length) return;
  if (state.queue.length && state.queueIdx >= 0 && state.current && !audioEl.paused) { audioEl.pause(); return; }
  state.queue = descs.slice();
  var idx = -1;
  for (var i = 0; i < state.queue.length; i++) {
    if (!state.queue[i].available) { markSkipped(state.queue[i].episodeId); continue; }
    idx = i; break;
  }
  if (idx < 0) { state.queue = []; state.queueIdx = -1; return; }
  state.queueIdx = idx;
  startDesc(state.queue[idx]);
}
function advanceQueue(dir) {
  if (!state.queue.length) return false;
  var i = state.queueIdx + dir;
  while (i >= 0 && i < state.queue.length) {
    var d = state.queue[i];
    if (!d.available) { if (dir > 0) markSkipped(d.episodeId); i += dir; continue; }
    state.queueIdx = i;
    startDesc(d);
    return true;
  }
  if (dir > 0) { state.queue = []; state.queueIdx = -1; state.current = null; markPlaying(null); updatePositionState(); updateDock(); }
  return false;
}
function loadResume(desc, positionS) {
  state.queue = []; state.queueIdx = -1;
  state.current = desc;
  setMediaSessionFor(desc);
  state.pendingResume = { episodeId: desc.episodeId, positionS: positionS };
  audioEl.src = desc.url;
  audioEl.load(); // preload="none": an explicit load is what brings metadata (and the pending position) in
  markPlaying(desc.episodeId);
  updateDock();
  // Stands paused at the position (set on loadedmetadata); the app
  // never autoplays sound on open.
}
audioEl.addEventListener('loadedmetadata', function () {
  if (state.pendingResume && state.current && state.pendingResume.episodeId === state.current.episodeId) {
    try { audioEl.currentTime = state.pendingResume.positionS || 0; } catch (e) {}
    state.pendingResume = null;
  }
  updatePositionState();
});
audioEl.addEventListener('ended', function () {
  if (state.sleep && state.sleep.mode === 'track') { sleepTrackEnd(); return; }
  if (state.queue.length) { advanceQueue(1); return; }
  state.current = null; markPlaying(null);
  updateDock();
});
audioEl.addEventListener('pause', function () { saveResume(); if (!state.queue.length) markPlaying(state.current ? state.current.episodeId : null); });
audioEl.addEventListener('play', function () { updateDock(); });
audioEl.addEventListener('pause', function () { updateDock(); });
var lastResumeSave = 0;
audioEl.addEventListener('timeupdate', function () {
  sleepTick();
  updatePositionState();
  updateDockProgress();
  updateNpSeek();
  var now = Date.now();
  if (now - lastResumeSave > 5000) { lastResumeSave = now; saveResume(); }
});
audioEl.addEventListener('seeked', updatePositionState);

/* ---------------- Docked player (v326) ----------------
   A shell-level mini-player: one element in SHELL_HTML above the
   tab bar, rendered once at boot and updated in place, never part
   of any tab's render. Visibility is DERIVED, no new flag: the
   dock stands exactly while state.current is set (D1), and
   updateDock() is its only sync path — hooked into startDesc,
   the element's own play/pause events (these two cover every
   path, Media Session included), advanceQueue's end-clear, the
   ended handler, sleepTrackEnd, loadResume, and the Read view's
   post-open point. The dock's play button carries its own id and
   NO data-playkey, so markPlaying's document-wide sweep never
   owns the dock's glyph. Transport drives the standing paths —
   playTrack(state.current), advanceQueue(1) — so the dock can
   never disagree with the cards. The progress line is
   display-only (D2): no click, drag, or key handler seeks it;
   seek stays on the lock screen. The dock's stack position is
   measured, not hardcoded: --tabh from the tab bar's own height
   (safe-area padding included) sets its bottom offset, and
   --dockh from its own height sets the view's added clearance
   while it stands (body.dock-on); hidden, the standing 96px pad
   is exactly what stands. */
function measureBars() {
  var tb = document.getElementById('tabbar');
  if (tb) document.documentElement.style.setProperty('--tabh', tb.offsetHeight + 'px');
  var dk = document.getElementById('dock');
  if (dk && state.current) document.documentElement.style.setProperty('--dockh', dk.offsetHeight + 'px');
}
function updateDockProgress() {
  var f = document.getElementById('dock-progress-fill');
  if (!f) return;
  var d = audioEl.duration;
  f.style.width = (isFinite(d) && d > 0) ? ((audioEl.currentTime / d) * 100) + '%' : '0%';
}
function updateDock() {
  var dock = document.getElementById('dock');
  if (!dock) return;
  var cur = state.current;
  if (!cur) {
    dock.classList.add('hidden');
    document.body.classList.remove('dock-on');
    updateNowPlaying(); // v336: the surface's visibility derives from state.current, like the dock's
    return;
  }
  document.getElementById('dock-title').textContent = cur.title || '';
  document.getElementById('dock-meta').textContent = cur.block || state.dateLabel || '';
  document.getElementById('dock-play').innerHTML = audioEl.paused ? '&#9654;' : '&#10073;&#10073;';
  document.getElementById('dock-next').disabled = !state.queue.length;
  dock.classList.remove('hidden');
  document.body.classList.add('dock-on');
  measureBars();
  updateDockProgress();
  updateNowPlaying();
}


/* ---------------- Sleep timer (v320) ----------------
   A player state, not bound to a track: state.sleep is exactly one of
   {mode:'off'} · {mode:'minutes', presetMin, deadlineMs} · {mode:'track'}.
   It lives and dies in shell scope — never written anywhere (no new
   storage key; the resume record's byte shape is unchanged), so an app
   restart, reload, or SW-update reload resets it. A minute arm is a
   wall-clock deadline: remaining time is always recomputed from the
   deadline, never decremented. Firing a timed stop is a plain pause()
   — the standing pause handler saves the resume point — and the queue
   stands held, not cleared. */
var fade = { started: false, base: 1, probed: false, supported: true };
function fadeRestore() {
  // §2.6: restore = the captured base (1 when no fade ran), fade state cleared.
  try { audioEl.volume = fade.base; } catch (e) {}
  fade.started = false; fade.probed = false; fade.supported = true;
}
function sleepLabel() {
  var s = state.sleep || { mode: 'off' };
  if (s.mode === 'minutes') {
    var t = Math.ceil(Math.max(0, s.deadlineMs - Date.now()) / 1000);
    return 'Sleep · ' + Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2);
  }
  if (s.mode === 'track') return 'Sleep · End of track';
  return 'Sleep · Off';
}
function updateSleepLabel() {
  // v336: one sleep state, two label surfaces — the Play All row's
  // button and Now Playing's, each refreshed when it stands.
  var b = document.getElementById('sleep-btn');
  if (b) b.textContent = sleepLabel();
  var nb = document.getElementById('np-sleep');
  if (nb) nb.textContent = sleepLabel();
}
function armSleepMinutes(n) {
  if (fade.started) fadeRestore();
  state.sleep = { mode: 'minutes', presetMin: n, deadlineMs: Date.now() + n * 60000 };
  updateSleepLabel();
}
function armSleepTrack() {
  if (fade.started) fadeRestore();
  state.sleep = { mode: 'track' };
  updateSleepLabel();
}
function disarmSleep() { state.sleep = { mode: 'off' }; }
function fireTimedStop() {
  // §2.4, in order: pause (the pause handler saves the resume point;
  // the timer adds no save of its own) · disarm · fade restore · label.
  // §2.3 idle edge: already paused or nothing loaded — disarm only,
  // no pause call, no resume write; the fade restore still runs.
  if (!audioEl.paused && state.current) audioEl.pause();
  disarmSleep();
  fadeRestore();
  updateSleepLabel();
}
function sleepTick() {
  if (!state.sleep || state.sleep.mode !== 'minutes') return;
  var remaining = state.sleep.deadlineMs - Date.now();
  updateSleepLabel();
  if (remaining <= 15000) {
    // §2.6 fade: the ramp recomputes from the remaining time on every
    // tick, never accumulated; the stop never depends on it.
    if (!fade.started) { fade.started = true; fade.base = audioEl.volume; fade.probed = false; }
    if (fade.supported) {
      var target = fade.base * Math.max(0, remaining / 15000);
      try { audioEl.volume = target; } catch (e) {}
      if (!fade.probed) {
        fade.probed = true;
        // Capability probe: if the written value did not take (it
        // reads back materially above the target), the platform does
        // not honour element volume — no further writes this run,
        // and the stop proceeds without a fade, silently.
        if ((audioEl.volume || 0) > target + 0.02) fade.supported = false;
      }
    }
  }
  if (remaining <= 0) fireTimedStop();
}
function sleepTrackEnd() {
  // §2.5: the arm disarms as it fires in every sub-case, so exactly
  // one track end is ever suppressed; the next natural end advances.
  disarmSleep();
  if (state.queue.length) {
    var i = state.queueIdx + 1;
    var next = null;
    while (i < state.queue.length) {
      var d = state.queue[i];
      if (!d.available) { markSkipped(d.episodeId); i++; continue; }
      next = d; break;
    }
    if (next) {
      // (a) hold at the next track's head, unstarted: advance queueIdx
      // by advanceQueue's own skip rule without playing; the explicit
      // saveResume writes the next track at currentTime = 0 (the
      // element is preload="none", so load() is explicit, per v312).
      state.queueIdx = i;
      state.current = next;
      setMediaSessionFor(next);
      audioEl.src = next.url;
      audioEl.load();
      markPlaying(next.episodeId);
      saveResume();
      updateSleepLabel();
      updateDock();
      return;
    }
    // (b) queue exhausted: exactly the standing queue-end path.
    state.queue = []; state.queueIdx = -1; state.current = null; markPlaying(null); updatePositionState();
    updateSleepLabel();
    updateDock();
    return;
  }
  // (c) no queue (a single track): exactly the standing end path.
  state.current = null; markPlaying(null);
  updateSleepLabel();
  updateDock();
}
function openSleepSheet() {
  var choices = [
    { k: 'off', label: 'Off' }, { k: '5', label: '5' }, { k: '10', label: '10' },
    { k: '15', label: '15' }, { k: '30', label: '30' }, { k: '45', label: '45' },
    { k: '60', label: '60' }, { k: 'track', label: 'End of track' },
  ];
  function isArmed(c) {
    if (c.k === 'off') return state.sleep.mode === 'off';
    if (c.k === 'track') return state.sleep.mode === 'track';
    return state.sleep.mode === 'minutes' && state.sleep.presetMin === Number(c.k);
  }
  var sheet = document.createElement('div'); sheet.className = 'sheet';
  sheet.innerHTML = '<div class="inner"><div class="row"><h1 class="screen grow">Sleep timer</h1><button class="btn ghost" id="sl-close">Close</button></div>'
    + '<p class="meta">Minutes until playback stops — the queue is held, not cleared. End of track stops when the playing track finishes.</p>'
    + '<div class="chips">' + choices.map(function (c) { return '<button class="chip' + (isArmed(c) ? ' active' : '') + '" data-sleep-choice="' + c.k + '">' + c.label + '</button>'; }).join('') + '</div></div>';
  document.body.appendChild(sheet);
  sheet.querySelector('#sl-close').addEventListener('click', function () { sheet.remove(); });
  sheet.querySelectorAll('[data-sleep-choice]').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-sleep-choice');
      if (k === 'off') { disarmSleep(); updateSleepLabel(); }
      else if (k === 'track') armSleepTrack();
      else armSleepMinutes(Number(k));
      sheet.remove();
    });
  });
}
// Harness seam (§2.10): the hook and the sheet call the same arm/disarm
// functions, so the hook cannot drift from the shipped behavior.
window.__opnSleep = {
  state: function () {
    var c = {};
    Object.keys(state.sleep).forEach(function (k) { c[k] = state.sleep[k]; });
    c.remainingMs = state.sleep.mode === 'minutes' ? Math.max(0, state.sleep.deadlineMs - Date.now()) : null;
    return c;
  },
  armMinutes: function (n) { armSleepMinutes(n); },
  armTrack: function () { armSleepTrack(); },
  disarm: function () { disarmSleep(); updateSleepLabel(); },
};
setInterval(sleepTick, 1000);

function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  var handlers = {
    play: function () { fadeRestore(); audioEl.play().catch(function () {}); }, // v320 §2.6 restore point (3): the one play path that bypasses startDesc
    pause: function () { audioEl.pause(); },
    previoustrack: function () { if (state.queue.length) advanceQueue(-1); },
    nexttrack: function () { if (state.queue.length) advanceQueue(1); },
    seekto: function (details) {
      if (details.seekTime == null) return;
      if (details.fastSeek && typeof audioEl.fastSeek === 'function') audioEl.fastSeek(details.seekTime);
      else audioEl.currentTime = details.seekTime;
    },
    seekforward: function (details) { audioEl.currentTime = Math.min((audioEl.duration || 0), (audioEl.currentTime || 0) + ((details && details.seekOffset) || 10)); },
    seekbackward: function (details) { audioEl.currentTime = Math.max(0, (audioEl.currentTime || 0) - ((details && details.seekOffset) || 10)); },
  };
  Object.keys(handlers).forEach(function (a) {
    try { navigator.mediaSession.setActionHandler(a, handlers[a]); } catch (e) {}
  });
  // Harness hook (E9 check 8): Media Session handlers are not readable
  // back from navigator.mediaSession, so the registered handler table
  // is exposed for the gate's agent-side evidence. John's phone check
  // at Review remains the binding criterion.
  window.__opnMediaHandlers = handlers;
}

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll('#tabbar .tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
  if (tab === 'prayers') renderPrayers();
  else if (tab === 'intentions') renderIntentions();
  else if (tab === 'examination') renderExamination();
  else if (tab === 'confession') renderConfession();
}
document.querySelectorAll('#tabbar .tab').forEach(function (b) {
  b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
});
document.getElementById('dock-play').addEventListener('click', function () { if (state.current) playTrack(state.current); });
document.getElementById('dock-next').addEventListener('click', function () { advanceQueue(1); });
document.getElementById('dock').addEventListener('click', function (ev) {
  if (ev.target && ev.target.closest && (ev.target.closest('#dock-play') || ev.target.closest('#dock-next'))) return;
  openNowPlaying(); // v336 (D5, approved): the dock tap opens Now Playing — the v326 jump-to-card is retired
});
window.addEventListener('resize', measureBars);
measureBars();

/* ---------------- Settings (v328) ----------------
   The source-mapping screen, reached by the brand-bar gear (it
   stands on every screen); it is not a tab — no tab stands active
   while it shows, and tapping any tab leaves it. One row per
   source: name, a family meta line, and the four knobs (on/off,
   block, day rule, order). The displayed order IS the order of
   record: the rows stand in settings order inside their sections,
   and Save sends the full array in displayed order — the server
   renumbers each block's sequence gapless from that order and
   increments the settings version. The Intentions card is not a
   settings row and never appears here (A1.2a). */
var settingsRows = [];
var settingsVersion = null;
var settingsNote = '';
var SET_BLOCKS = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night'];
var SET_SECTIONS = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night', 'No block', 'Off'];
var DAY_RULE_LABELS = { 'daily': 'Daily', 'weekdays': 'Weekdays only', 'weekends': 'Weekends only', 'sundays': 'Sundays only', 'fridays': 'Fridays only', 'fallback-only': 'Fallback only' };
function settingsFamilyLabel(row) {
  if (row.sourceKey === 'saint-of-the-day') return 'Spotify-side today — this row governs from the day a source leg brings this source into the app.';
  if (row.family === 'own') return 'Own podcast';
  if (row.family === 'spotify') return 'Spotify-side today';
  if (row.family === 'unplaced') return 'Not placed — no app leg yet.';
  var base = row.name.split(' — ')[0];
  return row.role === 'fallback' ? base + ' — fallback only' : base;
}
function settingsSectionOf(row) {
  if (!row.enabled) return 'Off';
  if (!row.block) return 'No block';
  return row.block;
}
function settingsSections() {
  var out = {};
  SET_SECTIONS.forEach(function (s) { out[s] = []; });
  settingsRows.forEach(function (r) { out[settingsSectionOf(r)].push(r); });
  return out;
}
function renderSettings() {
  state.tab = 'settings';
  document.querySelectorAll('#tabbar .tab').forEach(function (b) { b.classList.remove('active'); });
  view.innerHTML = '<h1 class="screen">Settings</h1><p class="sub">Source mapping</p><p class="meta">Loading...</p>';
  api('/api/player/source-settings').then(function (res) {
    settingsRows = res.sources || [];
    settingsVersion = res.version;
    settingsNote = '';
    paintSettings();
  }).catch(function (e) {
    view.innerHTML = '<h1 class="screen">Settings</h1><p class="err">' + esc(e.message) + '</p>';
  });
}
function paintSettings() {
  var html = '<h1 class="screen">Settings</h1>';
  html += '<p class="sub">Source mapping — which podcast plays in which block, on which days, in which order. Changes apply from the next nightly push.</p>';
  html += '<p class="meta">Settings version ' + settingsVersion + '</p>';
  if (settingsNote) html += '<p class="meta">' + esc(settingsNote) + '</p>';
  html += '<p class="err" id="set-err"></p>';
  var secs = settingsSections();
  SET_SECTIONS.forEach(function (sec) {
    var rows = secs[sec];
    if (!rows.length) return;
    html += '<div class="blockhead"><h2>' + esc(sec.toUpperCase()) + '</h2></div>';
    rows.forEach(function (row, idx) {
      html += '<div class="setrow" data-setkey="' + esc(row.sourceKey) + '">';
      html += '<div class="setname">' + esc(row.name) + '</div>';
      html += '<div class="meta">' + esc(settingsFamilyLabel(row)) + '</div>';
      if (row.sourceKey === 'marian-antiphon') {
        html += '<div class="meta">One antiphon episode is produced each day and stands here, in Morning. The day also carries Midday and Afternoon antiphon prayer slots, which no produced episode fills.</div>';
      }
      html += '<div class="setcontrols">';
      html += '<button class="settoggle' + (row.enabled ? ' on' : '') + '" data-setact="toggle">' + (row.enabled ? 'On' : 'Off') + '</button>';
      html += '<select data-setfield="block">' + [''].concat(SET_BLOCKS).map(function (b) {
        return '<option value="' + esc(b) + '"' + (row.block === b ? ' selected' : '') + '>' + (b || 'No block') + '</option>';
      }).join('') + '</select>';
      html += '<select data-setfield="dayRule">' + Object.keys(DAY_RULE_LABELS).map(function (r) {
        return '<option value="' + esc(r) + '"' + (row.dayRule === r ? ' selected' : '') + '>' + DAY_RULE_LABELS[r] + '</option>';
      }).join('') + '</select>';
      html += '<button class="mvbtn" data-setact="up" aria-label="Move up"' + (idx === 0 ? ' disabled' : '') + '>&#9650;</button>';
      html += '<button class="mvbtn" data-setact="down" aria-label="Move down"' + (idx === rows.length - 1 ? ' disabled' : '') + '>&#9660;</button>';
      html += '</div></div>';
    });
  });
  html += '<div class="row" style="margin-top:12px"><button class="btn gold" id="set-save">Save mapping</button><button class="btn ghost" id="set-back">&lsaquo; Back</button></div>';
  view.innerHTML = html;
  view.querySelectorAll('[data-setkey]').forEach(function (el) {
    var key = el.getAttribute('data-setkey');
    var row = settingsRows.filter(function (r) { return r.sourceKey === key; })[0];
    el.querySelector('[data-setact="toggle"]').addEventListener('click', function () {
      row.enabled = row.enabled ? 0 : 1;
      settingsRebuildOrder();
      paintSettings();
    });
    el.querySelector('[data-setfield="block"]').addEventListener('change', function (ev) {
      row.block = ev.target.value;
      settingsRebuildOrder();
      paintSettings();
    });
    el.querySelector('[data-setfield="dayRule"]').addEventListener('change', function (ev) {
      row.dayRule = ev.target.value;
    });
    el.querySelector('[data-setact="up"]').addEventListener('click', function () { settingsMove(row, -1); });
    el.querySelector('[data-setact="down"]').addEventListener('click', function () { settingsMove(row, 1); });
  });
  document.getElementById('set-save').addEventListener('click', saveSettings);
  document.getElementById('set-back').addEventListener('click', function () { setTab('prayers'); });
}
function settingsRebuildOrder() {
  // After a structural change (toggle, block move) the row stands
  // at the end of its new section: rebuild the array as the
  // sections concatenated, so displayed order is always sent order.
  var secs = settingsSections();
  var out = [];
  SET_SECTIONS.forEach(function (s) { secs[s].forEach(function (r) { out.push(r); }); });
  settingsRows = out;
}
function settingsMove(row, dir) {
  var secs = settingsSections();
  var list = secs[settingsSectionOf(row)];
  var i = list.indexOf(row);
  var j = i + dir;
  if (j < 0 || j >= list.length) return;
  list[i] = list[j]; list[j] = row;
  var out = [];
  SET_SECTIONS.forEach(function (s) { secs[s].forEach(function (r) { out.push(r); }); });
  settingsRows = out;
  paintSettings();
}
function saveSettings() {
  var errEl = document.getElementById('set-err');
  var body = { sources: settingsRows.map(function (r) { return { sourceKey: r.sourceKey, block: r.block, dayRule: r.dayRule, enabled: r.enabled }; }) };
  api('/api/player/source-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(function (res) {
      settingsVersion = res.version;
      settingsNote = 'Saved — settings version ' + res.version + '. The next nightly push uses it.';
      return api('/api/player/source-settings');
    })
    .then(function (res) {
      settingsRows = res.sources || [];
      settingsVersion = res.version;
      paintSettings();
    })
    .catch(function (e) { if (errEl) errEl.textContent = e.message; });
}
document.getElementById('gearbtn').addEventListener('click', renderSettings);

/* ---------------- Intentions (the pool) ---------------- */
function intentionRow(it) {
  var hist = it.drawnCount ? ('drawn ' + it.drawnCount + (it.drawnCount === 1 ? ' time' : ' times') + (it.lastDrawn ? ' · last ' + it.lastDrawn : '')) : 'not drawn yet';
  var actions = it.status === 'active'
    ? '<button class="btn ghost small" data-act="edit" data-id="' + it.id + '">Edit</button> <button class="btn ghost small" data-act="retire" data-id="' + it.id + '">Retire</button> <button class="btn ghost small" data-act="del" data-id="' + it.id + '">Delete</button>'
    : '<button class="btn ghost small" data-act="edit" data-id="' + it.id + '">Edit</button> <button class="btn ghost small" data-act="restore" data-id="' + it.id + '">Restore</button> <button class="btn ghost small" data-act="del" data-id="' + it.id + '">Delete</button>';
  return '<div class="card"><div class="row"><div class="grow"><div>' + esc(it.text) + '</div><div class="meta">' + hist + '</div></div><span class="pri ' + it.priority + '">' + ({ H: 'High', M: 'Medium', L: 'Low' })[it.priority] + '</span></div><div style="margin-top:8px">' + actions + '</div></div>';
}
function renderIntentions() {
  view.innerHTML = '<h1 class="screen">Intentions</h1><p class="sub">the pool</p><p class="meta">Loading...</p>';
  var today = todayChicago();
  Promise.all([api('/api/prayer/intentions'), api('/api/prayer/day?date=' + today)]).then(function (res) {
    var intentions = res[0].intentions || [];
    var day = res[1] || {};
    var active = intentions.filter(function (i) { return i.status === 'active'; });
    var retired = intentions.filter(function (i) { return i.status !== 'active'; });
    var cnt = { H: 0, M: 0, L: 0 }; active.forEach(function (i) { cnt[i.priority] = (cnt[i.priority] || 0) + 1; });
    var audioByBlock = {}; (day.blocks || []).forEach(function (b) { audioByBlock[b.block] = b.audio; });
    var bar = (day.blocks || []).map(function (b) {
      var a = audioByBlock[b.block];
      if (a && a.available) return '<button class="chipbtn" data-play="' + esc(a.url) + '">' + esc(b.block) + ' &#9654;</button>';
      return '<span class="chipbtn missing">' + esc(b.block) + ' — not yet</span>';
    }).join('');
    var missing = (day.audioMissing || []).length ? '<p class="notavail">Not yet generated: ' + esc((day.audioMissing || []).join(', ')) + '</p>' : '';
    var html = '<h1 class="screen">Intentions</h1><p class="sub">the pool</p>';
    html += '<div class="stats"><div class="stat"><b>' + cnt.H + '</b><span>High</span></div><div class="stat"><b>' + cnt.M + '</b><span>Medium</span></div><div class="stat"><b>' + cnt.L + '</b><span>Low</span></div><div class="stat"><b>' + active.length + '</b><span>active</span></div></div>';
    html += '<div class="card"><h3>Today&rsquo;s intentions — audio</h3><div class="audiobar">' + bar + '</div>' + missing + '<p class="meta" style="margin-top:8px">Generated nightly from the day&rsquo;s draw — one spoken intentions segment for each block.</p></div>';
    [['H', 'High · weight 4'], ['M', 'Medium · weight 2'], ['L', 'Low · weight 1']].forEach(function (g) {
      var rows = active.filter(function (i) { return i.priority === g[0]; });
      html += '<h2 style="color:var(--navy);font-weight:normal;letter-spacing:1px;font-size:16px;margin:16px 0 8px">' + g[1].toUpperCase() + '</h2>';
      html += rows.length ? rows.map(intentionRow).join('') : '<p class="meta">None.</p>';
    });
    if (retired.length) {
      html += '<h2 style="color:var(--navy);font-weight:normal;letter-spacing:1px;font-size:16px;margin:16px 0 8px">RETIRED</h2>' + retired.map(intentionRow).join('');
    }
    html += '<div class="card"><h3>Add an intention</h3><label class="f">Text</label><input type="text" id="new-text" placeholder="For..."><label class="f">Priority</label><select id="new-pri"><option value="H">High</option><option value="M" selected>Medium</option><option value="L">Low</option></select><div style="margin-top:10px"><button class="btn gold" id="new-add">Add to the pool</button></div><p class="meta" style="margin-top:8px">Adding an intention only adds it — it first enters a draw at the next nightly fill.</p></div>';
    html += '<p class="about">Your intentions live only in this app. The nightly draw runs off this pool for the podcast and the prayer products; this screen tends the pool and does not stage the day.</p>';
    view.innerHTML = html;
    wireIntentions(intentions);
  }).catch(function (e) { view.innerHTML = '<p class="err">' + esc(e.message) + '</p>'; });
}
function wireIntentions(intentions) {
  view.querySelectorAll('.audiobar [data-play]').forEach(function (b) { b.addEventListener('click', function () { play(b.getAttribute('data-play'), b); }); });
  var add = document.getElementById('new-add');
  if (add) add.addEventListener('click', function () {
    var text = document.getElementById('new-text').value.trim();
    if (!text) return;
    post('/api/prayer/intentions', { text: text, priority: document.getElementById('new-pri').value }).then(renderIntentions);
  });
  view.querySelectorAll('[data-act]').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = Number(b.getAttribute('data-id')); var act = b.getAttribute('data-act');
      var it = intentions.filter(function (i) { return i.id === id; })[0];
      if (act === 'edit') openIntentionEditor(it);
      else if (act === 'retire') post('/api/prayer/intentions/' + id + '/status', { status: 'retired' }).then(renderIntentions);
      else if (act === 'restore') post('/api/prayer/intentions/' + id + '/status', { status: 'active' }).then(renderIntentions);
      else if (act === 'del') { if (confirm('Delete this intention and all its draws?')) api('/api/prayer/intentions/' + id, { method: 'DELETE' }).then(renderIntentions); }
    });
  });
}
function openIntentionEditor(it) {
  var sheet = document.createElement('div'); sheet.className = 'sheet';
  sheet.innerHTML = '<div class="inner"><div class="row"><h1 class="screen grow">Intention</h1><button class="btn ghost" id="ed-close">Close</button></div>'
    + '<label class="f">Text</label><input type="text" id="ed-text" value="' + esc(it.text) + '">'
    + '<label class="f">Priority</label><select id="ed-pri"><option value="H"' + (it.priority === 'H' ? ' selected' : '') + '>High</option><option value="M"' + (it.priority === 'M' ? ' selected' : '') + '>Medium</option><option value="L"' + (it.priority === 'L' ? ' selected' : '') + '>Low</option></select>'
    + '<p class="meta" style="margin-top:12px">Status: ' + esc(it.status) + ' · Created: ' + esc((it.created_at || '').slice(0, 10)) + ' · Drawn ' + (it.drawnCount || 0) + ' times' + (it.lastDrawn ? ' · last drawn ' + it.lastDrawn : '') + '</p>'
    + '<div style="margin-top:14px"><button class="btn gold" id="ed-save">Save</button></div></div>';
  document.body.appendChild(sheet);
  sheet.querySelector('#ed-close').addEventListener('click', function () { sheet.remove(); });
  sheet.querySelector('#ed-save').addEventListener('click', function () {
    api('/api/prayer/intentions/' + it.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sheet.querySelector('#ed-text').value, priority: sheet.querySelector('#ed-pri').value }) })
      .then(function () { sheet.remove(); renderIntentions(); });
  });
}

/* ---------------- Prayers (the player) ---------------- */
function trackDesc(t) {
  // v336 P6: source + durationS ride along additively — the one seam
  // both queue builds flow through, so Now Playing's meta line and
  // seek bar see them on every family's descriptor alike.
  return { episodeId: t.episodeId || ('seg:' + (t._block || '')), title: t.title || 'Intentions', url: t.streamUrl || null, available: !!t.available, block: t._block || '', source: t.source || '', durationS: t.durationS || t.durationSec || 0 };
}
function readButton(t, key) {
  // v318 T9: the Read control. A track with no text carries NO Read
  // control — the plain not-available line stands in its place
  // (readLine below), never a dead button.
  return '<div style="margin-top:6px"><button class="btn ghost small" data-read="' + esc(key) + '">Read</button></div>';
}
function trackCard(t) {
  var key = t.episodeId || ('seg:' + (t._block || ''));
  if (t.intentionsCard) {
    if (!t.available) return '<div class="card intentions-card" data-card="' + esc(key) + '"><h3>Intentions</h3><div class="notavail">Not available in the app yet — today&rsquo;s segment has not been generated.</div></div>';
    return '<div class="card intentions-card" data-card="' + esc(key) + '"><div class="row"><button class="playbtn" data-playkey="' + esc(key) + '" data-url="' + esc(t.streamUrl) + '">&#9654;</button><div class="grow"><h3>Intentions</h3><div class="meta">Plays here · segment file · generated nightly</div></div></div></div>';
  }
  if (t.kind === 'external') {
    // v324 §2.9: an external track names its source in the meta line
    // (D5); a miss stands as "Not available today". No Read control —
    // externals carry no text (the payload's hasText is false), and a
    // present external carries no not-available line.
    if (t.available) {
      return '<div class="card" data-card="' + esc(key) + '"><div class="row"><button class="playbtn" data-playkey="' + esc(key) + '" data-url="' + esc(t.streamUrl) + '">&#9654;</button><div class="grow"><h3>' + esc(t.title) + '</h3><div class="meta">Plays here · ' + esc(t.source || '') + (t.durationS ? ' · ' + fmtDur(t.durationS) : '') + '</div></div></div></div>';
    }
    return '<div class="card" data-card="' + esc(key) + '"><h3>' + esc(t.title) + '</h3><div class="meta">' + (t.durationS ? fmtDur(t.durationS) : '') + '</div><div class="notavail">Not available today</div></div>';
  }
  if (t.available) {
    return '<div class="card" data-card="' + esc(key) + '"><div class="row"><button class="playbtn" data-playkey="' + esc(key) + '" data-url="' + esc(t.streamUrl) + '">&#9654;</button><div class="grow"><h3>' + esc(t.title) + '</h3><div class="meta">Plays here · episode file' + (t.durationS ? ' · ' + fmtDur(t.durationS) : '') + '</div>'
      + (t.spotifyUrl ? '<a class="spot" target="_blank" rel="noopener" href="' + esc(t.spotifyUrl) + '">Open in Spotify</a>' : '')
      + (t.hasText && t.textUrl ? readButton(t, key) : '<div class="notavail">Not available in the app yet</div>') + '</div></div></div>';
  }
  return '<div class="card" data-card="' + esc(key) + '"><h3>' + esc(t.title) + '</h3><div class="meta">' + (t.durationS ? fmtDur(t.durationS) : '') + '</div><div class="notavail">Not available in the app yet</div>'
    + (t.hasText && t.textUrl ? readButton(t, key) : '')
    + (t.spotifyUrl ? '<a class="spot" target="_blank" rel="noopener" href="' + esc(t.spotifyUrl) + '">Open in Spotify</a>' : '') + '</div>';
}
function openRead(t) {
  // v318 T9: the reading view — the episode's full text within the
  // Prayers tab, set at the app's reading size under the font floor.
  // Its play/pause control calls playTrack on the SAME descriptor
  // the card's button uses, so it drives the same shell-level audio
  // element and queue; closing the view never stops or resets
  // playback, and switching back to the card list doesn't either
  // (v312's shell-scope rule). No position highlighting, no
  // auto-scroll sync — out of scope (§1).
  var old = document.querySelector('.readsheet');
  if (old) old.remove();
  var sheet = document.createElement('div');
  sheet.className = 'sheet readsheet';
  sheet.innerHTML = '<div class="inner"><div class="row"><button class="playbtn" data-playkey="' + esc(t.episodeId) + '">&#9654;</button><div class="grow"><h1 class="screen">' + esc(t.title) + '</h1><p class="sub">the episode&rsquo;s text</p></div><button class="btn ghost" data-readclose="1">Close</button></div><div class="readtext">Loading...</div></div>';
  document.body.appendChild(sheet);
  sheet.querySelector('[data-readclose]').addEventListener('click', function () { sheet.remove(); });
  sheet.querySelector('[data-playkey]').addEventListener('click', function () {
    var d = (state.dayDescs || []).filter(function (x) { return x.episodeId === t.episodeId; })[0];
    if (d) playTrack(d);
  });
  if (state.current && state.current.episodeId === t.episodeId) markPlaying(t.episodeId);
  updateDock();
  fetch(t.textUrl).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  }).then(function (text) {
    var body = sheet.querySelector('.readtext');
    if (body) body.textContent = text;
  }).catch(function () {
    var body = sheet.querySelector('.readtext');
    if (body) body.textContent = 'Not available in the app yet';
  });
}
/* ---------------- Now Playing (v336) ----------------
   The full-screen player, opened by the dock tap (D5). Built on
   the Read view's construction discipline: a JS-built .sheet,
   appended to body, removed whole. It carries no state of its
   own — updateNowPlaying() syncs it from inside updateDock()
   (the dock's own sync path) and updateNpSeek() rides the
   standing timeupdate handler, so the sheet can never disagree
   with the dock or the element. Its visibility is derived from
   state.current exactly as the dock's is: when the current track
   clears (queue end, a lone track's end), updateDock's sync
   removes it. Minimizing removes the sheet and nothing else —
   playback, position, queue, and sleep are never touched by the
   surface's open or close (the Read view's standing rule). No
   swipe: the .sheet pattern carries no gesture machinery
   anywhere in the estate, and D4 committed the button route. */
var npScrubbing = false;
function npDuration() {
  var d = audioEl.duration;
  if (isFinite(d) && d > 0) return d;
  var cur = state.current;
  if (cur && cur.durationS > 0) return cur.durationS;
  return 0;
}
function openNowPlaying() {
  var old = document.querySelector('.np-sheet');
  if (old) old.remove();
  if (!state.current) return;
  var sheet = document.createElement('div');
  sheet.className = 'sheet np-sheet';
  sheet.innerHTML = '<div class="inner">'
    + '<div class="row"><span class="grow"></span><button class="btn ghost" id="np-min" aria-label="Minimize">&#8964;</button></div>'
    + '<div class="np-art"><img src="/logo.png" alt="Ora Pro Nobis logo"></div>'
    + '<h1 class="screen np-title" id="np-title"></h1>'
    + '<p class="sub np-meta" id="np-meta"></p>'
    + '<div class="np-seekrow"><span id="np-elapsed">0:00</span><input type="range" id="np-seek" min="0" max="1000" value="0" aria-label="Seek"><span id="np-remain">--:--</span></div>'
    + '<div class="np-transport"><button class="np-tbtn" id="np-prev" aria-label="Previous track">&#9198;</button><button class="playbtn np-play" id="np-play" aria-label="Play or pause">&#9654;</button><button class="np-tbtn" id="np-next" aria-label="Next track">&#9197;</button></div>'
    + '<div class="row np-controls"><button class="btn ghost" id="np-speed"></button><button class="btn ghost" id="np-sleep"></button><button class="btn ghost" id="np-read">Read</button></div>'
    + '</div>';
  document.body.appendChild(sheet);
  sheet.querySelector('#np-min').addEventListener('click', function () { sheet.remove(); });
  sheet.querySelector('#np-play').addEventListener('click', function () { if (state.current) playTrack(state.current); });
  sheet.querySelector('#np-prev').addEventListener('click', function () { advanceQueue(-1); });
  sheet.querySelector('#np-next').addEventListener('click', function () { advanceQueue(1); });
  sheet.querySelector('#np-speed').addEventListener('click', function () { openSpeedSheet(); });
  sheet.querySelector('#np-sleep').addEventListener('click', function () { openSleepSheet(); });
  sheet.querySelector('#np-read').addEventListener('click', function () {
    var t = state.current && state.readTracks[state.current.episodeId];
    if (t && t.hasText && t.textUrl) openRead(t); // stacks over this sheet; closing Read returns here
  });
  var bar = sheet.querySelector('#np-seek');
  bar.addEventListener('input', function () {
    // The thumb follows the user's finger, not the player: the
    // scrubbing flag holds the timeupdate fill off until commit.
    npScrubbing = true;
    var dur = npDuration();
    if (dur > 0) {
      var pos = dur * Number(bar.value) / 1000;
      sheet.querySelector('#np-elapsed').textContent = fmtDur(pos);
      sheet.querySelector('#np-remain').textContent = '-' + fmtDur(Math.max(0, dur - pos));
    }
  });
  bar.addEventListener('change', function () {
    npScrubbing = false;
    var dur = audioEl.duration;
    if (isFinite(dur) && dur > 0) {
      var target = dur * Number(bar.value) / 1000;
      audioEl.currentTime = Math.max(0, Math.min(dur, target));
    }
    updateNpSeek();
  });
  updateNowPlaying();
}
function updateNowPlaying() {
  var sheet = document.querySelector('.np-sheet');
  if (!sheet) return;
  var cur = state.current;
  if (!cur) { sheet.remove(); return; }
  sheet.querySelector('#np-title').textContent = cur.title || '';
  var meta = cur.block || '';
  if (cur.source) meta = meta ? meta + ' · ' + cur.source : cur.source;
  if (!meta) meta = state.dateLabel || '';
  sheet.querySelector('#np-meta').textContent = meta;
  sheet.querySelector('#np-play').innerHTML = audioEl.paused ? '&#9654;' : '&#10073;&#10073;';
  sheet.querySelector('#np-prev').disabled = !state.queue.length || state.queueIdx <= 0;
  sheet.querySelector('#np-next').disabled = !state.queue.length;
  sheet.querySelector('#np-speed').textContent = state.rate + '×';
  sheet.querySelector('#np-sleep').textContent = sleepLabel();
  var rt = state.readTracks[cur.episodeId];
  sheet.querySelector('#np-read').style.display = (rt && rt.hasText && rt.textUrl) ? '' : 'none';
  updateNpSeek();
}
function updateNpSeek() {
  var sheet = document.querySelector('.np-sheet');
  if (!sheet || npScrubbing) return;
  var bar = sheet.querySelector('#np-seek');
  var dur = npDuration();
  var pos = audioEl.currentTime || 0;
  if (dur > 0) {
    bar.disabled = false;
    bar.value = String(Math.round(1000 * Math.min(pos, dur) / dur));
    sheet.querySelector('#np-elapsed').textContent = fmtDur(pos);
    sheet.querySelector('#np-remain').textContent = '-' + fmtDur(Math.max(0, dur - pos));
  } else {
    bar.disabled = true;
    bar.value = '0';
    sheet.querySelector('#np-elapsed').textContent = fmtDur(pos);
    sheet.querySelector('#np-remain').textContent = '--:--';
  }
}
/* ---------------- Externals at open (v334) ----------------
   The day renders from /api/player/day at once (own episodes only —
   the payload no longer carries stored externals); the nine
   external slots then resolve live, in place: Bible in a Year and
   Sing the Hours by direct feed reads in this client, Divine
   Office through the Worker courier (its feed forbids browser
   reads). Source settings are read at open and applied identically
   to every leg. Resolved present slots are kept in the device-local
   day cache (opn-ext-cache-v1): valid only for the same stored day
   and the same settings version; only present slots are written,
   so a missing slot re-checks on the next open. AMENDMENT A1
   (John, 2026-11-09 04:32 CT — "Download always so seeking can
   work"): a resolved slot DOWNLOADS its audio to the device
   (Cache Storage, opn-ext-audio-v1) and plays/seeks from the local
   copy — Divine Office and Bible in a Year download directly
   (their enclosure chains send Access-Control-Allow-Origin: * at
   every hop, probed at Implement); Sing the Hours' host sends no
   such header, so its fills download through the Worker
   pass-through, which keeps nothing. Invalidation discards the
   audio with the record. */
var EXT_SLOTS = [
  { slotId: 'ext-invitatory', title: 'Invitatory' },
  { slotId: 'ext-morning-prayer', title: 'Morning Prayer', fallbackToken: 'Lauds' },
  { slotId: 'ext-bible-in-a-year', title: null },
  { slotId: 'ext-midmorning-prayer', title: 'Midmorning Prayer' },
  { slotId: 'ext-midday-prayer', title: 'Midday Prayer' },
  { slotId: 'ext-midafternoon-prayer', title: 'Midafternoon Prayer' },
  { slotId: 'ext-office-of-readings', title: 'Office of Readings' },
  { slotId: 'ext-evening-prayer', title: 'Evening Prayer', fallbackToken: 'Vespers' },
  { slotId: 'ext-night-prayer', title: 'Night Prayer' }
];
var EXT_TOKENS = {
  'ext-invitatory': ['Invitatory', 'Invitatory Psalm'],
  'ext-morning-prayer': ['Morning Prayer'],
  'ext-midmorning-prayer': ['Midmorning Prayer'],
  'ext-midday-prayer': ['Midday Prayer'],
  'ext-midafternoon-prayer': ['Midafternoon Prayer'],
  'ext-office-of-readings': ['Office of Readings'],
  'ext-evening-prayer': ['Evening Prayer', 'Vespers'],
  'ext-night-prayer': ['Night Prayer', 'Compline']
};
var EXT_BIAY_URL = 'https://feeds.fireside.fm/bibleinayear/rss';
var EXT_STH_URL = 'https://feeds.castos.com/x8g54';
function extWeekdayMon0(dateStr) {
  var p = dateStr.split('-').map(Number);
  return (new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() + 6) % 7;
}
function extDayRulePasses(rule, wd) {
  if (rule === 'daily') return true;
  if (rule === 'weekdays') return wd < 5;
  if (rule === 'weekends') return wd >= 5;
  if (rule === 'sundays') return wd === 6;
  if (rule === 'fridays') return wd === 4;
  return false;
}
function extDayRuleFills(rule, wd) { return rule === 'fallback-only' ? true : extDayRulePasses(rule, wd); }
function extParseDuration(raw) {
  if (!raw) return 0;
  var t = String(raw).trim();
  if (t.indexOf(':') >= 0) {
    var secs = 0; var parts = t.split(':');
    for (var i = 0; i < parts.length; i++) secs = secs * 60 + Number(parts[i]);
    return isFinite(secs) ? Math.trunc(secs) : 0;
  }
  var v = Number(t);
  return isFinite(v) ? Math.trunc(v) : 0;
}
function extWs(t) {
  // Whitespace collapse with NO backslash escapes: this client
  // ships inside a template literal the bundler cooks once and the
  // browser cooks again, so a written escape class does not
  // survive to runtime (a single-escaped class lost its backslash
  // in the first v334 gate run and stripped letters from titles).
  // The estate's rule stands: no backslash patterns inside APP_JS.
  return String(t == null ? '' : t)
    .split(String.fromCharCode(10)).join(' ')
    .split(String.fromCharCode(13)).join(' ')
    .split(String.fromCharCode(9)).join(' ')
    .split(' ').filter(function (x) { return x.length > 0; }).join(' ');
}
function extParseFeed(text) {
  var doc = new DOMParser().parseFromString(text, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('feed parse failed');
  var items = [];
  doc.querySelectorAll('item').forEach(function (it) {
    var titleEl = it.querySelector('title');
    var enc = it.querySelector('enclosure');
    var pubEl = it.querySelector('pubDate');
    var durEl = it.getElementsByTagName('itunes:duration')[0] || null;
    var pubMs = pubEl ? Date.parse(pubEl.textContent.trim()) : NaN;
    items.push({
      title: extWs(titleEl ? titleEl.textContent : ''),
      url: enc ? (enc.getAttribute('url') || '') : '',
      length: enc && (enc.getAttribute('length') || '').trim() !== '' && !isNaN(Number(enc.getAttribute('length'))) ? Number(enc.getAttribute('length')) : 0,
      pubMs: isFinite(pubMs) ? pubMs : null,
      durationS: extParseDuration(durEl ? durEl.textContent : null)
    });
  });
  return items;
}
function extMatchBible(items, dateStr) {
  // The resolver's Bible matcher ported: Day N (day-of-year, capped
  // 365) + enclosure + current year only; newest pubDate wins.
  var p = dateStr.split('-').map(Number);
  var doy = Math.floor((Date.UTC(p[0], p[1] - 1, p[2]) - Date.UTC(p[0], 0, 0)) / 86400000);
  var n = doy > 365 ? 365 : doy;
  var BS = String.fromCharCode(92);
  var pat = new RegExp(BS + 'bDay' + BS + 's*0*' + n + BS + 'b', 'i');
  var best = null;
  items.forEach(function (it) {
    if (!it.url || !pat.test(it.title)) return;
    var years = it.title.match(new RegExp(BS + 'b(20' + BS + 'd{2})' + BS + 'b', 'g'));
    var year = years ? Math.max.apply(null, years.map(Number)) : (it.pubMs != null ? new Date(it.pubMs).getUTCFullYear() : null);
    if (year !== p[0]) return;
    if (!best || (it.pubMs || -Infinity) > (best.pubMs || -Infinity)) best = it;
  });
  return { item: best, dayN: n };
}
function extBibleTitle(item, n) {
  // The resolver's strip via string operations only (no regex —
  // see the extWs note): drop the leading "Day N:" segment and a
  // trailing "(YYYY)".
  var base = 'Bible in a Year — Day ' + n;
  if (!item) return base;
  var t = item.title;
  var colon = t.indexOf(':');
  var sub = (t.indexOf('Day') === 0 && colon > 0) ? t.slice(colon + 1).trim() : t;
  if (sub.endsWith(')') && sub.lastIndexOf('(') > 0) sub = sub.slice(0, sub.lastIndexOf('(')).trim();
  return sub ? base + ': ' + sub : base;
}
function extMatchSth(items, dateStr, token) {
  var p = dateStr.split('-').map(Number);
  var prefix = p[1] + '.' + p[2] + '.' + String(p[0]).slice(2);
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (it.url && it.title.indexOf(prefix) >= 0 && it.title.toLowerCase().indexOf(token.toLowerCase()) >= 0) return it;
  }
  return null;
}
function extFetchText(url) {
  var ctl = new AbortController();
  var timer = setTimeout(function () { ctl.abort(); }, 8000);
  return fetch(url, { signal: ctl.signal }).then(function (r) {
    clearTimeout(timer);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  }).catch(function (e) { clearTimeout(timer); throw e; });
}
function extCacheRead() {
  try {
    var raw = localStorage.getItem('opn-ext-cache-v1');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function extCacheWrite(rec) {
  try { localStorage.setItem('opn-ext-cache-v1', JSON.stringify(rec)); } catch (e) { /* degrades to session memory (§2.4) */ }
}
function extDiscardCaches() {
  try { localStorage.removeItem('opn-ext-cache-v1'); } catch (e) {}
  if ('caches' in window) { caches.delete('opn-ext-audio-v1').catch(function () {}); }
}
function extDownloadingCard(slot) {
  return '<div class="card" data-card="' + esc(slot.slotId) + '"><h3>' + esc(slot.title || 'Bible in a Year') + '</h3><div class="meta">Downloading&hellip;</div></div>';
}
function extPlaceholderCard(slot) {
  return '<div class="card" data-card="' + esc(slot.slotId) + '"><h3>' + esc(slot.title || 'Bible in a Year') + '</h3><div class="meta">Loading&hellip;</div></div>';
}
function extSlotTrack(slot, st) {
  return {
    episodeId: slot.slotId, title: st.title, kind: 'external', source: st.source,
    available: st.state === 'present', streamUrl: st.state === 'present' ? st.streamUrl : null,
    durationS: st.durationSec || 0, sizeBytes: st.sizeBytes || 0, hasText: false, textUrl: null, _block: slot.block
  };
}
function extSwapCard(slot) {
  var st = state.extSlots[slot.slotId];
  var old = view.querySelector('[data-card="' + slot.slotId + '"]');
  if (!old || !st) return;
  var tmp = document.createElement('div');
  tmp.innerHTML = st.state === 'downloading' ? extDownloadingCard(slot) : (st.state === 'loading' ? extPlaceholderCard(slot) : trackCard(extSlotTrack(slot, st)));
  var fresh = tmp.firstChild;
  old.replaceWith(fresh);
  var btn = fresh.querySelector('[data-playkey]');
  if (btn) btn.addEventListener('click', function () {
    var d = (state.dayDescs || []).filter(function (x) { return x.episodeId === slot.slotId; })[0];
    if (d) playTrack(d);
  });
  if (state.current && state.current.episodeId === slot.slotId) markPlaying(slot.slotId);
}
function extInsertCards(day, standing) {
  // Placeholders (or cached cards) stand after the block's own
  // tracks, in settings sort order within the block. Block sections
  // are flat siblings: blockhead, then its cards, then the next
  // blockhead — insertion goes before the next blockhead (or before
  // the unblocked heading / at the end).
  var heads = view.querySelectorAll('.blockhead');
  (day.blocks || []).forEach(function (b, bi) {
    var mine = standing.filter(function (s) { return s.block === b.block; })
      .sort(function (a, c) { return (a.sortOrder || 0) - (c.sortOrder || 0); });
    if (!mine.length || !heads[bi]) return;
    var anchor = heads[bi + 1] || null;
    if (!anchor) {
      var h2s = view.querySelectorAll('h2');
      for (var i = 0; i < h2s.length; i++) { if (h2s[i].textContent.indexOf('FROM TODAY') === 0) { anchor = h2s[i]; break; } }
    }
    mine.forEach(function (slot) {
      var st = state.extSlots[slot.slotId];
      var tmp = document.createElement('div');
      tmp.innerHTML = st && st.state === 'present' ? trackCard(extSlotTrack(slot, st)) : extPlaceholderCard(slot);
      var el = tmp.firstChild;
      view.insertBefore(el, anchor);
      var btn = el.querySelector('[data-playkey]');
      if (btn) btn.addEventListener('click', function () {
        var d = (state.dayDescs || []).filter(function (x) { return x.episodeId === slot.slotId; })[0];
        if (d) playTrack(d);
      });
    });
  });
}
function extRebuildDescs(day) {
  // The queue rule (§2.5): descriptors are built from what stands
  // resolved at tap time — own tracks in payload order, each
  // block's resolved externals after its own tracks.
  var descs = [];
  (day.blocks || []).forEach(function (b) {
    (b.tracks || []).forEach(function (t) { descs.push(trackDesc(Object.assign({}, t, { _block: b.block }))); });
    (state.extStanding || []).filter(function (s) { return s.block === b.block; })
      .sort(function (a, c) { return (a.sortOrder || 0) - (c.sortOrder || 0); })
      .forEach(function (slot) {
        var st = state.extSlots[slot.slotId];
        if (st) descs.push(trackDesc(extSlotTrack(slot, st)));
      });
  });
  (day.episodes || []).forEach(function (t) { descs.push(trackDesc(t)); });
  state.dayDescs = descs;
  return descs;
}
function resolveExternals(day) {
  var date = day.storedDay || day.date;
  if (!date) return;
  state.extSlots = {};
  state.extStanding = [];
  api('/api/player/source-settings').then(function (settings) {
    var wd = extWeekdayMon0(date);
    var prim = {}, fb = {};
    (settings.sources || []).forEach(function (s) {
      if (s.family !== 'external' || !s.slotId) return;
      if (s.role === 'fallback') fb[s.slotId] = s; else prim[s.slotId] = s;
    });
    var standing = [];
    EXT_SLOTS.forEach(function (s) {
      var row = prim[s.slotId];
      if (!row || row.enabled !== 1 || !extDayRulePasses(row.dayRule || 'daily', wd)) return;
      standing.push({ slotId: s.slotId, title: s.title, fallbackToken: s.fallbackToken, block: row.block || 'Morning', sortOrder: row.sortOrder, fbRow: fb[s.slotId] || null });
    });
    state.extStanding = standing;
    // Day cache: valid only for this date AND this settings version.
    var cache = extCacheRead();
    var cacheValid = !!cache && cache.date === date && cache.settingsVersion === settings.version && cache.slots;
    if (cache && !cacheValid) { extDiscardCaches(); cache = null; }
    var rec = cacheValid ? cache : { date: date, settingsVersion: settings.version, savedAt: new Date().toISOString(), slots: {} };
    standing.forEach(function (slot) {
      var c = cacheValid ? rec.slots[slot.slotId] : null;
      if (c && c.state === 'present') {
        state.extSlots[slot.slotId] = { state: 'downloading', title: c.title, enclosureUrl: c.streamUrl, durationSec: c.durationSec, sizeBytes: c.sizeBytes, source: c.source };
      } else {
        state.extSlots[slot.slotId] = { state: 'loading', title: slot.title || 'Bible in a Year' };
      }
    });
    extInsertCards(day, standing);
    extRebuildDescs(day);
    var writeCache = function () {
      standing.forEach(function (slot) {
        var st = state.extSlots[slot.slotId];
        if (st && st.state === 'present') {
          rec.slots[slot.slotId] = { state: 'present', title: st.title, streamUrl: st.enclosureUrl || st.streamUrl, durationSec: st.durationSec, sizeBytes: st.sizeBytes, source: st.source, block: slot.block, sortOrder: slot.sortOrder };
        }
      });
      rec.savedAt = new Date().toISOString();
      extCacheWrite(rec);
    };
    var settle = function (slot, st) {
      state.extSlots[slot.slotId] = st;
      extSwapCard(slot);
      extRebuildDescs(day);
      writeCache();
    };
    var extDownload = function (slot, meta) {
      // Amendment A1 routes: direct from the enclosure host where
      // its chain allows the read (Divine Office, Bible in a Year);
      // the Worker pass-through where it does not (Sing the Hours).
      // Any failure in a route's whole chain (fetch, body read, or
      // cache write) retries once on the other route: a download
      // that starts before the service worker claims the page can
      // have its stream torn by the claim, and the retry — issued
      // after the claim settles — is the heal. The body is
      // materialized to a Blob BEFORE the cache write, so no
      // stream clone is ever raced.
      var passthrough = '/api/player/externals/audio?date=' + encodeURIComponent(date) + '&slot=' + encodeURIComponent(slot.slotId);
      var routes = meta.source === 'Sing the Hours' ? [passthrough, meta.enclosureUrl] : [meta.enclosureUrl, passthrough];
      var tryRoute = function (u) {
        return fetch(u).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.blob();
        }).then(function (blob) {
          var put = ('caches' in window)
            ? caches.open('opn-ext-audio-v1').then(function (c) {
                return c.put(slot.slotId, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } }));
              }).catch(function () {})
            : Promise.resolve();
          return put.then(function () { return blob; });
        });
      };
      tryRoute(routes[0]).catch(function () { return tryRoute(routes[1]); }).then(function (blob) {
        settle(slot, { state: 'present', title: meta.title, streamUrl: URL.createObjectURL(blob), enclosureUrl: meta.enclosureUrl, durationSec: meta.durationSec, sizeBytes: meta.sizeBytes, source: meta.source });
      }).catch(function () {
        settle(slot, { state: 'missing', title: meta.title, source: meta.source });
      });
    };
    var settleMeta = function (slot, meta) {
      var cur = state.extSlots[slot.slotId];
      if (cur && cur.state === 'present' && cur.enclosureUrl === meta.enclosureUrl) return;
      state.extSlots[slot.slotId] = { state: 'downloading', title: meta.title, enclosureUrl: meta.enclosureUrl, durationSec: meta.durationSec, sizeBytes: meta.sizeBytes, source: meta.source };
      extSwapCard(slot);
      extRebuildDescs(day);
      extDownload(slot, meta);
    };
    var extRestoreCached = function (slot) {
      var c = rec.slots[slot.slotId];
      var meta = { title: c.title, enclosureUrl: c.streamUrl, durationSec: c.durationSec, sizeBytes: c.sizeBytes, source: c.source };
      if (!('caches' in window)) { extDownload(slot, meta); return; }
      // A cache read issued in the same moment the service worker
      // is settling a fresh page can stall without ever settling;
      // the fallback timer turns a stalled read into a re-download
      // (the download path is independent of the read).
      var done = false;
      var fallback = setTimeout(function () { if (!done) { done = true; extDownload(slot, meta); } }, 3000);
      caches.open('opn-ext-audio-v1').then(function (cache) { return cache.match(slot.slotId); }).then(function (resp) {
        if (done) return;
        if (!resp) { done = true; clearTimeout(fallback); extDownload(slot, meta); return; }
        resp.blob().then(function (blob) {
          if (done) return;
          done = true; clearTimeout(fallback);
          settle(slot, { state: 'present', title: meta.title, streamUrl: URL.createObjectURL(blob), enclosureUrl: meta.enclosureUrl, durationSec: meta.durationSec, sizeBytes: meta.sizeBytes, source: meta.source });
        });
      }).catch(function () { if (!done) { done = true; clearTimeout(fallback); extDownload(slot, meta); } });
    };
    // The restore starts only here — after extRestoreCached is
    // assigned. (Rework 2026-11-09: this loop previously stood
    // before the assignment; on a re-open with a valid day cache
    // every slot stands 'downloading', the call threw, the outer
    // catch swallowed it, and the courier/Bible/watchdog legs
    // never started — legs 3-4 of harness-v334.)
    standing.forEach(function (slot) {
      if (state.extSlots[slot.slotId].state === 'downloading') extRestoreCached(slot);
    });
    var missingSt = function (slot, source) {
      return { state: 'missing', title: slot.slotId === 'ext-bible-in-a-year' ? extBibleTitle(null, extMatchBibleDayN(date)) : slot.title, source: source || 'Divine Office' };
    };
    var cachedIds = {};
    if (cacheValid) Object.keys(rec.slots || {}).forEach(function (k) { if (rec.slots[k].state === 'present') cachedIds[k] = rec.slots[k]; });
    var uncached = function (slot) { return !cachedIds[slot.slotId]; };
    var doSlots = standing.filter(function (s) { return s.slotId !== 'ext-bible-in-a-year'; });
    var bibleSlot = standing.filter(function (s) { return s.slotId === 'ext-bible-in-a-year'; })[0];
    // Courier leg (Divine Office) — only if some DO slot is not
    // carried by the day cache (§2.8 leg 3: a fully cached source
    // issues no network work). When it does run, a cached slot
    // whose enclosure the courier confirms is left to the cache
    // restore; a cached slot the courier contradicts is re-settled
    // from the courier's word.
    var courierP;
    if (doSlots.some(uncached)) {
      courierP = api('/api/player/externals/live?date=' + encodeURIComponent(date)).then(function (res) {
        var byId = {};
        (res.slots || []).forEach(function (e) { byId[e.slotId] = e; });
        doSlots.forEach(function (slot) {
          var e = byId[slot.slotId];
          var c = cachedIds[slot.slotId];
          if (e && e.state === 'present') {
            if (c && c.streamUrl === e.streamUrl) return; // the cache restore owns this slot
            settleMeta(slot, { title: e.title, enclosureUrl: e.streamUrl, durationSec: e.durationSec, sizeBytes: e.sizeBytes, source: 'Divine Office' });
          } else if (e) {
            if (c) return; // cache stands over a same-open courier miss (§2.4: the record stands for the day)
            settle(slot, missingSt(slot, 'Divine Office'));
          } else if (uncached(slot)) {
            settle(slot, missingSt(slot, 'Divine Office'));
          }
        });
      }).catch(function () {
        doSlots.forEach(function (slot) { if (uncached(slot)) settle(slot, missingSt(slot, 'Divine Office')); });
      });
    } else {
      courierP = Promise.resolve();
    }
    // Bible in a Year direct leg.
    if (bibleSlot && uncached(bibleSlot)) {
      extFetchText(EXT_BIAY_URL).then(function (text) {
        var m = extMatchBible(extParseFeed(text), date);
        if (m.item) settleMeta(bibleSlot, { title: extBibleTitle(m.item, m.dayN), enclosureUrl: m.item.url, durationSec: m.item.durationS, sizeBytes: m.item.length, source: 'Bible in a Year' });
        else settle(bibleSlot, { state: 'missing', title: extBibleTitle(null, m.dayN), source: 'Bible in a Year' });
      }).catch(function () { settle(bibleSlot, { state: 'missing', title: extBibleTitle(null, extMatchBibleDayN(date)), source: 'Bible in a Year' }); });
    }
    // Resolve watchdog: no slot may spin forever. A leg or restore
    // that has produced nothing after 9 s is treated as failed —
    // a cached slot re-downloads from its recorded enclosure, an
    // uncached slot stands named missing for this open.
    setTimeout(function () {
      standing.forEach(function (slot) {
        var st = state.extSlots[slot.slotId];
        if (!st || (st.state !== 'loading' && st.state !== 'downloading')) return;
        var c = cachedIds[slot.slotId];
        if (c) extDownload(slot, { title: c.title, enclosureUrl: c.streamUrl, durationSec: c.durationSec, sizeBytes: c.sizeBytes, source: c.source });
        else settle(slot, missingSt(slot, slot.slotId === 'ext-bible-in-a-year' ? 'Bible in a Year' : 'Divine Office'));
      });
    }, 9000);
    // Sing the Hours fallback — only after the courier settles, and
    // only for a Morning/Evening primary that stands missing.
    courierP.then(function () {
      var need = standing.filter(function (s) {
        return s.fallbackToken && s.fbRow && s.fbRow.enabled === 1 && extDayRuleFills(s.fbRow.dayRule || 'daily', wd)
          && state.extSlots[s.slotId] && state.extSlots[s.slotId].state === 'missing';
      });
      if (!need.length) return;
      extFetchText(EXT_STH_URL).then(function (text) {
        var items = extParseFeed(text);
        need.forEach(function (slot) {
          var it = extMatchSth(items, date, slot.fallbackToken);
          if (it) settleMeta(slot, { title: slot.title, enclosureUrl: it.url, durationSec: it.durationS, sizeBytes: it.length, source: 'Sing the Hours' });
        });
      }).catch(function () { /* the slots stand named missing */ });
    });
  }).catch(function () { /* settings read failed: own episodes stand; no external slots stand this open */ });
}
function extMatchBibleDayN(dateStr) {
  var p = dateStr.split('-').map(Number);
  var doy = Math.floor((Date.UTC(p[0], p[1] - 1, p[2]) - Date.UTC(p[0], 0, 0)) / 86400000);
  return doy > 365 ? 365 : doy;
}

function renderPrayers() {
  view.innerHTML = '<h1 class="screen">Listen</h1><p class="sub">the day&rsquo;s prayers</p><p class="meta">Loading...</p>';
  api('/api/player/day').then(function (day) {
    state.storedDay = day.storedDay || day.date || null;
    state.dateLabel = day.dateLabel || '';
    // The whole-day queue, built once from payload order: block order,
    // then push order inside the block, then the unblocked group.
    var allDescs = [];
    (day.blocks || []).forEach(function (b) {
      (b.tracks || []).forEach(function (t) { var tt = Object.assign({}, t, { _block: b.block }); allDescs.push(trackDesc(tt)); });
    });
    (day.episodes || []).forEach(function (t) { allDescs.push(trackDesc(t)); });
    // v318 T9: the Read view's lookup — payload tracks by episode id,
    // and the day's descriptors for its play/pause control.
    state.dayDescs = allDescs;
    state.readTracks = {};
    (day.blocks || []).forEach(function (b) { (b.tracks || []).forEach(function (t) { if (t.episodeId) state.readTracks[t.episodeId] = t; }); });
    (day.episodes || []).forEach(function (t) { if (t.episodeId) state.readTracks[t.episodeId] = t; });
    var resumeRec = readResume();
    if (resumeRec && resumeRec.date !== state.storedDay) {
      try { localStorage.removeItem('opn-resume-v312'); } catch (e) {}
      resumeRec = null;
    }
    var resumeDesc = resumeRec ? allDescs.filter(function (d) { return d.episodeId === resumeRec.episodeId && d.available; })[0] : null;
    var html = '<h1 class="screen">Listen</h1><p class="sub">' + esc(day.dateLabel || 'the day&rsquo;s prayers') + '</p>';
    html += '<div class="row"><button class="btn gold" id="play-all">Play All</button><span class="meta grow">the whole day, in order</span><button class="btn ghost" id="sleep-btn">' + esc(sleepLabel()) + '</button></div>';
    if (resumeDesc) {
      html += '<div class="card"><div class="row"><div class="grow"><h3>Resume</h3><div class="meta">' + esc(resumeDesc.title) + ' · at ' + fmtDur(resumeRec.positionS) + '</div></div><button class="btn ghost small" id="resume-btn">Resume</button></div></div>';
    }
    (day.blocks || []).forEach(function (b) {
      html += '<div class="blockhead"><h2>' + esc((b.label || b.block).toUpperCase()) + '</h2><span class="meta grow">' + esc(b.caption || '') + ' · ' + (b.trackCount != null ? b.trackCount : (b.tracks || []).length) + ' tracks</span>'
        + (b.spotifyUrl ? '<a class="spot" target="_blank" rel="noopener" href="' + esc(b.spotifyUrl) + '">Open in Spotify</a>' : '')
        + '<button class="playbtn" data-queue="' + esc(b.block) + '">&#9654;</button></div>';
      html += (b.tracks || []).map(function (t) { return trackCard(Object.assign({}, t, { _block: b.block })); }).join('');
    });
    if ((day.episodes || []).length) {
      html += '<h2 style="color:var(--navy);font-weight:normal;letter-spacing:1px;font-size:16px;margin:16px 0 8px">FROM TODAY&rsquo;S PODCAST</h2>';
      html += day.episodes.map(trackCard).join('');
    }
    view.innerHTML = html;
    document.getElementById('play-all').addEventListener('click', function () { startQueue(extRebuildDescs(day)); });
    document.getElementById('sleep-btn').addEventListener('click', openSleepSheet);
    var rb = document.getElementById('resume-btn');
    if (rb && resumeDesc) rb.addEventListener('click', function () { loadResume(resumeDesc, resumeRec.positionS || 0); });
    if (resumeDesc) {
      var card = view.querySelector('[data-card="' + resumeDesc.episodeId + '"] .grow');
      // The matching card itself carries the Resume affordance (E5).
      var host = view.querySelector('[data-card="' + resumeDesc.episodeId + '"]');
      if (host) {
        var btn = document.createElement('button');
        btn.className = 'btn ghost small'; btn.textContent = 'Resume at ' + fmtDur(resumeRec.positionS);
        btn.addEventListener('click', function () { loadResume(resumeDesc, resumeRec.positionS || 0); });
        host.appendChild(btn);
      }
    }
    view.querySelectorAll('[data-playkey]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var d = allDescs.filter(function (x) { return x.episodeId === btn.getAttribute('data-playkey'); })[0];
        if (d) playTrack(d);
      });
    });
    view.querySelectorAll('[data-read]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = state.readTracks[btn.getAttribute('data-read')];
        if (t) openRead(t);
      });
    });
    view.querySelectorAll('[data-queue]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var blockName = btn.getAttribute('data-queue');
        var descs = extRebuildDescs(day).filter(function (d) { return d.block === blockName; });
        startQueue(descs);
      });
    });
    if (state.current) markPlaying(state.current.episodeId);
    // v334: externals resolve at open, in place, after the day has
    // rendered — the resolve never blocks the day's own episodes.
    resolveExternals(day);
  }).catch(function (e) { view.innerHTML = '<p class="err">' + esc(e.message) + '</p>'; });
}

/* ---------------- Examination ---------------- */
function renderExamination() {
  view.innerHTML = '<h1 class="screen">Tonight&rsquo;s examination</h1><p class="meta">Loading...</p>';
  api('/api/exam/today').then(function (data) {
    var run = data.run;
    var closed = run && run.state === 'closed';
    var cats = data.categories || [];
    if (!state.examCat || cats.indexOf(state.examCat) < 0) state.examCat = data.focusCategory || cats[0];
    var prompts = (data.prompts || []).filter(function (p) { return p.category === state.examCat; });
    var entriesByPrompt = {};
    (data.entries || []).forEach(function (e) { if (e.prompt_id) { (entriesByPrompt[e.prompt_id] = entriesByPrompt[e.prompt_id] || []).push(e); } });
    var customs = (data.entries || []).filter(function (e) { return !e.prompt_id && e.category === state.examCat; });
    var html = '<div class="row"><div class="grow"><h1 class="screen">Tonight&rsquo;s examination</h1><p class="sub">' + esc(data.dateLabel || data.date) + '</p></div><button class="btn ghost small" id="ex-gear">Prompts</button></div>';
    html += '<p class="sub">Begin with gratitude for the day, and a short review of it. Then take the questions as reflection prompts — tap one to write an entry in your own words. What you write flows to Confession preparation.</p>';
    if (data.focusCategory) html += '<p class="meta">Tonight&rsquo;s focus in depth: <b>' + esc(data.focusCategory) + '</b> — the full short form stands every night.</p>';
    html += '<div class="chips">' + cats.map(function (c) { return '<button class="chip' + (c === state.examCat ? ' active' : '') + '" data-cat="' + esc(c) + '">' + esc(c.replace('Commandment ', '')) + '</button>'; }).join('') + '</div>';
    html += '<div class="modes"><button id="m-quick" class="' + (state.examMode === 'quick' ? 'active' : '') + '">Quick Review</button><button id="m-deep" class="' + (state.examMode === 'deep' ? 'active' : '') + '">Deep Reflection</button></div>';
    html += '<h2 style="color:var(--navy);font-weight:normal;font-size:17px;margin:4px 0 8px">' + esc(state.examCat) + '</h2>';
    var dis = closed ? ' disabled' : '';
    if (state.examMode === 'deep') {
      if (state.deepIdx >= prompts.length) state.deepIdx = 0;
      var p = prompts[state.deepIdx];
      if (p) {
        html += '<div class="card prompt" data-prompt="' + p.id + '"><div class="ptext">' + esc(p.text) + '</div><div class="meta" style="margin-top:6px">Tap to write an entry in your own words</div>' + entriesHtml(entriesByPrompt[p.id]) + entryFieldHtml(p, closed) + '</div>';
        html += '<div class="row"><button class="btn ghost" id="deep-prev"' + (state.deepIdx === 0 ? ' disabled' : '') + '>&#8249; Back</button><span class="meta grow" style="text-align:center">' + (state.deepIdx + 1) + ' of ' + prompts.length + '</span><button class="btn ghost" id="deep-next"' + (state.deepIdx + 1 >= prompts.length ? ' disabled' : '') + '>Next &#8250;</button></div>';
      } else html += '<p class="meta">No prompts in this category.</p>';
    } else {
      html += prompts.map(function (p) {
        return '<div class="card prompt" data-prompt="' + p.id + '"><div class="ptext">' + esc(p.text) + '</div>' + entriesHtml(entriesByPrompt[p.id]) + entryFieldHtml(p, closed) + '</div>';
      }).join('');
    }
    html += '<div class="card"><h3>Add your own — ' + esc(state.examCat) + '</h3>' + (closed ? '<p class="meta">This run is closed.</p>' : '<textarea id="custom-text" placeholder="In your own words..."></textarea><div style="margin-top:8px"><button class="btn gold" id="custom-add">Add entry</button></div>') + customs.map(function (e) { return entryHtml(e); }).join('') + '</div>';
    html += '<div class="card"><h3>Anything else</h3><p class="meta">Close the night: anything that weighs on you, and a resolution for tomorrow.</p>' + (closed ? '' : '<textarea id="free-text" placeholder="In your own words..."></textarea><div style="margin-top:8px"><button class="btn gold" id="free-add">Add entry</button></div>') + (data.entries || []).filter(function (e) { return e.category === 'Anything else'; }).map(function (e) { return entryHtml(e); }).join('') + '</div>';
    if (!closed) html += '<button class="btn" id="run-close" style="width:100%">Close tonight&rsquo;s examination</button>';
    else html += '<p class="meta">Tonight&rsquo;s run is closed. Its entries stand in Confession preparation.</p>';
    html += '<p class="about">Examination of conscience after Fr. F. X. Lasance, My Prayer Book (Benziger Brothers, 1908; public domain), pp. 347-349 — seeded verbatim; every prompt is editable (Prompts, above). Entries are never read by any job and never leave this app.</p>';
    view.innerHTML = html;
    wireExamination(data);
  }).catch(function (e) { view.innerHTML = '<p class="err">' + esc(e.message) + '</p>'; });
}
function entriesHtml(list) { return (list || []).map(entryHtml).join(''); }
function entryHtml(e) { return '<div class="entry">' + esc(e.text) + '<div class="meta">' + esc((e.created_at || '').slice(11, 16)) + ' <a href="#" data-del-entry="' + e.id + '">remove</a></div></div>'; }
function entryFieldHtml(p, closed) {
  if (closed) return '';
  return '<div class="entryform hidden" id="ef-' + p.id + '"><textarea id="et-' + p.id + '" placeholder="In your own words..."></textarea><div style="margin-top:6px"><button class="btn gold small" data-save-entry="' + p.id + '">Save entry</button></div></div>';
}
function wireExamination(data) {
  var run = data.run;
  view.querySelectorAll('[data-cat]').forEach(function (b) { b.addEventListener('click', function () { state.examCat = b.getAttribute('data-cat'); state.deepIdx = 0; renderExamination(); }); });
  var q = document.getElementById('m-quick'), d = document.getElementById('m-deep');
  if (q) q.addEventListener('click', function () { state.examMode = 'quick'; renderExamination(); });
  if (d) d.addEventListener('click', function () { state.examMode = 'deep'; state.deepIdx = 0; renderExamination(); });
  var pv = document.getElementById('deep-prev'), nx = document.getElementById('deep-next');
  if (pv) pv.addEventListener('click', function () { state.deepIdx--; renderExamination(); });
  if (nx) nx.addEventListener('click', function () { state.deepIdx++; renderExamination(); });
  view.querySelectorAll('.prompt').forEach(function (card) {
    card.addEventListener('click', function (ev) {
      if (ev.target.tagName === 'TEXTAREA' || ev.target.tagName === 'BUTTON' || ev.target.tagName === 'A') return;
      var f = card.querySelector('.entryform'); if (f) f.classList.toggle('hidden');
    });
  });
  view.querySelectorAll('[data-save-entry]').forEach(function (b) {
    b.addEventListener('click', function () {
      var pid = Number(b.getAttribute('data-save-entry'));
      var text = document.getElementById('et-' + pid).value.trim(); if (!text) return;
      var prompt = (data.prompts || []).filter(function (p) { return p.id === pid; })[0];
      post('/api/exam/entries', { runId: run.id, promptId: pid, category: prompt.category, text: text }).then(renderExamination);
    });
  });
  var ca = document.getElementById('custom-add');
  if (ca) ca.addEventListener('click', function () {
    var text = document.getElementById('custom-text').value.trim(); if (!text) return;
    post('/api/exam/entries', { runId: run.id, promptId: null, category: state.examCat, text: text }).then(renderExamination);
  });
  var fa = document.getElementById('free-add');
  if (fa) fa.addEventListener('click', function () {
    var text = document.getElementById('free-text').value.trim(); if (!text) return;
    post('/api/exam/entries', { runId: run.id, promptId: null, category: 'Anything else', text: text }).then(renderExamination);
  });
  view.querySelectorAll('[data-del-entry]').forEach(function (a) {
    a.addEventListener('click', function (ev) { ev.preventDefault(); api('/api/exam/entries/' + a.getAttribute('data-del-entry'), { method: 'DELETE' }).then(renderExamination); });
  });
  var rc = document.getElementById('run-close');
  if (rc) rc.addEventListener('click', function () { if (confirm('Close the examination for tonight?')) post('/api/exam/runs/' + run.id + '/close', {}).then(renderExamination); });
  var gear = document.getElementById('ex-gear');
  if (gear) gear.addEventListener('click', function () { openPromptsEditor(data.prompts || []); });
}
function openPromptsEditor(prompts) {
  var sheet = document.createElement('div'); sheet.className = 'sheet';
  var rows = prompts.map(function (p) {
    return '<label class="f">' + esc(p.category) + '</label><textarea data-prompt-edit="' + p.id + '">' + esc(p.text) + '</textarea>';
  }).join('');
  sheet.innerHTML = '<div class="inner"><div class="row"><h1 class="screen grow">Examination prompts</h1><button class="btn ghost" id="pe-close">Close</button></div><p class="meta">Seeded verbatim from Lasance, My Prayer Book (1908). Edit any prompt in your own words; the seed source stays on the record.</p>' + rows + '<div style="margin-top:14px"><button class="btn gold" id="pe-save">Save prompts</button></div></div>';
  document.body.appendChild(sheet);
  sheet.querySelector('#pe-close').addEventListener('click', function () { sheet.remove(); });
  sheet.querySelector('#pe-save').addEventListener('click', function () {
    var updates = []; sheet.querySelectorAll('[data-prompt-edit]').forEach(function (t) { updates.push({ id: Number(t.getAttribute('data-prompt-edit')), text: t.value }); });
    api('/api/exam/prompts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompts: updates }) }).then(function () { sheet.remove(); renderExamination(); });
  });
}

/* ---------------- Confession ---------------- */
function renderConfession() {
  view.innerHTML = '<h1 class="screen">Confession</h1><p class="meta">Loading...</p>';
  api('/api/confession').then(function (c) {
    var html = '<div class="row"><div class="grow"><h1 class="screen">Confession</h1><p class="sub">preparation and guide</p></div><button class="btn ghost small" id="cf-gear">Guide</button></div>';
    html += '<div class="card"><h3>' + esc(c.elapsed || '') + '</h3>' + (c.lastConfession ? '<p class="meta">Last confession: ' + esc(c.lastConfession.date) + (c.lastConfession.note ? ' — ' + esc(c.lastConfession.note) : '') + '</p>' : '<p class="meta">No confession recorded yet in this app.</p>') + '</div>';
    html += '<h2 style="color:var(--navy);font-weight:normal;letter-spacing:1px;font-size:16px;margin:16px 0 8px">THE GUIDE</h2>';
    html += (c.guide || []).map(function (g) { return '<div class="card"><h3>' + g.step_no + ' · ' + esc(g.title) + '</h3><p style="margin:0;line-height:1.55;font-size:15px">' + esc(g.body) + '</p></div>'; }).join('');
    var pen = c.penance;
    html += '<h2 style="color:var(--navy);font-weight:normal;letter-spacing:1px;font-size:16px;margin:16px 0 8px">PENANCE</h2>';
    if (pen && pen.text && !pen.done_at) {
      html += '<div class="card"><h3>Your penance</h3><p style="margin:0 0 8px;line-height:1.55;font-size:15px">' + esc(pen.text) + '</p><button class="btn gold" id="pen-done">Penance complete</button></div>';
    } else if (pen && pen.text && pen.done_at) {
      html += '<div class="card"><p class="meta">The penance from ' + esc(pen.date) + ' is complete.</p></div>';
    } else {
      html += '<div class="card"><p class="meta">No penance stands open. After your next confession, record the penance here.</p><label class="f">Penance given</label><textarea id="pen-text" placeholder="The penance the priest assigned..."></textarea><div style="margin-top:8px"><button class="btn" id="pen-save">Save penance</button></div></div>';
    }
    html += '<h2 style="color:var(--navy);font-weight:normal;letter-spacing:1px;font-size:16px;margin:16px 0 8px">PREPARATION — SINCE YOUR LAST CONFESSION</h2>';
    var total = 0; (c.prep || []).forEach(function (g) { total += g.entries.length; });
    if (!total) html += '<p class="meta">Nothing stands in the preparation list. Entries from your nightly examinations gather here.</p>';
    html += (c.prep || []).map(function (g) {
      return '<div class="card"><h3>' + esc(g.category) + ' <span class="count">' + g.entries.length + (g.entries.length === 1 ? ' entry' : ' entries') + (g.repeatPrompts ? ' · ' + g.repeatPrompts + ' repeated' : '') + '</span></h3>' + g.entries.map(function (e) { return '<div class="entry">' + esc(e.text) + '<div class="meta">' + esc(e.date) + '</div></div>'; }).join('') + '</div>';
    }).join('');
    html += '<div class="card"><h3>Confession made</h3><label class="f">Date</label><input type="date" id="cf-date" value="' + todayChicago() + '"><label class="f">Note (optional)</label><input type="text" id="cf-note" placeholder=""><div style="margin-top:10px"><button class="btn gold" id="cf-made">Confession made</button></div><p class="meta" style="margin-top:8px">The preparation list closes under this record and starts empty. Nothing is deleted; the history below keeps every record.</p></div>';
    if ((c.history || []).length) {
      html += '<h2 style="color:var(--navy);font-weight:normal;letter-spacing:1px;font-size:16px;margin:16px 0 8px">HISTORY</h2>';
      html += c.history.map(function (h) { return '<div class="card"><div class="row"><div class="grow"><h3>' + esc(h.date) + '</h3><div class="meta">' + (h.note ? esc(h.note) + ' · ' : '') + h.entryCount + (h.entryCount === 1 ? ' entry' : ' entries') + (h.penance_text ? ' · penance recorded' : '') + '</div></div></div></div>'; }).join('');
    }
    html += '<p class="about">This app prepares for confession; it does not record the sacrament&rsquo;s ministry. Examination entries are never read by any job and never leave this app.</p>';
    view.innerHTML = html;
    var pd = document.getElementById('pen-done');
    if (pd) pd.addEventListener('click', function () { post('/api/confession/penance/done', {}).then(renderConfession); });
    var ps = document.getElementById('pen-save');
    if (ps) ps.addEventListener('click', function () { var t = document.getElementById('pen-text').value.trim(); if (t) post('/api/confession/penance', { text: t }).then(renderConfession); });
    document.getElementById('cf-made').addEventListener('click', function () {
      var date = document.getElementById('cf-date').value; var note = document.getElementById('cf-note').value.trim();
      if (!date) return;
      if (confirm('Close the preparation list under a confession on ' + date + '?')) post('/api/confession/made', { date: date, note: note }).then(renderConfession);
    });
    document.getElementById('cf-gear').addEventListener('click', function () { openGuideEditor(c.guide || []); });
  }).catch(function (e) { view.innerHTML = '<p class="err">' + esc(e.message) + '</p>'; });
}
function openGuideEditor(guide) {
  var sheet = document.createElement('div'); sheet.className = 'sheet';
  var rows = guide.map(function (g) {
    return '<label class="f">Step ' + g.step_no + ' — title</label><input type="text" data-guide-title="' + g.step_no + '" value="' + esc(g.title) + '"><label class="f">Text</label><textarea data-guide-body="' + g.step_no + '">' + esc(g.body) + '</textarea>';
  }).join('');
  sheet.innerHTML = '<div class="inner"><div class="row"><h1 class="screen grow">Confession guide</h1><button class="btn ghost" id="ge-close">Close</button></div><p class="meta">Seeded from Lasance, My Prayer Book (1908), Devotions for Confession, pp. 353-354. Editable in your own words.</p>' + rows + '<div style="margin-top:14px"><button class="btn gold" id="ge-save">Save guide</button></div></div>';
  document.body.appendChild(sheet);
  sheet.querySelector('#ge-close').addEventListener('click', function () { sheet.remove(); });
  sheet.querySelector('#ge-save').addEventListener('click', function () {
    var steps = []; sheet.querySelectorAll('[data-guide-title]').forEach(function (t) {
      var n = t.getAttribute('data-guide-title');
      steps.push({ step_no: Number(n), title: t.value, body: sheet.querySelector('[data-guide-body="' + n + '"]').value });
    });
    api('/api/confession/guide', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ steps: steps }) }).then(function () { sheet.remove(); renderConfession(); });
  });
}

setupMediaSession();
setTab('prayers');
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(function () {}); }
`;
