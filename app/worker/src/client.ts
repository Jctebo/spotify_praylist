// Ora Pro Nobis app client. Four tabs: Prayers (the player) ·
// Intentions (the pool) · Examination · Confession. No checklist
// anywhere: no check-offs, no done states, no counters on prayers
// or examination questions (Amendments 8-9).
export const APP_JS = `
'use strict';
var view = document.getElementById('view');
var audioEl = document.getElementById('audio');
var state = { tab: 'prayers', playerDate: null, examMode: 'quick', examCat: null, deepIdx: 0, playingUrl: null, queue: [], queueIdx: -1 };

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function todayChicago() {
  var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  var p = {}; parts.forEach(function (x) { p[x.type] = x.value; });
  return p.year + '-' + p.month + '-' + p.day;
}
function shiftDate(date, days) { var d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function api(path, opts) {
  return fetch(path, opts || {}).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
      return j;
    });
  });
}
function post(path, body) { return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); }
function play(url, btn) {
  if (!url) return;
  if (state.playingUrl === url && !audioEl.paused) { audioEl.pause(); markPlaying(null); return; }
  state.playingUrl = url; state.queue = []; state.queueIdx = -1;
  audioEl.src = url; audioEl.play().catch(function () {}); markPlaying(url);
}
function playQueue(urls, btn) {
  if (!urls.length) return;
  if (state.queue.length && state.queueIdx >= 0 && !audioEl.paused) { audioEl.pause(); markPlaying(null); state.queue = []; return; }
  state.queue = urls.slice(); state.queueIdx = 0;
  state.playingUrl = urls[0]; audioEl.src = urls[0]; audioEl.play().catch(function () {}); markPlaying(urls[0]);
}
function markPlaying(url) {
  document.querySelectorAll('[data-play]').forEach(function (b) {
    var on = url && b.getAttribute('data-play') === url;
    b.classList.toggle('playing', !!on);
    if (b.classList.contains('playbtn')) b.innerHTML = on ? '&#10073;&#10073;' : '&#9654;';
  });
}
audioEl.addEventListener('ended', function () {
  if (state.queue.length && state.queueIdx + 1 < state.queue.length) {
    state.queueIdx++; state.playingUrl = state.queue[state.queueIdx];
    audioEl.src = state.playingUrl; audioEl.play().catch(function () {}); markPlaying(state.playingUrl);
  } else { state.queue = []; state.queueIdx = -1; markPlaying(null); }
});
audioEl.addEventListener('pause', function () { if (!state.queue.length) markPlaying(null); });

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
    html += '<div class="card"><h3>Today\'s intentions — audio</h3><div class="audiobar">' + bar + '</div>' + missing + '<p class="meta" style="margin-top:8px">Generated nightly from the day\'s draw — one spoken intentions segment for each block.</p></div>';
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
function trackCard(t) {
  var inner = '';
  if (t.intentionsCard) {
    inner = '<div class="card intentions-card"><div class="row"><button class="playbtn" data-play="' + esc(t.streamUrl) + '">&#9654;</button><div class="grow"><h3>Intentions</h3><div class="meta">Plays here · segment file · generated nightly</div></div></div></div>';
    if (!t.available) inner = '<div class="card intentions-card"><h3>Intentions</h3><div class="notavail">Not available in the app yet — today\'s segment has not been generated.</div></div>';
    return inner;
  }
  if (t.available) {
    inner = '<div class="card"><div class="row"><button class="playbtn" data-play="' + esc(t.streamUrl) + '">&#9654;</button><div class="grow"><h3>' + esc(t.title) + '</h3><div class="meta">Plays here · ' + (t.kind === 'rss' ? 'podcast RSS' : 'segment file') + '</div>'
      + (t.spotifyUrl ? '<a class="spot" target="_blank" rel="noopener" href="' + esc(t.spotifyUrl) + '">Open in Spotify</a>' : '') + '</div></div></div>';
  } else {
    inner = '<div class="card"><h3>' + esc(t.title) + '</h3><div class="notavail">Not available in the app yet.</div>'
      + (t.spotifyUrl ? '<a class="spot" target="_blank" rel="noopener" href="' + esc(t.spotifyUrl) + '">Open in Spotify</a>' : '') + '</div>';
  }
  return inner;
}
function renderPrayers() {
  var date = state.playerDate || todayChicago();
  state.playerDate = date;
  view.innerHTML = '<h1 class="screen">Listen</h1><p class="sub">the day\'s prayers</p><p class="meta">Loading...</p>';
  api('/api/player/day?date=' + date).then(function (day) {
    var html = '<h1 class="screen">Listen</h1><p class="sub">the day\'s prayers</p>';
    html += '<div class="daynav"><button class="btn ghost" id="d-prev">&#8249;</button><div class="dlabel">' + (date === todayChicago() ? 'Today — ' : '') + esc(day.dateLabel || date) + '</div><button class="btn ghost" id="d-next">&#8250;</button></div>';
    html += '<div class="row"><span class="meta grow">filter by day</span><input type="date" id="d-pick" value="' + date + '" style="width:auto"></div>';
    if ((day.episodes || []).length) {
      html += '<h2 style="color:var(--navy);font-weight:normal;letter-spacing:1px;font-size:16px;margin:16px 0 8px">FROM TODAY\'S PODCAST</h2>';
      html += day.episodes.map(trackCard).join('');
    }
    (day.blocks || []).forEach(function (b) {
      html += '<div class="blockhead"><h2>' + esc((b.label || b.block).toUpperCase()) + '</h2><span class="meta grow">' + esc(b.caption || '') + '</span>'
        + (b.spotifyUrl ? '<a class="spot" target="_blank" rel="noopener" href="' + esc(b.spotifyUrl) + '">Open in Spotify</a>' : '')
        + '<button class="playbtn" data-queue="' + esc(b.block) + '">&#9654;</button></div>';
      html += (b.tracks || []).map(trackCard).join('');
    });
    view.innerHTML = html;
    document.getElementById('d-prev').addEventListener('click', function () { state.playerDate = shiftDate(date, -1); renderPrayers(); });
    document.getElementById('d-next').addEventListener('click', function () { state.playerDate = shiftDate(date, 1); renderPrayers(); });
    document.getElementById('d-pick').addEventListener('change', function (e) { state.playerDate = e.target.value; renderPrayers(); });
    view.querySelectorAll('[data-play]').forEach(function (btn) { btn.addEventListener('click', function () { play(btn.getAttribute('data-play'), btn); }); });
    view.querySelectorAll('[data-queue]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var b = (day.blocks || []).filter(function (x) { return x.block === btn.getAttribute('data-queue'); })[0];
        var urls = (b.tracks || []).filter(function (t) { return t.available && t.streamUrl; }).map(function (t) { return t.streamUrl; });
        playQueue(urls, btn);
      });
    });
  }).catch(function (e) { view.innerHTML = '<p class="err">' + esc(e.message) + '</p>'; });
}

/* ---------------- Examination ---------------- */
function renderExamination() {
  view.innerHTML = '<h1 class="screen">Tonight\'s examination</h1><p class="meta">Loading...</p>';
  api('/api/exam/today').then(function (data) {
    var run = data.run;
    var closed = run && run.state === 'closed';
    var cats = data.categories || [];
    if (!state.examCat || cats.indexOf(state.examCat) < 0) state.examCat = data.focusCategory || cats[0];
    var prompts = (data.prompts || []).filter(function (p) { return p.category === state.examCat; });
    var entriesByPrompt = {};
    (data.entries || []).forEach(function (e) { if (e.prompt_id) { (entriesByPrompt[e.prompt_id] = entriesByPrompt[e.prompt_id] || []).push(e); } });
    var customs = (data.entries || []).filter(function (e) { return !e.prompt_id && e.category === state.examCat; });
    var html = '<div class="row"><div class="grow"><h1 class="screen">Tonight\'s examination</h1><p class="sub">' + esc(data.dateLabel || data.date) + '</p></div><button class="btn ghost small" id="ex-gear">Prompts</button></div>';
    html += '<p class="sub">Begin with gratitude for the day, and a short review of it. Then take the questions as reflection prompts — tap one to write an entry in your own words. What you write flows to Confession preparation.</p>';
    if (data.focusCategory) html += '<p class="meta">Tonight\'s focus in depth: <b>' + esc(data.focusCategory) + '</b> — the full short form stands every night.</p>';
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
    if (!closed) html += '<button class="btn" id="run-close" style="width:100%">Close tonight\'s examination</button>';
    else html += '<p class="meta">Tonight\'s run is closed. Its entries stand in Confession preparation.</p>';
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
  if (rc) rc.addEventListener('click', function () { if (confirm('Close tonight\'s examination?')) post('/api/exam/runs/' + run.id + '/close', {}).then(renderExamination); });
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
    html += '<p class="about">This app prepares for confession; it does not record the sacrament\'s ministry. Examination entries are never read by any job and never leave this app.</p>';
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

setTab('prayers');
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(function () {}); }
`;
