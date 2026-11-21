# v572 — Prayer completion (abbreviated and repeated prayers stand in full, text and audio)

## 1 · Scope

- **Origin:** John, 2026-11-20 23:13 CT — prayers that use "etc." or "say this 3 times" stand auto-completed in text AND audio. Worked example: The Angelus prints "Hail, Mary, etc." — the full Hail Mary stands in each place. Sequenced by John after the migration, on the local build (the migration shipped as v568); held at Scope until his picks.
- **Approval of record:** John, Ora thread, 2026-11-21 11:22 CT (pasted picks; no formal Space record) — Q1 A: each abbreviation expands to the prayer's OWN full form, as the book itself gives it in full elsewhere; the audio re-renders from the completed text. Q2 A: EVERY prayer in the book carrying an abbreviation or repeat marker is completed, in text and audio. Run level TO SHIP (John upgraded past the recommended Stop before Ship).
- **Working shape:** one standing clone, worktree on release/v572; John's standing-clone processing go-ahead (2026-11-21 11:22 CT: "Approved. Just make sure you don't mess up") with its caution — worktrees off the clone, committed-tree verification before ship, merges serialized, nothing ships unverified.
- **Ship shape:** migration 0043 (prayer_book text updates) · PRAYER_AUDIO duration updates for the re-rendered files in app/worker/src/index.ts · pin ora-pro-nobis-v572-1 · What's New entry · row 1531 to Live. No client change beyond the pin; no APK.

## 2 · Plan

### 2.1 The census (from the live book itself — all 77 prayers, both bodies scanned)

Scans run over every prayer's `body` and `body_latin` as served from production: "etc." / "&c.", repeat directives ("three times", "thrice", "say … times", "Pater noster five times", "Pater once, Ave seven times"), incipit-only lines, and Latin "ter". **Seven prayers carry markers.** Every other prayer's text stands complete already (the broad "say/repeat" scan's only other hit, three-offerings-of-the-precious-blood, is ordinary prose — no marker).

Full forms, all taken from the book's own entries (Q1 A):
- **Hail Mary (EN)** = the hail-mary body · **Ave Maria (LA)** = the hail-mary body_latin.
- **Glory Be (EN)** = the glory-be body · **Gloria Patri (LA)** = the glory-be body_latin. Where the chaplet splits it as versicle/response, the two halves of that same text stand in the two places.
- **Our Father (EN)** = the our-father body, verbatim.
- **Eternal Rest (EN)** = the eternal-rest body.
- **Apostles' Creed (EN)** = the apostles-creed body.
- **Te ergo (EN)** = "We beseech Thee, therefore, help thy servants, whom Thou hast redeemed with thy Precious Blood" — the chaplet's own first full occurrence of the versicle, in the same body. **Te ergo (LA)** = "Te ergo quæsumus tuis famulis subveni quos pretioso Sanguine redemisti" — likewise the same body's full occurrence.
- **St Anthony refrain** = the responsory verse the same prayer gives in full twice: EN "The sea obeys, and fetters break; / And lifeless limbs thou dost restore; / Whilst treasures lost are found again, / When young or old thine aid implore." · LA "Cedunt mare, vincula; / Membra resque perditas / Petunt et accipiunt / Juvenes et cani."
- **Collect conclusions** = the book's own full form of the same conclusion (prayer-of-st-ambrose-before-mass): EN "with Thee in the unity of the Holy Ghost, God, world without end. Amen." · LA "in unitate Spiritus Sancti, Deus, per omnia sæcula sæculorum. Amen." (the full form of the "Qui tecum vivit et regnat" conclusion, in the book's Latin orthography).

The seven, with every expansion:

