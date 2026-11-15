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
<script>
// v429 §2.5: the boot stamp + one-shot self-heal. Seated
// before the stylesheet so the decision never waits on it.
// A prior boot that started and never completed points at
// the SW/cache layer: unregister, clear the shell caches
// (the two standing stores survive), reload exactly once.
// Any other state simply marks this boot started; the
// bundle's tail stamps the boot complete and re-arms.
(function () {
  try {
    var boot = localStorage.getItem('opn-boot');
    if (boot === 'started' && localStorage.getItem('opn-boot-healed') !== '1') {
      localStorage.setItem('opn-boot-healed', '1');
      localStorage.setItem('opn-boot', 'healing');
      var reload = function () { try { location.reload(); } catch (e) {} };
      var clears = [];
      try {
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
          clears.push(navigator.serviceWorker.getRegistrations().then(function (regs) {
            return Promise.all(regs.map(function (r) { return r.unregister().catch(function () {}); }));
          }).catch(function () {}));
        }
        if (window.caches && caches.keys) {
          clears.push(caches.keys().then(function (keys) {
            return Promise.all(keys.filter(function (k) { return k !== 'opn-ext-audio-v1' && k !== 'opn-offline-meta-v1'; }).map(function (k) { return caches.delete(k).catch(function () {}); }));
          }).catch(function () {}));
        }
      } catch (e) {}
      Promise.all(clears).then(reload, reload);
    } else {
      localStorage.setItem('opn-boot', 'started');
    }
  } catch (e) {}
})();
</script>
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
    <div class="litday" id="litday"></div>
  </div>
  <button class="gearbtn" id="gearbtn" aria-label="Settings">&#9881;</button>
</header>
<main id="view" class="view"></main>
<audio id="audio" preload="none"></audio>
<div id="dock" class="dock hidden"><img class="dockthumb" id="dock-thumb" src="/logo.png" alt=""><div class="docktext"><div class="docktitle" id="dock-title"></div><div class="dockmeta" id="dock-meta"></div></div><button id="dock-play" class="playbtn" aria-label="Play or pause"></button><button id="dock-next" class="docknext" aria-label="Next track">&#9197;</button><button id="dock-menu" class="docknext" aria-label="Playback options">&#8943;</button><div class="dockprogress"><i id="dock-progress-fill"></i></div></div>
<nav class="tabbar" id="tabbar">
  <button data-tab="prayers" class="tab"><span class="tabpill"><span class="tabicon">&#10022;</span><span>Prayers</span></span></button>
  <button data-tab="conscience" class="tab"><span class="tabpill"><span class="tabicon">&#10013;</span><span>Conscience</span></span></button>
  <button data-tab="podcasts" class="tab"><span class="tabpill"><span class="tabicon">&#9835;</span><span>Formation</span></span></button>
  <button data-tab="wallpaper" class="tab"><span class="tabpill"><span class="tabicon">&#9635;</span><span>Sacred Art</span></span></button>
