# Release Log

## [0.3.6.16] - 2026-07-06

### Fixed
- Prevented the devotional-image workflow from publishing the restored audio archive inside the GitHub Pages artifact.
- Preserved the podcast feed during devotional-image publishes by validating `pages/podcast.xml` before upload and removing only the deploy-copy `pages/audio` folder.
- Wired the devotional-image feed rebuild to `AUDIO_PUBLIC_BASE_URL` so regenerated podcast entries continue to use the R2 audio host in production.
- Added regression coverage for the devotional-image workflow's audio archive restore, feed guard, R2 URL wiring, Pages upload root, and deploy-copy audio removal.

## [0.3.6.15] - 2026-06-22

### Added
- Added a canonical `sharedGospelBridge` field to the shared daily liturgical context and flattened publish runtime fields.
- Added Gospel bridge support to prayer-intro templates, Rosary prompts and fallbacks, Daily Reflection prompts and fallbacks, and novena intro sidecar freshness metadata.

### Changed
- Made shared-theme Morning Prayer intros Gospel-first when Gospel text is available.
- Updated Auxilium Christianorum, Angelus, and Regina Caeli prayer intros to reference both today's Gospel bridge and the shared day theme.
- Updated Daily Rosary decade reflections so generated and deterministic fallback text stays shaped by the mystery, fruit, Gospel bridge, and day theme.
- Updated README publish-audio and novena documentation to describe Gospel bridge behavior.

### Fixed
- Ensured novena sidecar freshness detects stale `sharedGospelBridge` metadata for target publish dates.
- Prevented missing-Gospel daily intro prompts from exposing Gospel-labeled fields, avoiding bootstrap rejection when no Gospel text is available.

## [0.3.6.14] - 2026-06-16

### Fixed
- Fixed novena sidecar reuse so target-date sidecars are compared against the current canonical daily theme prose, not only internally consistent metadata.
- Added regression coverage for refreshing stale canonical transition text in existing novena sidecars.

## [0.3.6.13] - 2026-06-16

### Fixed
- Fixed shared daily theme transition casing so multi-word titles remain display-cased in metadata but are spoken in sentence case inside prayer and novena intros.
- Added regression coverage for canonical daily theme transition casing.

## [0.3.6.12] - 2026-06-16

### Added
- Added a reusable daily theme runtime helper so publish-contract jobs and novena-contract jobs share the same canonical daily liturgical context conversion and cache.
- Added top-level `daily_liturgical_context` payloads to novena sidecars, including shared theme title, Gospel citation, fallback status, source list, and version metadata.
- Added regression coverage for canonical novena sidecar context, stale target-date sidecar refresh, traditional novena intro bridge parity, and Daily Novenas site sidecar consumption.

### Changed
- Updated novena rendering so canonical `daily_theme_*` fields come from the shared daily liturgical context while novena-local focus remains under `novena_*`, `theme`, and `daily_focus`.
- Updated generated, short-form, fixed, and traditional novenas to prepend only a short shared-theme intro bridge before the existing novena prayer text.
- Documented canonical novena sidecars and the brief intro bridge behavior in the README.

### Fixed
- Tightened novena sidecar freshness checks so legacy or partial sidecars without Gospel citation, fallback status, or shared theme sources are regenerated for target publish dates.
- Prevented metadata-only sidecar repair from being skipped when audio content hashes already match.

## [0.3.6.11] - 2026-06-16

### Fixed
- Fixed per-prayer daily theme drift in publish-contract jobs by resolving one canonical daily theme per `(date, calendar, locale)` and reusing it across text and audio entries for that target date.
- Ensured Gospel-inclusive daily theme context wins across Morning Prayer, Rosary, Daily Reflection, Auxilium Christianorum, and Marian Antiphons when Gospel data is available.
- Preserved the calendar/day source in shared daily theme sources even when an optional memorial or feast is present, keeping the theme inclusive of day, Gospel, and season.

## [0.3.6.10] - 2026-06-15

### Fixed
- Fixed the publish-audio shared daily theme builder when a liturgical day has multiple non-feast calendar names, preventing `NameError: _join_with_and is not defined` during the remote `Publish Prayer Audio` workflow.

## [0.3.6.9] - 2026-06-15

### Added
- Added an inclusive shared daily theme payload with title, slug, explanation, transition, reflection focus, sources, and version metadata.
- Added shared daily theme context to Morning Prayer, Rosary, Daily Reflection, Auxilium Christianorum, Marian Antiphons, and novena rendering paths.
- Added regression coverage for shared theme metadata and novena sidecar preservation.

### Changed
- Updated Morning Prayer intros to explain today's shared focus and why it fits the liturgical day, Gospel, and season when available.
- Updated Rosary intro/reflection prompts and Daily Reflection title/fallback text to incorporate the same shared daily theme more deeply.
- Reworded Auxilium Christianorum and Marian Antiphon prayer intros so they transition through the day's grace rather than awkwardly placing a calendar label under protection.
- Updated novena intro fragments and sidecar context persistence so novenas lightly connect their saint/day focus to the day's prayer.

### Fixed
- Preserved already-rendered stale novena sidecars outside the current publish dates so pre-theme sidecars are not rewritten with placeholder audio metadata.

## [0.3.6.8] - 2026-06-14

### Added
- Added Ora Pro Nobis site branding with optimized header and hero logo derivatives under `docs/images/site/`.
- Added today-aware prayer audio selection so generated pages distinguish today's episode, most recent fallback audio, and upcoming audio.
- Added liturgical accent tokens for green, purple, gold, and red based on the shared daily liturgical context helper.
- Added optional devotional image ingestion from the public `devotional/DCIM` manifest tree, with optimized wide and portrait web derivatives when images are available.

### Changed
- Restyled the generated prayer directory and prayer detail pages around the logo's navy, gold, and ivory palette.
- Updated the production audio publish workflow to restore current devotional image folders from OneDrive before building the generated site.
- Documented site branding, devotional image behavior, today/fallback labels, and the rclone dependency in the README.

### Fixed
- Prevented tomorrow's normal publish output from being labeled as today's prayer on the generated site.
- Preferred the most recently-started active devotional image window when multiple current images match the site date.
- Added regression coverage for today/fallback/upcoming audio labels, liturgical color mapping, devotional image selection, and workflow ordering.

## [0.3.6.7] - 2026-06-14

### Added
- Added Cloudflare R2 audio publishing for the combined prayer audio workflow, including a tested S3-compatible sync helper for generated `docs/audio` artifacts.
- Added `AUDIO_PUBLIC_BASE_URL` support so MP3, sidecar, archive, prayer page, and RSS enclosure links can resolve through `audio.orapronobis.media`.

### Changed
- Split static site/feed base URLs from public audio URLs while keeping podcast feed and Pages output on GitHub Pages.
- Updated the publish workflow to sync audio to R2 before deploy and upload a staged GitHub Pages artifact with `audio/` removed.
- Documented the R2 secrets/variables and the new audio-hosting split in the README.

### Fixed
- Normalized freshly rendered audio and novena enclosure URLs so custom local site bases and configured audio bases do not produce mixed hosts.

## [0.3.6.6] - 2026-06-14

### Added
- Added sidecar-backed readable prayer text to generated prayer pages, including native audio playback when a latest MP3 sidecar is available.
- Added individual Daily Novena episode listings on the Daily Novenas page from novena audio sidecars.
- Added checked-in active contract arrays to Morning, Midday, Night, and Sunday Spotify playlist definitions for deterministic static site generation.

