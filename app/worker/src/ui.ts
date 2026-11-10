// Ora Pro Nobis app — served shell, styles, manifest, service worker.
// Branding is the podcast's own (Amendment 9 item 4): the Ora Pro
// Nobis logo, deep navy #16283f + antique gold #a8863a on cream
// #faf5ec, serif (Georgia-class) wordmark, tagline "A Daily Catholic
// Prayer Podcast", and a brand bar on every screen.

export const SHELL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Ora Pro Nobis</title>
<meta name="theme-color" content="#16283f">
<link rel="manifest" href="/manifest.json">
<link rel="icon" href="/logo.png">
<link rel="apple-touch-icon" href="/logo.png">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<header class="brandbar">
  <img class="brandmark" src="/logo.png" alt="Ora Pro Nobis logo">
  <div class="brandtext">
    <div class="wordmark">ORA PRO NOBIS</div>
    <div class="tagline">A Daily Catholic Prayer Podcast</div>
    <div class="litday" id="litday"></div>
  </div>
  <button class="gearbtn" id="gearbtn" aria-label="Settings">&#9881;</button>
</header>
<main id="view" class="view"></main>
<audio id="audio" preload="none"></audio>
<div id="dock" class="dock hidden"><img class="dockthumb" src="/logo.png" alt=""><div class="docktext"><div class="docktitle" id="dock-title"></div><div class="dockmeta" id="dock-meta"></div></div><button id="dock-play" class="playbtn" aria-label="Play or pause"></button><button id="dock-next" class="docknext" aria-label="Next track">&#9197;</button><div class="dockprogress"><i id="dock-progress-fill"></i></div></div>
<nav class="tabbar" id="tabbar">
  <button data-tab="prayers" class="tab"><span class="tabicon">&#10022;</span><span>Prayers</span></button>
  <button data-tab="intentions" class="tab"><span class="tabicon">&#9829;</span><span>Intentions</span></button>
  <button data-tab="examination" class="tab"><span class="tabicon">&#9790;</span><span>Examination</span></button>
  <button data-tab="confession" class="tab"><span class="tabicon">&#10013;</span><span>Confession</span></button>