1. **angelus** (EN + LA) — "Hail, Mary, etc." ×3 → the full Hail Mary in each place · "Ave, Maria, etc." ×3 → the full Ave Maria in each place.
2. **the-magnificat** (EN + LA) — closing "Glory be to the Father, etc." → the full Glory Be · "Gloria Patri, etc." → the full Gloria Patri.
3. **prayer-to-st-anthony** (EN + LA) — after the Gloria verse, "The sea obeys, etc." → the refrain verse in full · "Cedunt mare, vincula, etc." → the Latin refrain in full.
4. **chaplet-of-the-precious-blood** (EN + LA) —
   - EN opening: ℣. "Glory be to the Father, etc." → the Glory Be's first half · ℟. "As it was in the beginning, etc." → its second half.
   - EN mysteries 1–6: the directive "Pater noster five times, and Gloria Patri once." → the Our Father written out five times, then the Glory Be, standing after each meditation. Mystery 7: "Pater noster thrice, and Gloria Patri once." → the Our Father three times, then the Glory Be. (33 Paters in all — the chaplet's own arithmetic, stated in its head prose.)
   - EN mysteries 2–7: "℣. We beseech, etc." → the Te ergo versicle in full (it stands in full at mystery 1).
   - EN closing collect: "Who liveth and reigneth, etc. Amen." → the full conclusion above.
   - LA opening: ℣. "Gloria Patri, etc." → the Gloria Patri's first half · ℟. "Sicut erat, etc." → its second half.
   - LA: "℣. Te ergo quæsumus, etc. (repeated after the Second, Third, Fourth, Fifth, Sixth and Seventh Mysteries)" → the versicle in full; the rubric note stands (the Latin body carries no mystery texts for the versicle to stand after — the note is the body's own structure).
   - LA closing collect: "Qui tecum vivit et regnat, etc. Amen." → the full conclusion above.
5. **rosary-of-the-seven-dolours** (EN) —
   - Each sorrow: "Pater once, Ave seven times." → the Our Father once, then the Hail Mary seven times, standing after each meditation.
   - The closing direction "Then say Ave thrice in veneration of the tears …" → "Then say, in veneration of the tears … :" with the Hail Mary written out three times.
   - Closing collect: "who livest and reignest, etc. Amen." → the full conclusion above.
6. **rosary-of-our-lord** (EN) —
   - "PATER noster." at the end of each of the 33 meditations → the full Our Father standing after each meditation.
   - "Ave Maria." at the three decade heads, the closing set's head, and the final "Let us pray to the most holy Virgin …" line (5 in all, as the head prose counts) → the full Hail Mary in each place.
   - "(Add Eternal rest, etc., if said for the departed. See p. 361.)" and "(Eternal rest, etc., as above.)" ×3 → "(Add, if said for the departed: <the full Eternal Rest>)" in all four places. The printed source's page reference drops — no p. 361 exists in the app.
   - "Then say the Credo in honour of the holy Apostles." stands, and the full Apostles' Creed follows it.

**Named judgment — descriptive head prose stands.** Three of the seven carry head matter that DESCRIBES the devotion's composition (the chaplet's introduction, including its reference to the closing prayer "Most Precious Blood," etc. — that prayer stands in full at the body's end; the seven-dolours head description; the rosary-of-our-lord head description). Descriptions of a devotion are not prayable text; they stand unchanged. The rule applied throughout: **every abbreviation or repeat directive standing in the prayable script is completed; prose describing the devotion stands.** This line is recorded here so it can be audited, and it is named in the ship report.

### 2.2 Audio — the files to re-render (10)

angelus.en · angelus.la · the-magnificat.en · the-magnificat.la · prayer-to-st-anthony.en · prayer-to-st-anthony.la · chaplet-of-the-precious-blood.en · chaplet-of-the-precious-blood.la · rosary-of-the-seven-dolours.en · rosary-of-our-lord.en.

- **Path:** the standing production path (v562/v574) — segment plans from the completed texts through the normalize-prayer-tts skill; `/opt/hatch/bin/tts speak` per segment with the voice read-back asserted; ffmpeg concat to MP3 24 kHz mono 64 kbps.
- **Voices (of record, not varied):** EN lead avocado_v2:MAI_03, EN responses avocado_v2:MAI_01 (marker-split files: chaplet EN, st-anthony EN, seven-dolours EN; the rest single-voice, mirroring their standing arrangements) · LA lead Voice 3 "Affectionate Suitcase" avocado_v2:vd2_r8_rep1k_0447_v068_28k_g5k, LA responses "Laughing Seed" avocado_v2:vd2_r8_rep1k_0024_v068_28k_g5k (marker-split: chaplet LA, st-anthony LA; angelus LA and magnificat LA single-voice lead, mirroring v574). ElevenLabs excluded; a failed render stops that file, never substitutes.
- **QA (every file, the standing bar):** transcript guard — faster-whisper-medium ASR vs the completed script; EN judged by the v562 EN method, LA by the folded character-similarity method at the 0.80 bar plus the pace screen. A failed render re-renders; nothing ships on a failed guard.
- **Upload (the v573 lesson, non-negotiable):** REST route only; every file read back from the REMOTE bucket (per-object GET, sha256 match) before the ship counts it. No wrangler R2 call.

### 2.3 Code and data

- **Migration 0043_prayer_completion.sql** — UPDATE prayer_book SET body / body_latin for the six slugs whose texts change (angelus, the-magnificat, prayer-to-st-anthony, chaplet-of-the-precious-blood, rosary-of-the-seven-dolours, rosary-of-our-lord), generated from the completed texts; applied to the app D1 at ship and verified by read-back against the repo texts. No other prayer_book row changes; prayer_items, intentions, draws, and all personal data untouched.
- **app/worker/src/index.ts** — PRAYER_AUDIO durations for the 10 re-rendered files updated to the measured new durations; every other value byte-equal. client.ts untouched; ui.ts only the Ship pin.
- **Harness (harness-v572.mjs):** H1 census completeness — no "etc." and no repeat directive remains in the prayable text of the seven (checked against the completed texts) · H2 the completed texts contain each expansion (counts: Angelus 3+3 Hail Marys, chaplet 33 Paters, rosary-of-our-lord 33 Paters + 5 Aves + Creed, seven-dolours 7 Paters + 24 Aves) · H3 migration 0043's texts byte-equal the completed texts · H4 PRAYER_AUDIO durations equal the measured render durations for the 10 files, all other entries byte-equal to the standing map · H5 the remote record verifies 10/10 uploads (sha256) · H6 diff confined (index.ts map block, migration, harness, this doc). Run on the build tree and again in a clean checkout of the exact HEAD to ship.
- **Served-leg proof (before ship counts):** after deploy, the served book (app.orapronobis.media) reads the completed Angelus — the full Hail Mary in each of the three places; the served app.js parses whole; one completed audio file served byte-exact against the render.
- **Ship:** pin bump ora-pro-nobis-v572-1 as its own commit · re-read origin/main immediately before merging (v586 ships concurrently — merges serialized; rebase if main moved) · merge release/v572 to main · push (read-back "main pushed · remote in sync") · apply migration 0043 · deploy from a clean ship worktree at the merged HEAD · What's New entry · row 1531 to Live, read back · ship report with John's field leg (his ear on a completed prayer — The Angelus).

## 3 · Implement

- **Texts:** the completed bodies were built from the live book by count-asserted replacement (every marker replaced a verified number of times; expansion counts verified: Angelus 3 + 3 Hail Marys · chaplet 33 Paters + 7 full Glory Bes + 6 Te ergo versicles · seven-dolours 7 Paters + 52 Hail Marys · rosary-of-our-lord 33 Paters + 5 Hail Marys + 4 Eternal Rests + the Creed). The only "etc." left in any changed text is the chaplet introduction's descriptive reference — the named judgment of §2.1. Migration **0043_prayer_completion.sql** carries the six slugs' new body/body_latin texts.
- **Renders: 10/10 complete** in `~/workspace/projects/ora-pro-nobis/v572-prayer-completion/` (renders.json: per-file bytes, measured duration, sha256, voices). Standing arrangements mirrored (EN marker-split MAI_03/MAI_01 for chaplet, st-anthony, seven-dolours; LA marker-split Voice 3 / Laughing Seed for chaplet, st-anthony; single-voice elsewhere). New durations: angelus en 85.2 / la 91.1 · the-magnificat en 57.6 / la 61.7 · prayer-to-st-anthony en 77.9 / la 58.8 · chaplet-of-the-precious-blood en 1231.8 / la 61.9 · rosary-of-the-seven-dolours en 1159.7 · rosary-of-our-lord en 1191.8.
- **One render incident, recorded:** the-magnificat.la's whole-text segment failed repeatedly at the TTS backend (26-byte truncated responses, both text variants, across three runs — the brittleness class the v574 note records for some Latin inputs). Fixed inside the standing discipline: the file's plan takes the **v574 plan's own verse segmentation** (10 segments, Voice 3), with the completed full Gloria Patri as its final segment. No voice substitution, no text change beyond the completion itself.
- **QA: 10/10 PASS** (qa-ledger-v572.json, the standing bars — EN: the guard's duration screen + multiset coverage ≥ 0.80 / extra ≤ 0.08; LA: folded charSim ≥ 0.80 + duration screen). EN coverage: angelus 0.992 · st-anthony 0.989 · rosary-of-our-lord 0.953 (extra 0.063) · seven-dolours 0.904 · chaplet and magnificat pass. LA: angelus charSim 0.98; chaplet, magnificat, st-anthony pass.
- **Upload: 10/10 verified_remote** (uploads-remote-v572.json) — REST route only, per-object GET sha256 read-back against the production bucket. No wrangler R2 call.
- **Code:** app/worker/src/index.ts — the six PRAYER_AUDIO entries updated to the measured durations (6 lines); every other entry byte-equal. client.ts untouched; ui.ts untouched (the pin is Ship's own commit).

## 4 · Review

- **Harness (clean checkout):** the exact Implement HEAD 8a2f43b checked out detached with a clean status — **harness-v572 6 ok / 0 not-ok**. The build tree reads the same (6/0).
- **Diff read:** four files — migration 0043 (the six slugs' completed texts), index.ts (the six PRAYER_AUDIO duration lines, nothing else), harness-v572.mjs, this doc. No client, route, or schema change beyond the book texts themselves. John's prayer seats (prayer_items), intentions, draws, and personal data are untouched by every leg of this release.
- **Evidence read:** census expansions count-verified at build (§3); QA ledger 10/10 PASS at the standing bars; uploads 10/10 verified against the REMOTE bucket by sha256 read-back — the audio leg of the served proof is therefore already established byte-exact against production storage.
- **Served-leg note (named, not hidden):** the v574-pattern pre-ship proof (wrangler dev --remote against the production bucket) is unavailable to this seat — the environment carries no wrangler credentials (`Could not start remote dev session. No credentials found`). The remaining served proofs (the completed Angelus in the served book payload · one completed audio file byte-exact through the served route · the served app.js parsing whole) run as **ship gates immediately after deploy, before the row flips Live** — the same evidence at the ship step, with the prior Worker as rollback. The audio objects landing ahead of the map deploy follows the standing v573/v574 pattern exactly.
- **Verdict: PASS.** The completion may ship; John's field leg (his ear on a completed prayer) stands open after ship by design.