### Changed
- Reorganized the Pages home directory into Morning Praylist, Daily Praylist, and Night Praylist sections.
- Moved playback and Spotify outbound actions onto detail pages so home cards use a single `Open prayer` action.
- Limited generated prayer pages and manifest entries to contracts active in the checked-in Spotify playlist definitions, with Sunday homilies grouped under Daily Praylist.
- Updated RSS Pages documentation and regenerated the checked-in Pages output for the new Praylist layout.

### Fixed
- Validated playlist `contracts` arrays against known Spotify contracts so misspelled active contract keys fail early.
- Matched active Praylist membership through website aliases as well as contract IDs, slugs, and entry IDs.
- Added regression coverage for active filtering, one-button home cards, detail-page Spotify actions, sidecar prayer text rendering, alias matching, and Daily Novena individual episode rendering.

## [0.3.6.5] - 2026-06-13

### Changed
- Disabled the failing `Publish Prayer Text` GitHub Actions workflow by moving its YAML definition to `.github/disabled_workflows/publish_text.yml`.
- Updated README workflow documentation to point maintainers at the archived workflow while the Notion publish target is corrected.

### Fixed
- Added regression coverage that prevents `.github/workflows/publish_text.yml` from becoming active again unintentionally.

## [0.3.6.4] - 2026-06-13

### Fixed
- Removed the stale `petition-church` resolver from the built-in Morning Prayer page-audio fallback contract so remote generation no longer points at a missing template file.
- Added regression coverage that verifies every built-in Morning Prayer file resolver references a checked-in template file.

## [0.3.6.3] - 2026-06-13

### Changed
- Updated the remote Morning Prayer page-audio workflow to resolve its OneDrive output folder through the page-audio runtime contract loader instead of reading the removed custom-TTS JSON file directly.
- Clarified README page-audio docs so the Morning Prayer custom-TTS JSON is documented as an optional override with built-in defaults.

### Fixed
- Prevented the remote Morning Prayer page-audio workflow from failing during rclone validation with `FileNotFoundError` for `config/custom_tts/morning-prayer.json`.
- Added regression coverage that keeps the workflow on the runtime contract-loader path.

## [0.3.6.2] - 2026-06-13

### Added
- Added a contract-driven GitHub Pages prayer website with a responsive directory home, `docs/prayers/index.json`, and one static page per visible prayer.
- Added validated website metadata to Spotify queue contracts and listener-facing metadata to Ora Pro Nobis publish contracts, Daily Novenas, and external Spotify prayer entries.
- Added website generation tests for manifest/page output, Marian Antiphon family merging, latest-audio links, stale page cleanup, duplicate slug rejection, and workflow wiring.

### Changed
- Replaced the Pages root with the generated daily prayer directory while preserving the podcast feed and audio archive surfaces.
- Updated both Pages deployment workflows to run the shared website generator before upload.
- Renamed the legacy Morning Prayer page-audio manual workflow to `Website Publish Validation` and expanded it to cover website, Spotify contract, and publish contract tests.

### Fixed
- Ensured generated prayer pages are reset on each site build so renamed or disabled prayer slugs do not leave stale Pages output behind.
- Raised generated button touch targets to 44px for better mobile usability.

## [0.3.6.1] - 2026-06-13

### Changed
- Updated Morning Prayer and Evening Prayer Spotify resolution so Divine Office is tried before Sing the Hours.
- Kept the existing contract keys and fallback routing intact while preserving the Sing the Hours evening compatibility path.

### Fixed
- Added regression coverage for morning and evening preference order plus fallback behavior.

## [0.3.6.0] - 2026-06-09

### Added
- Added a Daily Reflection format with four short spoken sections and 15-second pauses between them.

### Changed
- Updated the Daily Reflection generator, fallback narration, and validation so each day feels shorter, more question-led, and shaped by the daily liturgical helper.
- Extended the publish-audio pipeline so Daily Reflection pauses stay at 15 seconds in job config and fragment assembly while the shared seasonal music bed keeps playing underneath.
- Updated contract and audio regression coverage for the new Daily Reflection fragment labels, pause timing, and helper-driven variation.

### Fixed
- Removed the spoken `Episode Title` heading from Daily Reflection narration while keeping the metadata title unchanged for Spotify lookup and episode discovery.

## [0.3.5.0] - 2026-06-09

### Added
- Added a shared daily liturgical context helper for publish jobs, with feast/Gospel/season precedence, normalized daily theme metadata, tone, imagery, saint intercession, and music mood fields.
- Added a generated Daily Reflection episode contract with an Ignatian-style reflection and guided examen, including deterministic fallback text when OpenAI generation is unavailable.
- Added `ignatian-reflection` publish block support, runtime context caching, render metadata, sidecar metadata, and regression coverage for text/audio job integration.

### Changed
- Updated the `Daily Examen` Spotify contract to resolve the generated Ora Pro Nobis Daily Reflection episode by show/title/date lookup instead of a fixed external episode URI.
- Extended publish-audio regression expectations so Daily Reflection participates in the existing common audio branding and background music pipeline.

## [0.3.4.9] - 2026-06-07

### Added
- Added centralized seasonal audio branding for Ora Pro Nobis publish-audio episodes, with configured music assets for Advent, Christmas, Ordinary Time, Lent, Holy Week, and Easter.
- Added a spoken Ora Pro Nobis welcome rendered through the configured cloned ElevenLabs voice.
- Added ffmpeg-based intro music, welcome ducking, optional quiet background bed, and outro fade mixing before final loudness normalization.
- Added regression coverage for music-season resolution, including Triduum and Holy Saturday mapping to Holy Week, branding metadata, missing-asset handling, and the publish-audio render path.

### Changed
- Updated publish-audio episode hashing and sidecars so seasonal branding config and assets are auditable and invalidate stale rendered MP3s.
- Documented the `config/publish/audio/` seasonal MP3 replacement workflow.

### Fixed
- Ensured Paschal Triduum and civil Holy Saturday select Holy Week music while Easter Sunday selects Easter music.

## [0.3.4.8] - 2026-06-07

### Added
- Added deterministic `prayer_intro` publish blocks that render one-sentence day-theme transitions without introducing another OpenAI dependency.
- Added natural transition intros for Auxilium Christianorum and both Marian Antiphon episodes so the day announcement flows into the prayer body.
- Added regression coverage for prayer intro text, audio fragment order, resume markers, and invalid transition templates.

## [0.3.4.7] - 2026-06-07

### Fixed
- Removed Sunday-only weekday gates from the Father Mike and Bishop Barron Spotify homily contracts so the Sunday playlist can pull the latest available homilies whenever refresh runs.
- Added regression coverage proving both homily contracts stay ungated and resolve during a non-Sunday Sunday-playlist queue build.

## [0.3.4.6] - 2026-06-05

### Added
- Added Amelia-first/OpenAI-second provider lists to novena audio defaults and the standard nine-day novena family contract.
- Added ElevenLabs Brian-first role overrides for Auxilium Christianorum's versicle and response fragments.

### Changed
- Preserved the existing Morning Prayer, Rosary, and Marian Antiphon ElevenLabs voice ids instead of replacing them with Amelia.
- Reused the shared publish-audio provider fallback path for novena rendering so OpenAI remains an ordered fallback, not the primary path.
- Updated the novena contract generator and README guidance to match the new provider-first behavior.

### Fixed
- Prevented novena audio from staying OpenAI-only by wiring it to Amelia-first provider fallback.
- Added contract validation and regression coverage for novena provider lists and Auxilium role-specific voice overrides.

## [0.3.4.5] - 2026-06-05

### Added
- Added structured Daily Rosary reflection generation with validated five-reflection output and compatible plain-text fallback when structured parsing is unavailable.
- Added Rosary reflection source/count metadata to publish jobs and final audio sidecars for post-run auditability.