</nav>
<script src="/app.js"></script>
</body>
</html>`;

export const APP_CSS = `
:root { --navy:#16283f; --gold:#a8863a; --cream:#faf5ec; --ink:#2a2620; --line:#ddd2ba; --card:#fffdf7;
  /* v352 §2.7: the liturgical theme token layer. The defaults
     reproduce the pre-v352 rendering exactly; a [data-lit] theme
     on <html> (set by the client from the day payload's
     liturgicalDay field) re-points them at the day's color.
     --cream/--ink are NEVER themed — body text/background stay
     on their fixed contrast pair in every theme. New
     accent-bearing surfaces read var(--accent)/var(--accent-ink);
     new bar-family surfaces read the --bar-* set. */
  --accent:var(--gold); --accent-ink:#ffffff;
  --bar-bg:#16283f; --bar-solid:#16283f; --bar-fg:#e9d9ae; --bar-sub:#b9c4d4; }
[data-lit="white"] { --bar-bg:linear-gradient(135deg, #f3e9cf, #faf5ec); --bar-solid:#f3e9cf; --bar-fg:#16283f; --bar-sub:#6d6353; --accent:#a8863a; --accent-ink:#ffffff; }
[data-lit="red"] { --bar-bg:linear-gradient(135deg, #5d1616, #7d2121); --bar-solid:#5d1616; --bar-fg:#f6e8d8; --bar-sub:#dfb9a8; --accent:#9e2b25; --accent-ink:#ffffff; }
[data-lit="green"] { --bar-bg:linear-gradient(135deg, #173a22, #1f4d2e); --bar-solid:#173a22; --bar-fg:#e9d9ae; --bar-sub:#b7cdb9; --accent:#2e7d46; --accent-ink:#ffffff; }
[data-lit="violet"] { --bar-bg:linear-gradient(135deg, #2c1e40, #3d2a56); --bar-solid:#2c1e40; --bar-fg:#e9d9ae; --bar-sub:#c4b6dd; --accent:#6a4a9e; --accent-ink:#ffffff; }
[data-lit="rose"] { --bar-bg:linear-gradient(135deg, #6d3441, #8a4453); --bar-solid:#6d3441; --bar-fg:#f9e9e4; --bar-sub:#eed3d7; --accent:#a34a5f; --accent-ink:#ffffff; }
* { box-sizing: border-box; }
html, body { margin:0; padding:0; background:var(--cream); color:var(--ink); font-family: Georgia, 'Times New Roman', serif; font-size:17px; }
.brandbar { position: sticky; top:0; z-index: 30; display:flex; align-items:center; gap:10px; background-color:var(--bar-solid); background:var(--bar-bg); color:var(--bar-fg); padding:8px 14px; }
.brandmark { width:38px; height:38px; border-radius:8px; }
.wordmark { font-size:19px; letter-spacing:2.5px; color:var(--bar-fg); }
.tagline { font-size:13px; letter-spacing:1.2px; text-transform:uppercase; color:var(--bar-sub); margin-top:1px; }
.litday { font-size:13px; letter-spacing:.4px; margin-top:1px; color:var(--bar-fg); }
.view { padding: 14px 14px 96px; max-width: 640px; margin: 0 auto; }
.tabbar { position: fixed; left:0; right:0; bottom:0; z-index: 30; display:flex; background-color:var(--bar-solid); background:var(--bar-bg); padding-bottom: env(safe-area-inset-bottom); }
.tab { flex:1; background:none; border:none; color:var(--bar-sub); font-family:inherit; font-size:13px; padding:8px 2px 10px; display:flex; flex-direction:column; align-items:center; gap:2px; cursor:pointer; }
.tab .tabicon { font-size:19px; line-height:1; }
.tab.active { color:var(--bar-fg); box-shadow: inset 0 2px 0 var(--accent); }
.dock { position: fixed; left:10px; right:10px; bottom: calc(var(--tabh, 0px) + 8px); z-index: 40; display:flex; align-items:center; gap:10px; background-color:var(--bar-solid); background:var(--bar-bg); color:var(--bar-fg); padding:7px 12px 10px; border:1px solid rgba(250,245,236,.25); border-radius:12px; overflow:hidden; cursor:pointer; }
[data-lit="white"] .dock { border-color: var(--line); }
.dockthumb { width:42px; height:42px; border-radius:8px; flex:none; }
.docktext { flex:1; min-width:0; }
.docktitle { font-size:17px; color:var(--bar-fg); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dockmeta { font-size:14px; color:var(--bar-sub); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }
.docknext { background:none; border:none; color:var(--bar-fg); font-family:inherit; font-size:19px; cursor:pointer; flex:none; padding:10px 6px; }
.docknext:disabled { opacity:.35; cursor:default; }
.dockprogress { position:absolute; left:0; right:0; bottom:0; height:3px; background:rgba(250,245,236,.18); }
.dockprogress i { display:block; height:100%; width:0; background:var(--accent); }
body.dock-on .view { padding-bottom: calc(96px + var(--dockh, 60px)); }
h1.screen { font-size:22px; color:var(--navy); margin:2px 0 2px; font-weight:normal; }
.sub { color:#6d6353; font-size:15px; margin:0 0 12px; }
.card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin:0 0 10px; }
/* v344 §2.5: the played marker — a quiet state dot. The button
   box holds the 44px one-hand target (Principle 3); the visible
   circle is 12px, drawn as an ::after so the box itself stays
   invisible. UNPLAYED = the hollow ring; PLAYED = the same
   circle filled gold. No checkmark glyph exists anywhere in the
   app — the NO CHECKLIST rule (v305) binds this surface too. */
.played-dot { flex:0 0 44px; width:44px; height:44px; margin:-10px -12px -10px 0; padding:0; background:none; border:0; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.played-dot::after { content:''; width:12px; height:12px; border-radius:50%; border:1px solid var(--line); background:transparent; }
.played-dot.on::after { background:var(--accent); border-color:var(--accent); }
/* The played row's second, quieter signal: the title steps down
   to the standing meta tone (#6d6353) — a tone change, like the
   ring-to-fill change, not a trophy mark. */
.card h3.heard { color:#6d6353; }
.card h3 { margin:0 0 4px; font-size:17px; color:var(--navy); font-weight:normal; }
.meta { font-size:14px; color:#6d6353; }
button.btn { font-family:inherit; background:var(--navy); color:var(--cream); border:none; border-radius:8px; padding:9px 14px; font-size:15px; cursor:pointer; }
button.btn.gold { background:var(--accent); color:var(--accent-ink); }
button.btn.ghost { background:none; color:var(--navy); border:1px solid var(--line); }
button.btn.small { padding:5px 10px; font-size:14px; }
button.btn:disabled { opacity:.45; }
input[type=text], input[type=date], select, textarea { font-family:inherit; font-size:16px; width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:8px; background:#fff; color:var(--ink); }
textarea { min-height:64px; resize:vertical; }
label.f { display:block; font-size:13px; letter-spacing:.6px; text-transform:uppercase; color:#6d6353; margin:10px 0 4px; }
.row { display:flex; align-items:center; gap:8px; }
.grow { flex:1; }
.stats { display:flex; gap:8px; margin:0 0 12px; }
.stat { flex:1; text-align:center; background:var(--card); border:1px solid var(--line); border-radius:10px; padding:8px 2px; }
.stat b { display:block; font-size:19px; color:var(--navy); font-weight:normal; }
.stat span { font-size:13px; letter-spacing:.5px; text-transform:uppercase; color:#6d6353; }
.pri { font-size:13px; letter-spacing:1px; padding:2px 7px; border-radius:20px; border:1px solid var(--accent); color:var(--accent); white-space:nowrap; }
.pri.H { background:var(--accent); color:var(--accent-ink); }
.audiobar { display:flex; flex-wrap:wrap; gap:6px; }
.chipbtn { font-family:inherit; font-size:14px; border:1px solid var(--line); background:#fff; border-radius:20px; padding:6px 12px; cursor:pointer; }
.chipbtn.playing { background:var(--navy); color:var(--cream); }
.chipbtn.missing { opacity:.55; border-style:dashed; }
.playbtn { width:42px; height:42px; border-radius:50%; border:none; background:var(--accent); color:var(--accent-ink); font-size:16px; cursor:pointer; flex:none; }
.playbtn.playing { background:var(--navy); }
.spot { display:inline-block; margin-top:5px; font-size:14px; color:var(--accent); }
.notavail { font-size:14px; color:#8a4b2a; margin-top:4px; }
.readtext { font-size:17px; line-height:1.7; white-space:pre-wrap; margin-top:10px; }
/* Modular intentions (v338): the combined row — intention panel
   FIRST at ~25%, hairline divider on its right, subordinate type in
   the .meta tone, no gold, no nested card. */
/* Uniform intention rows (v343): every combined row stands at one
   fixed height — 136px, measured on the real DOM at Plan (the
   two-line-title novena shape governs the family maximum) — with
   the compacted chrome below. The intention text caps at two
   lines; overflow sits behind the panel-side ellipsis (⋯), which
   stands only when the text is actually clamped (armed by
   measurement in the client). An expanded row grows in place. */
.card.intro-row { padding:9px 14px; height:136px; overflow:hidden; }
.intro-row .intention-panel { flex:0 0 25%; border-right:1px solid var(--line); padding-right:8px; font-size:14px; color:#6d6353; }
.intention-label { font-size:13px; letter-spacing:1px; text-transform:uppercase; margin-bottom:2px; }
.intention-text { line-height:1.4; margin-bottom:6px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.panel-foot { display:flex; align-items:center; gap:6px; }
.ellipsis-btn { display:none; background:none; border:none; font-family:inherit; font-size:14px; line-height:1; color:#6d6353; cursor:pointer; padding:4px 2px; }
.ellipsis-btn.stands { display:inline-block; }
.card.intro-row.expanded { height:auto; overflow:visible; }
.card.intro-row.expanded .intention-text { display:block; -webkit-line-clamp:none; overflow:visible; }
.playbtn.small { width:30px; height:30px; font-size:12px; }
.chips { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 12px; }
.chip { font-family:inherit; font-size:14px; padding:6px 11px; border-radius:20px; border:1px solid var(--line); background:#fff; cursor:pointer; }
.chip.active { background:var(--navy); color:var(--cream); border-color:var(--navy); }
.modes { display:flex; border:1px solid var(--line); border-radius:8px; overflow:hidden; margin:0 0 12px; }
.modes button { flex:1; font-family:inherit; font-size:15px; padding:8px; background:#fff; border:none; cursor:pointer; }
.modes button.active { background:var(--navy); color:var(--cream); }
.prompt { cursor:pointer; }
.prompt .ptext { font-size:17px; line-height:1.45; }
.entry { border-left:3px solid var(--accent); padding:6px 10px; margin:8px 0 0; background:#fff; font-size:16px; }
.entry .meta { margin-top:2px; }
.hidden { display:none !important; }
.sheet { position:fixed; inset:0; z-index:50; background:var(--cream); overflow:auto; padding:14px 14px 40px; }
.sheet .inner { max-width:640px; margin:0 auto; }
.daynav { display:flex; align-items:center; gap:10px; margin:0 0 6px; }
.daynav .dlabel { flex:1; text-align:center; font-size:16px; color:var(--navy); }
.count { font-size:14px; color:var(--accent); }
.err { color:#8a2a2a; font-size:15px; }
.about { margin-top:22px; font-size:14px; color:#8b8172; line-height:1.6; }
.gearbtn { margin-left:auto; background:none; border:none; color:var(--bar-fg); font-size:22px; line-height:1; cursor:pointer; padding:8px 6px; flex:none; }
.setrow { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px 12px; margin:0 0 8px; }
.setrow .setname { font-size:17px; color:var(--navy); }
.setcontrols { display:flex; align-items:center; gap:6px; margin-top:8px; flex-wrap:wrap; }
.setcontrols select { width:auto; flex:1; min-width:110px; }
.setcontrols .mvbtn { font-family:inherit; font-size:15px; border:1px solid var(--line); background:#fff; border-radius:8px; padding:8px 10px; cursor:pointer; flex:none; }
.setcontrols .mvbtn:disabled { opacity:.35; cursor:default; }
.settoggle { font-family:inherit; font-size:14px; border:1px solid var(--accent); color:var(--accent); background:#fff; border-radius:20px; padding:6px 12px; cursor:pointer; flex:none; white-space:nowrap; }
.settoggle.on { background:var(--accent); color:var(--accent-ink); }
/* Now Playing (v336) */
.np-art { text-align:center; margin:20px 0 12px; }
.np-art img { width:150px; height:150px; border-radius:14px; }
.np-title { text-align:center; }
.np-meta { text-align:center; }
.np-seekrow { display:flex; align-items:center; gap:10px; margin:22px 0 6px; font-size:13px; color:#6d6353; }
.np-seekrow input[type=range] { flex:1; accent-color:var(--accent); height:28px; cursor:pointer; }
.np-seekrow input[type=range]:disabled { cursor:default; opacity:.5; }
.np-transport { display:flex; align-items:center; justify-content:center; gap:26px; margin:16px 0 20px; }
.np-tbtn { background:none; border:none; color:var(--navy); font-family:inherit; font-size:26px; cursor:pointer; padding:10px; }
.np-tbtn:disabled { opacity:.35; cursor:default; }
.np-play { width:58px; height:58px; font-size:21px; }
.np-controls { justify-content:center; flex-wrap:wrap; }
.npq-head { display:flex; align-items:baseline; gap:8px; margin:18px 0 8px; border-bottom:2px solid var(--accent); padding-bottom:4px; }
.npq-heading { font-size:18px; letter-spacing:1.5px; color:var(--navy); }
.npq-row { display:flex; align-items:center; gap:8px; width:100%; text-align:left; background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px 12px; margin:0 0 8px; font-family:inherit; font-size:17px; color:var(--ink); cursor:pointer; min-height:44px; }
.npq-row:disabled { opacity:.55; cursor:default; }
.npq-row.playing { border-color:var(--accent); box-shadow:inset 0 0 0 1px var(--accent); }
.npq-row.npq-intro .npq-title { color:#6d6353; font-size:15px; }
.npq-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.npq-title { color:var(--navy); }
.npq-meta { font-size:14px; }
.npq-dot.played-dot { flex:0 0 12px; width:12px; height:12px; margin:0; padding:0; cursor:default; }
.npq-start { border-color:var(--accent); }
/* Confession PIN (v356): the gate, the pad, the recovery sheet.
   Built on the standing tokens — the pad's accent is var(--accent),
   which v352's liturgical layer re-points by the day's color. */
.pingate { text-align:center; }
.pingate .lockline { font-size:17px; color:var(--navy); line-height:1.5; margin:6px 0 4px; }
.pindots { display:flex; justify-content:center; gap:10px; margin:18px 0 6px; min-height:16px; }
.pindot { width:14px; height:14px; border-radius:50%; border:2px solid var(--accent); background:transparent; }
.pindot.on { background:var(--accent); }
.pinpad { display:grid; grid-template-columns:repeat(3, 76px); gap:10px; justify-content:center; margin:14px 0 6px; }
.pinpad button { font-family:inherit; font-size:22px; color:var(--navy); background:var(--card); border:1px solid var(--line); border-radius:50%; width:64px; height:64px; cursor:pointer; }
.pinpad button:active { background:var(--accent); color:var(--accent-ink); }
.pinpad button:disabled { opacity:.35; cursor:default; }
.pinpad .pinblank { visibility:hidden; }
.pinmsg { min-height:22px; font-size:15px; color:#8a2a2a; margin:8px 0 2px; }
.pinmsg.wait { color:#6d6353; }
@keyframes pinshake { 0%,100% { transform:translateX(0); } 20% { transform:translateX(-9px); } 40% { transform:translateX(9px); } 60% { transform:translateX(-6px); } 80% { transform:translateX(6px); } }
.shake { animation: pinshake .45s ease; }
.recoverycode { font-size:26px; letter-spacing:2px; color:var(--navy); text-align:center; margin:16px 0; }
.pinsection { margin-top:22px; }
/* UI overhaul B (v353): the clone structure — Listen home block
   cards, block pages in playlist form, the search pill, the
   Library list language, and the shared section header. Gradient
   surfaces read the --bar-* set (v352 §2.7's token contract);
   accents read --accent/--accent-ink; body/cream/ink are never
   themed. The combined-row family (.card.intro-row) is EXEMPT
   from every geometry change here (v343's 136px is a contract). */
.sectionhead { font-size:16px; letter-spacing:1.5px; color:var(--navy); font-weight:normal; text-transform:uppercase; margin:18px 0 8px; border-bottom:2px solid var(--accent); padding-bottom:4px; }
.blockgrid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:0 0 10px; }
.blockcard { position:relative; background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; cursor:pointer; }
.blockcard-face { background-color:var(--bar-solid); background:var(--bar-bg); color:var(--bar-fg); padding:12px 12px 10px; min-height:76px; }
.blockcard-name { font-size:17px; letter-spacing:1.2px; color:var(--bar-fg); }
.blockcard-cap { font-size:13px; color:var(--bar-sub); margin-top:3px; }
.blockcard-meta { font-size:13px; color:#6d6353; padding:8px 62px 12px 12px; }
.blockcard-play { position:absolute; right:10px; bottom:10px; }
.blockpage-head { margin:-14px -14px 12px; padding:12px 14px 14px; background-color:var(--bar-solid); background:var(--bar-bg); color:var(--bar-fg); }
.backrow { margin:0 0 6px; }
.backbtn { background:none; border:none; color:var(--bar-fg); font-family:inherit; font-size:15px; cursor:pointer; padding:6px 0; }
.blockpage-title { font-size:28px; letter-spacing:1.5px; color:var(--bar-fg); }
.blockpage-meta { font-size:14px; color:var(--bar-sub); margin-top:4px; }
.blockpage-playrow { display:flex; align-items:center; gap:10px; margin-top:12px; }
.blockpage-playlabel { font-size:16px; color:var(--bar-fg); }
.playbtn.big { width:56px; height:56px; font-size:20px; }
.blockpage-head .spot { color:var(--bar-fg); margin-top:0; }
.blockpage-head .btn.ghost { color:var(--bar-fg); border-color:var(--bar-sub); }
.searchpill { margin:0 0 12px; }
.searchpill input { width:100%; height:44px; border-radius:999px; border:1px solid var(--line); background:var(--card); padding:0 16px; font-family:inherit; font-size:16px; color:var(--ink); -webkit-appearance:none; appearance:none; }
.liblist { background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; margin:0 0 12px; }
.librow { padding:10px 12px; }
.librow + .librow { border-top:1px solid var(--line); }
.liblist .setrow { border:none; border-radius:0; margin:0; background:none; }
.liblist .setrow + .setrow { border-top:1px solid var(--line); }
.stats { gap:0; background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
.stat { background:none; border:none; border-radius:0; }
.stat + .stat { border-left:1px solid var(--line); }


`;

export const MANIFEST_JSON = JSON.stringify({
  name: "Ora Pro Nobis",
  short_name: "Ora Pro Nobis",
  description: "A Daily Catholic Prayer Podcast — prayer intentions, the day's prayers, examination of conscience, and confession preparation.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#faf5ec",
  theme_color: "#16283f",
  icons: [{ src: "/logo.png", sizes: "288x288", type: "image/png", purpose: "any" }],
});

export const SW_JS = `
var CACHE = "ora-pro-nobis-v353-1";
var SHELL = ["/", "/styles.css", "/app.js", "/logo.png", "/logo-512.png", "/manifest.json"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    // The purge retires old SHELL caches only. The externals audio
    // cache (opn-ext-audio-v1, v334) is owned by the client's day
    // cache invalidation and must survive activation — deleting it
    // here raced the at-open downloads and wiped landed audio
    // (harness-v334 leg 11, rework 2026-11-09).
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== "opn-ext-audio-v1"; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (url.pathname.indexOf("/api/") === 0) return; // data + audio: network only
  e.respondWith(
    fetch(e.request).then(function (r) {
      var copy = r.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return r;
    }).catch(function () { return caches.match(e.request); })
  );
});
`;
