import datetime as dt
import unittest

from jobs.novena.devotional_calendar import resolve_calendar


def calendar_bytes(events):
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Test//Devotion//EN"]
    for day, summary in events:
        lines.extend([
            "BEGIN:VEVENT", f"UID:{day}-{summary}", f"DTSTART;VALUE=DATE:{day.replace('-', '')}",
            f"DTEND;VALUE=DATE:{(dt.date.fromisoformat(day) + dt.timedelta(days=1)).strftime('%Y%m%d')}",
            f"SUMMARY:{summary}", "END:VEVENT",
        ])
    lines.append("END:VCALENDAR")
    return ("\r\n".join(lines) + "\r\n").encode()


class DevotionalCalendarTests(unittest.TestCase):
    def test_feast_and_private_devotion_take_precedence_over_weekday_context(self):
        events = [
            ("2026-10-07", "🟢 Wednesday in the 27th Week in Ordinary Time"),
            ("2026-10-07", "[M] Our Lady of the Rosary"),
            ("2026-10-08", "🟢 Thursday in the 27th Week in Ordinary Time"),
            ("2026-10-08", "Octave of Saint Bridget [Day 2] (private devotion)"),
        ]
        result = resolve_calendar(calendar_bytes(events), [dt.date(2026, 10, 7), dt.date(2026, 10, 8)])
        self.assertEqual(result.specs[dt.date(2026, 10, 7)].title, "OUR LADY OF THE ROSARY")
        self.assertEqual(result.specs[dt.date(2026, 10, 8)].classification, "PRIVATE DEVOTION")
        self.assertEqual(result.specs[dt.date(2026, 10, 8)].sequence_day, 2)

    def test_monthly_fallback_only_for_represented_context_date_and_absent_day_is_skipped(self):
        events = [("2026-10-03", "🟢 Saturday in the 26th Week in Ordinary Time")]
        result = resolve_calendar(calendar_bytes(events), [dt.date(2026, 10, 3), dt.date(2026, 10, 4)])
        fallback = result.specs[dt.date(2026, 10, 3)]
        self.assertEqual(fallback.title, "OUR LADY OF THE ROSARY")
        self.assertTrue(fallback.monthly_fallback)
        self.assertNotIn(dt.date(2026, 10, 4), result.specs)
        self.assertEqual(result.missing_dates, (dt.date(2026, 10, 4),))

    def test_no_coverage_marker_needed(self):
        result = resolve_calendar(
            calendar_bytes([("2026-10-03", "[F] Saint Example, Feast")]),
            [dt.date(2026, 10, 3)],
        )
        self.assertEqual(result.covered_through, None)
        self.assertEqual(result.specs[dt.date(2026, 10, 3)].classification, "FEAST")

    def test_outlook_ordinal_week_context_and_sequence_title(self):
        body = calendar_bytes([
            ("2026-10-03", "[m] ⚪ Saturday in the 26ᵗʰ Week in Ordinary Time — The Blessed Virgin Mary, Memorial"),
            ("2026-10-04", "Triduum of Our Lady of the Rosary [Day 1] (private devotion)"),
        ])
        result = resolve_calendar(body, [dt.date(2026, 10, 3), dt.date(2026, 10, 4)])
        self.assertEqual(result.specs[dt.date(2026, 10, 3)].title, "THE BLESSED VIRGIN MARY")
        self.assertEqual(result.specs[dt.date(2026, 10, 3)].classification, "OPTIONAL MEMORIAL")
        sequence = result.specs[dt.date(2026, 10, 4)]
        self.assertEqual(sequence.title, "OUR LADY OF THE ROSARY")
        self.assertEqual((sequence.sequence_kind, sequence.sequence_day), ("TRIDUUM", 1))

    def test_unclassified_non_context_event_fails_closed(self):
        with self.assertRaisesRegex(RuntimeError, "Unclassified"):
            resolve_calendar(calendar_bytes([("2026-10-03", "Something unrelated")]), [dt.date(2026, 10, 3)])


if __name__ == "__main__":
    unittest.main()