### Fixed
- Kept feast-day Rosary reflection fallback centered on the feast when generated output is malformed, preventing feast-focused episodes from degrading into generic Ordinary Time reflections.
- Added St. Boniface and malformed-output regression coverage for Daily Rosary reflection precedence and fallback behavior.
- Made `pydantic` an explicit dependency because Rosary structured-output parsing imports it directly.

## [0.3.4.4] - 2026-06-05

### Changed
- Made final MP3 loudness normalization a default audio setting for publish-audio and novena contracts, using the shared `-16 LUFS`, `-1.5 dBTP`, `11 LRA` target.
- Kept `loudness_normalization` contract-configurable so individual contracts can override or disable it for alternate mastering requirements.
- Applied final FFmpeg loudness normalization to novena audio rendering and recorded normalization metadata in novena sidecars.

### Fixed
- Removed duplicated loudness normalization blocks from individual podcast contracts now covered by the shared default.
- Added regression coverage for publish-audio defaults, contract overrides, fragment hashing, novena defaults, and novena rendering.

## [0.3.4.3] - 2026-06-05

### Changed
- Switched Auxilium Christianorum's main ElevenLabs narrator to the Amelia voice with warmer, slower devotional settings.
- Kept Morning Prayer on the existing cloned Tebo voice while enabling final whole-track loudness normalization.
- Added configurable ffmpeg loudness normalization for assembled publish-audio MP3s and recorded the applied normalization settings in episode sidecars.

## [0.3.4.2] - 2026-06-05

### Fixed
- Added shared TTS input sanitization so label-style prefixes such as `Prayer:` and standalone `colon` artifacts are removed before fragment hashing, sidecar writing, and renderer calls.
- Added regression coverage proving Saint Anthony novena audio fragments and generic publish fragments no longer send spoken markup artifacts to TTS.

## [0.3.4.1] - 2026-06-03

### Added
- Added shared Daily Rosary day-context resolution for weekday mystery set, feast/memorial focus, Gospel focus, liturgical season fallback, and mystery-fruit fallback.
- Added a generated Daily Rosary intro block before the opening prayers, with deterministic fallback when OpenAI, Gospel, or calendar context is unavailable.
- Added regression coverage for optional memorial priority, focus fallback ordering, Rosary intro rendering, expanded Rosary titles, text/audio section order, and Spotify lookup compatibility.

### Changed
- Updated Daily Rosary text/audio titles to include the selected mystery set and short daily focus label, for example `Daily Rosary - Joyful Mysteries - Saint Example - April 6, 2026`.
- Updated decade reflection generation so feast days, including optional memorials, orient the reflections before Gospel or season context.
- Kept Spotify Daily Rosary lookup broad by matching `Daily Rosary` plus the date instead of variable mystery or focus terms.

## [0.3.4.0] - 2026-06-03

### Changed
- Refined Daily Rosary reflection audio pacing by adding a stronger spoken boundary between each mystery's fruit and reflection.
- Expanded Daily Rosary reflection generation into three similarly sized tiers: OpenAI with the day's Gospel, OpenAI with the liturgical season, and a generic season-aware fallback.
- Updated Rosary reflection prompts and deterministic fallbacks to describe each mystery, explain the fruit, and repeat both naturally in a four-sentence spoken format.

## [0.3.3.0] - 2026-06-02

### Added
- Added a generated Ora Pro Nobis Daily Rosary episode with traditional weekday mystery selection, five full decades, and short per-mystery reflections with deterministic fallbacks.
- Added a `rosary_decades` publish block that keeps repeated standard prayers as cacheable fixed fragments while generating only daily reflection fragments.
- Added regression coverage for Rosary mystery parsing, reflection fallback behavior, full text assembly, audio fragment cache reuse, resume markers, and Spotify lookup.
- Added role-aware publish audio fragments so short versicle/response lines can use role-specific voices while preserving cache-safe hashes and sidecar metadata.

### Changed
- Migrated `daily-rosary` Spotify integration to resolve the generated Ora Pro Nobis episode by `Daily Rosary` title and publish date.
- Documented Daily Rosary audio publishing and clarified the older page-audio Rosary output mode as archived.
- Normalized Auxilium Christianorum response markers into clean spoken fragments: printed `V.` and `R.` labels are omitted, response boundaries become natural pauses, and response fragments can use a distinct voice.

### Fixed
- Prevented Auxilium Christianorum generated audio from speaking source response labels aloud.
- Hardened the daily-intro OpenAI local-env test so shell-level `OAI_API_BASE_URL` and `OAI_MODEL` values do not override the test fixture.

## [0.3.2.6] - 2026-06-02

### Changed
- Migrated the Auxilium Christianorum Spotify queue contract to resolve the generated Ora Pro Nobis daily episode by title and date from the Ora Pro Nobis show.
- Updated README guidance so Auxilium Christianorum Spotify integration is no longer documented as deferred migration work.

### Fixed
- Prevented Auxilium Christianorum playlist refreshes from depending on the legacy weekday-only external-show resolver when the generated Ora Pro Nobis daily episode is available.

## [0.3.2.5] - 2026-06-02

### Added
- Added a lay-member Auxilium Christianorum publish contract that assembles a daily episode from reusable prayer templates, weekday-specific prayers, a recurring Litany of the Most Precious Blood, and a conclusion.
- Added deterministic `liturgical_announcement` publish blocks backed by Romcal celebration data for date and Church calendar context without an OpenAI dependency.
- Added ordered `resume_markers` to generated text/audio jobs and persisted audio sidecars so consuming surfaces can resume within daily episodes.

### Changed
- Documented the Auxilium publish contract, lay-member-only content boundary, reusable announcement block, resume markers, and deferred Spotify migration in the README.

### Fixed
- Made full unittest discovery portable on Windows by avoiding hard-coded POSIX path separator assumptions in novena and page-audio tests.

## [0.3.2.4] - 2026-06-02

### Added
- Added ordered `spotify_episode_lookup.searches` support so a Spotify queue contract can try multiple title/date search profiles and stop at the first successful match.
- Added regression coverage for ordered lookup validation, first-success resolver behavior, checked-in Angelus contract resolution, and Marian Antiphon publish title output.

### Changed
- Migrated the three Angelus Spotify contracts to resolve the daily Ora Pro Nobis Marian Antiphon episode instead of fixed seasonal Spotify URIs.
- Updated future Angelus and Regina Caeli publish-audio titles to include `Marian Antiphon`, giving the Spotify resolver one durable title marker across both seasons.
- Updated README guidance for ordered Spotify episode lookup searches and the new Ora Pro Nobis Marian Antiphon contract behavior.

## [0.3.2.3] - 2026-06-02

### Added
- Added a reusable July/August traditional novena batch runner plus local script so the seasonal import sweep can run in one command with month-specific reports.
- Added season-gated Marian Antiphon publish-audio contracts for Angelus in ordinary time and Regina Caeli during Easter Season.
- Added a tighter Spotify refresh cadence so the daily playlist refresh now runs three times per day.

### Changed
- Updated the Catholic Novena App importer to parse the current live `notice--info` facts layout instead of the older wrapper.
- Updated the README, release artifacts, and regression coverage to document the new novena import workflow, Marian Antiphon audio surface, and refresh cadence.

### Fixed
- Prevented the traditional novena importer from failing on the live Catholic Novena App page shape.
- Prevented Marian Antiphon audio from collapsing into a single season-agnostic source by making the feed items season-aware and date-scoped.

## [0.3.2.0] - 2026-05-10

### Added
- Added a reusable `spotify_episode_lookup` contract mode for Spotify queue files, with required name-term matching and ordered date-format fallbacks.

