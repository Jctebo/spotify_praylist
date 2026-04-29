from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import jobs.novena_contracts.url_import as importer_mod
import jobs.novena_contracts.validators as validators_mod


def _detail_page_html(*, title: str, subject: str, starts: str, feast: str) -> str:
    day_sections = []
    for day in range(1, 10):
        day_sections.append(
            f"""
    <h2 id="day-{day}">Day {day}</h2>
    <p>In the Name of the Father, and of the Son, and of the Holy Spirit. Amen.</p>
    <p>Day {day} prayer text for {subject}.</p>
    <p>Our Father, Hail Mary Glory Be (three times each)</p>
    <p>In the Name of the Father, and of the Son, and of the Holy Spirit. Amen.</p>
            """
        )
    return f"""
<!doctype html>
<html lang="en">
  <head>
    <title>{title} | Intercede - Catholic Novenas</title>
    <meta property="og:title" content="{title}">
  </head>
  <body>
    <section class="page__content">
      <h1 id="our-lady-of-fatima-novena">{title}</h1>
      <div class="notice--info">
        <strong>Facts about {subject}</strong><br />
        <table style="border-bottom: 0">
          <tr><td>Novena Starts:</td><td>{starts}</td></tr>
          <tr><td width="150">Feastday:</td><td width="300">{feast}</td></tr>
        </table>
      </div>
      <p>You can pray the full {subject} below.</p>
      {''.join(day_sections)}
      <div id="social-share-9">Today's prayer complete! Share this novena with someone who needs it. Link copied!</div>
      <h1 id="answered">Email Me Answered Prayers</h1>
      <p>Send me your answered prayers from the {subject}</p>
      <h2 id="email-signup">⏰ Reminder Signup</h2>
      <p>Click here to get the Catholic Novena Ebook for FREE, as well as reminders of when novenas begin</p>
      <h1 id="related">Related Novena</h1>
      <p>Our Lady of Knock Novena</p>
    </section>
  </body>
</html>
"""


def _repeated_canonical_prayer_page_html(*, title: str, subject: str, starts: str, feast: str) -> str:
    day_sections = []
    for day in range(1, 10):
        day_sections.append(
            f"""
    <h2 id="day-{day}">Day {day}</h2>
    <p>In the Name of the Father, and of the Son, and of the Holy Spirit. Amen.</p>
    <p>Please pray for our intention in this novena, (mention request here…)</p>
    <p>Our Father, Hail Mary Glory Be (three times each)</p>
    <p>In the Name of the Father, and of the Son, and of the Holy Spirit. Amen.</p>
            """
        )
    return f"""
<!doctype html>
<html lang="en">
  <head>
    <title>{title} | Intercede - Catholic Novenas</title>
    <meta property="og:title" content="{title}">
  </head>
  <body>
    <section class="page__content">
      <h1 id="our-lady-of-fatima-novena">{title}</h1>
      <div class="notice--info">
        <strong>Facts about {subject}</strong><br />
        <table style="border-bottom: 0">
          <tr><td>Novena Starts:</td><td>{starts}</td></tr>
          <tr><td width="150">Feastday:</td><td width="300">{feast}</td></tr>
        </table>
      </div>
      <p>You can pray the full {subject} below.</p>
      {''.join(day_sections)}
      <div id="social-share-9">Today's prayer complete! Share this novena with someone who needs it. Link copied!</div>
      <h1 id="answered">Email Me Answered Prayers</h1>
      <p>Send me your answered prayers from the {subject}</p>
      <h2 id="email-signup">⏰ Reminder Signup</h2>
      <p>Click here to get the Catholic Novena Ebook for FREE, as well as reminders of when novenas begin</p>
      <h1 id="related">Related Novena</h1>
      <p>Our Lady of Knock Novena</p>
    </section>
  </body>
</html>
"""


def _catalog_html(sections: list[tuple[str, list[tuple[str, str, str, str]]]]) -> str:
    rendered = []
    for month_id, items in sections:
        month_label = month_id.replace("-", " ").title()
        rendered.append(f'<h3 id="{month_id}" style="margin-top: 2rem;">{month_label}</h3>')
        rendered.append("<ul>")
        for href, title, starts, feast in items:
            rendered.append(
                f'<li style="margin-bottom: 1rem;"> <strong><a href="{href}">{title}</a></strong><br /> '
                f'<span style="font-size: 0.85em; color: #666;">📆 Starts: {starts} • Feast: {feast}</span></li>'
            )
        rendered.append("</ul>")
    return f"""
<!doctype html>
<html lang="en">
  <body>
      {''.join(rendered)}
  </body>
</html>
"""


