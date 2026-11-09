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
:root { --navy:#16283f; --gold:#a8863a; --cream:#faf5ec; --ink:#2a2620; --line:#ddd2ba; --card:#fffdf7; }
* { box-sizing: border-box; }
html, body { margin:0; padding:0; background:var(--cream); color:var(--ink); font-family: Georgia, 'Times New Roman', serif; font-size:17px; }
.brandbar { position: sticky; top:0; z-index: 30; display:flex; align-items:center; gap:10px; background:var(--navy); color:var(--cream); padding:8px 14px; }
.brandmark { width:38px; height:38px; border-radius:8px; }
.wordmark { font-size:19px; letter-spacing:2.5px; color:#e9d9ae; }
.tagline { font-size:13px; letter-spacing:1.2px; text-transform:uppercase; color:#b9c4d4; margin-top:1px; }
.view { padding: 14px 14px 96px; max-width: 640px; margin: 0 auto; }
.tabbar { position: fixed; left:0; right:0; bottom:0; z-index: 30; display:flex; background:var(--navy); padding-bottom: env(safe-area-inset-bottom); }
.tab { flex:1; background:none; border:none; color:#b9c4d4; font-family:inherit; font-size:13px; padding:8px 2px 10px; display:flex; flex-direction:column; align-items:center; gap:2px; cursor:pointer; }
.tab .tabicon { font-size:19px; line-height:1; }
.tab.active { color:#e9d9ae; box-shadow: inset 0 2px 0 var(--gold); }
.dock { position: fixed; left:0; right:0; bottom: var(--tabh, 0px); z-index: 40; display:flex; align-items:center; gap:10px; background:var(--navy); color:var(--cream); padding:7px 12px 10px; border-top:2px solid var(--gold); cursor:pointer; }
.dockthumb { width:42px; height:42px; border-radius:8px; flex:none; }
.docktext { flex:1; min-width:0; }
.docktitle { font-size:17px; color:var(--cream); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dockmeta { font-size:14px; color:#b9c4d4; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }
.docknext { background:none; border:none; color:#e9d9ae; font-family:inherit; font-size:19px; cursor:pointer; flex:none; padding:10px 6px; }
.docknext:disabled { opacity:.35; cursor:default; }
.dockprogress { position:absolute; left:0; right:0; bottom:0; height:3px; background:rgba(250,245,236,.18); }
.dockprogress i { display:block; height:100%; width:0; background:var(--gold); }
body.dock-on .view { padding-bottom: calc(96px + var(--dockh, 60px)); }
h1.screen { font-size:22px; color:var(--navy); margin:2px 0 2px; font-weight:normal; }
.sub { color:#6d6353; font-size:15px; margin:0 0 12px; }
.card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px 14px; margin:0 0 10px; }
.card h3 { margin:0 0 4px; font-size:17px; color:var(--navy); font-weight:normal; }
.meta { font-size:14px; color:#6d6353; }
button.btn { font-family:inherit; background:var(--navy); color:var(--cream); border:none; border-radius:8px; padding:9px 14px; font-size:15px; cursor:pointer; }
button.btn.gold { background:var(--gold); color:#fff; }
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
.pri { font-size:13px; letter-spacing:1px; padding:2px 7px; border-radius:20px; border:1px solid var(--gold); color:var(--gold); white-space:nowrap; }
.pri.H { background:var(--gold); color:#fff; }
.audiobar { display:flex; flex-wrap:wrap; gap:6px; }
.chipbtn { font-family:inherit; font-size:14px; border:1px solid var(--line); background:#fff; border-radius:20px; padding:6px 12px; cursor:pointer; }
.chipbtn.playing { background:var(--navy); color:var(--cream); }
.chipbtn.missing { opacity:.55; border-style:dashed; }
.blockhead { display:flex; align-items:baseline; gap:8px; margin:18px 0 8px; border-bottom:2px solid var(--gold); padding-bottom:4px; }
.blockhead h2 { margin:0; font-size:18px; letter-spacing:1.5px; color:var(--navy); font-weight:normal; }
.playbtn { width:42px; height:42px; border-radius:50%; border:none; background:var(--gold); color:#fff; font-size:16px; cursor:pointer; flex:none; }
.playbtn.playing { background:var(--navy); }
.spot { display:inline-block; margin-top:5px; font-size:14px; color:var(--gold); }
.notavail { font-size:14px; color:#8a4b2a; margin-top:4px; }
.readtext { font-size:17px; line-height:1.7; white-space:pre-wrap; margin-top:10px; }
.intentions-card { border-color:var(--gold); background:#fdf6e0; }
.chips { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 12px; }
.chip { font-family:inherit; font-size:14px; padding:6px 11px; border-radius:20px; border:1px solid var(--line); background:#fff; cursor:pointer; }
.chip.active { background:var(--navy); color:var(--cream); border-color:var(--navy); }
.modes { display:flex; border:1px solid var(--line); border-radius:8px; overflow:hidden; margin:0 0 12px; }
.modes button { flex:1; font-family:inherit; font-size:15px; padding:8px; background:#fff; border:none; cursor:pointer; }
.modes button.active { background:var(--navy); color:var(--cream); }
.prompt { cursor:pointer; }
.prompt .ptext { font-size:17px; line-height:1.45; }
.entry { border-left:3px solid var(--gold); padding:6px 10px; margin:8px 0 0; background:#fff; font-size:16px; }
.entry .meta { margin-top:2px; }
.hidden { display:none !important; }
.sheet { position:fixed; inset:0; z-index:50; background:var(--cream); overflow:auto; padding:14px 14px 40px; }
.sheet .inner { max-width:640px; margin:0 auto; }
.daynav { display:flex; align-items:center; gap:10px; margin:0 0 6px; }
.daynav .dlabel { flex:1; text-align:center; font-size:16px; color:var(--navy); }
.count { font-size:14px; color:var(--gold); }
.err { color:#8a2a2a; font-size:15px; }
.about { margin-top:22px; font-size:14px; color:#8b8172; line-height:1.6; }
.gearbtn { margin-left:auto; background:none; border:none; color:#e9d9ae; font-size:22px; line-height:1; cursor:pointer; padding:8px 6px; flex:none; }
.setrow { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px 12px; margin:0 0 8px; }
.setrow .setname { font-size:17px; color:var(--navy); }
.setcontrols { display:flex; align-items:center; gap:6px; margin-top:8px; flex-wrap:wrap; }
.setcontrols select { width:auto; flex:1; min-width:110px; }
.setcontrols .mvbtn { font-family:inherit; font-size:15px; border:1px solid var(--line); background:#fff; border-radius:8px; padding:8px 10px; cursor:pointer; flex:none; }
.setcontrols .mvbtn:disabled { opacity:.35; cursor:default; }
.settoggle { font-family:inherit; font-size:14px; border:1px solid var(--gold); color:var(--gold); background:#fff; border-radius:20px; padding:6px 12px; cursor:pointer; flex:none; white-space:nowrap; }
.settoggle.on { background:var(--gold); color:#fff; }
/* Now Playing (v336) */
.np-art { text-align:center; margin:20px 0 12px; }
.np-art img { width:150px; height:150px; border-radius:14px; }
.np-title { text-align:center; }
.np-meta { text-align:center; }
.np-seekrow { display:flex; align-items:center; gap:10px; margin:22px 0 6px; font-size:13px; color:#6d6353; }
.np-seekrow input[type=range] { flex:1; accent-color:var(--gold); height:28px; cursor:pointer; }
.np-seekrow input[type=range]:disabled { cursor:default; opacity:.5; }
.np-transport { display:flex; align-items:center; justify-content:center; gap:26px; margin:16px 0 20px; }
.np-tbtn { background:none; border:none; color:var(--navy); font-family:inherit; font-size:26px; cursor:pointer; padding:10px; }
.np-tbtn:disabled { opacity:.35; cursor:default; }
.np-play { width:58px; height:58px; font-size:21px; }
.np-controls { justify-content:center; flex-wrap:wrap; }
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
var CACHE = "ora-pro-nobis-v336-1";
var SHELL = ["/", "/styles.css", "/app.js", "/logo.png", "/manifest.json"];
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