### Changed
- Migrated Morning Prayer and Daily Novenas onto contract-owned Spotify show ids and the shared episode lookup path.
- Removed the hidden Morning Prayer monthly and Daily Novenas helper code paths so the generic lookup helper is now the only active resolver for those contracts.
- Removed silent resolver alias rewriting so resolver names are dispatched exactly as written.

### Fixed
- Prevented Morning Prayer and Daily Novenas from depending on legacy resolver-specific show slots or helper wrappers.
- Tightened contract validation and regression coverage around lookup contracts, pagination, deduping, and multi-match queue flattening.

### Removed
- Removed `config/spotify/contracts/morning-prayer-monthly.json`.

## [0.3.1.14] - 2026-05-10

### Fixed
- Corrected the devotional image GitHub Pages workflow so the inline podcast-feed rebuild imports `load_published_audio_jobs` from `jobs.publish.audio` instead of `jobs.publish.rss`.
- Prevented the devotional image deployment from failing with an `ImportError` when it rebuilds `podcast.xml` from the archived audio snapshot.

## [0.3.1.13] - 2026-05-09

### Changed
- Canonicalized the Morning Prayer ElevenLabs publish contract so the repo keeps a single Morning Prayer contract file at `config/publish/contracts/morning-prayer.json`.
- Removed the duplicate `config/publish/contracts/morning-prayer-elevenlabs.json` sibling file and updated the publish test suite to expect the renamed canonical contract.

### Fixed
- Prevented the Morning Prayer ElevenLabs variant from living under two checked-in filenames at once, which made the publish contract set harder to reason about.
- Prevented the publish contract and audio pipeline tests from drifting away from the canonical Morning Prayer file name.

## [0.3.1.12] - 2026-05-09

### Added
- Added a `bootstrap-no-cache` publish mode that seeds today and tomorrow while forcing the audio publish path to rebuild instead of reusing cached episodes or fragments.
- Added regression coverage for the no-cache publish mode across the audio runner and novena runner so the combined workflow stays aligned.

### Changed
- Updated the publish audio workflow dispatch copy and options to advertise `bootstrap-no-cache` alongside `daily`, `bootstrap`, and `reset`.
- Updated the publish audio runner to treat `bootstrap-no-cache` like `bootstrap` for date selection while enabling the rebuild override at runtime.
- Updated the novena runner and README so the combined publish workflow documentation reflects the new mode.

### Fixed
- Prevented bootstrap-style reruns from sticking to cached audio when a fresh rebuild is needed for the same publish window.
- Prevented the novena half of the combined publish workflow from silently falling back to `daily` behavior when `bootstrap-no-cache` is selected.

## [0.3.1.11] - 2026-05-09

### Added
- Added a regression check that keeps the publish audio workflow exporting `ELEVENLABS_API_KEY` for the Morning Prayer ElevenLabs variant.

### Changed
- Documented the ElevenLabs secret requirement in the README so local runs and GitHub Actions both make the runtime dependency explicit.

### Fixed
- Prevented the Morning Prayer ElevenLabs variant from failing in GitHub Actions when the secret exists in repository settings but was not exported into the job environment.

## [0.3.1.10] - 2026-05-09

### Added
- Added a sibling Morning Prayer variant that can render through an ordered TTS provider preference list with a custom ElevenLabs voice as a first-class option.
- Added a step-by-step local helper for smoke testing the Morning Prayer ElevenLabs variant against `config/local/elevenlabs.env`.

### Changed
- Updated publish contract normalization to understand ordered provider objects and carry provider-specific ElevenLabs fields without breaking the existing Morning Prayer contract.
- Extended audio fragment hashing and render fallback so provider identity and tuning stay cache-safe while ElevenLabs can fail over to the next configured provider.
- Kept the Morning Prayer ElevenLabs title and description plain while making the contract and episode identity distinct under the hood.

### Fixed
- Prevented OpenAI and ElevenLabs renders from colliding in cache identity or sidecar metadata.
- Added regression coverage for contract loading, provider fallback, cache separation, and distinct feed identity between the default and ElevenLabs Morning Prayer variants.

## [0.3.1.9] - 2026-05-09

### Fixed
- Preserved the podcast homepage and feed when the devotional image workflow publishes its GitHub Pages artifact by seeding the Pages tree from `docs/` before overlaying devotional images.

## [0.3.1.8] - 2026-05-08

### Changed
- Reworked the short-form novena path so the first eligible run seeds the remaining days up front, while only the publishable day renders audio.
- Replaced the short-form hard-coded daily theme lists with saint-specific prompt-driven outlines so each novena can carry its own 9-day life arc.

### Fixed
- Made novena sidecars write-once so reruns reuse the seeded JSON instead of calling the LLM again for the outline.
- Added regression coverage for the short-form seeding flow, prompt wording, placeholder sidecar handling, and publish-audio skipping behavior.

## [0.3.1.7] - 2026-05-08

### Changed
- Removed the duplicate `petition-church` block from the Morning Prayer publish contract and aligned the publish test coverage with the resulting 12-fragment shape.
- Restored the Daily Examen Spotify queue contract to a valid `spotify:episode:` URI and removed the unused labor/parents sidecar contracts.

### Fixed
- Reduced the traditional Our Lady of Fatima novena daily block to one `Our Father` / `Hail Mary` / `Glory Be` cycle, each repeated three times.
- Added regression coverage that keeps the traditional Fatima contract shape and render output at exactly three of each canonical prayer.

## [0.3.1.6] - 2026-05-04

### Added
- Added a dedicated short-form novena contract for Our Lady of Fatima so the traditional feast-day novena and the AI-generated companion can publish side by side.

### Changed
- Standardized AI-generated novena RSS titles to use the `Short-Form Novena to {saint_name} Day {day} - {date_display}` pattern across the shared novena defaults and checked-in AI-generated feast contracts.
- Updated the novena contract generator default title pattern to emit the new short-form wording for future AI-generated novena contracts.

### Fixed
- Prevented the short-form Fatima novena from collapsing into the traditional Fatima novena by giving each contract a distinct identity and feed item id.
- Kept the traditional Fatima novena title wording unchanged while adding explicit regression coverage for both Fatima variants.

## [0.3.1.2] - 2026-05-02

### Added
- Added a resolver trace for Morning Prayer's merged daily-intro settings so CI can confirm the active Gospel fallback flag.
- Added regression coverage proving contract-level `daily_intro` metadata survives block normalization unless the block explicitly overrides it.

### Changed
- Updated daily-intro block normalization so contract-level `calendar`, `locale`, `prompt_model`, and `allow_missing_gospel` values are preserved unless explicitly set on the block.
- Added `gh` to the dev container image so the GitHub CLI is available in fresh local container rebuilds.

### Fixed
- Prevented Morning Prayer's Gospel fallback from being lost when the daily-intro block omitted its own `allow_missing_gospel` value.
- Prevented the same normalization step from blanking out the contract-level `calendar`, `locale`, and `prompt_model` defaults.

## [0.3.1.1] - 2026-05-02

### Added
- Added an archive-backed podcast rebuild path that restores and scans `docs/audio/` JSON sidecars and MP3 files before regenerating `podcast.xml`.
- Added a public archive dashboard at `docs/audio/index.html` plus a machine-readable manifest at `docs/audio/index.json`.

### Changed
- Updated the publish audio workflow to restore and save the published audio archive snapshot with GitHub Actions cache.
- Updated the root Pages landing page to link directly to the archive dashboard.
- Updated the README to describe the local archive snapshot and archive dashboard flow.

### Fixed
- Prevented podcast archive rebuilds from depending on the remote `podcast.xml` file as the only durable history source.
- Prevented the Pages root from being a dead end by keeping the static landing page linked to the archive.

