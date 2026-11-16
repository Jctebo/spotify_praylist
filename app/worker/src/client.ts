// Ora Pro Nobis app client. Four tabs (v410): Prayers (the
// player, with the Intentions pool behind its toggle) ·
// Conscience (Examination and Confession behind one toggle,
// under the one PIN gate) · Podcasts (listening progress,
// v381) · Wallpaper (the wallpaper controls, moved from
// Settings). No checklist
// anywhere: no check-offs, no done states, no counters on prayers
// or examination questions (Amendments 8-9).
export const APP_JS = `
'use strict';
var view = document.getElementById('view');
var audioEl = document.getElementById('audio');
var state = { tab: 'prayers', deepIdx: 0, examCat: null, examFollowActive: false, playingUrl: null, queue: [], queueIdx: -1, current: null, storedDay: null, presentedDay: null, dateLabel: '', liturgical: null, pendingResume: null, sleep: { mode: 'off' }, readTracks: {}, dayDescs: [], dayPayload: null, playedCache: null, repeatIds: {}, previewQueue: null, queuePreviewIdx: -1, restoredQueue: false, prayersView: { kind: 'home' }, podcasts: null, podcastsIndex: null, podcastsReturn: null };
/* v419 (G31): the series collapse state — the standing
   series key + whether its listened-before-current run
   stands open. Reset at every index paint; stamped at every
   series paint. podSkipScrollOnce carries the toggle
   repaint's scroll hold. */
var podCollapse = { series: null, open: false };
var podSkipScrollOnce = false;

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
  var dr = document.getElementById('dock-rate');
  if (dr) dr.textContent = r + '×'; // v412 Fix 13: a sheet-side change follows on the dock cycler at once
  var ss = document.querySelector('.speedsheet');
  if (ss) ss.querySelectorAll('[data-rate]').forEach(function (b) { b.classList.toggle('active', Number(b.getAttribute('data-rate')) === r); });
}
function cycleRate() {
  // v412 Fix 13: the dock's rate cycler — steps the standing
  // SPEED_SET in order through the standing setRate seam: one
  // global rate, persisted under the standing key and applied to
  // the element exactly as the speed sheet's choice is. No
  // per-surface rate exists anywhere.
  var idx = SPEED_SET.indexOf(state.rate || 1);
  setRate(SPEED_SET[(idx + 1) % SPEED_SET.length]);
  updateDock(); // the cycler's label follows at once (setRate already repaints Now Playing)
}
function openSpeedSheet() {
  var old = document.querySelector('.speedsheet');
  if (old) old.remove();
  var sheet = document.createElement('div'); sheet.className = 'sheet speedsheet';
  sheet.innerHTML = '<div class="inner"><div class="row"><h1 class="screen grow">Playback speed</h1></div>'
    + '<p class="meta">One speed for everything the app plays — the day&rsquo;s prayers, the downloaded shows, and Intentions alike. It is remembered on this device.</p>'
    + '<div class="chips">' + SPEED_SET.map(function (r) { return '<button class="chip' + (r === state.rate ? ' active' : '') + '" data-rate="' + r + '">' + r + '&times;</button>'; }).join('') + '</div></div>';
  document.body.appendChild(sheet);
  mountDrawer(sheet, false); // v419: FIT drawer — the header Close retires
  sheet.querySelectorAll('[data-rate]').forEach(function (b) {
    b.addEventListener('click', function () { setRate(Number(b.getAttribute('data-rate'))); });
  });
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
/* v419 (G13/G14): the drawer mount — every sheet except Now
   Playing mounts through here. It prepends the grab strip,
   splits the inner's children into head (the first title row
   or heading) / body (a scrolling .panelbody) / foot (a
   trailing run of action buttons, re-dressed in the foot
   bar), sets the px height from the FIT/TALL class
   (F-419-1), wires the grab-strip drag (a drag of >=25% of
   the panel's height dismisses; a short drag snaps back),
   and wires the scrim tap (a tap on the overlay itself
   dismisses). Every close path stays sheet.remove(). */
function mountDrawer(sheet, tall) {
  sheet.classList.add(tall ? 'drawer-tall' : 'drawer-fit');
  var inner = sheet.querySelector('.inner');
  if (!inner) return;
  var grab = document.createElement('div');
  grab.className = 'grabstrip';
  grab.innerHTML = '<span class="grabpill"></span>';
  inner.insertBefore(grab, inner.firstChild);
  var kids = Array.prototype.slice.call(inner.children).filter(function (n) { return n !== grab; });
  var head = null, rest = kids;
  if (kids.length && (kids[0].classList.contains('row') || /^H[123]$/.test(kids[0].tagName))) { head = kids[0]; rest = kids.slice(1); }
  var foot = null;
  if (rest.length) {
    var last = rest[rest.length - 1];
    if (last.tagName === 'DIV' && last.children.length >= 1 && last.children.length <= 2 &&
        Array.prototype.every.call(last.children, function (c) { return c.tagName === 'BUTTON' && c.classList.contains('btn'); })) {
      foot = last; rest = rest.slice(0, -1);
    }
  }
  var body = document.createElement('div');
  body.className = 'panelbody';
  rest.forEach(function (n) { body.appendChild(n); });
  inner.appendChild(body);
  if (foot) { foot.classList.add('panelfoot'); foot.style.marginTop = '0'; inner.appendChild(foot); }
  var applyH = function () {
    var vh = window.innerHeight;
    if (tall) { inner.style.height = Math.round(vh * 0.92) + 'px'; inner.style.maxHeight = Math.round(vh * 0.92) + 'px'; }
    else { inner.style.maxHeight = Math.round(vh * 0.85) + 'px'; }
  };
  applyH();
  var onResize = function () { if (document.body.contains(sheet)) applyH(); else window.removeEventListener('resize', onResize); };
  window.addEventListener('resize', onResize);
  sheet.addEventListener('click', function (ev) { if (ev.target === sheet) sheet.remove(); });
  var dragY = null, dragDy = 0;
  grab.addEventListener('pointerdown', function (ev) {
    dragY = ev.clientY; dragDy = 0;
    var move = function (e2) {
      if (dragY === null) return;
      dragDy = Math.max(0, e2.clientY - dragY);
      inner.style.transform = 'translateY(' + dragDy + 'px)';
    };
    var up = function () {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      if (dragY === null) return;
      var h = inner.offsetHeight || 1;
      var dismiss = dragDy >= h * 0.25;
      dragY = null;
      inner.style.transition = 'transform .22s ease';
      inner.style.transform = dismiss ? 'translateY(' + h + 'px)' : 'translateY(0)';
      setTimeout(function () { if (dismiss) sheet.remove(); inner.style.transition = ''; inner.style.transform = ''; }, dismiss ? 230 : 10);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });
}
/* v419 (G16): the Now Playing grab — the NP sheets keep the
   full-height geometry and gain the handle: a tap on the
   handle, or a downward drag of >=25% of the viewport,
   minimizes (the caller's own act); a short drag snaps back. */
function wireNpGrab(sheet, minimize) {
  var grab = sheet.querySelector('.np-grab');
  if (!grab) return;
  var dragY = null, dragDy = 0;
  grab.addEventListener('pointerdown', function (ev) {
    dragY = ev.clientY; dragDy = 0;
    var move = function (e2) {
      if (dragY === null) return;
      dragDy = Math.max(0, e2.clientY - dragY);
      sheet.style.transform = 'translateY(' + dragDy + 'px)';
    };
    var up = function () {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      if (dragY === null) return;
      var go = dragDy >= window.innerHeight * 0.25;
      dragY = null;
      sheet.style.transition = 'transform .22s ease';
      sheet.style.transform = go ? 'translateY(100%)' : 'translateY(0)';
      setTimeout(function () { if (go) minimize(); sheet.style.transition = ''; sheet.style.transform = ''; }, go ? 230 : 10);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });
  grab.addEventListener('click', function () { minimize(); });
}
/* v419 (G23): the one confirm — a FIT drawer naming the act
   in one sentence, Ghost Cancel + the Commit in the foot
   bar (the Danger dress where the act is destructive). */
function openConfirm(opts) {
  var sheet = document.createElement('div');
  sheet.className = 'sheet confirmsheet';
  sheet.innerHTML = '<div class="inner"><p class="confirmline">' + esc(opts.line) + '</p>' +
    '<div class="row" style="margin-top:6px"><button class="btn ghost grow" data-cfcancel>Cancel</button>' +
    '<button class="btn ' + (opts.danger ? 'danger' : 'gold') + ' grow" data-cfgo>' + esc(opts.commitLabel) + '</button></div></div>';
  document.body.appendChild(sheet);
  mountDrawer(sheet, false);
  sheet.querySelector('[data-cfcancel]').addEventListener('click', function () { sheet.remove(); });
  sheet.querySelector('[data-cfgo]').addEventListener('click', function () { sheet.remove(); if (opts.act) opts.act(); });
}
/* v419 (G21/F-419-5): the skeletons — a loading paint in the
   screen's own geometry (blocks in the one deeper surface
   step, standing still), carrying data-skeleton so the place
   probes read a loading paint structurally, never by text. */
function skelHtml(kind) {
  var bar = function (w) { return '<span class="skelbar" style="width:' + w + '%"></span>'; };
  var rows = function (n, h) { var s = ''; for (var i = 0; i < n; i++) s += '<div class="skel skelrow" style="height:' + h + 'px"></div>'; return s; };
  if (kind === 'prayers') return '<div data-skeleton="1"><div class="skel" style="height:30px;width:55%;margin:0 0 12px"></div>' + rows(6, 76) + '</div>';
  if (kind === 'gate') return '<div data-skeleton="1"><div class="skel" style="height:30px;width:50%;margin:0 0 12px"></div><div class="skel" style="height:180px"></div></div>';
  if (kind === 'podindex') return '<div data-skeleton="1">' + rows(3, 76) + '</div>';
  if (kind === 'podseries') return '<div data-skeleton="1"><div class="skel" style="height:120px;margin:0 0 10px"></div>' + bar(60) + rows(5, 76) + '</div>';
  if (kind === 'settings') return '<div data-skeleton="1">' + rows(3, 96) + '</div>';
  if (kind === 'intentions') return '<div data-skeleton="1"><div class="skel" style="height:64px;margin:0 0 10px"></div>' + rows(4, 76) + '</div>';
  if (kind === 'conscience') return '<div data-skeleton="1">' + rows(4, 64) + '</div>';
  return '<div data-skeleton="1">' + rows(3, 76) + '</div>';
}
function todayChicago() {
  var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  var p = {}; parts.forEach(function (x) { p[x.type] = x.value; });
  return p.year + '-' + p.month + '-' + p.day;
}
var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function shortDayLabel(s) {
  // v417 §2.7 (D2): the short day form — 'Nov 14' from an ISO
  // day; a value already standing in a rendered form passes
  // through unchanged. No clock time, no year, no weekday.
  var m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(String(s || ''));
  if (!m) return String(s || '');
  return MONTHS_SHORT[Number(m[2]) - 1] + ' ' + Number(m[3]);
}
function presentedDayWord() {
  // v417 §2.7 (D2): the presented day's word for row metas —
  // 'Today' when the presented day is today (Chicago), else
  // the short form, derived from the day the client holds.
  var p = presentedDateStr();
  if (!p) return 'Today';
  return p === todayChicago() ? 'Today' : shortDayLabel(p);
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
  view = realView; // v410: the gate stands in the full view, never inside a side host
  if (pinToken) { contentFn(); return; }
  if (pinStateCache && !pinStateCache.pinSet) { renderPinSetupPrompt(tab, contentFn, {}); return; }
  view.innerHTML = skelHtml('gate'); // v419 (SK-1): the gate wait paints the gate geometry
  fetchPinState().then(function (st) {
    if (!st.pinSet) { renderPinSetupPrompt(tab, contentFn, {}); return; }
    if (pinToken) { contentFn(); return; }
    renderPinGate(tab, contentFn, {});
  }).catch(function () { renderPinSetupPrompt(tab, contentFn, { unreadable: true }); });
}
function pinGateTitles(tab) {
  // v410 §2.5: the per-side entries retire with the per-side
  // gates; the one merged tab carries the one title pair.
  if (tab === 'conscience') return { screen: 'Conscience', lock: 'Conscience is protected by your PIN' };
  return { screen: 'Settings', lock: 'This section is protected by your PIN' };
}
function renderPinGate(tab, contentFn, opts) {
  clearPinWait();
  var titles = pinGateTitles(tab);
  pinGateCtx = { tab: tab, contentFn: contentFn, entry: '' };
  var html = '<h1 class="screen">' + titles.screen + '</h1>';
  html += '<div class="card pingate" id="pingate-card"><div class="lockline">' + titles.lock + '</div>';
  html += '<div class="pindots" id="pindots"></div>';
  // v419 (G29): the hint line under the dots — the PIN rule,
  // stated before the first wrong entry.
  html += '<div class="meta" id="pinhint">Enter your PIN to unlock — 4 to 8 digits.</div>';
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
  mountDrawer(sheet, false); // v419: FIT drawer — Copy + Done land in the foot bar
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
  view = realView; // v410: the re-stood gate replaces the whole tab, side host included
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
  syncBarsRow(id); // v417 §2.6 (FD7): the bars tile marks the current row
  state.playingUrl = state.current ? state.current.url : null;
}
function barsTileHtml() {
  // v417 §2.6 (FD7): the bars tile's element — stands inside
  // every row's art wrap, shown only on the current row (the
  // .barsrow CSS in ui.ts); three bars, the mockup's form.
  return '<span class="barstile" aria-hidden="true"><i></i><i></i><i></i></span>';
}
function syncBarsRow(id) {
  // v417 §2.6 (FD7): the row class lands on [data-card] and
  // [data-podrow] alike (podcast rows gain row-level marking
  // here for the first time). The bars animate only while
  // the transport plays; under .barspaused they stand
  // frozen — read from the same predicate at the same
  // moment the play button's dress is set above, so the
  // tile can never disagree with it.
  var live = !!id && transportPlaying();
  document.querySelectorAll('[data-card], [data-podrow]').forEach(function (row) {
    var rid = row.getAttribute('data-card') || row.getAttribute('data-podrow');
    var on = !!id && rid === id;
    row.classList.toggle('barsrow', on);
    row.classList.toggle('barspaused', on && !live);
  });
}
function syncBarsPaused() {
  // v417 §2.6: the transport sync funnel (updateDock, driven
  // by the element's play/pause events) keeps the frozen
  // state truthful across a pause/resume that starts no new
  // track — the same guarantee updateDock's own dock-play
  // glyph read gives the dock's face.
  var row = document.querySelector('.barsrow');
  if (row) row.classList.toggle('barspaused', !transportPlaying());
}
function markSkipped(id) {
  var card = document.querySelector('[data-card="' + id + '"]');
  if (!card) return;
  card.style.outline = '2px solid #8a4b2a';
  setTimeout(function () { card.style.outline = ''; }, 2400);
}
function flashPassOver(desc) {
  // v412 (Fixes 2, 3, 7): a pass-over shows WHY on the entry's own
  // card — the standing skipped flash plus a line that stands
  // until the card next re-renders. A card that is not painted
  // (the Podcasts tab's rows carry no [data-card]) degrades to
  // the flash alone, exactly as markSkipped degrades.
  if (!desc) return;
  markSkipped(desc.episodeId);
  var card = document.querySelector('[data-card="' + desc.episodeId + '"]');
  if (!card) return;
  var old = card.querySelector('.passline');
  if (old) old.remove();
  var line = document.createElement('div');
  line.className = 'passline meta';
  line.textContent = 'Couldn\u2019t play \u2014 passed over';
  card.appendChild(line);
}
function paintWaitLine() {
  // v412 Fix 7: while the bounded error wait stands, the current
  // entry's card and the dock carry the retrying line — the wait
  // is visible instead of silent. Driven off state.errWaitN, the
  // wait's own counter: painted while a wait stands for the
  // current entry, cleared everywhere when it resolves (restart,
  // pass-over, or a fresh start).
  var cur = state.current;
  var show = !!cur && (state.errWaitN || 0) > 0;
  document.querySelectorAll('[data-card]').forEach(function (card) {
    var line = card.querySelector('.waitline');
    if (show && card.getAttribute('data-card') === cur.episodeId) {
      if (!line) { line = document.createElement('div'); line.className = 'waitline meta'; card.appendChild(line); }
      line.textContent = 'Trouble playing \u2014 retrying';
    } else if (line) line.remove();
  });
  var dt = document.querySelector('.docktext');
  if (dt) {
    var dw = dt.querySelector('.waitline');
    if (show) {
      if (!dw) { dw = document.createElement('div'); dw.className = 'waitline meta'; dt.appendChild(dw); }
      dw.textContent = 'Trouble playing \u2014 retrying';
    } else if (dw) dw.remove();
  }
}
function mintBlobUrl(owner, blob) {
  // v412 Fix 11: the one mint for blob URLs — the owner's standing
  // URL is revoked as its replacement is minted, so a descriptor
  // or slot never holds two live URLs and a replaced one never
  // leaks. The owner keeps the live URL on its own record
  // (blobUrl), which is also how replacement finds it.
  if (!owner) return URL.createObjectURL(blob);
  if (owner.blobUrl) { try { URL.revokeObjectURL(owner.blobUrl); } catch (e) {} owner.blobUrl = null; }
  var u = URL.createObjectURL(blob);
  owner.blobUrl = u;
  return u;
}
var ownBlobOwners = {}; // v412 Fix 11: one mint owner per own-audio cache key
function ownBlobOwner(cacheKey) { return ownBlobOwners[cacheKey] || (ownBlobOwners[cacheKey] = {}); }
var extBlobOwners = {}; // v412 Fix 11: one mint owner per external slot
function extSlotOwner(slot) { return extBlobOwners[slot.slotId] || (extBlobOwners[slot.slotId] = {}); }
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
  if (!rec || typeof rec !== 'object' || (rec.v !== 1 && rec.v !== 2)) { removeQueueSnapshot(); return null; }
  // v412 Fix 9: the podcast form carries no date — its shape is
  // series + sequence keys; the day form's shape stands as it was.
  if (rec.form === 'podcast') {
    if (typeof rec.series !== 'string' || !rec.series || !Array.isArray(rec.seqKeys) || !rec.seqKeys.length) { removeQueueSnapshot(); return null; }
    return rec;
  }
  if (typeof rec.date !== 'string' || !Array.isArray(rec.ids) || !rec.ids.length) { removeQueueSnapshot(); return null; }
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
    // v412 Fix 9: a podcast queue snapshots in the podcast form —
    // the series plus the entries' sequence keys, NO date: a
    // podcast queue is not a day queue and the day turn must not
    // kill it. Resolution against the series payload happens at
    // restore (tryStandPodcastRestore); the day form below stands
    // byte-identical for day queues.
    var cur0 = state.current;
    if (cur0.kind === 'podcast' && cur0.podSeries && state.queue.every(function (d) { return d.kind === 'podcast' && d.podSeries === cur0.podSeries; })) {
      localStorage.setItem(QUEUE_KEY, JSON.stringify({
        v: 2, form: 'podcast', series: cur0.podSeries,
        seqKeys: state.queue.map(function (d) { return d.seriesKey; }),
        idx: state.queueIdx, currentKey: cur0.seriesKey,
        positionS: (posS !== undefined ? posS : (audioEl.currentTime || 0)),
        savedAt: new Date().toISOString(),
      }));
      return;
    }
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
  // v412 Fix 9: a podcast record sets the podcast probe — no date
  // check (the day turn does not kill it) and no restoredQueue
  // flag (Continue is a day surface). The restore itself waits
  // for the series payload (tryStandPodcastRestore).
  if (rec.form === 'podcast') { state.podRestoreProbe = rec; return; }
  if (rec.date !== presentedDateStr()) { removeQueueSnapshot(); return; }
  state.restoredQueue = true;
}
function tryStandPodcastRestore() {
  // v412 Fix 9: the podcast restore — runs when a series payload
  // stands (openPodSeries / the series re-read). The record's
  // sequence keys resolve against the payload's entries: an entry
  // the payload no longer carries, or carries without a URL,
  // drops silently, exactly as a day restore drops a descriptor
  // the fresh build no longer carries; if NO entry resolves, the
  // record clears. The restored queue stands PAUSED, loaded not
  // playing — the day form's posture — at the record's index
  // among the survivors, its position riding the pendingResume
  // seam. Nothing is stomped: while any transport stands current,
  // the probe waits (a fresh play overwrites the record through
  // the standing save triggers and retires the probe with it).
  var rec = state.podRestoreProbe;
  if (!rec || !state.podcasts || state.podcasts.series !== rec.series) return;
  if (state.current) return;
  var entries = state.podcasts.entries || [];
  var byKey = {};
  entries.forEach(function (e) { byKey[e.key] = e; });
  var descs = [];
  var keptIdx = [];
  rec.seqKeys.forEach(function (k, i) {
    var e = byKey[k];
    if (e && e.url) { descs.push(podDesc(e)); keptIdx.push(i); }
  });
  if (!descs.length) { removeQueueSnapshot(); state.podRestoreProbe = null; return; }
  var idx = keptIdx.indexOf(rec.idx);
  if (idx < 0) idx = 0;
  state.queue = descs;
  state.queueIdx = idx;
  var chosen = descs[idx];
  state.current = chosen;
  setMediaSessionFor(chosen);
  state.pendingResume = rec.positionS > 0 ? { episodeId: chosen.episodeId, positionS: rec.positionS } : null;
  setPlaybackState('paused');
  audioEl.src = chosen.url;
  try { audioEl.load(); } catch (e) {}
  markPlaying(null);
  updateDock();
  renderQueueList();
  state.podRestoreProbe = null;
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
  closeWatch(); // v434 §2.6.2 seat 3: every fresh audio start tears a standing watch frame down BEFORE audioEl.play() runs below
  // The audio-load step — startDesc's tail, split out at v384.
  // v388: it is the WHOLE start tail now — no step stands
  // before it and nothing defers it; startDesc runs it inline
  // on every start. Byte-for-byte in behavior: src, rate
  // re-assert, play(), the state pushes.
  audioEl.src = desc.url;
  audioEl.playbackRate = state.rate; // v336: re-asserted on every start — no stale element rate
  playIntent = true; // v412: a start attempt IS a standing intent to play (the error guard reads it)
  audioEl.play().catch(function () { onStartRejected(desc); }); // v412 Fix 3: a rejected start is reported + recovered, never swallowed
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
  // v395 §2.6/§2.8: the podcast position seams ride this funnel.
  // Skip-away first, while the outgoing track and its position
  // still stand; then the incoming podcast track's resume — its
  // saved position (the descriptor's podPositionS, from the open
  // payload) enters the standing pendingResume seam, so the
  // loadedmetadata seek and queueStartPos serve it exactly as
  // they serve the day queue's carries: no new seek code. The
  // seam keys on episodeId; a podcast descriptor's episodeId is
  // its series-prefixed sequence key (ciy:/biy:/riy:), unique
  // per episode across series. A listened podcast starts at 0
  // through the same path (its podPositionS is null — any
  // same-episode residue clears; §2.8). The save tick's marker
  // resets at every track change.
  // v412 Fix 11: a replaced descriptor's minted blob URL is
  // revoked at the moment of replacement — the outgoing track's
  // URL never outlives its start.
  if (state.current && state.current !== desc && state.current.blobUrl) {
    try { URL.revokeObjectURL(state.current.blobUrl); } catch (e) {}
    state.current.blobUrl = null;
  }
  podPositionSkipAway(desc);
  dayPositionSkipAway(desc); // v412 Fix 10: the day mirror of the skip-away save
  if (desc.kind === 'podcast') {
    state.pendingResume = desc.podPositionS > 0
      ? { episodeId: desc.episodeId, positionS: desc.podPositionS }
      : (state.pendingResume && state.pendingResume.episodeId === desc.episodeId ? null : state.pendingResume);
    podPosSentKey = desc.podSeries + '/' + desc.seriesKey; podPosSentVal = -1;
  } else {
    podPosSentKey = null; podPosSentVal = -1;
    // v412 Fix 10: the day track's saved position (the payload's
    // dayPositions fold) enters the standing pendingResume seam —
    // no new seek code. A carry naming a DIFFERENT episode is
    // spent (its moment passed at the last start) and clears so
    // the fold can apply; a carry naming THIS episode (Continue,
    // the restored queue) stands untouched.
    if (state.pendingResume && state.pendingResume.episodeId !== desc.episodeId) state.pendingResume = null;
    if (!state.pendingResume) {
      var dayPos = (state.dayPayload && state.dayPayload.dayPositions) ? state.dayPayload.dayPositions[desc.episodeId] : null;
      if (dayPos > 0) state.pendingResume = { episodeId: desc.episodeId, positionS: Math.floor(dayPos) };
    }
    dayPosSentKey = desc.episodeId; dayPosSentVal = -1;
  }
  // v412 Fix 7: an error wait belonging to a previous track ends
  // at this start — its line clears with the track it named.
  if (state.errWaitKey && state.errWaitKey.indexOf(desc.episodeId + '@') !== 0) { state.errWaitKey = null; state.errWaitN = 0; }
  paintWaitLine();
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
      .then(function (blob) { if (blob) desc.url = mintBlobUrl(desc, blob); loadDescAudio(desc); });
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
  state.podRestoreProbe = null; // v412 Fix 9: a fresh play retires a standing podcast restore probe
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
  closeWatch(); // v434 §2.6.2 seat 3: a resume is an audio start — a standing watch frame is destroyed BEFORE audioEl.play() runs below
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
  playIntent = true; // v412: a resume attempt is a standing intent to play (the error guard reads it)
  if (audioEl.currentSrc && !audioEl.ended) {
    // v397 §2.9: the resume outcome is REPORTED, not swallowed
    // — a rejection becomes the resumeFailed fact on the next
    // push, so the face's latch can act on evidence instead of
    // silence. A resolution clears a standing unreported flag.
    audioEl.play().then(function () { resumeFailedPending = false; }, function () { noteResumeFailed(); });
  } else {
    // The element holds nothing for the standing track (e.g. the
    // sleep-hold head, loaded on a preload="none" element): load
    // the current track's URL under startDesc's rate discipline.
    // The queue and queueIdx are not touched.
    audioEl.src = state.current.url;
    audioEl.playbackRate = state.rate;
    audioEl.play().then(function () { resumeFailedPending = false; }, function () { noteResumeFailed(); });
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
  state.podRestoreProbe = null; // v412 Fix 9: a new queue birth retires a standing podcast restore probe
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
    if (desc.block) metaParts.push(esc(blockDisplayName(desc.block)));
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
    + '<div class="np-grab"><span class="grabpill"></span></div>'
    + '<div class="npq-head"><span class="npq-heading">Queue</span><span class="meta" id="np-queue-pos"></span></div>'
    + '</div>'
    + '<div id="np-queue" class="liblist"></div>'
    + '</div>';
  document.body.appendChild(sheet);
  // v419 (G16): the minimize button retires into the grab — a
  // tap on the handle, or a drag down, runs the same act.
  wireNpGrab(sheet, function () { state.previewQueue = null; state.queuePreviewIdx = -1; sheet.remove(); });
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
  // v412 Fix 10: a day track that reaches its end clears its
  // saved position in the same moment (a position of 0 deletes
  // the row) — a finished prayer never resumes at its end.
  if (endedDesc && endedDesc.kind !== 'podcast') writeDayPositionQuiet(endedDesc.episodeId, 0, 0);
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
/* v412: the standing intent to play — set at every play attempt
   (loadDescAudio, resumeCurrent) and at every 'play' event,
   cleared at every 'pause' event. The error listener's guard
   reads it: an error with no standing intent (a paused track's
   deferred load, the sleep hold) never enters recovery — the
   v358 4-second window's job, done by intent instead of time. */
var playIntent = false;
/* v412 Fix 2: the stall watchdog — a mid-track stall (the
   element stops advancing under a standing intent, short of an
   error) is detected from the element's own signals: 'waiting' /
   'stalled' stamp the position; a 1 s tick reads progress. A
   stamp that stands 8 s without the position advancing 0.25 s
   is a stall: ONE recovery cycle (re-resolve against the live
   build and restart on the fresh URL, else reload the standing
   URL — the error path's seam), and if a second cycle also
   fails, the entry passes over as a missing entry passes over.
   Progress (or a 'playing' event) clears the stamp and the
   cycle count. */
function stallKeyOf() { return state.current ? state.current.episodeId + '@' + state.queueIdx : ''; }
function stallNote() {
  if (!state.current || !playIntent) return;
  var k = stallKeyOf();
  if (state.stallKey === k) return;
  state.stallKey = k; state.stallAt = Date.now(); state.stallPos = audioEl.currentTime || 0; state.stallCycles = 0;
}
function stallClear() { state.stallKey = null; state.stallAt = 0; state.stallCycles = 0; }
function stallTick() {
  if (!state.stallKey || !state.current) return;
  if (state.stallKey !== stallKeyOf()) { stallClear(); return; }
  if ((audioEl.currentTime || 0) > (state.stallPos || 0) + 0.25) { stallClear(); return; }
  if (Date.now() - (state.stallAt || 0) < 8000) return;
  if ((state.stallCycles || 0) >= 1) {
    var cur = state.current;
    stallClear();
    flashPassOver(cur);
    if (state.queue.length) advanceQueue(1);
    else { try { audioEl.pause(); } catch (e) {} setPlaybackState('paused'); }
    return;
  }
  state.stallCycles = (state.stallCycles || 0) + 1;
  state.stallAt = Date.now(); state.stallPos = audioEl.currentTime || 0;
  var cur2 = state.current;
  var live = queueLiveDesc(cur2);
  if (live && live.url && live.url !== cur2.url) {
    if (state.queue.length && state.queue[state.queueIdx]) state.queue[state.queueIdx] = live;
    startDesc(live);
  } else {
    loadDescAudio(cur2);
  }
}
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
    paintWaitLine(); // v412 Fix 7: the wait resolved — its line clears
    startDesc(live);
    return;
  }
  var key = cur.episodeId + '@' + (inQueue ? state.queueIdx : 'single');
  var tries = state.errWaitKey === key ? (state.errWaitN || 0) + 1 : 1;
  state.errWaitKey = key; state.errWaitN = tries;
  paintWaitLine(); // v412 Fix 7: the wait stands — its line shows
  if (tries <= 4) { // v412 Fix 7: the error wait is bounded at 4 tries (was 20)
    var wantId = cur.episodeId, wantIdx = state.queueIdx;
    setTimeout(function () {
      if (state.current && state.current.episodeId === wantId && state.queueIdx === wantIdx && audioEl.error) handleAudioError();
    }, 1500);
    return;
  }
  state.errWaitKey = null; state.errWaitN = 0;
  paintWaitLine(); // v412 Fix 7: the wait resolved — its line clears
  flashPassOver(cur); // v412 Fix 7: the pass-over shows why on the entry's card
  if (inQueue) { advanceQueue(1); return; }
  state.current = null; setPlaybackState('none'); markPlaying(null);
  updateDock();
}
audioEl.addEventListener('error', function () {
  // v412 (Fixes 2/3): the standing-intent guard replaces the v358
  // 4-second window. An error belongs to recovery only while an
  // intent to play stands — a start attempt or a playing track
  // that has not been paused since. A paused load standing by
  // (loadResume, the sleep hold) carries no intent and its error
  // stands unacted, exactly as the window used to leave it.
  if (!state.current || !playIntent) return;
  handleAudioError();
});
audioEl.addEventListener('waiting', function () { stallNote(); }); // v412 Fix 2
audioEl.addEventListener('stalled', function () { stallNote(); }); // v412 Fix 2
audioEl.addEventListener('playing', function () { stallClear(); }); // v412 Fix 2: resumed progress clears the stamp
audioEl.addEventListener('pause', function () { saveResume(); saveQueueSnapshot(); if (!state.queue.length) markPlaying(state.current ? state.current.episodeId : null); });
audioEl.addEventListener('play', function () { playIntent = true; state.startRetryKey = null; setPlaybackState('playing'); updateDock(); pushNativeState(false); }); // v412: a play event stands the intent + clears Fix 3's retry key
audioEl.addEventListener('pause', function () { playIntent = false; }); // v412: any pause ends the standing intent (user pause, sleep stop, track end alike)
audioEl.addEventListener('pause', function () { updateDock(); });
audioEl.addEventListener('pause', function () { pushNativeState(false); }); // v377 B2: any element pause states the face
audioEl.addEventListener('pause', function () {
  // v346: the pause event declares the paused session (playbackState
  // 'paused' while a current stands, else 'none') and re-files it —
  // the session goes quiet exactly when it must stay declared.
  setPlaybackState(state.current ? 'paused' : 'none');
  reassertMediaSession();
});
audioEl.addEventListener('pause', function () { podPositionSaveCurrent(); }); // v395 §2.6: a podcast pause is a position save event
audioEl.addEventListener('pause', function () { dayPositionSaveCurrent(); }); // v412 Fix 10: a day pause is a position save event (the mirror)
document.addEventListener('visibilitychange', function () {
  // v355 §2.2 trigger 5: the freeze that precedes a discard is a
  // last-chance snapshot write (the v346 re-assert below is
  // untouched — the hook rides the same event, on the way out).
  if (document.visibilityState === 'hidden') { saveQueueSnapshot(); podPositionSaveCurrent(); dayPositionSaveCurrent(); } // v395 §2.6 + v412 Fix 10: a hide is a position save event
  // v346: return to the foreground (including a freeze/thaw) re-files
  // the session — metadata, handlers, state, position.
  if (document.visibilityState === 'visible') reassertMediaSession();
});
window.addEventListener('pagehide', function () { saveQueueSnapshot(); podPositionSaveCurrent(); dayPositionSaveCurrent(); }); // v355 §2.2 trigger 5: the discard moment itself · v395 §2.6 + v412 Fix 10: the close save rides the same moment
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
  if (now - podPosLastTick > 15000) { podPosLastTick = now; podPositionTick(); } // v395 §2.6: the 15 s position tick
  if (now - dayPosLastTick > 15000) { dayPosLastTick = now; dayPositionTick(); } // v412 Fix 10: the day mirror tick, same cadence
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
  /* v414 §2.7: --brandh — the brand bar's measured height,
     the sticky toggles' top offset (the --tabh precedent). */
  var bb = document.querySelector('.brandbar');
  if (bb) document.documentElement.style.setProperty('--brandh', bb.offsetHeight + 'px');
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
  // v417 §2.8: the retired face buttons' updateDock writes
  // leave with their elements (Previous lives in the dock
  // menu now, standing exactly while a queue stands).
  syncBarsPaused(); // v417 §2.6: the bars' frozen state follows the transport
  // v413 §2.8: the dock thumb is the playing episode's own art
  // (§2.3's chain), the logo tile its fallback.
  var dt = document.getElementById('dock-thumb');
  if (dt) { var dts = cur.imageUrl || '/logo.png'; if (dt.getAttribute('src') !== dts) dt.setAttribute('src', dts); }
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
function nativeSleepArm(epochMs) {
  // v412 Fix 14 (page side): a minutes arm ALSO stands natively —
  // the shell's service holds the deadline across a page kill and
  // stops playback at it; its own backstop covers a page that
  // never wakes. On the web (no bridge) this is a no-op and the
  // page timer stands alone, exactly as before.
  try {
    var p = oraBridgePlugin();
    if (!p || !p.armSleepDeadline) return;
    var r = p.armSleepDeadline({ epochMs: epochMs });
    if (r && r.catch) r.catch(function () {});
  } catch (e) {}
}
function nativeSleepClear() {
  // v412 Fix 14 (page side): the native deadline clears with the
  // page's — disarm, re-arm, track arm, and the timed stop itself
  // all pass through the functions below, so no stale native
  // deadline can outlive the page's state.
  try {
    var p = oraBridgePlugin();
    if (!p || !p.clearSleepDeadline) return;
    var r = p.clearSleepDeadline({});
    if (r && r.catch) r.catch(function () {});
  } catch (e) {}
}
function armSleepMinutes(n) {
  if (fade.started) fadeRestore();
  state.sleep = { mode: 'minutes', presetMin: n, deadlineMs: Date.now() + n * 60000 };
  nativeSleepArm(state.sleep.deadlineMs); // v412 Fix 14
  updateSleepLabel();
}
function armSleepTrack() {
  if (fade.started) fadeRestore();
  state.sleep = { mode: 'track' };
  nativeSleepClear(); // v412 Fix 14: a track arm carries no deadline — any standing native deadline clears
  updateSleepLabel();
}
// v412 Fix 14: the native clear rides every disarm (incl. fireTimedStop + sleepTrackEnd).
function disarmSleep() { state.sleep = { mode: 'off' }; nativeSleepClear(); }
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
  sheet.innerHTML = '<div class="inner"><div class="row"><h1 class="screen grow">Sleep timer</h1></div>'
    + '<p class="meta">Minutes until playback stops — the queue is held, not cleared. End of track stops when the playing track finishes.</p>'
    + '<div class="chips">' + choices.map(function (c) { return '<button class="chip' + (isArmed(c) ? ' active' : '') + '" data-sleep-choice="' + c.k + '">' + c.label + '</button>'; }).join('') + '</div></div>';
  document.body.appendChild(sheet);
  mountDrawer(sheet, false); // v419: FIT drawer — the header Close retires
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
setInterval(stallTick, 1000); // v412 Fix 2: the stall watchdog's 1 s progress read

// v346: ONE module-level handler table, built once — boot and every
// re-assert register this same object, so the table's identity (and
// the harness hook's target) never drifts across a re-assert.
var mediaHandlers = {
  play: function () { resumeCurrent(); }, // v346 §2.4: the app's resume seam (carries the v320 §2.6 restore point (3) fade restore)
  pause: function () { pauseTransport(); },
  previoustrack: function () { previousWithRule(); }, // v412 Fix 8: the web session reads the one Previous rule
  nexttrack: function () { if (state.queue.length) advanceQueue(1); },
  seekto: function (details) {
    if (details.seekTime == null) return;
    if (details.fastSeek && typeof audioEl.fastSeek === 'function') audioEl.fastSeek(details.seekTime);
    else audioEl.currentTime = details.seekTime;
  },
  seekforward: function (details) { seekBy((details && details.seekOffset) || 10); }, // v412 Fix 12: the one seek-step implementation
  seekbackward: function (details) { seekBy(-((details && details.seekOffset) || 10)); }, // v412 Fix 12
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

/* ---------------- Merged tabs (v410) ----------------
   Two of the four tabs carry two standing screens behind ONE
   segmented toggle (John's one-canonical-element rule): the
   Prayers tab (Prayers | Intentions) and the Conscience tab
   (Examination | Confession, behind the one PIN gate, §2.5).
   The container paints the toggle plus a #sidehost region
   into the view; the side renders then paint into the host —
   the module view handle points at the host while a
   container stands and is restored to the real view by every
   full-screen render (setTab, Settings, the PIN gate). Each
   toggle remembers its side on the device (D2), in the
   standing opn-<name>-v<NNN> key pattern, and each side
   keeps its own scroll position across switches: the switch
   records window.scrollY for the outgoing side and restores
   the incoming side's value once its content paint lands
   (the queue-box capture/restore arithmetic, §2.3). */
var realView = view;
var TAB_SIDE_PRAYERS_KEY = 'opn-tabside-prayers-v410';
var TAB_SIDE_CONSCIENCE_KEY = 'opn-tabside-conscience-v410';
/* v414 §2.5 (FD1): the Wallpaper tab joins the merged-tab
   family — its own key of the v410 pattern with this
   release's number in the vNNN slot; first-run default
   Phone (the mockups draw Phone first, and the Phone view
   carries the controls block). */
var TAB_SIDE_WALLPAPER_KEY = 'opn-tabside-wallpaper-v414';
var tabSideNow = { prayers: 'prayers', conscience: 'examination', wallpaper: 'phone' };
var sideScroll = {};
function tabSideCfg(tab) {
  if (tab === 'conscience') return { key: TAB_SIDE_CONSCIENCE_KEY, def: 'examination', sides: [['examination', 'Examination'], ['confession', 'Confession'], ['direction', 'Spiritual Direction']] };
  if (tab === 'wallpaper') return { key: TAB_SIDE_WALLPAPER_KEY, def: 'phone', sides: [['phone', 'Phone'], ['watch', 'Watch']] };
  return { key: TAB_SIDE_PRAYERS_KEY, def: 'prayers', sides: [['prayers', 'Prayers'], ['intentions', 'Intentions']] };
}
function readTabSide(tab) {
  var cfg = tabSideCfg(tab);
  var v = null;
  try { v = localStorage.getItem(cfg.key); } catch (e) { v = null; }
  var known = false;
  cfg.sides.forEach(function (s) { if (s[0] === v) known = true; });
  tabSideNow[tab] = known ? v : cfg.def;
  return tabSideNow[tab];
}
function writeTabSide(tab, side) {
  tabSideNow[tab] = side;
  try { localStorage.setItem(tabSideCfg(tab).key, side); } catch (e) {}
}
function paintSideToggle(tab, current) {
  var cfg = tabSideCfg(tab);
  return '<div class="segtoggle" id="sidetoggle">' + cfg.sides.map(function (s) {
    return '<button data-side="' + s[0] + '"' + (s[0] === current ? ' class="active"' : '') + '>' + s[1] + '</button>';
  }).join('') + '</div>';
}
function wireSideToggle(tab) {
  var t = document.getElementById('sidetoggle');
  if (!t) return;
  t.querySelectorAll('[data-side]').forEach(function (b) {
    b.addEventListener('click', function () { switchSide(tab, b.getAttribute('data-side')); });
  });
}
/* v447: the Conscience sides' bar — it stands in its own
   host, so the side paints, which replace the side host
   whole, never carry it, and the frozen layer on these
   pages stays the header alone: the brand bar + this bar.
   v448: the host's seat moves AHEAD of the toggle in
   paintMergedContainer — the bar takes the top slot
   directly under the brand bar and the (unfrozen) toggle
   scrolls beneath it.
   v450: the bar carries NO back act. The sides are the
   Conscience tab's own home — Examination and Confession
   are sides of a top-level tab, not pages pushed from
   Prayers — so no parent stands over them, and the bar
   names the side alone, centered (John's ruling: the bar
   registered as a subpage of Prayers, and it is not).
   The way between tabs is the bottom tab bar, as on
   every tab home. The v447 reading (the bar reads
   Prayers, its tap setTab('prayers')) stands retired
   with its wiring. */
function paintConscienceBar(side) {
  var host = document.getElementById('consbar');
  if (!host) return;
  // v453 §2: the third side reads its own title — the bar
  // carries the title alone for every side (the v450 rule).
  var titles = { examination: 'Examination', confession: 'Confession', direction: 'Spiritual Direction' };
  host.innerHTML = iosBarHtml({ title: titles[side] || 'Examination' });
}
/* v448: the Prayers tab's pushed-page bar — the parallel
   host to #consbar, filled by the block + episodes paints
   and cleared by the home + Intentions paints (a null
   html). The host carries the standing page's block key
   (data-barblock): the settlement inserter's page-standing
   check reads it — the seat the retired .blockpage-head
   lookup read before this fix. The bar's back act wires
   here, as paintConscienceBar wires its own:
   wirePrayersView's [data-back] pass reads the side host
   only, and this bar stands outside it. */
function paintPrayersBar(html, block) {
  var host = document.getElementById('pushbar');
  if (!host) return;
  host.innerHTML = html || '';
  if (block) host.setAttribute('data-barblock', block); else host.removeAttribute('data-barblock');
  var b = host.querySelector('[data-back]');
  if (b) b.addEventListener('click', function () { goListenHome(b.getAttribute('data-back')); });
}
function enterSideHost() { var h = document.getElementById('sidehost'); if (h) view = h; }
function recordSideScroll(tab) {
  if (tab !== 'prayers' && tab !== 'conscience') return;
  sideScroll[tab + ':' + tabSideNow[tab]] = window.scrollY || 0;
}
function armSideScrollRestore(tab, side) {
  var host = document.getElementById('sidehost');
  if (!host) return;
  var target = sideScroll[tab + ':' + side] || 0;
  var done = false;
  var obs = null;
  function attempt() {
    if (done) return;
    if (host.querySelector('[data-skeleton]')) return; // v419: the loading read is structural (the skeleton marker), never text
    done = true;
    if (obs) obs.disconnect();
    window.scrollTo(0, target);
  }
  if (typeof MutationObserver !== 'undefined') {
    obs = new MutationObserver(attempt);
    obs.observe(realView, { childList: true, subtree: true });
  }
  attempt();
}
/* ---------------- Place-keeping (v411 §2.4) ----------------
   ONE place store, generalized from v410's side machinery —
   not a second system. placeScroll IS v410's sideScroll map
   (the same object, the same side keys), widened with the
   'settings' screen key; Podcasts keeps its scroll inside
   its return record (state.podcastsReturn). placeText holds
   in-progress field text by element id, harvested generically
   — no per-form list. Retention is the page session: module
   state only, nothing persisted. capturePlace() runs at the
   head of every full-view repaint entry (setTab, switchSide,
   renderSettings) while the outgoing screen still stands;
   armPlaceRestore(key) rides v410's one observer pattern —
   when the skeleton marker leaves the view it refills the
   harvested text and sets the scroll. placeSkip marks a field
   whose save just succeeded: capture drops its entry instead
   of storing it, so a saved draft is never resurrected
   (§2.10 leg 2.2e). */
var placeScroll = sideScroll;
var placeText = {};
var placeSkip = {};
var podLevel = 'index';
/* v434 §2.6: the Podcasts WATCH record — stands only while the
   watch view stands (the frame exists only while the view
   stands). { video, scroll } — the tapped video and the series
   page's scroll at the tap, so the back act returns to the
   standing place. podWatchPlayer is the IFrame API handle (its
   error events are the refusal seam, §2.6.3). */
var podWatch = null;
var podWatchPlayer = null;
/* v436 §2.2: the CatholicTV series' FULL PAGE — the channel
   page the series page is a 15-video window onto. A client
   constant of the video kind (the series payload carries no
   such field; no server change rides this release). The act
   that opens it stands in paintPodcastVideos — its form and
   handler are podFullPageActHtml / openFullPage below. */
var YT_CHANNEL_URL = "https://www.youtube.com/@catholictv";
function placeScreenKey() {
  /* v414 §2.8: the Wallpaper tab rides the same entries —
     its scroll is kept per side, like the merged tabs. */
  if (state.tab === 'prayers' || state.tab === 'conscience' || state.tab === 'wallpaper') return state.tab + ':' + tabSideNow[state.tab];
  return state.tab;
}
function capturePlace() {
  if (state.tab === 'podcasts') {
    // v434 §2.6.2: a standing WATCH records as its parent SERIES
    // level (the watch never stands on a return — a tab switch
    // tears its frame down), at the series page's own scroll.
    state.podcastsReturn = {
      level: podLevel === 'watch' ? 'series' : podLevel,
      series: (podLevel !== 'index' && state.podcasts) ? state.podcasts.series : null,
      scroll: (podLevel === 'watch' && podWatch) ? (podWatch.scroll || 0) : (window.scrollY || 0),
    };
  } else if (state.tab) {
    placeScroll[placeScreenKey()] = window.scrollY || 0;
  }
  realView.querySelectorAll('textarea, input, select').forEach(function (el) {
    if (!el.id) return;
    if (!(el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.type === 'text' || el.type === 'search')) return;
    if (placeSkip[el.id]) { delete placeText[el.id]; delete placeSkip[el.id]; return; }
    placeText[el.id] = el.value;
  });
}
function restorePlaceText() {
  Object.keys(placeText).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = placeText[id];
  });
}
function armPlaceRestore(key) {
  var target = placeScroll[key];
  var done = false;
  var obs = null;
  function attempt() {
    if (done) return;
    if (realView.querySelector('[data-skeleton]')) return; // v419: the loading read is structural (the skeleton marker), never text
    done = true;
    if (obs) obs.disconnect();
    restorePlaceText();
    if (typeof target === 'number') window.scrollTo(0, target);
  }
  if (typeof MutationObserver !== 'undefined') {
    obs = new MutationObserver(attempt);
    obs.observe(realView, { childList: true, subtree: true });
  }
  attempt();
}
function armPodScroll(y) {
  var done = false;
  var obs = null;
  function attempt() {
    if (done) return;
    if (realView.querySelector('[data-skeleton]')) return; // v419: the loading read is structural (the skeleton marker), never text
    done = true;
    if (obs) obs.disconnect();
    window.scrollTo(0, y || 0);
  }
  if (typeof MutationObserver !== 'undefined') {
    obs = new MutationObserver(attempt);
    obs.observe(realView, { childList: true, subtree: true });
  }
  attempt();
}

function paintTabSide(tab, side) {
  if (tab === 'wallpaper') { if (side === 'watch') paintWallpaperWatch(); else paintWallpaperPhone(); }
  else if (tab === 'prayers') { if (side === 'intentions') renderIntentions(); else renderPrayersSide(); }
  else { paintConscienceBar(side); if (side === 'confession') renderConfessionContent(); else if (side === 'direction') renderDirectionContent(); else renderExaminationContent(); }
}
function switchSide(tab, side) {
  if (!document.getElementById('sidehost')) return;
  capturePlace(); // v411 §2.4: harvest the outgoing side before it repaints
  recordSideScroll(tab);
  writeTabSide(tab, side);
  document.querySelectorAll('#sidetoggle [data-side]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-side') === side); });
  paintTabSide(tab, side);
  armSideScrollRestore(tab, side);
  armPlaceRestore(tab + ':' + side); // v411 §2.12: the same store value + the text refill
}
function paintMergedContainer(tab) {
  var side = readTabSide(tab);
  // v448: the pushed-page bar host stands BEFORE the toggle
  // in both merged tabs — the bar takes the top slot directly
  // under the brand bar, and the toggle + the side host
  // scroll beneath it (John's word closing the v447 field
  // check: "put tabs beneath header unfrozen").
  view.innerHTML = (tab === 'conscience' ? '<div id="consbar"></div>' : '<div id="pushbar"></div>') + paintSideToggle(tab, side) + '<div id="sidehost"></div>';
  wireSideToggle(tab);
  enterSideHost();
  paintTabSide(tab, side);
  armSideScrollRestore(tab, side);
  armPlaceRestore(tab + ':' + side);
}

function setTab(tab) {
  closeWatch(); // v434 §2.6.2 seat 2: any tab switch tears a standing watch frame down first — the video sounds only while its surface stands open; the harvest below then reads the restored series page, the watch's standing place
  capturePlace(); // v411 §2.4: harvest the outgoing screen before the dispatch repaints
  recordSideScroll(state.tab);
  view = realView;
  state.tab = tab;
  document.querySelectorAll('#tabbar .tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
  if (tab === 'prayers') renderPrayers();
  else if (tab === 'conscience') renderConscience();
  else if (tab === 'podcasts') renderPodcasts();
  else if (tab === 'wallpaper') renderWallpaper();
}
document.querySelectorAll('#tabbar .tab').forEach(function (b) {
  b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
});
document.getElementById('dock-play').addEventListener('click', function () { if (!state.current) return; if (state.queue.length) { if (transportPlaying()) pauseTransport(); else resumeCurrent(); } else playTrack(state.current); });
document.getElementById('dock-next').addEventListener('click', function () { advanceQueue(1); });
// v417 §2.8 (D4/FD4): the face carries play + next only —
// Previous (v412 Fix 8's button) and the intentions toggle
// retire into the dock's own overflow (openDockMenu); Fix
// 8's one rule stands as the menu item's act, and the
// intentions act is unchanged. Their listeners leave with
// their elements.
document.getElementById('dock-menu').addEventListener('click', function () { openDockMenu(); });
document.getElementById('dock').addEventListener('click', function (ev) {
  if (ev.target && ev.target.closest && (ev.target.closest('#dock-play') || ev.target.closest('#dock-next') || ev.target.closest('#dock-menu'))) return;
  openNowPlaying(); // v336 (D5, approved): the dock tap opens Now Playing — the v326 jump-to-card is retired
});
/* v437 (§2.1/§2.4): in the shell, mark <html> BEFORE the
   first measureBars() below — the class takes the bar's
   env() padding out (ui.ts's html.in-shell rule), so
   --tabh is measured at the corrected height from the
   first paint. The resize re-measure (standing since
   v326) is rAF-throttled and calls only measureBars()
   (F-437-I3): a fold/unfold lands as a resize. */
if (oraInShell()) document.documentElement.classList.add('in-shell');
var barsResizeRaf = 0;
window.addEventListener('resize', function () {
  if (barsResizeRaf) return;
  barsResizeRaf = requestAnimationFrame(function () { barsResizeRaf = 0; measureBars(); });
});
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
function podRowArtHtml(e) {
  // v413 §2.3/§2.6: a podcast row's art — the episode's own art,
  // else the series' show art, else the fallback tile (§2.3's
  // chain). Referenced, never re-hosted.
  // v417 §2.5 (FD3): the tile's content is the podcast mark
  // (♫), never the series initial; the bars tile stands in
  // the wrap for the current row (§2.6).
  var s = state.podcasts;
  var url = e.imageUrl || (s && s.showImageUrl) || null;
  var tile = '<span class="rowart tile tone-navy"><span>\u266b</span></span>';
  if (url) return '<span class="rowartwrap">' + tile + '<img class="rowart" src="' + esc(url) + '" alt="" onerror="this.remove()">' + barsTileHtml() + '</span>';
  return '<span class="rowartwrap">' + tile + barsTileHtml() + '</span>';
}
function podDesc(e) {
  // v390 §2.7: the descriptor gains the series (the open
  // payload's key) beside the standing fields, so the completion
  // seam can mark the playing episode's OWN series.
  // v395 §2.8: the descriptor also carries the entry's saved
  // position (podPositionS) — the server value from the open
  // payload, null for listened and untouched entries — so every
  // start the queue reaches can hand it to the resume seam.
  return { episodeId: e.key, kind: 'podcast', seriesKey: e.key, podSeries: state.podcasts ? state.podcasts.series : null, title: e.label + ': ' + e.title, url: e.url, available: !!e.url, block: 'Podcasts', durationS: e.durationS || 0, podPositionS: (!e.listened && e.positionS > 0) ? Math.floor(e.positionS) : null, imageUrl: e.imageUrl || (state.podcasts ? state.podcasts.showImageUrl : null) || null, descText: e.descText || null };
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
  // v395 §2.9: the mark clears the position in the same act —
  // the pending slot entry dies with the mark (the server's
  // route deletes the row; the slot never disagrees), and the
  // in-memory flip below nulls the entry's positionS beside the
  // listened flip, so the bar vanishes with the check.
  podPosSlotDrop(seriesKey, seqKey);
  if (state.podcasts && state.podcasts.series === seriesKey && state.podcasts.entries) {
    state.podcasts.entries.forEach(function (e) { if (e.key === seqKey && !e.listened) { e.listened = true; e.source = source; e.listenDate = todayChicago(); e.positionS = null; } });
    var left = state.podcasts.entries.filter(function (e) { return !e.listened; });
    state.podcasts.listenedCount = state.podcasts.entries.length - left.length;
    state.podcasts.currentKey = podCurrentKey(state.podcasts.entries);
  }
}
function renderPodcasts() {
  // v390 §2.7: the tab enters at the series level — the first
  // open of a session still lands there. v411 §2.4 (the §1.3
  // override, scoped to exactly this): a session return record
  // (state.podcastsReturn, written by capturePlace whenever
  // the screen is left or the level changes) restores an
  // in-session return to the level left — the series page
  // paints at once from the standing payload (the auto-mark's
  // mutation rule reads that same object; no copy is kept),
  // its scroll restores, AND the standing re-read still runs:
  // the fresh payload repaints in place with the recorded
  // scroll re-applied. If the payload no longer matches the
  // record, the record follows the payload — paint what
  // stands, scroll best-effort.
  var rec = state.podcastsReturn;
  if (rec && rec.level === 'series' && rec.series && state.podcasts && state.podcasts.series === rec.series) {
    paintPodSeriesPage(); // v434 §2.1: the return paints a video payload through its own painter
    armPodScroll(rec.scroll);
    api('/api/player/podcasts?series=' + encodeURIComponent(rec.series)).then(function (res) {
      state.podcasts = res;
      tryStandPodcastRestore(); // v412 Fix 9: the series payload stands — a podcast restore probe may resolve
      if (state.tab === 'podcasts' && podLevel === 'series' && state.podcastsReturn === rec) { paintPodSeriesPage(); armPodScroll(rec.scroll); }
    }).catch(function () {});
    return;
  }
  if (rec && rec.level === 'index' && state.podcastsIndex) {
    paintPodcastsIndex();
    armPodScroll(rec.scroll);
    api('/api/player/podcasts').then(function (res) {
      state.podcastsIndex = res;
      if (state.tab === 'podcasts' && podLevel === 'index' && state.podcastsReturn === rec) { paintPodcastsIndex(); armPodScroll(rec.scroll); }
    }).catch(function () {});
    return;
  }
  view.innerHTML = '<h1 class="screen">Formation</h1>' + skelHtml('podindex');
  api('/api/player/podcasts').then(function (res) {
    state.podcastsIndex = res;
    if (state.tab === 'podcasts') paintPodcastsIndex();
  }).catch(function (e) {
    // v419 (G22): the authored failure + a Ghost Retry on this
    // surface's own re-render.
    if (state.tab === 'podcasts') {
      view.innerHTML = '<h1 class="screen">Formation</h1><p class="err">Formation did not load.</p><p><button class="btn ghost" id="pod-retry">Retry</button></p>';
      document.getElementById('pod-retry').addEventListener('click', renderPodcasts);
    }
  });
}
function paintPodcastsIndex() {
  // v390 §2.7: the series level — one card per series in
  // registry order (title · counts · current line), the whole
  // card tappable. An unavailable series shows its unavailable
  // line on its own card.
  podLevel = 'index';
  var res = state.podcastsIndex;
  if (!res || !res.seriesList) { view.innerHTML = '<h1 class="screen">Formation</h1>' + skelHtml('podindex'); return; }
  podCollapse = { series: null, open: false }; // v419 (G31): the index paint resets the collapse
  // v432 §2.3: the offline box retires on the index; the Download
  // for offline button stands at the head row beside the title, in
  // its standing dress (id, classes, label byte-identical).
  var html = '<div class="row headrow"><h1 class="screen grow">Formation</h1><button class="btn ghost small" id="pod-offline-btn">Download for offline</button></div>';
  res.seriesList.forEach(function (s) {
    // v413 §2.7: playlist-style entries — the provider's own
    // show artwork (§2.3's showImageUrl; a series-initial tile
    // is the fallback), name, the standing progress facts in
    // the meta position.
    var tile = '<span class="rowart tile tone-navy"><span>\u266b</span></span>';
    var art = '<span class="rowartwrap">' + tile + (s.showImageUrl ? '<img class="rowart" src="' + esc(s.showImageUrl) + '" alt="" onerror="this.remove()">' : '') + '</span>';
    html += '<div class="card" data-podseries="' + esc(s.series) + '"><div class="row">' + art + '<div class="grow"><h3>' + esc(s.title) + '</h3>';
    if (s.kind === 'video') {
      // v434 §2.1/§2.5: a VIDEO series card carries its own meta
      // form — the audio form (listened counts, a current
      // episode) does not apply: a video series carries no marks
      // and no current episode. Its art is the newest video's
      // thumbnail (§2.1's showImageUrl), over the same tile.
      if (!s.available) {
        html += '<div class="meta">This series is unavailable right now. Try again later.</div>';
      } else {
        html += '<div class="meta">Video \u00b7 Latest: ' + esc(s.latestLabel || '') + '</div>';
      }
    } else if (s.kind === 'own') {
      // v451 §2.4: an OWN series card — the audio form's counts
      // do not apply (the kind carries no marks, the video
      // branch's discipline), so its meta is the standing
      // Current form alone, naming the current episode (the
      // payload's currentLabel: today's title when one stands,
      // else the newest). Its art is the show image the entry
      // carries ('/logo.png'), over the same tile, through the
      // standing art line above — no art special-case stands.
      if (!s.available) {
        html += '<div class="meta">This series is unavailable right now. Try again later.</div>';
      } else {
        html += '<div class="meta">Current: ' + esc(s.currentLabel || '') + '</div>';
      }
    } else if (!s.available) {
      html += '<div class="meta">This series is unavailable right now. Try again later.</div>';
    } else {
      html += '<div class="meta">' + s.listenedCount + ' of ' + s.total + ' listened'
        + (s.currentLabel ? ' · Current: ' + esc(s.currentLabel) : ' · Complete') + '</div>';
    }
    html += '</div></div></div>';
  });
  view.innerHTML = html;
  wireOfflineButtons();
  paintOfflineLine();
  view.querySelectorAll('[data-podseries]').forEach(function (c) {
    c.addEventListener('click', function () { openPodSeries(c.getAttribute('data-podseries')); });
  });
}
function paintPodSeriesPage() {
  // v434 §2.1: the series-page dispatch — a VIDEO payload paints
  // through paintPodcastVideos; the audio paintPodcasts is not
  // entered for it. Every standing series-page paint seat (the
  // open, the session return) routes through here.
  if (state.podcasts && state.podcasts.kind === 'video') paintPodcastVideos();
  else if (state.podcasts && state.podcasts.kind === 'own') paintPodOwnSeries();
  else paintPodcasts();
}
function openPodSeries(key) {
  closeWatch(); // v434 §2.6.2 seat 4: opening any series while a watch record somehow stands closes it first — the invariant has no unnamed path
  view.innerHTML = '<h1 class="screen">Formation</h1>' + skelHtml('podseries');
  api('/api/player/podcasts?series=' + encodeURIComponent(key)).then(function (res) {
    state.podcasts = res;
    tryStandPodcastRestore(); // v412 Fix 9: the series payload stands — a podcast restore probe may resolve
    if (state.tab === 'podcasts') paintPodSeriesPage();
  }).catch(function (e) {
    // v419 (G22): the authored failure + a Ghost Retry.
    if (state.tab === 'podcasts') {
      view.innerHTML = '<h1 class="screen">Formation</h1><p class="err">Formation did not load.</p><p><button class="btn ghost" id="pod-retry">Retry</button></p>';
      document.getElementById('pod-retry').addEventListener('click', function () { openPodSeries(key); });
    }
  });
}
function goPodcastsIndex() {
  // v411 §2.4: backing out clears the return record —
  // renderPodcasts then paints the index from its standing
  // payload (the record is what a TAB return reads, never
  // the back button).
  // v421 §2.5 (D-421-1): factored out of wirePodBack into
  // one named act — the disc tap and the system-back
  // dispatch call THIS function; one act, two triggers.
  state.podcastsReturn = null;
  renderPodcasts();
}
function wirePodBack() {
  var b = view.querySelector('[data-podback]');
  if (b) b.addEventListener('click', goPodcastsIndex);
}
/* ---------------- v447: the iOS-style bar ----------------
   Scope/Plan Builds 1-3: ONE shared emission for every
   pushed page — the left cluster (the chevron + the
   destination's name; the button carries the site's
   standing back wiring unchanged), the page's standing
   name centered and bold, and the page's own acts at the
   right. A destination name longer than 14 characters
   reads "Back" (the long-name rule) — the full name
   stands in the aria-label either way. The dress stands
   in ui.ts (.iosbar): the light grey-white ground; the
   chevron, the name, and the acts in the day's liturgical
   color via the standing theme token var(--accent-text). */
function iosBarHtml(o) {
  // v450: a call with no destination emits the title-only
  // form — no back act stands in the bar (the Conscience
  // sides' bar; their tab is a home, not a pushed page).
  // Every standing caller passes a dest and its output is
  // unchanged.
  if (!o.dest) {
    return '<div class="iosbar' + (o.inhead ? ' inhead' : '') + '">'
      + '<div class="iosbar-title">' + esc(o.title) + '</div>'
      + '<div class="iosbar-right">' + (o.rightHtml || '') + '</div></div>';
  }
  var shown = o.dest.length > 14 ? 'Back' : o.dest;
  return '<div class="iosbar' + (o.inhead ? ' inhead' : '') + '">'
    + '<button class="iosbar-back" ' + o.backAttrs + ' aria-label="Back to ' + esc(o.dest) + '">'
    + '<span class="iosbar-chev">&lsaquo;</span><span class="iosbar-name">' + esc(shown) + '</span></button>'
    + '<div class="iosbar-title">' + esc(o.title) + '</div>'
    + '<div class="iosbar-right">' + (o.rightHtml || '') + '</div></div>';
}
/* ---------------- v436: the full-page act ----------------
   §2.2: ONE act in the video series page head, in the Podcasts
   surfaces' standing act dress (the watch view's "Open in
   YouTube" form — an anchor in ghost-button dress). The
   anchor form is load-bearing: its native behavior IS the
   fallback (§2.4), so no surface can strand the tap. The act
   stands in both paints of paintPodcastVideos — its target
   is a constant, not snapshot data, and a down feed is
   exactly when the full page earns its place. */
function podFullPageActHtml() {
  return '<p><a class="btn ghost" data-podfullpage href="' + YT_CHANNEL_URL + '" target="_blank" rel="noopener">Full page on YouTube</a></p>';
}
function wirePodFullPage() {
  var a = view.querySelector('[data-podfullpage]');
  if (a) a.addEventListener('click', openFullPage);
}
function openFullPage(e) {
  // §2.4 branch 1 — the guard fails: do nothing. No
  // preventDefault, no throw; the anchor's native behavior
  // stands (web: the channel page opens in a new tab; old
  // shell 1.0.35: the navigation leaves the app origin and
  // the shell's standing rule ejects it as an ACTION_VIEW).
  // The guard reads Capacitor.Plugins.Browser in exactly
  // the OraDayBridge guard's shape (§2.0; F-436-I4) — no new
  // detection surface.
  var cap = window.Capacitor;
  if (!cap || !cap.Plugins || !cap.Plugins.Browser) return;
  // Branch 2 — pause BEFORE the open (one sound, §2.4): the
  // standing pause act, v434's own watch-open line, so the
  // playback state reads paused from the one source of truth
  // for the whole time the tab stands. On dismissal nothing
  // resumes and nothing repaints — the app never navigated.
  if (e && e.preventDefault) e.preventDefault();
  if (!audioEl.paused) pauseTransport();
  var p;
  try { p = cap.Plugins.Browser.open({ url: YT_CHANNEL_URL, toolbarColor: '#16283f' }); }
  catch (err) { window.open(YT_CHANNEL_URL, '_blank'); return; }
  // Branch 3 — a rejected open (no Custom Tab provider
  // stands on the device) falls back to the anchor's
  // behavior, performed by hand, exactly once.
  if (p && p.catch) p.catch(function () { window.open(YT_CHANNEL_URL, '_blank'); });
}
/* ---------------- Podcasts OWN series (v451) ----------------
   §2.4: the own series page — the standing store catalog,
   newest first, painted in the standing series grammar (the
   bar · the .podpage-head · the episode rows in the standing
   episode-row dress). It looks like any other series page:
   the head's cover is the payload's show image ('/logo.png',
   the standing own-content logo) over the tile, exactly as an
   audio page's head carries its show image; the rows carry
   the row art in its standing form (podRowArtHtml reads the
   payload's showImageUrl), the title, and the meta line (the
   current row names itself "Current episode", as the audio
   rows name theirs). No marks, no partway bar, no download
   cluster stand (the kind carries none — the video page's
   discipline); the rows carry NO written intention line (the
   line was a block-standing artifact, and the uniform-row
   rule retires it with the block). The ONLY difference from
   another series' page is invisible: today's row's play act
   rides the standing local-copy swap seat (aiSettleSwap,
   Trigger A at this paint; podOwnDesc reads the mint at tap
   time). */
function paintPodOwnSeries() {
  var res = state.podcasts;
  if (!res || res.kind !== 'own') { view.innerHTML = '<h1 class="screen">Formation</h1>' + skelHtml('podseries'); return; }
  podLevel = 'series';
  var html = '<h1 class="screen">Formation</h1>';
  html += iosBarHtml({ dest: 'Formation', title: res.title || 'The AI Signal', backAttrs: 'data-podback' });
  if (!res.available) {
    // The standing unavailable surface: no present episode
    // stands in the store — the card form the other series keep.
    html += '<div class="card"><h3>' + esc(res.title || 'The AI Signal') + '</h3><div class="meta">This series is unavailable right now. Try again later.</div></div>';
    view.innerHTML = html;
    wirePodBack();
    return;
  }
  var cur = null;
  res.entries.forEach(function (e) { if (e.key === res.currentKey) cur = e; });
  // The page head in the standing grammar: the show cover
  // (large) · the meta line = the standing facts (the episode
  // count · the total duration · the current episode's title).
  var durSum = res.entries.reduce(function (a, e) { return a + (e.durationS || 0); }, 0);
  var showCover = '<div class="blockcover tone-navy large"><span class="blockcover-initial">\u266b</span>'
    + (res.showImageUrl ? '<img class="coverimg" src="' + esc(res.showImageUrl) + '" alt="" onerror="this.remove()">' : '') + '</div>';
  html += '<div class="podpage-head">' + showCover
    + '<div class="meta">' + res.entries.length + ' episode' + (res.entries.length === 1 ? '' : 's')
    + (durSum > 0 ? ' \u00b7 ' + fmtDurLong(durSum) : '')
    + (cur ? ' \u00b7 Current: ' + esc(cur.title) : '') + '</div></div>';
  res.entries.forEach(function (e) {
    // The standing episode-row dress (v433's slim form): art ·
    // the title line with its cluster (the play disc in the
    // cluster seat) · the meta line. Form-identical for every
    // row, today's included.
    html += '<div class="card trow prow" data-podrow="' + esc(e.key) + '"><div class="row">'
      + podRowArtHtml(e)
      + '<div class="grow"><div class="titlerow"><h3>' + esc(e.title) + '</h3>'
      + '<span class="prow-cluster">'
      + '<button class="playbtn" data-ownplay="' + esc(e.key) + '">&#9654;</button>'
      + '</span></div>'
      + '<div class="meta metarow"><span>' + (e.key === res.currentKey ? 'Current episode \u00b7 ' : '') + esc(e.label) + (e.durationS ? ' \u00b7 ' + fmtDur(e.durationS) : '') + '</span></div></div>'
      + '</div></div>';
  });
  view.innerHTML = html;
  wirePodBack();
  view.querySelectorAll('[data-ownplay]').forEach(function (b) {
    b.addEventListener('click', function () { playPodOwnFrom(b.getAttribute('data-ownplay')); });
  });
  // Trigger A (v430, re-seated): a device-local copy of today's
  // episode already standing swaps in at this paint.
  var todayEntry = null;
  res.entries.forEach(function (e) { if (e.date === todayChicago()) todayEntry = e; });
  if (todayEntry) aiSettleSwap(todayEntry);
  // The audio page's scroll rule: the list opens scrolled to
  // the current entry.
  if (res.currentKey) {
    var el = view.querySelector('[data-podrow="' + res.currentKey + '"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
  }
}
function podOwnDesc(e) {
  // §2.4: the own entry's descriptor, in the day-descriptor
  // form the show's descriptor has always taken (trackDesc's
  // shape: no kind — the podcast stores are never entered; the
  // day-position mirror treats it exactly as it treated the
  // block page's descriptor, under its own per-episode key).
  // Its title takes podDesc's label form; its art is the
  // payload's show image. TODAY's entry takes the device-local
  // copy when the swap stands — aiSettleSwap's mint, read here
  // at tap time, so a copy landing after the paint is taken.
  var url = e.streamUrl;
  if (e.date === todayChicago()) {
    var owner = ownBlobOwners[offlineDayKey(e.date, 'the-ai-signal')];
    if (owner && owner.blobUrl) url = owner.blobUrl;
  }
  return { episodeId: e.key, title: e.label + ': ' + e.title, url: url, available: !!url, block: 'Podcasts', durationS: e.durationS || 0, imageUrl: (state.podcasts ? state.podcasts.showImageUrl : null) || null, descText: null };
}
function playPodOwnFrom(key) {
  // The standing series play act (playPodFrom's shape): play
  // queues the catalog from the tapped entry forward through
  // the standing queue machinery.
  var res = state.podcasts;
  if (!res || !res.entries) return;
  var idx = -1;
  res.entries.forEach(function (e, i) { if (e.key === key) idx = i; });
  if (idx < 0) return;
  var descs = res.entries.slice(idx).map(podOwnDesc).filter(function (d) { return d.available; });
  if (!descs.length) return;
  startQueue(descs, true);
}

/* ---------------- Podcasts VIDEO series (v434) ----------------
   §2.1: the video series page — the standing snapshot's videos,
   newest first. Each row: the thumbnail (referenced from
   YouTube's hosts, never re-hosted) · the title · the published
   date. No current-episode card, no collapse, no marks, no
   partway bar, no download cluster — the row's one act is
   open-and-watch. The page builds on the standing v427-ship
   Podcasts grammar (the back row, the page head); no offline
   line is added to or removed from any surface by v434. */
function paintPodcastVideos() {
  var res = state.podcasts;
  if (!res || res.kind !== 'video') { view.innerHTML = '<h1 class="screen">Formation</h1>' + skelHtml('podseries'); return; }
  podLevel = 'series';
  var html = '<h1 class="screen">Formation</h1>';
  html += iosBarHtml({ dest: 'Formation', title: res.title || 'CatholicTV', backAttrs: 'data-podback' });
  if (!res.available) {
    // The standing unavailable surface: no snapshot and the feed
    // unreachable — the card form the audio series keep.
    html += '<div class="card"><h3>' + esc(res.title || 'CatholicTV') + '</h3><div class="meta">This series is unavailable right now. Try again later.</div></div>';
    html += podFullPageActHtml();
    view.innerHTML = html;
    wirePodBack();
    wirePodFullPage();
    return;
  }
  var newest = (res.videos && res.videos.length) ? res.videos[0] : null;
  // The page head in the standing grammar: the cover is the
  // newest video's thumbnail referenced from YouTube's hosts
  // over the tile fallback; the meta line is §2.5's form.
  var cover = '<div class="blockcover tone-navy large"><span class="blockcover-initial">\u266b</span>'
    + (newest && newest.imageUrl ? '<img class="coverimg" src="' + esc(newest.imageUrl) + '" alt="" onerror="this.remove()">' : '') + '</div>';
  html += '<div class="podpage-head">' + cover
    + '<div class="meta">Video series \u00b7 Updated ' + esc(newest ? newest.dateLabel : '') + '</div></div>';
  // v436 §2.2: the full-page act stands directly under the
  // page head, before the first video card.
  html += podFullPageActHtml();
  (res.videos || []).forEach(function (v) {
    var tile = '<span class="rowart tile tone-navy"><span>\u266b</span></span>';
    var art = '<span class="rowartwrap">' + tile + (v.imageUrl ? '<img class="rowart" src="' + esc(v.imageUrl) + '" alt="" onerror="this.remove()">' : '') + '</span>';
    html += '<div class="card" data-podvideo="' + esc(v.id) + '"><div class="row">' + art
      + '<div class="grow"><h3>' + esc(v.title) + '</h3><div class="meta">' + esc(v.dateLabel) + '</div></div>'
      + '</div></div>';
  });
  view.innerHTML = html;
  wirePodBack();
  wirePodFullPage();
  view.querySelectorAll('[data-podvideo]').forEach(function (c) {
    c.addEventListener('click', function () {
      var id = c.getAttribute('data-podvideo');
      var v = ((state.podcasts && state.podcasts.videos) || []).filter(function (x) { return x.id === id; })[0];
      if (v) openPodWatch(v);
    });
  });
}
/* §2.6: the watch surface — a dedicated third level inside the
   Podcasts navigation. The frame is created at this view's
   paint and nowhere else: no pre-created or hidden frame stands
   anywhere in the tab. */
function openPodWatch(v) {
  // §2.6.2, the forward direction: opening a video silences the
  // audio FIRST — the standing pause act (the same function the
  // transport's pause button runs), so the playback state, the
  // mini-player, and the Now Playing sheet all read paused from
  // the one source of truth. The standing playback state reads
  // paused for the whole time a watch view stands; nothing
  // resumes the audio when the watch closes — the user resumes
  // it himself (the estate's standing posture).
  if (!audioEl.paused) pauseTransport();
  podWatch = { video: v, scroll: window.scrollY || 0 };
  paintPodWatch();
}
function paintPodWatch() {
  if (!podWatch) return;
  var v = podWatch.video;
  podLevel = 'watch';
  var html = '<h1 class="screen">Formation</h1>';
  // The back row's act is closeWatch (one act, two triggers —
  // the disc tap and the system-back dispatch, §2.6.2 seat 1).
  html += iosBarHtml({ dest: 'CatholicTV', title: v.title, backAttrs: 'data-podwatchback' });
  html += '<div class="watchframe-wrap"><iframe class="podwatch-frame" src="https://www.youtube.com/embed/' + esc(v.id) + '?enablejsapi=1&autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="' + esc(v.title) + '"></iframe></div>';
  html += '<div id="podwatch-err" class="err" style="display:none"></div>';
  html += '<div class="meta">' + esc(v.dateLabel) + ' \u00b7 CatholicTV</div>';
  // §2.6.3 (F-434-4): the Open in YouTube act stands PERMANENTLY
  // under the frame — a plain anchor to the video's watch URL,
  // opening externally. It does not wait for a refusal to exist.
  html += '<p><a class="btn ghost" href="' + esc(v.url) + '" target="_blank" rel="noopener">Open in YouTube</a></p>';
  view.innerHTML = html;
  var b = view.querySelector('[data-podwatchback]');
  if (b) b.addEventListener('click', function () { closeWatch(); });
  wirePodWatchApi();
}
function wirePodWatchApi() {
  // §2.6.3: the IFrame Player API is enabled on the embed for
  // exactly one purpose — its error events are the refusal seam.
  // The API script loads on the watch paint only; the player
  // adopts the standing frame (its src carries enablejsapi=1).
  var frame = view.querySelector('iframe.podwatch-frame');
  if (!frame) return;
  var make = function () {
    if (!podWatch || !window.YT || !YT.Player) return;
    try {
      podWatchPlayer = new YT.Player(frame, { events: { onError: function (e) { podWatchOnError(e && e.data); } } });
    } catch (e) { /* no API, no seam — the frame and the standing act still stand */ }
  };
  if (window.YT && YT.Player) { make(); return; }
  var prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function () { if (prev) prev(); make(); };
  var tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}
function podWatchOnError(code) {
  // §2.6.3: error codes 100, 101, and 150 (not found / embedding
  // refused by the owner) stand the authored line and empty the
  // frame seat — the refused frame's own message does not stand
  // beside the authored one. Other codes leave the frame
  // standing (transient player errors are YouTube's to surface).
  if (code !== 100 && code !== 101 && code !== 150) return;
  var seat = view.querySelector('.watchframe-wrap');
  if (seat) seat.innerHTML = '';
  var line = document.getElementById('podwatch-err');
  if (line) { line.textContent = 'YouTube won\u2019t play this one inside the app \u2014 open it in YouTube instead.'; line.style.display = ''; }
}
function closeWatch() {
  // §2.6.2: the one named teardown act — destroys the iframe
  // element, clears the standing watch record, and (when the
  // watch view is the standing view) repaints the series page
  // from its standing payload at its standing place. Called
  // from exactly four seats: the watch's own back act (and the
  // system-back dispatch that reaches it), any tab switch, the
  // audio play choke point (loadDescAudio / resumeCurrent /
  // the Now Playing sheet's open), and the series page's own
  // re-entry. Teardown, not an IFrame-API pause: a destroyed
  // frame cannot sound, full stop.
  if (!podWatch) return;
  var y = podWatch.scroll || 0;
  podWatch = null;
  podWatchPlayer = null;
  var f = view.querySelector('iframe.podwatch-frame');
  if (f) f.remove();
  if (state.tab === 'podcasts' && podLevel === 'watch') {
    paintPodcastVideos();
    armPodScroll(y);
  }
}
function paintPodcasts() {
  var res = state.podcasts;
  if (!res) { view.innerHTML = '<h1 class="screen">Formation</h1>' + skelHtml('podseries'); return; }
  podLevel = 'series';
  var html = '<h1 class="screen">Formation</h1>';
  // v390 §2.7: the back row stands at the top of the series page
  // — back re-reads the index, so the counts the marks just
  // changed stand correct.
  // v419 (G10): the back control is the navy disc on every
  // page; this row also pins (the frozen back row, §4.1), on
  // the cream ground.
  html += iosBarHtml({ dest: 'Formation', title: res.title || '', backAttrs: 'data-podback' });
  // v432 §2.1: the offline box retires on the series page too — no button seat here.
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
  // v413 §2.7: the episode page's head takes the playlist-page
  // grammar — show cover (large) · series title · description
  // (the show's own, §2.3) · meta line = the standing progress
  // facts + total duration (§2.10). The current-episode rule
  // and the return machinery are untouched.
  var podDurSum = res.entries.reduce(function (a, e) { return a + (e.durationS || 0); }, 0);
  var showCover = '<div class="blockcover tone-navy large"><span class="blockcover-initial">\u266b</span>'
    + (res.showImageUrl ? '<img class="coverimg" src="' + esc(res.showImageUrl) + '" alt="" onerror="this.remove()">' : '') + '</div>';
  html += '<div class="podpage-head">' + showCover
    + (res.showDesc ? '<p class="sub">' + esc(res.showDesc) + '</p>' : '')
    + '<div class="meta">' + res.listenedCount + ' of ' + res.total + ' listened'
    + (podDurSum > 0 ? ' \u00b7 ' + fmtDurLong(podDurSum) : '')
    + (cur ? ' \u00b7 Current: ' + esc(cur.label) : ' \u00b7 Complete') + '</div></div>';
  // v433 §2.3 (F-433-2): the Current episode card retires
  // into its row — the card duplicated the current entry's
  // own row (same episode, same data-podplay handler, same
  // playPodFrom act, play only). The current row names
  // itself in its meta line (podRowString, below); the
  // resume act stands identical on the row's own disc, and
  // the §2.5 scroll rule already lands on the row.
  // v419 (G31/F-419-3): the collapse — the entries standing
  // listened BEFORE the current entry fold into one disclosure
  // row where the first of them stands; the current entry and
  // everything after it always stand as rows (a later-listened
  // entry never folds). Opening renders every row and offers
  // Hide at the run's end. A series change re-stamps closed.
  var podSkey = res.series || res.title;
  if (podCollapse.series !== podSkey) podCollapse = { series: podSkey, open: false };
  var podCurIdx = -1;
  res.entries.forEach(function (e, i) { if (e.key === res.currentKey) podCurIdx = i; });
  var podBoundary = podCurIdx < 0 ? res.entries.length : podCurIdx;
  var podCollapsed = [];
  res.entries.forEach(function (e, i) { if (i < podBoundary && e.listened) podCollapsed.push(e); });
  var podRowString = function (e) {
    // v413 §2.6: the episode rows take the one row form — art ·
    // title · snippet · meta · the cluster (⋮ · share ·
    // downloaded icon · play). The standing Get button retires:
    // download lives in the ⋮ menu (§2.9), state-matched; the
    // mark control and the partway bar stand unmoved.
    // v417 §2.4 (D5/FD5): the row takes the two-line prow form
    // — words line (art + grow) over the .prow-ctl controls
    // line; the podmark joins the line after play (its wrap
    // dissolves) and the listened date leaves the wrap for
    // the meta line in D2's short form (§2.7). The partway
    // bar stands at the row's bottom edge, unmoved.
    // v433 §2.4: the row takes v424's slim form — the
    // .prow-ctl controls line retires; the controls move
    // into the title line as a .prow-cluster inside
    // .titlerow, reading mark · play · ⋮ (v424's
    // played-state · play · ⋮ order, the mark in the
    // played-state seat), every box 44x44, the ⋮ flush
    // right. The standalone share retires (F-433-3 — Share
    // stands first in the ⋮ menu, openPodRowMenu untouched);
    // the downloaded indicator trails the meta line in
    // .metarow form, its span and refreshPodDlStates
    // untouched. The description stands at the two-line
    // clamp (F-433-1); the head stands entire (F-433-4).
    // The current entry's meta leads "Current episode · "
    // (F-433-2 — the retired card's naming, on the row).
    return '<div class="card trow prow" data-podrow="' + esc(e.key) + '"><div class="row">'
      + podRowArtHtml(e)
      + '<div class="grow"><div class="titlerow"><h3>' + esc(e.title) + '</h3>'
      + '<span class="prow-cluster">'
      + '<button class="podmark' + (e.listened ? ' on' : '') + '" data-podmark="' + esc(e.key) + '" aria-label="' + (e.listened ? 'Mark as not listened' : 'Mark as listened') + '">' + (e.listened ? '&#10003;' : '&#9711;') + '</button>'
      + '<button class="playbtn" data-podplay="' + esc(e.key) + '">&#9654;</button>'
      + '<button class="iconbtn" data-podmenu="' + esc(e.key) + '" aria-label="More options">\u22ee</button>'
      + '</span></div>'
      + (e.descText ? '<div class="snippet">' + esc(e.descText) + '</div>' : '')
      + '<div class="meta metarow"><span>' + (e.key === res.currentKey ? 'Current episode \u00b7 ' : '') + esc(e.label) + (e.durationS ? ' \u00b7 ' + fmtDur(e.durationS) : '') + (e.listened && e.listenDate ? ' \u00b7 Listened ' + shortDayLabel(e.listenDate) : '') + '</span>'
      + '<span class="dl-ico" data-poddlstate="' + esc(e.key) + '" style="display:none" title="Downloaded">\u2913</span></div></div>'
      + '</div>'
      // v395 §2.9 (D4): the partway bar — one element at the
      // row's bottom edge, width = position / duration, inside
      // the uniform 76px row (the .podbar rule in ui.ts): no
      // height, no text, no new line. A partway entry with no
      // duration renders no bar — the fraction cannot render
      // (§1's named case); its position still saves and resumes.
      + (!e.listened && e.positionS > 0 && e.durationS > 0 ? '<div class="podbar"><i style="width:' + (Math.round(1000 * e.positionS / e.durationS) / 10) + '%"></i></div>' : '')
      + '</div>';
  };
  var podCollapseEmitted = false;
  res.entries.forEach(function (e, i) {
    var folds = i < podBoundary && e.listened && podCollapsed.length > 0;
    if (folds && !podCollapse.open) {
      if (!podCollapseEmitted) {
        podCollapseEmitted = true;
        html += '<button class="card podcollapse" data-podcollapse="1"><span class="podchev">\u25ba</span><span class="grow">' + podCollapsed.length + ' earlier episode' + (podCollapsed.length === 1 ? '' : 's') + ' listened</span><span class="meta">Show</span></button>';
      }
      return;
    }
    html += podRowString(e);
    if (folds && podCollapse.open && e === podCollapsed[podCollapsed.length - 1]) {
      html += '<button class="card podcollapse" data-podcollapse="1"><span class="podchev open">\u25ba</span><span class="grow">' + podCollapsed.length + ' earlier episode' + (podCollapsed.length === 1 ? '' : 's') + ' listened</span><span class="meta">Hide</span></button>';
    }
  });
  view.innerHTML = html;
  view.querySelectorAll('[data-podplay]').forEach(function (b) {
    b.addEventListener('click', function () { playPodFrom(b.getAttribute('data-podplay')); });
  });
  view.querySelectorAll('[data-podmark]').forEach(function (b) {
    b.addEventListener('click', function () { podToggleMark(b.getAttribute('data-podmark')); });
  });
  view.querySelectorAll('[data-podmenu]').forEach(function (b) {
    b.addEventListener('click', function () { openPodRowMenu(b.getAttribute('data-podmenu'), b); });
  });
  // v433 §2.3 (F-433-3): the [data-podshare] wiring retires
  // with the standalone share emission — it binds nothing
  // after; the menu's Share is wired inside openPodRowMenu,
  // untouched.
  // v432 §2.2: the offline wiring pair retires with the box — on this
  // paint both were no-ops (neither button id stands, no line element).
  refreshPodDlStates();
  wirePodBack();
  // v419 (G31): the disclosure toggle — the repaint holds
  // the scroll position (the §2.5 scroll-to-current stands
  // down for exactly this one repaint).
  var colBtn = view.querySelector('[data-podcollapse]');
  if (colBtn) colBtn.addEventListener('click', function () {
    var y = window.scrollY;
    podCollapse.open = !podCollapse.open;
    podSkipScrollOnce = true;
    paintPodcasts();
    window.scrollTo(0, y);
  });
  // §2.5: the list opens scrolled to the current entry.
  if (podSkipScrollOnce) { podSkipScrollOnce = false; }
  else if (res.currentKey) {
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
  // v395 §2.9 (D5): the toggle clears the position in memory in
  // both directions — a mark clears it, an unmark wipes the
  // record whole — and the pending slot entry dies with it; the
  // routes do the same server-side in the same act.
  entry.positionS = null;
  podPosSlotDrop(res.series, key);
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

/* ---------------- Podcast position memory (v395) ----------------
   The per-episode half, held server-side in podcast_positions
   (migration 0019) beside the listens — a row's PRESENCE there
   never reads as a listen anywhere (§2.1). The client saves
   (D2: the 15 s movement-gated tick + pause · hide · close ·
   skip-away), resumes through the standing pendingResume seam
   (D3 — hooked in startDesc), and shows the bar (D4 — paint in
   paintPodcasts). Clearing rides the mark routes (D5): the
   in-memory legs stand in writePodMarkQuiet and podToggleMark.
   Saves are page-driven only — podcasts have no native/car
   surface (§1's boundary), and a hard-killed page leaves the
   last save standing. */
var PODPOS_KEY = 'opn-podpos-pending-v1';
var podPosSentKey = null; // series + '/' + seqKey the tick marker names
var podPosSentVal = -1;   // the last value sent for that episode
var podPosLastTick = 0;   // the timeupdate throttle for the 15 s tick
function podPosSlotRead() { try { var m = JSON.parse(localStorage.getItem(PODPOS_KEY) || '{}'); return (m && typeof m === 'object' && !Array.isArray(m)) ? m : {}; } catch (e) { return {}; } }
function podPosSlotWrite(map) { try { localStorage.setItem(PODPOS_KEY, JSON.stringify(map)); } catch (e) {} }
function podPosSlotSet(series, seqKey, positionS, durationS) {
  // §2.7: one JSON object keyed series + '/' + seqKey — a failed
  // save OVERWRITES the episode's entry (newest wins). There is
  // no array and no FIFO: positions supersede each other, so the
  // mark queue's FIFO is the wrong shape here and is not reused.
  var map = podPosSlotRead();
  map[series + '/' + seqKey] = { positionS: positionS, durationS: durationS };
  podPosSlotWrite(map);
}
function podPosSlotDrop(series, seqKey) {
  var map = podPosSlotRead();
  var k = series + '/' + seqKey;
  if (map[k]) { delete map[k]; podPosSlotWrite(map); }
}
function writePodPositionQuiet(series, seqKey, positionS, durationS) {
  // §2.6/§2.7: the position write — fire-and-forget in
  // writePodMarkQuiet's posture, over the coalesced slot. The
  // slot is written SYNCHRONOUSLY before the post: a page that
  // dies mid-flight (the pagehide save is the standing case)
  // leaves the newest value standing for the drain, never
  // nothing. A successful post removes the entry again — only
  // when the slot still holds THIS value, so an older save's
  // success never drops a newer save's entry. A failed post
  // simply leaves the entry standing.
  var pos = Math.floor(Number(positionS) || 0);
  if (!(pos > 0)) pos = 0;
  var dur = Math.floor(Number(durationS) || 0);
  if (!(dur > 0)) dur = 0;
  // The in-memory leg: the open payload's bar tracks without a
  // refetch (only when the open payload is this series — the
  // writePodMarkQuiet mutation rule).
  if (state.podcasts && state.podcasts.series === series && state.podcasts.entries) {
    state.podcasts.entries.forEach(function (e) { if (e.key === seqKey && !e.listened) e.positionS = pos > 0 ? pos : null; });
  }
  // The tick marker: the last value sent for the current track.
  if (state.current && state.current.kind === 'podcast' && state.current.podSeries === series && state.current.seriesKey === seqKey) {
    podPosSentKey = series + '/' + seqKey; podPosSentVal = pos;
  }
  podPosSlotSet(series, seqKey, pos, dur);
  post('/api/player/podcasts/position', { series: series, seqKey: seqKey, positionS: pos, durationS: dur }).then(function () {
    var map = podPosSlotRead();
    var k = series + '/' + seqKey;
    if (map[k] && map[k].positionS === pos && map[k].durationS === dur) { delete map[k]; podPosSlotWrite(map); }
  }).catch(function () { /* the slot entry stands — the drain's business */ });
}
function podPositionTick() {
  // §2.6: the tick's attempt — fires only while a podcast track
  // is current and playing, and only when the position has moved
  // >= 5 s since the last value sent for this episode. The
  // marker resets at every track change (startDesc), so a fresh
  // track's first tick measures from unsent. No writes while
  // paused — the pause save is the paused state's only write.
  var cur = state.current;
  if (!cur || cur.kind !== 'podcast' || !cur.podSeries || !cur.seriesKey) return;
  if (audioEl.paused || audioEl.ended) return;
  var pos = Math.floor(audioEl.currentTime || 0);
  var key = cur.podSeries + '/' + cur.seriesKey;
  var last = (podPosSentKey === key) ? podPosSentVal : -1;
  if (Math.abs(pos - last) < 5) return;
  writePodPositionQuiet(cur.podSeries, cur.seriesKey, pos, cur.durationS || 0);
}
function podPositionSaveCurrent() {
  // §2.6: the event saves — pause · visibility hide · pagehide.
  // Each bypasses the movement gate; each is the last word
  // before its moment passes. Two guards: the ENDED path never
  // saves (it marks, and the mark route clears — a save landing
  // after that delete could resurrect a row), and a position of
  // 0 is "not started" — nothing stands to save (which also
  // keeps a src-swap pause artifact from reading the incoming
  // track's zero).
  var cur = state.current;
  if (!cur || cur.kind !== 'podcast' || !cur.podSeries || !cur.seriesKey) return;
  if (audioEl.ended) return;
  // At the element's exact end the episode is finished in
  // substance: a pause event can precede 'ended' in the end
  // sequence, and no save may race the mark that follows. (A
  // save-suppression guard at the media's own end — not a
  // percentage test; the mark path's law stands untouched.)
  if (isFinite(audioEl.duration) && audioEl.duration > 0 && audioEl.currentTime >= audioEl.duration) return;
  var pos = Math.floor(audioEl.currentTime || 0);
  if (!(pos > 0)) return;
  writePodPositionQuiet(cur.podSeries, cur.seriesKey, pos, cur.durationS || 0);
}
function podPositionSkipAway(nextDesc) {
  // §2.6: skip-away — the queue advances away from a podcast
  // track without 'ended' (next/previous tap, a tap on another
  // track, a queue replacement). Called at the head of
  // startDesc, while state.current still names the OUTGOING
  // track and the element still holds its position: the save
  // fires for the outgoing track, at its position in the moment
  // of leaving, before the incoming track's start logic runs.
  // The ended path never saves — when the element stands ended,
  // the mark (fired at the top of the ended handler, before any
  // advance) is the outgoing track's whole story.
  var out = state.current;
  if (!out || out.kind !== 'podcast' || !out.podSeries || !out.seriesKey) return;
  if (nextDesc && nextDesc.episodeId === out.episodeId) return;
  if (audioEl.ended) return;
  if (isFinite(audioEl.duration) && audioEl.duration > 0 && audioEl.currentTime >= audioEl.duration) return; // the end is the mark's moment, as in podPositionSaveCurrent
  var pos = Math.floor(audioEl.currentTime || 0);
  if (!(pos > 0)) return;
  writePodPositionQuiet(out.podSeries, out.seriesKey, pos, out.durationS || 0);
}
/* ---------------- Day positions (v412 Fix 10) ----------------
   The day mirror of the podcast position store: a partway DAY
   track (a prayer, an external) saves its position to the
   day_positions table through POST /api/player/day-position and
   reads it back in the day payload's dayPositions fold, where
   startDesc hands it to the pendingResume seam — so a day track
   left partway resumes where it stopped, exactly as a podcast
   does. Same cadence points as the podcast store (the 15 s tick,
   pause, hide, pagehide, skip-away), same guards (never at the
   end, never at zero). A position of 0 deletes the row — fired
   by the ended handler, so a finished prayer holds no position.
   The client mechanics are a direct post (no offline coalescing
   slot — the day store's mirror is the table, per §2.8); a
   failed post degrades to no save and never throws into a
   playback path. The opn-resume-v312 store keeps only
   Continue's carry job (§2.8). */
var dayPosSentKey = null;
var dayPosSentVal = -1;
var dayPosLastTick = 0;   // the timeupdate throttle for the 15 s day tick
function writeDayPositionQuiet(episodeId, positionS, durationS) {
  if (!episodeId) return;
  var pos = Math.floor(positionS || 0);
  if (dayPosSentKey === episodeId) dayPosSentVal = pos;
  post('/api/player/day-position', { episodeId: episodeId, date: presentedDateStr(), positionS: pos, durationS: Math.floor(durationS || 0) }).catch(function () {});
}
function dayPositionTick() {
  // The tick's attempt — only while a day track is current and
  // playing, and only when the position has moved >= 5 s since
  // the last value sent for this episode (the podcast rule).
  var cur = state.current;
  if (!cur || cur.kind === 'podcast') return;
  if (audioEl.paused || audioEl.ended) return;
  var pos = Math.floor(audioEl.currentTime || 0);
  var last = (dayPosSentKey === cur.episodeId) ? dayPosSentVal : -1;
  if (Math.abs(pos - last) < 5) return;
  writeDayPositionQuiet(cur.episodeId, pos, cur.durationS || 0);
}
function dayPositionSaveCurrent() {
  // The event saves — pause · visibility hide · pagehide. The
  // podcast guards stand: the ended path never saves (its clear
  // is the ended handler's own act), and a position of 0 is "not
  // started" — nothing stands to save.
  var cur = state.current;
  if (!cur || cur.kind === 'podcast') return;
  if (audioEl.ended) return;
  if (isFinite(audioEl.duration) && audioEl.duration > 0 && audioEl.currentTime >= audioEl.duration) return;
  var pos = Math.floor(audioEl.currentTime || 0);
  if (!(pos > 0)) return;
  writeDayPositionQuiet(cur.episodeId, pos, cur.durationS || 0);
}
function dayPositionSkipAway(nextDesc) {
  // Skip-away — called at the head of startDesc while the
  // OUTGOING day track and its position still stand (the podcast
  // mirror, guard for guard).
  var out = state.current;
  if (!out || out.kind === 'podcast') return;
  if (nextDesc && nextDesc.episodeId === out.episodeId) return;
  if (audioEl.ended) return;
  if (isFinite(audioEl.duration) && audioEl.duration > 0 && audioEl.currentTime >= audioEl.duration) return;
  var pos = Math.floor(audioEl.currentTime || 0);
  if (!(pos > 0)) return;
  writeDayPositionQuiet(out.episodeId, pos, out.durationS || 0);
}
var podPosDraining = false;
function drainPodPositions() {
  // §2.7: the coalesced drain — at app open and on 'online', the
  // mark queue's two standing drain moments (wired beside its
  // calls). Each pending entry posts once through the position
  // route; success removes it (only when the slot still holds
  // the drained value); failure leaves the whole remainder
  // standing for the next drain. The drain is bounded by the
  // count of partway episodes, never by listening time.
  // Downloaded episodes save the same way (P10): a downloaded
  // episode plays through the same element over its cache-first
  // URL, so its saves fire identically and its offline saves
  // coalesce into this same slot. Settings "Clear offline
  // downloads" never touches the slot or the server positions —
  // positions are progress records, the marks' kin, not
  // downloads.
  if (podPosDraining) return;
  if (!Object.keys(podPosSlotRead()).length) return;
  podPosDraining = true;
  var step = function () {
    var map = podPosSlotRead();
    var keys = Object.keys(map);
    if (!keys.length) { podPosDraining = false; return; }
    var k = keys[0], v = map[k];
    var slash = k.indexOf('/');
    post('/api/player/podcasts/position', { series: k.slice(0, slash), seqKey: k.slice(slash + 1), positionS: v.positionS, durationS: v.durationS }).then(function () {
      var now = podPosSlotRead();
      if (now[k] && now[k].positionS === v.positionS && now[k].durationS === v.durationS) { delete now[k]; podPosSlotWrite(now); }
      step();
    }).catch(function () { podPosDraining = false; });
  };
  step();
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
/* v419 (G28): the Settings unsaved-changes snapshot — taken
   at every Settings paint; the count of rows differing from
   it (plus 1 for a moved order) reads beside the save row. */
var settingsSnapshot = null;
function snapshotSettings() {
  settingsSnapshot = settingsRows.map(function (r) { return { sourceKey: r.sourceKey, block: r.block, dayRule: r.dayRule, enabled: r.enabled }; });
}
function settingsOrderDiffers() {
  if (!settingsSnapshot) return false;
  var curSecs = {}, snapSecs = {};
  settingsRows.forEach(function (r) { var s = settingsSectionOf(r); (curSecs[s] = curSecs[s] || []).push(r.sourceKey); });
  settingsSnapshot.forEach(function (s) { var sec = !s.enabled ? 'Off' : (!s.block ? 'No block' : s.block); (snapSecs[sec] = snapSecs[sec] || []).push(s.sourceKey); });
  for (var sec in curSecs) {
    var common = (snapSecs[sec] || []);
    var cur = curSecs[sec].filter(function (k) { return common.indexOf(k) >= 0; });
    var snap = common.filter(function (k) { return curSecs[sec].indexOf(k) >= 0; });
    if (cur.join('|') !== snap.join('|')) return true;
  }
  return false;
}
function settingsDirtyCount() {
  if (!settingsSnapshot) return 0;
  var snap = {};
  settingsSnapshot.forEach(function (s) { snap[s.sourceKey] = s; });
  var n = 0;
  settingsRows.forEach(function (r) {
    var s = snap[r.sourceKey];
    if (!s || !!r.enabled !== !!s.enabled || (r.block || '') !== (s.block || '') || r.dayRule !== s.dayRule) n++;
  });
  if (settingsOrderDiffers()) n++;
  return n;
}
function refreshUnsaved() {
  var el = document.getElementById('set-unsaved');
  if (!el) return;
  var n = settingsDirtyCount();
  el.textContent = n === 0 ? '' : (n === 1 ? '1 change not saved' : n + ' changes not saved');
}
var settingsVersion = null;
var settingsNote = '';
// v451 §2.3 census: 'The AI Signal' STANDS in both lists — the
// 'the-ai-signal' row itself stands assigned to it, the section
// grouping (settingsSections) keys on the name, and the server's
// whole-table validation accepts the standing value for its own
// row; retiring the name would strand the row and break every
// Settings save. It seats nothing on the Prayers side now: the
// day carries no such block, so no source placed there stands
// anywhere in the day.
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
  capturePlace(); // v411 §2.4: harvest the outgoing screen before Settings paints
  recordSideScroll(state.tab);
  view = realView; // v410: Settings paints the full view, never a side host
  state.tab = 'settings';
  document.querySelectorAll('#tabbar .tab').forEach(function (b) { b.classList.remove('active'); });
  view.innerHTML = '<h1 class="screen">Settings</h1><p class="sub">Playback, offline copies, and where each prayer&rsquo;s audio comes from.</p>' + skelHtml('settings');
  api('/api/player/source-settings').then(function (res) {
    settingsRows = res.sources || [];
    settingsVersion = res.version;
    settingsNote = '';
    paintSettings();
  }).catch(function (e) {
    // v419 (G22): the authored failure — a plain sentence and
    // a Ghost Retry wired to this surface's own re-render.
    view.innerHTML = '<h1 class="screen">Settings</h1><p class="err">Settings did not load.</p><p><button class="btn ghost" id="set-retry">Retry</button></p>';
    document.getElementById('set-retry').addEventListener('click', renderSettings);
  });
}
function paintSettings() {
  var html = iosBarHtml({ dest: 'Prayers', title: 'Settings', backAttrs: 'data-settingsback' });
  // v419 (G28): the page sub — what the page holds, in one line.
  html += '<p class="sub">Playback, offline copies, and where each prayer&rsquo;s audio comes from.</p>';
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
  // v394 §2.4: the WALLPAPER section — device-local, in the
  // standing position after OFFLINE. The static paint renders
  // the section shell in a loading state; fillWallpaperSection
  // (below) reads the values through the bridge after paint and
  // repaints the rows from native truth. The values live in the
  // native opn_wallpaper store — there is no web-side copy.
  // v410 §2.7: the WALLPAPER section retires to a pointer —
  // the controls' one home is the Wallpaper tab (§2.6); the
  // section shell and its fill call stand down here.
  html += '<h2 class="sectionhead">SACRED ART</h2><div class="liblist"><div class="setrow">'
    + '<div class="setname">Sacred Art</div>'
    + '<div class="meta">Sacred Art controls live in the Sacred Art tab.</div>'
    + '</div></div>';
  html += '<p class="meta">Settings version ' + settingsVersion + '</p>';
  if (settingsNote) html += '<p class="meta">' + esc(settingsNote) + '</p>';
  html += '<p class="err" id="set-err"></p>';
  // v419 (G28): the mapping explanation stands at the mapping
  // itself — directly above the first mapping section head.
  html += '<p class="sub">Source mapping — which podcast plays in which block, on which days, in which order. Changes apply from the next nightly push.</p>';
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
      html += '<button class="settoggle' + (row.enabled ? ' on' : '') + '" data-setact="toggle" aria-pressed="' + (row.enabled ? 'true' : 'false') + '">' + (row.enabled ? 'On' : 'Off') + '</button>';
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
  html += '<div class="row" style="margin-top:12px"><span class="meta grow" id="set-unsaved"></span><button class="btn ghost" id="set-reset">Reset</button><button class="btn gold" id="set-save">Save mapping</button><button class="btn ghost" id="set-back">&lsaquo; Back</button></div>';
  html += '<div id="pin-section"></div>';
  view.innerHTML = html;
  view.querySelectorAll('[data-setkey]').forEach(function (el) {
    var key = el.getAttribute('data-setkey');
    var row = settingsRows.filter(function (r) { return r.sourceKey === key; })[0];
    // v411 §2.4: the state flips paint their own row, never the
    // page — the toggle flips its own class/label in place, the
    // selects keep the value they show, and the arrows swap
    // their two row elements and recompute the section's
    // disabled states in place. paintSettings() stands only on
    // its named paths (the open paint, the PIN fills, the
    // mapping Save result), each wrapped by capture/restore.
    el.querySelector('[data-setact="toggle"]').addEventListener('click', function () {
      row.enabled = row.enabled ? 0 : 1;
      settingsRebuildOrder();
      var b = el.querySelector('[data-setact="toggle"]');
      b.classList.toggle('on', !!row.enabled);
      b.setAttribute('aria-pressed', row.enabled ? 'true' : 'false');
      b.textContent = row.enabled ? 'On' : 'Off';
      refreshUnsaved();
    });
    el.querySelector('[data-setfield="block"]').addEventListener('change', function (ev) {
      row.block = ev.target.value;
      settingsRebuildOrder();
      refreshUnsaved();
    });
    el.querySelector('[data-setfield="dayRule"]').addEventListener('change', function (ev) {
      row.dayRule = ev.target.value;
      refreshUnsaved();
    });
    el.querySelector('[data-setact="up"]').addEventListener('click', function () { settingsMoveDom(el, row, -1); });
    el.querySelector('[data-setact="down"]').addEventListener('click', function () { settingsMoveDom(el, row, 1); });
  });
  document.getElementById('set-save').addEventListener('click', saveSettings);
  // v419 (G28): Reset re-renders from the server — the
  // standing values return, and the unsaved line clears with
  // the fresh paint's snapshot.
  document.getElementById('set-reset').addEventListener('click', renderSettings);
  document.getElementById('set-back').addEventListener('click', function () { setTab('prayers'); });
  // v447: the bar's back — the same standing act as the
  // footer's Back (setTab('prayers'), place kept).
  var setBarBack = view.querySelector('[data-settingsback]');
  if (setBarBack) setBarBack.addEventListener('click', function () { setTab('prayers'); });
  var apBtn = document.getElementById('set-autoplay');
  if (apBtn) apBtn.addEventListener('click', function () { setAutoplay(!autoplayOn()); });
  var inBtn = document.getElementById('set-intentions');
  if (inBtn) inBtn.addEventListener('click', function () { setIntentions(!intentionsOn()); });
  var clrBtn = document.getElementById('set-clear-offline');
  if (clrBtn) clrBtn.addEventListener('click', function () {
    // v419 (G23/F-419-9): the clear gains the one confirm.
    openConfirm({ line: 'Clear all offline downloads? The next online open downloads the automatic set again.', commitLabel: 'Clear downloads', danger: true, act: function () { offlineClearAll(); } });
  });
  var offCounts = document.getElementById('set-offline-counts');
  if (offCounts) offCounts.textContent = offlineLineText();
  fillPinSection();
  snapshotSettings(); // v419 (G28): the paint IS the saved state — the unsaved line starts clean
  refreshUnsaved();
  armPlaceRestore('settings'); // v411 §2.4: a legitimate full repaint never moves the page
}
function settingsMoveDom(el, row, dir) {
  // v411 §2.4: the arrows' in-place half — settingsMove swaps
  // the rows in the standing array (and no longer repaints);
  // here the two row elements swap in the DOM and the whole
  // section's arrow disabled states recompute in place.
  var list = el.parentElement;
  if (!list) return;
  var rows = Array.prototype.slice.call(list.querySelectorAll('[data-setkey]'));
  var i = rows.indexOf(el);
  var j = i + dir;
  if (j < 0 || j >= rows.length) return;
  settingsMove(row, dir);
  if (dir < 0) list.insertBefore(el, rows[j]); else list.insertBefore(rows[j], el);
  var now = list.querySelectorAll('[data-setkey]');
  now.forEach(function (r, idx) {
    var up = r.querySelector('[data-setact="up"]'), dn = r.querySelector('[data-setact="down"]');
    if (up) up.disabled = idx === 0;
    if (dn) dn.disabled = idx === now.length - 1;
  });
  refreshUnsaved(); // v419 (G28): a moved order counts once
}
/* ---------------- Settings \u2014 WALLPAPER section (v394 \u00a72.4) ----------------
   The wallpaper controls: two surface switches (lock \u00b7 home)
   and the two folder roots (phone \u00b7 watch), in the standing
   device-local pattern \u2014 immediate writes through the bridge,
   no ride on the mapping Save. The values live in the native
   opn_wallpaper store (the changer reads them at unlock with
   no page alive); the bridge is the only road to them, so the
   method-presence guard IS the shell test: no bridge, or a
   rejected get, renders the unavailable note and wires no
   controls. Every write repaints from the set call's resolved
   payload \u2014 the section never displays a value native did not
   confirm.
   v409 §2.6: the two surface switches retire with the
   setBitmap applies they governed (the system picker, not a
   toggle, decides lock / home / both for a live wallpaper),
   and the changer / apply status lines retire with the
   changer. The section gains the payload's 'liveWallpaper'
   state lines and one button — "Use the Ora live
   wallpaper" — wired to the bridge's openLiveWallpaperPicker
   command. The folder roots, the Picture fit control, the
   notices, Sync all, and the saint line stand unchanged. */
function wallpaperBridge() {
  var p = oraBridgePlugin();
  if (!p || !p.getWallpaperSettings || !p.setWallpaperSettings) return null;
  return p;
}
/* v410 §2.6: the Wallpaper tab — the standing section shell
   under its own tab: the same host id, the same fill, the six
   controls unmodified. On the web (no bridge) the fill paints
   the standing phone-side note (Flag 3). */
function renderWallpaper() {
  view.innerHTML = '<h1 class="screen">Sacred Art</h1><div class="liblist" id="set-wallpaper"><div class="setrow" data-skeleton="1">'
    + '<div class="setname">Sacred Art</div>'
    + '<span class="skelbar" style="width:70%"></span><span class="skelbar" style="width:45%"></span>'
    + '</div></div>';
  fillWallpaperSection();
}
function fillWallpaperSection() {
  var host = document.getElementById('set-wallpaper');
  if (!host) return;
  var p = wallpaperBridge();
  if (!p) { paintWallpaperUnavailable(); return; }
  var r;
  try { r = p.getWallpaperSettings(); } catch (e) { paintWallpaperUnavailable(); return; }
  if (!r || !r.then) { paintWallpaperUnavailable(); return; }
  r.then(function (payload) {
    /* v414 §2.6: the tab's entry paint — the remembered
       side's view or the off state, with the standing
       place restore armed (scroll + toggle side). */
    paintWallpaperTab(payload, true);
  })
    .catch(function () { paintWallpaperUnavailable(); });
}
function paintWallpaperUnavailable() {
  var host = document.getElementById('set-wallpaper');
  if (!host) return;
  /* v414 §2.6: the web fallback keeps the standing wrapped
     form (the sticky freeze needs no cage-free host when
     no toggle paints here). */
  host.className = 'liblist';
  host.innerHTML = '<div class="setrow"><div class="setname">Sacred Art</div>'
    + '<div class="meta">Sacred Art controls live in the app on your phone.</div></div>';
}
function wallpaperRootOptions(roots, current) {
  return (roots || []).map(function (r) {
    return '<option value="' + esc(r) + '"' + (r === current ? ' selected' : '') + '>' + esc(r) + '</option>';
  }).join('');
}
/* v414 §2.3: the live-state read — showing-now and the off
   state both read the payload's ONE pre-rendered
   liveWallpaper line, whose three forms are a closed set
   owned by WallpaperSettings.liveWallpaperLines in this
   same codebase:
     1. "Live wallpaper: not on — pick Ora Pro Nobis in the
        system wallpaper picker."
     2. "Live wallpaper: on — <drawnName>, drawn <time>;
        the pictures advance as the screen shows."
     3. "Live wallpaper: on — no pictures stand in the
        Phone folder yet."
   The drawn name is anchored on the wallpaper naming
   contract (the same shapes the Worker validates: a
   daily's __YYYY-MM-DD.jpg AND the monthly devotion's
   __YYYY-MM.jpg — R-414-1: the anchor covers both, or a
   monthly drawn name parses to nothing). Guarded posture (the standing rule): an
   absent key, an empty list, or a line matching no form
   reads active with no drawn name — the tab renders its
   views exactly as it does today and NEVER traps John
   into the off state on an unreadable line. The off state
   stands only on form 1's positive read (F-414-3). */
function wallpaperLiveState(s) {
  var lines = s && s.liveWallpaper;
  if (!lines || !lines.length) return { active: true, drawnName: null };
  var line = String(lines[0]);
  if (line.indexOf('Live wallpaper: not on') === 0) return { active: false, drawnName: null };
  if (line.indexOf('Live wallpaper: on') === 0) {
    var m = line.match(/([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*__[0-9]{4}-[0-9]{2}(?:-[0-9]{2})?[.]jpg)/);
    return { active: true, drawnName: m ? m[1] : null };
  }
  return { active: true, drawnName: null };
}
/* v414: the tab's working state — the resolved payload,
   the manifest fetch shared by the two views, the sets
   the fetch qualified, and the carousels' open indexes
   (session state, so a standing re-render — a sync
   completing, a fit change — restores the slide John was
   viewing; §2.4's place-keeping). */
var wpPayload = null;
var wpManifestPromise = null;
var wpSets = {};
var wpCarIdx = { phone: null, watch: null };
var wpCarSig = { phone: '', watch: '' };
/* v414 §2.6 (FD2): the instructions collapse is REMEMBERED
   — its own key of the house pattern; first-run shown (the
   block must be discoverable; §1.6 fixes its position, not
   this). A hide that resets at every entry is a hide that
   does not work. */
var WP_INSTR_KEY = 'opn-wallpaper-instructions-v414';
/* v414 §2.6: the tab's paint, on the resolved payload —
   off stands alone (§1.7); on paints the frozen toggle +
   the remembered side's view into the standing host. The
   liblist wrapper retires for the views: its overflow
   would cage the toggle's sticky pin (§2.7), and the
   controls stand as their own cards, as elsewhere. Entry
   paints (restore) arm the standing place restore; write
   and sync repaints re-form from native truth in place. */
function paintWallpaperTab(s, restore) {
  var host = document.getElementById('set-wallpaper');
  if (!host) return;
  if (!s || !s.paths) { paintWallpaperUnavailable(); return; }
  wpPayload = s;
  wpManifestPromise = null;
  host.className = '';
  if (!wallpaperLiveState(s).active) { paintWallpaperOff(host); return; }
  var side = readTabSide('wallpaper');
  host.innerHTML = paintSideToggle('wallpaper', side) + '<div id="sidehost"></div>';
  wireSideToggle('wallpaper');
  enterSideHost();
  paintTabSide('wallpaper', side);
  if (restore) {
    armSideScrollRestore('wallpaper', side);
    armPlaceRestore('wallpaper:' + side);
  }
}
/* v414 §2.6 (FD5): the off paint — the quick intro and the
   Turn on button ONLY (no toggle, no views, no controls;
   §1.10 leg 10). Turn on fires the standing picker helper;
   on return its visibility refresh re-reads the payload
   and the tab paints the remembered side's view. */
function paintWallpaperOff(host) {
  host.innerHTML = '<div class="card">'
    + '<div class="wpoff-title">Sacred Art is off</div>'
    + '<p style="margin:0 0 6px;line-height:1.55">The Ora Pro Nobis live wallpaper puts today\u2019s pictures on your home and lock screens.</p>'
    + '<p style="margin:0 0 6px;line-height:1.55">The picture changes as the day goes, all by itself.</p>'
    + '<p style="margin:0 0 12px;line-height:1.55">Set it once \u2014 then SYNC ALL keeps the pictures coming.</p>'
    + '<button class="btn gold" id="wp-turn-on">Turn on</button></div>';
  var b = document.getElementById('wp-turn-on');
  if (b) b.addEventListener('click', function () { wallpaperOpenLivePicker(); });
}
/* v414 §2.4: one humanizer, used by the slides and the
   showing-now row and nowhere else new — hyphens to
   spaces, title-cased, the small words (of · the · and)
   lower after the first: saint-margaret-of-scotland →
   "Saint Margaret of Scotland"; the-blessed-virgin-mary →
   "The Blessed Virgin Mary". */
function wallpaperTitle(slug) {
  var words = String(slug || '').split('-').filter(function (w) { return !!w; });
  return words.map(function (w, i) {
    if (i > 0 && (w === 'of' || w === 'the' || w === 'and')) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}
function wallpaperTitleFromName(name) {
  return wallpaperTitle(String(name || '').replace(/__[0-9]{4}-[0-9]{2}(-[0-9]{2})?[.]jpg$/, ''));
}
/* v414 §2.3: the showing-now row — the thumbnail reads the
   engine's draw record through the standing session file
   route (the R2 copy of the same picture the sync filed).
   FD4's fallback: no draw yet → today's first phone
   picture under the same status line; empty set → the
   no-pictures line, no thumbnail. While the set is still
   loading the row carries the status line alone — never
   blank, never a fabricated picture. */
function wallpaperShowingHtml(s, live, set) {
  var status = '<div class="meta">On your home and lock screens now</div>';
  if (live.drawnName) {
    return '<div class="card wpshowing"><img src="/api/wallpaper/file/phone/' + esc(live.drawnName) + '" alt="">'
      + '<div><div class="wpname">' + esc(wallpaperTitleFromName(live.drawnName)) + '</div>' + status + '</div></div>';
  }
  if (set && set.length) {
    return '<div class="card wpshowing"><img src="/api/wallpaper/file/phone/' + esc(set[0].name) + '" alt="">'
      + '<div><div class="wpname">' + esc(wallpaperTitle(set[0].slug)) + '</div>' + status + '</div></div>';
  }
  if (set) {
    return '<div class="card wpshowing"><div class="meta">No pictures stand in the Phone folder yet.</div></div>';
  }
  return '<div class="card wpshowing"><div>' + status + '</div></div>';
}
function paintShowingNow(set) {
  var host = document.getElementById('wp-showing');
  if (!host || !wpPayload) return;
  host.innerHTML = wallpaperShowingHtml(wpPayload, wallpaperLiveState(wpPayload), set);
}
/* v414 §2.4: today's set, per side — the SAME rule the
   native sync qualifies by (QualifyingDecision): entries
   of the side's variant that are (kind saint, dated
   today) or (kind monthly, dated this month); today is
   the day payload's presented date, device-local. This is
   exactly the set SYNC ALL converges the side's folder
   to, so the carousel shows the folder's contents by
   construction. Slide order: manifest order, the dailies
   first, the monthly last — never re-sorted by name. */
function wallpaperTodaySet(manifest, side) {
  var today = presentedDateStr();
  if (!today) return [];
  var month = today.slice(0, 7);
  var daily = [];
  var monthly = [];
  ((manifest && manifest.entries) || []).forEach(function (e) {
    if (e.variant !== side) return;
    if (e.kind === 'saint' && e.date === today) daily.push(e);
    else if (e.kind === 'monthly' && e.date === month) monthly.push(e);
  });
  return daily.concat(monthly);
}
/* v414 §2.4: a slide's caption — the title from the
   humanized slug; the "From: …" line per class:
   · the saint entry (the daily whose slug begins saint-;
     when none stands, the first daily): the day payload's
     liturgical name, or "Today's saint" when none stands
     (F-414-4);
   · the monthly entry: "<Month>'s devotion";
   · every other daily (the Gospel scene, the companion):
     the title stands alone — the manifest carries no role
     field, and a guessed "From: Today's Gospel" on the
     wrong slide is a false caption (F-414-2, FD7's
     truthful form, both views). */
function wallpaperCaption(entries, idx) {
  var e = entries[idx];
  var title = wallpaperTitle(e.slug);
  var from = null;
  if (e.kind === 'monthly') {
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var mi = parseInt(String(e.date).slice(5, 7), 10) - 1;
    from = 'From: ' + (months[mi] || '') + '\u2019s devotion';
  } else {
    var saintIdx = -1;
    var firstDaily = -1;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].kind !== 'saint') continue;
      if (firstDaily < 0) firstDaily = i;
      if (saintIdx < 0 && entries[i].slug.indexOf('saint-') === 0) saintIdx = i;
    }
    var anchor = saintIdx >= 0 ? saintIdx : firstDaily;
    if (idx === anchor && anchor >= 0) {
      var nm = state.liturgical && state.liturgical.name;
      from = 'From: ' + (nm || 'Today\u2019s saint');
    }
  }
  return { title: title, from: from };
}
/* v414 §2.4: the carousel — ONE component, both views:
   wallpaperCarouselHtml(side, entries, startIndex) +
   wireWallpaperCarousel(side). The image stands large in
   the fixed slide area, whole (object-fit: contain in
   ui.ts) — the carousel never crops, and standing on a
   slide writes nothing: it does not set, apply, or
   advance the wallpaper (§1.9). */
function wallpaperCarouselHtml(side, entries, startIndex) {
  var e = entries[startIndex];
  var cap = wallpaperCaption(entries, startIndex);
  var dots = entries.map(function (x, i) {
    return '<button class="wpcar-dot' + (i === startIndex ? ' on' : '') + '" data-car-dot="' + i + '" aria-label="Picture ' + (i + 1) + '"></button>';
  }).join('');
  return '<div class="wpcar" id="wpcar-' + side + '">'
    + '<button class="wpcar-arrow" data-car-prev aria-label="Previous picture">\u2039</button>'
    + '<div class="wpcar-stage" data-car-stage><img id="wpcar-img-' + side + '" src="/api/wallpaper/file/' + side + '/' + esc(e.name) + '" alt=""></div>'
    + '<button class="wpcar-arrow" data-car-next aria-label="Next picture">\u203a</button></div>'
    + '<div class="wpcar-title" id="wpcar-title-' + side + '">' + esc(cap.title) + '</div>'
    + '<div class="meta" id="wpcar-from-' + side + '">' + (cap.from ? esc(cap.from) : '') + '</div>'
    + '<div class="wpcar-dots">' + dots + '</div>';
}
function wireWallpaperCarousel(side) {
  var root = document.getElementById('wpcar-' + side);
  if (!root) return;
  root.querySelector('[data-car-prev]').addEventListener('click', function () { stepWallpaperCarousel(side, -1); });
  root.querySelector('[data-car-next]').addEventListener('click', function () { stepWallpaperCarousel(side, 1); });
  var host = document.getElementById('wp-carousel-' + side);
  if (host) {
    host.querySelectorAll('[data-car-dot]').forEach(function (d) {
      d.addEventListener('click', function () { setWallpaperCarousel(side, parseInt(d.getAttribute('data-car-dot'), 10)); });
    });
  }
  var stage = root.querySelector('[data-car-stage]');
  var tx = null;
  stage.addEventListener('touchstart', function (ev) { tx = ev.changedTouches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', function (ev) {
    if (tx === null) return;
    var dx = ev.changedTouches[0].clientX - tx;
    tx = null;
    if (dx <= -40) stepWallpaperCarousel(side, 1);
    else if (dx >= 40) stepWallpaperCarousel(side, -1);
  }, { passive: true });
}
function stepWallpaperCarousel(side, delta) {
  var set = wpSets[side] || [];
  if (set.length < 2) return;
  setWallpaperCarousel(side, ((wpCarIdx[side] || 0) + delta + set.length) % set.length);
}
function setWallpaperCarousel(side, idx) {
  var set = wpSets[side] || [];
  if (!set.length || idx < 0 || idx >= set.length) return;
  wpCarIdx[side] = idx;
  var e = set[idx];
  var img = document.getElementById('wpcar-img-' + side);
  if (img) img.src = '/api/wallpaper/file/' + side + '/' + e.name;
  var cap = wallpaperCaption(set, idx);
  var t = document.getElementById('wpcar-title-' + side);
  if (t) t.textContent = cap.title;
  var f = document.getElementById('wpcar-from-' + side);
  if (f) f.textContent = cap.from || '';
  var host = document.getElementById('wp-carousel-' + side);
  if (host) {
    host.querySelectorAll('[data-car-dot]').forEach(function (d) {
      d.classList.toggle('on', parseInt(d.getAttribute('data-car-dot'), 10) === idx);
    });
  }
}
/* v414 §2.4: the set fill — one manifest fetch per tab
   paint, shared by both views; each side's paint leaves
   its carousel area in the loading line until the fetch
   lands. An empty set and a failed load carry DISTINCT
   truthful lines (§2.8). FD3's starting slide: the Phone
   carousel opens on the showing-now slide when a drawn
   name stands, else slide 0; the Watch opens at slide 0
   (no showing-now exists there). A session index for the
   same set survives a re-render (§2.4). */
function paintWallpaperCarousel(side) {
  var host = document.getElementById('wp-carousel-' + side);
  if (!host) return;
  var set = wpSets[side] || [];
  if (!set.length) {
    host.innerHTML = '<div class="meta">' + (side === 'phone'
      ? 'No pictures for today yet \u2014 SYNC ALL brings them.'
      : 'No watch pictures for today yet.') + '</div>';
    return;
  }
  var sig = set.map(function (e) { return e.name; }).join('|');
  var idx;
  if (wpCarIdx[side] !== null && wpCarSig[side] === sig) {
    idx = Math.min(wpCarIdx[side], set.length - 1);
  } else if (side === 'phone') {
    idx = 0;
    var drawn = wpPayload ? wallpaperLiveState(wpPayload).drawnName : null;
    if (drawn) {
      for (var i = 0; i < set.length; i++) { if (set[i].name === drawn) { idx = i; break; } }
    }
  } else {
    idx = 0;
  }
  wpCarIdx[side] = idx;
  wpCarSig[side] = sig;
  host.innerHTML = wallpaperCarouselHtml(side, set, idx);
  wireWallpaperCarousel(side);
}
function loadWallpaperSet(side) {
  if (!wpManifestPromise) {
    wpManifestPromise = fetch('/api/wallpaper/manifest', { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('wallpaper manifest ' + r.status);
        return r.json();
      });
  }
  wpManifestPromise.then(function (manifest) {
    wpSets[side] = wallpaperTodaySet(manifest, side);
    paintWallpaperCarousel(side);
    if (side === 'phone') paintShowingNow(wpSets[side]);
  }).catch(function () {
    var host = document.getElementById('wp-carousel-' + side);
    if (host) host.innerHTML = '<div class="meta">Today\u2019s pictures could not be loaded \u2014 reopen the tab to try again.</div>';
  });
}
/* v414 §2.10: the folder button — renders ONLY when the
   shell carries the new bridge method (the section's
   standing guarded posture): this release's shell carries
   it, so the button stands (§1.10 leg 8); an older shell
   renders the views without folder buttons rather than
   with dead ones. */
function wallpaperFolderHtml(side) {
  var p = wallpaperBridge();
  if (!p || typeof p.openWallpaperFolder !== 'function') return '';
  var label = side === 'phone' ? 'Open phone folder' : 'Open watch folder';
  return '<div class="setrow"><div class="setcontrols"><button class="btn ghost" id="wp-open-' + side + '">' + label + '</button></div>'
    + '<div class="fieldnote" id="wp-folder-note-' + side + '"></div></div>';
}
function wireWallpaperFolder(side) {
  var b = document.getElementById('wp-open-' + side);
  if (b) b.addEventListener('click', function () { wallpaperOpenFolder(side); });
}
function wallpaperOpenFolder(side) {
  var p = wallpaperBridge();
  if (!p || typeof p.openWallpaperFolder !== 'function') return;
  var fail = function () {
    var note = document.getElementById('wp-folder-note-' + side);
    if (note && wpPayload && wpPayload.paths) {
      note.textContent = 'That did not open. The folder is at ' + (wpPayload.paths[side] || '') + '.';
    }
  };
  var r;
  try { r = p.openWallpaperFolder({ variant: side }); } catch (e) { fail(); return; }
  if (r && r.catch) r.catch(fail);
}
/* v414 §2.6: the Watch instructions block — §1.6's four
   points verbatim in substance, at the top of the Watch
   view, collapsible with the state REMEMBERED (FD2). The
   collapsed form is the one-line bar + Show instructions. */
function wallpaperInstructionsShown() {
  try { return localStorage.getItem(WP_INSTR_KEY) !== 'hidden'; } catch (e) { return true; }
}
function wallpaperInstructionsHtml() {
  if (!wallpaperInstructionsShown()) {
    return '<div class="card"><div class="row"><div class="grow">Watch setup instructions</div>'
      + '<button class="btn ghost" id="wp-instr-show">Show instructions</button></div></div>';
  }
  return '<div class="card"><div class="row"><div class="setname grow">Watch setup</div>'
    + '<button class="btn ghost" id="wp-instr-hide">Hide</button></div>'
    + '<p style="margin:8px 0 0;line-height:1.55">On the watch, set the face\u2019s image source to the Ora Pro Nobis watch folder.</p>'
    + '<p style="margin:6px 0 0;line-height:1.55">Keep the time readout in the top zone \u2014 the artwork keeps the top third dark and empty on purpose, so the time stays readable.</p>'
    + '<p style="margin:6px 0 0;line-height:1.55">The watch advances through the folder itself \u2014 nothing else needs setting.</p>'
    + '<p style="margin:6px 0 0;line-height:1.55">New pictures arrive when SYNC ALL runs on the phone.</p></div>';
}
function wireWallpaperInstructions() {
  var hide = document.getElementById('wp-instr-hide');
  if (hide) hide.addEventListener('click', function () { wallpaperSetInstructions(false); });
  var show = document.getElementById('wp-instr-show');
  if (show) show.addEventListener('click', function () { wallpaperSetInstructions(true); });
}
function wallpaperSetInstructions(shown) {
  try { localStorage.setItem(WP_INSTR_KEY, shown ? 'shown' : 'hidden'); } catch (e) {}
  var host = document.getElementById('wp-instr');
  if (host) {
    host.innerHTML = wallpaperInstructionsHtml();
    wireWallpaperInstructions();
  }
}
/* v414 §1.3: the Phone view, top to bottom — showing-now
   row · "Today's artwork" carousel · Open phone folder ·
   the standing controls block (§2.6's relocation map:
   every standing row's home, none dropped). */
function paintWallpaperPhone() {
  var s = wpPayload;
  if (!s) return;
  view.innerHTML = '<div id="wp-showing">' + wallpaperShowingHtml(s, wallpaperLiveState(s), null) + '</div>'
    + '<h2 class="sectionhead">Today\u2019s artwork</h2>'
    + '<div id="wp-carousel-phone"><div class="skel" data-skeleton="1" style="aspect-ratio:4/3"></div><span class="skelbar" style="width:50%"></span></div>'
    + wallpaperFolderHtml('phone')
    + wallpaperControlsHtml(s);
  wireWallpaperControls();
  wireWallpaperFolder('phone');
  loadWallpaperSet('phone');
}
/* v414 §1.8: the Watch view, top to bottom — the
   instructions block (collapsible, §2.6) · "Today's
   artwork — watch" carousel · Open watch folder. NO
   showing-now element stands anywhere on this view
   (§1.4), and no controls block (§1.8). */
function paintWallpaperWatch() {
  if (!wpPayload) return;
  view.innerHTML = '<div id="wp-instr">' + wallpaperInstructionsHtml() + '</div>'
    + '<h2 class="sectionhead">Today\u2019s artwork \u2014 watch</h2>'
    + '<div id="wp-carousel-watch"><div class="skel" data-skeleton="1" style="aspect-ratio:4/3"></div><span class="skelbar" style="width:50%"></span></div>'
    + wallpaperFolderHtml('watch');
  wireWallpaperInstructions();
  wireWallpaperFolder('watch');
  loadWallpaperSet('watch');
}
/* v414 §2.6: the controls block — the standing section's
   rows exactly as they stood (v409's live-wallpaper lines
   + picker row · v405's fit row · v406's flat folder rows
   · v396's notices · v399's Sync row + lastSync line ·
   v400's saint line), in their standing order, homed on
   the Phone view. The builder returns the rows; the
   wiring is its twin below. */
function wallpaperControlsHtml(s) {
  var html = '';
  /* v409 §2.6: the live-wallpaper state lines — the additive
     'liveWallpaper' key in the same payload, pre-rendered
     natively (the engine's draw record plus the active
     verdict: on, with the last drawn picture and its time
     · on, with no pictures in the Phone folder yet · not
     on, naming the picker step). Rendered in the identical
     setrow/meta shape as the notices, at the head of the
     section where the retired surface toggles stood; an
     absent key (the old shell, which carries no such key)
     or an empty list renders nothing. */
  if (s.liveWallpaper && s.liveWallpaper.length) {
    for (var li = 0; li < s.liveWallpaper.length; li++) {
      html += '<div class="setrow"><div class="meta">' + esc(String(s.liveWallpaper[li])) + '</div></div>';
    }
  }
  /* v409 §2.6: the picker action — one button, "Use the
     Ora live wallpaper", in the Sync row's form, appended
     directly after the state lines. The button renders ONLY
     when the shell carries the bridge method (the guarded
     posture, as Sync all below): it fires the native picker
     intent through the bridge, and the platform picker
     itself takes the Set tap. */
  var wpLive = wallpaperBridge();
  if (wpLive && typeof wpLive.openLiveWallpaperPicker === 'function') {
    html += '<div class="setrow"><div class="setname">Live wallpaper</div>'
      + '<div class="setcontrols"><button class="btn ghost" id="set-wp-live">Use the Ora live wallpaper</button></div></div>';
  }
  /* v405 §2.3: the Picture fit row — directly after the two
     surface toggle rows and their both-off note, before the
     Phone folder row. (v409 §2.6: the toggle rows retired;
     the fit row now follows the live-wallpaper rows.) The section's closed-set control form
     (the roots <select> pattern): the standing mode's
     caption as the meta line, the two plain labels verbatim.
     The value reads s.fitMode === 'fill' ? 'fill' : 'fit' —
     an absent key (the old shell's payload) renders Fit,
     mirroring the native default. A change writes through
     the standing helper and repaints from the resolved
     payload; the client fires no poke and no sync (the
     re-apply trigger is native, §2.4). */
  var fitMode = s.fitMode === 'fill' ? 'fill' : 'fit';
  var fitCaption = fitMode === 'fill'
    ? 'The picture fills the whole screen. The top is kept, so the title stays; the bottom is trimmed.'
    : 'The whole picture shows, title and all. The side edges are filled with a soft blur of the picture itself.';
  html += '<div class="setrow"><div class="setname">Picture fit</div>'
    + '<div class="meta">' + fitCaption + '</div>'
    + '<div class="setcontrols"><select id="set-wp-fit">'
    + '<option value="fit"' + (fitMode === 'fit' ? ' selected' : '') + '>Fit the whole picture</option>'
    + '<option value="fill"' + (fitMode === 'fill' ? ' selected' : '') + '>Fill the screen</option>'
    + '</select></div></div>';
  /* v406 §2.6: each folder row's meta is ONE flat path line
     — the payload's paths pair, with a root-based fallback
     for a <= 1.0.26 shell's four-key payload (its subfolder
     lines are simply not rendered). No Saints or Monthly
     Devotion text renders anywhere in the section. */
  var paths = s.paths;
  html += '<div class="setrow"><div class="setname">Phone folder</div>'
    + '<div class="meta">' + esc(paths.phone || (s.phoneRoot + '/Phone')) + '</div>'
    + '<div class="setcontrols"><select id="set-wp-phone-root">' + wallpaperRootOptions(s.offeredRoots, s.phoneRoot) + '</select></div></div>';
  html += '<div class="setrow"><div class="setname">Watch folder</div>'
    + '<div class="meta">' + esc(paths.watch || (s.watchRoot + '/Watch')) + '</div>'
    + '<div class="setcontrols"><select id="set-wp-watch-root">' + wallpaperRootOptions(s.offeredRoots, s.watchRoot) + '</select></div></div>';
  /* v396 §2.6: the failure/gap notice lines — the additive
     'notices' key in the same payload, computed natively from
     the delivered store (a qualifying image that failed to
     file · a day/month with nothing stocked). Plain lines
     under the folder rows, exactly as sent, plain text through
     esc; an absent key (the standing shell, which carries no
     such key) or an empty list renders nothing. No control
     rides on them and nothing else in the section changes. */
  if (s.notices && s.notices.length) {
    for (var ni = 0; ni < s.notices.length; ni++) {
      html += '<div class="setrow"><div class="meta">' + esc(String(s.notices[ni])) + '</div></div>';
    }
  }
  /* v399 §2.5: the section's sync action — Sync all (v404
     §2.5: the label names what the button does: one tap runs
     the full convergence, removals included), in the
     OFFLINE precedent's form, appended after the notices as
     the section's last rows. The button renders ONLY when
     the shell carries the new bridge method: a shell without
     it renders the section byte-for-byte as before (the
     guarded posture). The status line stands directly under
     the button row, in the notices' meta form, rendered from
     the payload's lastSync at every paint — the persisted
     value restores it on a plain section open, and no
     client-side copy of the result exists. */
  var wp = wallpaperBridge();
  if (wp && typeof wp.syncWallpaperNow === 'function') {
    html += '<div class="setrow"><div class="setname">Sync</div>'
      + '<div class="setcontrols"><button class="btn ghost" id="set-wp-sync">Sync all</button></div></div>';
  }
  if (s.lastSync) {
    html += '<div class="setrow"><div class="meta">' + esc(wallpaperSyncLine(s.lastSync, s.saintStatus)) + '</div></div>';
  }
  /* v400 §2.5: the saint row — the additive 'saintStatus'
     key in the same payload (today's saint, named, and her
     standing, written natively by the sync pass itself after
     every completed pass). Rendered directly after the
     lastSync line row — or, when lastSync is null, where
     that row would stand (directly after the Sync button
     row). An absent key (the old shell) or a null value (no
     completed pass on the new build yet) renders nothing. */
  if (s.saintStatus) {
    var saintLine = wallpaperSaintLine(s.saintStatus);
    if (saintLine) {
      html += '<div class="setrow"><div class="meta">' + esc(saintLine) + '</div></div>';
    }
  }
  return html;
}
function wireWallpaperControls() {
  var liveBtn = document.getElementById('set-wp-live');
  if (liveBtn) liveBtn.addEventListener('click', function () { wallpaperOpenLivePicker(); });
  var phoneSel = document.getElementById('set-wp-phone-root');
  if (phoneSel) phoneSel.addEventListener('change', function (ev) { wallpaperWrite({ phoneRoot: ev.target.value }); });
  var watchSel = document.getElementById('set-wp-watch-root');
  if (watchSel) watchSel.addEventListener('change', function (ev) { wallpaperWrite({ watchRoot: ev.target.value }); });
  var fitSel = document.getElementById('set-wp-fit');
  if (fitSel) fitSel.addEventListener('change', function (ev) { wallpaperWrite({ fitMode: ev.target.value }); });
  var syncBtn = document.getElementById('set-wp-sync');
  if (syncBtn) syncBtn.addEventListener('click', function () { wallpaperSyncNow(); });
}
/* v414: the standing repaint entry keeps its name and its
   callers (wallpaperWrite · wallpaperSyncNow) — a write or
   a sync answer re-forms the whole tab from the fresh
   payload, the standing posture: the current side's view
   repaints from native truth, the off state re-reads, and
   the carousel index survives on its session store. */
function paintWallpaperControls(s) {
  paintWallpaperTab(s, false);
}
function wallpaperWrite(patch) {
  var p = wallpaperBridge();
  if (!p) { paintWallpaperUnavailable(); return; }
  var r;
  try { r = p.setWallpaperSettings(patch); } catch (e) { return; }
  if (r && r.then) r.then(function (payload) { paintWallpaperControls(payload); }).catch(function () {});
}
/* v409 §2.6: the picker tap — fire the native picker intent
   through the bridge (it lands on the Ora wallpaper's
   preview with its Set action; the bridge resolves as the
   picker opens, with no payload). After the picker returns
   the client re-reads the settings — the first show of the
   page again repaints the section from native truth, so the
   state line re-renders with the verdict as it then stands.
   A rejected call drops the watcher and leaves the section
   as it stands. */
function wallpaperOpenLivePicker() {
  var p = wallpaperBridge();
  if (!p || typeof p.openLiveWallpaperPicker !== 'function') return;
  var onVis = function () {
    if (document.hidden) return;
    document.removeEventListener('visibilitychange', onVis);
    fillWallpaperSection();
  };
  document.addEventListener('visibilitychange', onVis);
  var r;
  try { r = p.openLiveWallpaperPicker(); } catch (e) { document.removeEventListener('visibilitychange', onVis); return; }
  if (r && r.catch) r.catch(function () { document.removeEventListener('visibilitychange', onVis); });
}
/* v399 §2.5: the status line's copy — the four pinned forms,
   composed from the payload's lastSync alone (time is
   device-local h:mm AM/PM from the epoch-ms the native side
   stamped at completion; the already-running answer ran no
   pass and carries no time). */
function wallpaperSyncTime(ms) {
  var d = new Date(ms || 0);
  var h = d.getHours();
  var min = d.getMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return h + ':' + (min < 10 ? '0' : '') + min + ' ' + ampm;
}
function wallpaperSyncLine(ls, ss) {
  if (!ls || !ls.outcome) return '';
  if (ls.outcome === 'alreadyRunning') return 'A sync is already running.';
  var t = wallpaperSyncTime(ls.at);
  /* v406 §2.6: the missing form — precedence over every
     outcome form (a no-change pass with a missing entry
     still stamps upToDate and still renders the truth). */
  if (ls.missing && ls.missing.length) {
    if (ls.missing.length === 1) {
      return 'Synced ' + t + ' \u2014 ' + ls.missing[0] + ' is not on your phone.';
    }
    return 'Synced ' + t + ' \u2014 ' + ls.missing[0] + ' and ' + (ls.missing.length - 1) + ' more are not on your phone.';
  }
  if (ls.outcome === 'updated') {
    /* v404 §2.5: the count form — when the record carries its
       filed/removed counts (every record written by the new
       native build), the line names them; a legacy record
       without counts renders the standing v399 changed form.
       The counts are the line's whole story now: convergence
       counts a removal-only pass as UPDATED through the
       standing fold, so this form is where a morning cleanup
       shows. */
    if (typeof ls.filed === 'number' && typeof ls.removed === 'number') {
      return 'Synced ' + t + ' \u2014 filed ' + ls.filed + ', removed ' + ls.removed + '.';
    }
    var n = ls.changed || 0;
    return 'Synced ' + t + ' \u2014 ' + n + (n === 1 ? ' image' : ' images') + ' filed or removed.';
  }
  if (ls.outcome === 'upToDate') {
    /* v404 §2.5: up to date is unconditional — the v401
       downlevel-saint suppression is deleted with the
       condition that made it necessary (under convergence
       the missing saint is re-filed by the pass itself; the
       saint line below carries her standing separately). */
    return 'Synced ' + t + ' \u2014 already up to date.';
  }
  if (ls.outcome === 'failed') return 'Sync at ' + t + ' did not complete. The standing checks keep running and will catch up.';
  return '';
}
/* v400 §2.5: the saint line's copy — the six pinned forms
   (v404 §2.5: the writtenOff form is deleted with the state
   it named),
   composed from the payload's saintStatus alone (the name
   and cause arrive pre-derived from the native pass; the
   line never prints a file name where the saint's name
   belongs). No client state: the payload is the only source,
   at tap time and at open time alike. */
function wallpaperSaintLine(ss) {
  if (!ss || !ss.standing) return '';
  var name = ss.name || '';
  if (ss.standing === 'filed') return 'Today\u2019s saint: ' + name + ' \u2014 on your phone.';
  if (ss.standing === 'filedThisPass') return 'Today\u2019s saint: ' + name + ' \u2014 filed at the last check and on your phone.';
  if (ss.standing === 'refiledThisPass') return 'Today\u2019s saint: ' + name + ' \u2014 re-filed at the last check and on your phone.';
  if (ss.standing === 'failed') return 'Today\u2019s saint: ' + name + ' \u2014 not on your phone. The last filing attempt failed (' + (ss.cause || '') + ') \u2014 the app keeps retrying at the next check.';
  if (ss.standing === 'notOnPhone') return 'Today\u2019s saint: ' + name + ' \u2014 not on your phone.';
  if (ss.standing === 'notStocked') return 'No saint image for today stands in the library yet.';
  return '';
}
/* v399 §2.5: the tap — the live button takes its running
   state (disabled, "Syncing\u2026"; a tap cannot stack, and
   the native guard is the second wall behind it), the call
   runs, and the resolve repaints the whole section from the
   answer payload, notices and line riding the one answer.
   A rejection restores the section through the standing get.
   The running state needs no restore code: the repaint
   rebuilds the section HTML, button included. */
function wallpaperSyncNow() {
  var p = wallpaperBridge();
  if (!p || typeof p.syncWallpaperNow !== 'function') { paintWallpaperUnavailable(); return; }
  var btn = document.getElementById('set-wp-sync');
  if (btn) { btn.disabled = true; btn.textContent = 'Syncing\u2026'; }
  var r;
  try { r = p.syncWallpaperNow(); } catch (e) { fillWallpaperSection(); return; }
  if (r && r.then) {
    r.then(function (payload) { paintWallpaperControls(payload); })
      .catch(function () { fillWallpaperSection(); });
  } else { fillWallpaperSection(); }
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
        // v419 (G23): the native confirm retires into the one
        // confirm drawer; a failed remove lands as an authored
        // line on the standing Settings error slot.
        openConfirm({ line: 'Remove the PIN? Confession and Examination will stay locked until a new PIN is set.', commitLabel: 'Remove PIN', danger: true, act: function () {
          post('/api/pin/remove', {}).then(function () { pinToken = null; pinStateCache = { pinSet: false, retryAfterSeconds: 0 }; renderSettings(); })
            .catch(function (e) { if (!pinRefusalGate('settings', renderSettings, e)) { var se = document.getElementById('set-err'); if (se) se.textContent = 'The PIN was not removed. Try again.'; } });
        } });
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
  sheet.innerHTML = '<div class="inner"><div class="row"><h1 class="screen grow">' + (mode === 'set' ? 'Set a PIN' : 'Change PIN') + '</h1></div>'
    + '<p class="meta">' + (mode === 'set'
      ? 'The PIN gates Confession and Examination on this device\u2019s signed-in session. When it is set you will be shown a recovery code, once, for the day the PIN is forgotten.'
      : 'Choose the new PIN. A new recovery code is shown once, and every standing unlock ends.') + '</p>'
    + '<label class="f">New PIN (4-8 digits)</label><input type="password" id="ps-pin1" inputmode="numeric" autocomplete="off">'
    + '<label class="f">New PIN again</label><input type="password" id="ps-pin2" inputmode="numeric" autocomplete="off">'
    + '<p class="pinmsg" id="ps-msg"></p>'
    + '<div style="margin-top:10px"><button class="btn gold" id="ps-save">' + (mode === 'set' ? 'Set PIN' : 'Change PIN') + '</button></div></div>';
  document.body.appendChild(sheet);
  mountDrawer(sheet, false); // v419: FIT drawer — the header Close retires
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
  // v411 §2.4: the array swap only — the repaint retires; the
  // wiring's settingsMoveDom carries the visible half in place.
  var secs = settingsSections();
  var list = secs[settingsSectionOf(row)];
  var i = list.indexOf(row);
  var j = i + dir;
  if (j < 0 || j >= list.length) return;
  list[i] = list[j]; list[j] = row;
  var out = [];
  SET_SECTIONS.forEach(function (s) { secs[s].forEach(function (r) { out.push(r); }); });
  settingsRows = out;
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

/* ---------------- Forms that answer (v411 §2.6) ----------------
   One standard on every empty submit: an inline line under
   the field, in the app's plain voice — silence is the only
   wrong answer. Each form paints an empty .fieldnote slot
   under its field at build time (id 'fn-' + the field's id);
   fieldNote() writes the line, and an input listener on the
   field clears its own slot. NO form uses a disabled-until-
   text substitute; the one disabled state in this standard
   is the editor sheets' in-flight save guard (§2.6, 4.3). */
function fieldNote(slotId, msg) {
  var el = document.getElementById(slotId);
  if (el) el.textContent = msg || '';
}
function wireFieldNotes() {
  realView.querySelectorAll('textarea, input, select').forEach(function (el) {
    if (!el.id) return;
    if (!document.getElementById('fn-' + el.id)) return;
    el.addEventListener('input', function () { fieldNote('fn-' + el.id, ''); });
  });
}

/* ---------------- Intentions (the pool) ---------------- */
function intentionRow(it) {
  // v452 §2 Build 1 (D1 B · D2 B): the clean row, in the
  // standing card-row form (one per line, full width) — the
  // text in the grow cell, the standing .pri tag, and the
  // row's own ☰ at the right. NOTHING else stands on the
  // row: the drawn-history line retires (history, status,
  // and dates live in the Edit sheet, D2 B) and the standing
  // Edit/Retire/Delete button row retires into the ☰'s
  // anchored menu (Build 2). A retired row's text stands
  // muted; its tag and ☰ stand as the active rows'.
  var retired = it.status !== 'active';
  return '<div class="card introw"><div class="row">'
    + '<div class="grow"><div' + (retired ? ' style="color:var(--muted)"' : '') + '>' + esc(it.text) + '</div></div>'
    + '<span class="pri ' + it.priority + '">' + ({ H: 'High', M: 'Medium', L: 'Low' })[it.priority] + '</span>'
    + '<button class="iconbtn" data-intmenu="' + it.id + '" aria-label="Intention actions">\u2630</button>'
    + '</div></div>';
}
// v426 §2.6: the ONE settle paint path — the standing triple
// (capturePlace · renderIntentions · armPlaceRestore), factored
// once. The redraw button and every mutation settle call it; no
// call site keeps its own copy. A mutation whose auto-redraw
// failed server-side (§2.4) passes redrawFailed and the fresh
// paint stands the redraw failure line in its head note slot.
var intentionsRedrawFailed = false;
function settleIntentions(redrawFailed) {
  if (redrawFailed) intentionsRedrawFailed = true;
  capturePlace();
  renderIntentions();
  armPlaceRestore('prayers:intentions');
}
function renderIntentions() {
  paintPrayersBar(null); // v448: the Intentions side is a tab home side — no pushed bar stands over it
  // v452 §2 Build 1: the skeleton head draws the NEW headrow
  // form (title + the heading ☰), identical markup to the
  // settled head, so the paint landing does not jump (the
  // F-426-I4 property, carried to the new form).
  view.innerHTML = '<div class="row headrow"><h1 class="screen grow">Intentions</h1><button class="iconbtn" id="int-menu" aria-label="Intentions menu">\u2630</button></div>' + skelHtml('intentions');
  var today = todayChicago();
  Promise.all([api('/api/prayer/intentions'), api('/api/prayer/day?date=' + today)]).then(function (res) {
    var intentions = res[0].intentions || [];
    var day = res[1] || {};
    applyLiturgical(day);
    var active = intentions.filter(function (i) { return i.status === 'active'; });
    var retired = intentions.filter(function (i) { return i.status !== 'active'; });
    // v338 §2.9(3): the per-block segment audio bar retires with
    // the payload's segment fields — the Intentions tab's
    // item/intention listing below stands untouched (§2.9(2)).
    // v452 §2 Build 1 (D1 B · D4 A): the settled paint is the
    // headrow (the title in its .grow cell, the heading ☰ at
    // its right — the headrow act seat the sort act took on
    // Prayers), the redraw note slot under it (the slot is
    // functional, carrying the redraw failure line; empty it
    // costs no height, .fieldnote:empty stands display:none),
    // ONE flat list of rows in High → Medium → Low order (the
    // API's order stands within each priority), the Retired
    // section at the bottom under its quiet section head, and
    // the floating add button (Build 3). Retired whole (D4 A):
    // the stats strip, the "the pool" sub-line, the about
    // paragraph, the Add card, and the per-priority section
    // heads — the home is toggle · heading · rows · the
    // floating button, nothing else.
    var html = '<div class="row headrow"><h1 class="screen grow">Intentions</h1><button class="iconbtn" id="int-menu" aria-label="Intentions menu">\u2630</button></div><p class="fieldnote" id="int-redraw-note"></p>';
    var ordered = ['H', 'M', 'L'].reduce(function (acc, p) { return acc.concat(active.filter(function (i) { return i.priority === p; })); }, []);
    html += ordered.length ? ordered.map(intentionRow).join('') : '<p class="meta">None.</p>';
    if (retired.length) {
      html += '<h2 class="sectionhead">RETIRED</h2>' + retired.map(intentionRow).join('');
    }
    html += '<button class="intfab" id="int-fab" aria-label="Add an intention">+</button>';
    view.innerHTML = html;
    wireIntentions(intentions);
    // v426 §2.4: a settle whose auto-redraw failed stands the
    // failure line in the fresh paint's note slot — the pool
    // change is visible; today's lines keep the prior draw.
    if (intentionsRedrawFailed) { intentionsRedrawFailed = false; fieldNote('int-redraw-note', 'Redraw did not run — the standing draw stands. Try again.'); }
  }).catch(function (e) {
    intentionsRedrawFailed = false;
    // v419 (G22): the authored failure + a Ghost Retry.
    // v452: its head reads in the new headrow form.
    view.innerHTML = '<div class="row headrow"><h1 class="screen grow">Intentions</h1></div><p class="err">Intentions did not load.</p><p><button class="btn ghost" id="int-retry">Retry</button></p>';
    document.getElementById('int-retry').addEventListener('click', renderIntentions);
  });
}
function runIntentionsRedraw(menuBtn) {
  // v452 §2 Build 2: the standing v426 redraw, re-seated from
  // the retired head button to the heading menu's Redraw item
  // (the menu has already closed when this runs). The tap runs
  // BOTH, in order — POST the draw re-run, then on settle the
  // one paint path re-reads the pool and repaints. Busy seats
  // on the heading ☰ (disabled + the ellipsis) while the POST
  // is in flight. A failed tap does not repaint; the standing
  // paint stands and the note slot names the failure.
  menuBtn.disabled = true;
  menuBtn.textContent = '\u2026';
  post('/api/prayer/redraw', {}).then(function () {
    settleIntentions(false);
  }).catch(function () {
    menuBtn.disabled = false;
    menuBtn.textContent = '\u2630';
    fieldNote('int-redraw-note', 'Redraw did not run \u2014 the standing draw stands. Try again.');
  });
}
function wireIntentions(intentions) {
  // v452 §2 Build 2: every act opens through openSheetMenu,
  // anchored at its ☰ — the heading menu ("Intentions":
  // Redraw + Add intention, D3 A) and each row's menu
  // ("Intention": Edit · Retire/Restore · Delete). Every act
  // fires the identical endpoint and settle the standing
  // buttons fired; only the wiring moved. The floating add
  // button (Build 3) opens the same add sheet the menu's
  // Add intention opens.
  var menuBtn = document.getElementById('int-menu');
  if (menuBtn) menuBtn.addEventListener('click', function () {
    openSheetMenu('Intentions', [
      { label: 'Redraw', act: function () { runIntentionsRedraw(menuBtn); } },
      { label: 'Add intention', act: function () { openIntentionEditor(null); } }
    ], menuBtn);
  });
  var fab = document.getElementById('int-fab');
  if (fab) fab.addEventListener('click', function () { openIntentionEditor(null); });
  wireFieldNotes();
  view.querySelectorAll('[data-intmenu]').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = Number(b.getAttribute('data-intmenu'));
      var it = intentions.filter(function (i) { return i.id === id; })[0];
      if (!it) return;
      // v411 §2.4: the repaint keeps the side's place — the
      // settle's capture runs while the standing DOM holds.
      var items = [{ label: 'Edit', act: function () { openIntentionEditor(it); } }];
      if (it.status === 'active') items.push({ label: 'Retire', act: function () { post('/api/prayer/intentions/' + id + '/status', { status: 'retired' }).then(function (res) { settleIntentions(!!(res && res.redrawn === false)); }); } });
      else items.push({ label: 'Restore', act: function () { post('/api/prayer/intentions/' + id + '/status', { status: 'active' }).then(function (res) { settleIntentions(!!(res && res.redrawn === false)); }); } });
      items.push({ label: 'Delete', act: function () { openConfirm({ line: 'Delete this intention and all its draws?', commitLabel: 'Delete', danger: true, act: function () { api('/api/prayer/intentions/' + id, { method: 'DELETE' }).then(function (res) { settleIntentions(!!(res && res.redrawn === false)); }); } }); } });
      openSheetMenu('Intention', items, b);
    });
  });
}
function openIntentionEditor(it) {
  // v452 §2 Build 3: ONE sheet for add and edit — an entry
  // paints the edit form (the standing editor's shape: the
  // prefilled text, the facts line, Save); null paints the
  // add form (empty text, the standing redraw note line,
  // "Add to the pool"). The priority control is the sheet's
  // three-way segmented control (the approved Screen C form)
  // in both forms — one form, one control; it stands in the
  // standing .segtoggle dress, the chosen segment carrying
  // .active. The add form's standing default is Medium (the
  // retired Add card's default). The failure branches stand
  // as built (v411 §2.6 4.3 · v426 F-426-3): the button
  // disables while the write is in flight; a refusal leaves
  // the sheet open, the draft intact, and the note naming
  // the failure. A success closes the sheet and settles.
  var adding = !it;
  var priSel = adding ? 'M' : it.priority;
  var seg = '<div class="segtoggle" id="ed-pri">' + [['H', 'High'], ['M', 'Medium'], ['L', 'Low']].map(function (p) {
    return '<button data-pri="' + p[0] + '"' + (p[0] === priSel ? ' class="active"' : '') + '>' + p[1] + '</button>';
  }).join('') + '</div>';
  var sheet = document.createElement('div'); sheet.className = 'sheet';
  sheet.innerHTML = '<div class="inner"><div class="row"><h1 class="screen grow">' + (adding ? 'Add an intention' : 'Intention') + '</h1></div>'
    + '<label class="f">Text</label><input type="text" id="ed-text" placeholder="For..." value="' + (adding ? '' : esc(it.text)) + '">'
    + '<label class="f">Priority</label>' + seg
    + (adding
      ? '<p class="meta" style="margin-top:12px">Adding an intention redraws today — it can stand in today\u2019s prayers at once.</p>'
      : '<p class="meta" style="margin-top:12px">Status: ' + esc(it.status) + ' · Created: ' + esc((it.created_at || '').slice(0, 10)) + ' · Drawn ' + (it.drawnCount || 0) + ' times' + (it.lastDrawn ? ' · last drawn ' + it.lastDrawn : '') + '</p>')
    + '<p class="fieldnote" id="ed-note"></p><div style="margin-top:14px"><button class="btn gold" id="ed-save">' + (adding ? 'Add to the pool' : 'Save') + '</button></div></div>';
  document.body.appendChild(sheet);
  mountDrawer(sheet, true); // v419: TALL drawer — the header Close retires
  var segEl = sheet.querySelector('#ed-pri');
  segEl.querySelectorAll('[data-pri]').forEach(function (b) {
    b.addEventListener('click', function () {
      segEl.querySelectorAll('[data-pri]').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      priSel = b.getAttribute('data-pri');
    });
  });
  sheet.querySelector('#ed-save').addEventListener('click', function () {
    var btn = sheet.querySelector('#ed-save');
    var text = sheet.querySelector('#ed-text').value;
    if (adding && !text.trim()) { sheet.querySelector('#ed-note').textContent = 'Write the intention first.'; return; }
    btn.disabled = true;
    var call = adding
      ? post('/api/prayer/intentions', { text: text.trim(), priority: priSel })
      : api('/api/prayer/intentions/' + it.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text, priority: priSel }) });
    call.then(function (res) { sheet.remove(); settleIntentions(!!(res && res.redrawn === false)); })
      .catch(function () { btn.disabled = false; sheet.querySelector('#ed-note').textContent = adding ? 'That did not add. Your text is still here \u2014 try again.' : 'That did not save. Your text is still here \u2014 try again.'; });
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
  var d = { episodeId: t.episodeId || ('seg:' + (t._block || '')), title: t.title || 'Intentions', url: t.streamUrl || null, available: !!t.available, block: t._block || '', source: t.source || '', durationS: t.durationS || t.durationSec || 0, imageUrl: t.imageUrl || null, descText: t.descText || null, spotifyUrl: t.spotifyUrl || null };
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
/* ---------------- v413: the playlist grammar ----------------
   The Spotify-playlist re-dress (Scope §1, Plan §2): cover
   tiles, sheet menus (ONE component — the player overflow, the
   row menus, the page menus are all instances), the share
   sheet, the manual playlist order, and the grid's download
   state. Everything renders in the app theme; no playback code
   stands here. */
var BLOCK_TONES = { 'Morning': 'navy', 'Midmorning': 'gold', 'Midday': 'teal', 'Afternoon': 'plum', 'Evening': 'navy', 'Night': 'plum', 'Mass and Homilies': 'gold', 'Novenas': 'teal', 'The AI Signal': 'navy' };
function blockTone(block) { return BLOCK_TONES[block] || 'navy'; }
/* v417 §2.5 (FD3): the fallback GLYPH table — where no real
   artwork exists the tile carries the block's glyph, never
   a letter or monogram; colors read the standing tones; no
   Spotify green or branding. An unmapped block takes ✦.
   v419 (G11): The AI Signal joins the table with the bolt —
   its real-logo tile retires (coverTileHtml + rowArtHtml). */
var BLOCK_GLYPHS = { 'Morning': '\u2600', 'Midmorning': '\u2726', 'Midday': '\u2756', 'Afternoon': '\u2605', 'Evening': '\u2727', 'Night': '\u263e', 'Mass and Homilies': '\u2020', 'Novenas': '\u271a', 'The AI Signal': '\u26a1', '__episodes': '\u266b' };
function blockGlyphOf(block) { return BLOCK_GLYPHS[block] || '\u2726'; }
/* v438 §2.2(6): the block value's DISPLAY name at render — the
   Podcasts tab is named Formation (v438); the descriptor's block
   VALUE stays 'Podcasts' (played state keys on it). One entry;
   every other value, empty and undefined included, returns as-is. */
var BLOCK_DISPLAY_NAMES = { 'Podcasts': 'Formation' };
function blockDisplayName(block) { return BLOCK_DISPLAY_NAMES[block] || block; }
function blockLabelOf(block) {
  var b = ((state.dayPayload && state.dayPayload.blocks) || []).filter(function (x) { return x.block === block; })[0];
  return b ? (b.label || b.block) : (block || '');
}
function coverTileHtml(block, cls) {
  // v417 §2.5 (FD3): the cover tile's content is the block's
  // glyph. v419 (G11, folded from v418): every block, The AI
  // Signal included, takes the generic glyph chain — its
  // real-logo tile retires; no logo tile stands anywhere.
  // (The brand mark's other uses — the brand bar, the NP hero
  // fallback, the dock thumb fallback — are not tiles and
  // stand.)
  return '<div class="blockcover tone-' + blockTone(block) + (cls ? ' ' + cls : '') + '"><span class="blockcover-initial">' + blockGlyphOf(block) + '</span></div>';
}
function rowArtHtml(t) {
  // §2.3's fallback chain: episode art → show art → theme tile.
  // Referenced at render (an <img> at the provider URL); a URL
  // that fails to load removes itself and the tile beneath
  // stands — never a broken-image glyph.
  // v417 §2.5 (FD3): the tile's content is the block's glyph,
  // never a letter; the bars tile stands in the wrap for the
  // current row (§2.6). v419 (G11): the AI Signal logo special
  // case retires — its rows take the generic chain (episode
  // art → show art → the bolt tile).
  var tile = '<span class="rowart tile tone-' + blockTone(t._block || t.block) + '"><span>' + blockGlyphOf(t._block || t.block) + '</span></span>';
  if (t.imageUrl) return '<span class="rowartwrap">' + tile + '<img class="rowart" src="' + esc(t.imageUrl) + '" alt="" onerror="this.remove()">' + barsTileHtml() + '</span>';
  return '<span class="rowartwrap">' + tile + barsTileHtml() + '</span>';
}
function fmtDurLong(s) {
  s = Math.max(0, Math.round(Number(s) || 0));
  var m = Math.floor(s / 60);
  return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'min' : m + 'min';
}
/* ONE menu component (§2.8): items are { label, state?, act,
   stay? } — a stay item acts in place and its state line is
   re-read (stateFn); every other item closes the menu, then
   acts. No dead items: a menu carries only wired acts. */
function openSheetMenu(title, items, anchorEl) {
  // v419 (G15/F-419-2): the working menus render as an
  // ANCHORED CARD by their control — never a sheet. The card
  // seats below the anchor when it fits, above when it does
  // not (the roomier side + internal scroll when neither
  // fits whole); its right edge aligns the anchor's, clamped
  // to the 12px margins; its width is the anchor's, floored
  // at 232px. The invisible tap-catcher beneath dismisses.
  // The item contract stands (label · state · stay · stateFn
  // · act; a glyph slot renders only for glyph-carrying
  // items — F-419-8). With no anchor the card seats at the
  // bottom above the dock.
  document.querySelectorAll('.anchmenu, .menucatcher').forEach(function (n) { n.remove(); });
  var catcher = document.createElement('div');
  catcher.className = 'menucatcher';
  var card = document.createElement('div');
  card.className = 'menusheet anchmenu';
  card.innerHTML = '<h1 class="screen">' + esc(title) + '</h1>'
    + items.map(function (it, i) {
      return '<button class="menurow" data-menuitem="' + i + '">' + (it.glyph ? '<span class="menuglyph">' + it.glyph + '</span>' : '') + '<span class="grow">' + esc(it.label) + '</span>' + (it.state ? '<span class="meta" data-menustate="' + i + '">' + esc(it.state) + '</span>' : '') + '</button>';
    }).join('');
  document.body.appendChild(catcher);
  document.body.appendChild(card);
  var vw = window.innerWidth, vh = window.innerHeight;
  var anchor = anchorEl || (document.activeElement && document.activeElement.tagName === 'BUTTON' ? document.activeElement : null);
  var ar = anchor ? anchor.getBoundingClientRect() : null;
  var width = ar ? Math.min(Math.max(232, ar.width), vw - 24) : vw - 24;
  card.style.width = width + 'px';
  card.style.visibility = 'hidden';
  var h = card.offsetHeight;
  var left, top;
  if (ar) {
    left = Math.max(12, Math.min(ar.right - width, vw - width - 12));
    if (ar.bottom + 6 + h <= vh - 12) top = ar.bottom + 6;
    else if (ar.top - 6 - h >= 12) top = ar.top - 6 - h;
    else if (vh - ar.bottom >= ar.top) { top = ar.bottom + 6; card.style.maxHeight = (vh - 12 - top) + 'px'; }
    else { card.style.maxHeight = (ar.top - 18) + 'px'; top = ar.top - 6 - Math.min(h, ar.top - 18); }
  } else { left = 12; top = vh - 76 - h; }
  card.style.left = left + 'px';
  card.style.top = top + 'px';
  card.style.visibility = '';
  var close = function () { catcher.remove(); card.remove(); };
  catcher.addEventListener('click', close);
  card.querySelectorAll('[data-menuitem]').forEach(function (b) {
    b.addEventListener('click', function () {
      var i = Number(b.getAttribute('data-menuitem'));
      var it = items[i];
      if (!it || !it.act) return;
      if (it.stay) {
        it.act();
        var st = card.querySelector('[data-menustate="' + i + '"]');
        if (st && it.stateFn) st.textContent = it.stateFn();
      } else {
        close();
        it.act();
      }
    });
  });
  return card;
}
function openPlayerMenu(anchorEl) {
  // §1.4 + FD3: the player-level overflow — exactly Autoplay ·
  // Sleep timer · Playback speed, each a state line opening its
  // standing act/sheet. Transport never enters the menu; the
  // intentions toggle does NOT move (ruling R1).
  // v419: the menu anchors at its control (the NP ⋮ button).
  openSheetMenu('Playback', [
    { label: 'Autoplay', state: autoplayOn() ? 'On' : 'Off', stay: true, stateFn: function () { return autoplayOn() ? 'On' : 'Off'; }, act: function () { setAutoplay(!autoplayOn()); } },
    { label: 'Sleep timer', state: sleepLabel().replace('Sleep \u00b7 ', ''), act: function () { openSleepSheet(); } },
    { label: 'Playback speed', state: (state.rate || 1) + '\u00d7', act: function () { openSpeedSheet(); } }
  ], anchorEl);
}
function openDockMenu(anchorEl) {
  // v419 (G15): the dock menu anchors at the dock's own ⋮
  // button — resolved here so every caller (the dock handler,
  // a bare call) seats the card at the same control.
  if (!anchorEl) anchorEl = document.getElementById('dock-menu');
  // v417 §2.8 (D4/FD4): the DOCK's own menu, on the one menu
  // component — a superset of the player overflow, NOT an
  // edit to it (openPlayerMenu above stands as built; §1.3).
  // Previous track stands exactly while a queue stands (the
  // standing face button's enable rule; no dead items) and
  // acts v412 Fix 8's one rule; Intentions is a stay item
  // carrying the retired face button's identical act; the
  // three standing items read the same definitions the
  // player menu reads.
  var items = [];
  if (state.queue.length) items.push({ label: 'Previous track', act: function () { previousWithRule(); } });
  items.push({ label: 'Intentions', state: intentionsOn() ? 'On' : 'Off', stay: true, stateFn: function () { return intentionsOn() ? 'On' : 'Off'; }, act: function () { setIntentions(!intentionsOn()); } });
  items.push({ label: 'Autoplay', state: autoplayOn() ? 'On' : 'Off', stay: true, stateFn: function () { return autoplayOn() ? 'On' : 'Off'; }, act: function () { setAutoplay(!autoplayOn()); } });
  items.push({ label: 'Sleep timer', state: sleepLabel().replace('Sleep \u00b7 ', ''), act: function () { openSleepSheet(); } });
  items.push({ label: 'Playback speed', state: (state.rate || 1) + '\u00d7', act: function () { openSpeedSheet(); } });
  openSheetMenu('Playback', items, anchorEl);
}
/* FD6: ONE share sheet — the episode card at its head, Share…
   only where the platform sheet stands, Copy link always. */
function spotifyUrlFor(t) {
  if (!t) return null;
  if (t.spotifyUrl) return t.spotifyUrl;
  var blk = ((state.dayPayload && state.dayPayload.blocks) || []).filter(function (x) { return x.block === (t._block || t.block); })[0];
  return blk && blk.spotifyUrl ? blk.spotifyUrl : null;
}
function shareUrlFor(t) {
  var sp = spotifyUrlFor(t);
  if (sp) return sp;
  if (t) {
    var cand = t.streamUrl || t.enclosureUrl || t.url || null;
    if (cand && String(cand).indexOf('blob:') !== 0) {
      return String(cand).indexOf('/api/') === 0 ? location.origin + cand : cand;
    }
  }
  return location.origin + '/';
}
function openShareSheet(o) {
  var old = document.querySelector('.sharesheet');
  if (old) old.remove();
  var sheet = document.createElement('div');
  sheet.className = 'sheet sharesheet';
  sheet.innerHTML = '<div class="inner"><div class="row"><h1 class="screen grow">Share</h1></div>'
    + '<div class="card"><div class="row">' + (o.artHtml || '') + '<div class="grow"><h3>' + esc(o.title) + '</h3><div class="meta">' + esc(o.line) + '</div></div></div></div>'
    + (navigator.share ? '<button class="menurow" data-sharego="1"><span class="grow">Share&hellip;</span></button>' : '')
    + '<button class="menurow" data-sharecopy="1"><span class="grow">Copy link</span></button>'
    + '<p class="fieldnote" data-shareline="1"></p></div>';
  document.body.appendChild(sheet);
  mountDrawer(sheet, false); // v419: FIT drawer — the header Close retires
  var go = sheet.querySelector('[data-sharego]');
  if (go) go.addEventListener('click', function () {
    sheet.remove();
    try { var p = navigator.share({ title: o.title, text: o.title + ' \u2014 ' + o.line, url: o.url }); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  });
  sheet.querySelector('[data-sharecopy]').addEventListener('click', function () {
    var line = sheet.querySelector('[data-shareline]');
    var done = function (okCopy) { if (line) line.textContent = okCopy ? 'Link copied.' : 'Copy did not work here. The link is: ' + o.url; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(o.url).then(function () { done(true); }, function () { done(false); });
    else done(false);
  });
}
function shareTrackSheet(t) {
  openShareSheet({
    artHtml: rowArtHtml(t), title: t.title || '',
    line: 'Episode' + (t.durationS ? ' \u00b7 ' + fmtDur(t.durationS) : ''),
    url: shareUrlFor(t)
  });
}
/* FD7 day-row menu (§2.9): Share · Download (only — a day-set
   Remove is undone by the v392 convergence, so it is not
   offered) · Open in Spotify (where a URL stands). The
   Download item stands only while the episode is not already
   on the device — the cache read lands before the menu opens. */
function openDayRowMenu(t, anchorEl) {
  var items = [{ label: 'Share', act: function () { shareTrackSheet(t); } }];
  var build = function (standing) {
    if (t.available && !standing) items.push({ label: 'Download', act: function () { dayRowDownload(t); } });
    var sp = spotifyUrlFor(t);
    if (sp) items.push({ label: 'Open in Spotify', act: function () { window.open(sp, '_blank', 'noopener'); } });
    openSheetMenu(t.title || 'Options', items, anchorEl);
  };
  if (!t.available || !('caches' in window)) { build(true); return; }
  caches.open('opn-ext-audio-v1').then(function (cache) { return cache.match(offlineDayKey(presentedDateStr(), t.episodeId)); })
    .then(function (r) { build(!!r); }, function () { build(false); });
}
function dayRowDownload(t) {
  var date = presentedDateStr();
  var items = offlineEnumerateToday(date).filter(function (it) { return it.id === t.episodeId; });
  if (!items.length) return;
  offlineDownloadItems(items, null).then(function () { refreshGridDlStates(); paintOfflineLine(); });
}
function wireRowActs(scope) {
  scope.querySelectorAll('[data-rowmenu]').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.getAttribute('data-rowmenu');
      var t = (state.dayDescs || []).filter(function (x) { return x.episodeId === key; })[0] || state.readTracks[key];
      if (t) openDayRowMenu(t, b);
    });
  });
  scope.querySelectorAll('[data-rowshare]').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.getAttribute('data-rowshare');
      var t = (state.dayDescs || []).filter(function (x) { return x.episodeId === key; })[0] || state.readTracks[key];
      if (t) shareTrackSheet(t);
    });
  });
}
/* §2.2 / FD1: the manual order — the payload fold first, the
   device mirror second (a PUT that failed offline still shows
   the user's order here; the next successful editor move
   re-syncs the server), the contracts' order last. */
var BLOCK_ORDER_KEY = 'opn-block-order-v413';
function blockOrderMirror() {
  try { var v = JSON.parse(localStorage.getItem(BLOCK_ORDER_KEY) || 'null'); return Array.isArray(v) && v.length ? v : null; } catch (e) { return null; }
}
function blockOrderWriteMirror(order) { try { localStorage.setItem(BLOCK_ORDER_KEY, JSON.stringify(order)); } catch (e) {} }
function effectiveBlockOrder(day) {
  if (day && day.blockOrder && day.blockOrder.length) return day.blockOrder;
  return blockOrderMirror();
}
function orderedBlocks(day) {
  var blocks = (day.blocks || []).slice();
  var order = effectiveBlockOrder(day);
  if (!order || !order.length) return blocks;
  var rank = {};
  order.forEach(function (n, i) { rank[n] = i; });
  return blocks.map(function (b, i) { return { b: b, i: i }; })
    .sort(function (a, c) {
      var ra = rank[a.b.block] != null ? rank[a.b.block] : 1000 + a.i;
      var rc = rank[c.b.block] != null ? rank[c.b.block] : 1000 + c.i;
      return ra - rc;
    })
    .map(function (x) { return x.b; });
}
/* FD5: ONE order editor — 44px move buttons, write-through per
   move (mirror + PUT). Opened from the grid's sort row and from
   every block page's Sort act. Episode order inside a block is
   never editable here (§1.5). */
function openBlockOrderEditor() {
  var day = state.dayPayload;
  if (!day) return;
  var order = orderedBlocks(day).map(function (b) { return b.block; });
  var old = document.querySelector('.ordersheet');
  if (old) old.remove();
  var sheet = document.createElement('div');
  sheet.className = 'sheet ordersheet';
  sheet.innerHTML = '<div class="inner"><div class="row"><h1 class="screen grow">Playlist order</h1></div>'
    + '<p class="meta">Your own order for the Prayers grid \u2014 kept with your other choices, so it follows you across devices.</p>'
    + '<div data-orderlist="1"></div><p class="fieldnote" data-orderline="1"></p></div>';
  document.body.appendChild(sheet);
  mountDrawer(sheet, true); // v419: TALL drawer \u2014 the header Done retires (moves write through per tap)
  var paintList = function () {
    var list = sheet.querySelector('[data-orderlist]');
    list.innerHTML = order.map(function (name, i) {
      return '<div class="setrow"><div class="row">' + coverTileHtml(name, 'sm') + '<span class="setname grow">' + esc(blockLabelOf(name) || name) + '</span>'
        + '<span class="setcontrols"><button class="mvbtn" data-ordup="' + i + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up">\u2191</button>'
        + '<button class="mvbtn" data-orddown="' + i + '"' + (i === order.length - 1 ? ' disabled' : '') + ' aria-label="Move down">\u2193</button></span></div></div>';
    }).join('');
    list.querySelectorAll('[data-ordup]').forEach(function (b) { b.addEventListener('click', function () { move(Number(b.getAttribute('data-ordup')), -1); }); });
    list.querySelectorAll('[data-orddown]').forEach(function (b) { b.addEventListener('click', function () { move(Number(b.getAttribute('data-orddown')), 1); }); });
  };
  var move = function (i, d) {
    var j = i + d;
    if (j < 0 || j >= order.length) return;
    var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    blockOrderWriteMirror(order);
    if (state.dayPayload) state.dayPayload.blockOrder = order.slice();
    var line = sheet.querySelector('[data-orderline]');
    if (line) line.textContent = '';
    paintList();
    api('/api/player/block-order', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: order }) })
      .then(function (r) { if (!r || !r.ok) throw new Error('order save failed'); })
      .catch(function () { var l2 = sheet.querySelector('[data-orderline]'); if (l2) l2.textContent = 'That did not save. Your order is kept on this device \u2014 try again.'; });
    if (state.tab === 'prayers' && state.dayPayload) paintPrayersView(state.dayPayload);
  };
  paintList();
}
/* §2.11: the grid's download state — read from the client's own
   Cache Storage on every surface (the v392 set stands there on
   web too). One keys() pass writes the cards' icons, the block
   pages' toggle state, and the rows' downloaded icons. */
function refreshGridDlStates() {
  if (!('caches' in window)) return Promise.resolve();
  return caches.open('opn-ext-audio-v1').then(function (cache) { return cache.keys(); }).then(function (reqs) {
    var standing = {};
    reqs.forEach(function (rq) { standing[rq.url.slice(location.origin.length + 1)] = 1; });
    var date = presentedDateStr();
    var byBlock = {};
    (state.dayDescs || []).forEach(function (d) {
      if (!d.block || !d.available) return;
      if (d.kind === 'segment') return; // the Intentions segment is not part of the downloadable day set (offlineEnumerateToday's set governs)
      byBlock[d.block] = byBlock[d.block] || { total: 0, have: 0 };
      byBlock[d.block].total++;
      if (standing[offlineDayKey(date, d.episodeId)]) byBlock[d.block].have++;
    });
    state.gridDl = {};
    Object.keys(byBlock).forEach(function (b) { state.gridDl[b] = byBlock[b].total > 0 && byBlock[b].have >= byBlock[b].total; });
    view.querySelectorAll('[data-carddl]').forEach(function (el) {
      el.style.display = state.gridDl[el.getAttribute('data-carddl')] ? '' : 'none';
    });
    view.querySelectorAll('[data-blockdl]').forEach(function (btn) {
      var full = !!state.gridDl[btn.getAttribute('data-blockdl')];
      btn.textContent = full ? 'On this device' : 'Download all';
      btn.disabled = full;
    });
    view.querySelectorAll('[data-blockdlnote]').forEach(function (note) {
      var full = !!state.gridDl[note.getAttribute('data-blockdlnote')];
      // v420 §2.6: the note folds to one compact line for the
      // pill line — the downloaded confirmation + the removal
      // pointer (the act stands only in Settings) survive;
      // the full sentence does not fit the line.
      note.textContent = full ? 'Downloaded \u00b7 remove in Settings' : '';
    });
    view.querySelectorAll('[data-rowdl]').forEach(function (el) {
      el.style.display = standing[offlineDayKey(date, el.getAttribute('data-rowdl'))] ? '' : 'none';
    });
    // v449 §2 Build 1: the standing Downloaded-filter grid
    // repaint retires with the filter chips — its one purpose
    // was re-narrowing the home grid under a filter that no
    // longer stands (the census: the homeFilter and _dlKey
    // state fields have no other reader). The data-carddl /
    // data-blockdl / data-rowdl updates above stand
    // unchanged — the home rows carry the spans now.
  }).catch(function () {});
}
function blockDownloadAll(block) {
  var date = presentedDateStr();
  var ids = {};
  (state.dayDescs || []).forEach(function (d) { if (d.block === block && d.available) ids[d.episodeId] = 1; });
  var items = offlineEnumerateToday(date).filter(function (it) { return ids[it.id]; });
  if (!items.length) return;
  offlineDownloadItems(items, null).then(function () { refreshGridDlStates(); paintOfflineLine(); });
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
  var wrap = function (wordsInner) {
    // v344 §2.5: wrap serves the AVAILABLE branches only (the
    // unavailable cards return their own shapes below and carry
    // NO marker).
    // v424 §2.2: the card stands as ONE box — wrap emits the
    // .row alone; the .prow-ctl controls line retires on every
    // form trackCard serves (the podcast rows keep theirs —
    // podRowString is a separate emission, FD7). The controls
    // ride inside .grow: the cluster in the title line (below),
    // Read + the ⤓ trailing the meta line.
    return '<div class="card trow prow" data-card="' + esc(key) + '"><div class="row">' + wordsInner + '</div></div>';
  };
  // v424 §2.2/§2.3 (FD1/FD2/FD6): the in-box cluster, seated in
  // the title line inside .grow, reading played dot · play disc
  // · ⋮ left to right with the ⋮ flush at the card's inner right
  // edge; every box stands 44×44 (the disc by the cluster-scoped
  // rule in ui.ts). The standalone Share button retires (FD4) —
  // Share stands first in the ⋮ menu, as it already did.
  var cluster = function () {
    return '<span class="prow-cluster">' + playedDotHtml(t)
      + '<button class="playbtn" data-playkey="' + esc(key) + '" data-url="' + esc(t.streamUrl) + '">&#9654;</button>'
      + '<button class="iconbtn" data-rowmenu="' + esc(key) + '" aria-label="More options">\u22ee</button></span>';
  };
  var titleRow = function () {
    return '<div class="titlerow"><h3' + heardCls(t) + '>' + esc(t.title) + '</h3>' + cluster() + '</div>';
  };
  // v424 §2.3 (FD5/FD3): the meta line's trailing segment — the
  // ⤓ downloaded indicator first (a span, state only; it keeps
  // data-rowdl + its display:none start and refreshGridDlStates
  // stands untouched), then Read where the card carries text.
  var metaTrail = function (readCtl) {
    return '<span class="dl-ico" data-rowdl="' + esc(key) + '" style="display:none" title="Downloaded">\u2913</span>' + readCtl;
  };
  // v413 §2.6: the two-line snippet — where descText stands
  // (externals + podcasts); own Ora rows carry none (F-413-1).
  var snippet = t.descText ? '<div class="snippet">' + esc(t.descText) + '</div>' : '';
  if (t.kind === 'external') {
    // v324 §2.9: an external track names its source in the meta line
    // (D5); a miss stands as "Not available today". No Read control —
    // externals carry no text (the payload's hasText is false), and a
    // present external carries no not-available line.
    // v413 §2.6: the meta takes the video's form — the standing
    // day word + duration, the source line folded in after.
    if (t.available) {
      // v417 §2.7 (D2): the meta's day word is the presented
      // day's own — 'Today' only when the presented day IS
      // today, the short form otherwise; no clock stands.
      return wrap(rowArtHtml(t) + '<div class="grow">' + titleRow() + snippet + '<div class="meta metarow"><span>' + presentedDayWord() + (t.durationS ? ' \u00b7 ' + fmtDur(t.durationS) : '') + (t.source ? ' \u00b7 ' + esc(t.source) : '') + '</span>' + metaTrail('') + '</div>' + intLine + '</div>');
    }
    // v363 §2.2/§2.3: the unavailable card takes the .row form
    // and the .trow height; "Not available today" folds into
    // the meta line after the duration (omitted when none
    // stands, as today). No tail stands — an external carries
    // neither a Read control nor a Spotify link.
    // v413 §2.6: the unavailable form keeps the art tile and
    // carries no cluster acts that cannot be honored.
    return '<div class="card trow prow" data-card="' + esc(key) + '"><div class="row">' + rowArtHtml(t) + '<div class="grow"><h3>' + esc(t.title) + '</h3><div class="meta">' + (t.durationS ? fmtDur(t.durationS) + ' \u00b7 ' : '') + 'Not available today</div></div></div></div>';
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
    // v413 §2.6/R4: the Read control stays in the row (a
    // content act, not a menu item); the Spotify link leaves
    // the row — its one home is now the row ⋮ menu.
    // v417 §2.4 (FD5): Read stands FIRST in the controls
    // line; the .trow-tail wrapper dissolves into the line.
    var readCtl = !noText ? readButton(t, key) : '';
    // v424 §2.3 (FD3): Read trails the meta line in the box,
    // after the ⤓ — v413's R4 stands (visible, not a menu item).
    return wrap(rowArtHtml(t) + '<div class="grow">' + titleRow() + '<div class="meta metarow"><span>' + meta + '</span>' + metaTrail(readCtl) + '</div>' + intLine + '</div>');
  }
  // v363 §2.2/§2.3: the own unavailable card takes the .row form
  // and the .trow height; "Not available in the app yet" folds
  // into the meta after the duration (omitted when none stands,
  // as today) (no played dot stands on an unavailable branch —
  // the standing rule).
  // v417 §2.4 (FD5): with text, the Read control stands ALONE
  // on the controls line; without text, no controls line
  // stands at all and the words span the full width.
  // v424 §2.3 (FD8): the unavailable form folds in — with text,
  // Read trails the meta line in the box and no controls line
  // stands; without text the card stands as it stood (no Read,
  // no cluster — no acts exist to honor).
  var metaU = (t.durationS ? fmtDur(t.durationS) + ' · ' : '') + 'Not available in the app yet';
  var growU = (t.hasText && t.textUrl)
    ? '<div class="grow"><h3>' + esc(t.title) + '</h3><div class="meta metarow"><span>' + metaU + '</span>' + readButton(t, key) + '</div></div>'
    : '<div class="grow"><h3>' + esc(t.title) + '</h3><div class="meta">' + metaU + '</div></div>';
  return '<div class="card trow prow" data-card="' + esc(key) + '"><div class="row">' + rowArtHtml(t) + growU + '</div></div>';
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
  sheet.innerHTML = '<div class="inner"><div class="row"><button class="playbtn" data-playkey="' + esc(t.episodeId) + '">&#9654;</button><div class="grow"><h1 class="screen">' + esc(t.title) + '</h1><p class="sub">the episode&rsquo;s text</p></div></div><div class="readtext" data-skeleton="1"><span class="skelbar" style="width:96%"></span><span class="skelbar" style="width:88%"></span><span class="skelbar" style="width:93%"></span><span class="skelbar" style="width:76%"></span><span class="skelbar" style="width:90%"></span></div></div>';
  document.body.appendChild(sheet);
  mountDrawer(sheet, true); // v419: TALL drawer — the header Close retires; the text paints as skeleton lines (SK-8)
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
/* v435 §2.1/§2.2: the Now Playing hero follows the playing
   descriptor. realArtUrl is the sheet's art test: a descriptor
   imageUrl counts as real art unless it IS the own feed's logo
   file — the exact-file test (scheme stripped, the whole string
   lowercased, both host casings in the live feed covered by the
   one comparison), plus the defensive '/logo.png' clause so
   the app's own logo path can never re-enter as "art". F-435-1
   as ruled by John (2026-11-15 00:39 CT: "Use the ora pro Nobis
   logo for things that come from this podcast"): where no real
   art stands, the hero is the LOGO — the glyph-tile no-art
   branch does not stand on this surface; tracks from other
   sources show their own art through the branch below. */
function isOwnLogoUrl(u) {
  if (!u) return false;
  if (u === '/logo.png') return true;
  var s = String(u).replace(/^(?:[a-z][a-z0-9+.-]*:)?[/][/]/i, '').toLowerCase();
  return s === 'jctebo.github.io/spotify_praylist/images/logo_ora_pro_nobis.png';
}
function realArtUrl(cur) {
  var u = cur && cur.imageUrl;
  if (!u) return null;
  return isOwnLogoUrl(u) ? null : u;
}
function npArtRender(sheet, cur) {
  var artEl = sheet.querySelector('#np-art');
  if (!artEl) return;
  var art = realArtUrl(cur);
  var key = art ? 'img:' + art : 'logo';
  if (artEl.getAttribute('data-artkey') === key) return; // the dock thumb's guard pattern: no rebuild, no img reload, on unrelated renders
  artEl.setAttribute('data-artkey', key);
  if (art) {
    // the rowArtHtml pattern: the art stands over the block
    // glyph tile; a URL that fails to load removes itself and
    // the tile beneath stands — never a broken-image glyph.
    artEl.innerHTML = coverTileHtml(cur.block || '', 'hero')
      + '<img class="np-art-img" src="' + esc(art) + '" alt="" onerror="this.remove()">';
  } else {
    artEl.innerHTML = '<img class="np-art-img" src="/logo.png" alt="Ora Pro Nobis logo">';
  }
}
function npDuration() {
  var d = audioEl.duration;
  if (isFinite(d) && d > 0) return d;
  var cur = state.current;
  if (cur && cur.durationS > 0) return cur.durationS;
  return 0;
}
function openNowPlaying() {
  closeWatch(); // v434 §2.6.2 seat 3: the sheet's open act joins the audio choke point — a standing watch frame is torn down first
  var old = document.querySelector('.np-sheet');
  if (old) old.remove();
  if (!state.current) return;
  var sheet = document.createElement('div');
  sheet.className = 'sheet np-sheet';
  sheet.innerHTML = '<div class="inner">'
    + '<div class="np-hero">'
    + '<div class="np-grab"><span class="grabpill"></span></div>'
    + '<div class="np-art" id="np-art"></div>'
    + '<h1 class="screen np-title" id="np-title"></h1>'
    + '<p class="sub np-meta" id="np-meta"></p>'
    + '<div class="np-intention" id="np-intention" style="display:none"></div>'
    + (state.liturgical && state.liturgical.name ? '<div class="np-litday" id="np-litday">' + esc(state.liturgical.name) + '</div>' : '')
    + '</div>'
    + '<div class="np-seekrow"><span id="np-elapsed">0:00</span><input type="range" id="np-seek" min="0" max="1000" value="0" aria-label="Seek"><span id="np-remain">--:--</span></div>'
    + '<div class="np-transport"><button class="np-tbtn" id="np-back10" aria-label="Back 10 seconds">-10</button><button class="np-tbtn" id="np-prev" aria-label="Previous track">&#9198;</button><button class="playbtn np-play" id="np-play" aria-label="Play or pause">&#9654;</button><button class="np-tbtn" id="np-next" aria-label="Next track">&#9197;</button><button class="np-tbtn" id="np-fwd10" aria-label="Forward 10 seconds">+10</button></div>'
    + '<div class="row np-controls"><button class="btn ghost" id="np-intentions">Intentions On</button><button class="btn ghost" id="np-read">Read</button><button class="btn ghost" id="np-menu" aria-label="Playback options">\u22ee</button></div>'
    + '<div class="npq-head"><span class="npq-heading">Queue</span><span class="meta" id="np-queue-pos"></span></div>'
    + '<div id="np-queue" class="liblist"></div>'
    + '</div>';
  document.body.appendChild(sheet);
  // v419 (G16): the minimize chevron retires into the grab —
  // a tap on the handle, or a drag down, minimizes (the sheet
  // removes; playback is never touched).
  wireNpGrab(sheet, function () { sheet.remove(); });
  sheet.querySelector('#np-play').addEventListener('click', function () { if (!state.current) return; if (state.queue.length) { if (transportPlaying()) pauseTransport(); else resumeCurrent(); } else playTrack(state.current); });
  sheet.querySelector('#np-prev').addEventListener('click', function () { previousWithRule(); }); // v412 Fix 8: the one rule
  sheet.querySelector('#np-back10').addEventListener('click', function () { seekBy(-10); }); // v412 Fix 12
  sheet.querySelector('#np-fwd10').addEventListener('click', function () { seekBy(10); }); // v412 Fix 12
  sheet.querySelector('#np-next').addEventListener('click', function () { advanceQueue(1); });
  // v413 §2.8: speed/sleep/autoplay leave the face — the ⋮
  // entrance opens the ONE player overflow (openPlayerMenu);
  // the intentions toggle keeps its place (ruling R1).
  sheet.querySelector('#np-menu').addEventListener('click', function () { openPlayerMenu(this); });
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
  var meta = blockDisplayName(cur.block) || '';
  if (cur.source) meta = meta ? meta + ' · ' + cur.source : cur.source;
  if (!meta) meta = state.dateLabel || '';
  sheet.querySelector('#np-meta').textContent = meta;
  npArtRender(sheet, cur); // v435 §2.1: the hero follows the playing descriptor, on open and on every track change
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
  sheet.querySelector('#np-prev').disabled = !state.queue.length; // v412 Fix 8: enabled at the queue head (the rule restarts the track there)
  sheet.querySelector('#np-next').disabled = !state.queue.length;
  syncAutoplayToggles(); // v358: the Now Playing toggle's label follows the store
  syncIntentionsToggles(); // v384 §2.5: the intentions switches follow the store at every render
  var rt = state.readTracks[cur.episodeId];
  // v419 (G17/F-419-7): the Read slot is HELD, not collapsed —
  // a textless track leaves the button invisible in its box
  // (visibility, aria-hidden), so the control row's geometry
  // never moves between tracks.
  var readBtn = sheet.querySelector('#np-read');
  if (rt && rt.hasText && rt.textUrl) { readBtn.style.visibility = ''; readBtn.removeAttribute('aria-hidden'); }
  else { readBtn.style.visibility = 'hidden'; readBtn.setAttribute('aria-hidden', 'true'); }
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
  // v413 §2.3: the channel head's art — the fallback for items
  // carrying none (the Worker parser's channel rule, mirrored).
  var channelImageUrl = null;
  var chan = doc.getElementsByTagName('channel')[0];
  if (chan) {
    var cim = chan.getElementsByTagName('itunes:image')[0];
    if (cim && cim.getAttribute('href')) channelImageUrl = cim.getAttribute('href');
    if (!channelImageUrl) {
      var curl = chan.querySelector('image url');
      if (curl && curl.textContent.trim()) channelImageUrl = curl.textContent.trim();
    }
  }
  var items = [];
  doc.querySelectorAll('item').forEach(function (it) {
    var titleEl = it.querySelector('title');
    var enc = it.querySelector('enclosure');
    var pubEl = it.querySelector('pubDate');
    var durEl = it.getElementsByTagName('itunes:duration')[0] || null;
    var pubMs = pubEl ? Date.parse(pubEl.textContent.trim()) : NaN;
    // v413 §2.3: per-item provider art + snippet (D2), mirroring
    // the Worker's parser — item image else the channel's.
    var imgEl = it.getElementsByTagName('itunes:image')[0];
    var sumEl = it.getElementsByTagName('itunes:summary')[0] || it.querySelector('description');
    var descText = sumEl ? extWs(sumEl.textContent) : '';
    items.push({
      title: extWs(titleEl ? titleEl.textContent : ''),
      url: enc ? (enc.getAttribute('url') || '') : '',
      length: enc && (enc.getAttribute('length') || '').trim() !== '' && !isNaN(Number(enc.getAttribute('length'))) ? Number(enc.getAttribute('length')) : 0,
      pubMs: isFinite(pubMs) ? pubMs : null,
      durationS: extParseDuration(durEl ? durEl.textContent : null),
      imageUrl: (imgEl && imgEl.getAttribute('href')) || channelImageUrl || null,
      descText: descText ? descText.slice(0, 240) : null
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
  return '<div class="card trow" data-card="' + esc(slot.slotId) + '" data-skeleton="1"><h3>' + esc(slot.title || 'Bible in a Year') + '</h3><span class="skelbar" style="width:55%"></span><span class="skelbar" style="width:35%"></span></div>'; // v419 (SK-9)
}
function extSlotTrack(slot, st) {
  return {
    episodeId: slot.slotId, title: st.title, kind: 'external', source: st.source,
    available: st.state === 'present', streamUrl: st.state === 'present' ? st.streamUrl : null,
    durationS: st.durationSec || 0, sizeBytes: st.sizeBytes || 0, hasText: false, textUrl: null, _block: slot.block,
    // v413 §2.3: the provider art + snippet ride the slot state
    // into the row (referenced, never re-hosted).
    imageUrl: st.imageUrl || null, descText: st.descText || null
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
    wireRowActs(fresh); // v413 §2.6: the settled card's cluster wires here too
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
    // v448: the page-standing check reads the pushed bar
    // host's block key — the seat the retired .blockpage-head
    // lookup read before the head band retired.
    var pbar = document.getElementById('pushbar');
    if (!pbar || pbar.getAttribute('data-barblock') !== b.block) return;
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
          wireRowActs(el); // v413 §2.6
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
          wireRowActs(el2); // v413 §2.6
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
  var payload = { engine: 'web', trackId: cur.episodeId || '', kind: kind, title: title, subtitle: subtitle,
    block: cur.block || '', dateLabel: state.dateLabel || '', playing: playing, stopped: false,
    positionS: pos, durationS: dur, estimated: estimated,
    queueIndex: state.queueIdx, queueCount: state.queue.length, queueIds: queueIds,
    rate: audioEl.playbackRate || state.rate || 1, ts: Date.now() };
  // v397 §2.9: the failure fact rides only while it stands —
  // the key is omitted otherwise, so every non-failure push
  // keeps its standing byte shape.
  if (resumeFailedPending) payload.resumeFailed = true;
  // v412 Fix 3: the start-failure fact rides the same way — only
  // while it stands, omitted otherwise (byte shape preserved).
  if (startFailedPending) payload.startFailed = true;
  return payload;
}
function pushNativeState(stopped) {
  try {
    var p = oraBridgePlugin();
    if (!p || !p.setPlaybackState) return;
    var payload = nativeStatePayload(stopped);
    if (!payload) return;
    var r = p.setPlaybackState({ state: JSON.stringify(payload) });
    // v397 §2.9: one-shot consumption — a payload that carried
    // the fact has been handed to the bridge, so the flag
    // clears. If the hand-off itself throws before the call is
    // issued, the catch below leaves the flag standing for the
    // next push; a report lost past this point degrades to
    // today's silence, never worse.
    if (payload.resumeFailed) resumeFailedPending = false;
    if (payload.startFailed) startFailedPending = false; // v412 Fix 3: one-shot, as above
    if (r && r.catch) r.catch(function () {});
  } catch (e) { /* the bridge can never fail playback */ }
}
/* v397 §2.9: a rejected resume play() is reported on the
   standing push channel at once — it does not wait for the
   5 s interval push. */
var resumeFailedPending = false;
function noteResumeFailed() {
  resumeFailedPending = true;
  pushNativeState(false);
}
/* v412 Fix 3: a rejected START is reported on the same standing
   push channel as a rejected resume — the startFailed fact, one
   shot, consumed by the push that carries it. */
var startFailedPending = false;
function noteStartFailed() {
  startFailedPending = true;
  pushNativeState(false);
}
function onStartRejected(desc) {
  // v412 Fix 3: the start rejection's recovery — report the fact,
  // then recover ONCE: the descriptor re-resolves against the
  // live build (queueLiveDesc — the standing seam) and restarts.
  // A second rejection for the SAME start (episode at queue
  // index; a successful 'play' clears the key) passes over
  // exactly as a missing entry passes over: the queue advances
  // in a queue; a single play stops paused with its card showing
  // why. A rejection for a descriptor that is no longer current
  // is not this start's failure and is ignored.
  if (!desc || state.current !== desc) return;
  noteStartFailed();
  var key = desc.episodeId + '@' + (state.queue.length ? state.queueIdx : 'single');
  if (state.startRetryKey === key) {
    state.startRetryKey = null;
    flashPassOver(desc);
    if (state.queue.length) { advanceQueue(1); return; }
    try { audioEl.pause(); } catch (e) {}
    setPlaybackState('paused');
    return;
  }
  state.startRetryKey = key;
  var live = queueLiveDesc(desc);
  startDesc(live && live.url ? live : desc);
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
function previousWithRule() {
  // v412 Fix 8: THE Previous rule — one implementation for every
  // surface (the bridge command, the web media session, Now
  // Playing, the dock): with a queue standing, > 3 s in restarts
  // the track, else the previous queue entry. With no queue
  // standing, Previous is inert on every surface — a single play
  // has no previous to go to (§1.2's decided end state; the
  // bridge's former single-play restart retires into the one
  // rule). The rule reads the element.
  if (!state.queue.length) return;
  if (state.current && (audioEl.currentTime || 0) > 3) { audioEl.currentTime = 0; return; }
  advanceQueue(-1);
}
function seekBy(deltaS) {
  // v412 Fix 12: the one seek-step implementation — the standing
  // system handlers' clamp math, extracted whole: forward clamps
  // at the duration, backward at zero. The Now Playing ±10 s
  // buttons call it with ±10; the system handlers pass their
  // seekOffset through it unchanged.
  if (deltaS >= 0) audioEl.currentTime = Math.min((audioEl.duration || 0), (audioEl.currentTime || 0) + deltaS);
  else audioEl.currentTime = Math.max(0, (audioEl.currentTime || 0) + deltaS);
}
function bridgePrevious() {
  // B3 previous — v412 Fix 8: the bridge reads the one rule.
  previousWithRule();
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
/* ---------------- v421: the Android system back binding ----------------
   The shell's App plugin (@capacitor/app, §2.6) delivers
   every system back press to ONE 'backButton' listener
   registered here at boot. With a listener standing, the
   plugin does not fall through to any platform default —
   it notifies the listener INSTEAD (and ALSO fires a
   'backbutton' document event off the same press: that
   route is expressly NOT bound — one press bound twice
   would go back two levels, §2.5/F-421-4). The handler is
   a pure dispatch on the standing view state; it reads
   no history, calls no history API, and ignores the
   event's canGoBack — the view state governs, never the
   WebView history (F-421-3). On the web (no Capacitor,
   or no App plugin) registration is a no-op and browser
   behavior is byte-unchanged. */
function oraAppPlugin() {
  try {
    var cap = window.Capacitor;
    if (!cap || !cap.Plugins || !cap.Plugins.App) return null;
    return cap.Plugins.App;
  } catch (e) { return null; }
}
function handleSystemBack() {
  // 1. Overlay first (F-421-5): a standing sheet or
  // anchored menu dismisses by its OWN close path — a
  // sheet by sheet.remove() (mountDrawer's standing
  // close), a menu by the standing menu close — before
  // any page arm. Back first does what a scrim tap does.
  var overlay = document.querySelector('.sheet, .anchmenu');
  if (overlay) {
    if (overlay.classList.contains('sheet')) overlay.remove();
    else document.querySelectorAll('.anchmenu, .menucatcher').forEach(function (n) { n.remove(); });
    return;
  }
  // 2. Block arm: the disc's own handler with the disc's
  // own argument — the [data-back] wiring calls
  // goListenHome(block name), and the view state carries
  // that same block name. The From Today's Podcast page
  // rides this same arm ('__episodes' is a block view).
  if (state.tab === 'prayers' && state.prayersView && state.prayersView.kind === 'block') {
    goListenHome(state.prayersView.block);
    return;
  }
  // 3a. Watch arm (v434 §2.6.2 seat 1): the Podcasts watch
  // view's back act is closeWatch — the same function the
  // back disc's tap calls (one act, two triggers).
  if (state.tab === 'podcasts' && podLevel === 'watch') {
    closeWatch();
    return;
  }
  // 3. Series arm (D-421-1): the Podcasts series page
  // carries the identical disc with identical one-level
  // semantics; its act is goPodcastsIndex — the same
  // function the disc's tap calls.
  if (state.tab === 'podcasts' && podLevel === 'series') {
    goPodcastsIndex();
    return;
  }
  // 4. Root (F-421-1): a top-level page — nothing in the
  // reach stands, so the handler reproduces the standing
  // Android default itself: exitApp() finishes the
  // activity, the result root back has always produced
  // in this shell.
  var app = oraAppPlugin();
  if (app && app.exitApp) { try { app.exitApp(); } catch (e) {} }
}
function setupBackButton() {
  try {
    var app = oraAppPlugin();
    if (!app || !app.addListener) return;
    app.addListener('backButton', handleSystemBack);
  } catch (e) { /* no plugin, no binding — the web path is unchanged */ }
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
  return '<div class="card trow" data-card="' + esc(row.episodeId) + '" data-skeleton="1"><h3>' + esc(row.title) + '</h3><span class="skelbar" style="width:55%"></span><span class="skelbar" style="width:35%"></span></div>'; // v419 (SK-9)
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
    wireRowActs(el); // v413 §2.6
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
    // v417 §2.7 (FD6): the updater re-forms to the card's new
    // state line — the caption segment stands nowhere on the
    // grid card (it survives as the block page head's
    // description); the count is the line's tail.
    el.textContent = (counts[b] || 0) + ' tracks';
  });
  // v413 §2.10 (FD4): the block page's meta line rides the same
  // settlement seam — "<N> episodes · <total duration>", the
  // total the sum of the block's resolved descriptors'
  // durations; a block with NO standing duration shows the
  // count only, never a fabricated total.
  var durSums = {};
  (state.dayDescs || []).forEach(function (d) {
    if (d.block && d.durationS) durSums[d.block] = (durSums[d.block] || 0) + d.durationS;
  });
  view.querySelectorAll('[data-bmeta]').forEach(function (el) {
    var b = el.getAttribute('data-bmeta');
    el.textContent = (counts[b] || 0) + ' episodes' + (durSums[b] ? ' \u00b7 ' + fmtDurLong(durSums[b]) : '');
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
  // v431 §2.3: the card's simple form — the resume target whole
  // on line 1 (the duplicating h3 + "Continue — " prefix retire),
  // the progress count verbatim on line 2 with See queue seated
  // at its end. "Play everything instead" retires at John's word
  // (§1.6); its listener retires with the emission.
  slot.innerHTML = '<div class="card"><div class="row"><div class="grow">'
    + '<div class="meta">' + esc(blockLabel) + ' · ' + esc(named.title) + '</div>'
    + '<div class="meta">' + playedN + ' of ' + prayers.length + ' heard today · <a href="#" id="continue-queue">See queue</a></div></div>'
    + '<button class="btn gold small" id="continue-btn">Continue</button></div></div>';
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
      return put.then(function () { finish(mintBlobUrl(ownBlobOwner(cacheKey), blob)); }); // v412 Fix 11: the cache key's owner holds the mint
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
      finish(mintBlobUrl(ownBlobOwner(cacheKey), blob)); // v412 Fix 11: the cache key's owner holds the mint
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
function aiSettleSwap(entry) {
  // v451 §2.4: the v430 swap, re-seated at the only paint that
  // plays the show now — the own series page. The ONE track that
  // always played as a live network stream takes the device-
  // local copy the v392 pass puts on the phone, under the SAME
  // day key the pass stores it (opn-ext-audio-v1). The stream
  // stands until the copy lands (the fallback order); the swap
  // never touches a live playing element — the series page's
  // descriptors are built from what stands resolved at tap time
  // (podOwnDesc reads the mint below), so a copy landing after
  // the paint is taken by the next tap, exactly as the block
  // page's swap behaved. Fire-and-forget: a cache miss or a
  // stalled read simply leaves the stream standing (Trigger B
  // or the next paint retries). Two triggers, as v430 named
  // them: Trigger A — this paint, with the today entry in hand;
  // Trigger B — the offline pass landing the presented day's
  // copy mid-session (offlineDownloadItems), which calls with
  // no entry and reads the today entry from the own payload.
  // The settle verifies, as v430 §2.5 ruled: a standing copy
  // short of the entry's server-measured sizeBytes never
  // becomes a play source; the pass's repair owns the copy.
  var date = todayChicago();
  var owner = ownBlobOwner(offlineDayKey(date, 'the-ai-signal'));
  if (owner.blobUrl) return Promise.resolve(); // the once-guard: a second fire never re-mints
  var withEntry = function (e) {
    if (!e || e.date !== date) return Promise.resolve();
    return offlineAudioCache().then(function (cache) {
      if (!cache) return;
      return cache.match(offlineDayKey(date, 'the-ai-signal')).then(function (resp) {
        if (!resp) return;
        return resp.blob().then(function (blob) {
          if (!blob) return;
          if (owner.blobUrl) return; // the guard re-read after the async seam
          if (e.sizeBytes > 0 && blob.size !== e.sizeBytes) return;
          mintBlobUrl(owner, blob);
        });
      });
    }).catch(function () {});
  };
  if (entry) return withEntry(entry);
  return api('/api/player/podcasts?series=the-ai-signal').then(function (res) {
    var e = null;
    ((res && res.entries) || []).forEach(function (x) { if (x.date === date) e = x; });
    return withEntry(e);
  }).catch(function () {});
}
function resolveExternals(day, settingsOverride, snapshotRec) {
  // v337 §2.4: resolution keys on the PRESENTED day (the payload's
  // presentedDay; its date field carries the same day). storedDay
  // is the produced fact and no longer keys any consumption path.
  var date = day.presentedDay || day.date;
  if (!date) return;
  // v451 §2.3: no shell claim stands here any more — the day
  // payload carries no AI Signal block (the show stands in
  // Formation as a registry entry), so no paint path can stand
  // the episode on the Prayers side at all.
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
        state.extSlots[slot.slotId] = { state: 'downloading', title: c.title, enclosureUrl: c.streamUrl, durationSec: c.durationSec, sizeBytes: c.sizeBytes, source: c.source, imageUrl: c.imageUrl || null, descText: c.descText || null };
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
          rec.slots[slot.slotId] = { state: 'present', title: st.title, streamUrl: st.enclosureUrl || st.streamUrl, durationSec: st.durationSec, sizeBytes: st.sizeBytes, source: st.source, block: slot.block, sortOrder: slot.sortOrder, imageUrl: st.imageUrl || null, descText: st.descText || null };
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
        var u = mintBlobUrl(extSlotOwner(slot), blob); // v412 Fix 11: the slot's owner holds the mint; the record carries it as blobUrl
        settle(slot, { state: 'present', title: meta.title, streamUrl: u, blobUrl: u, enclosureUrl: meta.enclosureUrl, durationSec: meta.durationSec, sizeBytes: meta.sizeBytes, source: meta.source, imageUrl: meta.imageUrl || null, descText: meta.descText || null });
      }).catch(function () {
        settle(slot, { state: 'missing', title: meta.title, source: meta.source });
      });
    };
    var settleMeta = function (slot, meta) {
      var cur = state.extSlots[slot.slotId];
      if (cur && cur.state === 'present' && cur.enclosureUrl === meta.enclosureUrl) return;
      state.extSlots[slot.slotId] = { state: 'downloading', title: meta.title, enclosureUrl: meta.enclosureUrl, durationSec: meta.durationSec, sizeBytes: meta.sizeBytes, source: meta.source, imageUrl: meta.imageUrl || null, descText: meta.descText || null };
      extSwapCard(slot);
      extRebuildDescs(day);
      extDownload(slot, meta);
    };
    var extRestoreCached = function (slot) {
      var c = rec.slots[slot.slotId];
      var meta = { title: c.title, enclosureUrl: c.streamUrl, durationSec: c.durationSec, sizeBytes: c.sizeBytes, source: c.source, imageUrl: c.imageUrl || null, descText: c.descText || null };
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
          var u = mintBlobUrl(extSlotOwner(slot), blob); // v412 Fix 11: the slot's owner holds the mint; the record carries it as blobUrl
          settle(slot, { state: 'present', title: meta.title, streamUrl: u, blobUrl: u, enclosureUrl: meta.enclosureUrl, durationSec: meta.durationSec, sizeBytes: meta.sizeBytes, source: meta.source, imageUrl: meta.imageUrl || null, descText: meta.descText || null });
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
            settleMeta(slot, { title: slot.slotId === 'ext-bible-in-a-year' ? extBibleTitle({ title: e.title }, extMatchBibleDayN(date)) : e.title, enclosureUrl: e.streamUrl, durationSec: e.durationSec, sizeBytes: e.sizeBytes, source: src, imageUrl: e.imageUrl || null, descText: e.descText || null });
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
        if (it) settleMeta(saintSlot, { title: it.title || saintSlot.title, enclosureUrl: it.url, durationSec: it.durationS, sizeBytes: it.length, source: saintSlot.source, imageUrl: it.imageUrl || null, descText: it.descText || null });
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
        if (it) settleMeta(tvMassSlot, { title: it.title || tvMassSlot.title, enclosureUrl: it.url, durationSec: it.durationS, sizeBytes: it.length, source: tvMassSlot.source, imageUrl: it.imageUrl || null, descText: it.descText || null });
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
        if (c) extDownload(slot, { title: c.title, enclosureUrl: c.streamUrl, durationSec: c.durationSec, sizeBytes: c.sizeBytes, source: c.source, imageUrl: c.imageUrl || null, descText: c.descText || null });
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
          if (it) settleMeta(slot, { title: slot.title, enclosureUrl: it.url, durationSec: it.durationS, sizeBytes: it.length, source: 'Sing the Hours', imageUrl: it.imageUrl || null, descText: it.descText || null });
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

/* v410 §2.4: renderPrayers is the Prayers TAB container
   (toggle + side host); the standing body below is the
   Prayers SIDE render, renamed renderPrayersSide. Its body,
   fetches, and paint (into the side host) stand unchanged. */
function renderPrayers() { paintMergedContainer('prayers'); }
function renderPrayersSide() {
  view.innerHTML = skelHtml('prayers'); // v419 (SK-1/G27): the loading paint IS the Prayers geometry (the loaded h1 reads Prayers)
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
    // (tab return, reload) always lands home.
    state.prayersView = { kind: 'home' };
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
    if (snap) { drainPodMarkQueue(); drainPodPositions(); } // v395 §2.7: the position drain rides the mark drain's open moment
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
function offlineSnapshotStore(date, day, settings, extRec, epoch) {
  if (epoch != null && epoch !== offlineEpoch) return Promise.resolve();
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
    // v419 (G22): the authored failure + a Ghost Retry wired
    // to this surface's own re-render.
    view.innerHTML = '<h1 class="screen">Prayers</h1><p class="err">Today&rsquo;s prayers did not load.</p><p><button class="btn ghost" id="day-retry">Retry</button></p>';
    document.getElementById('day-retry').addEventListener('click', renderPrayersSide);
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
function offlineAiItem(date) {
  // v451 §2.4: today's AI Signal download item, read from the
  // own series payload — the registry entry is the show's
  // standing read now (the day payload carries no block for it
  // and the own-slot enumeration retired with the slot). The
  // item keeps its standing kind-'ai' shape, so the pass's size
  // check (§2.5) and the settle swap keep their seats; a day
  // with no present episode enumerates no item.
  return api('/api/player/podcasts?series=the-ai-signal').then(function (res) {
    var e = null;
    ((res && res.entries) || []).forEach(function (x) { if (x.date === date) e = x; });
    if (!e) return null;
    return { kind: 'ai', date: date, id: 'the-ai-signal', enclosureUrl: e.streamUrl, sizeBytes: e.sizeBytes || 0, key: offlineDayKey(date, 'the-ai-signal') };
  }).catch(function () { return null; });
}
function offlineEnumerateToday(date) {
  var items = [];
  (state.ownStanding || []).forEach(function (row) {
    var st = state.ownSlots[row.sourceKey];
    if (!st || st.state !== 'present') return;
    (st.tracks || []).forEach(function (t) {
      // v451 §2.4: the shellResolved ('ai') branch retires with
      // the own-slot machinery — today's AI Signal item is
      // enumerated from the own series payload instead
      // (offlineAiItem, joined by the pass in offlineCompleteness).
      if (t.enclosureUrl) items.push({ kind: 'own', date: date, id: t.episodeId, enclosureUrl: t.enclosureUrl, key: offlineDayKey(date, t.episodeId) });
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
function offlineTomorrowBuild(tomorrow, epoch) {
  var settings = state.offlineSettings;
  if (!settings) return Promise.resolve(null);
  return api('/api/player/day?date=' + encodeURIComponent(tomorrow)).then(function (day) {
    var extRec = { date: tomorrow, settingsVersion: settings.version, savedAt: new Date().toISOString(), slots: {}, own: {}, intentions: null };
    var items = [];
    // v451 §2.4: the day-blocks scan for 'ai' items retires —
    // it read the shell-filled AI Signal block (the one block
    // whose payload tracks ever stood non-empty), and that fill
    // retired with the block. Tomorrow's AI Signal copy
    // pre-stage retires with it: the episode is a Formation
    // entry now, and its copy lands when its day becomes today
    // (offlineAiItem in the today leg above).
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
      var stored = offlineSnapshotStore(tomorrow, day, settings, extRec, epoch);
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
    // v430 Trigger B (§2.4): a kind-'ai' item that resolves
    // stored fires the settle swap for the PRESENTED day — the
    // pass landing the copy mid-session swaps the slot's play
    // source without a reload. Tomorrow's item and any non-
    // presented date no-op here (no slot stands for them; the
    // swap itself also reads only the presented day's key).
    var fireAiSwap = function (it) {
      var pd = state.dayPayload ? (state.dayPayload.presentedDay || state.dayPayload.date) : null;
      // v451 §2.4: Trigger B's seat is unchanged (the presented
      // day's ai item resolving stored); the swap itself now
      // reads the today entry from the own payload (aiSettleSwap
      // takes no day argument in its new seat).
      if (pd && it.key === offlineDayKey(pd, 'the-ai-signal')) aiSettleSwap();
    };
    items.forEach(function (it) {
      chain = chain.then(function () {
        // A clear (epoch bump) mid-pass stops the tail: no
        // further fetches, and a fetch already in flight never
        // puts — the clear wins over the pass (W6).
        if (epoch != null && epoch !== offlineEpoch) return;
        // v430 §2.5: the size check, scoped to kind 'ai' — its
        // sizeBytes is server-measured, so byte equality is a
        // sound test (the other families' feed-claimed sizes
        // keep the standing posture; the shared offlinePutBlob
        // stays untouched). A standing entry is read and
        // verified: a mismatch deletes it and falls through to
        // the fetch (a short copy from an earlier unchecked
        // build self-repairs). A fetched blob that mismatches
        // is NOT stored — the item counts missing and retries
        // next pass (the W3 posture). An ai item with
        // sizeBytes 0 skips the check, today's behavior exactly.
        if (it.kind === 'ai' && it.sizeBytes > 0 && cache) {
          return cache.match(it.key).then(function (resp) { return resp ? resp.blob() : null; }).catch(function () { return null; }).then(function (standing) {
            if (standing && standing.size === it.sizeBytes) { have++; fireAiSwap(it); return; }
            var repair = standing ? cache.delete(it.key).catch(function () {}) : Promise.resolve();
            return repair.then(function () {
              return offlineFetchItemAudio(it).then(function (blob) {
                if (epoch != null && epoch !== offlineEpoch) return false;
                if (!blob || blob.size !== it.sizeBytes) return false;
                return offlinePutBlob(cache, it.key, blob);
              }).then(function (okPut) { if (okPut) { have++; fireAiSwap(it); } }).catch(function () {});
            });
          });
        }
        return offlineCacheHas(cache, it.key).then(function (has) {
          if (has) { have++; if (it.kind === 'ai') fireAiSwap(it); return; }
          return offlineFetchItemAudio(it).then(function (blob) { if (epoch != null && epoch !== offlineEpoch) return false; return offlinePutBlob(cache, it.key, blob); })
            .then(function (okPut) { if (okPut) { have++; if (it.kind === 'ai') fireAiSwap(it); } }).catch(function () {});
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
      return offlineAiItem(today).then(function (aiItem) {
        var todayItems = offlineEnumerateToday(today);
        if (aiItem) todayItems.push(aiItem);
        return offlineDownloadItems(todayItems, epoch);
      }).then(function (r1) {
        if (stale()) throw new Error('offline pass superseded by a clear');
        var idx = offlineIndexRead();
        idx.days[today] = { have: r1.have, total: r1.total, settingsVersion: (state.offlineSettings || {}).version };
        offlineIndexWrite(idx);
        paintOfflineLine();
        return offlineTomorrowBuild(tomorrow, epoch).then(function (tb) {
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
  drainPodPositions(); // v395 §2.7: beside the mark queue's drain, same moment
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
/* v413 §2.9: the podcast row ⋮ — Share · the state-matched
   Download / Remove download (the standing podDlTap acts) ·
   Mark as listened / not listened. State reads podDlStateMap,
   kept fresh by refreshPodDlStates. */
var podDlStateMap = {};
function openPodRowMenu(key, anchorEl) {
  var res = state.podcasts;
  if (!res || !res.entries) return;
  var e = res.entries.filter(function (x) { return x.key === key; })[0];
  if (!e) return;
  var st = podDlStateMap[key] || {};
  var items = [{ label: 'Share', act: function () { openShareSheet({ artHtml: podRowArtHtml(e), title: e.title, line: 'Episode' + (e.durationS ? ' \u00b7 ' + fmtDur(e.durationS) : ''), url: e.url || location.origin + '/' }); } }];
  if (e.url && !st.standing) items.push({ label: 'Download', act: function () { podDlTap(key); } });
  else if (e.url && st.standing && st.manual) items.push({ label: 'Remove download', act: function () { podDlTap(key); } });
  items.push({ label: e.listened ? 'Mark as not listened' : 'Mark as listened', act: function () { podToggleMark(key); } });
  openSheetMenu(e.title, items, anchorEl);
}
function refreshPodDlStates() {
  // v413 §2.6: the Get button retires — this pass now writes
  // the rows' downloaded icons + the menu's state map, from
  // the same cache enumeration as before.
  var icons = view.querySelectorAll('[data-poddlstate]');
  if (!state.podcasts) return;
  var res = state.podcasts;
  var manual = podManualRead();
  offlineAudioCache().then(function (cache) {
    if (!cache) return;
    return cache.keys().then(function (reqs) {
      var standing = {};
      reqs.forEach(function (rq) { standing[rq.url] = 1; });
      (res.entries || []).forEach(function (e) {
        var pk = offlinePodKey(res.series, e.key);
        podDlStateMap[e.key] = { standing: !!standing[new URL(pk, location.href).href], manual: !!manual[pk], busy: !!podDlBusy[pk] };
      });
      icons.forEach(function (el) {
        var st = podDlStateMap[el.getAttribute('data-poddlstate')] || {};
        el.style.display = st.standing ? '' : 'none';
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
window.addEventListener('online', function () { drainPodMarkQueue(); drainPodPositions(); }); // v395 §2.7: the position drain shares the mark drain's online moment

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
  wireRowActs(view); // v413 §2.6: the row ⋮ + share wiring rides every Prayers paint
  refreshGridDlStates(); // v413 §2.11: the downloaded icons follow the cache's word
  // v448: the scan covers the pushed bar host too — the
  // block page's Play All stands in #pushbar now, outside
  // the side host. The handler is the standing one; every
  // wire pass follows a host refill on block pages, so no
  // button is ever wired twice.
  var queueBtns = Array.prototype.slice.call(view.querySelectorAll('[data-queue]'));
  var pbHost = document.getElementById('pushbar');
  if (pbHost) pbHost.querySelectorAll('[data-queue]').forEach(function (b) { queueBtns.push(b); });
  queueBtns.forEach(function (btn) {
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
function blockRowHtml(b) {
  // v449 §2 Build 1: the home block row — the Formation
  // series-row form (the shipped paintPodcastsIndex card:
  // .card > .row > the tile seat + .grow (the name as h3 ·
  // one .meta line)), one per line, full width. NO play
  // disc on the row (D1 settled) and NO chevron — the
  // shipped Formation row carries none (the main seat's
  // named correction to §2's mockup wording, recorded in
  // §3). The whole row taps open through the standing
  // [data-openblock] wiring. coverTileHtml stands in the
  // tile seat at its 'sm' size (the row's 44px art seat).
  // The meta line carries the standing spans (data-bcount /
  // data-bprayed, written by the standing updaters
  // unchanged; data-carddl, toggled by refreshGridDlStates
  // unchanged), the count, the duration summed from the
  // block's tracks (the episodes page's sum), and the
  // block's caption where it stands.
  var n = b.trackCount != null ? b.trackCount : (b.tracks || []).length;
  var dur = (b.tracks || []).reduce(function (a, t) { return a + (t.durationS || t.durationSec || 0); }, 0);
  return '<div class="card blockrow" data-openblock="' + esc(b.block) + '"><div class="row">'
    + coverTileHtml(b.block, 'sm')
    + '<div class="grow"><h3>' + esc(b.label || b.block) + '</h3>'
    + '<div class="meta">' + (b.caption ? esc(b.caption) + ' \u00b7 ' : '')
    + '<span data-bcount="' + esc(b.block) + '">' + n + ' tracks</span><span data-bprayed="' + esc(b.block) + '"></span>'
    + (dur > 0 ? ' \u00b7 ' + fmtDurLong(dur) : '')
    + ' <span class="dl-ico" data-carddl="' + esc(b.block) + '" style="display:none" title="Downloaded">\u2913</span></div></div></div></div>';
}
function episodesRowHtml(day) {
  // v449 §2 Build 1: the unblocked group stands as the last
  // home row, in the same series-row dress — it is not a
  // block and stands outside the manual order (its standing
  // seat, kept). Its tile keeps its standing teal tone +
  // glyph, emitted directly: coverTileHtml would read the
  // navy fallback for the '__episodes' key.
  var eps = day.episodes || [];
  var dur = eps.reduce(function (a, t) { return a + (t.durationS || t.durationSec || 0); }, 0);
  return '<div class="card blockrow" data-openblock="__episodes"><div class="row">'
    + '<div class="blockcover tone-teal sm"><span class="blockcover-initial">' + blockGlyphOf('__episodes') + '</span></div>'
    + '<div class="grow"><h3>From Today&rsquo;s Podcast</h3>'
    + '<div class="meta">' + eps.length + ' tracks' + (dur > 0 ? ' \u00b7 ' + fmtDurLong(dur) : '') + '</div></div></div></div>';
}
function shortHomeDate(day) {
  // v431 §2.1 (F-431-1): the home's date, shortened home-only and
  // derived client-side. prayerDateLabel and every payload stand
  // byte-untouched: the day payload's 'date' IS the Chicago
  // calendar date, so the UTC-noon derivation below returns the
  // identical calendar fields in short form ("Sat, Nov 14,
  // 2026") — weekday, month, day, and year all stand; nothing is
  // dropped. Every other surface (the Examination head, the
  // shell's litday fallback, the media album lines) keeps the
  // long form. Fallback: no usable 'date' → the standing label.
  var ds = day && day.date;
  if (ds) {
    var m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(String(ds));
    if (m) {
      var dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
      return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(dt);
    }
  }
  return (day && day.dateLabel) || 'the day&rsquo;s prayers';
}
function paintListenHome(day) {
  // v448: the home carries no bar — a returning paint
  // clears the pushed page's bar from its host.
  paintPrayersBar(null);
  // v431 §2.2 (F-431-6): the title + the short date share ONE
  // line — the .headrow (title left at its standing 22px, the
  // date right in its standing .sub dress). v419 (G27) stands:
  // the heading is still the tab's name.
  // v449 §2 Build 1: the home takes the Formation pattern —
  // the heading line carries the Sort act at its right (the
  // #sort-btn emission + its openBlockOrderEditor wiring
  // move up from the retired .searchrow, byte-identical;
  // the manual order itself stands), then the block rows,
  // one per line, and nothing else above the rows. The
  // .searchrow retires whole: the search pill, the filter
  // chips, and their wiring (D3 settled — search and chips
  // retire from the home). Play All + the offline line
  // stand BELOW the rows (§1's named call).
  var html = '<div class="row headrow"><h1 class="screen grow">Prayers</h1><p class="sub">' + esc(shortHomeDate(day)) + '</p>'
    + '<button class="btn ghost small" id="sort-btn" aria-label="Sort">↑↓</button></div>';
  html += '<div id="home-body">' + homeBodyHtml(day) + '</div>';
  html += '<div class="row"><button class="btn gold" id="play-all">Play All</button><span class="meta grow">the whole day, in order</span></div>';
  // v392 W5: the offline readiness line + the download button.
  html += offlineLineHtml('offline-dl-btn');
  view.innerHTML = html;
  // §2.4: the Play All wiring lives here — the element exists
  // only on home.
  document.getElementById('play-all').addEventListener('click', function () {
    // v344 §2.4: Play All skips played — the build passes the
    // played filter; a fully-played day plays in full (the
    // fallback stands by construction, never a dead button).
    startQueue(queueBuild(extRebuildDescs(day)));
  });
  document.getElementById('sort-btn').addEventListener('click', openBlockOrderEditor);
}
function homeBodyHtml(day) {
  // v449 §2 Build 1: the home body is the rows alone — the
  // Continue slot and the square-card grid retire with the
  // search surface (D3 settled; paintContinue then no-ops
  // on the home, its machinery untouched; searchResultsHtml
  // retires whole — its results paint served no other
  // surface). The blocks paint in the standing effective
  // order (orderedBlocks — the manual order underneath
  // unchanged, no filter narrowing it now), one series row
  // per line; the episodes group stands last, outside the
  // order, when the day carries episodes.
  var html = '';
  orderedBlocks(day).forEach(function (b) { html += blockRowHtml(b); });
  if ((day.episodes || []).length) html += episodesRowHtml(day);
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
  // v413 §2.5: the head re-forms to Mockup B's order — large
  // cover · title · description (the standing caption) · owner
  // row · the §2.10 meta line (data-bmeta, written by the
  // settlement seam) · download-all toggle + share icon · the
  // large round play button · the action row (Sort · Mark all
  // played · the page ⋮ — Open in Spotify's one home now, R4).
  // v420 §2.3: the head compresses inside the same frozen
  // element — Row 1: the back disc seated in the head (§2.4)
  // · the 56px cover (.blockcover.med) · the title/meta
  // stack (the caption folded into the meta line, §2.5; the
  // owner line and the prayed suffix leave the head — they
  // stand on the grid card + the rows, §2.3) · Row 2: the
  // pill line (the compact download chip + the folded note,
  // §2.6).
  // v422 §2.6: the Play All row retires as a line — the SAME
  // data-queue disc emission (44px under the .compact scope)
  // and the page ⋮ move into Row 1's trailing cluster (disc ·
  // ⋮ at the head's top right); the visible Play All label
  // retires as an emission (its rule stands for the episodes
  // page); Sort and Mark all played ride the ⋮ as before.
  // v448: the head band retires completely (John's word
  // closing the v447 field check). The bar stands in the
  // #pushbar host — the top slot, above the toggle — with
  // the SHRUNK Play All (the standing .playbtn.small form:
  // a 30px disc on a 44px tap, wholly inside the bar) and
  // the menu act in the bar's plain act dress (.iosbar-act,
  // no pill). The band's facts stand as one plain meta line
  // at the body's top; the download act + its note stand as
  // a plain row under it (their [data-blockdl] /
  // [data-blockdlnote] wiring is view-scoped and follows
  // the elements); the cover tile retires with the band.
  paintPrayersBar(iosBarHtml({ dest: 'Prayers', title: b.label || b.block, backAttrs: 'data-back="' + esc(b.block) + '"',
    rightHtml: '<button class="playbtn small" data-queue="' + esc(b.block) + '" aria-label="Play all of ' + esc(b.label || b.block) + '">&#9654;</button>'
      + '<button class="iosbar-act" data-blockmenu="' + esc(b.block) + '" aria-label="Playlist options">\u22ee</button>' }), b.block);
  // v455 §2 Build 1 (D1): the series-style head retires
  // completely — no cover tile, no name line; the bar
  // carries the block's name once. The body opens with
  // the meta as one plain line in the episodes page's
  // standing form (the data-bmeta span stands inside it,
  // its settlement writer unchanged; the duration joins
  // the line at first paint from the head-duration sum
  // below), then the download as plain body lines — the
  // text act ([data-blockdl], its wiring view-scoped and
  // unchanged) and its note ([data-blockdlnote]). The
  // retired forms' history stands in the release
  // documents.
  var headDur = (b.tracks || []).reduce(function (a, t) { return a + (t.durationS || t.durationSec || 0); }, 0);
  var html = '<div class="blockpage-meta">' + (b.caption ? esc(b.caption) + ' \u00b7 ' : '') + '<span data-bmeta="' + esc(b.block) + '">' + n + ' episodes' + (headDur > 0 ? ' \u00b7 ' + fmtDurLong(headDur) : '') + '</span></div>'
    + '<button class="blockpage-dlact" data-blockdl="' + esc(b.block) + '">Download all</button>'
    + '<div class="meta blockpage-dlnote" data-blockdlnote="' + esc(b.block) + '"></div>';
  // §2.3.2: the block's rows, rendered by trackCard exactly as
  // the flat paint rendered them.
  html += (b.tracks || []).map(function (t) { return trackCard(Object.assign({}, t, { _block: b.block })); }).join('');
  view.innerHTML = html;
  // v413 §2.5: the head's own controls wire here (the page ⋮,
  // Sort, share, and the download-all toggle — the standing
  // data-markblock/data-queue acts wire in the standing passes).
  // v420 §2.7: Sort + Mark all played + Share ride the page ⋮
  // (the anchored card); the head's share icon retires (Share
  // stands in the menu, its v413 home — §2.6).
  var dlBtn = view.querySelector('[data-blockdl]');
  if (dlBtn) dlBtn.addEventListener('click', function () { blockDownloadAll(b.block); });
  var openBlockShare = function () {
    openShareSheet({
      artHtml: coverTileHtml(b.block, 'sm'), title: b.label || b.block,
      line: 'Playlist \u00b7 ' + ((state.dayDescs || []).filter(function (d) { return d.block === b.block; }).length || n) + ' episodes',
      url: b.spotifyUrl || location.origin + '/'
    });
  };
  // v448: the page menu act stands in the bar host now, not
  // the side host — its wiring reads the host.
  var menuBtn = document.querySelector('#pushbar [data-blockmenu]');
  if (menuBtn) menuBtn.addEventListener('click', function () {
    var played = blockPlayedCounts(b.block);
    var items = [
      { label: 'Sort', act: function () { openBlockOrderEditor(); } },
      // §2.7: the mark-all item's label is computed here, at
      // menu construction (the menu rebuilds at every open,
      // so the label is fresh at open); its row takes
      // data-markblock after mount and wirePlayed binds the
      // standing mark-all act to it — the item's own act is
      // the menu's close only.
      { label: (played.total && played.played === played.total) ? 'Mark all unplayed' : 'Mark all played', act: function () {} },
      { label: 'Share', act: openBlockShare }
    ];
    if (b.spotifyUrl) items.push({ label: 'Open in Spotify', act: function () { window.open(b.spotifyUrl, '_blank', 'noopener'); } });
    // v455 §2 Build 2 (D3, as amended): the Go to group
    // appends AFTER the standing items — the Mark-all
    // wiring below reads [data-menuitem="1"] by position,
    // so nothing may insert ahead of the standing items.
    // One item per block of the day, in day order; the
    // standing block's item carries the 'Here' state and
    // the close-only act (the Mark-all pattern); the
    // episodes pseudo-page is not a block and stands
    // outside the list. Intentions stands last — its act
    // flips the Prayers tab to its Intentions side.
    (day.blocks || []).forEach(function (x) {
      if (x.block === '__episodes') return;
      if (x.block === b.block) items.push({ label: x.label || x.block, state: 'Here', act: function () {} });
      else items.push({ label: x.label || x.block, act: function () { openBlockPage(x.block); } });
    });
    items.push({ label: 'Intentions', act: function () { switchSide('prayers', 'intentions'); } });
    var card = openSheetMenu(b.label || b.block, items, menuBtn);
    var markRow = card ? card.querySelector('[data-menuitem="1"]') : null;
    if (markRow) { markRow.setAttribute('data-markblock', b.block); wirePlayed(card); }
  });
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
  // v413 §2.5: the same head form (cover · title · meta · the
  // big play button), with no Sort and no download-all — not a
  // block.
  var eps = day.episodes || [];
  var durSum = eps.reduce(function (a, t) { return a + (t.durationS || t.durationSec || 0); }, 0);
  // v448: the head band retires here too — the bar stands
  // in the #pushbar host (the top slot, above the toggle);
  // the meta stands as one plain line at the body's top and
  // the Play All row as a body row under it, as it stood in
  // the head; the cover tile retires with the band.
  paintPrayersBar(iosBarHtml({ dest: 'Prayers', title: 'From Today’s Podcast', backAttrs: 'data-back="__episodes"' }), '__episodes');
  var html = '<div class="blockpage-meta">' + eps.length + ' episodes' + (durSum > 0 ? ' · ' + fmtDurLong(durSum) : '') + '</div>'
    + '<div class="blockpage-playrow"><button class="playbtn big" data-queue="__episodes" aria-label="Play all of the podcast episodes">&#9654;</button><span class="blockpage-playlabel">Play All — From Today&rsquo;s Podcast</span></div>';
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

/* ---------------- Conscience (v410) ----------------
   The merged tab: ONE gate entry (renderConscience) over the
   standing machinery, and the container (renderConscienceContent)
   painting the toggle + side host. The two standing gate
   wrappers keep their names as SIDE repaints — every
   in-content caller (chips, mode switches, saves, the two
   editors) already calls them, and a repaint of the side
   inside the standing container is what those callers mean
   now (§2.5). */
function renderConscience() { gatedTabRender('conscience', renderConscienceContent); }
function renderConscienceContent() { paintMergedContainer('conscience'); }

/* ---------------- Examination ---------------- */
function renderExamination() { switchSide('conscience', 'examination'); }
/* v444 §2's follow math, extracted (v450): move the chips
   row by the smallest scrollLeft amount that puts its
   active chip fully inside the visible band (a chip wider
   than the band aligns its left edge). The row only; no
   page scroll. Shared by the pager follow and the v450
   entry follow — the math stands in one place. */
function followExamChip() {
  var followRow = view.querySelector('.examchips');
  var activeChip = followRow ? followRow.querySelector('.chip.active') : null;
  if (followRow && activeChip) {
    var chipL = activeChip.offsetLeft, chipR = chipL + activeChip.offsetWidth;
    var bandL = followRow.scrollLeft, bandR = bandL + followRow.clientWidth;
    if (activeChip.offsetWidth >= followRow.clientWidth) followRow.scrollLeft = chipL;
    else if (chipL < bandL) followRow.scrollLeft = chipL;
    else if (chipR > bandR) followRow.scrollLeft = chipR - followRow.clientWidth;
  }
}
function renderExaminationContent() {
  // v443 §2: the chips row keeps its place across repaints —
  // read the standing row's scrollLeft BEFORE any paint
  // replaces view.innerHTML (the skeleton paint below
  // destroys the row); the paint restores it onto the new
  // row. Preservation only: the row never auto-scrolls.
  // v450 §2: an entry paint is the one exception — when
  // this read stands null (no row to preserve), the paint
  // follows to the resolved active chip at its tail.
  var chipsRow = view.querySelector('.examchips');
  var chipsScroll = chipsRow ? chipsRow.scrollLeft : null;
  view.innerHTML = '<h1 class="screen">Tonight&rsquo;s examination</h1>' + skelHtml('conscience');
  api('/api/exam/today').then(function (data) {
    var run = data.run;
    var closed = run && run.state === 'closed';
    var cats = data.categories || [];
    var cat = state.examCat || data.focusCategory || cats[0];
    var prompts = (data.prompts || []).filter(function (p) { return p.category === cat; });
    var entriesByPrompt = {};
    (data.entries || []).forEach(function (e) { if (e.prompt_id) { (entriesByPrompt[e.prompt_id] = entriesByPrompt[e.prompt_id] || []).push(e); } });
    var customs = (data.entries || []).filter(function (e) { return !e.prompt_id && e.category === cat; });
    var html = '<div class="row"><div class="grow"><h1 class="screen">Tonight&rsquo;s examination</h1><p class="sub">' + esc(data.dateLabel || data.date) + '</p></div><button class="btn ghost small" id="ex-gear">Prompts</button></div>';
    // v445 §2: a closed run offers the new pass from the
    // head area — one solid act. Its tap starts a fresh run
    // for tonight and the page repaints open on the focus.
    // While a run stands open the button does not stand.
    if (closed) html += '<button class="btn" id="run-new" style="width:100%;margin:4px 0 10px">Start a new examination</button>';
    var dis = closed ? ' disabled' : '';
    // v444 §2 (v442's chips, widened): one chip per category
    // in the payload, in payload order, the resolved category
    // marked — EVERY category stands reachable, the Precepts
    // of the Church and the other non-commandment categories
    // included (v442 carried the commandments only). Exactly
    // ONE row that scrolls sideways (the .examchips rule in
    // ui.ts).
    if (cats.length) html += '<div class="chips examchips">' + cats.map(function (c) { return '<button class="chip' + (c === cat ? ' active' : '') + '" data-examcat="' + esc(c) + '" aria-pressed="' + (c === cat ? 'true' : 'false') + '"' + dis + '>' + esc(c) + '</button>'; }).join('') + '</div>';
    html += '<h2 class="sectionhead">' + esc(cat) + '</h2>';
    if (state.deepIdx >= prompts.length) state.deepIdx = 0;
    var p = prompts[state.deepIdx];
    if (p) {
      html += '<div class="card prompt" data-prompt="' + p.id + '"><div class="ptext">' + esc(p.text) + '</div><div class="meta" style="margin-top:6px">Tap to write an entry in your own words</div>' + entriesHtml(entriesByPrompt[p.id]) + entryFieldHtml(p, closed) + '</div>';
      // v444 §2b (John's 12:05 amendment): the next-question
      // button is the arrow alone (›, aria-label "Next
      // question") in its ghost dress — the labeled solid
      // Next section beside it reads the more distinct.
      html += '<div class="row"><button class="btn ghost" id="deep-prev"' + (state.deepIdx === 0 ? ' disabled' : '') + '>&#8249; Back</button><span class="meta grow" style="text-align:center">' + (state.deepIdx + 1) + ' of ' + prompts.length + '</span><button class="btn ghost" id="deep-next" aria-label="Next question"' + (state.deepIdx + 1 >= prompts.length ? ' disabled' : '') + '>&#8250;</button><button class="btn" id="deep-next-cat"' + (cats.indexOf(cat) + 1 >= cats.length ? ' disabled' : '') + '>Next section</button></div>';
    } else html += '<p class="meta">No prompts in this category.</p>';
    html += '<div class="card"><h3>Add your own — ' + esc(cat) + '</h3>' + (closed ? '<p class="meta">This run is closed.</p>' : '<textarea id="custom-text" placeholder="In your own words..."></textarea><p class="fieldnote" id="fn-custom-text"></p>' + kindSwitchHtml('kind-custom') + '<div style="margin-top:8px"><button class="btn gold" id="custom-add">Add entry</button></div>') + customs.map(function (e) { return entryHtml(e); }).join('') + '</div>';
    html += '<div class="card"><h3>Anything else</h3><p class="meta">Close the night: anything that weighs on you, and a resolution for tomorrow.</p>' + (closed ? '' : '<textarea id="free-text" placeholder="In your own words..."></textarea><p class="fieldnote" id="fn-free-text"></p>' + kindSwitchHtml('kind-free') + '<div style="margin-top:8px"><button class="btn gold" id="free-add">Add entry</button></div>') + (data.entries || []).filter(function (e) { return e.category === 'Anything else'; }).map(function (e) { return entryHtml(e); }).join('') + '</div>';
    if (!closed) html += '<button class="btn" id="run-close" style="width:100%">Close tonight&rsquo;s examination</button>';
    else html += '<p class="meta">Tonight&rsquo;s run is closed. Its entries stand in Confession preparation.</p>';
    html += '<p class="about">Examination of conscience after Fr. F. X. Lasance, My Prayer Book (Benziger Brothers, 1908; public domain), pp. 347-349 — seeded verbatim; every prompt is editable (Prompts, above). Entries are never read by any job and never leave this app.</p>';
    view.innerHTML = html;
    // v443 §2: restore the chips row's place onto the new
    // row (the read stands at this function's head).
    if (chipsScroll !== null) { var newChipsRow = view.querySelector('.examchips'); if (newChipsRow) newChipsRow.scrollLeft = chipsScroll; }
    // v450 §2: an entry paint has no standing row to
    // preserve (the head read stood null — first entry,
    // tab entry, or re-entry after the Confession side
    // painted): the row follows to the resolved active
    // chip, so the day's selected section stands in view
    // when the page opens. The math is v444's, shared in
    // followExamChip. The two follows never both fire on
    // one paint: a pager paint always has a standing row,
    // so its head read never stands null.
    if (chipsScroll === null) followExamChip();
    // v444 §2: a pager-driven category change (the Next
    // section act sets examFollowActive) brings the newly
    // active chip into view — AFTER the v443 restore above,
    // the shared follow (followExamChip) moves the row by
    // the smallest amount that puts the active chip fully
    // inside the visible band (the row only; no page
    // scroll). Chip taps never set the flag: their scroll
    // stands exactly as restored.
    if (state.examFollowActive) {
      state.examFollowActive = false;
      followExamChip();
    }
    wireExamination(data);
  }).catch(function (e) { if (pinRefusalGate('conscience', renderConscienceContent, e)) return; view.innerHTML = '<p class="err">This page did not load.</p><p><button class="btn ghost" id="con-retry">Retry</button></p>'; document.getElementById('con-retry').addEventListener('click', renderConscienceContent); });
}
function entriesHtml(list) { return (list || []).map(entryHtml).join(''); }
function entryHtml(e) {
  // v453 §2 (D2 A): a reflection stands in place in the
  // reflection dress; a sin renders as before.
  if (e.kind === 'reflection') return reflectionEntryHtml(e, false);
  return '<div class="entry">' + esc(e.text) + '<div class="meta">' + esc((e.created_at || '').slice(11, 16)) + ' <a href="#" data-del-entry="' + e.id + '">remove</a></div></div>';
}
/* v453 §2: the reflection dress — the gold-left card with
   the REFLECTION tag (the package's Screen B form). One
   renderer serves both seats: the Examination in place
   (withCategory false — time + the remove link) and the
   Spiritual Direction page (withCategory true — category
   + time, no remove: §1 consequence 3). */
function reflectionEntryHtml(e, withCategory) {
  return '<div class="entry refl"><span class="refltag">REFLECTION</span><div>' + esc(e.text) + '</div><div class="meta">'
    + (withCategory ? esc(e.category || '') + ' · ' : '')
    + esc((e.created_at || '').slice(11, 16))
    + (withCategory ? '' : ' <a href="#" data-del-entry="' + e.id + '">remove</a>')
    + '</div></div>';
}
/* v453 §2 (D1 A): ONE kind-switch fragment for all three
   entry forms — a two-way segmented control in the standing
   .segtoggle dress, Sin standing selected. Each form's save
   reads its own switch by id (kindOf) and carries the
   standing value as the POST's kind. */
function kindSwitchHtml(id) {
  return '<div class="segtoggle kindswitch" id="' + id + '">'
    + '<button data-kind="sin" class="active">Sin</button>'
    + '<button data-kind="reflection">Reflection</button></div>';
}
function kindOf(id) {
  var el = document.getElementById(id);
  return (el && el.querySelector('[data-kind="reflection"].active')) ? 'reflection' : 'sin';
}
function wireKindSwitches() {
  view.querySelectorAll('.kindswitch').forEach(function (sw) {
    sw.querySelectorAll('[data-kind]').forEach(function (b) {
      b.addEventListener('click', function () {
        sw.querySelectorAll('[data-kind]').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
      });
    });
  });
}
function entryFieldHtml(p, closed) {
  if (closed) return '';
  return '<div class="entryform hidden" id="ef-' + p.id + '"><textarea id="et-' + p.id + '" placeholder="In your own words..."></textarea><p class="fieldnote" id="fn-et-' + p.id + '"></p>' + kindSwitchHtml('kind-ef-' + p.id) + '<div style="margin-top:6px"><button class="btn gold small" data-save-entry="' + p.id + '">Save entry</button></div></div>';
}
function wireExamination(data) {
  var run = data.run;
  var cat = state.examCat || data.focusCategory || (data.categories || [])[0];
  var pv = document.getElementById('deep-prev'), nx = document.getElementById('deep-next');
  if (pv) pv.addEventListener('click', function () { state.deepIdx--; renderExamination(); });
  if (nx) nx.addEventListener('click', function () { state.deepIdx++; renderExamination(); });
  // v444 §2 (v443's second next, category-general): the
  // solid button crosses to the next category in the full
  // payload order (the chips' order, every category — the
  // Precepts follow Commandment X); its first question
  // stands (deepIdx resets), the repaint runs through the
  // standing render path, and the act marks the change
  // pager-driven so the paint brings the new chip into view.
  var nc = document.getElementById('deep-next-cat');
  if (nc) nc.addEventListener('click', function () {
    var order = data.categories || [];
    var nxt = order[order.indexOf(cat) + 1];
    if (nxt) { state.examCat = nxt; state.deepIdx = 0; state.examFollowActive = true; renderExamination(); }
  });
  // v442 §2: a chip tap jumps to that category — its
  // first question stands (deepIdx resets), the repaint
  // runs through the standing render path. v444: the tap
  // never sets examFollowActive — no auto-scroll on a tap.
  view.querySelectorAll('[data-examcat]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.examCat = b.getAttribute('data-examcat');
      state.deepIdx = 0;
      renderExamination();
    });
  });
  view.querySelectorAll('.prompt').forEach(function (card) {
    card.addEventListener('click', function (ev) {
      if (ev.target.tagName === 'TEXTAREA' || ev.target.tagName === 'BUTTON' || ev.target.tagName === 'A') return;
      var f = card.querySelector('.entryform'); if (f) f.classList.toggle('hidden');
    });
  });
  view.querySelectorAll('[data-save-entry]').forEach(function (b) {
    b.addEventListener('click', function () {
      var pid = Number(b.getAttribute('data-save-entry'));
      var text = document.getElementById('et-' + pid).value.trim();
      if (!text) { fieldNote('fn-et-' + pid, 'Write the entry first.'); return; }
      var prompt = (data.prompts || []).filter(function (p) { return p.id === pid; })[0];
      post('/api/exam/entries', { runId: run.id, promptId: pid, category: prompt.category, text: text, kind: kindOf('kind-ef-' + pid) }).then(function () {
        placeSkip['et-' + pid] = true; // v411 §2.10 (2.2e): the saved draft drops at the switchSide capture
        renderExamination();
      });
    });
  });
  var ca = document.getElementById('custom-add');
  if (ca) ca.addEventListener('click', function () {
    var text = document.getElementById('custom-text').value.trim();
    if (!text) { fieldNote('fn-custom-text', 'Write the entry first.'); return; }
    post('/api/exam/entries', { runId: run.id, promptId: null, category: cat, text: text, kind: kindOf('kind-custom') }).then(function () {
      placeSkip['custom-text'] = true;
      renderExamination();
    });
  });
  var fa = document.getElementById('free-add');
  if (fa) fa.addEventListener('click', function () {
    var text = document.getElementById('free-text').value.trim();
    if (!text) { fieldNote('fn-free-text', 'Write the entry first.'); return; }
    post('/api/exam/entries', { runId: run.id, promptId: null, category: 'Anything else', text: text, kind: kindOf('kind-free') }).then(function () {
      placeSkip['free-text'] = true;
      renderExamination();
    });
  });
  wireKindSwitches(); // v453 §2: the three entry forms' kind switches
  wireFieldNotes();
  view.querySelectorAll('[data-del-entry]').forEach(function (a) {
    a.addEventListener('click', function (ev) { ev.preventDefault(); api('/api/exam/entries/' + a.getAttribute('data-del-entry'), { method: 'DELETE' }).then(renderExamination); });
  });
  var rc = document.getElementById('run-close');
  if (rc) rc.addEventListener('click', function () { openConfirm({ line: 'Close the examination for tonight?', commitLabel: 'Close examination', act: function () { post('/api/exam/runs/' + run.id + '/close', {}).then(renderExamination); } }); });
  // v445 §2: the new-pass act (it stands only on a closed
  // run) — the route starts a fresh run only when tonight's
  // latest stands closed; the repaint re-reads the day and
  // opens on tonight's focus (examCat/deepIdx reset — a
  // fresh pass, none of the closed pass's place kept).
  var rn = document.getElementById('run-new');
  if (rn) rn.addEventListener('click', function () { state.examCat = null; state.deepIdx = 0; post('/api/exam/runs', {}).then(renderExamination); });
  var gear = document.getElementById('ex-gear');
  if (gear) gear.addEventListener('click', function () { openPromptsEditor(data.prompts || []); });
}
function openPromptsEditor(prompts) {
  var sheet = document.createElement('div'); sheet.className = 'sheet';
  var rows = prompts.map(function (p) {
    return '<label class="f">' + esc(p.category) + '</label><textarea data-prompt-edit="' + p.id + '">' + esc(p.text) + '</textarea>';
  }).join('');
  sheet.innerHTML = '<div class="inner"><div class="row"><h1 class="screen grow">Examination prompts</h1></div><p class="meta">Seeded verbatim from Lasance, My Prayer Book (1908). Edit any prompt in your own words; the seed source stays on the record.</p>' + rows + '<p class="fieldnote" id="pe-note"></p><div style="margin-top:14px"><button class="btn gold" id="pe-save">Save prompts</button></div></div>';
  document.body.appendChild(sheet);
  mountDrawer(sheet, true); // v419: TALL drawer \u2014 the header Close retires
  sheet.querySelector('#pe-save').addEventListener('click', function () {
    // v411 §2.6 (4.3): the failure branch, same three parts as
    // every editor sheet.
    var btn = sheet.querySelector('#pe-save');
    btn.disabled = true;
    var updates = []; sheet.querySelectorAll('[data-prompt-edit]').forEach(function (t) { updates.push({ id: Number(t.getAttribute('data-prompt-edit')), text: t.value }); });
    api('/api/exam/prompts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompts: updates }) })
      .then(function () { sheet.remove(); renderExamination(); })
      .catch(function () { btn.disabled = false; sheet.querySelector('#pe-note').textContent = 'That did not save. Your text is still here \u2014 try again.'; });
  });
}

/* ---------------- Confession ---------------- */
function renderConfession() { switchSide('conscience', 'confession'); }
function renderDirection() { switchSide('conscience', 'direction'); }
/* v453 §2: the standing long date form, client-side — the
   same construction prayerDateLabel uses server-side
   (weekday + month + day + year, America/Chicago). */
function longDateLabel(date) {
  var p = (date || '').split('-').map(Number);
  if (p.length !== 3 || !p[0]) return date || '';
  var dt = new Date(Date.UTC(p[0], p[1] - 1, p[2], 12));
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(dt);
}
/* v453 §2 (Amendment 2): the third Conscience side — the
   reflections gather here, all of them, across passes,
   grouped by day, newest day first, as Confession gathers
   the sins. No delete stands on this page (§1 consequence
   3). The PIN refusal routes through the standing gate as
   the other sides do. */
function renderDirectionContent() {
  view.innerHTML = '<h1 class="screen">Spiritual Direction</h1>' + skelHtml('conscience');
  api('/api/exam/reflections').then(function (d) {
    var html = '<div class="row"><div class="grow"><h1 class="screen">Spiritual Direction</h1><p class="sub">reflections gathered from your examinations</p></div></div>';
    var groups = d.groups || [];
    if (!groups.length) html += '<div class="card"><p class="meta">No reflections yet. In the Examination, the entry form&rsquo;s switch marks an entry as a reflection; it gathers here.</p></div>';
    html += groups.map(function (g) {
      return '<h2 class="sectionhead">' + esc(longDateLabel(g.date)) + '</h2><div class="card">' + g.entries.map(function (e) { return reflectionEntryHtml(e, true); }).join('') + '</div>';
    }).join('');
    html += '<p class="about">Reflections are the examination entries you marked as reflections — counsel matter, not confession matter. They are never read by any job and never leave this app.</p>';
    view.innerHTML = html;
  }).catch(function (e) { if (pinRefusalGate('conscience', renderConscienceContent, e)) return; view.innerHTML = '<p class="err">This page did not load.</p><p><button class="btn ghost" id="con-retry">Retry</button></p>'; document.getElementById('con-retry').addEventListener('click', renderConscienceContent); });
}
function renderConfessionContent() {
  view.innerHTML = '<h1 class="screen">Confession</h1>' + skelHtml('conscience');
  api('/api/confession').then(function (c) {
    var html = '<div class="row"><div class="grow"><h1 class="screen">Confession</h1><p class="sub">preparation and guide</p></div><button class="btn ghost small" id="cf-gear">Guide</button></div>';
    html += '<div class="card"><h3>' + esc(c.elapsed || '') + '</h3>' + (c.lastConfession ? '<p class="meta">Last confession: ' + esc(c.lastConfession.date) + (c.lastConfession.note ? ' — ' + esc(c.lastConfession.note) : '') + '</p>' : '<p class="meta">No confession recorded yet in this app.</p>') + '</div>';
    html += '<h2 class="sectionhead">THE GUIDE</h2>';
    // v453 §2 (Amendment 1 + D3 A): step 2 paints COMPOSED —
    // the short preamble + the sins. The sins are the standing
    // preparation groups, moved into the step (the standalone
    // PREPARATION section below retires whole, so the sins
    // stand exactly once on the page). Every other step
    // paints its stored body as before.
    var confTotal = 0; (c.prep || []).forEach(function (g) { confTotal += g.entries.length; });
    var confEntryText = {};
    (c.prep || []).forEach(function (g) { g.entries.forEach(function (e) { confEntryText[e.id] = e.text; }); });
    function confPrepGroupsHtml() {
      return (c.prep || []).map(function (g) {
        return '<div class="card"><h3>' + esc(g.category) + ' <span class="count">' + g.entries.length + (g.entries.length === 1 ? ' entry' : ' entries') + (g.repeatPrompts ? ' · ' + g.repeatPrompts + ' repeated' : '') + '</span></h3>' + g.entries.map(function (e) { return '<div class="entry"><div class="row"><div class="grow">' + esc(e.text) + '</div><button class="btn ghost small" data-confdel="' + e.id + '">Delete</button></div><div class="meta">' + esc(e.date) + '</div></div>'; }).join('') + '</div>';
      }).join('');
    }
    html += (c.guide || []).map(function (g) {
      if (g.step_no === 2) {
        var pre = 'Bless me, Father, for I have sinned.' + (c.lastConfession ? ' ' + esc(c.elapsed || '') + '.' : '') + ' These are my sins:';
        return '<div class="card"><h3>' + g.step_no + ' · ' + esc(g.title) + '</h3><p style="margin:0;line-height:1.55;font-size:15px">' + pre + '</p>'
          + (confTotal ? '' : '<p class="meta" style="margin-top:8px">No sins stand ready — entries from your nightly examinations gather here.</p>')
          + '</div>' + (confTotal ? confPrepGroupsHtml() : '');
      }
      return '<div class="card"><h3>' + g.step_no + ' · ' + esc(g.title) + '</h3><p style="margin:0;line-height:1.55;font-size:15px">' + esc(g.body) + '</p></div>';
    }).join('');
    var pen = c.penance;
    html += '<h2 class="sectionhead">PENANCE</h2>';
    if (pen && pen.text && !pen.done_at) {
      html += '<div class="card"><h3>Your penance</h3><p style="margin:0 0 8px;line-height:1.55;font-size:15px">' + esc(pen.text) + '</p><button class="btn gold" id="pen-done">Penance complete</button></div>';
    } else if (pen && pen.text && pen.done_at) {
      html += '<div class="card"><p class="meta">The penance from ' + esc(pen.date) + ' is complete.</p></div>';
    } else {
      html += '<div class="card"><p class="meta">No penance stands open. After your next confession, record the penance here.</p><label class="f">Penance given</label><textarea id="pen-text" placeholder="The penance the priest assigned..."></textarea><p class="fieldnote" id="fn-pen-text"></p><div style="margin-top:8px"><button class="btn" id="pen-save">Save penance</button></div></div>';
    }
    // v453 §2: the standalone PREPARATION section stands
    // retired — its groups paint inside guide step 2 above
    // (the Plan's settlement, §1), so the sins stand once.
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
    if (ps) ps.addEventListener('click', function () {
      var t = document.getElementById('pen-text').value.trim();
      if (!t) { fieldNote('fn-pen-text', 'Write the penance first.'); return; }
      post('/api/confession/penance', { text: t }).then(function () {
        placeSkip['pen-text'] = true; // v411 §2.10 (2.2e)
        renderConfession();
      });
    });
    wireFieldNotes();
    document.getElementById('cf-made').addEventListener('click', function () {
      var date = document.getElementById('cf-date').value; var note = document.getElementById('cf-note').value.trim();
      if (!date) return;
      openConfirm({ line: 'Close the preparation list under a confession on ' + date + '?', commitLabel: 'Close list', act: function () { post('/api/confession/made', { date: date, note: note }).then(function () {
        placeSkip['cf-note'] = true; // v411 §2.4: the saved note is not a draft to resurrect
        renderConfession();
      }); } });
    });
    document.getElementById('cf-gear').addEventListener('click', function () { openGuideEditor(c.guide || []); });
    // v453 §2 (D3 A): each listed sin's Delete — the standing
    // confirmation first (its line names the entry's first
    // words), then the Confession-side delete route (it
    // stands on an open or a closed run), then the re-paint.
    view.querySelectorAll('[data-confdel]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-confdel');
        var text = confEntryText[id] || '';
        var first = text.split(' ').slice(0, 6).join(' ');
        if (first.length < text.length) first += '...';
        openConfirm({ line: 'Delete this entry? "' + first + '"', commitLabel: 'Delete', danger: true, act: function () { api('/api/confession/entries/' + id, { method: 'DELETE' }).then(renderConfession); } });
      });
    });
  }).catch(function (e) { if (pinRefusalGate('conscience', renderConscienceContent, e)) return; view.innerHTML = '<p class="err">This page did not load.</p><p><button class="btn ghost" id="con-retry">Retry</button></p>'; document.getElementById('con-retry').addEventListener('click', renderConscienceContent); });
}
function openGuideEditor(guide) {
  var sheet = document.createElement('div'); sheet.className = 'sheet';
  var rows = guide.map(function (g) {
    // v453 §2: step 2 carries no editable text — the page
    // composes it (the short preamble + the sins). The note
    // stands in its fields' place; the save below collects
    // only the fielded steps, so the stored step-2 row
    // stands untouched.
    if (g.step_no === 2) return '<label class="f">Step 2 — ' + esc(g.title) + '</label><p class="meta">Step 2 reads as the short preamble and your sins — the app composes it; it carries no editable text.</p>';
    return '<label class="f">Step ' + g.step_no + ' — title</label><input type="text" data-guide-title="' + g.step_no + '" value="' + esc(g.title) + '"><label class="f">Text</label><textarea data-guide-body="' + g.step_no + '">' + esc(g.body) + '</textarea>';
  }).join('');
  sheet.innerHTML = '<div class="inner"><div class="row"><h1 class="screen grow">Confession guide</h1></div><p class="meta">Seeded from Lasance, My Prayer Book (1908), Devotions for Confession, pp. 353-354. Editable in your own words.</p>' + rows + '<p class="fieldnote" id="ge-note"></p><div style="margin-top:14px"><button class="btn gold" id="ge-save">Save guide</button></div></div>';
  document.body.appendChild(sheet);
  mountDrawer(sheet, true); // v419: TALL drawer \u2014 the header Close retires
  sheet.querySelector('#ge-save').addEventListener('click', function () {
    // v411 §2.6 (4.3): the failure branch, same three parts as
    // every editor sheet.
    var btn = sheet.querySelector('#ge-save');
    btn.disabled = true;
    var steps = []; sheet.querySelectorAll('[data-guide-title]').forEach(function (t) {
      var n = t.getAttribute('data-guide-title');
      steps.push({ step_no: Number(n), title: t.value, body: sheet.querySelector('[data-guide-body="' + n + '"]').value });
    });
    api('/api/confession/guide', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ steps: steps }) })
      .then(function () { sheet.remove(); renderConfession(); })
      .catch(function () { btn.disabled = false; sheet.querySelector('#ge-note').textContent = 'That did not save. Your text is still here \u2014 try again.'; });
  });
}

setupMediaSession();
setupBridgeCommands(); // v377 B3: the native session's transport lands here (shell only; a no-op elsewhere)
setupBackButton(); // v421: the Android system back binding (shell only; a guarded no-op elsewhere)
setTab('prayers');
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(function () {}); }
try { localStorage.setItem('opn-boot', 'complete'); localStorage.removeItem('opn-boot-healed'); } catch (e) {} // v429 §2.5: the boot stamp — the synchronous tail ran through; re-arm the one-shot heal
`;