</nav>
<script src="/app.js"></script>
</body>
</html>`;

export const APP_CSS = `
:root { --navy:#16283f; --gold:#a8863a; --cream:#faf5ec; --ink:#2a2620; --line:#ddd2ba; --card:#fffdf7;
  /* v419: the overhaul tokens — the meta grey and the danger
     red become tokens every rule reads (G3/G5); the label
     layer's system sans stack (G2, D4 — no font payload);
     --card-2, the one deeper surface step, read by the
     drawer foot bars and the skeleton blocks. */
  --muted:#6d6353; --danger:#8a2a2a; --card-2:#f3ecd9;
  --sans:-apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  /* v352 §2.7: the liturgical theme token layer. The defaults
     reproduce the pre-v352 rendering exactly; a [data-lit] theme
     on <html> (set by the client from the day payload's
     liturgicalDay field) re-points them at the day's color.
     --cream/--ink are NEVER themed — body text/background stay
     on their fixed contrast pair in every theme. New
     accent-bearing surfaces read var(--accent)/var(--accent-ink);
     new bar-family surfaces read the --bar-* set. */
  --accent:var(--gold); --accent-ink:#ffffff;
  /* v411 §2.7: the text-gold token — brand gold's hue deepened
     until it clears 4.5:1 as TEXT on both standing grounds
     (4.65:1 on cream, 4.97:1 on card). --accent-text is the
     seam every accent-colored WORD reads: gold themes point
     it at the text gold; the four liturgical themes point it
     at their own accent, which already clears the line.
     Bright --gold stands untouched for discs, rules, borders,
     and fills. */
  --gold-text:#866B2E; --accent-text:var(--gold-text);
  --bar-bg:#16283f; --bar-solid:#16283f; --bar-fg:#e9d9ae; --bar-sub:#b9c4d4; }
[data-lit="white"] { --bar-bg:linear-gradient(135deg, #f3e9cf, #faf5ec); --bar-solid:#f3e9cf; --bar-fg:#16283f; --bar-sub:#6d6353; --accent:#a8863a; --accent-ink:#ffffff; }
[data-lit="red"] { --bar-bg:linear-gradient(135deg, #5d1616, #7d2121); --bar-solid:#5d1616; --bar-fg:#f6e8d8; --bar-sub:#dfb9a8; --accent:#9e2b25; --accent-ink:#ffffff; --accent-text:var(--accent); }
[data-lit="green"] { --bar-bg:linear-gradient(135deg, #173a22, #1f4d2e); --bar-solid:#173a22; --bar-fg:#e9d9ae; --bar-sub:#b7cdb9; --accent:#2e7d46; --accent-ink:#ffffff; --accent-text:var(--accent); }
[data-lit="violet"] { --bar-bg:linear-gradient(135deg, #2c1e40, #3d2a56); --bar-solid:#2c1e40; --bar-fg:#e9d9ae; --bar-sub:#c4b6dd; --accent:#6a4a9e; --accent-ink:#ffffff; --accent-text:var(--accent); }
[data-lit="rose"] { --bar-bg:linear-gradient(135deg, #6d3441, #8a4453); --bar-solid:#6d3441; --bar-fg:#f9e9e4; --bar-sub:#eed3d7; --accent:#a34a5f; --accent-ink:#ffffff; --accent-text:var(--accent); }
* { box-sizing: border-box; }
html, body { margin:0; padding:0; background:var(--cream); color:var(--ink); font-family: Georgia, 'Times New Roman', serif; font-size:17px; }
.brandbar { position: sticky; top:0; z-index: 30; display:flex; align-items:center; gap:10px; background-color:var(--bar-solid); background:var(--bar-bg); color:var(--bar-fg); padding:4px 14px; }
.brandmark { width:38px; height:38px; border-radius:8px; }
.wordmark { font-size:19px; letter-spacing:2.5px; color:var(--bar-fg); }
.litday { font-size:13px; letter-spacing:.4px; margin-top:1px; color:var(--bar-fg); }
.view { padding: 14px 12px 96px; max-width: 640px; margin: 0 auto; }
.tabbar { position: fixed; left:0; right:0; bottom:0; z-index: 30; display:flex; background-color:var(--bar-solid); background:var(--bar-bg); padding-bottom: env(safe-area-inset-bottom); border-top:1px solid rgba(250,245,236,.25); box-shadow:0 -4px 14px rgba(42,38,32,.14); }
/* v437 (§2.1): in the shell the WebView already stands
   above the nav bar by the shell's own margin, so the
   env() padding would count the inset a second time —
   the boot class (client.ts) takes it out there only;
   the web keeps the base rule above, unchanged. */
html.in-shell .tabbar { padding-bottom: 0; }
.tab { flex:1; background:none; border:none; color:var(--bar-sub); font-family:var(--sans); font-size:13px; padding:8px 2px 10px; display:flex; flex-direction:column; align-items:center; gap:2px; cursor:pointer; }
.tab .tabicon { font-size:19px; line-height:1; }
/* v419 (G18): the active tab carries the accent pill behind
   its glyph+label — the 2px inset rule retires. The pill's
   added height is absorbed by the standing --tabh
   measurement (the dock seats on the measured value). */
.tabpill { display:flex; flex-direction:column; align-items:center; gap:2px; padding:5px 10px; border-radius:999px; }
.tab.active { color:var(--bar-fg); }
.tab.active .tabpill { background:var(--accent); color:var(--accent-ink); }
.dock { position: fixed; left:10px; right:10px; bottom: var(--tabh, 0px); z-index: 40; display:flex; align-items:center; gap:10px; background-color:var(--bar-solid); background:var(--bar-bg); color:var(--bar-fg); padding:8px 10px; border:1px solid rgba(250,245,236,.25); border-radius:12px; overflow:hidden; cursor:pointer; }
[data-lit="white"] .dock { border-color: var(--line); }
.dockthumb { width:44px; height:44px; border-radius:8px; flex:none; }
.docktext { flex:1; min-width:0; }
.docktitle { font-size:17px; color:var(--bar-fg); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dockmeta { font-size:14px; color:var(--bar-sub); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; font-family:var(--sans); }
.docknext { background:none; border:none; color:var(--bar-fg); font-family:inherit; font-size:19px; cursor:pointer; flex:none; padding:10px 6px; min-width:44px; }
.dockauto { font-size:13px; color:var(--bar-sub); white-space:nowrap; }
.docknext:disabled { opacity:.35; cursor:default; }
.dockprogress { position:absolute; left:0; right:0; bottom:0; height:3px; background:rgba(250,245,236,.18); }
.dockprogress i { display:block; height:100%; width:0; background:var(--accent); }
body.dock-on .view { padding-bottom: calc(var(--tabh, 0px) + var(--dockh, 60px)); }
h1.screen { font-size:22px; color:var(--navy); margin:2px 0 2px; font-weight:normal; }
.sub { color:var(--muted); font-size:15px; margin:0 0 12px; }
.headrow { margin:2px 0 12px; }
.headrow h1.screen, .headrow .sub { margin:0; }
.card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin:0 0 10px; }
/* v363 §2.1/§2.2: the uniform row height — every track row
   stands at exactly 76px. The fixed height lands on the
   dedicated .trow class at the row emit sites only, NEVER on
   bare .card (the PIN gate, Settings cards, forms, the
   Continue card keep their natural heights). 76px border-box
   = 1px border + 10px padding + 54px content box + 10px
   padding + 1px border; rows thin the standing card's
   vertical padding from 12px to 10px (rows only). The
   overflow:hidden guard means a row can never stand taller;
   harness-v363 measures scrollHeight <= clientHeight on every
   fixture so clipped content fails the gate instead of
   shipping silently (the v343 lesson). */
/* v419 (G25): the two row forms carry their names — the
   Compact row (.card.trow: fixed 76px, single-line clamp)
   and the Media row (.card.trow.prow: wraps, artwork-led).
   Names only; geometry stands. */
.card.trow { height:76px; padding:10px 14px; overflow:hidden; position:relative; }
/* v395 §2.9: the Podcasts partway bar — the dockprogress form
   at a podcast row's bottom edge, inside the uniform 76px row:
   absolute against the row (position:relative above), 3px, the
   accent fill at position / duration width. The row gains no
   height, no text, no new line. */
.podbar { position:absolute; left:0; right:0; bottom:0; height:3px; background:rgba(22,40,63,.14); }
.podbar i { display:block; height:100%; background:var(--accent); }
.card.trow .grow { min-width:0; }
.card.trow h3 { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.card.trow .meta { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.card.trow .spot { margin-top:0; }
/* v363 §2.3: the trailing cluster — the Read control over the
   Spotify link, standing inside .row after .grow and before
   the played dot (an own unavailable row carries it as the
   row's last element; no dot stands there). */
.trow-tail { flex:none; display:flex; flex-direction:column; align-items:flex-end; justify-content:center; gap:4px; }
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
   to the standing meta tone (var(--muted)) — a tone change, like
   the ring-to-fill change, not a trophy mark. */
.card h3.heard { color:var(--muted); }
.card h3 { margin:0 0 4px; font-size:17px; color:var(--navy); font-weight:normal; }
.meta { font-size:14px; color:var(--muted); font-family:var(--sans); }
/* v419 (G6/G7): the pill family — one button construction in
   three dresses (Primary navy · Commit accent · Ghost) plus
   the one Small form at chip height. No call site changes:
   the classes stand, the forms change. */
button.btn { font-family:var(--sans); background:var(--navy); color:var(--cream); border:none; border-radius:999px; padding:10px 20px; font-size:15px; font-weight:600; min-height:44px; cursor:pointer; }
button.btn.gold { background:var(--accent); color:var(--accent-ink); padding:10px 22px; font-weight:700; }
button.btn.ghost { background:none; color:var(--navy); border:1px solid var(--line); padding:9px 16px; font-weight:400; }
button.btn.small { height:44px; min-height:44px; padding:0 14px; font-size:14px; }
button.btn.danger { background:var(--danger); color:#ffffff; padding:10px 22px; font-weight:700; }
button.btn:disabled { opacity:.45; }
input[type=text], input[type=date], select, textarea { font-family:inherit; font-size:16px; width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:8px; background:#fff; color:var(--ink); }
textarea { min-height:64px; resize:vertical; }
label.f { display:block; font-size:13px; letter-spacing:.6px; text-transform:uppercase; color:var(--muted); margin:10px 0 4px; font-family:var(--sans); }
.row { display:flex; align-items:center; gap:8px; }
.grow { flex:1; }
.stats { display:flex; gap:8px; margin:0 0 12px; }
.stat { flex:1; text-align:center; background:var(--card); border:1px solid var(--line); border-radius:10px; padding:8px 2px; }
.stat b { display:block; font-size:19px; color:var(--navy); font-weight:normal; }
.stat span { font-size:13px; letter-spacing:.5px; text-transform:uppercase; color:var(--muted); font-family:var(--sans); }
/* v419 (G8): .pri is the Label chip — not tappable, so no
   floor: 12px sans, the Set dress (accent border + text). */
.pri { font-size:12px; font-family:var(--sans); letter-spacing:1px; padding:2px 8px; border-radius:999px; border:1px solid var(--accent); color:var(--accent-text); white-space:nowrap; }
.pri.H { background:var(--accent); color:var(--accent-ink); }
.audiobar { display:flex; flex-wrap:wrap; gap:6px; }
/* v419 (G8): the one chip construction — .chip, .chipbtn,
   .settoggle share radius, height, padding, face, ground,
   and border; the On dress is the accent fill. */
.chipbtn { font-family:var(--sans); font-size:14px; border:1px solid var(--line); background:var(--card); border-radius:999px; padding:7px 14px; min-height:44px; cursor:pointer; color:var(--ink); }
.chipbtn.playing { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); font-weight:600; }
.chipbtn.missing { opacity:.55; border-style:dashed; }
.playbtn { width:42px; height:42px; border-radius:50%; border:none; background:var(--accent); color:var(--accent-ink); font-size:16px; cursor:pointer; flex:none; }
.podmark { flex:none; min-width:44px; min-height:44px; border-radius:50%; border:1px solid var(--line, #ccc); background:transparent; color:var(--ink); font-size:15px; cursor:pointer; padding:4px 8px; }
.podmark.on { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
.podmark-wrap { flex:none; display:flex; flex-direction:column; align-items:center; gap:2px; }
.playbtn.playing { background:var(--navy); }
.spot { display:inline-block; margin-top:5px; font-size:14px; color:var(--accent-text); }
/* v363 §2.3: the .notavail rule retires with its last row use —
   the not-available signal folds into the row's meta line. */
.readtext { font-size:17px; line-height:1.7; white-space:pre-wrap; margin-top:10px; }
/* Intention rows (v361, replacing the v338 combined row and
   v343's uniform 136px form): the intention intro stands as its
   OWN standard .card. The intention text stands as the row's
   second line under its clamp; overflow sits behind the
   ellipsis (⋯), which stands only when the text is actually
   clamped (armed by measurement in the client). An expanded
   row's text unclamps in place. Retired with the combined row
   (v361 §2.6): the 136px .card.intro-row rule, the 25%
   .intention-panel rule, .intention-label, .panel-foot, and
   the combined expanded rules.
   v363 §2.5 (D1 + D3-A): the row stands at the uniform 76px
   (.trow, above), so the clamp is ONE line and the text's
   standing margin-bottom is zeroed — the collapsed stack
   (title + one text line, 49px) fits the 54px content box.
   The ⋯ is a flex child of the row in the trailing band
   (fixed 30x44, display:none until armed) — it adds width,
   never a line. An expanded row releases the fixed height
   (height:auto, overflow:visible) and collapses back to
   exactly 76px. */
.intention-text { line-height:1.4; margin-bottom:6px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.card.intention-row .intention-text { -webkit-line-clamp:1; margin-bottom:0; }
.ellipsis-btn { display:none; background:none; border:none; font-family:inherit; font-size:14px; line-height:1; color:var(--muted); cursor:pointer; padding:4px 2px; }
.ellipsis-btn.stands { display:inline-block; }
.card.intention-row .ellipsis-btn { flex:none; width:30px; height:44px; display:none; padding:0; align-items:center; justify-content:center; }
.card.intention-row .ellipsis-btn.stands { display:flex; }
.card.intention-row.expanded { height:auto; overflow:visible; }
.card.intention-row.expanded .intention-text { display:block; -webkit-line-clamp:none; overflow:visible; }
/* v411 §2.5: the small play disc at the 44px floor — the
   button box grows to 44px and the visible 30px disc is drawn
   centered as an ::after (the played-dot construction adapted
   to a filled disc); the glyph rides above the disc. Navy
   under .playing, mirroring .playbtn.playing. */
.playbtn.small { position:relative; z-index:0; width:44px; height:44px; font-size:12px; background:transparent; }
.playbtn.small::after { content:''; position:absolute; z-index:-1; left:7px; top:7px; width:30px; height:30px; border-radius:50%; background:var(--accent); }
.playbtn.small.playing::after { background:var(--navy); }
.chips { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 12px; }
/* v419 (G8): the one chip construction (see .chipbtn); the
   active chip takes the On dress — the accent fill replaces
   the navy fill, dress only. */
.chip { font-family:var(--sans); font-size:14px; padding:7px 14px; min-height:44px; border-radius:999px; border:1px solid var(--line); background:var(--card); color:var(--ink); cursor:pointer; }
.chip.active { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); font-weight:600; }
/* v442 §2: the Examination commandment chips stand as
   exactly ONE row that scrolls sideways — never wrapped. */
.examchips { flex-wrap:nowrap; overflow-x:auto; }
.examchips .chip { flex:0 0 auto; }
/* v410 §2.3: the merged tabs' segmented toggle — ONE control
   serving both merged tabs, drawn from the standing tokens
   (the .modes frame; the current side marked in the
   .tab.active inset-accent language). */
/* v414 §2.7 (FD6): the freeze — ONE shared sticky rule for
   the three segmented toggles (Phone | Watch · Prayers |
   Intentions · Examination | Confession): the toggle pins
   directly under the brand bar (already sticky, z-30) while
   the view's content scrolls beneath it. --brandh is the
   brand bar's measured height, set by the client at shell
   paint (the --tabh precedent); the 54px fallback is its
   standing height. Sticky adds no height and no offset, so
   a view shorter than the screen stands pixel-identical. */
/* v447 (John, 2026-11-15 14:26 CT): the tabbed pages sit
   BENEATH the frozen header and are NOT frozen — the toggle
   rows scroll with the page; the header alone is frozen.
   The sticky seat this rule carried retires. */
.segtoggle { display:flex; border:1px solid var(--line); border-radius:8px; overflow:hidden; margin:0 0 12px; background:var(--card); }
.segtoggle button { flex:1; font-family:inherit; font-size:15px; padding:8px; background:none; border:none; cursor:pointer; color:var(--muted); }
.segtoggle button.active { color:var(--navy); box-shadow: inset 0 -2px 0 var(--accent); }
/* v419 (G9): the Examination mode control is a second-row
   instance of the one segmented construction, in flow — it
   does not take the sticky rule (the tab's own segtoggle
   already pins above it). */
.segtoggle.inflow { position:static; }
.prompt { cursor:pointer; }
.prompt .ptext { font-size:17px; line-height:1.45; }
.entry { border-left:3px solid var(--accent); padding:6px 10px; margin:8px 0 0; background:#fff; font-size:16px; }
.entry .meta { margin-top:2px; }
.hidden { display:none !important; }
/* v419 (G13/G14): the sheet system — every sheet except Now
   Playing is a partway DRAWER: the .sheet element is the
   scrim overlay (a tap on it dismisses), its .inner is the
   panel (card ground, radius-16 top corners, the Sheet
   shadow), and mountDrawer (client.ts) prepends the grab
   strip, splits head/body/foot, sets the px heights (FIT
   max-height 85dvh · TALL height 92dvh, F-419-1), and wires
   the drag. The ghost Close/Done headers retire everywhere.
   Now Playing (.np-sheet) is the §3.10 exception: it keeps
   the full-height geometry and gains only the handle. */
.sheet { position:fixed; inset:0; z-index:50; background:rgba(23,18,12,.45); display:flex; flex-direction:column; justify-content:flex-end; align-items:center; overflow:hidden; animation:opnscrim .18s ease; }
.sheet .inner { background:var(--card); border-radius:16px 16px 0 0; box-shadow:0 -8px 24px rgba(42,38,32,.20); width:100%; max-width:640px; margin:0 auto; display:flex; flex-direction:column; overflow:hidden; max-height:85dvh; animation:opnrise .22s ease; }
.sheet.drawer-tall .inner { height:92dvh; max-height:92dvh; }
.sheet .panelbody { overflow-y:auto; padding:2px 14px 20px; flex:1 1 auto; min-height:0; }
.sheet:not(.np-sheet) .inner > .row, .sheet:not(.np-sheet) .inner > h1.screen { padding-left:14px; padding-right:14px; }
.sheet .panelfoot { background:var(--card-2); border-top:1px solid var(--line); padding:10px 14px; flex:none; }
.sheet:not(.np-sheet) .inner h1.screen { font-size:17px; }
.grabstrip { height:44px; flex:none; display:flex; align-items:center; justify-content:center; cursor:grab; touch-action:none; }
.grabpill { width:44px; height:5px; border-radius:999px; background:var(--muted); opacity:.55; display:block; }
.sheet.np-sheet { background:var(--cream); display:block; overflow:auto; padding:14px 14px 40px; animation:none; }
.sheet.np-sheet .inner { background:none; border-radius:0; box-shadow:none; display:block; overflow:visible; max-height:none; animation:none; }
.np-grab { display:flex; justify-content:center; padding:2px 0 8px; cursor:grab; touch-action:none; }
.np-grab .grabpill { background:var(--bar-fg); }
@keyframes opnrise { from { transform:translateY(24px); } to { transform:translateY(0); } }
@keyframes opnscrim { from { opacity:0; } to { opacity:1; } }
/* v419 (G15/F-419-2): the anchored menu — a floating card by
   its control (the tap-catcher beneath it is invisible; the
   card's dress is the Raised shadow on card ground). The
   title is the card's group head; rows re-dress inside the
   card's 6px padding. */
.menucatcher { position:fixed; inset:0; z-index:65; }
.anchmenu { position:fixed; z-index:70; background:var(--card); border:1px solid var(--line); border-radius:14px; box-shadow:0 12px 32px rgba(42,38,32,.20); padding:6px; overflow-y:auto; animation:opnrise .18s ease; }
.anchmenu h1.screen { font-size:12px; font-family:var(--sans); letter-spacing:1px; text-transform:uppercase; color:var(--muted); margin:4px 8px 6px; }
.anchmenu .menurow { background:none; border:none; margin:0; border-radius:10px; font-size:15px; }
/* v419 (G23): the confirm drawer — the act named in one
   serif sentence, Ghost Cancel + the Commit (danger where
   the act is destructive) in the foot bar. */
.confirmline { font-size:17px; line-height:1.5; padding:6px 14px 4px; margin:0; }
/* v419 (G21): skeletons — blocks in the screen's own
   geometry, the one deeper surface step, standing still. */
.skel { background:var(--card-2); border-radius:14px; }
.skelbar { display:block; height:12px; border-radius:6px; background:var(--card-2); margin:7px 0; }
.skelrow { margin:2px 0; }
/* v419 (G31): the series collapse row — a card-form
   disclosure: chevron (rotates on expansion) · the count
   line · the Show/Hide word. */
.podcollapse { width:100%; display:flex; align-items:center; gap:8px; text-align:left; font-family:inherit; font-size:17px; color:var(--navy); cursor:pointer; }
.podchev { display:inline-block; transition:transform .2s ease; color:var(--muted); flex:none; }
.podchev.open { transform:rotate(90deg); }
.daynav { display:flex; align-items:center; gap:10px; margin:0 0 6px; }
.daynav .dlabel { flex:1; text-align:center; font-size:16px; color:var(--navy); }
.count { font-size:14px; color:var(--accent-text); font-family:var(--sans); }
.err { color:var(--danger); font-size:15px; }
.about { margin-top:22px; font-size:14px; color:var(--muted); line-height:1.6; }
.gearbtn { margin-left:auto; background:none; border:none; color:var(--bar-fg); font-size:20px; line-height:1; cursor:pointer; padding:0; width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; flex:none; position:relative; }
.gearbtn::after { content:''; position:absolute; inset:-4px; }
.setrow { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px 12px; margin:0 0 8px; }
.setrow .setname { font-size:17px; color:var(--navy); }
.setcontrols { display:flex; align-items:center; gap:6px; margin-top:8px; flex-wrap:wrap; }
.setcontrols select { width:auto; flex:1; min-width:110px; }
.setcontrols .mvbtn { font-family:inherit; font-size:15px; border:1px solid var(--line); background:#fff; border-radius:8px; padding:8px 10px; cursor:pointer; flex:none; }
.setcontrols .mvbtn:disabled { opacity:.35; cursor:default; }
/* v419 (G8): the settoggle takes the one chip construction
   — its rest border moves from --accent to --line. */
.settoggle { font-family:var(--sans); font-size:14px; border:1px solid var(--line); color:var(--accent-text); background:var(--card); border-radius:999px; padding:7px 14px; min-height:44px; cursor:pointer; flex:none; white-space:nowrap; }
.settoggle.on { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); font-weight:600; }
/* Now Playing (v336) */
/* v354 §2.1/§2.2/§2.7: the clone form — a liturgical-gradient hero
   (.np-hero) over the standing cream zone. The hero reads the v352
   token layer only: --bar-solid under --bar-bg (gradient-parse
   insurance), the audited fg/sub pairs for title + meta + the day
   line, and the accent as its bottom rule. No new variables. */
.np-hero { margin:-14px -14px 0; padding:14px 14px 18px; background-color:var(--bar-solid); background:var(--bar-bg); border-bottom:2px solid var(--accent); }
.np-hero .np-title { color:var(--bar-fg); font-size:24px; }
.np-hero .np-meta { color:var(--bar-sub); }
.np-litday { font-size:13px; letter-spacing:.4px; color:var(--bar-sub); text-align:center; margin-top:2px; }
.np-intention { font-size:14px; line-height:1.45; letter-spacing:.2px; color:var(--bar-sub); text-align:center; margin-top:6px; }
.np-hero .btn.ghost { color:var(--bar-fg); border-color:var(--bar-sub); }
.np-preview .np-hero .npq-heading { color:var(--bar-fg); }
.np-preview .np-hero #np-queue-pos { color:var(--bar-sub); }
.np-art { position:relative; width:min(72vw, 340px); aspect-ratio:1; margin:4px auto 0; }
.np-art .blockcover.hero { position:absolute; inset:0; border-radius:18px; box-shadow:0 10px 28px rgba(0,0,0,.28); }
.np-art .blockcover.hero .blockcover-initial { font-size:128px; }
.np-art img.np-art-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; border-radius:18px; box-shadow:0 10px 28px rgba(0,0,0,.28); }
[data-lit="white"] .np-art .blockcover.hero, [data-lit="white"] .np-art img.np-art-img { box-shadow:0 10px 28px rgba(168,134,58,.25); }
/* v354 §2.5F: the measured boundary for accent discs standing on a
   gradient zone (v353's block-page Play All + home card play
   buttons) — an outline in the bar-fg pair, >= 4.88:1 against both
   gradient ends in every theme. */
.blockpage-head .playbtn, .blockcard .playbtn { box-shadow:0 0 0 2px var(--bar-fg); }
.np-title { text-align:center; }
.np-meta { text-align:center; }
.np-seekrow { display:flex; align-items:center; gap:10px; margin:22px 0 6px; font-size:13px; color:var(--muted); }
.np-seekrow input[type=range] { flex:1; accent-color:var(--accent); height:28px; cursor:pointer; }
.np-seekrow input[type=range]:disabled { cursor:default; opacity:.5; }
.np-transport { display:flex; align-items:center; justify-content:center; gap:26px; margin:16px 0 20px; }
.np-tbtn { background:none; border:none; color:var(--navy); font-family:inherit; font-size:26px; cursor:pointer; padding:10px; }
.np-tbtn:disabled { opacity:.35; cursor:default; }
.np-play { width:58px; height:58px; font-size:21px; }
.np-controls { justify-content:center; flex-wrap:wrap; }
.npq-head { display:flex; align-items:baseline; gap:8px; margin:18px 0 8px; border-bottom:2px solid var(--accent); padding-bottom:4px; }
.npq-heading { font-size:16px; letter-spacing:1.5px; color:var(--navy); }
/* v419 (G24): queue rows join the Compact form inside a
   .liblist container — the row's own frame (border, radius,
   margin) retires; rows separate by the container's
   hairlines; the 76px Compact height stands. */
.npq-row { display:flex; align-items:center; gap:8px; width:100%; text-align:left; background:none; border:none; border-radius:0; padding:10px 12px; margin:0; font-family:inherit; font-size:17px; color:var(--ink); cursor:pointer; height:76px; overflow:hidden; }
.npq-row + .npq-row { border-top:1px solid var(--line); }
.npq-row:disabled { opacity:.55; cursor:default; }
.npq-row.playing { box-shadow:inset 0 0 0 1px var(--accent); }
.npq-row.npq-intro .npq-title { color:var(--muted); font-size:15px; }
.npq-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.npq-title { color:var(--navy); }
/* v363 §2.6: queue rows stand at the same uniform 76px on
   their own frame (the standing min-height:44px is superseded
   by the fixed height and is out); title and meta ellipsize
   to one line (D2), and the preview's "Starts here" folds
   into the meta line in the client (no third line stands). */
.npq-title { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.npq-meta { font-size:14px; font-family:var(--sans); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
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
.pinpad button { font-family:inherit; font-size:20px; color:var(--navy); background:var(--card); border:1px solid var(--line); border-radius:50%; width:64px; height:64px; cursor:pointer; }
.pinpad button:disabled { opacity:.35; cursor:default; }
.pinpad .pinblank { visibility:hidden; }
.pinmsg { min-height:22px; font-size:15px; font-family:var(--sans); color:var(--danger); margin:8px 0 2px; }
.pinmsg.wait { color:var(--muted); }
@keyframes pinshake { 0%,100% { transform:translateX(0); } 20% { transform:translateX(-9px); } 40% { transform:translateX(9px); } 60% { transform:translateX(-6px); } 80% { transform:translateX(6px); } }
.shake { animation: pinshake .45s ease; }
.recoverycode { font-size:20px; letter-spacing:2px; color:var(--navy); text-align:center; margin:16px 0; }
.pinsection { margin-top:22px; }
/* UI overhaul B (v353): the clone structure — Listen home block
   cards, block pages in playlist form, the search pill, the
   Library list language, and the shared section header. Gradient
   surfaces read the --bar-* set (v352 §2.7's token contract);
   accents read --accent/--accent-ink; body/cream/ink are never
   themed. (The combined-row exemption that stood here lapsed
   at v361: the combined row retired, and intention rows are
   ordinary standard cards under the geometry that stands.) */
.sectionhead { font-size:16px; letter-spacing:1.5px; color:var(--navy); font-weight:normal; text-transform:uppercase; margin:18px 0 8px; border-bottom:2px solid var(--accent); padding-bottom:4px; }
.blockgrid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:0 0 10px; }
.blockcard { position:relative; background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; cursor:pointer; }
.blockcard-face { background-color:var(--bar-solid); background:var(--bar-bg); color:var(--bar-fg); padding:12px 12px 10px; min-height:76px; }
.blockcard-name { font-size:17px; letter-spacing:1.2px; color:var(--bar-fg); }
.blockcard-cap { font-size:13px; font-family:var(--sans); color:var(--bar-sub); margin-top:3px; }
.blockcard-meta { font-size:13px; font-family:var(--sans); color:var(--muted); padding:2px 62px 8px 8px; }
.blockcard-play { position:absolute; right:10px; bottom:10px; }
/* v419 (G10): the gradient head is its own frozen zone —
   the head (with its back row) pins under the brand bar
   while the rows scroll beneath it (§4.1). */
.blockpage-head { margin:-14px -14px 12px; padding:12px 14px 14px; background-color:var(--bar-solid); background:var(--bar-bg); color:var(--bar-fg); position:sticky; top:var(--brandh, 54px); z-index:24; }
.backrow { margin:0 0 6px; }
/* v419 (G10): the series page's back row pins the same way,
   on the cream ground (the segtoggle pattern). */
.backrow.stickyrow { position:sticky; top:var(--brandh, 54px); z-index:25; background:var(--cream); }
/* v419 (G10, folded from v418): the back button is a navy
   disc — 44px, cream chevron, the Disc shadow — on every
   page that carries one. The text .backbtn retires. */
.backdisc { width:44px; height:44px; border-radius:50%; border:none; background:var(--navy); color:var(--cream); font-family:inherit; font-size:22px; line-height:1; cursor:pointer; box-shadow:0 2px 6px rgba(42,38,32,.25); display:inline-flex; align-items:center; justify-content:center; padding:0 0 2px; flex:none; }
/* v447: the iOS-style bar — one slim bar at the top of every
   pushed page (client.ts iosBarHtml). The frozen layer is
   the header alone (John, 2026-11-15 14:26 CT): the brand
   bar, and on pushed pages this bar under it — sticky at
   the brand height where it stands in the page flow; inside
   a sticky head (.inhead) the head is the frozen element
   and the bar stands static, bled to the head's edges.
   Dress: the light iOS grey-white ground; the chevron, the
   back name, and the right-side acts read var(--accent-text)
   — the standing theme token that carries the day's
   liturgical color for text on a light ground (§2.7); the
   centered title reads the ink, bold. */
.iosbar { display:flex; align-items:center; height:44px; padding:0 6px; background:#f8f8f6; border-bottom:1px solid var(--line); position:sticky; top:var(--brandh, 54px); z-index:25; margin:0 0 6px; }
.blockpage-head .iosbar.inhead { position:static; margin:-12px -14px 10px; padding:0 8px; border-bottom:1px solid rgba(42,38,32,.16); }
.blockpage-head.compact .iosbar.inhead { margin:-4px -14px 8px; }
.iosbar-back { display:inline-flex; align-items:center; gap:1px; background:none; border:none; padding:0 8px 0 2px; min-height:44px; min-width:44px; cursor:pointer; color:var(--accent-text); font-family:var(--sans); font-size:17px; flex:none; position:relative; z-index:1; }
.iosbar-back:active { opacity:.55; }
.iosbar-chev { font-family:Georgia, 'Times New Roman', serif; font-size:25px; line-height:1; padding-bottom:3px; }
.iosbar-name { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:112px; }
.iosbar-title { position:absolute; left:50%; transform:translateX(-50%); max-width:44%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:700; font-size:17px; color:var(--ink); text-align:center; pointer-events:none; }
.iosbar-right { margin-left:auto; display:flex; align-items:center; gap:6px; flex:none; position:relative; z-index:1; min-height:44px; }
.iosbar .btn.ghost { color:var(--accent-text); border-color:transparent; background:transparent; }
.blockpage-title { font-size:28px; letter-spacing:1.5px; color:var(--bar-fg); }
.blockpage-meta { font-size:14px; color:var(--bar-sub); margin-top:4px; }
.blockpage-playrow { display:flex; align-items:center; gap:10px; margin-top:12px; }
.blockpage-playlabel { font-size:16px; color:var(--bar-fg); }
.playbtn.big { width:56px; height:56px; font-size:20px; }
.blockpage-head .spot { color:var(--bar-fg); margin-top:0; }
.blockpage-head .btn.ghost { color:var(--bar-fg); border-color:var(--bar-sub); }
/* v420 §2.3: the compressed block head — three rows inside
   the standing frozen element. Every divergence rides the
   .compact scope, so the episodes page's head — the same
   classes without .compact — keeps the v419 form untouched
   (F-420-7). v422 §2.7: the head proper is now 94px
   (padding 4/4 · cover row 56 · pill line 28 at a 2px gap)
   — the Play All row retired; the disc and the ⋮ ride Row
   1's trailing cluster (§2.6). §2.4/§2.7: the head sticks
   FLUSH with the frozen toggle band — brand height + 46px
   (46 = the toggle's painted band: its 44px button + its
   two 1px borders). v420's +58px offset carried a +12px
   margin allowance — the retired defect: the unpainted
   slot scrolled rows showed through. If the toggle's
   construction changes, the offset is re-derived in the
   same change. v447 (John, 2026-11-15 14:26 CT): the
   toggle is NOT frozen — the tabbed pages sit beneath the
   frozen header and scroll under it — so the head
   re-seats FLUSH under the brand bar (top var(--brandh))
   and the +46px toggle allowance retires with the freeze.
   The head proper is now the iOS bar (44) + cover row 56
   + pill line 28 over the 4/4 padding. */
.blockpage-head.compact { padding:4px 14px; top:var(--brandh, 54px); }
.blockpage-head.compact .blockpage-cluster { display:flex; align-items:center; gap:8px; flex:none; }
.blockpage-head.compact .playbtn.big { width:44px; height:44px; }
.blockpage-coverrow { display:flex; align-items:center; }
.blockpage-head.compact .backdisc { width:36px; height:36px; font-size:19px; position:relative; margin-right:8px; }
.blockpage-head.compact .backdisc::after { content:''; position:absolute; inset:-4px; }
.blockcover.med { width:56px; height:56px; border-radius:10px; flex:none; }
.blockcover.med .blockcover-initial { font-size:28px; }
.blockpage-stack { flex:1; min-width:0; margin-left:10px; }
.blockpage-head.compact .blockpage-meta { margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.blockpage-pillrow { display:flex; align-items:center; gap:8px; margin-top:2px; }
.blockpage-pillrow .chipbtn { background:transparent; color:var(--bar-fg); border-color:var(--bar-sub); }
.blockpage-head.compact .chipbtn { min-height:0; padding:5px 12px; position:relative; }
.blockpage-head.compact .chipbtn::after { content:''; position:absolute; inset:-8px 0; }
.blockpage-pillrow .blockpage-dlnote { margin-top:0; flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.blockpage-head.compact .blockpage-playrow { margin-top:6px; }
/* v419 (G26): the search field gains its leading glyph;
   its focus takes the §3.12 accent border (the G20 field
   rule below). */
.searchpill { margin:0 0 12px; position:relative; }
.searchpill::before { content:'⌕'; position:absolute; left:14px; top:50%; transform:translateY(-50%); color:var(--muted); font-family:var(--sans); font-size:17px; pointer-events:none; }
.searchpill input { width:100%; height:44px; border-radius:999px; border:1px solid var(--line); background:var(--card); padding:0 16px 0 38px; font-family:inherit; font-size:16px; color:var(--ink); -webkit-appearance:none; appearance:none; }
/* v425 §2.2: the merged home line — the search pill and the
   filter chips share one 44px row (the chips row retires;
   56px banked). Scoped to .searchrow only: the global
   .searchpill / .chips / .chip rules stand untouched (the
   chip construction is shared — Settings, Examination). */
.searchrow { display:flex; gap:8px; align-items:center; margin:0 0 12px; }
.searchrow .searchpill { flex:1 1 auto; min-width:0; margin:0; }
.searchrow .chips { flex:0 0 auto; flex-wrap:nowrap; margin:0; }
.searchrow .chip { padding:7px 10px; }
.liblist { background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden; margin:0 0 12px; }
.librow { padding:10px 12px; }
.librow + .librow { border-top:1px solid var(--line); }
.liblist .setrow { border:none; border-radius:0; margin:0; background:none; }
.liblist .setrow + .setrow { border-top:1px solid var(--line); }
.stats { gap:0; background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
.stat { background:none; border:none; border-radius:0; }
.stat + .stat { border-left:1px solid var(--line); }
/* v411 §2.3: the back button's cream-ground variant — navy
   text (13.72:1 on cream), taken at the Podcasts series-page
   paint site only. The dark-ground dress stands untouched. */

/* v411 §2.5: ONE 44px floor — no tappable element under 44px
   in its tap dimension, on the class families, never
   per-element patches. Visible shapes grow only where
   padding alone cannot carry the target; where a fixed
   construction stands (the 76px track row, the remove link's
   line), the standing negative-margin / padding construction
   carries the hit box without moving a glyph. */
.chip { min-height:44px; display:inline-flex; align-items:center; }
.chipbtn { min-height:44px; display:inline-flex; align-items:center; justify-content:center; }
.settoggle { min-height:44px; }
button.btn.small { min-height:44px; }
.card.trow .trow-tail .btn.small { margin-top:-7px; margin-bottom:-7px; }
.setcontrols .mvbtn { min-height:44px; min-width:44px; }

.segtoggle button { min-height:44px; }
#set-wallpaper .btn, #set-wallpaper select { min-height:44px; }
[data-del-entry] { display:inline-block; padding:15px 8px; margin:-15px -8px; }
/* v411 §2.6: the forms standard's inline line — one slot
   under the field, in the standing meta grey; it reserves no
   height while empty. */
.fieldnote { font-size:14px; font-family:var(--sans); color:var(--muted); margin:6px 0 0; }
.fieldnote:empty { display:none; }
/* v414: the Wallpaper tab's two views — the showing-now row,
   the artwork carousel (one component, both views), the
   off state's intro, and the Watch instructions block. The
   carousel stage stands on the theme ground (--bar-*); the
   filed picture shows WHOLE inside it (object-fit: contain)
   regardless of Picture fit, which governs the engine's
   screen apply only. Dots are 44px tap targets carrying a
   10px indicator (the played-dot construction); arrows are
   44px boxes — the v411 floor covers every new control. */
.wpshowing { display:flex; gap:12px; align-items:center; }
.wpshowing img { width:64px; height:64px; object-fit:contain; background:var(--bar-solid); border-radius:8px; flex:none; }
.wpshowing .wpname { font-size:17px; color:var(--navy); }
.wpcar { display:flex; align-items:center; gap:6px; margin:0 0 6px; }
.wpcar-stage { flex:1; height:320px; background-color:var(--bar-solid); background:var(--bar-bg); border-radius:12px; overflow:hidden; }
.wpcar-stage img { width:100%; height:100%; object-fit:contain; display:block; }
.wpcar-arrow { flex:none; width:44px; height:44px; border-radius:50%; border:1px solid var(--line); background:var(--card); color:var(--navy); font-family:inherit; font-size:20px; cursor:pointer; }
.wpcar-title { font-size:17px; color:var(--navy); margin:2px 0 0; }
.wpcar-dots { display:flex; justify-content:center; margin:0 0 6px; }
.wpcar-dot { width:44px; height:44px; padding:0; background:none; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.wpcar-dot::after { content:''; width:10px; height:10px; border-radius:50%; border:1px solid var(--line); background:transparent; }
.wpcar-dot.on::after { background:var(--accent); border-color:var(--accent); }
.wpoff-title { font-size:22px; color:var(--navy); margin:2px 0 8px; font-weight:normal; }
/* v413: the playlist grammar — cover tiles (four theme tones,
   drawn, no images), row art with the provider-img overlay,
   the re-dressed row form, sheet menus, and the block-page
   head's new lines. All from the standing tokens. */
.tone-navy { background:linear-gradient(135deg, #16283f, #22385a); }
.tone-gold { background:linear-gradient(135deg, #a8863a, #c39f4e); }
.tone-plum { background:linear-gradient(135deg, #4a2545, #5f3460); }
.tone-teal { background:linear-gradient(135deg, #173f3a, #1f554e); }
.blockcover { position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; }
.blockcard > .blockcover { height:64px; border-radius:12px 12px 0 0; }
.blockcover-initial { font-size:28px; color:#e9d9ae; }
.blockcard > .blockcover .blockcover-initial { font-size:28px; }
.tone-gold > .blockcover-initial, .rowart.tile.tone-gold { color:#16283f; }
.blockcover.large { width:120px; height:120px; border-radius:12px; margin:6px 0 10px; }
.blockcover.large .blockcover-initial { font-size:56px; }
.blockcover.sm { width:44px; height:44px; flex:none; border-radius:8px; }
.blockcover.sm .blockcover-initial { font-size:20px; }
.blockcover .coverimg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.blockcard-name2 { font-size:16px; color:var(--navy); padding:6px 8px 0; }
.rowartwrap { position:relative; width:44px; height:44px; flex:none; border-radius:8px; overflow:hidden; display:inline-block; }
.rowartwrap > .rowart { position:absolute; inset:0; width:44px; height:44px; }
img.rowart { object-fit:cover; display:block; }
.rowart.tile { display:flex; align-items:center; justify-content:center; font-size:20px; color:#e9d9ae; }
.card.trow.prow { height:auto; min-height:76px; overflow:visible; }
.card.trow.prow h3 { white-space:normal; }
.card.trow.prow .meta { white-space:normal; }
.snippet { font-size:14px; font-family:var(--sans); color:var(--muted); line-height:1.35; margin:2px 0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.rowcluster { display:inline-flex; align-items:center; gap:2px; flex:none; }
.iconbtn { background:none; border:none; font-family:inherit; font-size:19px; color:var(--navy); cursor:pointer; min-width:44px; min-height:44px; display:inline-flex; align-items:center; justify-content:center; border-radius:8px; padding:0 6px; }
.iconbtn.light { color:var(--bar-fg); }
.dl-ico { color:var(--accent-text); font-size:15px; padding:0 2px; flex:none; }
.menurow { display:flex; align-items:center; gap:8px; width:100%; text-align:left; background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px 12px; margin:0 0 8px; font-family:var(--sans); font-size:17px; color:var(--ink); cursor:pointer; min-height:44px; }
.blockpage-desc { font-size:15px; color:var(--bar-sub); margin-top:4px; }
.blockpage-owner { font-size:14px; letter-spacing:1px; color:var(--bar-fg); margin-top:6px; }
.blockpage-dlrow { display:flex; align-items:center; gap:8px; margin-top:10px; }
.blockpage-dlrow .chipbtn { background:transparent; color:var(--bar-fg); border-color:var(--bar-sub); }
.blockpage-head .meta { color:var(--bar-sub); }
.blockpage-dlnote { margin-top:4px; }
.podpage-head { margin:0 0 12px; }
/* v434 §2.6.1: the Podcasts watch view — the frame's seat is a
   stable full-width 16:9 box; the frame exists only while the
   view stands (created at its paint, destroyed by closeWatch).
   a.btn mirrors button.btn/button.btn.ghost so the standing
   Open in YouTube anchor wears the same dress. */
.watchtitle { font-size:19px; font-weight:600; margin:0 0 10px; }
.watchframe-wrap { position:relative; width:100%; aspect-ratio:16/9; background:#000; border-radius:12px; overflow:hidden; margin:0 0 10px; }
.watchframe-wrap iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }
a.btn { display:inline-flex; align-items:center; font-family:var(--sans); background:var(--navy); color:var(--cream); border:none; border-radius:999px; padding:10px 20px; font-size:15px; font-weight:600; min-height:44px; text-decoration:none; cursor:pointer; }
a.btn.ghost { background:none; color:var(--navy); border:1px solid var(--line); padding:9px 16px; font-weight:400; }
.sortrow { margin:0 0 10px; }
/* v417 §2.9 (FD8): the polish density on prow rows — tighter
   padding and row gap; text sizes all stand (D1). §2.4's
   controls line (.prow-ctl) stands under the words line,
   right-aligned, ruled off by the standing line color; the
   played dot's one-line-row negative margins zero in the
   prow form (its 44px box stands). */
.card.trow.prow { padding:8px 10px; margin-bottom:8px; }
.prow-ctl { display:flex; justify-content:flex-end; align-items:center; gap:8px; margin-top:6px; padding-top:6px; border-top:1px solid var(--line); }
.card.trow.prow .played-dot { margin:0; }
/* v424 §2.2: the one-box card — the controls ride inside
   .grow: the cluster in the title line, Read + the ⤓
   trailing the meta line. Every rule scopes to the new
   classes (.titlerow · .prow-cluster · .metarow): a
   .card.trow.prow .playbtn rule would also match the
   podcast rows' disc (FD7 — §2.5's named trap). */
.titlerow { display:flex; align-items:center; gap:8px; }
.titlerow h3 { flex:1; min-width:0; margin-bottom:0; }
.prow-cluster { display:inline-flex; align-items:center; gap:8px; flex:none; }
.prow-cluster .playbtn { width:44px; height:44px; }
.metarow { display:flex; align-items:center; gap:8px; }
.metarow>span:first-child { flex:1; min-width:0; }
/* v417 §2.6 (FD7): the bars tile — stands in the current
   row's art wrap in place of its art/glyph (tone-navy
   ground, bars in the theme accent; no Spotify green). The
   bars animate only while the transport plays; under
   .barspaused the animation stands paused (frozen bars). */
.barstile { position:absolute; inset:0; display:none; align-items:center; justify-content:center; gap:2px; background:linear-gradient(135deg, #16283f, #22385a); }
.barstile i { display:block; width:3px; background:var(--accent); transform-origin:center; animation:opnbars .8s ease-in-out infinite alternate; }
.barstile i:nth-child(1) { height:9px; animation-delay:-.25s; }
.barstile i:nth-child(2) { height:16px; animation-delay:-.55s; }
.barstile i:nth-child(3) { height:12px; animation-delay:-.4s; }
.barsrow .barstile { display:flex; }
.barsrow .rowartwrap > .rowart { display:none; }
.barspaused .barstile i { animation-play-state:paused; }
@keyframes opnbars { from { transform:scaleY(.4); } to { transform:scaleY(1); } }
/* v419 (G19/G20/G32): the foundations.
   G19 pressed: ONE inset ink overlay shades the control's
   own surface by its own 12% (F-419-4 — the theme tokens are
   read, never redefined; the overlay darkens the accent fill
   under its own ink on all six days). The play disc and the
   back disc also scale. The PIN pad's bespoke :active
   retires into this rule.
   G20 focus: one visible ring — 3px navy outside the control
   on the cream ground; on the bar surfaces the ring reads
   the surface's own foreground (F-419-6). Fields take the
   accent border (the Search field included). */
button.btn:active, .chip:active, .chipbtn:active, .settoggle:active, .menurow:active, .tab:active, .segtoggle button:active, .iconbtn:active, .mvbtn:active, .playbtn:active, .podmark:active, .np-tbtn:active, .npq-row:active, .dock:active, .backdisc:active, .wpcar-arrow:active, .pinpad button:active { box-shadow:inset 0 0 0 999px rgba(42,38,32,.12); }
.playbtn:active, .backdisc:active { transform:scale(.98); }
:focus-visible { outline:3px solid var(--navy); outline-offset:2px; }
.brandbar :focus-visible, .tabbar :focus-visible, .dock :focus-visible, .np-hero :focus-visible, .blockpage-head :focus-visible { outline-color:var(--bar-fg); }
input:focus, select:focus, textarea:focus { border-color:var(--accent); }
@media (prefers-reduced-motion: reduce) {
  .sheet, .sheet .inner, .anchmenu, .podchev { animation:none; transition:none; }
}
/* G32: the wide rule — the reading column caps at 860px,
   the block grid takes three columns, and the brand bar's
   padding follows the cap. */
@media (min-width:900px) {
  .view { max-width:860px; }
  .blockgrid { grid-template-columns:1fr 1fr 1fr; }
  .brandbar { padding-left:max(14px, calc((100vw - 860px) / 2 + 12px)); padding-right:max(14px, calc((100vw - 860px) / 2 + 12px)); }
}
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
var CACHE = "ora-pro-nobis-v445-1";
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
    // v392 W8: the offline snapshot store (opn-offline-meta-v1)
    // survives activation on the same rule as the audio store.
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== "opn-ext-audio-v1" && k !== "opn-offline-meta-v1"; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
var SHELL_TIMEOUT_MS = 3000;
var shellInFlight = 0;
var shellStallStart = 0;
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (url.pathname.indexOf("/api/") === 0) return; // data + audio: network only
  if (SHELL.indexOf(url.pathname) !== -1) {
    // v429 §2.3: the shell set races the network against the
    // timeout. Fetch first: the fresh copy wins and is cached,
    // as before. Timer first: the pin cache answers on a hit;
    // on a miss the race stays open and the fetch decides, as
    // before. The losing fetch still lands its cache copy —
    // the fetch promise carries the put to completion, and
    // waitUntil keeps the event alive until it lands. The deadline
    // is anchored at the start of the current stall (the
    // first shell fetch still unsettled), so one hung open
    // pays the timeout once, not once per asset in sequence;
    // a shell fetch that starts with no stall standing gets
    // the full timeout of its own.
    if (shellInFlight === 0) shellStallStart = Date.now();
    shellInFlight++;
    var net = fetch(e.request).then(function (r) {
      var copy = r.clone();
      return caches.open(CACHE).then(function (c) { return c.put(e.request, copy); }).then(function () { return r; }, function () { return r; });
    });
    e.waitUntil(net.then(function () {
      shellInFlight--; if (shellInFlight === 0) shellStallStart = 0;
    }, function () {
      shellInFlight--; if (shellInFlight === 0) shellStallStart = 0;
    }));
    var delay = shellStallStart + SHELL_TIMEOUT_MS - Date.now();
    if (delay < 0) delay = 0;
    var timed = new Promise(function (resolve) {
      setTimeout(function () {
        caches.match(e.request).then(function (hit) { if (hit) resolve(hit); });
      }, delay);
    });
    e.respondWith(Promise.race([net, timed]).catch(function () { return caches.match(e.request); }));
    return;
  }
  e.respondWith(
    fetch(e.request).then(function (r) {
      var copy = r.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return r;
    }).catch(function () { return caches.match(e.request); })
  );
});
`;