## [0.3.1.0] - 2026-05-02

### Added
- Added a Gospel-free Morning Prayer daily intro fallback so the opening block can still render when the Gospel lookup is unavailable.
- Added block-level `skip_if_missing` handling for optional publish blocks that should disappear instead of failing the run when upstream data is missing.
- Added regression coverage for the daily-intro USCCB fallback path, the Gospel-free daily intro path, and optional monthly-template skipping.

### Changed
- Hardened the daily Gospel lookup to retry the USCCB library path and fall back to direct HTML parsing when the live edge blocks the request.
- Updated the Morning Prayer contract metadata to opt into the Gospel-free daily intro fallback.
- Updated publish contract resolution so skipped optional blocks are logged and omitted cleanly from text and audio output.

### Fixed
- Prevented transient USCCB 403/challenge responses from failing the Morning Prayer publish outright.
- Prevented optional dynamic blocks from aborting the publish when they are explicitly marked to skip missing data.

## [0.3.0.4] - 2026-05-01

### Changed
- Updated traditional novena RSS item titles to end with the publish date suffix so imported and checked-in traditional novenas now render like `Traditional Novena to St Damien of Molokai Day 2 - May 2, 2026`.

### Fixed
- Prevented traditional novena feed items from continuing to publish without the visible publish-date suffix in the RSS title.

## [0.3.0.3] - 2026-05-01

### Added
- Added GitHub Actions cache restore/save around the publish audio fragment cache so warmed fragments and silence assets persist across runs.
- Added regression coverage for restored fragment-cache reuse in a fresh workspace and workflow-text assertions for the new cache steps.

### Changed
- Updated the publish audio workflow to restore the fragment cache after checkout and save a new snapshot after publishing completes.
- Clarified the README to say GitHub Actions persists the publish audio fragment cache across workflow runs.

### Fixed
- Prevented the publish audio cache from behaving like a one-shot local-only optimization by making restores broad and saves snapshot-based.

## [0.3.0.2] - 2026-05-01

### Changed
- Simplified the audio publish archive path so it now recovers history from the remote `podcast.xml` feed only and treats the local checkout feed as an intra-run handoff, not a cross-run archive.
- Updated the novena RSS path to keep using the current in-workspace feed as a same-run handoff after audio writes it.
- Added the `PUBLISH_PODCAST_FEED_URL` override so the remote archive URL is explicit and stable.

### Fixed
- Prevented daily audio publishes from silently rebuilding a truncated feed when the archive cannot be recovered, by failing closed instead of falling back to an empty local archive.
- Preserved older episodes in the published podcast feed by treating the deployed `podcast.xml` as the durable source of truth.

## [0.3.0.1] - 2026-05-01

### Changed
- Updated the `Publish Prayer Audio` manual dispatch default to `daily` so the combined publish workflow starts in the append-safe mode instead of destructive reset mode.
- Clarified the README and workflow description to distinguish the safe daily publish path from explicit archive truncation via `reset`.

### Fixed
- Prevented manual publish runs from silently starting in `reset`, which could truncate the feed archive and make older episodes disappear.
- Added regression coverage that guards the workflow default and keeps the existing feed-preservation behavior under test.

## [0.3.0.0] - 2026-04-29

### Added
- Added a Catholic Novena App URL importer with `single` and `bulk` modes that generates validated novena override drafts from live pages.
- Added a top-level novena contract `enabled` flag so uncertain imports can be written disabled and skipped by the runtime.
- Added a canonical prayer fragment library so repeated `Our Father`, `Hail Mary`, and `Glory Be` text can be reused instead of inlined repeatedly.
- Added compact day-block parts and day-tagged shared blocks so repeated novena days can share one reusable prayer block.
- Added single and bulk import reports under `artifacts/novena-url-overrides/` for review of enabled, disabled, skipped, and failed imports.

### Changed
- Updated the novena runtime to skip disabled contracts and to prefer compact reusable blocks for audio fragment generation.
- Updated imported traditional novenas to publish with a `Traditional Novena to {saint_name} Day {day}` title pattern.
- Updated the novena importer to normalize instruction-heavy sections for TTS, including placeholder prompts and canonical prayer expansion.
- Updated README and release documentation to describe the new importer, fragment compaction, and disabled-contract behavior.

### Fixed
- Prevented repeated prayer blocks from being rewritten multiple times by caching normalized novena sections and canonical prayer fragments.
- Kept disabled feast drafts loadable for review without letting them suppress valid active novena contracts.

## [0.2.1.0] - 2026-04-28

### Added
- Added a dedicated `Daily Novenas` Spotify queue contract and resolver path that scans Ora Pro Nobis episodes for titles containing `Novena` and today’s date, then returns every matching episode URI in order.
- Added regression coverage for contract loading, resolver routing, no-hit, single-hit, multi-hit, pagination, and queue flattening behavior.

### Changed
- Updated the Spotify playlist queue builder to flatten list-valued resolver output while preserving the existing one-URI behavior for all other contracts.
- Added a dedicated `DAILY_NOVENAS` show slot in the Spotify resolver defaults so the new contract has its own lookup key.

### Fixed
- Enabled the `Daily Novenas` Notion row to resolve automatically from the existing Spotify refresh path instead of staying manual.

## [0.2.0.1] - 2026-04-28

### Changed
- Updated the novena resolver to scan all Romcal rows for a day instead of stopping at the first row, so selector-family novenas can still publish when an eligible memorial appears after an ineligible weekday.
- Kept ordinary weekday rows excluded while preserving selector-rank and explicit-override filtering.

### Fixed
- Restored Saint Joseph the Worker novena publication on Friday when Romcal emits a weekday first and the optional memorial second.
- Added regression coverage for the weekday-first / optional-memorial-second selection path.

## [0.2.0.0] - 2026-04-28

### Added
- Added a contract-first novena publishing system with a fresh `jobs/novena_contracts/` boundary for contract loading, validation, resolution, rendering, audio generation, sidecar writing, and RSS publishing.
- Added `contracts/novenas/templates/standard-9-day.json` and a selector-based family contract in `contracts/novenas/families/standard-9-day.json` so the standard novena can auto-populate eligible celebrations from the liturgical calendar without enumerating feast ids.
- Added `contracts/novenas/feast-days/most_sacred_heart_of_jesus.json` as an explicit feast override example that resolves from a canonical Romcal id.
- Added `scripts/new_novena_contract.py` so authors can create or validate feast contracts from either a saint name or a Romcal id, and optionally auto-populate a selector family.
- Added regression coverage for contract loading, selector resolution, audio sidecar writing, pipeline orchestration, and publish-pipeline compatibility.

### Changed
- Replaced the grouped explicit feast list for the standard novena with a selector-based family contract that auto-discovers eligible solemnities, feasts, memorials, and optional memorials from the liturgical calendar.
- Updated the novena resolver to derive active novena windows from `today` plus contract metadata while suppressing duplicate selector output when an explicit override exists.
- Kept the RSS rebuild deterministic from published audio artifacts and preserved the existing non-novena episodes.
- Added a GitHub Actions novena workflow that runs immediately after `Publish Prayer Audio` on `main` and can also be triggered manually.
- Updated the release artifact and version tracker to reflect the shipped minor release.

### Fixed
- Prevented the standard novena from relying on an invalid weekday-of-Easter example as a feast trigger.
- Ensured embedded templates still override `template_id` and that invalid contract shapes fail closed before audio generation.
- Fixed novena sidecar serialization so Romcal enum values are written into JSON artifacts safely.

## [0.1.5.7] - 2026-04-27

