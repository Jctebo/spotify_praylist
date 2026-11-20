# v555 — Wide daily images composed from the original artwork

- **Line:** Ora Pro Nobis
- **Status:** Scope — AMENDED 2026-11-20 13:41 CT: crop samples rejected; unique wide renders with the name in the image presented, held at John's verdict on the renders (nothing builds before the verdict)
- **Registry:** DevOps Board row 1499 · Scope record 2220 · Scope contract 633 (holder v555-scope)
- **Relay intake:** Goals Board task 1056

## 1 · Scope

DIRECTION (John, Ora thread, 2026-11-20 12:33 CT, verbatim): "But images are not good nfixnseeversixe how they look. They need to be 3 original images covering same seems not just the phone edited" · clarified the same minute: "Like phone and watch get seperate images"

DEFECT: the wide (desktop) composition is built from the PHONE-EDITED portrait, not from the original artwork. Verified from code at Scope (GitHub main a7742f8): runner/site_desktop.py `composite_desktop()` takes the phone file's bytes as its only source — the portrait the phone render already cropped and titled — and builds the v535 frame from it: the portrait standing at full height, right-of-center, over a full-bleed ground of ITSELF heavily blurred. The wide frame therefore shows the phone edit twice (sharp pillar + blurred cover) instead of the painting covering the frame. Phone and watch each get their own composition from the original art (jobs/novena/devotional_wallpaper_render.py: `ImageOps.fit` of the raw art to the variant size, then the title overlay); the desktop step never touches the original art.

FIX SHAPE (SUPERSEDED 2026-11-20 13:41 CT by the amendment at the end of this section — kept as history): the desktop step composes each wide member from that member's ORIGINAL artwork — the same raw art the phone/watch renders fit from — cover-fit to the whole 1920×1080 frame (the render's own fit discipline: scale to cover, crop the overflow, no blurred ground, no portrait pillar, no added darkening). Per-member exactly as v554 ships them: the pick · the Gospel member · the monthly member · every further member under its subject name. Where the originals stand: the daily members' raw art in the production run dir (ora-runner-runs/<date>/wp-raw-<date>/, the files build_wallpapers.py renders the phone/watch finals from); the monthly member's raw art in the saint-of-the-day goal's monthly-devotion-wallpapers/art/ folder (media-generation-art-phone-<YYYY-MM>-*.webp), the art behind the staged monthly phone file.

WHAT DOES NOT CHANGE: the asset file names and role names (v554 Q3 A) · the publish route (one commit, one deploy dispatch) · the PC sync (it pulls whatever daily-wallpaper-desktop*.jpg files stand published) · v554's member set and enumeration · the phone/watch steps and their art.

OPEN AT PLAN (named, not decided at Scope): the cover-fit vertical anchor rule — a 1:2 portrait fit to 16:9 keeps a 630-of-2240px window, so the anchor decides which band of the scene stands (the samples below use per-scene anchors that keep each subject's head in frame; a standing rule — fixed anchor, upper-third anchor like the v535 cover layer, or a subject-aware anchor — is Plan's call, informed by John's verdict). The title overlay question rides with it: the phone render burns the title into its edit; a wide composition from the raw art carries no title unless Plan adds one.

SAMPLES (composed at Scope from the originals, production size 1920×1080, cover-fit, no blur, no pillar, no title — saved under ~/workspace/your_files/v555-wide-samples/ and presented in the Ora thread for John's verdict) — REJECTED by John 2026-11-20 13:41 CT (see the amendment below):
- Pick — saint-felix-de-valois: sample-wide-pick-saint-felix-de-valois.jpg (215,604 bytes; from wp-raw-2026-11-20/media-generation-felix-0-*.webp; fit anchor cy 0.24 — halo and face stand in frame)
- Gospel — jesus-cleanses-the-temple: sample-wide-gospel-jesus-cleanses-the-temple.jpg (273,562 bytes; from wp-raw-2026-11-20/media-generation-temple-0-*.webp; fit anchor cy 0.50)
- Monthly — holy-souls-in-purgatory: sample-wide-monthly-holy-souls-in-purgatory.jpg (289,624 bytes; from monthly-devotion-wallpapers/art/media-generation-art-phone-2026-11-0-*.webp — the art behind the staged monthly phone file, verified by scene; fit anchor cy 0.64 — gate, angel, and souls stand in frame)

VERDICT STEP (superseded by the amendment below): the chain holds here. The build (Plan → Implement → Review → Ship) follows John's verdict on the samples in the Ora thread; no production code changes, no desktop-step run, and no publish happen before it.

AMENDMENT — 2026-11-20 13:41 CT (John, Ora thread, verbatim): "No. Make 3 new images same objects like watches see unique. Make sure you have the name in it"

WHAT THE AMENDMENT CHANGES: the crop-from-original samples above are REJECTED — a cover-fit crop of the original artwork is not the wanted shape. NEW SPEC: each wide image is a NEW, UNIQUE wide render of the same subject — the way the watch gets its own unique image of the subject, not a crop or reframe of another surface's art — with the subject's NAME standing in the image: the name in gold serif on a navy band at the foot of the frame, per the renders presented below.

RENDERS PRESENTED (made in the Ora thread 2026-11-20, saved under ~/workspace/your_files/v555-wide-samples/, presented to John for his verdict — wide scenes covering the full frame, each carrying its name in gold serif on a navy band at the foot):
- Pick — saint-felix-de-valois: media-generation-gen-wide-saint-felix-de-valois-0-a6e39198-bffd-4229-86f3-b170c1b38a20.jpg
- Gospel — jesus-cleanses-the-temple: media-generation-gen-wide-jesus-cleanses-the-te-0-234ce1b6-4879-48f9-8f93-669f6669c7b1.jpg
- Monthly — holy-souls-in-purgatory: media-generation-gen-wide-holy-souls-in-purgato-0-1fc6ee8d-a591-40e9-bbfa-60d945065b60.jpg

STATE: AWAITING JOHN'S VERDICT on the renders. The build shape (Plan → Implement → Review → Ship) follows his verdict; no production code changes, no desktop-step run, and no publish happen before it.
