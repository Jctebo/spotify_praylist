// Ora Pro Nobis app client. Five tabs: Prayers (the player) ·
// Podcasts (listening progress, v381) · Intentions (the pool) ·
// Examination · Confession. No checklist
// anywhere: no check-offs, no done states, no counters on prayers
// or examination questions (Amendments 8-9).
export const APP_JS = `
'use strict';
var view = document.getElementById('view');
var audioEl = document.getElementById('audio');
var state = { tab: 'intentions', examMode: 'quick', examCat: null, deepIdx: 0, playingUrl: null, queue: [], queueIdx: -1, current: null, storedDay: null, presentedDay: null, dateLabel: '', liturgical: null, pendingResume: null, sleep: { mode: 'off' }, readTracks: {}, dayDescs: [], dayPayload: null, playedCache: null, repeatIds: {}, previewQueue: null, queuePreviewIdx: -1, restoredQueue: false, prayersView: { kind: 'home' }, searchQuery: '', podcasts: null, podcastsIndex: null };

/* ---------------- Liturgical day (v352) ----------------
   The brand bar carries the day's OFFICIAL liturgical name and
   the day's color themes the app through the CSS token layer
   (ui.ts §2.7: [data-lit] on <html> re-points --accent/--bar-*).
   The name + color arrive on both day payloads as liturgicalDay
   — pushed nightly by the devotional job (§2.1's pin: the job
   derives from the Church observance ONLY; the app displays
   verbatim and derives nothing). A null field is the missed-push
   fallback: the header shows the payload's plain date label and
   no theme attribute stands — never a guessed day or color. */
function applyLiturgical(day) {
  if (!day) return;
  state.liturgical = day.liturgicalDay || null;
  var el = document.getElementById('litday');
  if (day.liturgicalDay) {
    if (el) el.textContent = day.liturgicalDay.name;
    document.documentElement.setAttribute('data-lit', day.liturgicalDay.color);
  } else {
    if (el) el.textContent = day.dateLabel || '';
    document.documentElement.removeAttribute('data-lit');
  }
}

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
  opts = opts || {};
  // v356 \u00a72.6.1: while an unlock stands, its token rides every
  // /api/ call in the one header the gate reads. The token lives in
  // the memory-only variable below \u2014 never in any storage.
  if (pinToken && path.indexOf('/api/') === 0) {
    var hdrs = {};
    var src = opts.headers || {};
    Object.keys(src).forEach(function (k) { hdrs[k] = src[k]; });
    hdrs['x-pin-token'] = pinToken;
    opts = Object.assign({}, opts, { headers: hdrs });
  }
  return fetch(path, opts).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (!r.ok) { var e = new Error(j.error || ('HTTP ' + r.status)); e.data = j; e.status = r.status; throw e; }
      return j;
    });
  });
}
function post(path, body) { return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); }

/* ---------------- Confession PIN (v356) ----------------
   The unlock token lives in ONE module-scope variable (\u00a72.6.1):
   set by verify / set / change / recover, cleared when a gated
   call answers pin_required after expiry, and written NOWHERE
   else \u2014 no localStorage, no sessionStorage. Closing the app or
   reloading the page ends it; one PIN entry restores the session.
   pinStateCache holds the last /api/pin/state read so a tab render
   with no PIN set never pays a second fetch.
   v373: v356 decision 6 is reversed for the two gated tabs —
   with no PIN set they no longer open on that cached state; the
   set-a-PIN prompt stands in their place (D1-B), and a failed
   state read fails closed (see gatedTabRender). */
var pinToken = null;
var pinStateCache = null;
var pinGateCtx = null;
var pinWaitTimer = null;
function clearPinWait() { if (pinWaitTimer) { clearInterval(pinWaitTimer); pinWaitTimer = null; } }
function fetchPinState() {
  return api('/api/pin/state').then(function (st) { pinStateCache = st; return st; });
}
// The gate stands in the two gated renders (\u00a72.6.2): with a token
// standing the render proceeds exactly as before; with a PIN set
// and no token the PIN gate screen stands in its place and NO
// gated fetch is issued at all. With NO PIN set the tabs no
// longer open (v373, reversing v356 decision 6 — D1-B): the
// set-a-PIN prompt stands in the render's place and the tab stays
// locked until a PIN is set, and a failed state read fails
// closed to the same prompt's unreadable variant.
function gatedTabRender(tab, contentFn) {
  if (pinToken) { contentFn(); return; }
  if (pinStateCache && !pinStateCache.pinSet) { renderPinSetupPrompt(tab, contentFn, {}); return; }
  view.innerHTML = '<p class="meta">Loading...</p>';
  fetchPinState().then(function (st) {
    if (!st.pinSet) { renderPinSetupPrompt(tab, contentFn, {}); return; }
    if (pinToken) { contentFn(); return; }
    renderPinGate(tab, contentFn, {});
  }).catch(function () { renderPinSetupPrompt(tab, contentFn, { unreadable: true }); });
}
function pinGateTitles(tab) {
  if (tab === 'examination') return { screen: 'Tonight&rsquo;s examination', lock: 'Examination of Conscience is protected by your PIN' };
  if (tab === 'confession') return { screen: 'Confession', lock: 'Confession is protected by your PIN' };
  return { screen: 'Settings', lock: 'This section is protected by your PIN' };
}
function renderPinGate(tab, contentFn, opts) {
  clearPinWait();
  var titles = pinGateTitles(tab);
  pinGateCtx = { tab: tab, contentFn: contentFn, entry: '' };
  var html = '<h1 class="screen">' + titles.screen + '</h1>';
  html += '<div class="card pingate" id="pingate-card"><div class="lockline">' + titles.lock + '</div>';
  html += '<div class="pindots" id="pindots"></div>';
  html += '<div class="pinpad" id="pinpad">'
    + ['1','2','3','4','5','6','7','8','9'].map(function (d) { return '<button data-pinkey="' + d + '">' + d + '</button>'; }).join('')
    + '<span class="pinblank"></span><button data-pinkey="0">0</button><button data-pinkey="back" aria-label="Delete last digit">&#9003;</button></div>';
  html += '<div class="pinmsg" id="pinmsg"></div>';
  html += '<button class="btn gold" id="pin-unlock" disabled>Unlock</button>';
  html += '<p class="meta" style="margin-top:14px"><a href="#" id="pin-forgot">Forgot PIN? Use your recovery code</a></p>';
  html += '</div>';
  view.innerHTML = html;
  paintPinDots();
  view.querySelectorAll('[data-pinkey]').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-pinkey');
      if (k === 'back') pinGateCtx.entry = pinGateCtx.entry.slice(0, -1);
      else if (pinGateCtx.entry.length < 8) pinGateCtx.entry += k;
      paintPinDots();
    });
  });
  document.getElementById('pin-unlock').addEventListener('click', submitPinVerify);
  document.getElementById('pin-forgot').addEventListener('click', function (ev) { ev.preventDefault(); renderPinRecoveryForm(tab, contentFn); });
  if (opts && opts.expired) setPinMsg('Session expired \u2014 enter your PIN.', false);
  var retry = (pinStateCache && pinStateCache.retryAfterSeconds) || (opts && opts.retryAfterSeconds) || 0;
  if (retry > 0) startPinWait(retry);
}
// The no-PIN prompt (v373, D1-B): with no PIN set this stands in
// the gated tab in place of the content — the tab stays locked
// until a PIN is set, and the ONLY way forward is the Set a PIN
// button (the standing set sheet) or Settings. There is no
// dismiss, close, or skip control, and contentFn is never
// called. The unreadable variant is the fail-closed shape for a
// failed /api/pin/state read: the same lock, with a Try again
// that re-invokes the gate.
function renderPinSetupPrompt(tab, contentFn, opts) {
  var titles = pinGateTitles(tab);
  var unreadable = !!(opts && opts.unreadable);
  var html = '<h1 class="screen">' + titles.screen + '</h1>';
  html += '<div class="card pingate"><div class="lockline">' + (unreadable
    ? 'The PIN state could not be read &mdash; this tab stays locked until it can be checked.'
    : 'No PIN is set yet &mdash; this tab stays locked until you set a PIN.') + '</div>';
  html += unreadable
    ? '<button class="btn gold" id="pin-setup-retry">Try again</button>'
    : '<button class="btn gold" id="pin-setup-open">Set a PIN</button>';
  html += '</div>';
  view.innerHTML = html;
  if (unreadable) {
    document.getElementById('pin-setup-retry').addEventListener('click', function () { gatedTabRender(tab, contentFn); });
  } else {
    document.getElementById('pin-setup-open').addEventListener('click', function () { openPinSetSheet('set'); });
  }
}
function paintPinDots() {
  var dots = document.getElementById('pindots');
  if (!dots || !pinGateCtx) return;
  var n = pinGateCtx.entry.length;
  var html = '';
  for (var i = 0; i < Math.max(4, n); i++) html += '<span class="pindot' + (i < n ? ' on' : '') + '"></span>';
  dots.innerHTML = html;
  var un = document.getElementById('pin-unlock');
  if (un) un.disabled = n < 4;
}
function setPinMsg(text, isErr) {
  var m = document.getElementById('pinmsg');
  if (!m) return;
  m.textContent = text;
  m.classList.toggle('wait', !isErr);
}
function startPinWait(seconds) {
  clearPinWait();
  var left = seconds;
  var pad = document.getElementById('pinpad');
  var un = document.getElementById('pin-unlock');
  if (pad) pad.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
  if (un) un.disabled = true;
  var tick = function () {
    if (!document.getElementById('pinmsg')) { clearPinWait(); return; }
    if (left <= 0) {
      clearPinWait();
      if (pad) pad.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
      paintPinDots();
      setPinMsg('', false);
      return;
    }
    setPinMsg('Too many attempts \u2014 try again in ' + Math.floor(left / 60) + ':' + ('0' + (left % 60)).slice(-2), false);
    left--;
  };
  tick();
  pinWaitTimer = setInterval(tick, 1000);
}
function submitPinVerify() {
  if (!pinGateCtx || pinGateCtx.entry.length < 4) return;
  var ctx = pinGateCtx;
  var pin = ctx.entry;
  post('/api/pin/verify', { pin: pin }).then(function (res) {
    pinToken = res.token;
    clearPinWait();
    ctx.contentFn();
  }).catch(function (e) {
    ctx.entry = '';
    paintPinDots();
    var d = e.data || {};
    if (e.status === 429 || d.retryAfterSeconds) {
      fetchPinState().catch(function () {});
      startPinWait(d.retryAfterSeconds || 30);
      return;
    }
    var card = document.getElementById('pingate-card');
    if (card) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }
    var rem = typeof d.attemptsRemaining === 'number' ? d.attemptsRemaining : null;
    setPinMsg(rem === null ? 'Wrong PIN' : ('Wrong PIN \u2014 ' + rem + (rem === 1 ? ' attempt' : ' attempts') + ' before a short wait'), true);
  });
}
function renderPinRecoveryForm(tab, contentFn) {
  clearPinWait();
  var html = '<h1 class="screen">' + pinGateTitles(tab).screen + '</h1>';
  html += '<div class="card"><h3>Use your recovery code</h3>'
    + '<p class="meta">Enter the code shown when the PIN was set, and choose a new PIN. Your examination and confession content is kept.</p>'
    + '<label class="f">Recovery code</label><input type="text" id="rec-code" autocomplete="off" style="text-transform:uppercase">'
    + '<label class="f">New PIN (4-8 digits)</label><input type="password" id="rec-pin1" inputmode="numeric" autocomplete="off">'
    + '<label class="f">New PIN again</label><input type="password" id="rec-pin2" inputmode="numeric" autocomplete="off">'
    + '<p class="pinmsg" id="rec-msg"></p>'
    + '<div class="row"><button class="btn gold" id="rec-go">Set new PIN</button><button class="btn ghost" id="rec-back">Back</button></div></div>';
  view.innerHTML = html;
  document.getElementById('rec-back').addEventListener('click', function () { renderPinGate(tab, contentFn, {}); });
  document.getElementById('rec-go').addEventListener('click', function () {
    var code = document.getElementById('rec-code').value.trim();
    var p1 = document.getElementById('rec-pin1').value.trim();
    var p2 = document.getElementById('rec-pin2').value.trim();
    var msg = document.getElementById('rec-msg');
    if (!code) { msg.textContent = 'Enter the recovery code.'; return; }
    if (p1 !== p2) { msg.textContent = 'The two entries do not match'; return; }
    if (!/^[0-9]{4,8}$/.test(p1)) { msg.textContent = 'The PIN must be 4-8 digits.'; return; }
    post('/api/pin/recover', { code: code, newPin: p1 }).then(function (res) {
      pinToken = res.token;
      showRecoverySheet(res.recoveryCode, function () { contentFn(); });
    }).catch(function (e) {
      var d = e.data || {};
      if (e.status === 429 || d.retryAfterSeconds) { msg.textContent = 'Too many attempts \u2014 try again in ' + (d.retryAfterSeconds || 30) + ' seconds.'; return; }
      var rem = typeof d.attemptsRemaining === 'number' ? d.attemptsRemaining : null;
      msg.textContent = rem === null ? (e.message || 'Wrong code') : ('Wrong code \u2014 ' + rem + (rem === 1 ? ' attempt' : ' attempts') + ' before a short wait');
    });
  });
}
// The recovery code's one showing (\u00a72.5/\u00a72.6.5): a dedicated
// sheet, shown once at set / change / recover, with the standing
// copy and a Copy button; Done is gated on nothing.
function showRecoverySheet(code, onDone) {
  var old = document.querySelector('.recoverysheet');
  if (old) old.remove();
  var sheet = document.createElement('div'); sheet.className = 'sheet recoverysheet';
  sheet.innerHTML = '<div class="inner"><h1 class="screen">Your recovery code</h1>'
    + '<p class="meta">Store it safely. It is shown once. If you forget your PIN, this code lets you set a new one \u2014 your examination and confession content is kept.</p>'
    + '<div class="recoverycode" id="rec-code-text">' + esc(code) + '</div>'
    + '<div class="row"><button class="btn ghost" id="rec-copy">Copy</button><button class="btn gold" id="rec-done">Done</button></div></div>';
  document.body.appendChild(sheet);
  sheet.querySelector('#rec-copy').addEventListener('click', function () {
    var btn = sheet.querySelector('#rec-copy');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(function () { btn.textContent = 'Copied'; }, function () { selectRecoveryText(sheet); });
    } else selectRecoveryText(sheet);
  });
  sheet.querySelector('#rec-done').addEventListener('click', function () { sheet.remove(); if (onDone) onDone(); });
}
function selectRecoveryText(sheet) {
  var el = sheet.querySelector('#rec-code-text');
  if (!el) return;
  var range = document.createRange(); range.selectNodeContents(el);
  var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
}
// A gated fetch that still answers pin_required (the token expired
// between the state read and the call): the gated DOM is cleared,
// the token dropped, and the gate stands again (\u00a72.6.2).
function pinRefusalGate(tab, contentFn, e) {
  if (!e || e.message !== 'pin_required') return false;
  var had = !!pinToken;
  pinToken = null;
  pinStateCache = null;
  renderPinGate(tab, contentFn, { expired: had });
  return true;
}

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
/* ---------------- Queue snapshot (v355) ----------------
   The queue itself, device-local: ONE record under opn-queue-v355
   holding identity only — the queue's descriptor ids in order,
   the current entry's index + id, and its position in seconds —
   keyed by the PRESENTED day (§2.1). Nothing else is stored: no
   titles, no URLs, no sleep-timer state (§2.6 — the schema carries
   no timer field, so a restored session starts with the timer off
   by construction). The record stands only while a queue stands:
   written by saveQueueSnapshot() from the five §2.2 triggers,
   removed at the §2.5 clearing moments. A storage failure degrades
   silently to the pre-v355 behavior — the queue does not restore —
   and never throws into a playback path.
   v360 §2.5-B: the record is v2 — a blocks array parallel to ids
   plus currentBlock ride the identity, so a repeated episode's
   occurrences restore to their own dayparts; a v1 record still
   restores under the first-match-by-id rule and is rewritten as
   v2 at the next save. */
var QUEUE_KEY = 'opn-queue-v355';
function removeQueueSnapshot() {
  try { localStorage.removeItem(QUEUE_KEY); } catch (e) {}
}
function readQueueSnapshot() {
  var raw = null;
  try { raw = localStorage.getItem(QUEUE_KEY); } catch (e) { return null; }
  if (!raw) return null;
  var rec = null;
  try { rec = JSON.parse(raw); } catch (e) { removeQueueSnapshot(); return null; }
  if (!rec || typeof rec !== 'object' || (rec.v !== 1 && rec.v !== 2) || typeof rec.date !== 'string'
    || !Array.isArray(rec.ids) || !rec.ids.length) { removeQueueSnapshot(); return null; }
  return rec;
}
function queueStartPos(desc) {
  // The position a just-started track stands at: the pending
  // resume's position when this start carries one (Continue's
  // carry), else its start (0). Reading audioEl.currentTime here
  // would race the previous track's position across the src swap.
  return (state.pendingResume && desc && state.pendingResume.episodeId === desc.episodeId)
    ? (state.pendingResume.positionS || 0) : 0;
}
function saveQueueSnapshot(posS) {
  try {
    if (!state.queue.length || !state.current) { localStorage.removeItem(QUEUE_KEY); return; }
    var date = presentedDateStr();
    if (!date) return;
    localStorage.setItem(QUEUE_KEY, JSON.stringify({
      v: 2, date: date,
      ids: state.queue.map(function (d) { return d.episodeId; }),
      blocks: state.queue.map(function (d) { return d.block || ''; }),
      idx: state.queueIdx, currentId: state.current.episodeId,
      currentBlock: state.current.block || '',
      positionS: (posS !== undefined ? posS : (audioEl.currentTime || 0)),
      savedAt: new Date().toISOString(),
    }));
  } catch (e) {}
}
function clearRestoredQueue() {
  // §2.4's return path: the flag drops at the §2.5 clearing
  // moments, and Continue re-paints through its standing refresh.
  if (!state.restoredQueue) return;
  state.restoredQueue = false;
  refreshPlayedChrome();
}
function bootQueueSnapshot() {
  // Amendment A1, Moment 1 (synchronous, at boot — renderPrayers
  // invokes this immediately BEFORE resolveExternals): §2.3 steps
  // 1–2 + step 8's flag. Read + shape check; a same-day record
  // sets the §2.4 flag at once, so no paintContinue of the pass
  // can raise the card — not even transiently — while the restore
  // question stands open; a stale-day record is removed whole
  // (decision 5: yesterday's queue never restores into today) and
  // a malformed one likewise. No re-resolution happens here: the
  // payload-success point holds no descriptors (A1's evidence) —
  // the restore proper runs at readiness (standRestoredQueue,
  // probed from the settings callback).
  state.restoreProbe = null;
  var rec = readQueueSnapshot();
  if (!rec) return;
  if (rec.date !== presentedDateStr()) { removeQueueSnapshot(); return; }
  state.restoredQueue = true;
}
/* ---------------- Played state (v344) ----------------
   Playback memory, not a checklist (the v305 rule stands): the
   store remembers what the ear has already heard so the listener
   can find his place. ONE device-local store, keyed by CANONICAL
   EPISODE ID first and PRESENTED DATE second — the id the stored
   payload and the podcast feed share (v342's keying, verified in
   §3), so a novena's nine days accumulate under one key across
   rollovers and the server retention never sees any of it. The
   date is the day the listener experienced (presentedDay), never
   the stored day. No checkmark glyph anywhere; counts read as
   position ("heard", "prayed"), never as scores.
   v360 §2.2: REPEAT-AWARE OCCURRENCE KEYING — an episode id the
   day build carries in more than one descriptor (the repeat set,
   state.repeatIds) keys per occurrence: the store key gains the
   descriptor's block (episodeId + '|' + block). Every other id
   keeps the bare canonical key — an id that occurs once has
   exactly one occurrence, so the bare id already IS its
   occurrence key (the novena family's cross-day accumulation
   under the canonical id stands untouched). The store key and
   shape do not change; under changeover A the old bare entry
   for a repeated id is simply never read again and ages out
   under the standing 120-day prune. */
var PLAYED_KEY = 'opn-played-v344';
function readPlayed() {
  try {
    var v = JSON.parse(localStorage.getItem(PLAYED_KEY) || 'null');
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  } catch (e) { return {}; }
}
function playedMap() {
  if (!state.playedCache) state.playedCache = readPlayed();
  return state.playedCache;
}
function presentedDateStr() {
  return state.presentedDay || (state.dayPayload && (state.dayPayload.presentedDay || state.dayPayload.date)) || null;
}
function refreshRepeatIds() {
  // v360 §2.2: the day's REPEAT SET — the episode ids carried by
  // more than one prayer descriptor in state.dayDescs
  // (availability does not matter, so the set is stable while
  // slots settle). Recomputed wherever state.dayDescs is rebuilt.
  var counts = {};
  (state.dayDescs || []).forEach(function (x) {
    if (!x || !x.episodeId) return;
    counts[x.episodeId] = (counts[x.episodeId] || 0) + 1;
  });
  var set = {};
  Object.keys(counts).forEach(function (id) { if (counts[id] > 1) set[id] = true; });
  state.repeatIds = set;
}
function playedKey(episodeId, block) {
  // v360 §2.2: the one seam change. A repeated id with a block in
  // hand keys per occurrence; '|' never appears in a canonical
  // id, so an occurrence key can never collide with a bare key.
  // A caller without a block reads/writes the bare key — the
  // pre-v360 behavior, retained only as a defensive default.
  if (episodeId && block && state.repeatIds && state.repeatIds[episodeId]) return episodeId + '|' + block;
  return episodeId;
}
function isPlayed(episodeId, dateStr, block) {
  if (!episodeId || !dateStr) return false;
  var byDate = playedMap()[playedKey(episodeId, block)];
  return !!(byDate && byDate[dateStr]);
}
function writePlayed(episodeId, dateStr, via, block) {
  writePlayedQuiet(episodeId, dateStr, via, block);
  refreshPlayedChrome();
}
function writePlayedQuiet(episodeId, dateStr, via, block) {
  if (!episodeId || !dateStr) return;
  var key = playedKey(episodeId, block);
  var map = playedMap();
  // Prune on write: date entries older than 120 days before the
  // presented date drop (novena windows are 9 days; a season of
  // history is ample), and ids left with no dates drop with them.
  var cutoffMs = Date.parse(dateStr + 'T00:00:00Z') - 120 * 86400000;
  var cutoff = isFinite(cutoffMs) ? new Date(cutoffMs).toISOString().slice(0, 10) : null;
  Object.keys(map).forEach(function (id) {
    var byDate = map[id];
    if (!byDate || typeof byDate !== 'object') { delete map[id]; return; }
    if (cutoff) Object.keys(byDate).forEach(function (ds) { if (ds < cutoff) delete byDate[ds]; });
    if (!Object.keys(byDate).length) delete map[id];
  });
  if (via) {
    if (!map[key]) map[key] = {};
    map[key][dateStr] = { playedAt: new Date().toISOString(), via: via };
  } else if (map[key]) {
    delete map[key][dateStr];
    if (!Object.keys(map[key]).length) delete map[key];
  }
  state.playedCache = map;
  try { localStorage.setItem(PLAYED_KEY, JSON.stringify(map)); } catch (e) {}
}
function markCompleted(desc) {
  // §2.3: the ONLY completion writer, called once at the top of
  // the ended handler. Speech never marks (twenty seconds of
  // intention is not the prayer — the prayer is the unit and
  // marks by its own audio end). The rule is the event itself:
  // no duration or percentage test stands anywhere in the mark
  // path. The intro: guard below stands as defense only — no
  // descriptor carries that form under the v384 model.
  if (!desc) return;
  if (!desc.episodeId || desc.episodeId.indexOf('intro:') === 0) return;
  // v381 §2.4: a Podcasts-series track reaching this seam (the
  // ended event is the test, exactly as for every other track)
  // writes its listening mark with source 'auto' through the
  // podcasts route — fire-and-forget, the writePlayedQuiet
  // posture; a failed write leaves the entry unmarked at next
  // open. A series track carries no day-played record: the
  // podcasts store is its record.
  if (desc.kind === 'podcast' && desc.seriesKey) { writePodMarkQuiet(desc.seriesKey, desc.podSeries, 'auto'); return; }
  var d = presentedDateStr();
  if (!d) return;
  writePlayed(desc.episodeId, d, 'played', desc.block);
}
function setMediaSessionFor(desc) {
  if (oraInShell()) return; // v377 B6: in the shell the native session is the face
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: desc.title, artist: 'Ora Pro Nobis',
      album: 'Ora Pro Nobis — ' + (state.dateLabel || state.storedDay || ''),
      artwork: [{ src: '/logo.png', sizes: '288x288', type: 'image/png' }, { src: '/logo-512.png', sizes: '512x512', type: 'image/png' }],
    });
  } catch (e) {}
}
/* ---------------- Media session focus (v346) ----------------
   The session must stay an accurate, fresh claimant across a
   pause: the system hands a lock-screen / car play press to the
   session it counts as active, and a paused web session that
   never declares its state loses that press to a native app
   (Spotify). Three parts: playbackState kept true at the
   standing seams (setPlaybackState), the session re-filed on
   pause and on return to the foreground (reassertMediaSession),
   and the session's own play handler resuming through the app's
   path without disturbing the queue (resumeCurrent, below). */
function setPlaybackState(v) {
  if (oraInShell()) return; // v377 B6
  if (!('mediaSession' in navigator)) return;
  try { navigator.mediaSession.playbackState = v; } catch (e) {}
}
function reassertMediaSession() {
  if (oraInShell()) return; // v377 B6
  if (!('mediaSession' in navigator)) return;
  if (!state.current) { setPlaybackState('none'); return; }
  setMediaSessionFor(state.current);
  registerMediaHandlers();
  setPlaybackState(transportPlaying() ? 'playing' : 'paused');
  updatePositionState();
}
function updatePositionState() {
  if (oraInShell()) return; // v377 B6
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  var d = audioEl.duration;
  if (!isFinite(d) || d <= 0) return;
  try {
    navigator.mediaSession.setPositionState({ duration: d, playbackRate: audioEl.playbackRate || 1, position: Math.min(audioEl.currentTime || 0, d) });
  } catch (e) {}
}
/* ---------------- Intentions, written only (v388) --------
   v388 §2.2 (D2 as approved): the speech machinery is REMOVED
   — the funnel, both transports (Web Speech + the native
   bridge speech route), the watchdogs, the state, and the
   harness hook all stood only to serve the intention speech
   step inside a prayer's start, and the step is retired:
   no intention is spoken on any route, ever. The APK bridge
   plugin stands untouched (its speakText/stopSpeech methods
   simply go unused). What intentions remain is written: the
   drawn text rides the prayer descriptor (intentionText) and
   shows on the playing screen, in the prayer's row, and on
   the native face — gated by the showing toggle (§2.3).
   v384's pause-at-intentions fix is preserved by construction:
   with no step there is no deferral and no boundary to strand
   at — every start runs its audio load inline, at once. */
/* Transport predicates (§2 step 7 — designed once, the central
   problem): every play/pause decision reads these, never
   audioEl.paused alone. v388: the element is the only transport
   there is — the predicates read it alone. */
function transportPlaying() {
  return !audioEl.paused;
}
function pauseTransport() {
  audioEl.pause();
  pushNativeState(false); // v377 B2: pause is a push trigger
}
function loadDescAudio(desc) {
  // The audio-load step — startDesc's tail, split out at v384.
  // v388: it is the WHOLE start tail now — no step stands
  // before it and nothing defers it; startDesc runs it inline
  // on every start. Byte-for-byte in behavior: src, rate
  // re-assert, play(), the state pushes.
  audioEl.src = desc.url;
  audioEl.playbackRate = state.rate; // v336: re-asserted on every start — no stale element rate
  audioEl.play().catch(function () {});
  setPlaybackState('playing');
  pushNativeState(false); // v377 B2: track change / play
}
function startDesc(desc) {
  // v388 §2.2: the start sequence, written-only. Bookkeeping
  // stands on the PRAYER from the unit's first instant (the
  // session names the prayer — never an intention), exactly as
  // v384 made it; then the audio load runs INLINE, at once —
  // there is no speech step, no deferral, and no toggle read
  // on any start path. A start never waits on anything.
  fadeRestore(); // v320 §2.6 restore point (2): every playback start passes through here
  state.current = desc;
  state.lastStartAt = Date.now(); // v358: the error listener's window — a start's failure belongs to its start
  setMediaSessionFor(desc);
  setPlaybackState('playing');
  markPlaying(desc.episodeId);
  updateDock();
  saveQueueSnapshot(queueStartPos(desc)); // v355 §2.2 trigger 2: the track-change funnel
  // v392 W4: a podcast descriptor resolves cache-first — the
  // downloaded blob when one stands under its pod: key, the
  // enclosure stream exactly as before when none does.
  if (desc.kind === 'podcast' && 'caches' in window) {
    var podKey = offlinePodKey(desc.podSeries, desc.episodeId);
    caches.open('opn-ext-audio-v1').then(function (c) { return c.match(podKey); })
      .then(function (resp) { return resp ? resp.blob() : null; })
      .catch(function () { return null; })
      .then(function (blob) { if (blob) desc.url = URL.createObjectURL(blob); loadDescAudio(desc); });
    return;
  }
  loadDescAudio(desc);
}
function playTrack(desc) {
  // The guard admits available descriptors with a URL (v384:
  // the spoken form is retired — every queue entry is a prayer
  // with audio); the toggle reads the transport predicates.
  if (!desc || !desc.available || !desc.url) return;
  if (state.current && state.current.episodeId === desc.episodeId && transportPlaying()) { pauseTransport(); return; }
  state.queue = []; state.queueIdx = -1;
  clearRestoredQueue(); // v355 §2.5: a single play retires any restored queue with the queue it clears
  startDesc(desc);
}
function tapPlay(d) {
  // v351 §2.2: the prayer card tap's dispatch — the five standing
  // [data-playkey] wiring sites call here instead of playTrack.
  // A tap on a prayer in a block auto-queues that block's
  // unplayed remainder behind the tapped pair (John's request,
  // 2026-11-10). The descriptor handed over is used ONLY as
  // identity: the build re-resolves in the fresh whole-day list
  // (§2.1), never in the render-time snapshot.
  if (!d) return;
  var key = d.episodeId || '';
  // v384 §2.2: the same-unit toggle at the granularity of the
  // prayer alone — the pair is the unit, so tapping the prayer
  // card while its audio plays pauses it.
  if (state.current && transportPlaying() && state.current.episodeId === key) { pauseTransport(); return; }
  if (!state.dayPayload) { playTrack(d); return; }
  var build = sectionQueueFrom(extRebuildDescs(state.dayPayload), key);
  // §2.7: a card in no block (the FROM TODAY'S PODCAST group)
  // has no section to queue from — the standing single-play
  // behavior stands for it, unchanged.
  if (build === null) { playTrack(d); return; }
  if (!build.length) return;
  startQueue(build, true);
}
function resumeCurrent() {
  // v346 §2.4: the media-session play handler's seam — the app's
  // own resume path, queue- and position-preserving. It never
  // routes through playTrack/startDesc (playTrack clears the
  // queue and startDesc reloads src — either would drop the
  // standing queue and restart the track at a system resume).
  // v388: the element resume stands for every current — the
  // speech-phase resume leg retires with the machinery.
  if (!state.current) { setPlaybackState('none'); return; }
  if (!audioEl.paused) { reassertMediaSession(); return; }
  fadeRestore(); // v320 §2.6 restore point (3) stands: exactly one fade restore per system resume
  reassertMediaSession();
  if (audioEl.currentSrc && !audioEl.ended) {
    audioEl.play().catch(function () {});
  } else {
    // The element holds nothing for the standing track (e.g. the
    // sleep-hold head, loaded on a preload="none" element): load
    // the current track's URL under startDesc's rate discipline.
    // The queue and queueIdx are not touched.
    audioEl.src = state.current.url;
    audioEl.playbackRate = state.rate;
    audioEl.play().catch(function () {});
  }
  pushNativeState(false); // v377 B2: play is a push trigger
}
function queueLiveDescV384(d) {
  // v384 §2.3 (the restore edge) + §2.2: a pre-v384 record entry
  // — an intro:-prefixed id, or a descriptor carrying the
  // retired spoken form — is DEAD: it passes over exactly as an
  // unavailable entry passes over, and is never started or
  // spoken from. queueLiveDesc below applies this rule at its
  // head, so every advance-time and restore-time read of a
  // stale entry answers dead. The rule is identity-only: a live
  // prayer's descriptor is untouched.
  if (!d) return true;
  var id = d.episodeId || '';
  if (id.indexOf('intro:') === 0) return true;
  if (d.spoken || d.kind === 'intention') return true;
  return false;
}
function queueLiveDesc(d) {
  // v338 defect fix (John's report, 2026-11-09 11:17 CT — a block's
  // play button played one prayer and stopped): a queue is a
  // tap-time snapshot, and a slot descriptor in it froze
  // available:false while its download was still in flight; the
  // skip loop then passed it over at its turn, minutes later, long
  // after the download had landed. At every queue decision the
  // descriptor is re-checked against LIVE slot state: a slot that
  // stands 'present' NOW is substituted with its fresh descriptor
  // (current streamUrl, available) and plays.
  // v358 defect fix (John's pinpoint, 2026-11-10 15:28 CT — the
  // queue stands, one pair completes, then playback pauses): the
  // v338 note's last sentence was wrong for own tracks and intros.
  // Their snapshot URL is the RAW enclosure until the pass-through
  // download lands and the blob URL swaps in (§2.3: the enclosure
  // host refuses browser reads — the blob is the only playable
  // form), so an own descriptor's URL is a download state exactly
  // as a slot's availability is. A queue built while a later
  // pair's download was still in flight advanced into the dead
  // enclosure URL: play() failed, the rejection was swallowed, no
  // 'ended' ever fired, and the queue stood dead with its entries
  // unplayed. Own + intro descriptors therefore re-resolve against
  // the fresh day build by (episodeId, block) — the v360
  // occurrence discipline — at the same advance-time seam: the
  // fresh descriptor (blob URL once landed) substitutes; a fresh
  // descriptor standing unavailable (settled missing) passes over.
  if (!d) return null;
  if (queueLiveDescV384(d)) {
    // v384 §2.3: a dead pre-v384 entry resolves only against
    // the fresh build by (episodeId, block) — the paired prayer
    // ITSELF, never the snapshot's spoken form. No fresh match
    // (the day build carries no such prayer) reads dead, as an
    // unavailable entry reads.
    var fresh = state.dayDescs || [];
    for (var fi = 0; fi < fresh.length; fi++) {
      if (fresh[fi].episodeId === d.episodeId && (fresh[fi].block || '') === (d.block || '')) {
        return fresh[fi].available ? fresh[fi] : null;
      }
    }
    return null;
  }
  var isExt = d.kind === 'external' || !!(state.extSlots && state.extSlots[d.episodeId]);
  if (!isExt) {
    var descs = state.dayDescs || [];
    for (var i = 0; i < descs.length; i++) {
      if (descs[i].episodeId === d.episodeId && (descs[i].block || '') === (d.block || '')) {
        return descs[i].available ? descs[i] : null;
      }
    }
    return d.available ? d : null;
  }
  if (d.available) return d;
  var st = state.extSlots && state.extSlots[d.episodeId];
  if (!st || st.state !== 'present') return null;
  var slot = (state.extStanding || []).filter(function (s) { return s.slotId === d.episodeId; })[0];
  if (!slot) return null;
  var live = trackDesc(extSlotTrack(slot, st), state.dayPayload); // v388 §2.5 (D4): the rebuild passes the live day — the one day-less call; the rebuilt descriptor carries its drawn intentionText
  return live.available ? live : null;
}
function unplayedOnly(descs) {
  // v344 §2.4: the played filter — build time, at the two queue
  // call sites only. Descriptors are never mutated and expandDescs
  // is untouched; the filter selects from the standing build.
  // v384 §2.2: the pendingIntro grouping retires with the spoken
  // descriptor — the drawn text rides ON the prayer descriptor
  // (its intentionText field), so a played prayer's text dies
  // with its own descriptor and the filter is a plain played
  // filter; behavior for prayers is identical. Availability is
  // NOT this function's question: unavailable descriptors pass
  // through untouched and queueLiveDesc answers for them at
  // advance time, exactly as before — the filter answers
  // "played?", queueLiveDesc answers "available now?", and
  // neither does the other's job. A played slot still downloading
  // at tap time is excluded here, so no advance can ever start it.
  var d = presentedDateStr();
  if (!d) return descs.slice();
  return descs.filter(function (x) { return !isPlayed(x.episodeId, d, x.block); });
}
function queueBuild(descs) {
  // §2.4's fallback, at the same build-time seam: the filtered
  // build stands UNLESS it holds nothing playable — no descriptor
  // whose snapshot stands available (an unavailable descriptor
  // passes the filter untouched by design, so a fully-played
  // block with an unavailable slot standing would otherwise read
  // "non-empty" and start silence: a dead button, the one shape
  // §2.4 forbids). Availability stays queueLiveDesc's question at
  // advance time; this checks only the snapshot flag the filter
  // itself already reads, to decide which build to hand over.
  var filtered = unplayedOnly(descs);
  for (var i = 0; i < filtered.length; i++) if (filtered[i].available) return filtered;
  return descs;
}
function sectionQueueFrom(all, tappedId) {
  // v351 §2.1: the card tap's build. The tapped prayer heads the
  // queue UNFILTERED (§2.3 — John's tap wins, even on a played
  // prayer); the tail is the block's descriptors AFTER the
  // tapped prayer through unplayedOnly (§2.4) — queueBuild is
  // NOT used, so its full-replay fallback never applies here:
  // the head guarantees a playable unit, and an all-played
  // remainder correctly yields the tapped unit alone.
  // v384 §2.2: the head-pair logic retires — the head is the
  // prayer alone (the pair is the unit; the intention rides on
  // the prayer descriptor as its intentionText field).
  // Returns: the queue · [] when the prayer cannot be resolved
  // in the fresh list or the prayer stands unavailable (a no-op,
  // §2.1(2) — the standing guard) · null when the prayer belongs
  // to no block (§2.7's boundary — the caller falls back to
  // playTrack's single play).
  var prayerId = tappedId;
  var prayer = null;
  for (var i = 0; i < all.length; i++) { if (all[i].episodeId === prayerId) { prayer = all[i]; break; } }
  if (!prayer || !prayer.available) return [];
  if (!prayer.block) return null;
  var section = all.filter(function (x) { return x.block === prayer.block; });
  var idx = section.indexOf(prayer);
  if (idx < 0) return [];
  return [prayer].concat(unplayedOnly(section.slice(idx + 1)));
}
function startQueue(descs, force) {
  if (!descs.length) return;
  // v351 §2.5(1): the pause toggle fires only when force is not
  // set. Every standing call site calls with one argument and
  // behaves byte-identically; only the card tap path (tapPlay)
  // passes true — a tap REPLACES the standing queue (decision 3)
  // instead of pausing it.
  if (!force && state.queue.length && state.queueIdx >= 0 && state.current && transportPlaying()) { pauseTransport(); return; }
  clearRestoredQueue(); // v355 §2.5: a new queue replaces a restored one, flag with it
  state.queue = descs.slice();
  var idx = -1;
  for (var i = 0; i < state.queue.length; i++) {
    var live = queueLiveDesc(state.queue[i]);
    if (!live) { markSkipped(state.queue[i].episodeId); continue; }
    state.queue[i] = live;
    idx = i; break;
  }
  if (idx < 0) { state.queue = []; state.queueIdx = -1; saveQueueSnapshot(); return; }
  state.queueIdx = idx;
  startDesc(state.queue[idx]);
  saveQueueSnapshot(queueStartPos(state.queue[idx])); // v355 §2.2 trigger 1: every queue birth/replacement
}
function advanceQueue(dir) {
  if (!state.queue.length) return false;
  var i = state.queueIdx + dir;
  while (i >= 0 && i < state.queue.length) {
    var live = queueLiveDesc(state.queue[i]);
    if (!live) { if (dir > 0) markSkipped(state.queue[i].episodeId); i += dir; continue; }
    state.queue[i] = live;
    state.queueIdx = i;
    startDesc(live);
    return true;
  }
  if (dir > 0) { state.queue = []; state.queueIdx = -1; state.current = null; setPlaybackState('none'); markPlaying(null); updatePositionState(); updateDock(); saveQueueSnapshot(); clearRestoredQueue(); pushNativeState(true); }
  return false;
}
function jumpQueueTo(i) {
  // v347 §2.4: jump inside the standing queue — never playTrack
  // (it clears the queue), never startQueue (it re-copies and
  // restarts at the first live entry). The array, its order, and
  // every row before and after the target stand untouched.
  if (i < 0 || i >= state.queue.length) return;
  var desc = state.queue[i];
  if (i === state.queueIdx && state.current && desc.episodeId === state.current.episodeId) {
    if (transportPlaying()) pauseTransport(); else resumeCurrent();
    return;
  }
  var live = queueLiveDesc(desc);
  if (!live) { markSkipped(desc.episodeId); return; }
  state.queue[i] = live;
  state.queueIdx = i;
  startDesc(live);
}
function renderQueueList() {
  // v347 §2.3/§2.6: the queue list — a view of the standing array,
  // read fresh on every call (no captured snapshot, the v343 rule).
  var sheet = document.querySelector('.np-sheet');
  if (!sheet) return;
  var box = sheet.querySelector('#np-queue');
  if (!box) return;
  var posEl = sheet.querySelector('#np-queue-pos');
  var preview = state.previewQueue || null;
  var arr = preview || state.queue;
  var scroll = box.scrollTop || 0;
  if (!preview && !arr.length) {
    if (posEl) posEl.textContent = '';
    box.innerHTML = state.current ? '<p class="meta npq-empty">No queue \u2014 playing a single prayer.</p>' : '';
    box.scrollTop = scroll;
    return;
  }
  if (posEl) posEl.textContent = preview ? (arr.length + ' items remaining') : ('Track ' + (state.queueIdx + 1) + ' of ' + arr.length);
  var dstr = presentedDateStr();
  box.innerHTML = arr.map(function (desc, i) {
    // v384 §2.6: the queue holds prayers only — no intro rows,
    // no intro branches; every row is a prayer row.
    var isPlaying = !preview && i === state.queueIdx && state.current && desc.episodeId === state.current.episodeId;
    var isStart = !!preview && i === state.queuePreviewIdx;
    var title = desc.title || '';
    var metaParts = [];
    if (desc.block) metaParts.push(esc(desc.block));
    if (desc.durationS > 0) metaParts.push(fmtDur(desc.durationS));
    if (!desc.available) metaParts.push('Not available');
    // v363 §2.6: the preview's start row folds "Starts here"
    // into its meta line (after the block and duration parts)
    // — the separate third-line span retires; a third line
    // cannot stand inside the uniform 76px. The .npq-start
    // accent border stays as the row's second signal.
    if (isStart) metaParts.push('Starts here');
    var on = dstr ? isPlayed(desc.episodeId, dstr, desc.block) : false;
    var dot = '<span class="npq-dot played-dot' + (on ? ' on' : '') + '" aria-hidden="true"></span>';
    return '<button type="button" class="npq-row' + (isPlaying ? ' playing' : '') + (isStart ? ' npq-start' : '') + '" data-npq-index="' + i + '" data-npq-id="' + esc(desc.episodeId) + '"' + (isPlaying ? ' aria-current="true"' : '') + (!desc.available ? ' disabled' : '') + '>'
      + '<span class="npq-main"><span class="npq-title">' + esc(title) + '</span>'
      + (metaParts.length ? '<span class="meta npq-meta">' + metaParts.join(' \u00b7 ') + '</span>' : '')
      + '</span>' + dot + '</button>';
  }).join('');
  box.querySelectorAll('[data-npq-index]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var idx = Number(btn.getAttribute('data-npq-index'));
      if (state.previewQueue) previewQueueTap(idx); else jumpQueueTo(idx);
    });
  });
  box.scrollTop = scroll;
}
function previewQueueTap(i) {
  var preview = state.previewQueue;
  if (!preview || !preview.length || i < 0 || i >= preview.length) return;
  var slice = preview.slice(i);
  state.previewQueue = null; state.queuePreviewIdx = -1;
  startQueue(slice);
  var sheet = document.querySelector('.np-sheet');
  if (sheet) sheet.remove();
  if (state.current) openNowPlaying();
}
function openQueuePreview() {
  var old = document.querySelector('.np-sheet');
  if (old) old.remove();
  var sheet = document.createElement('div');
  sheet.className = 'sheet np-sheet np-preview';
  sheet.innerHTML = '<div class="inner">'
    + '<div class="np-hero">'
    + '<div class="row"><span class="grow"></span><button class="btn ghost" id="np-min" aria-label="Minimize">&#8964;</button></div>'
    + '<div class="npq-head"><span class="npq-heading">Queue</span><span class="meta" id="np-queue-pos"></span></div>'
    + '</div>'
    + '<div id="np-queue"></div>'
    + '</div>';
  document.body.appendChild(sheet);
  sheet.querySelector('#np-min').addEventListener('click', function () { state.previewQueue = null; state.queuePreviewIdx = -1; sheet.remove(); });
  renderQueueList();
}
function buildContinueQueue() {
  // v347 §2.5: Continue's standing build, extracted — the remaining
  // (unplayed-filtered) sequence with the full-replay fallback, and
  // the carry index when the resume record points at the first
  // unplayed track.
  if (!state.dayPayload) return { build: [], carryIdx: -1 };
  var full = extRebuildDescs(state.dayPayload);
  var build = queueBuild(full);
  var carryIdx = -1;
  var resumeRec = readResume();
  if (resumeRec && resumeRec.date !== state.storedDay) resumeRec = null;
  if (resumeRec) {
    var prayers = (state.dayDescs || []).filter(function (x) { return x.available; });
    var d = presentedDateStr();
    var firstUnplayed = null;
    prayers.forEach(function (x) { if (!(d && isPlayed(x.episodeId, d, x.block)) && !firstUnplayed) firstUnplayed = x; });
    var resumeDesc = prayers.filter(function (x) { return x.episodeId === resumeRec.episodeId; })[0] || null;
    if (resumeDesc && firstUnplayed && resumeDesc.episodeId === firstUnplayed.episodeId) {
      for (var i = 0; i < build.length; i++) {
        if (build[i].episodeId === resumeDesc.episodeId) { carryIdx = i; break; }
      }
    }
  }
  return { build: build, carryIdx: carryIdx };
}
function loadResume(desc, positionS) {
  state.queue = []; state.queueIdx = -1;
  saveQueueSnapshot(); // v355 §2.1: the record stands only while a queue stands — this path clears it by design
  state.current = desc;
  setMediaSessionFor(desc);
  state.pendingResume = { episodeId: desc.episodeId, positionS: positionS };
  setPlaybackState('paused');
  audioEl.src = desc.url;
  audioEl.load(); // preload="none": an explicit load is what brings metadata (and the pending position) in
  markPlaying(desc.episodeId);
  updateDock();
  // Stands paused at the position (set on loadedmetadata); the app
  // never autoplays sound on open.
}
function standRestoredQueue(day) {
  // v355 §2.3 steps 3–7, run at Amendment A1's RESTORE-READINESS
  // (the settings callback's probe fires this once per pass, when
  // every own row stands settled and the intentions map has
  // landed — the first moment the day's descriptors all stand).
  // The record is re-read here: between Moment 1 and readiness it
  // can only have been touched by the listener's own §2.2/§2.5
  // discipline, and the probe's stand-down has already retired
  // the case where his playback stands.
  var rec = readQueueSnapshot();
  if (!rec) { clearRestoredQueue(); return; }
  if (rec.date !== presentedDateStr()) { removeQueueSnapshot(); clearRestoredQueue(); return; }
  // Step 3: re-resolution against the fresh day, by the standing
  // build method. An id the fresh day does not carry drops out;
  // each entry resolves on its own id (a dropped prayer takes its
  // intro only when the intro itself fails to resolve). An
  // external slot still downloading at readiness resolves to its
  // staged snapshot descriptor and KEEPS its place (A1 ruling
  // (a)) — queueLiveDesc answers for it at advance time, exactly
  // as in a live queue; it is never dropped at restore.
  var fresh = extRebuildDescs(day);
  var byId = {};
  fresh.forEach(function (d) { if (!byId[d.episodeId]) byId[d.episodeId] = d; });
  // v360 §2.5-B: a v2 record resolves each entry on its (id,
  // block) PAIR — first occurrence winning per pair — so two
  // occurrences of one repeated id restore to their own
  // dayparts' descriptors; a v1 record (ids only) restores under
  // the standing first-match-by-id rule above.
  var pairMode = rec.v === 2 && Array.isArray(rec.blocks);
  var byPair = {};
  if (pairMode) fresh.forEach(function (d) { var k = d.episodeId + '|' + (d.block || ''); if (!byPair[k]) byPair[k] = d; });
  var survivors = [];
  rec.ids.forEach(function (id, i) {
    var d = pairMode ? byPair[id + '|' + (rec.blocks[i] || '')] : byId[id];
    if (d) survivors.push({ desc: d, at: i });
  });
  // Step 5: nothing survived — the record dies, Continue governs.
  if (!survivors.length) { removeQueueSnapshot(); clearRestoredQueue(); return; }
  // Step 4: the standing current. The stored current, when it
  // survives AND stands available, is current (its stored
  // position applies). An unavailable survivor (a slot still
  // resolving, an own row settled 'missing') keeps its queue
  // place, but the current stands on the first AVAILABLE survivor
  // at or after the stored index, at position 0; a dropped
  // current follows the same at-or-after rule, and when no
  // available survivor follows, the last available survivor
  // stands (an unavailable entry can never be loaded — it keeps
  // its place and the advance machinery answers it in turn).
  var curAt = -1;
  if (pairMode) {
    // v360 §2.5-B: the stored current stands on the entry whose
    // pair matches (currentId, currentBlock).
    for (var ci = 0; ci < rec.ids.length; ci++) {
      if (rec.ids[ci] === rec.currentId && (rec.blocks[ci] || '') === (rec.currentBlock || '')) { curAt = ci; break; }
    }
  }
  if (curAt < 0) curAt = rec.ids.indexOf(rec.currentId);
  if (curAt < 0) curAt = rec.idx || 0;
  var exact = null, chosen = null, position = 0;
  survivors.forEach(function (s) { if (s.at === curAt) exact = s; });
  if (exact && exact.desc.available) { chosen = exact; position = rec.positionS || 0; }
  else {
    for (var i = 0; i < survivors.length; i++) {
      if (survivors[i].at >= curAt && survivors[i].desc.available) { chosen = survivors[i]; break; }
    }
    if (!chosen) {
      for (var j = survivors.length - 1; j >= 0; j--) {
        if (survivors[j].desc.available) { chosen = survivors[j]; break; }
      }
    }
    if (!chosen) { removeQueueSnapshot(); clearRestoredQueue(); return; }
    position = 0;
  }
  // Step 7 (the pre-clamp): against the fresh descriptor's known
  // duration, stand one second short of the end — a seek landing
  // on the exact end would fire 'ended', advance the queue, and
  // mark the track; a restore must never consume what it restores.
  // The loadedmetadata handler carries the same guard for the
  // unknown-duration case; in-range positions pass through both
  // unchanged.
  if (position > 0 && chosen.desc.durationS > 0) position = Math.max(0, Math.min(position, chosen.desc.durationS - 1));
  // Step 6: stand the queue PAUSED. The loadResume MACHINERY (the
  // pendingResume seek on the preload="none" element, the dock,
  // the paused session declaration) — but never loadResume itself,
  // whose first act clears the queue. Queue and index are set
  // BEFORE the load, and the load does not touch them. No play()
  // call stands anywhere in this path — one tap resumes through
  // the standing resumeCurrent() seam.
  state.queue = survivors.map(function (s) { return s.desc; });
  state.queueIdx = survivors.indexOf(chosen);
  state.current = chosen.desc;
  setMediaSessionFor(chosen.desc);
  state.pendingResume = position > 0 ? { episodeId: chosen.desc.episodeId, positionS: position } : null;
  setPlaybackState('paused');
  // v384: the restore edge — a chosen current restored from a
  // pre-v384 record carrying an intro: entry was re-pointed at
  // its prayer at re-resolution (the survivors hold the PRAYER's
  // descriptor, never a spoken form), so the element leg stands
  // unconditionally: the prayer stands loaded, paused, at its
  // stored position; a resume plays the prayer.
  audioEl.src = chosen.desc.url;
  audioEl.load();
  markPlaying(chosen.desc.episodeId);
  updateDock();
  renderQueueList();
}
audioEl.addEventListener('loadedmetadata', function () {
  if (state.pendingResume && state.current && state.pendingResume.episodeId === state.current.episodeId) {
    try {
      // v355 §2.3 step 7 (the shared-seam guard): the seek target
      // stands one second short of the element's real end — a seek
      // landing on the exact end fires 'ended' and consumes the
      // track. Identity for every in-range position, so the v312
      // single-track path and Continue's carry path (which share
      // pendingResume) behave exactly as before.
      var target = state.pendingResume.positionS || 0;
      var dur = audioEl.duration;
      if (isFinite(dur) && dur > 0) target = Math.min(target, Math.max(0, dur - 1));
      audioEl.currentTime = target;
    } catch (e) {}
    state.pendingResume = null;
  }
  updatePositionState();
});
/* ---------------- Autoplay (v358) ----------------
   Continuous advance is the expected baseline (John's approval,
   2026-11-10 15:30 CT): with autoplay ON — the default — a start
   that reaches the end of its queue keeps going through the
   presented day (the v358 §1 chaining scope; v351 decision 2's
   block-end stop is superseded as the default). The toggle turns
   that behavior OFF: OFF restores the standing stops exactly.
   The setting is device-local, like the playback rate (§1
   Decision 3): only an expressly stored 'off' reads OFF; a fresh
   store reads ON. Autoplay never STARTS playback: it governs
   only the natural end of a playing track. A restored queue
   still stands paused (v355), and the sleep timer's stop is
   final — the track-mode divert below stands ahead of every
   advance and chain, and the minutes-mode stop is a pause that
   never reaches this handler. */
var AUTOPLAY_KEY = 'opn-autoplay-v358';
function autoplayOn() {
  try { return localStorage.getItem(AUTOPLAY_KEY) !== 'off'; } catch (e) { return true; }
}
function setAutoplay(on) {
  try { localStorage.setItem(AUTOPLAY_KEY, on ? 'on' : 'off'); } catch (e) {}
  syncAutoplayToggles();
}
function syncAutoplayToggles() {
  var on = autoplayOn();
  var label = on ? 'Autoplay On' : 'Autoplay Off';
  var d = document.getElementById('dock-autoplay');
  if (d) { d.textContent = label; d.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  var np = document.getElementById('np-autoplay');
  if (np) { np.textContent = label; np.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  var st = document.getElementById('set-autoplay');
  if (st) { st.textContent = on ? 'On' : 'Off'; st.classList.toggle('on', on); st.setAttribute('aria-pressed', on ? 'true' : 'false'); }
}
/* ---------------- Intentions toggle (v384; re-roled v388) ----------------
   A device-local preference in the autoplay pattern in every
   particular. v388 §2.3 (D1 as approved — repurposed, not
   retired): the SAME store key stands, and the switch now
   governs SHOWING ONLY — the written intention line on the
   playing screen, in each prayer's row, and on the native
   face. Nothing is spoken in either position, so no stored
   value can bring speech back; a stored 'off' reads OFF
   (lines hidden — the visible outcome v384's OFF already
   chose for the line) and 'on' or no value reads shown.
   The Intentions TAB (the pool manager) is untouched in both
   states. Read fresh at the three showing decision points
   (the hero render, the row paint, the native payload) —
   never cached at page load, and a flip re-renders what
   stands (setIntentions below), with no reload. */
var INTENTIONS_KEY = 'opn-intentions-v384';
function intentionsOn() {
  try { return localStorage.getItem(INTENTIONS_KEY) !== 'off'; } catch (e) { return true; }
}
function setIntentions(on) {
  try { localStorage.setItem(INTENTIONS_KEY, on ? 'on' : 'off'); } catch (e) {}
  syncIntentionsToggles();
  updateDock(); // the Now Playing line re-renders under the new store at once
  // v388 §2.3: a flip re-renders what stands — the Now Playing
  // sheet directly when it stands, the Prayers view when it
  // stands (its rows gain/lose the written line), and a native
  // push so the face's subtitle follows at once.
  updateNowPlaying();
  if (state.dayPayload && state.tab === 'prayers') paintPrayersView(state.dayPayload);
  pushNativeState(false);
}
function syncIntentionsToggles() {
  var on = intentionsOn();
  var label = on ? 'Intentions On' : 'Intentions Off';
  var d = document.getElementById('dock-intentions');
  if (d) { d.textContent = label; d.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  var np = document.getElementById('np-intentions');
  if (np) { np.textContent = label; np.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  var st = document.getElementById('set-intentions');
  if (st) { st.textContent = on ? 'On' : 'Off'; st.classList.toggle('on', on); st.setAttribute('aria-pressed', on ? 'true' : 'false'); }
}
function chainForward(fromDesc) {
  // The chain: the fresh whole-day build past the ended track,
  // filtered by the standing queue-build discipline (unplayedOnly
  // — the played filter; a played prayer's text dies with its own
  // descriptor under v384), started
  // as a fresh queue. The ended track is located by (episodeId,
  // block) — the v360 occurrence discipline — so a repeated
  // episode chains from its own daypart. A Play All queue already
  // holds the whole day: its end IS the day's end and the tail
  // stands empty. Returns whether a new queue stands playing.
  if (!fromDesc || !state.dayPayload) return false;
  var full = extRebuildDescs(state.dayPayload);
  var pos = -1;
  for (var i = 0; i < full.length; i++) {
    if (full[i].episodeId === fromDesc.episodeId && (full[i].block || '') === (fromDesc.block || '')) { pos = i; break; }
  }
  if (pos < 0) return false;
  var tail = unplayedOnly(full.slice(pos + 1));
  if (!tail.length) return false;
  startQueue(tail, true);
  return state.queue.length > 0 && state.queueIdx >= 0;
}
audioEl.addEventListener('ended', function () {
  // v344 §2.3: ONE mark call at the top of the handler — every
  // natural end passes this point exactly once, before the sleep
  // divert, before the queue advance (so a queued track stands
  // marked before the queue moves past it), and before the
  // single-play end-clear. The paths that must NOT mark never
  // reach here: the minutes-mode sleep stop is a pause, skips are
  // transport calls, and a partial play fires no ended event.
  var endedDesc = state.current;
  markCompleted(state.current);
  if (state.sleep && state.sleep.mode === 'track') { sleepTrackEnd(); return; }
  if (state.queue.length) {
    if (advanceQueue(1)) return;
    // The queue stands exhausted (advanceQueue has cleared to
    // the standing stop): autoplay ON chains forward through the
    // day; OFF keeps the stop exactly as it stood.
    if (autoplayOn()) chainForward(endedDesc);
    return;
  }
  // A single play's end: the same rule — autoplay ON chains from
  // the ended track through the day; OFF stops, as before.
  if (autoplayOn() && chainForward(endedDesc)) return;
  state.current = null; setPlaybackState('none'); markPlaying(null);
  updateDock();
});
function handleAudioError() {
  // v358 defect fix, second half: a start whose URL cannot play
  // (a refused enclosure read, a torn stream) fires 'error', never
  // 'ended' — before this handler the queue died silently on the
  // failed entry, its remaining entries standing unplayed. The
  // standing entry re-resolves against the fresh build: a landed
  // download substitutes its playable URL and the entry restarts
  // on it. The same URL means the download may still be in flight
  // (the previous pair's minutes are its usual budget) — wait and
  // re-check on a bounded clock; only an entry that still cannot
  // stand when the bound runs out passes over, as a missing entry
  // passes over at advance time.
  if (!state.current || !audioEl.error) return;
  var cur = state.current;
  var inQueue = !!(state.queue.length && state.queueIdx >= 0 && state.queue[state.queueIdx] && state.queue[state.queueIdx].episodeId === cur.episodeId);
  var live = queueLiveDesc(inQueue ? state.queue[state.queueIdx] : cur);
  if (live && live.url && live.url !== cur.url) {
    if (inQueue) state.queue[state.queueIdx] = live;
    state.errWaitKey = null; state.errWaitN = 0;
    startDesc(live);
    return;
  }
  var key = cur.episodeId + '@' + (inQueue ? state.queueIdx : 'single');
  var tries = state.errWaitKey === key ? (state.errWaitN || 0) + 1 : 1;
  state.errWaitKey = key; state.errWaitN = tries;
  if (tries <= 20) {
    var wantId = cur.episodeId, wantIdx = state.queueIdx;
    setTimeout(function () {
      if (state.current && state.current.episodeId === wantId && state.queueIdx === wantIdx && audioEl.error) handleAudioError();
    }, 1500);
    return;
  }
  state.errWaitKey = null; state.errWaitN = 0;
  if (inQueue) { advanceQueue(1); return; }
  state.current = null; setPlaybackState('none'); markPlaying(null);
  updateDock();
}
audioEl.addEventListener('error', function () {
  // Only a start's own failure belongs here (the window is the
  // start's, recorded in startDesc); a paused load standing by
  // (loadResume, the sleep hold) errors outside it and stands.
  if (!state.current || !state.lastStartAt || Date.now() - state.lastStartAt > 4000) return;
  handleAudioError();
});
audioEl.addEventListener('pause', function () { saveResume(); saveQueueSnapshot(); if (!state.queue.length) markPlaying(state.current ? state.current.episodeId : null); });
audioEl.addEventListener('play', function () { setPlaybackState('playing'); updateDock(); pushNativeState(false); });
audioEl.addEventListener('pause', function () { updateDock(); });
audioEl.addEventListener('pause', function () { pushNativeState(false); }); // v377 B2: any element pause states the face
audioEl.addEventListener('pause', function () {
  // v346: the pause event declares the paused session (playbackState
  // 'paused' while a current stands, else 'none') and re-files it —
  // the session goes quiet exactly when it must stay declared.
  setPlaybackState(state.current ? 'paused' : 'none');
  reassertMediaSession();
});
document.addEventListener('visibilitychange', function () {
  // v355 §2.2 trigger 5: the freeze that precedes a discard is a
  // last-chance snapshot write (the v346 re-assert below is
  // untouched — the hook rides the same event, on the way out).
  if (document.visibilityState === 'hidden') saveQueueSnapshot();
  // v346: return to the foreground (including a freeze/thaw) re-files
  // the session — metadata, handlers, state, position.
  if (document.visibilityState === 'visible') reassertMediaSession();
});
window.addEventListener('pagehide', function () { saveQueueSnapshot(); }); // v355 §2.2 trigger 5: the discard moment itself
var lastResumeSave = 0;
var lastQueueSave = 0;
audioEl.addEventListener('timeupdate', function () {
  sleepTick();
  updatePositionState();
  updateDockProgress();
  updateNpSeek();
  var now = Date.now();
  if (now - lastResumeSave > 5000) { lastResumeSave = now; saveResume(); }
  if (now - lastQueueSave > 5000) { lastQueueSave = now; saveQueueSnapshot(); }
});
audioEl.addEventListener('seeked', updatePositionState);
audioEl.addEventListener('seeked', function () { pushNativeState(false); }); // v377 B2: seek is a push trigger

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
  document.getElementById('dock-play').innerHTML = transportPlaying() ? '&#10073;&#10073;' : '&#9654;'; // v375 §2 step 7: the glyph reads the transport
  document.getElementById('dock-next').disabled = !state.queue.length;
  syncAutoplayToggles(); // v358: the dock toggle's label follows the store
  syncIntentionsToggles(); // v384 §2.5: the dock intentions switch follows the store
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
  // v388: the element pause stands alone — no speech phase
  // exists for an expiry to land inside.
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
      setPlaybackState('paused');
      audioEl.src = next.url;
      audioEl.load();
      markPlaying(next.episodeId);
      saveResume();
      saveQueueSnapshot(0); // v355: the held queue stands — the record follows it to the held track at its head
      updateSleepLabel();
      updateDock();
      return;
    }
    // (b) queue exhausted: exactly the standing queue-end path.
    state.queue = []; state.queueIdx = -1; state.current = null; setPlaybackState('none'); markPlaying(null); updatePositionState();
    saveQueueSnapshot(); clearRestoredQueue(); // v355 §2.5: exhaustion clears, here as in advanceQueue
    updateSleepLabel();
    updateDock();
    return;
  }
  // (c) no queue (a single track): exactly the standing end path.
  state.current = null; setPlaybackState('none'); markPlaying(null);
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

// v346: ONE module-level handler table, built once — boot and every
// re-assert register this same object, so the table's identity (and
// the harness hook's target) never drifts across a re-assert.
var mediaHandlers = {
  play: function () { resumeCurrent(); }, // v346 §2.4: the app's resume seam (carries the v320 §2.6 restore point (3) fade restore)
  pause: function () { pauseTransport(); },
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
function registerMediaHandlers() {
  if (oraInShell()) return; // v377 B6: no web action handlers in the shell — transport arrives over the bridge
  if (!('mediaSession' in navigator)) return;
  Object.keys(mediaHandlers).forEach(function (a) {
    try { navigator.mediaSession.setActionHandler(a, mediaHandlers[a]); } catch (e) {}
  });
}
function setupMediaSession() {
  if (oraInShell()) return; // v377 B6
  if (!('mediaSession' in navigator)) return;
  registerMediaHandlers();
  setPlaybackState('none');
  // Harness hook (E9 check 8): Media Session handlers are not readable
  // back from navigator.mediaSession, so the registered handler table
  // is exposed for the gate's agent-side evidence. John's phone check
  // at Review remains the binding criterion.
  window.__opnMediaHandlers = mediaHandlers;
}

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll('#tabbar .tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
  if (tab === 'prayers') renderPrayers();
  else if (tab === 'podcasts') renderPodcasts();
  else if (tab === 'intentions') renderIntentions();
  else if (tab === 'examination') renderExamination();
  else if (tab === 'confession') renderConfession();
}
document.querySelectorAll('#tabbar .tab').forEach(function (b) {
  b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
});
document.getElementById('dock-play').addEventListener('click', function () { if (!state.current) return; if (state.queue.length) { if (transportPlaying()) pauseTransport(); else resumeCurrent(); } else playTrack(state.current); });
document.getElementById('dock-next').addEventListener('click', function () { advanceQueue(1); });
document.getElementById('dock-autoplay').addEventListener('click', function () { setAutoplay(!autoplayOn()); });
document.getElementById('dock-intentions').addEventListener('click', function () { setIntentions(!intentionsOn()); });
document.getElementById('dock').addEventListener('click', function (ev) {
  if (ev.target && ev.target.closest && (ev.target.closest('#dock-play') || ev.target.closest('#dock-next') || ev.target.closest('#dock-autoplay') || ev.target.closest('#dock-intentions'))) return;
  openNowPlaying(); // v336 (D5, approved): the dock tap opens Now Playing — the v326 jump-to-card is retired
});
window.addEventListener('resize', measureBars);
measureBars();

/* ---------------- Podcasts (v381) ----------------
   The listening-progress section (Plan §2.5): a fifth tab whose
   state lives server-side (the §2.2 routes) — the series card,
   the current-episode card (current = the first unlistened
   entry, derived server-side per §2.3), and the full episode
   list in sequence order. Marks live ONLY here: the Prayers tab
   never reads this store (§2.5's no-checklist coexistence).
   v390 §2.7: the tab enters at a SERIES LEVEL (three series —
   Catechism · Bible · Rosary); a card opens the series page,
   which is the v381 presentation below plus a back row. */
function podDesc(e) {
  // v390 §2.7: the descriptor gains the series (the open
  // payload's key) beside the standing fields, so the completion
  // seam can mark the playing episode's OWN series.
  return { episodeId: e.key, kind: 'podcast', seriesKey: e.key, podSeries: state.podcasts ? state.podcasts.series : null, title: e.label + ': ' + e.title, url: e.url, available: !!e.url, block: 'Podcasts', durationS: e.durationS || 0 };
}
function podCurrentKey(entries) {
  // v390 §2.10 (option A amendment, 2026-11-12): the in-memory
  // mirror of the Worker's derivation — current is the first
  // unlistened DAY entry (kind 'day' or 'special' — the Day 366
  // special is a day); a bonus is current only when no unlistened
  // day entry stands.
  var day = null, bonus = null;
  entries.forEach(function (e) {
    if (e.listened) return;
    if (e.kind === 'bonus') { if (!bonus) bonus = e; }
    else if (!day) day = e;
  });
  var cur = day || bonus;
  return cur ? cur.key : null;
}
function writePodMarkQuiet(seqKey, seriesKey, source) {
  // §2.4: the auto-mark write is fire-and-forget from the
  // completion seam (the writePlayedQuiet precedent).
  // v392 W7: a failed write now ENQUEUES (opn-podmark-queue-v1)
  // and drains at the next open / online event — replay is safe
  // against the idempotent mark routes.
  // v390 §2.7: generalized off the v381 literal — the write posts
  // the descriptor's own series. Its in-memory leg mutates the
  // open payload ONLY when the open payload is that series: a
  // Bible episode completing while the Catechism page stands
  // open writes its Bible row server-side (the record) and
  // leaves the open page's counts to its next open.
  post('/api/player/podcasts/mark', { series: seriesKey, seqKey: seqKey, source: source }).catch(function () {
    podMarkEnqueue({ op: 'mark', series: seriesKey, seqKey: seqKey, source: source, queuedAt: new Date().toISOString() });
  });
  if (state.podcasts && state.podcasts.series === seriesKey && state.podcasts.entries) {
    state.podcasts.entries.forEach(function (e) { if (e.key === seqKey && !e.listened) { e.listened = true; e.source = source; e.listenDate = todayChicago(); } });
    var left = state.podcasts.entries.filter(function (e) { return !e.listened; });
    state.podcasts.listenedCount = state.podcasts.entries.length - left.length;
    state.podcasts.currentKey = podCurrentKey(state.podcasts.entries);
  }
}
function renderPodcasts() {
  // v390 §2.7: the tab ALWAYS enters at the series level — an
  // open series does not survive a tab switch. state.podcasts
  // may still hold the last series payload (the auto-mark's
  // mutation rule reads it), but nothing paints it until a card
  // is tapped.
  view.innerHTML = '<h1 class="screen">Podcasts</h1><p class="meta">Loading...</p>';
  api('/api/player/podcasts').then(function (res) {
    state.podcastsIndex = res;
    if (state.tab === 'podcasts') paintPodcastsIndex();
  }).catch(function (e) {
    if (state.tab === 'podcasts') view.innerHTML = '<h1 class="screen">Podcasts</h1><p class="err">' + esc(e.message) + '</p>';
  });
}
function paintPodcastsIndex() {
  // v390 §2.7: the series level — one card per series in
  // registry order (title · counts · current line), the whole
  // card tappable. An unavailable series shows its unavailable
  // line on its own card.
  var res = state.podcastsIndex;
  if (!res || !res.seriesList) { view.innerHTML = '<h1 class="screen">Podcasts</h1><p class="meta">Loading...</p>'; return; }
  var html = '<h1 class="screen">Podcasts</h1>';
  html += offlineLineHtml('pod-offline-btn');
  res.seriesList.forEach(function (s) {
    html += '<div class="card" data-podseries="' + esc(s.series) + '"><h3>' + esc(s.title) + '</h3>';
    if (!s.available) {
      html += '<div class="meta">This series is unavailable right now. Try again later.</div>';
    } else {
      html += '<div class="meta">' + s.listenedCount + ' of ' + s.total + ' listened'
        + (s.currentLabel ? ' · Current: ' + esc(s.currentLabel) : ' · Complete') + '</div>';
    }
    html += '</div>';
  });
  view.innerHTML = html;
  wireOfflineButtons();
  paintOfflineLine();
  view.querySelectorAll('[data-podseries]').forEach(function (c) {
    c.addEventListener('click', function () { openPodSeries(c.getAttribute('data-podseries')); });
  });
}
function openPodSeries(key) {
  view.innerHTML = '<h1 class="screen">Podcasts</h1><p class="meta">Loading...</p>';
  api('/api/player/podcasts?series=' + encodeURIComponent(key)).then(function (res) {
    state.podcasts = res;
    if (state.tab === 'podcasts') paintPodcasts();
  }).catch(function (e) {
    if (state.tab === 'podcasts') view.innerHTML = '<h1 class="screen">Podcasts</h1><p class="err">' + esc(e.message) + '</p>';
  });
}
function wirePodBack() {
  var b = view.querySelector('[data-podback]');
  if (b) b.addEventListener('click', function () { renderPodcasts(); });
}
function paintPodcasts() {
  var res = state.podcasts;
  if (!res) { view.innerHTML = '<h1 class="screen">Podcasts</h1><p class="meta">Loading...</p>'; return; }
  var html = '<h1 class="screen">Podcasts</h1>';
  // v390 §2.7: the back row stands at the top of the series page
  // (the app's standing backrow/backbtn dress) — back re-reads
  // the index, so the counts the marks just changed stand
  // correct.
  html += '<div class="backrow"><button class="backbtn" data-podback>&lsaquo; All series</button></div>';
  html += offlineLineHtml('pod-offline-btn');
  if (!res.available) {
    // §2.1/L9: with no snapshot and the feed unreachable the
    // series stands unavailable — the section's one error surface.
    html += '<div class="card"><h3>' + esc(res.title || 'Catechism in a Year') + '</h3><div class="meta">This series is unavailable right now. Try again later.</div></div>';
    view.innerHTML = html;
    wirePodBack();
    return;
  }
  var cur = null;
  res.entries.forEach(function (e) { if (e.key === res.currentKey) cur = e; });
  html += '<div class="card"><h3>' + esc(res.title) + '</h3><div class="meta">'
    + res.listenedCount + ' of ' + res.total + ' listened'
    + (cur ? ' · Current: ' + esc(cur.label) : ' · Complete') + '</div></div>';
  if (cur) {
    html += '<div class="card"><div class="meta">Current episode</div><div class="row">'
      + '<button class="playbtn" data-podplay="' + esc(cur.key) + '">&#9654;</button>'
      + '<div class="grow"><h3>' + esc(cur.title) + '</h3><div class="meta">' + esc(cur.label) + (cur.durationS ? ' · ' + fmtDur(cur.durationS) : '') + '</div></div>'
      + '</div></div>';
  }
  res.entries.forEach(function (e) {
    html += '<div class="card trow" data-podrow="' + esc(e.key) + '"><div class="row">'
      + '<button class="playbtn" data-podplay="' + esc(e.key) + '">&#9654;</button>'
      + '<div class="grow"><h3>' + esc(e.title) + '</h3><div class="meta">' + esc(e.label) + (e.durationS ? ' · ' + fmtDur(e.durationS) : '') + '</div></div>'
      + '<button class="chipbtn" data-poddl="' + esc(e.key) + '">Get</button>'
      + '<div class="podmark-wrap"><button class="podmark' + (e.listened ? ' on' : '') + '" data-podmark="' + esc(e.key) + '" aria-label="' + (e.listened ? 'Mark as not listened' : 'Mark as listened') + '">' + (e.listened ? '&#10003;' : '&#9711;') + '</button>'
      + (e.listened && e.listenDate ? '<div class="podmark-date">' + esc(e.listenDate) + '</div>' : '')
      + '</div></div></div>';
  });
  view.innerHTML = html;
  view.querySelectorAll('[data-podplay]').forEach(function (b) {
    b.addEventListener('click', function () { playPodFrom(b.getAttribute('data-podplay')); });
  });
  view.querySelectorAll('[data-podmark]').forEach(function (b) {
    b.addEventListener('click', function () { podToggleMark(b.getAttribute('data-podmark')); });
  });
  view.querySelectorAll('[data-poddl]').forEach(function (b) {
    b.addEventListener('click', function () { podDlTap(b.getAttribute('data-poddl')); });
  });
  wireOfflineButtons();
  paintOfflineLine();
  refreshPodDlStates();
  wirePodBack();
  // §2.5: the list opens scrolled to the current entry.
  if (res.currentKey) {
    var el = view.querySelector('[data-podrow="' + res.currentKey + '"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
  }
}
function playPodFrom(key) {
  // §2.5: play queues the sequence from the tapped entry forward
  // through the standing queue machinery.
  var res = state.podcasts;
  if (!res || !res.entries) return;
  var idx = -1;
  res.entries.forEach(function (e, i) { if (e.key === key) idx = i; });
  if (idx < 0) return;
  var descs = res.entries.slice(idx).map(podDesc).filter(function (d) { return d.available; });
  if (!descs.length) return;
  startQueue(descs, true);
}
function podToggleMark(key) {
  // §2.4: one tap marks (source 'manual' — the catch-up path for
  // episodes heard in another player); one tap on a listened row
  // unmarks. No confirm dialog (the standing posture for
  // reversible acts).
  var res = state.podcasts;
  if (!res || !res.entries) return;
  var entry = null;
  res.entries.forEach(function (e) { if (e.key === key) entry = e; });
  if (!entry) return;
  var wasListened = !!entry.listened;
  // v392 W7: the in-memory state updates immediately (the
  // standing behavior for the auto-mark); a failed post enqueues
  // for replay instead of silently dropping the toggle.
  entry.listened = !wasListened;
  entry.source = wasListened ? null : 'manual';
  entry.listenDate = wasListened ? null : todayChicago();
  var left = res.entries.filter(function (e) { return !e.listened; });
  res.listenedCount = res.entries.length - left.length;
  res.currentKey = podCurrentKey(res.entries);
  if (state.tab === 'podcasts') paintPodcasts();
  var call = wasListened
    ? post('/api/player/podcasts/unmark', { series: res.series, seqKey: key })
    : post('/api/player/podcasts/mark', { series: res.series, seqKey: key, source: 'manual' });
  call.catch(function () {
    podMarkEnqueue(wasListened
      ? { op: 'unmark', series: res.series, seqKey: key, queuedAt: new Date().toISOString() }
      : { op: 'mark', series: res.series, seqKey: key, source: 'manual', queuedAt: new Date().toISOString() });
  });
}

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
var SET_BLOCKS = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night', 'Mass and Homilies', 'Novenas', 'The AI Signal'];
var SET_SECTIONS = ['Morning', 'Midmorning', 'Midday', 'Afternoon', 'Evening', 'Night', 'Mass and Homilies', 'Novenas', 'The AI Signal', 'No block', 'Off'];
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
  // v358 §1 Decision 2: the Playback section stands above Source
  // mapping — the autoplay choice lives in the app's standing
  // settings home as well as on the dock and Now Playing. The
  // setting is device-local (Decision 3); this control writes the
  // device store, never the source-mapping save below.
  html += '<h2 class="sectionhead">PLAYBACK</h2><div class="liblist"><div class="setrow">'
    + '<div class="setname">Autoplay</div>'
    + '<div class="meta">Keep playing through the day when a queue ends. Off restores the stop at the end of a block.</div>'
    + '<div class="setcontrols"><button class="settoggle' + (autoplayOn() ? ' on' : '') + '" id="set-autoplay" aria-pressed="' + (autoplayOn() ? 'true' : 'false') + '">' + (autoplayOn() ? 'On' : 'Off') + '</button></div>'
    + '</div>'
    // v384 §2.5: the intentions switch — its own Settings switch
    // in the standing Playback section (NOT a row of the v328
    // source-mapping table, §2.7). Device-local, default ON.
    // v388 §2.3: re-roled to showing only (the copy states the
    // new model); never the Intentions tab.
    + '<div class="setrow">'
    + '<div class="setname">Intentions</div>'
    + '<div class="meta">Show each prayer&rsquo;s intention in writing — on the playing screen, in each prayer&rsquo;s row, and on the lock screen and car display. Nothing is spoken in either position. Off hides the written intention in those places; the Intentions tab is unchanged either way.</div>'
    + '<div class="setcontrols"><button class="settoggle' + (intentionsOn() ? ' on' : '') + '" id="set-intentions" aria-pressed="' + (intentionsOn() ? 'true' : 'false') + '">' + (intentionsOn() ? 'On' : 'Off') + '</button></div>'
    + '</div></div>';
  // v392 W6: the offline store's one hand clear — empties both
  // stores (web + native, through the bridge) in one tap; the
  // next online open refills the automatic set.
  html += '<h2 class="sectionhead">OFFLINE</h2><div class="liblist"><div class="setrow">'
    + '<div class="setname">Offline downloads</div>'
    + '<div class="meta" id="set-offline-counts"></div>'
    + '<div class="setcontrols"><button class="btn ghost" id="set-clear-offline">Clear offline downloads</button></div>'
    + '</div></div>';
  html += '<p class="sub">Source mapping — which podcast plays in which block, on which days, in which order. Changes apply from the next nightly push.</p>';
  html += '<p class="meta">Settings version ' + settingsVersion + '</p>';
  if (settingsNote) html += '<p class="meta">' + esc(settingsNote) + '</p>';
  html += '<p class="err" id="set-err"></p>';
  var secs = settingsSections();
  SET_SECTIONS.forEach(function (sec) {
    var rows = secs[sec];
    if (!rows.length) return;
    html += '<h2 class="sectionhead">' + esc(sec.toUpperCase()) + '</h2><div class="liblist">';
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
    html += '</div>';
  });
  html += '<div class="row" style="margin-top:12px"><button class="btn gold" id="set-save">Save mapping</button><button class="btn ghost" id="set-back">&lsaquo; Back</button></div>';
  html += '<div id="pin-section"></div>';
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
  var apBtn = document.getElementById('set-autoplay');
  if (apBtn) apBtn.addEventListener('click', function () { setAutoplay(!autoplayOn()); });
  var inBtn = document.getElementById('set-intentions');
  if (inBtn) inBtn.addEventListener('click', function () { setIntentions(!intentionsOn()); paintSettings(); });
  var clrBtn = document.getElementById('set-clear-offline');
  if (clrBtn) clrBtn.addEventListener('click', function () { offlineClearAll(); });
  var offCounts = document.getElementById('set-offline-counts');
  if (offCounts) offCounts.textContent = offlineLineText();
  fillPinSection();
}
/* ---------------- Settings \u2014 Confession PIN section (v356 \u00a72.6.4) ----------------
   A standalone section at the end of Settings, apart from the
   source-mapping rows. With no PIN set nothing anywhere else in
   the app mentions the PIN (decision 6). Change and Remove ride
   on the unlock token, so locked they are not offered \u2014 the
   recovery path stands on the gate itself. v373 note: decision
   6's rule that nothing outside this section mentions the PIN
   with none set is reversed for the two gated tabs \u2014 with no
   PIN set they stand locked behind the set-a-PIN prompt (D1-B). */
function fillPinSection() {
  var host = document.getElementById('pin-section');
  if (!host) return;
  fetchPinState().then(function (st) {
    var host2 = document.getElementById('pin-section');
    if (!host2) return;
    var html = '<h2 class="sectionhead pinsection">CONFESSION PIN</h2>';
    if (!st.pinSet) {
      html += '<div class="card"><p style="margin:0 0 8px;line-height:1.55;font-size:15px">No PIN is set. Confession and Examination stay locked until you set one.</p><button class="btn gold" id="pin-set-open">Set a PIN</button></div>';
      host2.innerHTML = html;
      document.getElementById('pin-set-open').addEventListener('click', function () { openPinSetSheet('set'); });
    } else if (pinToken) {
      html += '<div class="card"><p style="margin:0 0 8px;line-height:1.55;font-size:15px">A PIN is set, and this session is unlocked.</p><button class="btn gold" id="pin-change-open">Change PIN</button> <button class="btn ghost" id="pin-remove">Remove PIN</button></div>';
      host2.innerHTML = html;
      document.getElementById('pin-change-open').addEventListener('click', function () { openPinSetSheet('change'); });
      document.getElementById('pin-remove').addEventListener('click', function () {
        if (!confirm('Remove the PIN? Confession and Examination will stay locked until a new PIN is set.')) return;
        post('/api/pin/remove', {}).then(function () { pinToken = null; pinStateCache = { pinSet: false, retryAfterSeconds: 0 }; renderSettings(); })
          .catch(function (e) { if (!pinRefusalGate('settings', renderSettings, e)) alert(e.message); });
      });
    } else {
      html += '<div class="card"><p style="margin:0 0 8px;line-height:1.55;font-size:15px">A PIN is set.</p><button class="btn gold" id="pin-enter-open">Enter PIN</button></div>';
      host2.innerHTML = html;
      document.getElementById('pin-enter-open').addEventListener('click', function () { renderPinGate('settings', renderSettings, {}); });
    }
  }).catch(function () {});
}
function openPinSetSheet(mode) {
  var old = document.querySelector('.pinsetsheet');
  if (old) old.remove();
  var sheet = document.createElement('div'); sheet.className = 'sheet pinsetsheet';
  sheet.innerHTML = '<div class="inner"><div class="row"><h1 class="screen grow">' + (mode === 'set' ? 'Set a PIN' : 'Change PIN') + '</h1><button class="btn ghost" id="ps-close">Close</button></div>'
    + '<p class="meta">' + (mode === 'set'
      ? 'The PIN gates Confession and Examination on this device\u2019s signed-in session. When it is set you will be shown a recovery code, once, for the day the PIN is forgotten.'
      : 'Choose the new PIN. A new recovery code is shown once, and every standing unlock ends.') + '</p>'
    + '<label class="f">New PIN (4-8 digits)</label><input type="password" id="ps-pin1" inputmode="numeric" autocomplete="off">'
    + '<label class="f">New PIN again</label><input type="password" id="ps-pin2" inputmode="numeric" autocomplete="off">'
    + '<p class="pinmsg" id="ps-msg"></p>'
    + '<div style="margin-top:10px"><button class="btn gold" id="ps-save">' + (mode === 'set' ? 'Set PIN' : 'Change PIN') + '</button></div></div>';
  document.body.appendChild(sheet);
  sheet.querySelector('#ps-close').addEventListener('click', function () { sheet.remove(); });
  sheet.querySelector('#ps-save').addEventListener('click', function () {
    var p1 = sheet.querySelector('#ps-pin1').value.trim();
    var p2 = sheet.querySelector('#ps-pin2').value.trim();
    var msg = sheet.querySelector('#ps-msg');
    if (p1 !== p2) { msg.textContent = 'The two entries do not match'; return; }
    if (!/^[0-9]{4,8}$/.test(p1)) { msg.textContent = 'The PIN must be 4-8 digits.'; return; }
    post(mode === 'set' ? '/api/pin/set' : '/api/pin/change', { pin: p1 }).then(function (res) {
      pinToken = res.token;
      pinStateCache = { pinSet: true, retryAfterSeconds: 0 };
      sheet.remove();
      showRecoverySheet(res.recoveryCode, function () { renderSettings(); });
    }).catch(function (e) { msg.textContent = e.message; });
  });
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
  return '<div class="librow"><div class="row"><div class="grow"><div>' + esc(it.text) + '</div><div class="meta">' + hist + '</div></div><span class="pri ' + it.priority + '">' + ({ H: 'High', M: 'Medium', L: 'Low' })[it.priority] + '</span></div><div style="margin-top:8px">' + actions + '</div></div>';
}
function renderIntentions() {
  view.innerHTML = '<h1 class="screen">Intentions</h1><p class="sub">the pool</p><p class="meta">Loading...</p>';
  var today = todayChicago();
  Promise.all([api('/api/prayer/intentions'), api('/api/prayer/day?date=' + today)]).then(function (res) {
    var intentions = res[0].intentions || [];
    var day = res[1] || {};
    applyLiturgical(day);
    var active = intentions.filter(function (i) { return i.status === 'active'; });
    var retired = intentions.filter(function (i) { return i.status !== 'active'; });
    var cnt = { H: 0, M: 0, L: 0 }; active.forEach(function (i) { cnt[i.priority] = (cnt[i.priority] || 0) + 1; });
    // v338 §2.9(3): the per-block segment audio bar retires with
    // the payload's segment fields — the Intentions tab's
    // item/intention listing below stands untouched (§2.9(2)).
    var html = '<h1 class="screen">Intentions</h1><p class="sub">the pool</p>';
    html += '<div class="stats"><div class="stat"><b>' + cnt.H + '</b><span>High</span></div><div class="stat"><b>' + cnt.M + '</b><span>Medium</span></div><div class="stat"><b>' + cnt.L + '</b><span>Low</span></div><div class="stat"><b>' + active.length + '</b><span>active</span></div></div>';
    [['H', 'High · weight 4'], ['M', 'Medium · weight 2'], ['L', 'Low · weight 1']].forEach(function (g) {
      var rows = active.filter(function (i) { return i.priority === g[0]; });
      html += '<h2 class="sectionhead">' + g[1].toUpperCase() + '</h2>';
      html += rows.length ? '<div class="liblist">' + rows.map(intentionRow).join('') + '</div>' : '<p class="meta">None.</p>';
    });
    if (retired.length) {
      html += '<h2 class="sectionhead">RETIRED</h2><div class="liblist">' + retired.map(intentionRow).join('') + '</div>';
    }
    html += '<div class="card"><h3>Add an intention</h3><label class="f">Text</label><input type="text" id="new-text" placeholder="For..."><label class="f">Priority</label><select id="new-pri"><option value="H">High</option><option value="M" selected>Medium</option><option value="L">Low</option></select><div style="margin-top:10px"><button class="btn gold" id="new-add">Add to the pool</button></div><p class="meta" style="margin-top:8px">Adding an intention only adds it — it first enters a draw at the next nightly fill.</p></div>';
    html += '<p class="about">Your intentions live only in this app. The nightly draw runs off this pool for the podcast and the prayer products; this screen tends the pool and does not stage the day.</p>';
    view.innerHTML = html;
    wireIntentions(intentions);
  }).catch(function (e) { view.innerHTML = '<p class="err">' + esc(e.message) + '</p>'; });
}
function wireIntentions(intentions) {
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
function trackDesc(t, day) {
  // v336 P6: source + durationS ride along additively — the one seam
  // both queue builds flow through, so Now Playing's meta line and
  // seek bar see them on every family's descriptor alike.
  // v384 §2.2 ( move 1): the drawn intention text is stamped onto
  // the prayer descriptor itself as its intentionText field,
  // resolved here at the seam by the standing introTextFor (the
  // introTexts map + the novena prefix rule, unchanged). The
  // availability rule carries verbatim from the retired
  // expandDescs pairing: an unavailable prayer carries NO text —
  // no orphan speech for an absent prayer. A descriptor built
  // without its day (queueLiveDesc's external rebuild, search
  // rows) resolves no text here; the start step always reads the
  // live day-build descriptor's field, never a render-time one.
  var d = { episodeId: t.episodeId || ('seg:' + (t._block || '')), title: t.title || 'Intentions', url: t.streamUrl || null, available: !!t.available, block: t._block || '', source: t.source || '', durationS: t.durationS || t.durationSec || 0 };
  if (d.available && day) {
    var text = introTextFor(t, day);
    if (text) d.intentionText = text;
  }
  return d;
}
function buildIntroMap(day) {
  // v375 §2 step 1: the intros map builds from the payload's
  // drawn TEXT (introTexts), synchronously at day load — every
  // paired id the payload carries (the 21 INTRO_PAIRING ids:
  // 5 own, 15 external incl. the Mass and Homilies slots, The
  // AI Signal — D1, all classes) stands resolved BEFORE the
  // first descriptor build, so a paired prayer's intentionText
  // stands at first build, not at feed landing (v384: the map
  // now feeds the descriptor field through introTextFor, not a
  // descriptor of its own). Under D2 (TTS ALWAYS) an entry is
  // text only; the intentions feed's audio is never joined (and
  // the feed keeps publishing untouched, D3). The 'novenas' key
  // is NOT an entry: novena track ids are feed-born and
  // unenumerable here — introTextFor's read seam applies the
  // prefix rule, exactly as the retired feed join did.
  var texts = (day && day.introTexts) || {};
  var map = {};
  Object.keys(texts).forEach(function (id) {
    if (id === 'novenas') return;
    if (texts[id]) map[id] = { text: texts[id] };
  });
  return map;
}
function introTextFor(t, day) {
  // v375 §2 step 2: the one entry-resolution seam — the map
  // entry for the track's own id, else (novena- ids only) the
  // Novenas draw under the prefix rule, read from introTexts
  // directly so the resolution stands on every build path.
  if (!t || !t.episodeId) return null;
  var intro = day && day.intros ? day.intros[t.episodeId] : null;
  if (intro && intro.text) return intro.text;
  if (t.episodeId.indexOf('novena-') === 0) {
    var nt = day && day.introTexts ? day.introTexts['novenas'] : null;
    if (nt) return nt;
  }
  return null;
}
function expandDescs(t, day) {
  // v338 §2.3(2)/(3): THE one expansion seam — both descriptor
  // builds (renderPrayers' initial build and extRebuildDescs) emit
  // prayer descriptors through here, and no other call site may
  // emit one without it.
  // v384 §2.2 ( move 1): the seam stops emitting the spoken
  // descriptor (introDescFor retires with it). It returns the
  // prayer's descriptor ALONE, with the drawn text stamped onto
  // it as its intentionText field at the trackDesc seam (§2.2's
  // stamping point — the availability rule stands there: an
  // unavailable prayer carries no text, no orphans).
  return [trackDesc(t, day)];
}
function readButton(t, key) {
  // v318 T9: the Read control. A track with no text carries NO Read
  // control — the plain not-available line stands in its place
  // (readLine below), never a dead button.
  // v363 §2.3: the button stands BARE in the row's trailing
  // cluster (.trow-tail) — the standing margin-top wrapper div
  // retires. Same data-read attribute, same [data-read] wiring,
  // same openRead target; the reader itself does not change.
  return '<button class="btn ghost small" data-read="' + esc(key) + '">Read</button>';
}
function introForTrack(t) {
  // v384 §2.5/§2.6: the intro read re-points to the descriptor's
  // own field — the prayer descriptor standing in
  // state.dayDescs carries intentionText (stamped at the
  // expandDescs seam), so a reader holding the prayer descriptor
  // (Now Playing, the native face) reads it directly. This
  // fallback serves readers holding a bare track (render-time
  // shapes): the descriptor in the day build first, then the
  // standing map read on state.dayPayload (text-only since
  // v375), then the novena prefix rule. Availability stays the
  // caller's standing rule: an unavailable prayer carries no
  // text (the seam's rule), so no available prayer, no text.
  if (!t || !t.episodeId) return null;
  var d = (state.dayDescs || []).filter(function (x) { return x.episodeId === t.episodeId; })[0];
  if (d && d.intentionText) return { text: d.intentionText, title: d.title };
  var map = state.dayPayload && state.dayPayload.intros;
  var intro = map ? map[t.episodeId] : null;
  if (intro && intro.text) return { text: intro.text, title: '' };
  // v375 §2 step 2: the novena prefix rule at the read seam —
  // a novena track's text stands under the one Novenas draw.
  if (t.episodeId.indexOf('novena-') === 0) {
    var nt = state.dayPayload && state.dayPayload.introTexts ? state.dayPayload.introTexts['novenas'] : null;
    if (nt) return { text: nt, title: '' };
  }
  return null;
}
function armEllipsis(cardEl) {
  // v384: the intention row retires (§2.2) — no .intention-row is
  // ever rendered, so this v343 measurement arm stands inert by
  // construction (its class guard never matches). Kept as the
  // standing helper shape; the render paths that called it stand.
  if (!cardEl || !cardEl.classList || !cardEl.classList.contains('intention-row')) return;
  var btn = cardEl.querySelector('.ellipsis-btn');
  var txt = cardEl.querySelector('.intention-text');
  if (!btn || !txt) return;
  if (cardEl.classList.contains('expanded') || txt.scrollHeight > txt.clientHeight + 1) btn.classList.add('stands');
  else btn.classList.remove('stands');
}
function armAllEllipses() {
  view.querySelectorAll('.card.intention-row').forEach(armEllipsis);
}
function wireExpand(root) {
  // v384: no [data-expand] control is rendered anywhere (the
  // intention row carried the only one) — the wiring pass stands
  // and finds nothing, exactly as its idempotent shape allows.
  (root || view).querySelectorAll('[data-expand]').forEach(function (btn) {
    if (btn.getAttribute('data-expand-wired')) return;
    btn.setAttribute('data-expand-wired', '1');
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-expand');
      var card = btn.closest('.card.intention-row');
      if (!card || !id) return;
      var on = card.classList.toggle('expanded');
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      armEllipsis(card);
    });
  });
}
window.addEventListener('resize', function () { armAllEllipses(); });
/* ---------------- Played chrome (v344) ----------------
   The marker, the Continue card, and the one re-apply path.
   refreshPlayedChrome() owns ALL played chrome: it runs after
   every store write (via writePlayed) and at the end of
   renderPrayers; no other code writes played chrome. */
function playedDotHtml(t) {
  // §2.5: the state dot IS the mark-as control — a real button
  // (44px box, 12px circle drawn by CSS) standing as the last
  // element of the prayer card's row, at the card's RIGHT edge.
  // (v361: the intention intro is its own card standing above —
  // it carries no dot; played state belongs to the prayer.)
  // UNPLAYED =
  // the hollow ring; PLAYED = the same circle filled gold (the
  // .on class) with the title stepped to the meta tone (.heard).
  var id = t.episodeId;
  if (!id) return '';
  // v360 §2.3.2: the dot carries its occurrence's block beside
  // the id (tracks carry it as _block, descriptors as block);
  // refreshPlayedChrome and the toggle repaint/write from the
  // button's own pair of attributes.
  var block = t.block || t._block || '';
  var on = isPlayed(id, presentedDateStr(), block);
  return '<button class="played-dot' + (on ? ' on' : '') + '" data-markplayed="' + esc(id) + '" data-playedblock="' + esc(block) + '" aria-label="' + (on ? 'Mark as unplayed' : 'Mark as played') + '"></button>';
}
function heardCls(t) {
  return isPlayed(t.episodeId, presentedDateStr(), t.block || t._block || '') ? ' class="heard"' : '';
}
var BS_CH = String.fromCharCode(92);
function novenaInfo(episodeId, title) {
  // §2.7: N parses from the track TITLE's standing "Day N" — the
  // words the payload already carries. No match, or N outside
  // 1–9, renders NO line — never a guessed number. The pattern is
  // built from BS_CH, the standing construction (the Bible matcher's):
  // this client ships inside a template literal, where a written
  // backslash cooks — a literal regex would arrive broken.
  if (!episodeId || episodeId.indexOf('novena-') !== 0) return null;
  var m = new RegExp(BS_CH + 'bDay' + BS_CH + 's+(' + BS_CH + 'd{1,2})' + BS_CH + 'b').exec(String(title || ''));
  if (!m) return null;
  var n = Number(m[1]);
  if (!(n >= 1 && n <= 9)) return null;
  var d = presentedDateStr();
  if (!d) return null;
  var byDate = playedMap()[episodeId] || {};
  // M counts the played dates at or before the presented date,
  // capped at the N most recent — a later re-run of the same
  // novena can never inflate the count past its own window.
  var dates = Object.keys(byDate).filter(function (x) { return x <= d; }).sort();
  return { n: n, m: Math.min(dates.length, n) };
}
function novenaLineText(episodeId, title) {
  var info = novenaInfo(episodeId, title);
  if (!info) return '';
  if (info.m === 0) return info.n === 1 ? 'Day 1 of 9 · not yet prayed' : 'Day ' + info.n + ' of 9 · no days prayed yet';
  return 'Day ' + info.n + ' of 9 · prayed ' + info.m + ' of ' + info.n + ' days';
}
function novenaSpanHtml(t) {
  var txt = novenaLineText(t.episodeId, t.title);
  if (!txt) return '';
  return '<span data-novline="' + esc(t.episodeId) + '"> · ' + esc(txt) + '</span>';
}
function blockPlayedCounts(block) {
  // The block's available PRAYER descriptors from the standing
  // day build (unavailable excluded — nothing to play, nothing
  // to mark; every descriptor in the build is a prayer under
  // v384, so no kind exclusion stands).
  var d = presentedDateStr();
  var total = 0, played = 0;
  (state.dayDescs || []).forEach(function (x) {
    if (!x.available || x.block !== block) return;
    total++;
    if (d && isPlayed(x.episodeId, d, x.block)) played++;
  });
  return { total: total, played: played };
}
function refreshPlayedChrome() {
  var d = presentedDateStr();
  if (!d || !view) return;
  view.querySelectorAll('[data-markplayed]').forEach(function (btn) {
    var id = btn.getAttribute('data-markplayed');
    var on = isPlayed(id, d, btn.getAttribute('data-playedblock') || '');
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-label', on ? 'Mark as unplayed' : 'Mark as played');
    var card = btn.closest('[data-card]');
    if (card) {
      var h = card.querySelector('h3');
      if (h) h.classList.toggle('heard', on);
    }
  });
  view.querySelectorAll('[data-novline]').forEach(function (sp) {
    var id = sp.getAttribute('data-novline');
    var t = state.readTracks[id];
    var card = sp.closest('[data-card]');
    var title = t ? t.title : (card && card.querySelector('h3') ? card.querySelector('h3').textContent : '');
    var txt = novenaLineText(id, title);
    sp.textContent = txt ? ' · ' + txt : '';
  });
  view.querySelectorAll('[data-bprayed]').forEach(function (sp) {
    var c = blockPlayedCounts(sp.getAttribute('data-bprayed'));
    sp.textContent = c.total ? ' · ' + c.played + ' prayed' : '';
  });
  view.querySelectorAll('[data-markblock]').forEach(function (btn) {
    var c = blockPlayedCounts(btn.getAttribute('data-markblock'));
    btn.textContent = (c.total && c.played === c.total) ? 'Mark all unplayed' : 'Mark all played';
  });
  paintContinue();
  renderQueueList();
}
function wirePlayed(root) {
  // v344: the marker + block mark-all wiring, at the same render
  // paths that wire [data-playkey] (initial build, insert, swap).
  // Per-element and idempotent, like wireExpand. The dot tap
  // NEVER starts or stops audio — its own handler, no play wiring.
  (root || view).querySelectorAll('[data-markplayed]').forEach(function (btn) {
    if (btn.getAttribute('data-played-wired')) return;
    btn.setAttribute('data-played-wired', '1');
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-markplayed');
      var block = btn.getAttribute('data-playedblock') || '';
      var d = presentedDateStr();
      if (!id || !d) return;
      if (isPlayed(id, d, block)) writePlayed(id, d, null, block);
      else writePlayed(id, d, 'marked', block);
    });
  });
  (root || view).querySelectorAll('[data-markblock]').forEach(function (btn) {
    if (btn.getAttribute('data-played-wired')) return;
    btn.setAttribute('data-played-wired', '1');
    btn.addEventListener('click', function () {
      var block = btn.getAttribute('data-markblock');
      var d = presentedDateStr();
      if (!block || !d) return;
      var c = blockPlayedCounts(block);
      var unmark = c.total > 0 && c.played === c.total;
      (state.dayDescs || []).forEach(function (x) {
        if (!x.available || x.block !== block) return;
        // Unavailable tracks are never written, either way; one
        // tap writes the block's whole available set.
        if (unmark) { if (isPlayed(x.episodeId, d, x.block)) writePlayedQuiet(x.episodeId, d, null, x.block); }
        else if (!isPlayed(x.episodeId, d, x.block)) writePlayedQuiet(x.episodeId, d, 'marked', x.block);
      });
      refreshPlayedChrome();
    });
  });
}
function trackCard(t) {
  var key = t.episodeId || ('seg:' + (t._block || ''));
  // v384 §2.2/§2.6: the intention ROW retires — trackCard returns
  // the prayer card alone, always. Before v384 (v361 §2.3), an
  // available paired track returned intentionRowCard + the
  // prayer card as two sibling cards.
  // v388 §2.4: the WRITTEN line comes to the rows — for an
  // AVAILABLE track whose drawn text resolves (the standing
  // introForTrack read), the card gains the line INSIDE the
  // card, under the meta, in the standing .intention-text form:
  // "Prayer Intention: " + the text. NOT the v361 sibling row —
  // no second card, no play control. The toggle reads at paint
  // (OFF renders no line); an unavailable prayer carries no
  // line (the trackDesc stamping rule, applied at the row);
  // unpaired tracks resolve no text. A paired row grows past
  // the v363 uniform 76px by the line's height, as planned.
  var intLine = '';
  if (t.available && intentionsOn()) {
    var intIntro = introForTrack(t);
    if (intIntro && intIntro.text) intLine = '<div class="intention-text">Prayer Intention: ' + esc(intIntro.text) + '</div>';
  }
  var wrap = function (rowInner) {
    // v344 §2.5: wrap serves the AVAILABLE branches only (the
    // unavailable cards return their own shapes below and carry
    // NO marker) — the played dot stands as the prayer row's last
    // element, after the .grow column, for both families alike.
    return '<div class="card trow" data-card="' + esc(key) + '"><div class="row">' + rowInner + playedDotHtml(t) + '</div></div>';
  };
  if (t.kind === 'external') {
    // v324 §2.9: an external track names its source in the meta line
    // (D5); a miss stands as "Not available today". No Read control —
    // externals carry no text (the payload's hasText is false), and a
    // present external carries no not-available line.
    if (t.available) {
      return wrap('<button class="playbtn" data-playkey="' + esc(key) + '" data-url="' + esc(t.streamUrl) + '">&#9654;</button><div class="grow"><h3' + heardCls(t) + '>' + esc(t.title) + '</h3><div class="meta">Plays here · ' + esc(t.source || '') + (t.durationS ? ' · ' + fmtDur(t.durationS) : '') + '</div>' + intLine + '</div>');
    }
    // v363 §2.2/§2.3: the unavailable card takes the .row form
    // and the .trow height; "Not available today" folds into
    // the meta line after the duration (omitted when none
    // stands, as today). No tail stands — an external carries
    // neither a Read control nor a Spotify link.
    return '<div class="card trow" data-card="' + esc(key) + '"><div class="row"><div class="grow"><h3>' + esc(t.title) + '</h3><div class="meta">' + (t.durationS ? fmtDur(t.durationS) + ' \u00b7 ' : '') + 'Not available today</div></div></div></div>';
  }
  if (t.available) {
    // v344 gate correction (harness-v343 clip guard, leg 20's
    // named gate): §2.7's novena line appended to the FULL standing
    // meta wraps the combined row's meta to three lines and the
    // row's content stands 144px against v343's 136px uniform row
    // (the guard's ≤137) — the only rows that overflow. On a
    // novena row the meta's "episode file" segment (unpinned,
    // the row's least informative words) gives way to the pinned
    // line: meta = "Plays here" + duration + the §2.7 span, two
    // lines, content 128px. Non-novena metas are byte-identical.
    // v363 §2.4 SUPERSEDES the composition order on novena rows:
    // under D2's one-line ellipsis the span — standing at the
    // END of the line — would be the first thing clipped,
    // silently undoing the v344 protection; the span moves
    // BEFORE the duration so the duration tail clips first.
    // Non-novena composition is unchanged. v363 §2.3: the
    // no-text fold appends to the meta (" · Not available in
    // the app yet"), and the Read control + Spotify link leave
    // .grow for the .trow-tail cluster after it (the played
    // dot follows the cluster — wrap appends it last, v344
    // chrome untouched). Read stands over the Spotify link.
    var novSpan = novenaSpanHtml(t);
    var noText = !(t.hasText && t.textUrl);
    var meta = 'Plays here'
      + (novSpan ? novSpan + (t.durationS ? ' · ' + fmtDur(t.durationS) : '') : ' · episode file' + (t.durationS ? ' · ' + fmtDur(t.durationS) : ''))
      + (noText ? ' · Not available in the app yet' : '');
    var tail = (!noText || t.spotifyUrl)
      ? '<div class="trow-tail">' + (!noText ? readButton(t, key) : '')
        + (t.spotifyUrl ? '<a class="spot" target="_blank" rel="noopener" href="' + esc(t.spotifyUrl) + '">Open in Spotify</a>' : '') + '</div>'
      : '';
    return wrap('<button class="playbtn" data-playkey="' + esc(key) + '" data-url="' + esc(t.streamUrl) + '">&#9654;</button><div class="grow"><h3' + heardCls(t) + '>' + esc(t.title) + '</h3><div class="meta">' + meta + '</div>' + intLine + '</div>' + tail);
  }
  // v363 §2.2/§2.3: the own unavailable card takes the .row form
  // and the .trow height; "Not available in the app yet" folds
  // into the meta after the duration (omitted when none stands,
  // as today); the Read control and Spotify link stand in the
  // .trow-tail cluster as the row's last element (no played
  // dot stands on an unavailable branch — the standing rule).
  var tailU = ((t.hasText && t.textUrl) || t.spotifyUrl)
    ? '<div class="trow-tail">' + (t.hasText && t.textUrl ? readButton(t, key) : '')
      + (t.spotifyUrl ? '<a class="spot" target="_blank" rel="noopener" href="' + esc(t.spotifyUrl) + '">Open in Spotify</a>' : '') + '</div>'
    : '';
  return '<div class="card trow" data-card="' + esc(key) + '"><div class="row"><div class="grow"><h3>' + esc(t.title) + '</h3><div class="meta">' + (t.durationS ? fmtDur(t.durationS) + ' · ' : '') + 'Not available in the app yet</div></div>' + tailU + '</div></div>';
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
    + '<div class="np-hero">'
    + '<div class="row"><span class="grow"></span><button class="btn ghost" id="np-min" aria-label="Minimize">&#8964;</button></div>'
    + '<div class="np-art"><img src="/logo.png" alt="Ora Pro Nobis logo"></div>'
    + '<h1 class="screen np-title" id="np-title"></h1>'
    + '<p class="sub np-meta" id="np-meta"></p>'
    + '<div class="np-intention" id="np-intention" style="display:none"></div>'
    + (state.liturgical && state.liturgical.name ? '<div class="np-litday" id="np-litday">' + esc(state.liturgical.name) + '</div>' : '')
    + '</div>'
    + '<div class="np-seekrow"><span id="np-elapsed">0:00</span><input type="range" id="np-seek" min="0" max="1000" value="0" aria-label="Seek"><span id="np-remain">--:--</span></div>'
    + '<div class="np-transport"><button class="np-tbtn" id="np-prev" aria-label="Previous track">&#9198;</button><button class="playbtn np-play" id="np-play" aria-label="Play or pause">&#9654;</button><button class="np-tbtn" id="np-next" aria-label="Next track">&#9197;</button></div>'
    + '<div class="row np-controls"><button class="btn ghost" id="np-speed"></button><button class="btn ghost" id="np-sleep"></button><button class="btn ghost" id="np-autoplay">Autoplay On</button><button class="btn ghost" id="np-intentions">Intentions On</button><button class="btn ghost" id="np-read">Read</button></div>'
    + '<div class="npq-head"><span class="npq-heading">Queue</span><span class="meta" id="np-queue-pos"></span></div>'
    + '<div id="np-queue"></div>'
    + '</div>';
  document.body.appendChild(sheet);
  sheet.querySelector('#np-min').addEventListener('click', function () { sheet.remove(); });
  sheet.querySelector('#np-play').addEventListener('click', function () { if (!state.current) return; if (state.queue.length) { if (transportPlaying()) pauseTransport(); else resumeCurrent(); } else playTrack(state.current); });
  sheet.querySelector('#np-prev').addEventListener('click', function () { advanceQueue(-1); });
  sheet.querySelector('#np-next').addEventListener('click', function () { advanceQueue(1); });
  sheet.querySelector('#np-speed').addEventListener('click', function () { openSpeedSheet(); });
  sheet.querySelector('#np-sleep').addEventListener('click', function () { openSleepSheet(); });
  sheet.querySelector('#np-autoplay').addEventListener('click', function () { setAutoplay(!autoplayOn()); });
  sheet.querySelector('#np-intentions').addEventListener('click', function () { setIntentions(!intentionsOn()); });
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
  if (sheet.classList.contains('np-preview')) { renderQueueList(); return; }
  var cur = state.current;
  if (!cur) { sheet.remove(); return; }
  sheet.querySelector('#np-title').textContent = cur.title || '';
  var meta = cur.block || '';
  if (cur.source) meta = meta ? meta + ' · ' + cur.source : cur.source;
  if (!meta) meta = state.dateLabel || '';
  sheet.querySelector('#np-meta').textContent = meta;
  var litEl = sheet.querySelector('#np-litday'); if (litEl) { var ln = (state.liturgical && state.liturgical.name) || ''; if (litEl.textContent !== ln) litEl.textContent = ln; }
  var intEl = sheet.querySelector('#np-intention');
  if (intEl) {
    // v384 §2.5: the line reads the current prayer's own
    // intentionText field, gated by the toggle store read at
    // render time. ON with a text → the v372 line's exact string
    // and place (hero, under the block/source line, above the
    // liturgical day line); OFF or no text → emptied AND
    // display:none — absent, not blank. The render runs at the
    // start's bookkeeping, so the line already stands during
    // the speech phase and while the prayer plays.
    var intText = intentionsOn() ? (cur.intentionText || null) : null;
    if (intText) { intEl.textContent = 'Prayer Intention: ' + intText; intEl.style.display = ''; }
    else { intEl.textContent = ''; intEl.style.display = 'none'; }
  }
  sheet.querySelector('#np-play').innerHTML = transportPlaying() ? '&#10073;&#10073;' : '&#9654;'; // v375 §2 step 7: the glyph reads the transport
  sheet.querySelector('#np-prev').disabled = !state.queue.length || state.queueIdx <= 0;
  sheet.querySelector('#np-next').disabled = !state.queue.length;
  sheet.querySelector('#np-speed').textContent = state.rate + '×';
  sheet.querySelector('#np-sleep').textContent = sleepLabel();
  syncAutoplayToggles(); // v358: the Now Playing toggle's label follows the store
  syncIntentionsToggles(); // v384 §2.5: the intentions switches follow the store at every render
  var rt = state.readTracks[cur.episodeId];
  sheet.querySelector('#np-read').style.display = (rt && rt.hasText && rt.textUrl) ? '' : 'none';
  updateNpSeek();
  renderQueueList();
}
function updateNpSeek() {
  var sheet = document.querySelector('.np-sheet');
  if (!sheet || npScrubbing) return;
  var bar = sheet.querySelector('#np-seek');
  if (!bar) return;
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
   the payload no longer carries stored externals); the external
   slots then resolve live, in place: Sing the Hours by a direct
   feed read in this client, Divine Office through the Worker
   courier (its feed forbids browser reads), and — v337
   §2.8 — Daily Gospel Exegesis and Saint of the Day by direct feed
   reads with ported bundle matchers (their downloads follow each
   slot's probed posture: pass-through only, resp. direct-first).
   v350: Bible in a Year resolves through the Worker courier too —
   its on-device read of the 9.2 MB Fireside feed (8 s abort +
   full DOM parse) was the app's most fragile leg and settled the
   slot named-missing on any failure though the episode stood in
   the feed (Day 314, 2026-11-10); the Worker resolves it with
   the same matcher the audio pass-through uses. Its DOWNLOAD
   keeps the direct-first posture below.
   Source settings are read at open and applied identically
   to every leg. Resolved present slots are kept in the device-local
   day cache (opn-ext-cache-v1): valid only for the same PRESENTED
   day (v337 — resolution keys on the calendar day the payload
   presents) and the same settings version; only present slots are
   written, so a missing slot re-checks on the next open. AMENDMENT A1
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
  { slotId: 'ext-bible-in-a-year', title: null, source: 'Bible in a Year', courier: true },
  { slotId: 'ext-gospel-exegesis', title: 'Daily Gospel Exegesis', source: 'Logical Bible Study', feedUrl: 'https://anchor.fm/s/1025ef1c/podcast/rss', matcher: 'latest-by-release-date', download: 'passthrough', courier: true },
  { slotId: 'ext-midmorning-prayer', title: 'Midmorning Prayer' },
  { slotId: 'ext-midday-prayer', title: 'Midday Prayer' },
  { slotId: 'ext-saint-of-the-day', title: 'Saint of the Day', source: 'Good Catholic', feedUrl: 'https://rss.buzzsprout.com/2216056.rss', matcher: 'latest-by-release-date-title', download: 'direct-first' },
  { slotId: 'ext-midafternoon-prayer', title: 'Midafternoon Prayer' },
  { slotId: 'ext-office-of-readings', title: 'Office of Readings' },
  { slotId: 'ext-evening-prayer', title: 'Evening Prayer', fallbackToken: 'Vespers' },
  { slotId: 'ext-night-prayer', title: 'Night Prayer' },
  { slotId: 'ext-usccb-readings', title: 'USCCB Daily Readings', source: 'USCCB', courier: true, download: 'direct-first' },
  { slotId: 'ext-daily-tv-mass', title: 'Daily TV Mass', source: 'Daily TV Mass', feedUrl: 'https://rss.buzzsprout.com/949645.rss', matcher: 'title-date', download: 'direct-first' },
  { slotId: 'ext-fr-mike-homily', title: 'Fr. Mike Sunday Homily', source: 'Fr. Mike Schmitz', courier: true, download: 'direct-first' },
  { slotId: 'ext-barron-sermon', title: 'Bp. Barron Sunday Sermon', source: 'Word on Fire', courier: true, download: 'direct-first' }
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
var EXT_STH_URL = 'https://feeds.castos.com/x8g54';
/* v342 §2.1/§2.2: the podcast-style pull. Own episodes resolve
   from the SAME podcast feed the runner publishes (the client
   fetches the canonical host directly — the runner's
   jctebo.github.io URL 301-redirects to it and the client does
   not chase the redirect); intentions resolve from the rolling
   intentions feed on the same host. Both feeds send ACAO * — the
   XML fetches direct; the AUDIO host sends no ACAO, so downloads
   route through the Worker feed-audio pass-through while
   playback streams direct (the v334 posture, §2.3). */
var OWN_FEED_URL = 'https://orapronobis.media/podcast.xml';
var INTRO_FEED_URL = 'https://orapronobis.media/intentions.xml';
// The canonical episode ids are the stems both models share —
// descriptor ids are NEVER re-keyed (the v344 keying pin).
// 'novenas' is the one multi-item family: its canonical ids are
// per-saint (novena-<slug>), resolved from the item stems.
var OWN_ROW_EPISODE = {
  'morning-prayer': 'morning-prayer', 'daily-rosary': 'daily-rosary',
  'marian-antiphon': 'marian-antiphon-angelus', 'marian-antiphon-midday': 'marian-antiphon-angelus',
  'marian-antiphon-evening': 'marian-antiphon-angelus', 'novenas': 'novenas',
  'auxilium-christianorum': 'auxilium-christianorum', 'daily-reflection': 'daily-reflection'
};
var OWN_STEM_TO_ID = {
  'morning-prayer-elevenlabs': 'morning-prayer', 'daily-rosary': 'daily-rosary',
  'marian-antiphon-angelus': 'marian-antiphon-angelus',
  'auxilium-christianorum': 'auxilium-christianorum', 'daily-reflection': 'daily-reflection'
};
// Gate surface (§2.11 leg 14): the streaming measure reads the
// bytes the own parse actually consumed.
window.__opnV342 = { ownFeedBytes: function () { return state.ownFeedBytes || 0; } };
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
function extMatchLatestByDate(items, dateStr) {
  // v337 §2.8: the bundle contract's latest_by_release_date ported
  // (the daily-gospel-exegesis resolver DGE; the Saint matcher
  // below shares the pick) — the item with the latest release date
  // NOT AFTER the presented date; an enclosure is part of the
  // match; ties keep feed order. The TS port of
  // jobs/externals_resolver.py's oracle; harness-v337 legs 10/11
  // prove the client pick == the Worker pass-through pick.
  var p = dateStr.split('-').map(Number);
  var endMs = Date.UTC(p[0], p[1] - 1, p[2], 23, 59, 59, 999);
  var best = null;
  items.forEach(function (it) {
    if (!it.url || it.pubMs == null || it.pubMs > endMs) return;
    if (!best || it.pubMs > best.pubMs) best = it;
  });
  return best;
}
var EXT_MONTHS_FULL_C = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var EXT_MONTHS_ABBR_C = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function extTitleNamesDate(title, dateStr) {
  // String-ops month/day title check (no backslash patterns may
  // stand in APP_JS — the template-cooking rule): "<Month> <D>"
  // with a non-digit after the day, so Nov 9 never matches Nov 19
  // and Nov 2 never matches Nov 29.
  var p = dateStr.split('-').map(Number);
  var names = [EXT_MONTHS_FULL_C[p[1] - 1], EXT_MONTHS_ABBR_C[p[1] - 1]];
  for (var i = 0; i < names.length; i++) {
    var needle = names[i] + ' ' + p[2];
    var at = title.indexOf(needle);
    while (at >= 0) {
      var after = title.charAt(at + needle.length);
      if (after < '0' || after > '9') return true;
      at = title.indexOf(needle, at + 1);
    }
  }
  return false;
}
function extMatchTvMass(items, dateStr) {
  // v339 §2.3: the builder's title/date matching — the item whose
  // title names the presented day; title term + title date,
  // enclosure required. The Worker pass-through proves parity.
  var found = null;
  items.forEach(function (it) {
    if (found || !it.url) return;
    if (it.title.indexOf('Daily TV Mass') >= 0 && extTitleNamesDate(it.title, dateStr)) found = it;
  });
  return found;
}
function extMatchSaint(items, dateStr) {
  // v337 §2.8: latest_by_release_date with the title's MM/DD prefix
  // checked against the presented date — a latest item whose title
  // date disagrees stands named-missing, never a wrong-day saint.
  var it = extMatchLatestByDate(items, dateStr);
  if (!it) return null;
  var p = dateStr.split('-').map(Number);
  var prefix = (p[1] < 10 ? '0' : '') + p[1] + '/' + (p[2] < 10 ? '0' : '') + p[2];
  return it.title.indexOf(prefix) === 0 ? it : null;
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
  // v392 W6: record-only now — the wholesale audio-store delete
  // was the one-day design retiring with the rolling window; the
  // store's entries are day-keyed and leave by keyed eviction
  // (offlineEvict), never by a blanket delete at a day change.
}
function extDownloadingCard(slot) {
  return '<div class="card trow" data-card="' + esc(slot.slotId) + '"><h3>' + esc(slot.title || 'Bible in a Year') + '</h3><div class="meta">Downloading&hellip;</div></div>';
}
function extPlaceholderCard(slot) {
  return '<div class="card trow" data-card="' + esc(slot.slotId) + '"><h3>' + esc(slot.title || 'Bible in a Year') + '</h3><div class="meta">Loading&hellip;</div></div>';
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
  // v384: the fragment carries ONE node — the prayer card alone
  // (the intention row retired with the spoken-descriptor model;
  // v361 §2.4's two-node pair rule is superseded). Take ALL of
  // the fragment's children and replace the old card with them
  // in order, as the standing swap discipline reads.
  // A pre-v384 page standing in the DOM across the swap (never
  // in production, where the client reloads whole) could carry
  // a standing intention row for THIS slot as the old card's
  // immediately preceding sibling — it is removed with the card,
  // so no retired row can strand.
  var prevIntro = null;
  var prev = old.previousElementSibling;
  if (prev && prev.classList && prev.classList.contains('intention-row') && prev.getAttribute('data-card') === 'intro:' + slot.slotId) prevIntro = prev;
  var nodes = [];
  while (tmp.firstChild) nodes.push(tmp.removeChild(tmp.firstChild));
  nodes.forEach(function (n) { old.parentNode.insertBefore(n, old); });
  old.remove();
  if (prevIntro) prevIntro.remove();
  nodes.forEach(function (fresh) {
    // A settled slot carries ONE play button (the prayer's own)
    // — wired by its data-playkey against the descriptor list.
    fresh.querySelectorAll('[data-playkey]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = (state.dayDescs || []).filter(function (x) { return x.episodeId === b.getAttribute('data-playkey'); })[0];
        if (d) tapPlay(d);
      });
    });
    // v343 §2.4: the swap path arms the ellipsis like every other.
    wireExpand(fresh);
    armEllipsis(fresh);
    // v344: the settled card's marker wires here too, and the
    // played chrome re-applies over the swap.
    wirePlayed(fresh);
  });
  refreshPlayedChrome();
  if (state.current && state.current.episodeId === slot.slotId) markPlaying(slot.slotId);
}
function blockInsertCards(day, standing) {
  // v348 §2.1: ONE merged inserter replaces extInsertCards +
  // ownInsertCards. Per block, own rows and external slots are
  // merge-sorted by settings sortOrder ACROSS families (own
  // entries built first, so a production-impossible tie resolves
  // own-first by the runtime's stable sort) and inserted in that
  // order against the next-blockhead anchor — the anchor
  // extInsertCards used — so payload cards the shell already
  // rendered (the block's Intentions segment) keep their standing
  // place at the block's head, ahead of every settings row.
  // v353 \u00a72.4 \u2014 the audit's one exception: the anchor indexing
  // below (the next-.blockhead anchor) presumed the flat
  // all-blocks paint, which B retires. Under DOM narrowing the
  // block's rows stand only on its own page, so insertions land
  // THERE, appended after the page's painted rows in the same
  // merged order; on every other paint (home, search results,
  // another block's page, another tab) nothing inserts \u2014 the
  // descriptors stand in state and the page paint renders the
  // settled state when the page opens (appendBlockSettingsCards).
  (day.blocks || []).forEach(function (b) {
    var head = view.querySelector('.blockpage-head');
    if (!head || head.getAttribute('data-block') !== b.block) return;
    var entries = [];
    (state.ownStanding || []).filter(function (r) { return r.block === b.block; })
      .forEach(function (row) { entries.push({ sortOrder: row.sortOrder || 0, own: row }); });
    standing.filter(function (sl) { return sl.block === b.block; })
      .forEach(function (slot) { entries.push({ sortOrder: slot.sortOrder || 0, ext: slot }); });
    if (!entries.length) return;
    entries.sort(function (a, c) { return a.sortOrder - c.sortOrder; });
    entries.forEach(function (e) {
      if (e.own) {
        var row = e.own;
        var st = state.ownSlots[row.sourceKey];
        var tmp = document.createElement('div');
        // v368 §2.5.3: a row settled MISSING before the insert
        // (the shell-resolved AI Signal row) paints its missing
        // card, not the placeholder — the append path's standing
        // shape. Feed rows are never missing at insert time.
        tmp.innerHTML = st && st.state === 'present' ? st.tracks.map(function (m) { return trackCard(ownSlotTrack(row, m, day.presentedDay || day.date)); }).join('')
          : (st && st.state === 'missing' ? trackCard(ownSlotTrack(row, { episodeId: row.episodeId, title: row.title, state: 'missing' }, day.presentedDay || day.date)) : ownPlaceholderCard(row));
        var nodes = [];
        while (tmp.firstChild) nodes.push(tmp.removeChild(tmp.firstChild));
        nodes.forEach(function (el) {
          el.setAttribute('data-own-row', row.sourceKey);
          view.appendChild(el);
          el.querySelectorAll('[data-playkey]').forEach(function (b2) {
            b2.addEventListener('click', function () {
              var d = (state.dayDescs || []).filter(function (x) { return x.episodeId === b2.getAttribute('data-playkey'); })[0];
              if (d) tapPlay(d);
            });
          });
          el.querySelectorAll('[data-read]').forEach(function (b2) {
            b2.addEventListener('click', function () {
              var t = state.readTracks[b2.getAttribute('data-read')];
              if (t) openRead(t);
            });
          });
          wireExpand(el);
          armEllipsis(el);
          wirePlayed(el);
        });
      } else {
        var slot = e.ext;
        var st2 = state.extSlots[slot.slotId];
        var tmp2 = document.createElement('div');
        tmp2.innerHTML = st2 && st2.state === 'present' ? trackCard(extSlotTrack(slot, st2)) : extPlaceholderCard(slot);
        // The fragment carries the prayer card alone under v384
        // (v361 §2.4's pair rule superseded) — take ALL of its
        // children, in order, never firstChild alone.
        var nodes2 = [];
        while (tmp2.firstChild) nodes2.push(tmp2.removeChild(tmp2.firstChild));
        nodes2.forEach(function (el2) {
          view.appendChild(el2);
          el2.querySelectorAll('[data-playkey]').forEach(function (b2) {
            b2.addEventListener('click', function () {
              var d = (state.dayDescs || []).filter(function (x) { return x.episodeId === b2.getAttribute('data-playkey'); })[0];
              if (d) tapPlay(d);
            });
          });
          wireExpand(el2);
          armEllipsis(el2);
          wirePlayed(el2);
        });
      }
    });
  });
  refreshPlayedChrome();
}
/* ---------------- v359 OraDayBridge snapshot ----------------
   Route B's payload path (Plan §2.4): the native Android shell's
   media service cannot read the day the way this client does —
   the track list is built here, on the device, inside John's
   Access session (v334's model), and no server payload carries
   it. At the end of every descriptor rebuild the client hands
   the native side a snapshot of the resolved day through the
   OraDayBridge Capacitor plugin; the media service serves the
   snapshot to Android Auto. Guarded and inert everywhere else:
   with no Capacitor present the call is a no-op and the day
   builds byte-identically, and the call is fire-and-forget — it
   can never fail the day build. mediaUri values are computed
   from PRE-BLOB source fields only: a blob: URL is WebView-local
   and meaningless to native code, so one never enters the
   snapshot. */
function oraSnapshotTrack(d, date) {
  var origin = location.origin;
  // v384 §2.2: the intention snapshot branch retires with the
  // spoken descriptor — the day build carries no intention
  // entries, so the native snapshot (the car's day) holds
  // prayers only, exactly as the queue does. (Before v384 an
  // intro descriptor emitted a feed-audio pass-through entry.)
  var st = state.extSlots && state.extSlots[d.episodeId];
  if (st) {
    var slot = (state.extStanding || []).filter(function (s) { return s.slotId === d.episodeId; })[0];
    if (slot && slot.download === 'passthrough') {
      // The passthrough class (Gospel Exegesis): the enclosure
      // chain sends no CORS header, so the client itself plays
      // this slot through the Worker pass-through — the native
      // side uses the same standing route (§2.5's courier class).
      return { id: d.episodeId, block: d.block || '', title: d.title || '', kind: 'external', durationS: d.durationS || 0,
        mediaUri: origin + '/api/player/externals/audio?date=' + encodeURIComponent(date) + '&slot=' + encodeURIComponent(d.episodeId), needsAuth: true };
    }
    var pre2 = st.enclosureUrl || (st.streamUrl && String(st.streamUrl).indexOf('blob:') !== 0 ? String(st.streamUrl) : '');
    if (!pre2) return null;
    var onOrigin = pre2.indexOf(origin + '/') === 0 || pre2.charAt(0) === '/';
    return { id: d.episodeId, block: d.block || '', title: d.title || '', kind: 'external', durationS: d.durationS || 0,
      mediaUri: pre2.charAt(0) === '/' ? origin + pre2 : pre2, needsAuth: onOrigin };
  }
  // Own episode: the standing session-gated Range route (§2.5),
  // keyed by the presented day and the episode id — the native
  // equivalent of the descriptor, independent of download state.
  return { id: d.episodeId, block: d.block || '', title: d.title || '', kind: 'episode', durationS: d.durationS || 0,
    mediaUri: origin + '/api/player/audio/' + encodeURIComponent(date) + '/' + encodeURIComponent(d.episodeId), needsAuth: true };
}
function oraDaySnapshot() {
  var date = state.presentedDay || state.storedDay || null;
  if (!date) return null;
  var tracks = [];
  (state.dayDescs || []).forEach(function (d) {
    if (!d || !d.available) return;
    var t = oraSnapshotTrack(d, date);
    if (t) tracks.push(t);
  });
  return { presentedDay: date, dateLabel: state.dateLabel || '', generatedAt: new Date().toISOString(), tracks: tracks,
    // v377 §2.6 snapshot v2: the standing queue order + index, so
    // a car-side queue and the phone's queue are the same list.
    // v1 readers ignore both fields; live state never rides the
    // snapshot (it crosses on the B1 channel only).
    queueIds: (state.queue || []).map(function (d) { return d.episodeId; }), currentIndex: state.queueIdx };
}
function pushDaySnapshot() {
  try {
    var cap = window.Capacitor;
    if (!cap || !cap.Plugins || !cap.Plugins.OraDayBridge) return;
    var snap = oraDaySnapshot();
    if (!snap) return;
    var p = cap.Plugins.OraDayBridge.setDaySnapshot({ snapshot: JSON.stringify(snap) });
    if (p && p.catch) p.catch(function () {});
  } catch (e) { /* the bridge can never fail the day build */ }
}
/* ---------------- v377 two-way bridge: the registered face ----------------
   The native shell's media session (OraLibraryService) is the
   app's registered player on the phone (Plan §2.1): this client
   stays the audio engine and pushes its state over the same
   OraDayBridge plugin (B1), and the session's transport —
   notification, lock screen, headset, media panel, the car —
   comes back as transportCommand plugin events, executed
   through the app's OWN transport functions (B3), never by
   poking the audio element. Guarded exactly like the snapshot:
   no plugin, no pushes, and the browser path is unchanged —
   including the web MediaSession, which inside the shell is
   NOT written (B6: one face only). Every push is
   fire-and-forget; the bridge can never fail playback. */
function oraBridgePlugin() {
  try {
    var cap = window.Capacitor;
    if (!cap || !cap.Plugins || !cap.Plugins.OraDayBridge) return null;
    return cap.Plugins.OraDayBridge;
  } catch (e) { return null; }
}
function oraInShell() { return !!oraBridgePlugin(); }
function nativeStatePayload(stopped) {
  var queueIds = (state.queue || []).map(function (d) { return d.episodeId; });
  var cur = state.current;
  if (!cur) {
    if (!stopped) return null;
    return { engine: 'web', trackId: '', kind: '', title: '', subtitle: '', block: '', dateLabel: state.dateLabel || '',
      playing: false, stopped: true, positionS: 0, durationS: 0, estimated: false,
      queueIndex: state.queueIdx, queueCount: state.queue.length, queueIds: queueIds, rate: state.rate || 1, ts: Date.now() };
  }
  var playing = transportPlaying();
  // B1 title: the row title the app shows (always the prayer's
  // own under v384); subtitle: the v372 pairing — the playing
  // prayer's intention text, read from its descriptor field.
  // v388 §2.3: the subtitle comes under the showing toggle —
  // OFF pushes an empty subtitle.
  var title = cur.title || '';
  var subtitle = '';
  if (intentionsOn()) { var intro = introForTrack(cur); if (intro && intro.text) subtitle = intro.text; }
  // v388 §2.2: the face's kind is the descriptor's own at all
  // times and position/duration are the element's — the
  // 'spoken' kind and the estimated-position block retire
  // with the speech machinery.
  var kind = cur.kind || 'episode';
  var pos = audioEl.currentTime || 0;
  var dur = cur.durationS || (isFinite(audioEl.duration) && audioEl.duration > 0 ? audioEl.duration : 0) || 0;
  var estimated = false;
  return { engine: 'web', trackId: cur.episodeId || '', kind: kind, title: title, subtitle: subtitle,
    block: cur.block || '', dateLabel: state.dateLabel || '', playing: playing, stopped: false,
    positionS: pos, durationS: dur, estimated: estimated,
    queueIndex: state.queueIdx, queueCount: state.queue.length, queueIds: queueIds,
    rate: audioEl.playbackRate || state.rate || 1, ts: Date.now() };
}
function pushNativeState(stopped) {
  try {
    var p = oraBridgePlugin();
    if (!p || !p.setPlaybackState) return;
    var payload = nativeStatePayload(stopped);
    if (!payload) return;
    var r = p.setPlaybackState({ state: JSON.stringify(payload) });
    if (r && r.catch) r.catch(function () {});
  } catch (e) { /* the bridge can never fail playback */ }
}
/* B3 commands, executed through the app's own transport. After
   a state-bearing command the client pushes fresh state — the
   push IS the ack (B4). */
var bridgeDucked = false;
function bridgeDuck(on) {
  // B3 duck/unduck: the web engine's gain to 0.2 / restored.
  // The fade system's base is the standing volume. v388: duck
  // always applies — no speech phase stands to exempt.
  bridgeDucked = !!on;
  try { audioEl.volume = on ? (fade.base || 1) * 0.2 : (fade.base || 1); } catch (e) {}
}
function bridgePrevious() {
  // B3 previous: restart the track if > 3 s in, else the
  // previous queue entry — the rule reads the element.
  if (state.current && (audioEl.currentTime || 0) > 3) { audioEl.currentTime = 0; return; }
  if (state.queue.length) advanceQueue(-1);
}
function bridgeStop() {
  // B3 stop: stop playback and clear the standing transport —
  // the queue-exhausted clear's shape, on command.
  try { audioEl.pause(); } catch (e) {}
  state.queue = []; state.queueIdx = -1; state.current = null;
  setPlaybackState('none'); markPlaying(null); updateDock(); saveQueueSnapshot(); clearRestoredQueue();
  pushNativeState(true);
}
function handleTransportCommand(ev) {
  var cmd = ev && ev.command;
  if (!cmd) return;
  if (cmd === 'duck') { bridgeDuck(true); return; }
  if (cmd === 'unduck') { bridgeDuck(false); return; }
  if (cmd === 'play') resumeCurrent();
  else if (cmd === 'pause') pauseTransport();
  else if (cmd === 'next') { if (state.queue.length) advanceQueue(1); }
  else if (cmd === 'previous') bridgePrevious();
  else if (cmd === 'seekTo') {
    // Seek is the standing element behavior (v388: no speech
    // phase stands to make it inert).
    if (state.current && ev.positionS != null) { try { audioEl.currentTime = ev.positionS; } catch (e) {} }
  }
  else if (cmd === 'stop') { bridgeStop(); return; }
  else return;
  pushNativeState(false);
}
function setupBridgeCommands() {
  try {
    var p = oraBridgePlugin();
    if (!p || !p.addListener) return;
    p.addListener('transportCommand', handleTransportCommand);
  } catch (e) { /* no listener, no commands — the face still reports state */ }
}
/* B2/B5: the 5 s tick — position refresh and the page's
   heartbeat in one. Pushes only while a current stands. */
setInterval(function () { if (state.current) pushNativeState(false); }, 5000);
function extRebuildDescs(day) {
  // The queue rule (§2.5): descriptors are built from what stands
  // resolved at tap time — own tracks in payload order, each
  // block's resolved externals after its own tracks.
  // v338 §2.3(2)/(5): every descriptor flows through expandDescs —
  // a slot's intro descriptor stands immediately before the slot's
  // descriptor when the slot resolved present and its intro
  // stands; an unresolved/missing slot emits NO intro.
  var descs = [];
  var date = day.presentedDay || day.date;
  (day.blocks || []).forEach(function (b) {
    (b.tracks || []).forEach(function (t) { expandDescs(Object.assign({}, t, { _block: b.block }), day).forEach(function (d) { descs.push(d); }); });
    // v342/v348: the block's settings rows stand after any payload
    // tracks, merged across families in settings order (v348 §2.2).
    // A settled-missing family emits its one named-missing
    // descriptor at its sorted position; an unresolved row emits
    // nothing yet.
    // v348 §2.2: ONE merged settings list across families, sorted
    // by the standing comparator — own entries built before
    // external entries, so a (production-impossible) sortOrder tie
    // resolves own-first by the runtime's stable sort. Per-entry
    // emission is the standing behavior verbatim.
    var merged = [];
    (state.ownStanding || []).filter(function (r) { return r.block === b.block; })
      .forEach(function (row) { merged.push({ sortOrder: row.sortOrder || 0, own: row }); });
    (state.extStanding || []).filter(function (s) { return s.block === b.block; })
      .forEach(function (slot) { merged.push({ sortOrder: slot.sortOrder || 0, ext: slot }); });
    merged.sort(function (a, c) { return a.sortOrder - c.sortOrder; });
    merged.forEach(function (e) {
      if (e.own) {
        var row = e.own;
        var st = state.ownSlots[row.sourceKey];
        if (!st) return;
        if (st.state === 'present') {
          st.tracks.forEach(function (m) { expandDescs(ownSlotTrack(row, m, date), day).forEach(function (d) { descs.push(d); }); });
        } else if (st.state === 'missing') {
          expandDescs(ownSlotTrack(row, { episodeId: row.episodeId, title: row.title, state: 'missing' }, date), day).forEach(function (d) { descs.push(d); });
        }
      } else {
        var slot = e.ext;
        var st2 = state.extSlots[slot.slotId];
        if (st2) expandDescs(extSlotTrack(slot, st2), day).forEach(function (d) { descs.push(d); });
      }
    });
  });
  (day.episodes || []).forEach(function (t) { expandDescs(t, day).forEach(function (d) { descs.push(d); }); });
  state.dayDescs = descs;
  refreshRepeatIds(); // v360 §2.2: the repeat set follows the day build
  pushDaySnapshot(); // v359 §2.4: every rebuild refreshes the native side's day
  return descs;
}
/* ---------------- v342 own episodes + intentions --------------
   Own resolution runs in the SAME at-open pass as the externals
   (§2.1 ruling 3): the settings rows govern standing, the podcast
   feed resolves by presented date, descriptors enter through the
   standing trackDesc/expandDescs seam — no second seam. The
   intentions feed builds day.intros in v338's exact shape before
   any descriptor build (§2.8 ruling 3); intro TEXT comes from the
   shell's introTexts (privacy decision), never the feed.
   v375: the map now builds from introTexts directly at day load
   (buildIntroMap) and the feed join retires — the feed's
   remaining app-side consumer is the segments map. */
function ownChicagoDateStr(ms) {
  if (ms == null || !isFinite(ms)) return null;
  try {
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms));
    var o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    return o.year + '-' + o.month + '-' + o.day;
  } catch (e) { return null; }
}
function ownStemOf(url) {
  var clean = String(url || '').split('?')[0].split('#')[0];
  var base = clean.slice(clean.lastIndexOf('/') + 1);
  return base.slice(-4) === '.mp3' ? base.slice(0, -4) : base;
}
function ownDateInStem(stem) {
  var m = /[0-9]{4}-[0-9]{2}-[0-9]{2}/.exec(stem);
  return m ? m[0] : null;
}
function ownFamilyOfStem(stem) {
  // Returns { family, episodeId } — family is the canonical id for
  // fixed families, 'novenas' for the novena family.
  var d = ownDateInStem(stem);
  if (!d) return null;
  if (stem.indexOf(d) === 0) {
    // <date>-<slug>-day-<n> — a novena item.
    var rest = stem.slice(d.length + 1);
    var dayAt = rest.lastIndexOf('-day-');
    if (dayAt <= 0) return null;
    return { family: 'novenas', episodeId: 'novena-' + rest.slice(0, dayAt) };
  }
  var base = stem.slice(-(d.length + 1)) === '-' + d ? stem.slice(0, -(d.length + 1)) : null;
  if (!base || !OWN_STEM_TO_ID[base]) return null;
  return { family: OWN_STEM_TO_ID[base], episodeId: OWN_STEM_TO_ID[base] };
}
function ownFeedTitle(title) {
  // §2.1 ruling 1: the feed title minus its ' - <Month D, YYYY>'
  // podcast display suffix.
  var t = String(title || '');
  var at = t.lastIndexOf(' - ');
  if (at > 0) {
    var tail = t.slice(at + 3);
    if (/^(January|February|March|April|May|June|July|August|September|October|November|December) [0-9]{1,2}, [0-9]{4}$/.test(tail)) return t.slice(0, at);
  }
  return t;
}
function ownSlotTrack(row, meta, date) {
  var present = !!meta && meta.state === 'present';
  return {
    episodeId: meta ? meta.episodeId : row.episodeId, title: meta ? meta.title : row.title, kind: 'episode',
    available: present, streamUrl: present ? (meta.streamUrl || meta.enclosureUrl) : null,
    enclosureUrl: meta ? meta.enclosureUrl : null,
    durationS: meta ? (meta.durationS || 0) : 0, sizeBytes: meta ? (meta.sizeBytes || 0) : 0,
    // v368 §2.5: a meta may declare hasText false — the store-only
    // episode stages no read-along text object, so no Read control
    // stands on its row and the no-text fold names it in the meta
    // (the v363 convention). No standing meta sets the flag.
    hasText: present && !(meta && meta.hasText === false), textUrl: present ? '/api/player/text/' + date + '/' + (meta ? meta.episodeId : row.episodeId) : null,
    _block: row.block
  };
}
function ownPlaceholderCard(row) {
  return '<div class="card trow" data-card="' + esc(row.episodeId) + '"><h3>' + esc(row.title) + '</h3><div class="meta">Loading&hellip;</div></div>';
}
function ownSwapRow(row, day) {
  // Selection is by the row's own identity (data-own-row), never
  // by episode id: three rows share the Antiphon's id, and a swap
  // must replace only its own row's cards.
  var olds = view.querySelectorAll('[data-own-row="' + row.sourceKey + '"]');
  if (!olds.length) return;
  var st = state.ownSlots[row.sourceKey];
  var html;
  if (!st) return;
  if (st.state === 'present') html = st.tracks.map(function (m) { return trackCard(ownSlotTrack(row, m, day.presentedDay || day.date)); }).join('');
  else if (st.state === 'missing') html = trackCard(ownSlotTrack(row, { episodeId: row.episodeId, title: row.title, state: 'missing' }, day.presentedDay || day.date));
  else html = ownPlaceholderCard(row);
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  var nodes = [];
  while (tmp.firstChild) nodes.push(tmp.removeChild(tmp.firstChild));
  var first = olds[0];
  nodes.forEach(function (el) {
    el.setAttribute('data-own-row', row.sourceKey);
    first.parentNode.insertBefore(el, first);
    el.querySelectorAll('[data-playkey]').forEach(function (b2) {
      b2.addEventListener('click', function () {
        var d = (state.dayDescs || []).filter(function (x) { return x.episodeId === b2.getAttribute('data-playkey'); })[0];
        if (d) tapPlay(d);
      });
    });
    el.querySelectorAll('[data-read]').forEach(function (b2) {
      b2.addEventListener('click', function () {
        var t = state.readTracks[b2.getAttribute('data-read')];
        if (t) openRead(t);
      });
    });
    // v343 §2.4: the own swap path arms the ellipsis too.
    wireExpand(el);
    armEllipsis(el);
    // v344: the re-rendered card wires its marker here too.
    wirePlayed(el);
  });
  refreshPlayedChrome();
  olds.forEach(function (o) { o.remove(); });
  (st.tracks || []).forEach(function (m) {
    if (state.current && state.current.episodeId === m.episodeId) markPlaying(m.episodeId);
  });
}
function ownRegisterReadTracks() {
  (state.ownStanding || []).forEach(function (row) {
    var st = state.ownSlots[row.sourceKey];
    if (!st || st.state !== 'present') return;
    st.tracks.forEach(function (m) { state.readTracks[m.episodeId] = ownSlotTrack(row, m, state.storedDay); });
  });
}
function updateBlockCounts(day) {
  // v374 §2: the count's source of truth is state.dayDescs — the
  // expanded descriptor list the app itself plays, searches, and
  // queues from. A block's count is the number of descriptors
  // carrying its name (v384: every descriptor is a prayer — the
  // intention descriptors whose rows v374 counted as listed
  // tracks no longer stand; a settled-missing track stands as
  // exactly one descriptor; loading placeholders emit none).
  // The old own+ext standing-list arithmetic (with its novenas
  // special case) is replaced whole by this one tally.
  var counts = {};
  (state.dayDescs || []).forEach(function (d) {
    if (d.block) counts[d.block] = (counts[d.block] || 0) + 1;
  });
  view.querySelectorAll('[data-bcount]').forEach(function (el) {
    var b = el.getAttribute('data-bcount');
    var blk = (day.blocks || []).filter(function (x) { return x.block === b; })[0];
    el.textContent = (blk && blk.caption ? blk.caption : '') + ' · ' + (counts[b] || 0) + ' tracks';
  });
}
function paintContinue() {
  // v344 §2.6: the Resume card is REPLACED by the Continue card —
  // one card, one place (the #continue-slot standing under the
  // Play All row). It re-renders from the store + the standing
  // day build on every call: the resolution pass calls it as
  // descriptors settle, and refreshPlayedChrome calls it after
  // every played-state write, so a mark is reflected in place —
  // scroll and playback are never disturbed.
  var slot = document.getElementById('continue-slot');
  if (!slot) return;
  view.querySelectorAll('[data-resumeat]').forEach(function (b) { b.remove(); });
  // v355 §2.4 (decision 6): while a restored queue stands — the
  // flag set at boot (A1 Moment 1) and held until the queue ends
  // or is replaced — the slot renders EMPTY: no card, no button,
  // no queue preview, whatever the played store or the v312
  // record would otherwise show. buildContinueQueue and the
  // card's own gate/merge logic below are not modified; they are
  // simply not reached while the flag stands.
  if (state.restoredQueue) { slot.innerHTML = ''; return; }
  var d = presentedDateStr();
  var prayers = (state.dayDescs || []).filter(function (x) { return x.available; });
  var playedN = 0, firstUnplayed = null;
  prayers.forEach(function (x) {
    if (d && isPlayed(x.episodeId, d, x.block)) playedN++;
    else if (!firstUnplayed) firstUnplayed = x;
  });
  // The standing resume record, under its standing stored-day
  // check (a stale record retires, as before).
  var resumeRec = readResume();
  if (resumeRec && resumeRec.date !== state.storedDay) {
    try { localStorage.removeItem('opn-resume-v312'); } catch (e) {}
    resumeRec = null;
  }
  var resumeDesc = null;
  if (resumeRec) resumeDesc = prayers.filter(function (x) { return x.episodeId === resumeRec.episodeId; })[0] || null;
  // Gate: the card stands iff something stands played with
  // something left to hear, OR the resume record resolves — and
  // only while an unplayed track stands to name (a fully-played
  // day shows NO card; Play All replays it in full, §2.4).
  if (!firstUnplayed || !(playedN > 0 || resumeDesc)) { slot.innerHTML = ''; return; }
  var named = firstUnplayed;
  // The merge rules: the two records merge, never compete. The
  // position carries only when the resume record points at the
  // first unplayed track itself; a record pointing at a PLAYED
  // track stands down entirely (no resume offer on a finished
  // prayer); a record pointing at a later unplayed track leaves
  // the naming to play order and keeps its own in-card button.
  var carry = !!(resumeDesc && resumeDesc.episodeId === named.episodeId);
  var blk = ((state.dayPayload && state.dayPayload.blocks) || []).filter(function (b) { return b.block === named.block; })[0];
  var blockLabel = blk ? (blk.label || blk.block) : named.block;
  slot.innerHTML = '<div class="card"><div class="row"><div class="grow"><h3>Continue</h3>'
    + '<div class="meta">Continue — ' + esc(blockLabel) + ' · ' + esc(named.title) + '</div>'
    + '<div class="meta">' + playedN + ' of ' + prayers.length + ' heard today</div></div>'
    + '<button class="btn gold small" id="continue-btn">Continue</button></div>'
    + '<div style="margin-top:6px"><a href="#" id="continue-all">Play everything instead</a> &middot; <a href="#" id="continue-queue">See queue</a></div></div>';
  document.getElementById('continue-btn').addEventListener('click', function () {
    var res = buildContinueQueue();
    var build = res.build;
    if (carry && resumeRec) {
      var idx = res.carryIdx;
      if (idx >= 0) {
        // The queue is the filtered build rotated to start at
        // that descriptor; the position rides the standing
        // pendingResume mechanism (set before the start; the
        // loadedmetadata handler seeks), and playback starts —
        // Continue is a play action, unlike loadResume's pause.
        state.pendingResume = { episodeId: resumeDesc.episodeId, positionS: resumeRec.positionS || 0 };
        startQueue(build.slice(idx));
        return;
      }
    }
    startQueue(build);
  });
  document.getElementById('continue-all').addEventListener('click', function (ev) {
    ev.preventDefault();
    startQueue(extRebuildDescs(state.dayPayload));
  });
  document.getElementById('continue-queue').addEventListener('click', function (ev) {
    ev.preventDefault();
    var res = buildContinueQueue();
    if (!res.build.length) return;
    state.previewQueue = res.build;
    state.queuePreviewIdx = res.carryIdx;
    openQueuePreview();
  });
  if (resumeDesc && !carry && d && !isPlayed(resumeDesc.episodeId, d, resumeDesc.block)) {
    var host = view.querySelector('[data-card="' + resumeDesc.episodeId + '"]');
    if (host) {
      var btn = document.createElement('button');
      btn.className = 'btn ghost small'; btn.setAttribute('data-resumeat', '1');
      btn.textContent = 'Resume at ' + fmtDur(resumeRec.positionS);
      btn.addEventListener('click', function () { loadResume(resumeDesc, resumeRec.positionS || 0); });
      host.appendChild(btn);
    }
  }
}
// Downloads for own + intention audio (§2.3): the enclosure host
// refuses browser reads, so the bytes come through the Worker
// pass-through and land in the standing device audio cache; the
// download key is the canonical episode id ('intro/<id>' for
// intros — path form, because 'intro:<id>' parses as a URL
// scheme and the Cache API rejects non-http(s) keys) — one cache
// entry serves every placement of the track.
function ownFetchAudio(cacheKey, enclosureUrl, done) {
  state.ownAudioDl = state.ownAudioDl || {};
  if (state.ownAudioDl[cacheKey]) { state.ownAudioDl[cacheKey].push(done); return; }
  state.ownAudioDl[cacheKey] = [done];
  var finish = function (objUrl) {
    var cbs = state.ownAudioDl[cacheKey] || [];
    cbs.forEach(function (cb) { try { cb(objUrl); } catch (e) {} });
  };
  var download = function () {
    fetch('/api/player/feed-audio?url=' + encodeURIComponent(enclosureUrl)).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.blob();
    }).then(function (blob) {
      var put = ('caches' in window)
        ? caches.open('opn-ext-audio-v1').then(function (c) { return c.put(cacheKey, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } })); }).catch(function () {})
        : Promise.resolve();
      return put.then(function () { finish(URL.createObjectURL(blob)); });
    }).catch(function () { finish(null); });
  };
  if (!('caches' in window)) { download(); return; }
  // Cache restore first (the extRestoreCached posture, with its
  // stall fallback): a stalled read becomes a fresh download.
  var settled = false;
  var fallback = setTimeout(function () { if (!settled) { settled = true; download(); } }, 3000);
  caches.open('opn-ext-audio-v1').then(function (cache) { return cache.match(cacheKey); }).then(function (resp) {
    if (settled) return;
    if (!resp) { settled = true; clearTimeout(fallback); download(); return; }
    resp.blob().then(function (blob) {
      if (settled) return;
      settled = true; clearTimeout(fallback);
      finish(URL.createObjectURL(blob));
    });
  }).catch(function () { if (!settled) { settled = true; clearTimeout(fallback); download(); } });
}
// The streaming parse (§2.1 ruling 2): the feed is strictly
// date-descending; read the body incrementally, resolve the
// presented day's items as their <item> elements close, and STOP
// once the presented day's block completes — the first item dated
// BEFORE the presented day, after presented-day items were seen,
// closes the block. Bytes consumed are exposed for the gate
// (window.__opnV342).
function ownResolveFeed(day, needed) {
  var date = day.presentedDay || day.date;
  var found = {};       // family -> [meta]
  var seenPresent = false;
  var finished = false;
  state.ownFeedBytes = 0;
  var finishAll = function () {
    if (finished) return;
    finished = true;
    Object.keys(needed).forEach(function (fam) {
      var rows = needed[fam];
      var items = found[fam] || [];
      rows.forEach(function (row) {
        if (items.length) ownSettlePresent(day, row, fam === 'novenas' ? items : [items[0]]);
        else ownSettleMissing(day, row);
      });
    });
    paintContinue(day);
    // v355 A1: the feed-settle tail is one of the two legs that can
    // complete restore-readiness — probe it (the settings
    // callback's closure, reached through state like ownWriteCache).
    if (state.restoreProbe) state.restoreProbe();
  };
  var consumeItem = function (xml) {
    var items = [];
    try { items = extParseFeed('<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md"><channel>' + xml + '</channel></rss>'); } catch (e) { return false; }
    var it = items[0];
    if (!it || !it.url) return false;
    var pubDate = ownChicagoDateStr(it.pubMs);
    if (!pubDate) return false;
    if (pubDate < date) return seenPresent; // stop only after the block was seen
    if (pubDate !== date) return false;
    var stem = ownStemOf(it.url);
    if (ownDateInStem(stem) !== date) return false; // disagreement: never placed (§2.1 ruling 1)
    seenPresent = true;
    var fam = ownFamilyOfStem(stem);
    if (!fam || !needed[fam.family]) return false;
    var meta = {
      episodeId: fam.episodeId, title: ownFeedTitle(it.title), state: 'present',
      enclosureUrl: it.url, streamUrl: null, durationS: it.durationS || 0, sizeBytes: it.length || 0
    };
    (found[fam.family] = found[fam.family] || []).push(meta);
    if (fam.family !== 'novenas') {
      // Every standing row of the family settles — the Antiphon
      // item places into each of its enabled rows (Morning,
      // Midday, Evening) from this one match.
      var rows = needed[fam.family];
      delete needed[fam.family];
      rows.forEach(function (row) { ownSettlePresent(day, row, [meta]); });
    }
    return false;
  };
  fetch(OWN_FEED_URL).then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    if (!res.body || !res.body.getReader) {
      return res.text().then(function (t) {
        state.ownFeedBytes = t.length;
        var parts = t.split('</item>');
        for (var i = 0; i < parts.length - 1; i++) {
          var at = parts[i].lastIndexOf('<item');
          if (at >= 0 && consumeItem(parts[i].slice(at) + '</item>')) break;
        }
        finishAll();
      });
    }
    var reader = res.body.getReader();
    var dec = new TextDecoder();
    var buf = '';
    var pump = function () {
      return reader.read().then(function (r) {
        if (r.done) { finishAll(); return; }
        if (r.value) state.ownFeedBytes += r.value.byteLength;
        buf += dec.decode(r.value, { stream: true });
        for (;;) {
          var end = buf.indexOf('</item>');
          if (end < 0) break;
          var start = buf.lastIndexOf('<item', end);
          if (start < 0) { buf = buf.slice(end + 7); continue; }
          var chunk = buf.slice(start, end + 7);
          buf = buf.slice(end + 7);
          if (consumeItem(chunk)) {
            try { reader.cancel(); } catch (e) {}
            finishAll();
            return;
          }
        }
        return pump();
      }).catch(function () { finishAll(); });
    };
    return pump();
  }).catch(function () { finishAll(); });
}
function ownSettlePresent(day, row, metas) {
  state.ownSlots[row.sourceKey] = { state: 'present', tracks: metas };
  ownSwapRow(row, day);
  ownRegisterReadTracks();
  extRebuildDescs(day);
  updateBlockCounts(day);
  if (state.ownWriteCache) state.ownWriteCache();
  // Background downloads (§2.3): the track plays by streaming
  // from its enclosure now; the saved copy swaps in when it lands.
  var seen = {};
  metas.forEach(function (m) {
    if (seen[m.episodeId]) return;
    seen[m.episodeId] = true;
    ownFetchAudio(offlineDayKey(day.presentedDay || day.date, m.episodeId), m.enclosureUrl, function (objUrl) {
      if (!objUrl) return;
      (state.ownStanding || []).forEach(function (r2) {
        var st2 = state.ownSlots[r2.sourceKey];
        if (!st2 || !st2.tracks) return;
        var touched = false;
        st2.tracks.forEach(function (t2) { if (t2.episodeId === m.episodeId) { t2.streamUrl = objUrl; touched = true; } });
        if (touched) { ownSwapRow(r2, day); }
      });
      ownRegisterReadTracks();
      extRebuildDescs(day);
    });
    // v375 §2 step 3: no intro download is kicked here — the
    // paired intention is written-only (v388), read from the
    // text that already stands in day.intros.
  });
}
function ownSettleMissing(day, row) {
  state.ownSlots[row.sourceKey] = { state: 'missing', tracks: [] };
  ownSwapRow(row, day);
  extRebuildDescs(day);
  updateBlockCounts(day);
}
// The intentions feed (§2.2): items selected by GUID for the
// presented day. v375 §2 step 3: under D2 the intro pairing no
// longer reads this feed at all — day.intros builds from
// introTexts at day load (buildIntroMap) — so the feed's
// remaining app-side consumer is the SEGMENTS map: segment
// items resolve into state.daySegments (shape only — no
// presentation is built, §2.2 ruling 6), and the parsed record
// still rides the device cache (state.introRec) in its standing
// shape. The feed itself keeps publishing untouched (D3). A
// feed failure degrades SEGMENTS ONLY: the catch clears
// segments and NEVER touches day.intros — the pre-v375 catch
// wrote day.intros = {} on failure, and that one line was
// today's defect shape (a feed failure emptying the pairing
// map). The descriptor rebuild + ext-card completion leg that
// stood here existed because the map landed late; the map now
// stands before first paint, so no completion leg is needed —
// descriptor builds read the text-built map from the start.
// (Intro pass-through cache entries written by earlier builds
// age out unread — no cleanup code, by plan.)
function ownBuildIntentions(day, cachedRec) {
  var date = day.presentedDay || day.date;
  var applyRec = function (rec2) {
    state.daySegments = rec2.segments || {};
    state.introRec = rec2;
  };
  if (cachedRec) { applyRec(cachedRec); return Promise.resolve(); }
  return extFetchText(INTRO_FEED_URL).then(function (text) {
    var doc = new DOMParser().parseFromString(text, 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error('intentions feed parse failed');
    var rec2 = { intros: {}, segments: {} };
    doc.querySelectorAll('item').forEach(function (it) {
      var guidEl = it.querySelector('guid');
      var guid = guidEl ? guidEl.textContent.trim() : '';
      var enc = it.querySelector('enclosure');
      var url = enc ? (enc.getAttribute('url') || '') : '';
      var lenRaw = enc ? (enc.getAttribute('length') || '') : '';
      var len = lenRaw.trim() !== '' && !isNaN(Number(lenRaw)) ? Number(lenRaw) : 0;
      var titleEl = it.querySelector('title');
      var title = extWs(titleEl ? titleEl.textContent : '');
      if (!url || guid.slice(-(date.length + 1)) !== '-' + date) return;
      if (guid.indexOf('intentions-intro-') === 0) {
        var id = guid.slice('intentions-intro-'.length, -(date.length + 1));
        if (id) rec2.intros[id] = { title: title, streamUrl: url, sizeBytes: len };
      } else if (guid.indexOf('intentions-segment-') === 0) {
        var block = guid.slice('intentions-segment-'.length, -(date.length + 1));
        if (block) rec2.segments[block] = { streamUrl: url, sizeBytes: len };
      }
    });
    applyRec(rec2);
    if (state.ownWriteCache) state.ownWriteCache();
  }).catch(function () {
    // v375 §2 step 3: segments clear; day.intros is NOT touched
    // (the text-built map stands — L9 pins this).
    state.daySegments = {};
    state.introRec = null;
  });
}
function claimAiSignalShell(day) {
  // v368 §2.5.3: the shell fills The AI Signal block's tracks
  // server-side (the §2.2.7 exception) — the ONLY block whose
  // payload tracks stand non-empty. The client claims that
  // descriptor into the own-slot machinery (resolveAiSignal) and
  // empties the payload list here, synchronously at the pass's
  // open, so no paint path (the block page renders payload tracks
  // directly) can ever stand the episode twice or in its raw
  // shell form. Returns the descriptor, or null when the block
  // carries none (no registration for the presented day).
  var blk = (day.blocks || []).filter(function (x) { return x.block === 'The AI Signal'; })[0];
  if (!blk || !blk.tracks || !blk.tracks.length) return null;
  var desc = blk.tracks[0];
  blk.tracks = [];
  return desc;
}
function resolveAiSignal(day, settings, shellDesc) {
  // v368 §2.5.3: the resolution leg for the store-only episode.
  // Standing = the settings row (family 'own', sourceKey
  // 'the-ai-signal' — deliberately NO OWN_ROW_EPISODE entry: the
  // public-feed own leg must never claim this source, §2.5.2);
  // a Settings disable by John settles the block absent, the
  // standing rule for own sources. Result = the shell block's
  // filled descriptor, claimed by claimAiSignalShell. Present
  // stands the slot present with the descriptor as its one track
  // (streamUrl is the signed-in audio route; hasText false — no
  // text object is staged for this episode kind); absent stands
  // it named-missing (the ownSettleMissing shape, settled inline:
  // no feed will ever resolve it). The pair machinery is the
  // standing one — the descriptor carries episodeId
  // 'the-ai-signal', so the shell's introTexts (keyed
  // 'the-ai-signal' in the payload map; v375: buildIntroMap at
  // day load, the feed guid join retired) stand the intention
  // row before it with no new pair code (§2.5.4).
  var s = (settings.sources || []).filter(function (x) { return x.sourceKey === 'the-ai-signal'; })[0];
  if (!s || s.enabled !== 1 || !s.block) return;
  var row = { sourceKey: 'the-ai-signal', episodeId: 'the-ai-signal', block: s.block, sortOrder: s.sortOrder, title: s.name, enabled: s.enabled, shellResolved: true };
  state.ownStanding.push(row);
  if (shellDesc) {
    state.ownSlots[row.sourceKey] = { state: 'present', tracks: [{ episodeId: 'the-ai-signal', title: shellDesc.title, state: 'present', enclosureUrl: null, streamUrl: shellDesc.streamUrl, durationS: shellDesc.durationS || 0, sizeBytes: shellDesc.sizeBytes || 0, hasText: false }] };
  } else {
    state.ownSlots[row.sourceKey] = { state: 'missing', tracks: [] };
  }
}
function resolveExternals(day, settingsOverride, snapshotRec) {
  // v337 §2.4: resolution keys on the PRESENTED day (the payload's
  // presentedDay; its date field carries the same day). storedDay
  // is the produced fact and no longer keys any consumption path.
  var date = day.presentedDay || day.date;
  if (!date) return;
  // v368 §2.5.3: claim the shell's AI Signal descriptor before
  // any paint can consume the payload's block list.
  var aiShellDesc = claimAiSignalShell(day);
  state.extSlots = {};
  state.extStanding = [];
  // v392 W3: the settings-dependent build stands extracted as
  // buildWithSettings — the online path feeds it the settings
  // read; the offline path feeds it the day snapshot's stored
  // settings (+ its externals record), so ONE build serves both
  // and no second renderer exists.
  var buildWithSettings = function (settings) {
    state.offlineSettings = settings;
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
      standing.push({ slotId: s.slotId, title: s.title, fallbackToken: s.fallbackToken, block: row.block || 'Morning', sortOrder: row.sortOrder, fbRow: fb[s.slotId] || null, source: s.source || 'Divine Office', feedUrl: s.feedUrl || null, matcher: s.matcher || null, download: s.download || null, courier: s.courier || null });
    });
    state.extStanding = standing;
    // v342 §2.1 ruling 4: the eight family-'own' settings rows
    // govern own standing — a family turned off in Settings does
    // not resolve, and the app places by the row's block and sort,
    // never the feed's order.
    var ownStanding = [];
    (settings.sources || []).forEach(function (s) {
      if (s.family !== 'own' || !OWN_ROW_EPISODE[s.sourceKey]) return;
      ownStanding.push({ sourceKey: s.sourceKey, episodeId: OWN_ROW_EPISODE[s.sourceKey], block: s.block || 'Morning', sortOrder: s.sortOrder, title: s.name, enabled: s.enabled });
    });
    ownStanding = ownStanding.filter(function (r) { return r.enabled === 1 && r.block; })
      .sort(function (a, c) { return (a.sortOrder || 0) - (c.sortOrder || 0); });
    state.ownStanding = ownStanding;
    state.ownSlots = {};
    ownStanding.forEach(function (row) { state.ownSlots[row.sourceKey] = { state: 'loading', tracks: [] }; });
    // v368 §2.5.3: the store-only episode settles from the shell
    // in this same pass, before the feed/watchdog machinery runs
    // (its row is shellResolved — those legs skip it by name).
    resolveAiSignal(day, settings, aiShellDesc);
    // Day cache: valid only for this date AND this settings version.
    var cache = extCacheRead();
    // v392 W3: on the snapshot path the snapshot's externals
    // record stands when the live record does not cover the day.
    if ((!cache || cache.date !== date) && snapshotRec && snapshotRec.date === date && snapshotRec.slots) cache = snapshotRec;
    var cacheValid = !!cache && cache.date === date && cache.settingsVersion === settings.version && cache.slots;
    if (cache && !cacheValid) { extDiscardCaches(); cache = null; }
    var rec = cacheValid ? cache : { date: date, settingsVersion: settings.version, savedAt: new Date().toISOString(), slots: {} };
    // v342 §2.3: the record gains own + intentions sections. A
    // pre-v342 record (valid, but no such sections) reads as
    // sections-empty: those families resolve fresh this open —
    // no crash, no stale stand.
    var ownCache = cacheValid && cache.own ? cache.own : {};
    var intCache = cacheValid && cache.intentions ? cache.intentions : null;
    ownStanding.forEach(function (row) {
      var c = ownCache[row.sourceKey];
      if (!c) return;
      if (row.episodeId === 'novenas') {
        if (c.items && c.items.length) {
          state.ownSlots[row.sourceKey] = { state: 'present', tracks: c.items.map(function (m) { return { episodeId: m.episodeId, title: m.title, state: 'present', enclosureUrl: m.enclosureUrl, streamUrl: null, durationS: m.durationSec || 0, sizeBytes: m.sizeBytes || 0 }; }) };
        }
      } else if (c.episodeId) {
        state.ownSlots[row.sourceKey] = { state: 'present', tracks: [{ episodeId: c.episodeId, title: c.title, state: 'present', enclosureUrl: c.enclosureUrl, streamUrl: null, durationS: c.durationSec || 0, sizeBytes: c.sizeBytes || 0 }] };
      }
    });
    // §2.8 ruling 3 (as amended by v375): the intros map stands
    // built from introTexts since renderPrayers — this pass now
    // resolves the feed's SEGMENTS only; the probe below still
    // waits on its promise settling, unchanged.
    var intP = ownBuildIntentions(day, intCache);
    // v355 Amendment A1: the restore-readiness probe. Readiness =
    // every standing own row settled (present/missing) AND the
    // intentions promise settled — the first moment the readiness
    // rebuild (extRebuildDescs) carries the whole day. The probe
    // is invoked from exactly the legs that can complete readiness:
    // ownResolveFeed's finishAll tail (through state.restoreProbe,
    // the state.ownWriteCache pattern) and the intP.then leg below;
    // the fired flag makes every later probe a no-op, and settle
    // rebuilds after readiness never re-invoke it. Stand-down: if
    // the listener started his own playback this pass, the restore
    // retires silently and clears the flag — his action wins, and
    // the record has already been replaced or removed by that
    // action's own §2.2/§2.5 discipline.
    var restoreFired = false, restoreIntrosDone = false;
    var maybeRestoreQueue = function () {
      if (restoreFired || !state.restoredQueue) return;
      var ownReady = (state.ownStanding || []).every(function (row) {
        var st = state.ownSlots[row.sourceKey];
        return st && (st.state === 'present' || st.state === 'missing');
      });
      if (!ownReady || !restoreIntrosDone) return;
      restoreFired = true;
      if (state.current || state.queue.length) { state.restoredQueue = false; refreshPlayedChrome(); return; }
      standRestoredQueue(day);
    };
    state.restoreProbe = function () { maybeRestoreQueue(); };
    standing.forEach(function (slot) {
      var c = cacheValid ? rec.slots[slot.slotId] : null;
      if (c && c.state === 'present') {
        state.extSlots[slot.slotId] = { state: 'downloading', title: c.title, enclosureUrl: c.streamUrl, durationSec: c.durationSec, sizeBytes: c.sizeBytes, source: c.source };
      } else {
        state.extSlots[slot.slotId] = { state: 'loading', title: slot.title || 'Bible in a Year' };
      }
    });
    blockInsertCards(day, standing);
    // v374 §2 (site 4): the descriptor build runs BEFORE the count
    // pass — the count reads state.dayDescs, so the list must stand
    // built first.
    extRebuildDescs(day);
    updateBlockCounts(day);
    var writeCache = function () {
      standing.forEach(function (slot) {
        var st = state.extSlots[slot.slotId];
        if (st && st.state === 'present') {
          rec.slots[slot.slotId] = { state: 'present', title: st.title, streamUrl: st.enclosureUrl || st.streamUrl, durationSec: st.durationSec, sizeBytes: st.sizeBytes, source: st.source, block: slot.block, sortOrder: slot.sortOrder };
        }
      });
      // v342 §2.3: only PRESENT own items are cached; a missing
      // family re-checks next open (it may simply not be published
      // yet). The intentions section carries the enclosure URLs as
      // built (never a device blob URL, never the drawn texts).
      var ownRec = {};
      ownStanding.forEach(function (row) {
        // v368 §2.5.3: a shellResolved row never enters the day
        // cache — its presence is a server fact the shell re-reads
        // every open; a cached entry would stand it present from
        // an enclosureUrl it does not have.
        if (row.shellResolved) return;
        var st = state.ownSlots[row.sourceKey];
        if (!st || st.state !== 'present' || !st.tracks.length) return;
        if (row.episodeId === 'novenas') {
          ownRec[row.sourceKey] = { items: st.tracks.map(function (m) { return { episodeId: m.episodeId, title: m.title, enclosureUrl: m.enclosureUrl, durationSec: m.durationS, sizeBytes: m.sizeBytes }; }) };
        } else {
          var m0 = st.tracks[0];
          ownRec[row.sourceKey] = { episodeId: m0.episodeId, title: m0.title, enclosureUrl: m0.enclosureUrl, durationSec: m0.durationS, sizeBytes: m0.sizeBytes };
        }
      });
      rec.own = ownRec;
      if (state.introRec) rec.intentions = state.introRec;
      rec.savedAt = new Date().toISOString();
      extCacheWrite(rec);
      // v392 W2: the same record rides the day snapshot (payload
      // + settings + this externals record, one act per write).
      offlineSnapshotWrite(date, rec);
    };
    state.ownWriteCache = writeCache;
    var settle = function (slot, st) {
      state.extSlots[slot.slotId] = st;
      // v343 §2.5(2): settle order flip — the descriptor rebuild
      // runs BEFORE the swap render, so the card the swap draws
      // consults the descriptor built from the settle that just
      // landed (descriptor-first, introForTrack).
      extRebuildDescs(day);
      extSwapCard(slot);
      // v374 §2 (site 2): a settle changes the block's listed
      // tracks — refresh the count on any standing surface (an
      // all-external block's page depends on this call).
      updateBlockCounts(day);
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
      // v337 §2.8: a 'passthrough' slot (Gospel Exegesis — the
      // Anchor→CloudFront enclosure chain's final hop sends no
      // CORS header) downloads ONLY through the Worker; every other
      // slot keeps the A1 two-route shape (direct first unless the
      // source is Sing the Hours, whose host forbids the read).
      var routes = slot.download === 'passthrough' ? [passthrough, passthrough]
        : (meta.source === 'Sing the Hours' ? [passthrough, meta.enclosureUrl] : [meta.enclosureUrl, passthrough]);
      var tryRoute = function (u) {
        return fetch(u).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.blob();
        }).then(function (blob) {
          var put = ('caches' in window)
            ? caches.open('opn-ext-audio-v1').then(function (c) {
                return c.put(offlineDayKey(date, slot.slotId), new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } }));
              }).catch(function () {})
            : Promise.resolve();
          return put.then(function () { return blob; });
        });
      };
      var attempt = tryRoute(routes[0]);
      if (routes.length > 1) attempt = attempt.catch(function () { return tryRoute(routes[1]); });
      attempt.then(function (blob) {
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
      caches.open('opn-ext-audio-v1').then(function (cache) { return cache.match(offlineDayKey(date, slot.slotId)); }).then(function (resp) {
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
    // v342 own kick: cache-seeded rows settle present at once
    // (their downloads restore cache-first inside ownFetchAudio);
    // the rest resolve from the podcast feed in this same pass.
    var ownNeeded = {};
    ownStanding.forEach(function (row) {
      // v368 §2.5.3: a shellResolved row settled already in this
      // pass — the feed leg never claims it (no OWN_ROW_EPISODE
      // entry stands for it, §2.5.2, by the same rule).
      if (row.shellResolved) return;
      var st = state.ownSlots[row.sourceKey];
      if (st.state === 'present') ownSettlePresent(day, row, st.tracks);
      else (ownNeeded[row.episodeId] = ownNeeded[row.episodeId] || []).push(row);
    });
    if (Object.keys(ownNeeded).length) ownResolveFeed(day, ownNeeded);
    else { paintContinue(day); renderQueueList(); maybeRestoreQueue(); }
    // Own watchdog: a row still unresolved after 9 s stands named
    // missing for this open (the resolve watchdog's posture).
    setTimeout(function () {
      ownStanding.forEach(function (row) {
        var st = state.ownSlots[row.sourceKey];
        if (st && st.state === 'loading') ownSettleMissing(day, row);
      });
      paintContinue(day);
    }, 9000);
    // §2.8 ruling 3 completion: when the intros map lands, the
    // already-settled cards re-render with their intention rows
    // and the descriptor list rebuilds over the full map.
    intP.then(function () {
      restoreIntrosDone = true;
      standing.forEach(function (slot) {
        var st = state.extSlots[slot.slotId];
        if (st && st.state === 'present') extSwapCard(slot);
      });
      ownStanding.forEach(function (row) {
        var st = state.ownSlots[row.sourceKey];
        if (st && st.state === 'present') ownSwapRow(row, day);
      });
      extRebuildDescs(day);
      // v374 §2 (site 3): intention rows enter the listing at this
      // landing — the count grows by them on any standing surface.
      updateBlockCounts(day);
      paintContinue(day);
      renderQueueList();
      maybeRestoreQueue(); // v355 A1: the intentions leg can complete readiness second
    });
    var missingSt = function (slot, source) {
      return { state: 'missing', title: slot.slotId === 'ext-bible-in-a-year' ? extBibleTitle(null, extMatchBibleDayN(date)) : slot.title, source: source || slot.source || 'Divine Office' };
    };
    var cachedIds = {};
    if (cacheValid) Object.keys(rec.slots || {}).forEach(function (k) { if (rec.slots[k].state === 'present') cachedIds[k] = rec.slots[k]; });
    var uncached = function (slot) { return !cachedIds[slot.slotId]; };
    var doSlots = standing.filter(function (s) { return !!EXT_TOKENS[s.slotId]; });
    // v339 §2.3: the courier leg generalizes to the courier-class
    // slots (USCCB Readings · Fr. Mike · Barron) — same route, same
    // settle rules; each slot's own source labels its settle.
    var courierSlots = standing.filter(function (s) { return !!EXT_TOKENS[s.slotId] || !!s.courier; });
    var saintSlot = standing.filter(function (s) { return s.slotId === 'ext-saint-of-the-day'; })[0];
    var tvMassSlot = standing.filter(function (s) { return s.slotId === 'ext-daily-tv-mass'; })[0];
    // Courier leg (Divine Office + the v339 courier class) — only
    // if some courier slot is not carried by the day cache (§2.8
    // leg 3: a fully cached source issues no network work). When
    // it does run, a cached slot whose enclosure the courier
    // confirms is left to the cache restore; a cached slot the
    // courier contradicts is re-settled from the courier's word.
    var courierP;
    if (snapshotRec) {
      // v392 W3: the offline build stands from the snapshot
      // record alone — a courier slot the record does not carry
      // stands named missing and the live read never fires
      // (zero /api/ calls on the offline path).
      courierSlots.forEach(function (slot) { if (uncached(slot)) settle(slot, missingSt(slot, slot.courier ? slot.source : 'Divine Office')); });
      courierP = Promise.resolve();
    } else if (courierSlots.some(uncached)) {
      courierP = api('/api/player/externals/live?date=' + encodeURIComponent(date)).then(function (res) {
        var byId = {};
        (res.slots || []).forEach(function (e) { byId[e.slotId] = e; });
        courierSlots.forEach(function (slot) {
          var e = byId[slot.slotId];
          var c = cachedIds[slot.slotId];
          var src = slot.courier ? slot.source : 'Divine Office';
          if (e && e.state === 'present') {
            if (c && c.streamUrl === e.streamUrl) return; // the cache restore owns this slot
            // v350: the Bible entry carries the item's RAW title;
            // the display title is built here by the standing
            // extBibleTitle construction (one title rule).
            settleMeta(slot, { title: slot.slotId === 'ext-bible-in-a-year' ? extBibleTitle({ title: e.title }, extMatchBibleDayN(date)) : e.title, enclosureUrl: e.streamUrl, durationSec: e.durationSec, sizeBytes: e.sizeBytes, source: src });
          } else if (e) {
            if (c) return; // cache stands over a same-open courier miss (§2.4: the record stands for the day)
            settle(slot, missingSt(slot, src));
          } else if (uncached(slot)) {
            settle(slot, missingSt(slot, src));
          }
        });
      }).catch(function () {
        courierSlots.forEach(function (slot) { if (uncached(slot)) settle(slot, missingSt(slot, slot.courier ? slot.source : 'Divine Office')); });
      });
    } else {
      courierP = Promise.resolve();
    }
    // Bible in a Year: NO direct leg since v350 — the slot is
    // courier-resolved in the leg above (the Worker resolves the
    // 9.2 MB Fireside feed server-side with the same matcher the
    // audio pass-through uses). The download still runs
    // direct-first from the enclosure via settleMeta/extDownload.
    // Saint of the Day direct leg (v337 §2.8): the Buzzsprout feed
    // is client-readable; latest-by-release-date with the MM/DD
    // title check; the download is direct-first with the Worker
    // pass-through as fallback (the slot's download pin).
    if (saintSlot && uncached(saintSlot)) {
      extFetchText(saintSlot.feedUrl).then(function (text) {
        var it = extMatchSaint(extParseFeed(text), date);
        if (it) settleMeta(saintSlot, { title: it.title || saintSlot.title, enclosureUrl: it.url, durationSec: it.durationS, sizeBytes: it.length, source: saintSlot.source });
        else settle(saintSlot, { state: 'missing', title: saintSlot.title, source: saintSlot.source });
      }).catch(function () { settle(saintSlot, { state: 'missing', title: saintSlot.title, source: saintSlot.source }); });
    }
    // Daily TV Mass direct leg (v339 §2.3): the Buzzsprout feed is
    // client-readable (ACAO *); the pick is the title/date match
    // for the presented day; the download is direct-first with
    // the Worker pass-through as fallback (the slot's pin).
    if (tvMassSlot && uncached(tvMassSlot)) {
      extFetchText(tvMassSlot.feedUrl).then(function (text) {
        var it = extMatchTvMass(extParseFeed(text), date);
        if (it) settleMeta(tvMassSlot, { title: it.title || tvMassSlot.title, enclosureUrl: it.url, durationSec: it.durationS, sizeBytes: it.length, source: tvMassSlot.source });
        else settle(tvMassSlot, { state: 'missing', title: tvMassSlot.title, source: tvMassSlot.source });
      }).catch(function () { settle(tvMassSlot, { state: 'missing', title: tvMassSlot.title, source: tvMassSlot.source }); });
    }
    // Resolve watchdog: no slot may spin forever. A leg or restore
    // that has produced nothing after 9 s is treated as failed —
    // a cached slot re-downloads from its recorded enclosure, an
    // uncached slot still waiting on its leg stands named missing
    // for this open. v350: an uncached slot in 'downloading' is
    // NOT settled here — its metadata landed and its download's
    // own outcome is the verdict. A healthy download of a large
    // enclosure (Bible in a Year: 31 MB) routinely outruns the
    // 9 s mark and the card displayed "Not available today"
    // while the download was in flight; the long-stop below
    // bounds the download instead.
    setTimeout(function () {
      standing.forEach(function (slot) {
        var st = state.extSlots[slot.slotId];
        if (!st || (st.state !== 'loading' && st.state !== 'downloading')) return;
        var c = cachedIds[slot.slotId];
        if (c) extDownload(slot, { title: c.title, enclosureUrl: c.streamUrl, durationSec: c.durationSec, sizeBytes: c.sizeBytes, source: c.source });
        else if (st.state === 'loading') settle(slot, missingSt(slot, slot.slotId === 'ext-bible-in-a-year' ? 'Bible in a Year' : (slot.source || 'Divine Office')));
      });
      // v350 long-stop: a download still in flight 75 s after
      // the watchdog stands named missing — the no-spin rule
      // holds, on a budget a real download can meet.
      setTimeout(function () {
        standing.forEach(function (slot) {
          var st = state.extSlots[slot.slotId];
          if (st && st.state === 'downloading' && !cachedIds[slot.slotId]) settle(slot, missingSt(slot, slot.slotId === 'ext-bible-in-a-year' ? 'Bible in a Year' : (slot.source || 'Divine Office')));
        });
      }, 75000);
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
  };
  if (settingsOverride) { try { buildWithSettings(settingsOverride); } catch (e) {} }
  else { api('/api/player/source-settings').then(buildWithSettings).catch(function () { /* settings read failed: own episodes stand; no external slots stand this open */ }); }
}
function extMatchBibleDayN(dateStr) {
  var p = dateStr.split('-').map(Number);
  var doy = Math.floor((Date.UTC(p[0], p[1] - 1, p[2]) - Date.UTC(p[0], 0, 0)) / 86400000);
  return doy > 365 ? 365 : doy;
}

function renderPrayers() {
  view.innerHTML = '<h1 class="screen">Listen</h1><p class="sub">the day&rsquo;s prayers</p><p class="meta">Loading...</p>';
  api('/api/player/day').then(function (day) { buildDayFromPayload(day, null); })
    .catch(function (e) { offlineDayFallback(e); });
}
function buildDayFromPayload(day, snap) {
    // v342 §2.5: the shell carries no storedDay — the resume key
    // is the PRESENTED day (the same day key v337 set).
    state.storedDay = day.presentedDay || day.date || null;
    // v344 §2.2: the presented date is held for the played store
    // (keyed by the day the listener experienced, never the
    // stored day), and the store snapshot loads at render.
    state.presentedDay = day.presentedDay || day.date || null;
    state.playedCache = readPlayed();
    state.dateLabel = day.dateLabel || '';
    applyLiturgical(day);
    // v338 §2.7(5): trackCard consults the day payload's intros map
    // from state, uniformly for both families.
    state.dayPayload = day;
    // v392 W2: a pristine clone for the offline snapshot, taken
    // before the resolution pass mutates the payload (the AI
    // Signal claim empties its block list in place).
    if (!snap) { try { state.offlineDayClone = JSON.parse(JSON.stringify(day)); } catch (e) { state.offlineDayClone = null; } }
    // v375 §2 step 1: the intros map builds from introTexts NOW,
    // synchronously, before the first expandDescs build directly
    // below — intention rows stand at first paint. (The v342
    // shape — the map starts empty and the resolution pass fills
    // it from the intentions feed — retires with the feed join.)
    day.intros = buildIntroMap(day);
    state.daySegments = {};
    state.resumePainted = false;
    // The whole-day queue, built once from payload order: block order,
    // then push order inside the block, then the unblocked group.
    // v338 §2.3(2): through the expandDescs seam, like every build.
    var allDescs = [];
    (day.blocks || []).forEach(function (b) {
      (b.tracks || []).forEach(function (t) { var tt = Object.assign({}, t, { _block: b.block }); expandDescs(tt, day).forEach(function (d) { allDescs.push(d); }); });
    });
    (day.episodes || []).forEach(function (t) { expandDescs(t, day).forEach(function (d) { allDescs.push(d); }); });
    // v318 T9: the Read view's lookup — payload tracks by episode id,
    // and the day's descriptors for its play/pause control.
    state.dayDescs = allDescs;
    refreshRepeatIds(); // v360 §2.2: the repeat set follows the day build
    pushDaySnapshot(); // v359 §2.4: the initial build hands the native side the day shell's own tracks
    state.readTracks = {};
    (day.blocks || []).forEach(function (b) { (b.tracks || []).forEach(function (t) { if (t.episodeId) state.readTracks[t.episodeId] = t; }); });
    (day.episodes || []).forEach(function (t) { if (t.episodeId) state.readTracks[t.episodeId] = t; });
    // v353 §2.1: the fetch + state build above stands exactly
    // where it stood; the PAINT is now a dispatch on
    // state.prayersView — Listen home or one block page. The view
    // resets to home HERE, in the fetch path (the §2.1.3 pin): a
    // same-tab re-paint never loses the page, and a fresh render
    // (tab return, reload) always lands home, search cleared.
    state.prayersView = { kind: 'home' };
    state.searchQuery = '';
    paintPrayersView(day);
    // v355 Amendment A1, Moment 1: the queue snapshot's boot step
    // (read + shape/date check + the §2.4 flag) runs synchronously
    // here, immediately BEFORE the resolution pass is invoked —
    // every paintContinue of the pass stands after it in program
    // order.
    bootQueueSnapshot();
    // v334: externals resolve at open, in place, after the day has
    // rendered — the resolve never blocks the day's own episodes.
    // v392 W3: the snapshot path feeds the build its stored
    // settings + externals record (zero /api/ calls); the online
    // path resolves as standing and then runs the offline open
    // hook (eviction + the completeness pass + mark drain).
    if (snap) resolveExternals(day, snap.settings, snap.extRec);
    else { resolveExternals(day); offlineOnOnlineOpen(day); }
    // v344 §2.6: the played chrome's standing pass at render end
    // (the resolution callbacks re-apply it as cards settle).
    refreshPlayedChrome();
    if (snap) drainPodMarkQueue();
}

/* ---------------- Offline for the plane (v392) ----------------
   The offline set (Plan §2, legs W2–W7): on-device day snapshots
   in Cache Storage (opn-offline-meta-v1: payload + settings +
   the externals record, per day), the day's audio in the
   standing store (opn-ext-audio-v1) under DAY-KEYED entries, the
   podcast automatic set (current + next 2 per series) plus
   UNCAPPED by-hand downloads under POD-KEYED entries, a rolling
   today+tomorrow window with keyed eviction, a FIFO mark queue,
   and a counts-only readiness line. Key forms are PATH forms
   ('day/<date>/<id>', 'pod/<series>/<key>') — the Cache API
   rejects scheme-like keys (the standing 'intro/<id>' precedent
   in ownFetchAudio); the namespaces are §2's day:/pod: forms in
   their cache-safe rendering. Pre-v392 bare keys are abandoned
   in place, never deleted wholesale (W6). */
function offlineDayKey(date, id) { return 'day/' + date + '/' + id; }
function offlinePodKey(series, key) { return 'pod/' + series + '/' + key; }
function offlineShiftDate(dateStr, days) {
  var p = dateStr.split('-').map(Number);
  var dt = new Date(Date.UTC(p[0], p[1] - 1, p[2] + days, 12));
  function z(n) { return (n < 10 ? '0' : '') + n; }
  return dt.getUTCFullYear() + '-' + z(dt.getUTCMonth() + 1) + '-' + z(dt.getUTCDate());
}
function offlineIndexRead() {
  try { return JSON.parse(localStorage.getItem('opn-offline-index-v1') || 'null') || { days: {}, pods: { autoHave: 0, autoTotal: 0 } }; }
  catch (e) { return { days: {}, pods: { autoHave: 0, autoTotal: 0 } }; }
}
function offlineIndexWrite(idx) { try { localStorage.setItem('opn-offline-index-v1', JSON.stringify(idx)); } catch (e) {} }
function offlineSnapshotStore(date, day, settings, extRec) {
  if (!('caches' in window) || !day || !settings) return Promise.resolve();
  var snap = { date: date, savedAt: new Date().toISOString(), day: day, settings: settings, extRec: extRec || null };
  return caches.open('opn-offline-meta-v1').then(function (c) {
    return c.put('day/' + date, new Response(JSON.stringify(snap), { headers: { 'Content-Type': 'application/json' } }));
  }).then(function () {
    var idx = offlineIndexRead();
    if (!idx.days[date]) idx.days[date] = { have: 0, total: 0 };
    idx.days[date].settingsVersion = settings.version;
    offlineIndexWrite(idx);
  }).catch(function () {});
}
function offlineSnapshotWrite(date, extRec) {
  // W2's write act (the writeCache hook): the pristine payload
  // clone + the settings this build read + the externals record.
  return offlineSnapshotStore(date, state.offlineDayClone || state.dayPayload, state.offlineSettings, extRec);
}
function offlineSnapshotRead(date) {
  if (!('caches' in window)) return Promise.resolve(null);
  return caches.open('opn-offline-meta-v1').then(function (c) { return c.match('day/' + date); })
    .then(function (r) { return r ? r.json() : null; }).catch(function () { return null; });
}
function offlineDayFallback(e) {
  // W3: the day read failed (offline) — build from today's
  // snapshot through the SAME build, or stand the standing error
  // when no snapshot exists (a phone that never opened online).
  var today = todayChicago();
  offlineSnapshotRead(today).then(function (snap) {
    if (snap && snap.day && snap.settings) { buildDayFromPayload(snap.day, snap); return; }
    view.innerHTML = '<p class="err">' + esc(e.message) + '</p>';
  });
}
function offlineAudioCache() { return ('caches' in window) ? caches.open('opn-ext-audio-v1') : Promise.resolve(null); }
function offlineCacheHas(cache, key) { return cache ? cache.match(key).then(function (r) { return !!r; }) : Promise.resolve(false); }
function offlinePutBlob(cache, key, blob) {
  if (!cache || !blob) return Promise.resolve(false);
  return cache.put(key, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } })).then(function () { return true; }).catch(function () { return false; });
}
function offlineFetchBlob(url) {
  // Per-item timeout: a stalled connection (a captive portal, a
  // dead tunnel) must count the item missing and let the pass
  // finish — never stall the whole set behind one fetch (W3:
  // a failed item stays missing, counted, retried next pass).
  var ctl = ('AbortController' in window) ? new AbortController() : null;
  var timer = ctl ? setTimeout(function () { try { ctl.abort(); } catch (e) {} }, 60000) : null;
  return fetch(url, ctl ? { signal: ctl.signal } : undefined).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); }).then(function (b) { if (timer) clearTimeout(timer); return b; }, function (e) { if (timer) clearTimeout(timer); throw e; });
}
function offlineFetchItemAudio(item) {
  // Each family through its standing route (W3): own + the AI
  // Signal's store route + podcast enclosures direct with the
  // feed-audio pass-through as the CORS fallback; externals keep
  // the A1 two-route shape (direct first unless the passthrough
  // class or Sing the Hours; the other route retries).
  if (item.kind === 'own') return offlineFetchBlob('/api/player/feed-audio?url=' + encodeURIComponent(item.enclosureUrl));
  if (item.kind === 'ai') return offlineFetchBlob(item.enclosureUrl);
  if (item.kind === 'pod') return offlineFetchBlob(item.enclosureUrl).catch(function () { return offlineFetchBlob('/api/player/feed-audio?url=' + encodeURIComponent(item.enclosureUrl)); });
  var passthrough = '/api/player/externals/audio?date=' + encodeURIComponent(item.date) + '&slot=' + encodeURIComponent(item.id);
  if (item.download === 'passthrough') return offlineFetchBlob(passthrough);
  var first = item.source === 'Sing the Hours' ? passthrough : item.enclosureUrl;
  var second = item.source === 'Sing the Hours' ? item.enclosureUrl : passthrough;
  return offlineFetchBlob(first).catch(function () { return offlineFetchBlob(second); });
}
function offlineEnumerateToday(date) {
  var items = [];
  (state.ownStanding || []).forEach(function (row) {
    var st = state.ownSlots[row.sourceKey];
    if (!st || st.state !== 'present') return;
    (st.tracks || []).forEach(function (t) {
      if (row.shellResolved) { if (t.streamUrl) items.push({ kind: 'ai', date: date, id: t.episodeId, enclosureUrl: t.streamUrl, key: offlineDayKey(date, t.episodeId) }); }
      else if (t.enclosureUrl) items.push({ kind: 'own', date: date, id: t.episodeId, enclosureUrl: t.enclosureUrl, key: offlineDayKey(date, t.episodeId) });
    });
  });
  (state.extStanding || []).forEach(function (slot) {
    var st = state.extSlots[slot.slotId];
    if (!st || st.state !== 'present' || !st.enclosureUrl) return;
    items.push({ kind: 'ext', date: date, id: slot.slotId, enclosureUrl: st.enclosureUrl, source: st.source, download: slot.download, key: offlineDayKey(date, slot.slotId) });
  });
  var seen = {}, out = [];
  items.forEach(function (it) { if (!seen[it.key]) { seen[it.key] = 1; out.push(it); } });
  return out;
}
function offlineTomorrowOwn(settings, tomorrow, extRec) {
  var rows = (settings.sources || []).filter(function (s) { return s.family === 'own' && OWN_ROW_EPISODE[s.sourceKey] && s.enabled === 1 && s.block; });
  if (!rows.length) return Promise.resolve([]);
  return extFetchText(OWN_FEED_URL).then(function (text) {
    var feedItems = extParseFeed(text);
    var out = [];
    rows.forEach(function (row) {
      var epId = OWN_ROW_EPISODE[row.sourceKey];
      var matches = [];
      feedItems.forEach(function (it) {
        if (!it.url || ownChicagoDateStr(it.pubMs) !== tomorrow) return;
        var stem = ownStemOf(it.url);
        if (ownDateInStem(stem) !== tomorrow) return;
        var fam = ownFamilyOfStem(stem);
        if (!fam || fam.episodeId !== epId) return;
        matches.push({ episodeId: epId, title: ownFeedTitle(it.title), enclosureUrl: it.url, durationS: it.durationS || 0, sizeBytes: it.length || 0 });
      });
      if (!matches.length) return;
      if (epId === 'novenas') {
        extRec.own[row.sourceKey] = { items: matches.map(function (m) { return { episodeId: m.episodeId, title: m.title, enclosureUrl: m.enclosureUrl, durationSec: m.durationS, sizeBytes: m.sizeBytes }; }) };
      } else {
        var m0 = matches[0];
        extRec.own[row.sourceKey] = { episodeId: m0.episodeId, title: m0.title, enclosureUrl: m0.enclosureUrl, durationSec: m0.durationS, sizeBytes: m0.sizeBytes };
      }
      matches.forEach(function (m) { out.push({ kind: 'own', date: tomorrow, id: m.episodeId, enclosureUrl: m.enclosureUrl, title: m.title, block: row.block, durationS: m.durationS, key: offlineDayKey(tomorrow, m.episodeId) }); });
    });
    return out;
  }).catch(function () { return []; });
}
function offlineTomorrowBuild(tomorrow) {
  var settings = state.offlineSettings;
  if (!settings) return Promise.resolve(null);
  return api('/api/player/day?date=' + encodeURIComponent(tomorrow)).then(function (day) {
    var extRec = { date: tomorrow, settingsVersion: settings.version, savedAt: new Date().toISOString(), slots: {}, own: {}, intentions: null };
    var items = [];
    (day.blocks || []).forEach(function (b) { (b.tracks || []).forEach(function (t) {
      if (t.episodeId) items.push({ kind: 'ai', date: tomorrow, id: t.episodeId, enclosureUrl: t.streamUrl, title: t.title, block: b.block, durationS: t.durationS || 0, key: offlineDayKey(tomorrow, t.episodeId) });
    }); });
    var wd = extWeekdayMon0(tomorrow);
    var prim = {};
    (settings.sources || []).forEach(function (s) { if (s.family === 'external' && s.slotId && s.role !== 'fallback') prim[s.slotId] = s; });
    var bySlot = {};
    EXT_SLOTS.forEach(function (s) {
      var row = prim[s.slotId];
      if (!row || row.enabled !== 1 || !extDayRulePasses(row.dayRule || 'daily', wd)) return;
      bySlot[s.slotId] = { slotId: s.slotId, title: s.title, block: row.block || 'Morning', source: s.source || 'Divine Office', feedUrl: s.feedUrl || null, download: s.download || null, courier: s.courier || null, token: !!EXT_TOKENS[s.slotId] };
    });
    var jobs = [];
    var hasCourier = Object.keys(bySlot).some(function (k) { return bySlot[k].token || bySlot[k].courier; });
    if (hasCourier) {
      jobs.push(api('/api/player/externals/live?date=' + encodeURIComponent(tomorrow)).then(function (res) {
        (res.slots || []).forEach(function (e) {
          if (!e || e.state !== 'present' || !e.streamUrl) return;
          var def = bySlot[e.slotId];
          if (!def) return;
          var title = e.slotId === 'ext-bible-in-a-year' ? extBibleTitle({ title: e.title }, extMatchBibleDayN(tomorrow)) : e.title;
          var source = def.courier ? def.source : 'Divine Office';
          extRec.slots[e.slotId] = { state: 'present', title: title, streamUrl: e.streamUrl, durationSec: e.durationSec, sizeBytes: e.sizeBytes, source: source };
          items.push({ kind: 'ext', date: tomorrow, id: e.slotId, enclosureUrl: e.streamUrl, source: source, download: def.download, title: title, block: def.block, durationS: e.durationSec || 0, key: offlineDayKey(tomorrow, e.slotId) });
        });
      }).catch(function () {}));
    }
    [['ext-saint-of-the-day', extMatchSaint], ['ext-daily-tv-mass', extMatchTvMass]].forEach(function (pair) {
      var def = bySlot[pair[0]];
      if (!def || !def.feedUrl) return;
      jobs.push(extFetchText(def.feedUrl).then(function (text) {
        var it = pair[1](extParseFeed(text), tomorrow);
        if (!it) return;
        extRec.slots[pair[0]] = { state: 'present', title: it.title || def.title, streamUrl: it.url, durationSec: it.durationS, sizeBytes: it.length, source: def.source };
        items.push({ kind: 'ext', date: tomorrow, id: pair[0], enclosureUrl: it.url, source: def.source, download: def.download, title: extRec.slots[pair[0]].title, block: def.block, durationS: it.durationS || 0, key: offlineDayKey(tomorrow, pair[0]) });
      }).catch(function () {}));
    });
    jobs.push(offlineTomorrowOwn(settings, tomorrow, extRec).then(function (ownItems) { ownItems.forEach(function (it) { items.push(it); }); }));
    return Promise.all(jobs).then(function () {
      var stored = offlineSnapshotStore(tomorrow, day, settings, extRec);
      var origin = location.origin;
      var tracks = items.map(function (it) {
        if (it.kind === 'own') return { id: it.id, block: it.block || '', title: it.title || '', kind: 'episode', durationS: it.durationS || 0, mediaUri: origin + '/api/player/audio/' + encodeURIComponent(tomorrow) + '/' + encodeURIComponent(it.id), needsAuth: true };
        if (it.kind === 'ai') return { id: it.id, block: it.block || '', title: it.title || '', kind: 'episode', durationS: it.durationS || 0, mediaUri: origin + (it.enclosureUrl || ''), needsAuth: true };
        return { id: it.id, block: it.block || '', title: it.title || '', kind: 'external', durationS: it.durationS || 0, mediaUri: it.enclosureUrl, needsAuth: false };
      });
      var snap = { presentedDay: tomorrow, dateLabel: day.dateLabel || '', generatedAt: new Date().toISOString(), tracks: tracks, queueIds: [], currentIndex: -1 };
      return stored.then(function () { return { items: items, snap: snap }; });
    });
  }).catch(function () { return null; });
}
function offlinePodcastAutoSet() {
  // W4/D5: per series, the current entry (the day-first
  // derivation) + the next 2 — the AUTOMATIC set. By-hand
  // downloads stand outside it, uncapped (podDlTap).
  return api('/api/player/podcasts').then(function (idx) {
    var keys = (idx.seriesList || []).map(function (s) { return s.series; });
    return Promise.all(keys.map(function (k) {
      return api('/api/player/podcasts?series=' + encodeURIComponent(k)).then(function (res) { return { series: k, res: res }; }).catch(function () { return null; });
    })).then(function (all) {
      var items = [];
      all.forEach(function (a) {
        if (!a || !a.res || !a.res.entries) return;
        var cur = podCurrentKey(a.res.entries);
        var i = -1;
        a.res.entries.forEach(function (e, j) { if (e.key === cur) i = j; });
        if (i < 0) return;
        a.res.entries.slice(i, i + 3).forEach(function (e) { if (e.url) items.push({ kind: 'pod', series: a.series, id: e.key, enclosureUrl: e.url, key: offlinePodKey(a.series, e.key) }); });
      });
      return items;
    });
  }).catch(function () { return []; });
}
function offlineDownloadItems(items, epoch) {
  return offlineAudioCache().then(function (cache) {
    var chain = Promise.resolve(), have = 0;
    items.forEach(function (it) {
      chain = chain.then(function () {
        // A clear (epoch bump) mid-pass stops the tail: no
        // further fetches, and a fetch already in flight never
        // puts — the clear wins over the pass (W6).
        if (epoch != null && epoch !== offlineEpoch) return;
        return offlineCacheHas(cache, it.key).then(function (has) {
          if (has) { have++; return; }
          return offlineFetchItemAudio(it).then(function (blob) { if (epoch != null && epoch !== offlineEpoch) return false; return offlinePutBlob(cache, it.key, blob); })
            .then(function (okPut) { if (okPut) have++; }).catch(function () {});
        });
      });
    });
    return chain.then(function () { return { have: have, total: items.length }; });
  });
}
function offlineEvict(autoPodKeys) {
  // W6: day sets dated before yesterday leave both stores;
  // automatic podcast keys outside the current automatic set
  // leave — registered by-hand keys NEVER leave here.
  if (!('caches' in window)) return Promise.resolve();
  var yday = offlineShiftDate(todayChicago(), -1);
  var manual = podManualRead();
  var keepPod = {};
  if (autoPodKeys) autoPodKeys.forEach(function (k) { keepPod[k] = 1; });
  Object.keys(manual).forEach(function (k) { keepPod[k] = 1; });
  var sweep = function (store, isMeta) {
    return caches.open(store).then(function (cache) {
      return cache.keys().then(function (reqs) {
        var dels = [];
        reqs.forEach(function (rq) {
          var tail = rq.url.slice(location.origin.length + 1);
          var m = /^day\\/(\\d{4}-\\d{2}-\\d{2})(\\/|$)/.exec(tail);
          if (m && m[1] < yday) { dels.push(cache.delete(rq)); return; }
          if (!isMeta && autoPodKeys && tail.indexOf('pod/') === 0 && !keepPod[tail]) dels.push(cache.delete(rq));
        });
        return Promise.all(dels);
      });
    }).catch(function () {});
  };
  var idx = offlineIndexRead(), changed = false;
  Object.keys(idx.days || {}).forEach(function (d) { if (d < yday) { delete idx.days[d]; changed = true; } });
  if (changed) offlineIndexWrite(idx);
  return Promise.all([sweep('opn-ext-audio-v1', false), sweep('opn-offline-meta-v1', true)]);
}
function offlineWaitSettled(n) {
  var pending = false;
  (state.ownStanding || []).forEach(function (row) { var st = state.ownSlots[row.sourceKey]; if (st && st.state === 'loading') pending = true; });
  Object.keys(state.extSlots || {}).forEach(function (k) { var st = state.extSlots[k]; if (st && (st.state === 'loading' || st.state === 'downloading')) pending = true; });
  if (!pending || n >= 30) return Promise.resolve();
  return new Promise(function (res) { setTimeout(res, 1000); }).then(function () { return offlineWaitSettled(n + 1); });
}
var offlinePassRunning = false;
var offlineEpoch = 0;
var offlinePassTimer = null;
function offlineCompleteness(manual) {
  // W3's pass: today (from the settled build), tomorrow (the
  // dated route + the standing resolutions), the podcast
  // automatic set — then keyed eviction against the fresh set,
  // the readiness repaint, and the native ensureOffline call
  // (N4: the same open drives the car store's pass).
  if (offlinePassRunning) return Promise.resolve();
  offlinePassRunning = true;
  var epoch = offlineEpoch;
  var stale = function () { return epoch !== offlineEpoch; };
  var today = todayChicago(), tomorrow = offlineShiftDate(today, 1);
  var finish = function () {
    offlinePassRunning = false;
    if (stale()) return;
    paintOfflineLine();
    var p = oraBridgePlugin();
    if (p && p.ensureOffline) { try { var r = p.ensureOffline(); if (r && r.catch) r.catch(function () {}); } catch (e) {} }
  };
  return offlineEvict(null).then(function () {
    return offlineWaitSettled(0).then(function () {
      if (stale()) throw new Error('offline pass superseded by a clear');
      return offlineDownloadItems(offlineEnumerateToday(today), epoch).then(function (r1) {
        if (stale()) throw new Error('offline pass superseded by a clear');
        var idx = offlineIndexRead();
        idx.days[today] = { have: r1.have, total: r1.total, settingsVersion: (state.offlineSettings || {}).version };
        offlineIndexWrite(idx);
        paintOfflineLine();
        return offlineTomorrowBuild(tomorrow).then(function (tb) {
          var jobs = Promise.resolve();
          if (tb) {
            jobs = offlineDownloadItems(tb.items, epoch).then(function (r2) {
              if (stale()) throw new Error('offline pass superseded by a clear');
              var idx2 = offlineIndexRead();
              idx2.days[tomorrow] = { have: r2.have, total: r2.total, settingsVersion: (state.offlineSettings || {}).version };
              offlineIndexWrite(idx2);
              paintOfflineLine();
              offlinePushSnapshotObject(tb.snap);
            });
          }
          return jobs.then(function () {
            return offlinePodcastAutoSet().then(function (podItems) {
              var autoKeys = podItems.map(function (it) { return it.key; });
              return offlineDownloadItems(podItems, epoch).then(function (r3) {
                if (stale()) throw new Error('offline pass superseded by a clear');
                var idx3 = offlineIndexRead();
                idx3.pods = { autoHave: r3.have, autoTotal: r3.total };
                offlineIndexWrite(idx3);
                return offlineEvict(autoKeys);
              });
            });
          });
        });
      });
    });
  }).then(finish, finish);
}
function offlineOnOnlineOpen(day) {
  drainPodMarkQueue();
  // D2: the automatic leg — at every online open, deferred so
  // the day's own resolution leads.
  offlinePassTimer = setTimeout(function () { offlinePassTimer = null; offlineCompleteness(false); }, 4000);
}
function offlinePushSnapshotObject(snap) {
  try {
    var plugin = oraBridgePlugin();
    if (!plugin || !plugin.setDaySnapshot || !snap) return;
    var p = plugin.setDaySnapshot({ snapshot: JSON.stringify(snap) });
    if (p && p.catch) p.catch(function () {});
  } catch (e) { /* the bridge can never fail the build */ }
}
function offlineClearAll() {
  // W6: Settings' one-tap clear — both web stores emptied and
  // the native store cleared through the bridge in the same tap.
  // The epoch bump + timer cancel land FIRST, synchronously:
  // a completeness pass in flight or scheduled stops putting
  // and never re-fills behind the clear.
  offlineEpoch++;
  if (offlinePassTimer) { clearTimeout(offlinePassTimer); offlinePassTimer = null; }
  var jobs = [];
  if ('caches' in window) { jobs.push(caches.delete('opn-ext-audio-v1')); jobs.push(caches.delete('opn-offline-meta-v1')); }
  try { localStorage.removeItem('opn-offline-index-v1'); localStorage.removeItem('opn-pod-manual-v1'); } catch (e) {}
  var p = oraBridgePlugin();
  if (p && p.clearOfflineAudio) { try { var r = p.clearOfflineAudio(); if (r && r.catch) r.catch(function () {}); } catch (e) {} }
  return Promise.all(jobs).then(function () {
    paintOfflineLine();
    var el = document.getElementById('set-offline-counts');
    if (el) el.textContent = offlineLineText();
  });
}
/* W5: the readiness line — counts only, from standing state. */
function offlineLineText() {
  var idx = offlineIndexRead();
  var today = todayChicago(), tomorrow = offlineShiftDate(today, 1);
  var d1 = idx.days[today], d2 = idx.days[tomorrow];
  var manualCount = Object.keys(podManualRead()).length;
  return 'On this phone: today\u2019s prayers ' + (d1 ? d1.have + '/' + d1.total : '0/0')
    + ' \u00b7 podcasts ' + (idx.pods ? idx.pods.autoHave + '/' + idx.pods.autoTotal : '0/0') + (manualCount ? ' + ' + manualCount + ' by hand' : '')
    + ' \u00b7 tomorrow\u2019s prayers ' + (d2 ? d2.have + '/' + d2.total : '0/0');
}
function offlineLineHtml(btnId) {
  return '<div class="card"><div class="meta" id="offline-line-text">' + esc(offlineLineText()) + '</div>'
    + '<div class="row" style="margin-top:8px"><button class="btn ghost small" id="' + btnId + '">Download for offline</button></div></div>';
}
function paintOfflineLine() { var el = document.getElementById('offline-line-text'); if (el) el.textContent = offlineLineText(); }
function wireOfflineButtons() {
  ['offline-dl-btn', 'pod-offline-btn'].forEach(function (id) {
    var b = document.getElementById(id);
    if (b) b.addEventListener('click', function () { offlineCompleteness(true); });
  });
}
/* W4: by-hand podcast downloads — uncapped, registry-protected. */
function podManualRead() { try { return JSON.parse(localStorage.getItem('opn-pod-manual-v1') || '{}') || {}; } catch (e) { return {}; } }
function podManualWrite(m) { try { localStorage.setItem('opn-pod-manual-v1', JSON.stringify(m)); } catch (e) {} }
var podDlBusy = {};
function podDlTap(key) {
  var res = state.podcasts;
  if (!res || !res.entries) return;
  var entry = null;
  res.entries.forEach(function (e) { if (e.key === key) entry = e; });
  if (!entry || !entry.url) return;
  var pk = offlinePodKey(res.series, key);
  offlineAudioCache().then(function (cache) {
    if (!cache) return;
    return cache.match(pk).then(function (r) {
      var manual = podManualRead();
      if (r && manual[pk]) {
        // a hand episode's remove: bytes + registry in one act
        return cache.delete(pk).then(function () {
          var m2 = podManualRead(); delete m2[pk]; podManualWrite(m2);
          refreshPodDlStates(); paintOfflineLine();
        });
      }
      if (r || podDlBusy[pk]) return;
      podDlBusy[pk] = 1;
      refreshPodDlStates();
      return offlineFetchItemAudio({ kind: 'pod', enclosureUrl: entry.url }).then(function (blob) {
        return offlinePutBlob(cache, pk, blob).then(function (okPut) {
          if (okPut) {
            var m3 = podManualRead();
            m3[pk] = { series: res.series, key: key, title: entry.title, sizeBytes: blob.size, addedAt: new Date().toISOString() };
            podManualWrite(m3);
          }
        });
      }).catch(function () {}).then(function () { delete podDlBusy[pk]; refreshPodDlStates(); paintOfflineLine(); });
    });
  });
}
function refreshPodDlStates() {
  var btns = view.querySelectorAll('[data-poddl]');
  if (!btns.length || !state.podcasts) return;
  var res = state.podcasts;
  var manual = podManualRead();
  offlineAudioCache().then(function (cache) {
    if (!cache) return;
    return cache.keys().then(function (reqs) {
      var standing = {};
      reqs.forEach(function (rq) { standing[rq.url] = 1; });
      btns.forEach(function (b) {
        var pk = offlinePodKey(res.series, b.getAttribute('data-poddl'));
        var isStanding = !!standing[new URL(pk, location.href).href];
        if (podDlBusy[pk]) { b.textContent = 'Downloading\u2026'; b.disabled = true; }
        else if (isStanding && manual[pk]) { b.textContent = 'On phone \u00b7 Remove'; b.disabled = false; }
        else if (isStanding) { b.textContent = 'On phone'; b.disabled = true; }
        else { b.textContent = 'Get'; b.disabled = false; }
      });
    });
  });
}
/* W7: the podcast mark queue — FIFO, replay-safe (the mark
   routes are idempotent), drained at open and on 'online'. */
function podMarkQueueRead() { try { return JSON.parse(localStorage.getItem('opn-podmark-queue-v1') || '[]') || []; } catch (e) { return []; } }
function podMarkQueueWrite(q) { try { localStorage.setItem('opn-podmark-queue-v1', JSON.stringify(q)); } catch (e) {} }
function podMarkEnqueue(op) { var q = podMarkQueueRead(); q.push(op); podMarkQueueWrite(q); }
var podMarkDraining = false;
function drainPodMarkQueue() {
  if (podMarkDraining) return;
  if (!podMarkQueueRead().length) return;
  podMarkDraining = true;
  var step = function () {
    var cur = podMarkQueueRead();
    if (!cur.length) { podMarkDraining = false; return; }
    var op = cur[0];
    var call = op.op === 'unmark'
      ? post('/api/player/podcasts/unmark', { series: op.series, seqKey: op.seqKey })
      : post('/api/player/podcasts/mark', { series: op.series, seqKey: op.seqKey, source: op.source || 'auto' });
    call.then(function () { var q2 = podMarkQueueRead(); q2.shift(); podMarkQueueWrite(q2); step(); })
      .catch(function () { podMarkDraining = false; });
  };
  step();
}
window.addEventListener('online', function () { drainPodMarkQueue(); });

/* ---------------- Listen home ⇄ block pages (v353) ----------------
   The Prayers tab's two paints over the standing whole-day state.
   Navigation is re-paint from state, never refetch (§2.1.3);
   playback, queue, position, and sleep are never touched by
   navigation (§2.3.3). Rows on every paint come through trackCard
   byte-identically — B changes where rows stand, never what a
   row is (§2.0.3). */
function paintPrayersView(day) {
  if (state.prayersView && state.prayersView.kind === 'block') paintBlockPage(day, state.prayersView.block);
  else paintListenHome(day);
  wirePrayersView(day);
}
function openBlockPage(block) {
  state.prayersView = { kind: 'block', block: block };
  paintPrayersView(state.dayPayload);
  window.scrollTo(0, 0);
}
function goListenHome(fromBlock) {
  state.prayersView = { kind: 'home' };
  paintPrayersView(state.dayPayload);
  // §2.1.4: Back restores the home scroll by anchor — the
  // returning block's card scrolls into view; no scroll-position
  // store is kept.
  var card = fromBlock ? view.querySelector('[data-openblock="' + fromBlock + '"]') : null;
  if (card) card.scrollIntoView({ block: 'start' });
}
function wirePrayersView(day) {
  // The standing wiring passes, run after whichever paint stands
  // (§2.1.2). The [data-playkey] lookup reads state.dayDescs —
  // the same list the swap paths wire against.
  view.querySelectorAll('[data-playkey]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var d = (state.dayDescs || []).filter(function (x) { return x.episodeId === btn.getAttribute('data-playkey'); })[0];
      if (d) tapPlay(d);
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
      var all = extRebuildDescs(day);
      // The episodes page's Play All is the unblocked-group build:
      // the descriptors carrying no block (§2.3.4).
      var descs = blockName === '__episodes'
        ? all.filter(function (d) { return !d.block; })
        : all.filter(function (d) { return d.block === blockName; });
      // v344 §2.4: play skips played, with the fully-played
      // fallback — queueBuild stands as it stood.
      startQueue(queueBuild(descs));
    });
  });
  view.querySelectorAll('[data-openblock]').forEach(function (card) {
    card.addEventListener('click', function (ev) {
      // The card's own controls (its play button) are not
      // navigation — a tap anywhere else opens the page (§2.2.5).
      if (ev.target && ev.target.closest && ev.target.closest('button, a')) return;
      openBlockPage(card.getAttribute('data-openblock'));
    });
  });
  view.querySelectorAll('[data-back]').forEach(function (btn) {
    btn.addEventListener('click', function () { goListenHome(btn.getAttribute('data-back')); });
  });
  wireOfflineButtons();
  paintOfflineLine();
  // v343 §2.4: the expand wiring + arm pass ride every paint.
  wireExpand(view);
  armAllEllipses();
  // v344: the marker wiring rides the same paints.
  wirePlayed(view);
  if (state.current) markPlaying(state.current.episodeId);
}
function blockCardHtml(b) {
  // §2.2.5: the home block card — a liturgical-gradient face
  // (the --bar-* set), the standing count spans (data-bcount /
  // data-bprayed, written by the standing updaters unchanged),
  // and a play button that queues WITHOUT navigating.
  var n = b.trackCount != null ? b.trackCount : (b.tracks || []).length;
  return '<div class="blockcard" data-openblock="' + esc(b.block) + '">'
    + '<div class="blockcard-face"><div class="blockcard-name">' + esc((b.label || b.block).toUpperCase()) + '</div>'
    + (b.caption ? '<div class="blockcard-cap">' + esc(b.caption) + '</div>' : '') + '</div>'
    + '<div class="blockcard-meta"><span data-bcount="' + esc(b.block) + '">' + esc(b.caption || '') + ' · ' + n + ' tracks</span><span data-bprayed="' + esc(b.block) + '"></span></div>'
    + '<button class="playbtn blockcard-play" data-queue="' + esc(b.block) + '" aria-label="Play ' + esc(b.label || b.block) + '">&#9654;</button></div>';
}
function episodesCardHtml(day) {
  // §2.2.6: the unblocked group stands as one further card in
  // the same grid when the day carries episodes.
  return '<div class="blockcard" data-openblock="__episodes">'
    + '<div class="blockcard-face"><div class="blockcard-name">FROM TODAY&rsquo;S PODCAST</div></div>'
    + '<div class="blockcard-meta"><span>' + (day.episodes || []).length + ' tracks</span></div>'
    + '<button class="playbtn blockcard-play" data-queue="__episodes" aria-label="Play the podcast episodes">&#9654;</button></div>';
}
function paintListenHome(day) {
  var html = '<h1 class="screen">Listen</h1><p class="sub">' + esc(day.dateLabel || 'the day&rsquo;s prayers') + '</p>';
  html += '<div class="row"><button class="btn gold" id="play-all">Play All</button><span class="meta grow">the whole day, in order</span><button class="btn ghost" id="sleep-btn">' + esc(sleepLabel()) + '</button></div>';
  // v392 W5: the offline readiness line + the download button.
  html += offlineLineHtml('offline-dl-btn');
  // §2.6.1: the search pill — typing re-paints the results region
  // in place (the field itself never re-renders, so focus and the
  // query stand); clearing restores the standing home body.
  html += '<div class="searchpill"><input type="search" id="day-search" placeholder="Search today&rsquo;s prayers" aria-label="Search today&rsquo;s prayers" value="' + esc(state.searchQuery || '') + '"></div>';
  html += '<div id="home-body">' + homeBodyHtml(day) + '</div>';
  view.innerHTML = html;
  // §2.4: the Play All + sleep wiring lives here — both elements
  // exist only on home.
  document.getElementById('play-all').addEventListener('click', function () {
    // v344 §2.4: Play All skips played — the build passes the
    // played filter; a fully-played day plays in full (the
    // fallback stands by construction, never a dead button).
    startQueue(queueBuild(extRebuildDescs(day)));
  });
  document.getElementById('sleep-btn').addEventListener('click', openSleepSheet);
  var search = document.getElementById('day-search');
  search.addEventListener('input', function () {
    state.searchQuery = search.value;
    var body = document.getElementById('home-body');
    if (!body) return;
    body.innerHTML = homeBodyHtml(day);
    wirePrayersView(day);
    // paintContinue runs on played writes + resolution settles;
    // a fresh body needs its own call so the Continue card stands
    // the moment a query is cleared back to the home body.
    paintContinue();
  });
}
function homeBodyHtml(day) {
  // While a query stands, the home body is the results paint
  // instead of the Continue row + cards (§2.2.3).
  var q = (state.searchQuery || '').trim().toLowerCase();
  if (q) return searchResultsHtml(day, q);
  // v344 §2.6: the Continue card's standing place — the slot
  // under the Play All row. Decision 2: the Continue row stands
  // FIRST, then the blocks as cards.
  var html = '<div id="continue-slot"></div>';
  html += '<div class="blockgrid">';
  (day.blocks || []).forEach(function (b) { html += blockCardHtml(b); });
  if ((day.episodes || []).length) html += episodesCardHtml(day);
  html += '</div>';
  return html;
}
function searchResultsHtml(day, q) {
  // §2.6.2: the closed corpus — the presented day only: block
  // labels + captions, track titles across blocks + the episodes
  // group, and the prayers' intention texts.
  // v384 §2.6: the introHit indirection retires — the intention
  // text rides on the prayer descriptor itself, so the hit reads
  // prayer descriptors' intentionText directly.
  var blocks = (day.blocks || []).filter(function (b) {
    return (b.label || '').toLowerCase().indexOf(q) >= 0
      || (b.block || '').toLowerCase().indexOf(q) >= 0
      || (b.caption || '').toLowerCase().indexOf(q) >= 0;
  });
  // Track hits read the RESOLVED descriptor list — the presented
  // day as it stands on its pages (payload tracks, the episodes
  // group, and the settings families' slot tracks alike), never
  // the raw payload alone: the Daily Rosary stands on the Morning
  // page through its settings card, and a search that cannot find
  // it has not searched the day.
  var hits = (state.dayDescs || []).filter(function (d) { return (d.title || '').toLowerCase().indexOf(q) >= 0 || (d.intentionText && d.intentionText.toLowerCase().indexOf(q) >= 0); });
  if (!blocks.length && !hits.length) return '<p class="meta" style="margin-top:14px">Nothing in today&rsquo;s prayers matches.</p>';
  var html = '';
  if (blocks.length) html += '<h2 class="sectionhead">BLOCKS</h2><div class="blockgrid">' + blocks.map(function (b) { return blockCardHtml(b); }).join('') + '</div>';
  if (hits.length) html += '<h2 class="sectionhead">PRAYERS</h2>' + hits.map(function (t) { return trackCard(t); }).join('');
  return html;
}
function paintBlockPage(day, block) {
  if (block === '__episodes') { paintEpisodesPage(day); return; }
  var b = (day.blocks || []).filter(function (x) { return x.block === block; })[0];
  if (!b) { paintListenHome(day); return; }
  var n = b.trackCount != null ? b.trackCount : (b.tracks || []).length;
  // §2.3.1: the playlist-form header — full-bleed liturgical
  // gradient, back row, the block name large, the meta line
  // (the standing data-bcount / data-bprayed spans carry the
  // settled counts), and the Play All row with the standing
  // Mark-all-played + Spotify controls at its end.
  var html = '<div class="blockpage-head" data-block="' + esc(b.block) + '">'
    + '<div class="backrow"><button class="backbtn" data-back="' + esc(b.block) + '">&lsaquo; Listen</button></div>'
    + '<div class="blockpage-title">' + esc((b.label || b.block).toUpperCase()) + '</div>'
    + '<div class="blockpage-meta">' + esc(day.dateLabel || '') + ' · <span data-bcount="' + esc(b.block) + '">' + esc(b.caption || '') + ' · ' + n + ' tracks</span><span data-bprayed="' + esc(b.block) + '"></span></div>'
    + '<div class="blockpage-playrow"><button class="playbtn big" data-queue="' + esc(b.block) + '" aria-label="Play all of ' + esc(b.label || b.block) + '">&#9654;</button><span class="blockpage-playlabel">Play All — ' + esc(b.label || b.block) + '</span><span class="grow"></span>'
    + (b.spotifyUrl ? '<a class="spot" target="_blank" rel="noopener" href="' + esc(b.spotifyUrl) + '">Open in Spotify</a>' : '')
    + '<button class="btn ghost small" data-markblock="' + esc(b.block) + '">Mark all played</button></div></div>';
  // §2.3.2: the block's rows, rendered by trackCard exactly as
  // the flat paint rendered them.
  html += (b.tracks || []).map(function (t) { return trackCard(Object.assign({}, t, { _block: b.block })); }).join('');
  view.innerHTML = html;
  appendBlockSettingsCards(day, b);
  // v374 §2 (site 1): the header span stands in the view now —
  // rewrite it from the current descriptor count, so a block page
  // painted after settlement reads the true count at first paint
  // (the shell seed is 0 for every block but The AI Signal).
  updateBlockCounts(day);
}
function paintEpisodesPage(day) {
  // §2.3.4: the unblocked group in the same page form — a paint
  // target only: not a block, in no settings list, no data-bcount.
  var eps = day.episodes || [];
  var html = '<div class="blockpage-head" data-block="__episodes">'
    + '<div class="backrow"><button class="backbtn" data-back="__episodes">&lsaquo; Listen</button></div>'
    + '<div class="blockpage-title">FROM TODAY&rsquo;S PODCAST</div>'
    + '<div class="blockpage-meta">' + esc(day.dateLabel || '') + ' · ' + eps.length + ' tracks</div>'
    + '<div class="blockpage-playrow"><button class="playbtn big" data-queue="__episodes" aria-label="Play all of the podcast episodes">&#9654;</button><span class="blockpage-playlabel">Play All — From Today&rsquo;s Podcast</span></div></div>';
  html += eps.map(function (t) { return trackCard(t); }).join('');
  view.innerHTML = html;
}
function appendBlockSettingsCards(day, b) {
  // The block's settings-row cards (own families + external
  // slots), in the same merged settings order blockInsertCards
  // inserts them (§2.4) — rendered from standing state when the
  // page opens after the inserter's moment, each in the form its
  // swap path would render (ownSwapRow / extSwapCard), so a later
  // settle swaps them in place by their standing identities
  // (data-own-row / data-card). Before the standing lists exist
  // this appends nothing: blockInsertCards lands the cards when
  // the pass runs, against the page that stands then.
  var entries = [];
  (state.ownStanding || []).filter(function (r) { return r.block === b.block; })
    .forEach(function (row) { entries.push({ sortOrder: row.sortOrder || 0, own: row }); });
  (state.extStanding || []).filter(function (s) { return s.block === b.block; })
    .forEach(function (slot) { entries.push({ sortOrder: slot.sortOrder || 0, ext: slot }); });
  if (!entries.length) return;
  entries.sort(function (a, c) { return a.sortOrder - c.sortOrder; });
  var date = day.presentedDay || day.date;
  entries.forEach(function (e) {
    if (e.own) {
      var row = e.own;
      var st = state.ownSlots[row.sourceKey];
      var tmp = document.createElement('div');
      if (st && st.state === 'present') tmp.innerHTML = st.tracks.map(function (m) { return trackCard(ownSlotTrack(row, m, date)); }).join('');
      else if (st && st.state === 'missing') tmp.innerHTML = trackCard(ownSlotTrack(row, { episodeId: row.episodeId, title: row.title, state: 'missing' }, date));
      else tmp.innerHTML = ownPlaceholderCard(row);
      while (tmp.firstChild) { var el = tmp.removeChild(tmp.firstChild); el.setAttribute('data-own-row', row.sourceKey); view.appendChild(el); }
    } else {
      var slot = e.ext;
      var st2 = state.extSlots[slot.slotId];
      var tmp2 = document.createElement('div');
      if (st2 && st2.state === 'downloading') tmp2.innerHTML = extDownloadingCard(slot);
      else if (st2 && st2.state !== 'loading') tmp2.innerHTML = trackCard(extSlotTrack(slot, st2));
      else tmp2.innerHTML = extPlaceholderCard(slot);
      // Append ALL of the fragment's children (the prayer card
      // alone under v384; v361 §2.4's pair rule superseded).
      while (tmp2.firstChild) view.appendChild(tmp2.removeChild(tmp2.firstChild));
    }
  });
}

/* ---------------- Examination ---------------- */
function renderExamination() { gatedTabRender('examination', renderExaminationContent); }
function renderExaminationContent() {
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
    html += '<h2 class="sectionhead">' + esc(state.examCat) + '</h2>';
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
  }).catch(function (e) { if (pinRefusalGate('examination', renderExaminationContent, e)) return; view.innerHTML = '<p class="err">' + esc(e.message) + '</p>'; });
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
function renderConfession() { gatedTabRender('confession', renderConfessionContent); }
function renderConfessionContent() {
  view.innerHTML = '<h1 class="screen">Confession</h1><p class="meta">Loading...</p>';
  api('/api/confession').then(function (c) {
    var html = '<div class="row"><div class="grow"><h1 class="screen">Confession</h1><p class="sub">preparation and guide</p></div><button class="btn ghost small" id="cf-gear">Guide</button></div>';
    html += '<div class="card"><h3>' + esc(c.elapsed || '') + '</h3>' + (c.lastConfession ? '<p class="meta">Last confession: ' + esc(c.lastConfession.date) + (c.lastConfession.note ? ' — ' + esc(c.lastConfession.note) : '') + '</p>' : '<p class="meta">No confession recorded yet in this app.</p>') + '</div>';
    html += '<h2 class="sectionhead">THE GUIDE</h2>';
    html += (c.guide || []).map(function (g) { return '<div class="card"><h3>' + g.step_no + ' · ' + esc(g.title) + '</h3><p style="margin:0;line-height:1.55;font-size:15px">' + esc(g.body) + '</p></div>'; }).join('');
    var pen = c.penance;
    html += '<h2 class="sectionhead">PENANCE</h2>';
    if (pen && pen.text && !pen.done_at) {
      html += '<div class="card"><h3>Your penance</h3><p style="margin:0 0 8px;line-height:1.55;font-size:15px">' + esc(pen.text) + '</p><button class="btn gold" id="pen-done">Penance complete</button></div>';
    } else if (pen && pen.text && pen.done_at) {
      html += '<div class="card"><p class="meta">The penance from ' + esc(pen.date) + ' is complete.</p></div>';
    } else {
      html += '<div class="card"><p class="meta">No penance stands open. After your next confession, record the penance here.</p><label class="f">Penance given</label><textarea id="pen-text" placeholder="The penance the priest assigned..."></textarea><div style="margin-top:8px"><button class="btn" id="pen-save">Save penance</button></div></div>';
    }
    html += '<h2 class="sectionhead">PREPARATION — SINCE YOUR LAST CONFESSION</h2>';
    var total = 0; (c.prep || []).forEach(function (g) { total += g.entries.length; });
    if (!total) html += '<p class="meta">Nothing stands in the preparation list. Entries from your nightly examinations gather here.</p>';
    html += (c.prep || []).map(function (g) {
      return '<div class="card"><h3>' + esc(g.category) + ' <span class="count">' + g.entries.length + (g.entries.length === 1 ? ' entry' : ' entries') + (g.repeatPrompts ? ' · ' + g.repeatPrompts + ' repeated' : '') + '</span></h3>' + g.entries.map(function (e) { return '<div class="entry">' + esc(e.text) + '<div class="meta">' + esc(e.date) + '</div></div>'; }).join('') + '</div>';
    }).join('');
    html += '<div class="card"><h3>Confession made</h3><label class="f">Date</label><input type="date" id="cf-date" value="' + todayChicago() + '"><label class="f">Note (optional)</label><input type="text" id="cf-note" placeholder=""><div style="margin-top:10px"><button class="btn gold" id="cf-made">Confession made</button></div><p class="meta" style="margin-top:8px">The preparation list closes under this record and starts empty. Nothing is deleted; the history below keeps every record.</p></div>';
    if ((c.history || []).length) {
      html += '<h2 class="sectionhead">HISTORY</h2>';
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
  }).catch(function (e) { if (pinRefusalGate('confession', renderConfessionContent, e)) return; view.innerHTML = '<p class="err">' + esc(e.message) + '</p>'; });
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
setupBridgeCommands(); // v377 B3: the native session's transport lands here (shell only; a no-op elsewhere)
setTab('prayers');
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(function () {}); }
`;