### Changed
- Repointed the Morning Prayer `MORNING_PRAYER_MONTHLY` resolver to the new Spotify show id and changed its lookup to the date-scoped episode title for today.
- Added a dedicated `06:00 UTC` schedule to `Publish Prayer Audio` and moved the Spotify refresh to `07:00 UTC` so Morning Prayer publishes before the later refresh window.
- Updated the README to document the earlier publish cadence and the Morning Prayer show source of truth.

### Fixed
- Stopped the Morning Prayer playlist resolver from relying on the old month/year episode title pattern.
- Kept the `MORNING_PRAYER_MONTHLY` contract key stable so the existing playlist contract files did not need a migration.

## [0.1.5.4] - 2026-04-27

### Added
- Added leaf-fragment expansion for publish audio so Morning Prayer and similar contracts now carry ordered fragment metadata instead of a single whole-entry render blob.
- Added a dedicated publish-audio fragment cache under `.cache/publish_audio/` with per-fragment hashing, cached silence generation, and ffmpeg assembly helpers.
- Added regression coverage for fragment ordering, fragment hash invalidation, repeated leaf reuse, publish-output cache hits, and podcast-feed generation from fragment-assembled audio.

### Changed
- Reworked `jobs/publish/audio.py` to render fragments individually, reuse cached fragment audio, and assemble the final MP3 from cached pieces.
- Updated `jobs/publish/contracts.py` so audio jobs derive their content hash from the fragment manifest instead of from one large concatenated text payload.
- Updated `README.md` to document the fragment cache model and the new publish-audio helper module.

### Fixed
- Ensured identical spoken leaf text can reuse cached audio across reruns instead of calling TTS again for the whole prayer.
- Kept the public publish outputs unchanged at `docs/audio/*.mp3` and `docs/podcast.xml`.

## [0.1.5.3] - 2026-04-26

### Added
- Added a new generic publish boundary under `jobs/publish/` for contract loading, Notion text upserts, audio rendering, and RSS writing.
- Added the shared Morning Prayer and Rosary publish contracts under `config/publish/contracts/` with entry-based text assembly and selector-driven content blocks.
- Added focused regression coverage for publish-contract loading, Notion upserts keyed by `entry_id`, audio idempotency, and RSS enclosure generation.
- Added new `publish_text` and `publish_audio` GitHub Actions workflows for the contract-driven text and audio publish paths.

### Changed
- Updated `README.md` to document the new publish entrypoints, the `Publish Entries` Notion target, and the GitHub Pages base URL override.
- Moved the new audio publication path to `docs/audio/*.mp3` and `docs/podcast.xml` so GitHub Pages can serve the feed directly.

### Fixed
- Made the shared publish contracts fail closed on missing required identity fields, duplicate `entry_id` values, and unsupported block shapes.
- Ensured audio reruns reuse an unchanged MP3 when the content hash matches the existing sidecar metadata.

### Removed
- Removed the need for the new publish path to depend on the archived page-audio runtime.

## [0.1.5.2] - 2026-04-25

### Added
- Added Notion-owned Spotify playlist membership and ordering for the active refresh path using checked `Enabled` rows, exact `notion_name` title joins, populated `Output Folder`, and Notion `Order`.
- Added regression coverage for identity-only playlist files, required Notion membership, exact Notion title joins, checked-only inclusion, blank `Output Folder` omission, unknown folder failures, missing order failures, duplicate active row failures, and weekday-gated playlist skips.

### Changed
- Renamed Spotify queue contract `name` fields to `notion_name` and made playlist JSON files identity-only with `key`, `name`, and `playlist_id`.
- Updated the Spotify refresh workflow and README to document the hard Notion membership dependency and the `source=notion_membership` runtime.
- Updated the morning and evening Marian Antiphon Easter URI to the current Regina Caeli episode.

### Fixed
- Treat blank or missing Notion `Output Folder` values as inactive rows, matching unchecked `Enabled` behavior instead of failing the refresh.
- Preserve fail-closed validation for duplicate checked Notion rows, unknown populated `Output Folder` values, and missing `Order` values on placed rows.

### Removed
- Removed the stale legacy Spotify/Notion queue-builder helpers and skipped legacy tests that contradicted the active contract path.

## [0.1.5.1] - 2026-03-30

### Changed
- Moved the active scheduled GitHub Actions workflows into a midnight-ish Central time window by shifting the daily cron band from 08:00-08:30 UTC to 06:00-06:30 UTC.
- Preserved the daily Spotify refresh schedule gate and the manual `workflow_dispatch` entrypoints on the active workflows.
- Updated the README schedule note so the documented daily Notion reset time matches the new cadence.

### Fixed
- Kept the yearly January workflows on their intended dates while moving them earlier in the day.

## [0.1.4.2] - 2026-03-29

### Added
- Added season-aware Angelus contract fields for ordinary-time and Easter-season Spotify links.
- Added Romcal-backed Easter-season detection and regression coverage for the seasonal Angelus path.

### Changed
- Updated the Angelus refresh flow to choose the ordinary-time singing/spoken links outside Easter and the Regina Caeli singing/spoken links during Easter.
- Normalized resolved Spotify values to queue-safe `spotify:` URIs before writing playlist items.
- Updated the stabilization roadmap and README to describe the Angelus seasonal exception.

### Fixed
- Prevented partial seasonal Angelus contracts from loading and failing later at playlist write time.
- Kept non-Angelus resolver and weekday-gated contracts on the existing contract-first refresh path.

### Removed
- Removed the legacy single-URI Angelus contract entries `angelus-song.json` and `angelus-podcast.json`.

## [0.1.4.1] - 2026-03-29

### Added
- Added regression coverage for the managed-output cleanup path and the normalized Morning Prayer contract shape.

### Changed
- Moved the Morning Prayer publish destination into `config/custom_tts/morning-prayer.json` via `output_path`.
- Normalized the Morning Prayer runtime to derive its `output_folder` from the contract-owned publish path.
- Switched the remote Morning Prayer publish workflow to sync the contract-owned folder instead of copying it.
- Kept the managed-output truncation hook enabled so stale audio files are pruned before regeneration.

### Fixed
- Prevented stale OneDrive files from lingering when a Morning Prayer output disappears from the contract-owned source tree.

### Removed
- Removed the `random-intention` Morning Prayer resolver from the active contract shape.

## [0.1.4.0] - 2026-03-28

### Added
- Added regression coverage for custom-TTS-only discovery and explicit legacy-path rejection in the page-audio and Morning Prayer loaders.

### Changed
- Repointed `scripts/run_daily_novena_prayer_local.ps1` at `config/custom_tts/morning-prayer.json`.
- Kept `PAGE_AUDIO_CONFIG_FILE` and `PRAYER_CONFIG_FILE` as custom-TTS-only override hooks in the active runtime.
- Simplified `jobs/notion/generate_page_audio.py` so the main runtime no longer uses the managed-output truncation hook.
- Updated `README.md` and the shipped release artifact to describe the custom-TTS-only boundary and the final Morning Prayer cutover.

### Fixed
- Removed the legacy `config/legacy/page_audio` auto-scan from the active page-audio loader.
- Made legacy Morning Prayer contract and prayer-config override paths fail fast instead of loading archived files.
- Kept the active page-audio runtime on `config/custom_tts/` so legacy contracts no longer run or get copied over.

### Removed
- Removed the remote Morning Prayer publish workflow (`.github/workflows/morning_prayer_page_audio_remote.yml`).

## [0.1.3.2] - 2026-03-28

### Added
- Added `jobs/novena/liturgical_helpers.py` as the shared liturgical helper boundary for the devotional image and novena jobs.
- Added regression coverage for the shared helper bootstrap path and devotional-image eligibility filtering.

