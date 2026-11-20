# v555 — Wide daily images composed from the original artwork

- **Line:** Ora Pro Nobis
- **Status:** Plan — verdict received 2026-11-20 13:42 CT ("Perfect. Push this"); chain running to Ship under the amended shape
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

## 2 · Plan

VERDICT (John, Ora thread, 2026-11-20 13:42 CT, verbatim): "Perfect. Push this" — the amended shape builds and ships. Plan record 2228 · contract 641 (holder v555-chain).

GENERATION ROUTE — decided from the code:
- How phone and watch get their art (the standing route): the nightly agent generates one raw per subject with the image tool into the run dir (ora-runner-runs/<date>/wp-raw-<date>/media-generation-<stem>-0-*.webp); build_wallpapers.py then renders each variant from the raw through jobs/novena/devotional_wallpaper_render.overlay_wallpaper_text — fit plus deterministic text. Text is never generated in this pipeline: the render module's vision QA rejects lettering in generated art, and its OCR QA verifies the code-drawn title.
- The wide member takes the same route one step further: the nightly agent generates ONE NEW wide raw per set member — 16:9, a full-frame scene of the member's subject, NO text in the image — into the same raw dir, named wide-<subject-slug>.<ext>, the subject slug being the member's production-filename slug (e.g. wide-saint-felix-de-valois.webp). This is exactly how the approved exemplars were produced (image-tool renders at 2048×1152, made in the Ora thread).
- site_desktop.py composes each member's final from its wide raw: cover-fit to 1920×1080 plus the name band below. The Drive phone file stops being a composition source for every member; pick_site_wallpaper's Drive rule still names the pick and phone_set_members still enumerates the set — the v554 member/role contract is untouched.

NAME BAND — composed deterministically in code, NOT generated in-image. Reasons: (1) the codebase's standing discipline — every name in this pipeline is drawn by code over generated art, because generated text garbles and the QA gates reject lettering in art; an unattended nightly step cannot re-roll a misspelled saint name. (2) The name is data — the member's subject — and must be exact every night. (3) The approved dress is flat and reproducible in code: an opaque navy band at the foot (measured on the three approved exemplars: navy ≈ RGB 10,28,60 · gold ≈ RGB 216,170,92), the name centered in EB Garamond — the pipeline's pinned font, config/devotional_images/fonts/EBGaramond-Regular.ttf — a gold double rule at the band's top edge, and gold corner flourishes drawn in the band. Band height 140 px at 1920×1080 (the exemplars' ~13% of frame height); the name auto-shrinks to fit 86% of the width.
- Display name from the subject slug: title-case, with small words (de · in · of · the · and · on · for · at · to · a) lowercase mid-name. Production checks: saint-felix-de-valois → Saint Felix de Valois · jesus-cleanses-the-temple → Jesus Cleanses the Temple · holy-souls-in-purgatory → Holy Souls in Purgatory.

MONTHLY MEMBER — the subject route is resolved: the amended step needs the monthly member's SUBJECT, not its original file. The subject stands in the monthly member's own production filename (holy-souls-in-purgatory__2026-11.jpg → holy-souls-in-purgatory), already extracted by wallpaper_rotate.subject_of inside phone_set_members. The nightly agent generates the monthly member's wide raw under that slug like any other member's. The Scope-stage blocker (no runner route to monthly originals) does not bind the amended shape.

STALE-EXTRA CLEANUP (John's standing word on the v554 line — the seat now works this line, so the fix-forward rides here): publish_desktop_set deletes, in the same commit, every standing assets/daily-wallpaper-desktop-<subject>.jpg that is NOT in the day's published set. The three fixed role assets (the pick · gospel · monthly names) are standing addresses and are never deleted — the diagnosed gap names subject-named extras only; a fixed asset whose member misses a night keeps its last image and the step WARNs, per the standing failure posture.

DEAD EXPECTATION — named plainly: v554's pick byte-identity is DEAD under the amended shape. The pick is now a new render plus band like every other member; no output of the new step is byte-comparable to v554's composition.

FAILURE POSTURE (standing, extended): a member with no wide raw standing WARNs and is skipped — the step never falls back to the phone-edit composition; the rejected shape never publishes again. A missing pick raw WARNs and exits 1 with nothing published. More than one wide raw for a subject: the first name alphabetically stands and the step WARNs.

HARNESS LEGS (new runner/test_site_desktop_wide.py, plus the v554 enumeration suite re-run):
1. display_name — the three production subjects plus saint-margaret-of-scotland, our-lady-of-sorrows, dedication-of-the-basilicas-of-saints-peter-and-paul.
2. wide_raw_for — a synthetic run dir: found per subject; a missing subject reads None.
3. compose_wide_member — a synthetic 2048×1152 raw composes to a 1920×1080 JPEG; the band foot is navy; gold name pixels stand in the band; the scene above the band is the fitted raw, not navy.
4. stale_extra_deletions — a synthetic head tree: exactly the stale subject-named extras are returned; fixed role names are never returned; today's extras are kept.
5. v554 enumeration regression — test_site_desktop_set.py stays green; the member/role contract is untouched.

FIXTURES FROM PRODUCTION SHAPES (Improvement D): the enumeration cases are the v554 harness's dated production days (2026-11-20 · 11-16 · 11-15 · 11-04 · 11-18); the band constants are measured from the three approved production exemplars in ~/workspace/your_files/v555-wide-samples/; the compose leg's raw is a synthetic image — a composition fixture, not a content fixture: the band geometry and dress are what stand under test.

CALLER UPDATE: the nightly job's desktop step W(d) gains the wide-raw generation step ahead of the site_desktop.py run (one new wide render per set member, saved as wide-<subject-slug> in the day's raw dir), and its stale v526 composition description is replaced by the amended shape. The job body is updated through the cron route with everything else preserved.

## 3 · Implement

Branch release/v555 (local) · commit e50566b on main bb979f8 · Implement record 2229 · contract 642 (holder v555-chain).

WHAT CHANGED — runner/site_desktop.py only (plus the new harness); the app Worker is untouched:
- compose_wide_member(raw, name): the member's own wide raw cover-fit to 1920×1080 (ImageOps.fit, the render module's fit discipline), then the name band drawn in code — opaque navy band (RGB 10,28,60) over the frame's foot 140 px, the name centered in gold (RGB 216,170,92) EB Garamond from the repo's pinned font (config/devotional_images/fonts/EBGaramond-Regular.ttf), auto-shrunk to fit 86% of the width, a gold double rule at the band's top edge, a gold rule at its foot, and drawn gold corner flourishes (L rules with diamond finials). Band constants measured from the three approved exemplars.
- wide_raw_for(date, subject): finds wp-raw-<date>/wide-<subject-slug>.<ext> in the day's run dir; more than one match WARNs and takes the first name; none reads None.
- display_name(subject): title-case from the slug, small words (a · and · at · de · for · in · of · on · the · to) lowercase mid-name.
- main(): per member, the composition source is now the member's wide raw. A member with no wide raw WARNs and is skipped; the pick with no wide raw WARNs and exits 1, nothing published. The Drive phone file is no longer downloaded for composition (pick_site_wallpaper's rule still names the pick; _download_drive_file and composite_desktop are removed — the rejected phone-edit composition is gone from the code, not kept as a fallback). Local output names and the publish flow are unchanged.
- publish_desktop_set: reads the head tree recursively and adds a sha-null tree entry for every stale subject-named extra (stale_extra_deletions — the fixed role assets are never selected), so the deletions ride the same commit as the day's set; each deletion is printed and named in the commit message.