class TestNovenaUrlImport(unittest.TestCase):
    def test_single_import_builds_enabled_contract_from_fixed_date_page(self):
        url = "https://catholicnovenaapp.com/novenas/example-novena/"
        html = _detail_page_html(
            title="Example Novena",
            subject="Example Novena",
            starts="June 1",
            feast="June 10",
        )

        report = importer_mod.import_single_url(url, fetcher=lambda _: html, dry_run=True)
        draft = report.entries[0]

        self.assertEqual(draft.status, "written")
        self.assertTrue(draft.enabled)
        self.assertEqual(draft.display_name, "Example")
        self.assertEqual(draft.contract_id, "example")
        self.assertEqual(draft.feast_mode, "fixed")
        self.assertEqual(draft.payload["contract"]["enabled"], True)
        self.assertEqual(draft.payload["contract"]["feast"]["month"], 6)
        self.assertEqual(draft.payload["contract"]["feast"]["day"], 10)
        self.assertEqual(
            draft.payload["contract"]["publishing"]["rss"]["episode_title_pattern"],
            "Traditional Novena to {saint_name} Day {day}",
        )
        sections = draft.payload["contract"]["novena"]["template"]["sections"]
        blocks = draft.payload["contract"]["novena"]["template"]["blocks"]
        fragments = draft.payload["contract"]["novena"]["template"]["fragments"]
        self.assertEqual(sections[0]["title"], "Introduction")
        self.assertEqual(len(sections), 10)
        self.assertEqual(sections[1]["title"], "Day 1")
        self.assertEqual(sections[1]["days"], [1])
        self.assertEqual(blocks[1]["days"], [1])
        self.assertIn("parts", blocks[1])
        self.assertTrue(any(part.get("kind") == "fragment" for part in blocks[1]["parts"]))
        self.assertEqual(
            [fragment["key"] for fragment in fragments],
            ["our_father", "hail_mary", "glory_be"],
        )
        self.assertTrue(sections[1]["text"].startswith("In the Name of the Father"))
        self.assertNotIn("Answered Prayers", sections[-1]["text"])
        self.assertNotIn("Share this novena", sections[-1]["text"])
        self.assertNotIn("Related Novena", sections[-1]["text"])

    def test_single_import_embeds_movable_feast_content_and_keeps_enabled(self):
        url = "https://catholicnovenaapp.com/novenas/sacred-heart-novena/"
        html = _detail_page_html(
            title="Novena to the Sacred Heart of Jesus",
            subject="Novena to the Sacred Heart of Jesus",
            starts="June 3",
            feast="10 days after Pentecost",
        )
        expected_contract_id = validators_mod.resolve_romcal_identifier("The Sacred Heart of Jesus")

        report = importer_mod.import_single_url(url, fetcher=lambda _: html, dry_run=True)
        draft = report.entries[0]

        self.assertEqual(draft.status, "written")
        self.assertTrue(draft.enabled)
        self.assertEqual(draft.feast_mode, "romcal_id")
        self.assertEqual(draft.contract_id, expected_contract_id)
        self.assertEqual(draft.payload["contract"]["enabled"], True)
        self.assertTrue(any("movable feast resolved" in issue for issue in draft.issues))
        self.assertTrue(expected_contract_id)
        self.assertEqual(len(draft.payload["contract"]["novena"]["template"]["sections"]), 10)

    def test_single_import_maps_pentecost_alias_to_pentecost_sunday(self):
        url = "https://catholicnovenaapp.com/novenas/holy-spirit-novena/"
        html = _detail_page_html(
            title="Holy Spirit Novena - Powerful Pentecost Prayers",
            subject="Holy Spirit Novena - Powerful Pentecost Prayers",
            starts="10 days before Pentecost",
            feast="on Pentecost",
        )
        expected_contract_id = validators_mod.resolve_romcal_identifier("Pentecost Sunday")

        report = importer_mod.import_single_url(url, fetcher=lambda _: html, dry_run=True)
        draft = report.entries[0]

        self.assertEqual(draft.status, "written")
        self.assertTrue(draft.enabled)
        self.assertEqual(draft.feast_mode, "romcal_id")
        self.assertEqual(draft.payload["contract"]["feast"]["romcal_id"], expected_contract_id)
        self.assertEqual(draft.payload["contract"]["feast"]["romcal_id"], "pentecost_sunday")
        self.assertEqual(len(draft.payload["contract"]["novena"]["template"]["sections"]), 10)

    def test_single_import_annotates_openai_tts_rewrites_with_notes(self):
        url = "https://catholicnovenaapp.com/novenas/our-lady-of-fatima-novena/"
        html = _repeated_canonical_prayer_page_html(
            title="Our Lady of Fatima Novena",
            subject="Our Lady of Fatima Novena",
            starts="May 4",
            feast="May 13",
        )
        our_father = importer_mod._load_prayer_text("Our Father")
        hail_mary = importer_mod._load_prayer_text("Hail Mary")
        glory_be = importer_mod._load_prayer_text("Glory Be")
        resolved_text = (
            "In the Name of the Father, and of the Son, and of the Holy Spirit. Amen.\n\n"
            "You are going to say this three times: Our Father.\n\n"
            f"{our_father}\n\n"
            f"{our_father}\n\n"
            f"{our_father}\n\n"
            "You are going to say this three times: Hail Mary.\n\n"
            f"{hail_mary}\n\n"
            f"{hail_mary}\n\n"
            f"{hail_mary}\n\n"
            "You are going to say this three times: Glory Be.\n\n"
            f"{glory_be}\n\n"
            f"{glory_be}\n\n"
            f"{glory_be}\n\n"
            "In the Name of the Father, and of the Son, and of the Holy Spirit. Amen."
        )

        with patch.object(
            importer_mod,
            "_openai_tts_resolution",
            return_value=importer_mod.TtsResolution(
                text=resolved_text,
                notes=("expanded repetition instruction into three explicit spoken recitations",),
            ),
        ) as openai_mock:
            report = importer_mod.import_single_url(
                url,
                fetcher=lambda _: html,
                dry_run=True,
                resolve_with_openai=True,
                openai_api_key="test-key",
            )

        draft = report.entries[0]
        sections = draft.payload["contract"]["novena"]["template"]["sections"]
        blocks = draft.payload["contract"]["novena"]["template"]["blocks"]
        fragments = draft.payload["contract"]["novena"]["template"]["fragments"]

        self.assertTrue(openai_mock.called)
        self.assertEqual(draft.status, "written")
        self.assertIn("Day 1: expanded canonical prayer references into full rosary texts and repeated each prayer three times", draft.notes)
        self.assertTrue(any("expanded repetition instruction into three explicit spoken recitations" in note for note in draft.notes))
        self.assertIn("expanded canonical prayer references into full rosary texts", sections[1]["notes"])
        self.assertIn("You are going to say this three times", sections[1]["text"])
        self.assertEqual(blocks[1]["days"], list(range(1, 10)))
        self.assertIn("parts", blocks[1])
        self.assertEqual(
            [fragment["key"] for fragment in fragments],
            ["our_father", "hail_mary", "glory_be"],
        )
        self.assertEqual(
            [part["kind"] for part in blocks[1]["parts"] if part["kind"] == "fragment"],
            ["fragment", "fragment", "fragment"],
        )
        self.assertEqual(
            [part.get("repeat", 1) for part in blocks[1]["parts"] if part["kind"] == "fragment"],
            [3, 3, 3],
        )
        markdown = report.to_markdown()
        self.assertIn("## Contract Preview", markdown)
        self.assertIn("### Days 1-9", markdown)
        self.assertIn("- Days: Days 1-9", markdown)
        self.assertIn("## Fragment Library", markdown)
        self.assertIn("our_father", markdown)
        self.assertIn("expanded canonical prayer references into full rosary texts", markdown)
        self.assertIn("our_father x3", markdown)

    def test_single_import_reads_openai_settings_from_local_env_file(self):
        url = "https://catholicnovenaapp.com/novenas/our-lady-of-fatima-novena/"
        html = _repeated_canonical_prayer_page_html(
            title="Our Lady of Fatima Novena",
            subject="Our Lady of Fatima Novena",
            starts="May 4",
            feast="May 13",
        )
        resolved_text = (
            "In the Name of the Father, and of the Son, and of the Holy Spirit. Amen.\n\n"
            "You are going to say this three times: Our Father, Hail Mary Glory Be.\n\n"
            "Our Father, Hail Mary Glory Be.\n\n"
            "Our Father, Hail Mary Glory Be.\n\n"
            "Our Father, Hail Mary Glory Be.\n\n"
            "In the Name of the Father, and of the Son, and of the Holy Spirit. Amen."
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            local_env = Path(tmpdir) / "openai.env"
            local_env.write_text(
                "\n".join(
                    [
                        "OPENAI_API_KEY=local-test-key",
                        "OAI_API_BASE_URL=https://example.invalid/v1",
                        "OAI_MODEL=gpt-local-mini",
                    ]
                )
                + "\n",
                encoding="utf-8",
            )
            with patch.dict(importer_mod.os.environ, {"OPENAI_API_KEY": "", "OPENAI_API_KEY_FILE": str(local_env)}, clear=False):
                with patch.object(
                    importer_mod,
                    "_openai_tts_resolution",
                    return_value=importer_mod.TtsResolution(
                        text=resolved_text,
                        notes=("expanded repetition instruction into three explicit spoken recitations",),
                    ),
                ) as openai_mock:
                    report = importer_mod.import_single_url(
                        url,
                        fetcher=lambda _: html,
                        dry_run=True,
                        resolve_with_openai=True,
                    )

        draft = report.entries[0]
        self.assertTrue(openai_mock.called)
        self.assertEqual(draft.status, "written")
        self.assertIn("Day 1: expanded canonical prayer references into full rosary texts and repeated each prayer three times", draft.notes)

    def test_single_import_expands_canonical_prayer_texts_without_openai(self):
        url = "https://catholicnovenaapp.com/novenas/our-lady-of-fatima-novena/"
        html = _repeated_canonical_prayer_page_html(
            title="Our Lady of Fatima Novena",
            subject="Our Lady of Fatima Novena",
            starts="May 4",
            feast="May 13",
        )
        repo_root = Path(__file__).resolve().parents[1]
        our_father_text = (repo_root / "config/publish/templates/rosary/our-father.txt").read_text(encoding="utf-8").strip()
        hail_mary_text = (repo_root / "config/publish/templates/rosary/hail-mary.txt").read_text(encoding="utf-8").strip()
        glory_be_text = (repo_root / "config/publish/templates/rosary/glory-be.txt").read_text(encoding="utf-8").strip()

        report = importer_mod.import_single_url(url, fetcher=lambda _: html, dry_run=True, resolve_with_openai=False)
        draft = report.entries[0]
        day_one = draft.payload["contract"]["novena"]["template"]["sections"][1]["text"]

        self.assertEqual(draft.status, "written")
        self.assertIn(our_father_text, day_one)
        self.assertIn(hail_mary_text, day_one)
        self.assertIn(glory_be_text, day_one)
        self.assertIn("expanded canonical prayer references into full rosary texts", draft.notes[0])

    def test_single_import_reuses_compacted_prompt_source_for_identical_days(self):
        url = "https://catholicnovenaapp.com/novenas/our-lady-of-fatima-novena/"
        html = _repeated_canonical_prayer_page_html(
            title="Our Lady of Fatima Novena",
            subject="Our Lady of Fatima Novena",
            starts="May 4",
            feast="May 13",
        )
        resolved_text = (
            "In the Name of the Father, and of the Son, and of the Holy Spirit. Amen.\n\n"
            "You are going to say this three times: Our Father, who art in heaven...\n\n"
            "Our Father, who art in heaven...\n\n"
            "Our Father, who art in heaven...\n\n"
            "Our Father, who art in heaven...\n\n"
            "In the Name of the Father, and of the Holy Spirit. Amen."
        )

        with patch.object(
            importer_mod,
            "_openai_tts_resolution",
            return_value=importer_mod.TtsResolution(
                text=resolved_text,
                notes=("expanded repetition instruction into three explicit spoken recitations",),
            ),
        ) as openai_mock:
            report = importer_mod.import_single_url(
                url,
                fetcher=lambda _: html,
                dry_run=True,
                resolve_with_openai=True,
                openai_api_key="test-key",
            )

        draft = report.entries[0]
        self.assertEqual(openai_mock.call_count, 1)
        self.assertEqual(draft.status, "written")
        self.assertTrue(any("reused compacted prayer source from an earlier section" in note for note in draft.notes))
        blocks = draft.payload["contract"]["novena"]["template"]["blocks"]
        self.assertTrue(any(block.get("days") == list(range(1, 10)) for block in blocks))

    def test_single_import_disables_unresolved_movable_feasts(self):
        url = "https://catholicnovenaapp.com/novenas/mary-queen-of-the-apostles-novena/"
        html = _detail_page_html(
            title="Mary, Queen of the Apostles Novena",
            subject="Mary, Queen of the Apostles Novena",
            starts="Thursday of the Fifth Week of Easter",
            feast="Saturday after Ascension Thursday",
        )

        report = importer_mod.import_single_url(url, fetcher=lambda _: html, dry_run=True)
        draft = report.entries[0]

        self.assertEqual(draft.status, "disabled")
        self.assertFalse(draft.enabled)
        self.assertTrue(any("unable to resolve feast id" in issue for issue in draft.issues))

    def test_bulk_import_discovers_entries_in_catalog_order(self):
        catalog_url = "https://catholicnovenaapp.com/list-of-all-novenas/"
        first_url = "https://catholicnovenaapp.com/novenas/example-novena/"
        second_url = "https://catholicnovenaapp.com/novenas/sacred-heart-novena/"
        catalog_html = _catalog_html(
            [
                (
                    "january",
                    [
                        ("/novenas/example-novena/", "Example Novena", "January 1", "January 10"),
                    ],
                ),
                (
                    "june",
                    [
                        ("/novenas/sacred-heart-novena/", "Novena to the Sacred Heart of Jesus", "June 3", "10 days after Pentecost"),
                    ],
                ),
            ]
        )
        fixed_html = _detail_page_html(
            title="Example Novena",
            subject="Example Novena",
            starts="January 1",
            feast="January 10",
        )
        movable_html = _detail_page_html(
            title="Novena to the Sacred Heart of Jesus",
            subject="Novena to the Sacred Heart of Jesus",
            starts="June 3",
            feast="10 days after Pentecost",
        )
        pages = {
            catalog_url: catalog_html,
            first_url: fixed_html,
            second_url: movable_html,
        }

        report = importer_mod.import_bulk_catalog(catalog_url, fetcher=lambda url: pages[url], dry_run=True)

        self.assertEqual([entry.source_url for entry in report.entries], [first_url, second_url])
        self.assertEqual([entry.contract_id for entry in report.entries], ["example", validators_mod.resolve_romcal_identifier("The Sacred Heart of Jesus")])
        self.assertEqual([entry.status for entry in report.entries], ["written", "written"])
        self.assertEqual(report.written, 2)
        self.assertEqual(report.disabled, 0)
        self.assertEqual(report.hard_failures, 0)

        with tempfile.TemporaryDirectory() as tmpdir:
            report_json, report_md = importer_mod.write_bulk_report(report, report_dir=Path(tmpdir))
            self.assertTrue(report_json.exists())
            self.assertTrue(report_md.exists())
            report_payload = json.loads(report_json.read_text(encoding="utf-8"))
            self.assertEqual(report_payload["summary"]["mode"], "bulk")
            self.assertEqual(report_payload["summary"]["written"], 2)

    def test_bulk_import_can_filter_to_may(self):
        catalog_url = "https://catholicnovenaapp.com/list-of-all-novenas/"
        may_first_url = "https://catholicnovenaapp.com/novenas/our-lady-of-the-forsaken-novena/"
        may_second_url = "https://catholicnovenaapp.com/novenas/our-lady-of-fatima-novena/"
        catalog_html = _catalog_html(
            [
                (
                    "april",
                    [
                        ("/novenas/april-novena/", "April Novena", "April 1", "April 10"),
                    ],
                ),
                (
                    "may",
                    [
                        ("/novenas/our-lady-of-the-forsaken-novena/", "Our Lady of the Forsaken Novena", "May 1", "May 10"),
                        ("/novenas/our-lady-of-fatima-novena/", "Our Lady of Fatima Novena", "May 4", "May 13"),
                    ],
                ),
                (
                    "june",
                    [
                        ("/novenas/june-novena/", "June Novena", "June 1", "June 10"),
                    ],
                ),
            ]
        )
        may_one_html = _detail_page_html(
            title="Our Lady of the Forsaken Novena",
            subject="Our Lady of the Forsaken Novena",
            starts="May 1",
            feast="May 10",
        )
        may_two_html = _detail_page_html(
            title="Our Lady of Fatima Novena",
            subject="Our Lady of Fatima Novena",
            starts="May 4",
            feast="May 13",
        )
        pages = {
            catalog_url: catalog_html,
            may_first_url: may_one_html,
            may_second_url: may_two_html,
        }

        report = importer_mod.import_bulk_catalog(catalog_url, fetcher=lambda url: pages[url], dry_run=True, month="may")

        self.assertEqual([entry.source_url for entry in report.entries], [may_first_url, may_second_url])
        self.assertEqual(report.written, 2)
        self.assertEqual(report.disabled, 0)
        self.assertEqual(report.hard_failures, 0)

    def test_single_import_reports_failures_when_page_cannot_be_parsed(self):
        url = "https://catholicnovenaapp.com/novenas/broken-page/"
        html = "<html><body><h1>Broken Page</h1></body></html>"

        report = importer_mod.import_single_url(url, fetcher=lambda _: html, dry_run=True)
        draft = report.entries[0]

        self.assertEqual(draft.status, "failed")
        self.assertFalse(draft.enabled)
        self.assertEqual(report.hard_failures, 1)