### Changed
- Cut `jobs/novena/generate_devotional_image.py` and `jobs/novena/generate_daily_novena_prayer.py` over to the shared helper module and removed the old `jobs/novena/liturgical_model.py` file.
- Simplified `.github/workflows/daily_devotional_image_remote.yml` so the active workflow now runs the devotional image job only.
- Updated `README.md` and the 0.1.3.2 release artifact to document the image-first rollout and keep the novena workflow disabled.

### Fixed
- Fixed direct script bootstrap for the devotional image and helper modules when run from an arbitrary working directory.
- Fixed the helper eligibility boundary so the image and novena paths share one consistent liturgical contract.

### Removed
- Removed the old novena helper module and the staged future-release planning files under `docs/releases/future-releases/`.

## [0.1.3.1] - 2026-03-27

### Added
- Added repo-owned Spotify queue contracts under `config/spotify/contracts/` and thin playlist definitions under `config/spotify/playlists/` for the Morning, Midday, Night, and Sunday playlists.
- Added a dedicated Spotify contract loader plus regression coverage for contract validation, playlist-definition queue assembly, and selected-playlist refresh runs.

### Changed
- Reworked the Spotify refresh path to assemble queues from committed contract files with explicit resolver metadata, optional fallback resolvers, and contract-level weekday gating.
- Updated the Spotify workflow, setup script, local runner, and README to document the contract-first refresh model and the corrected local module entrypoint.
- Moved the discontinued root-level page-audio, Morning Prayer, Rosary, and Auxilium contracts into `config/legacy/` and repointed the archived page-audio defaults at those legacy paths.

### Fixed
- Fixed the local Spotify refresh script so manual runs execute `python -m jobs.playlist.refresh_playlist` successfully instead of failing on module imports.
- Fixed the active Spotify contract titles and playlist membership to match the current live Opus Dei ordering.
- Fixed the legacy automation surface by disabling the archived page-audio workflow jobs before ship.

### Removed
- Removed required Opus Dei `Output Folder` grouping and required `NOTION_TOKEN` dependence from the active Spotify playlist refresh path.
- Removed legacy page-audio and prayer-generation test modules from the active test gate now that those jobs are discontinued.

## [0.1.3.0] - 2026-03-27

### Added
- Added single-contract execution mode for `PAGE_AUDIO_CONFIG_FILE`, so a selected JSON contract now runs by itself instead of silently rebuilding the shared bundled config set.
- Added page-audio library artifact fan-in and OneDrive sync stages to the prayer workflow, along with regression coverage for contract normalization, single-file loading, page-ID lookup, and legacy Divine Office builder compatibility.

### Changed
- Updated the Rosary contract to target the live Notion row `Daily Rosary with Intentions` and pinned its current page ID for stable remote resolution.
- Updated the prayer and devotional workflows to use the playlist-audio OneDrive root for page-audio sync work instead of reusing the devotional-image root.
- Documented that setting `PAGE_AUDIO_CONFIG_FILE` to a specific contract file now executes only that contract.

### Fixed
- Fixed Morning Prayer and Rosary matrix rows so they execute their selected contracts rather than unrelated shared page-audio configs.
- Fixed page lookup for file-backed contracts by honoring explicit Notion page IDs before stale title matches.
- Fixed legacy Divine Office builder compatibility needed by the page-audio migration tooling and tests.
- Fixed prayer-workflow sync safety so runs fail closed before upload when contract generation or artifact production fails.

## [0.1.2.3] - 2026-03-25

### Added
- Added a calendar-first devotional pipeline that generates devotional images and novenas before the prayer matrix runs.
- Added a final OneDrive sync job that downloads the page-audio artifacts from the matrix rows and uploads the merged library once.

### Changed
- Reworked `daily_devotional_image_remote.yml` into a two-stage workflow with `calendar` followed by `matrix` and a final `sync_page_audio_library` job.
- Moved the page-audio OneDrive delivery boundary out of the matrix rows to avoid concurrent sync races.
- Kept Morning Prayer as a matrix contract row while preserving the calendar-produced novena handoff.
- Kept GitHub Pages deployment gated to `main` so feature-branch runs stay focused on validation.

### Fixed
- Fixed the page-audio OneDrive sync failure caused by concurrent matrix rows racing to sync the same remote folder.
- Fixed the GitHub Actions artifact naming so page-audio library uploads use a valid matrix-based artifact name.
- Fixed the devotional image fallback path so the calendar job can continue when the Notion image config parent is unavailable.

## [0.1.2.1] - 2026-03-24

### Added
- Added a matrix-driven prayer contracts workflow that discovers top-level `config/*.json` files at runtime and fans out one page-audio job per contract.

### Changed
- Replaced the old Morning Prayer-only workflow body with a generic contract-driven matrix workflow.
- Documented the new matrix behavior in the project README.

### Fixed
- Fixed the workflow path mismatch by removing the stale nested Morning Prayer contract path from the GitHub Actions runner.

## [0.1.2.0] - 2026-03-24

### Added
- Added root-level file-backed page-audio contracts for Morning Prayer, Rosary, Sing the Hours, Divine Office Invitatory, Bible in a Year, Daily Mass Readings, Saint of the Day, Daily Examen, Angelus (Morning/Midday/Evening), Afternoon Prayer, and Auxilium Christianorum.
- Added Rosary weekday mystery mapping and reusable fragment composition from the contract tree.
- Added file-backed prayer content under `config/content/` and moved the active contract JSONs to the root `config/` directory.

### Changed
- Refactored the page-audio refresh loop to iterate config files first and use Notion only for the `Name`, `Order`, and `Output Folder` page fields.
- Removed the legacy page-audio and playlist/sync config merge paths so file contracts are authoritative.
- Updated Morning Prayer LOH and Evening Prayer LOH to resolve from the config-driven RSS builder path.
- Normalized active contract filenames and removed stale fallback chains outside the Morning Prayer contract.

### Fixed
- Fixed Daily Examen to resolve from the provided episode page.
- Fixed the Morning Prayer LOH and Evening Prayer LOH page-audio refresh flow so it completes against the new contract-first loop.
- Fixed OneDrive export naming to use the current Notion `Output Folder` column and contract-derived content.
- Fixed Rosary to compile from resolver order instead of the older flow fixture shape.

## [0.1.0.1] - 2026-03-23

### Added
- Added a reusable Morning Prayer construction cleanup release artifact and shipped notes for the Morning Prayer audio construction cutover.
- Added `.gitignore` entries for local `.agents/` and `.copilot/` directories.
- Added a future-release planning note for the next Rosary prayer work.

### Changed
- Removed the Spotify resolver from the Morning Prayer contract and content assembly path.
- Disabled the daily Spotify playlist workflow job and its local mirror script.
- Updated Morning Prayer content generation so the page-content path follows the generic construction pattern without playlist behavior.
- Updated the Morning Prayer release artifact, progress tracking, and shipped status to match the cutover.

### Fixed
- Fixed the Morning Prayer resolver count expectation to match the updated 13-item contract.
- Kept Morning Prayer audio generation working end to end after removing the playlist construction branch.

## [0.1.0.0] - 2026-03-23

### Added
- Added a generic `jobs/notion/generate_prayer.py` runner that loads a prayer JSON config and executes Morning Prayer from that contract.
- Added the repo-local Morning Prayer contract and file-backed content sources under `config/morning-prayer/`.
- Added future-release planning docs for the shared calendar service, novena consumer layer, devotional image refactor, and later prayer add-backs.

### Changed
- Narrowed `.github/workflows/daily_novena_prayer.yml` into a Morning Prayer workflow that calls the generic prayer runner.
- Updated `scripts/run_daily_novena_prayer_local.ps1` to call the generic prayer runner with the Morning Prayer config.
- Shifted Morning Prayer to a config-driven path while keeping audio file materialization for OneDrive.
- Removed the old Morning Prayer test shape that exercised the legacy multi-prayer constructions.
- Updated the Morning Prayer architecture and release docs to describe the hard cutover and the future enhancement ladder.

