# v571 — Landing page: the root explains the concept

## 1 · Scope

Member 5 of 5 of the v567 redesign set (approved TO SHIP by John, 2026-11-20 23:01 CT; depends on v564, shipped live this night). The root of **orapronobis.media** becomes the landing page: it explains the concept to people in John's words — **free always · prayers going up, no accounts · data stays on the person's own phone** — carries an app-store links block, and has exactly ONE door: a **Start Praying** button into the web app at app.orapronobis.media. No sign-in language anywhere on the page.

The page publishes into the existing GitHub Pages site that already serves the root (no DNS change). The frozen podcast feed on the same domain stays untouched — the page keeps linking to it (Spotify + RSS), and the artifact builder keeps staging it byte-for-byte.

Store block posture (per the set plan): no store listings exist yet, so the block points at the web app (the full free tier, nothing to install) and at the Android APK by direct download at the stable name `ora-pro-nobis.apk`. When John's store listings exist, live badges take this block's place. The APK file itself lands with the night's APK build (the set's last build); the builder change that stages it ships in this release, guarded on the file's presence, so the APK step only adds the binary and re-deploys.

## 2 · Plan

- Replace `config/site/index.html` whole: brand header (logo + podcast links standing), a hero carrying the concept and the Start Praying door, three concept points (Free always · Your data stays on your phone · Prayers going up), the Get-the-app block (web app + Android APK), the podcast note (standing copy), the standing footer. Self-contained: inline styles, no external CSS/JS — nothing can 404 or block the door. The old daily-prayer home (site.js prayer list) retires from the root; the app itself is where the day's prayers live now.
- `scripts/build_pages_artifact.py`: one guarded addition — stage `config/site/ora-pro-nobis.apk` at the artifact root when the file stands there. Feeds, prayers.json, logo, and wallpaper staging untouched.
- `tests/test_publish_site.py`: the landing-page assertions move to the new contract (Start Praying + the app URL + the concept lines + the APK link + podcast.xml standing), replacing the retired "Today's prayer rhythm" assertion.
- Publish path: merge to main, push, dispatch the standing `deploy_pages.yml` workflow (the deploy-only Pages workflow), then verify the live root (200, the door, the concept) and that Start Praying reaches the app (app.orapronobis.media 200 — proven in v564 and re-checked), and that podcast.xml still serves.
- Gates: harness-v571 on the build tree + clean checkout; the repo's publish-site unit test; live proof after the deploy.

## 3 · Implement

Branch `release/v571` from main c58af73 (post-v564, with Track 1's v568 also landed); Implement commit `91be473`; Implement phase record 2285 (holder v571-chain-track2, contract 696).

- `config/site/index.html` — rewritten whole as planned (7,930 bytes, self-contained).
- `scripts/build_pages_artifact.py` — the guarded APK staging (+7 lines).
- `tests/test_publish_site.py` — landing assertions updated.
- `harness-v571.mjs` — the release's static gate (10 checks).

No change to: docs/podcast.xml, docs/intentions.xml, site.css, site.js, coming-soon.html, the workflows, or DNS.

## 4 · Review

Light review under the set's To-Ship approval (fresh seat; the streamlined path):

- **harness-v571: 10 ok / 0 not-ok** on the build tree (clean-checkout run at Ship): the Start Praying door's exact anchor, the concept copy, the store block, no sign-in door or login link, the podcast links standing, the old prayer-list home retired (no site.js mount), the builder's APK guard, the feeds' staging intact, the logo path, the page self-contained.
- **Unit test:** `python3 -m unittest tests.test_publish_site` — OK.
- **Copy check against the scope:** the three concept lines are the scope's own words (free always · prayers going up, no accounts · data stays on the person's own phone); the only occurrence of "sign-in" on the page is inside John's concept sentence "No accounts, no sign-in, nothing to buy" — a statement of the design, not a door; no login/signup link exists (harness S4).

## 5 · Ship

**SHIPPED LIVE 2026-11-21T08:38:00Z** (Pages deploy run 44885673939, success, on head b295270). What's New **387** ("A front door for Ora Pro Nobis") · registry row **1525 Live** (shippedAt 2026-11-21T08:38:00Z, whatsNewId 387, read back) · phases Implement 2285 · Review 2286 · Ship 2287, all passed · contracts 696/697/698 judged met + closed · GitHub main **b295270** (merge of release/v571) pushed by byte-identical replication — "main pushed · remote in sync".

- **Live proof (the real root):** https://orapronobis.media/ → 200 with the landing page (7,898 bytes): the Start Praying door anchor exact, the three concept lines present, the store block (web app + `ora-pro-nobis.apk`), the old prayer-list home gone (no playlist mount). Start Praying's target https://app.orapronobis.media/ → 200.
- **Frozen feed untouched:** https://orapronobis.media/podcast.xml → 200, the standing RSS (2,263,712 bytes); docs/podcast.xml and docs/intentions.xml carry no diff in this release.
- **APK link:** the store block's Android button points at `ora-pro-nobis.apk` on the site root; the file lands with the night's APK build (1.0.49), which adds the binary to config/site and re-dispatches this same deploy workflow — until that build lands (within the night), the link 404s. The builder guard shipped here makes that step a file drop, not a code change.
- **Field leg (John):** open https://orapronobis.media — the concept page with the gold Start Praying button; the button opens the app.