HARNESS (build tree): runner/test_site_desktop_wide.py — 22 ok / 0 not-ok (display_name production slugs · wide_raw_for found/missing/monthly · compose geometry + band dress on a synthetic 2048×1152 raw · stale-extra selection). runner/test_site_desktop_set.py (v554 enumeration regression) — 22 ok / 0 not-ok.

DRESS CHECK: the deterministic band was composed over the approved Felix scene (its generated band cropped away first) and read visually — navy band, gold rules, corner flourishes, and "Saint Felix de Valois" in gold EB Garamond, correctly spelled, centered. The drawn corner flourishes are plainer than the exemplars' generated scrollwork; the dress family (navy · gold serif name · gold corner work) is the approved one.

CALLER (nightly job W(d)) update lands at Ship with the code, so the route and its instructions change together.

## 4 · Review

Review record 2230 · contract 643 (holder v555-chain). PASS.

- Harness re-run on a CLEAN CHECKOUT of the committed HEAD e50566b (fresh clone of release/v555, standing untracked runner/_common.py supplied as in production): runner/test_site_desktop_wide.py — 22 ok / 0 not-ok · runner/test_site_desktop_set.py — 22 ok / 0 not-ok. Identical counts to the build tree; the gate reads the committed tree, not the worktree.
- Diff discipline: the branch touches runner/site_desktop.py (rebuilt), runner/test_site_desktop_wide.py (new), and this document. No app Worker file, no migration, no phone/watch step. The v554 enumeration suite passing unchanged proves the member/role contract is untouched.
- The one judgment call stands as Plan recorded it: the name band is composed in code, not generated — the pipeline's standing text discipline (the render module's QA rejects generated lettering) and the name's exactness rest on it; the dress check at Implement matched the approved exemplars' family (navy band · gold EB Garamond name · gold rules and corner work).