### Fixed
- Fixed direct execution of `jobs/notion/generate_prayer.py` by adding repo-root import bootstrap.
- Fixed local Morning Prayer regeneration so the new runner executes successfully from the repo root.
- Fixed the remote GitHub Actions Morning Prayer workflow so it completes end to end on the cutover branch.

## [0.0.5.3] - 2026-03-23

### Fixed
- Fixed the daily novena job so `jobs/novena/generate_daily_novena_prayer.py` can run directly in GitHub Actions without a `ModuleNotFoundError` for `jobs`.
- Added regression coverage for the direct-import startup path to keep the import bootstrap from regressing.

## [0.0.5.2] - 2026-03-23

### Added
- Added a dedicated Liturgical Calendar sync regression test module covering backfill range selection, rerunnable upserts, and archived-row handling.

### Changed
- Clarified the Liturgical Calendar yearly sync docs with a concrete 2026-2027 repopulation example and explicit rerun guidance.
- Renamed the Liturgical Calendar sync surface so the calendar workflow uses Liturgical Calendar naming while preserving the legacy Saint Radar helper compatibility.

### Fixed
- Fixed the Liturgical Calendar yearly sync so archived or in-trash rows are ignored during upsert and duplicate cleanup, allowing reruns to create fresh live pages instead of patching deleted ones.
- Fixed the live Liturgical Calendar backfill path so the 2026-2027 repopulation completes successfully and preserves Palm Sunday and Easter Sunday rows.

## [0.0.5.1] - 2026-03-22

### Changed
- Introduced a shared liturgical eligibility helper so devotional outputs now use one rank-and-precedence contract across novena and devotional-image generation.
- Documented that devotional outputs intentionally allow memorials, feasts, and solemnities, including non-saint feasts such as Palm Sunday or Epiphany, while explicitly excluding Easter Octave weekdays by precedence.
- Updated the release artifact and backlog notes to reflect the Holy Week novena cleanup work.

### Fixed
- Fixed the novena pipeline so Holy Week weekdays no longer qualify for day-by-day novena generation under the new rank-based contract.
- Fixed the devotional-image pipeline so Easter Octave weekdays no longer qualify, even though the shared Romcal model still maps them to the pseudo-rank `solemnity-easter octave`.
- Added cleanup for already-generated ineligible novena sections and audio markers so stale Holy Week outputs are removed on subsequent runs.
- Added regression coverage for rank-based inclusion, Holy Week exclusion, Easter Octave exclusion, and invalid-output cleanup.

## [0.0.5.0] - 2026-03-22

### Changed
- Migrated the repo onto the `docs/releases/` workflow artifacts so release planning, progress, QA, and shipped context now live in one canonical location.
- Carried forward the consolidated historical release context from the old `release/releaselog.md` source into the new release-folder contract.
- Documented Morning Prayer detailed fragments as a stable-key workflow where `Fragment Key` is the runtime identity and the row title can evolve independently.

### Fixed
- Fixed Morning Prayer detailed-fragment validation so it now matches required contract rows by stable key instead of exact display label.
- Fixed Morning Prayer migration/preflight matching so existing rows with the correct canonical key can be relinked even after a title rename such as `Petition - Church` -> `Petition - Right Use of Technology`.
- Added regression coverage for renamed-label acceptance, missing-key rejection, and explicit detailed-fragment key preference in the page-audio and migration suites.

## Enhancement 000: Morning Prayer Fragment Migration
- Moved Morning Prayer planning from the legacy audio-composition path toward the two-list Opus Dei + Detailed Fragments model.
- Captured the migration boundary for Morning Prayer, including the required fragment set and the need to avoid orphaned legacy fragment rows.
- Documented the related Notion fragment-view recipe so the new detailed-fragments database stays readable and ordered.

## Enhancement 001: Ordered Playlist Audio and Managed Truncation
- Standardized ordered `Playlist Audio` exports around top-level `Order` while keeping Morning Prayer's working page-body behavior intact.
- Added managed daily truncation so stale playlist-audio files disappear before the rebuild and sync step.
- Preserved the mixed text-sync model so reliable text sources can sync without breaking established writers.

## Enhancement 002: Order-First Playlist Naming
- Updated ordered `Playlist Audio` filenames so the order token comes first in the stem.
- Kept the same spaced separator style and continued using the shared top-level `Order` contract for queueing and export naming.
- Required `Output Folder` for ordered exports and retained managed truncation before sync.

## Enhancement 003: Romcal Overlay and Special Sunday Normalization
- Added a synthetic Romcal child calendar overlay that inherits from the requested calendar and applies explicit special-Sunday normalization rules.
- Normalized the Easter Octave pseudo-rank and expanded the devotional-image allowlist so it can recognize the special celebration state.
- Added regression coverage for named special Sundays, Easter Octave, Christmas, Pentecost, Christ the King, and ordinary Sundays.

## Bug 001: Daily Novena Stale-Audio Regeneration
- Fixed the daily novena audio workflow so reruns rebuild the managed novena audio subtree cleanly.
- Added regression coverage for the stale-audio rerun case.
- Updated the README and progress notes to describe the cleanup behavior.
- Verified the fix with `py -3 -m unittest tests.test_novena_job`, `py -3 -m unittest tests.test_page_audio_job`, and the full test suite.

## Bug 002: Daily Novena Legacy Prefetch Cleanup
- Made the legacy OneDrive novena prefetch explicitly optional.
- The daily novena workflow now skips the legacy copy when `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT` is unset.
- Updated the README and progress notes to document the opt-in legacy path.
- Verified the workflow locally and with a remote GitHub Actions run that logged the skip message instead of the missing-root error.

## [0.1.5.6] - 2026-04-27

### Changed
- Added date-scoped Morning Prayer episode metadata so each day now publishes its own title, description, guid, and sidecar state.
- Introduced a contract-owned `daily_intro` block for the Morning Prayer opening, powered by Romcal, `catholic-mass-readings`, and OpenAI text generation.
- Kept the TTS voice on `alloy` while moving the prompt text model onto the repo's existing `OAI_MODEL` convention.
- Added safe template rendering for contract metadata and archive-aware RSS rebuilding from published sidecars.

### Fixed
- Fixed daily reruns so today's publish overwrites only today's date-scoped episode artifacts instead of an evergreen record.
- Fixed the publish pipeline to preserve prior date-scoped episodes in the feed while still allowing today's run to refresh cleanly.
- Added coverage for the new daily intro, date-scoped audio paths, and archive-aware feed rebuilds.

## Notes
- This file initializes the `docs/releases/` contract from the prior `release/releaselog.md` source.
- Historical context still exists in git history if deeper detail is needed.

## [0.3.1.3] - 2026-05-02

### Fixed
- Relaxed the Gospel-free daily intro validator so a three-sentence OpenAI response no longer aborts Morning Prayer.
- Kept the Gospel-present path strict at exactly three sentences.
- Added regression coverage for the tolerant Gospel-free fallback path.

## [0.3.1.4] - 2026-05-02

### Fixed
- Removed the remaining Gospel-free daily intro validation guard.
- Let the Gospel-free intro return an empty string if the model does so.
- Kept the Gospel-present path strict at exactly three sentences.

## [0.3.1.5] - 2026-05-02

### Fixed
- Fixed the archive dashboard so the JSON sidecar link points at the published GitHub Pages URL.
- Kept the MP3 link behavior unchanged.
- Added regression coverage for the rendered sidecar href.
