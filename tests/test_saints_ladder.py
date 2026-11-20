"""Tests for the v306 saints ladder (jobs/publish/saints_ladder.py).

Fast cases stub the two sources (window runtimes, feast saints) — no
romcal, no resolver cost. The integration class at the bottom runs
the real production sources for the two pinned dates; it is slow
(~45 s per resolver call) and runs in the repo venv only.
"""

import copy
import datetime as dt
import unittest
from pathlib import Path

from jobs.publish import saints_ladder

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "config" / "publish" / "templates" / "morning-prayer" / "intercessory-litany.txt"

CORE = [
    "Holy Mary, Mother of God",
    "Saint Joseph",
    "Saint Michael the Archangel",
    "Saint Gabriel the Archangel",
    "Saint Raphael the Archangel",
    "Saint John the Baptist",
    "Saint Peter and Saint Paul",
    "Saint John the Apostle",
    "Saint Teresa of Ávila",
]
PATRONS = [
    "Saint Thérèse of Lisieux",
    "Saint John Bosco",
    "Saint Thomas More",
    "Saint Francis de Sales",
    "Saint Isidore of Seville",
    "Saint Albert the Great",
    "Saint Maximilian Kolbe",
    "Saint John Paul II",
    "Saint Teresa of Calcutta",
    "Saint Elizabeth of Hungary",
    "Saint Sebastian",
    "Saint Pier Giorgio Frassati",
    "Saint Mark",
    "Saint Angela Merici",
    "Saint Josemaría Escrivá",
    "Saint Carlo Acutis",
]


class _Rt:
    """A window-runtime stub with the fields the ladder reads."""

    def __init__(self, contract_id, saint_id, saint_name):
        self.contract_id = contract_id
        self.saint = {"id": saint_id, "name": saint_name}


def _resolve(target, windows, feast):
    return saints_ladder.resolve_invocations(target, windows=windows, feast_saints=feast)


class TestPinnedDays(unittest.TestCase):
    def test_oct_9_worked_example_34(self):
        # Mechanism fixture per Plan §2 verification case 1: the
        # stubbed feast input names two saints (Denis + John
        # Leonardi), yielding the Plan's 34. Production's calendar
        # names one saint that day — the integration case below pins
        # the production total (33). This fixture tests ordering,
        # promotion, and dedupe mechanics, not the calendar's content.
        windows = [
            _Rt("our_lady_of_la_leche", "our_lady_of_la_leche", "Our Lady of La Leche"),
            _Rt("john_xxiii_pope", "john_xxiii_pope", "Saint John XXIII, Pope"),
            _Rt("st_carlo_acutis", "st_carlo_acutis", "St Carlo Acutis"),
            _Rt("callistus_i_pope", "callistus_i_pope", "Saint Callistus I, Pope and Martyr"),
            _Rt("st_teresa_of_avila", "st_teresa_of_avila", "St. Teresa of Avila"),
            _Rt("teresa_of_jesus_of_avila_virgin", "teresa_of_jesus_of_avila_virgin", "Saint Teresa of Jesus, Virgin and Doctor of the Church"),
            _Rt("hedwig_of_silesia_religious", "hedwig_of_silesia_religious", "Saint Hedwig, Religious"),
            _Rt("st_gerard_majella", "st_gerard_majella", "St. Gerard Majella"),
            _Rt("st_margaret_mary", "st_margaret_mary", "St. Margaret Mary"),
            _Rt("ignatius_of_antioch_bishop", "ignatius_of_antioch_bishop", "Saint Ignatius of Antioch, Bishop and Martyr"),
            _Rt("st_luke", "st_luke", "St Luke"),
        ]
        feast = ["Saint Denis and Companions", "Saint John Leonardi"]
        got = _resolve(dt.date(2026, 10, 9), windows, feast)
        tier2 = [
            "Saint Denis and Companions",
            "Saint John Leonardi",
            "Saint John XXIII",
            "Saint Carlo Acutis",
            "Saint Callistus I",
            "Saint Hedwig of Silesia",
            "Saint Gerard Majella",
            "Saint Margaret Mary",
            "Saint Ignatius of Antioch",
            "Saint Luke",
        ]
        patrons = [p for p in PATRONS if p != "Saint Carlo Acutis"]
        self.assertEqual(got, CORE + tier2 + patrons)
        self.assertEqual(len(got), 34)
        # Carlo exactly once, in the Tier 2 position (acceptance criterion 2).
        self.assertEqual(got.count("Saint Carlo Acutis"), 1)
        self.assertEqual(got.index("Saint Carlo Acutis"), len(CORE) + 3)
        # Teresa of Ávila exactly once, in the core (position 9), despite
        # both of her contract forms standing in the window list.
        self.assertEqual(got.count("Saint Teresa of Ávila"), 1)
        self.assertEqual(got.index("Saint Teresa of Ávila"), 8)

    def test_nov_8_sunday_34(self):
        windows = [
            _Rt("dedication_of_the_lateran_basilica", "dedication_of_the_lateran_basilica", "The Dedication of the Lateran Basilica"),
            _Rt("pope_st_leo_the_great", "pope_st_leo_the_great", "Pope St Leo the Great"),
            _Rt("st_andrew_avellino", "st_andrew_avellino", "St Andrew Avellino"),
            _Rt("st_martin_of_tours", "st_martin_of_tours", "St. Martin of Tours"),
            _Rt("josaphat_kuntsevych_bishop", "josaphat_kuntsevych_bishop", "Saint Josaphat, Bishop and Martyr"),
            _Rt("st_frances_xavier_cabrini", "st_frances_xavier_cabrini", "St Frances Xavier Cabrini"),
            _Rt("st_homobonus", "st_homobonus", "St Homobonus"),
            _Rt("st_albert_the_great", "st_albert_the_great", "St Albert the Great"),
            _Rt("st_gertrude_prayer", "st_gertrude_prayer", "St. Gertrude Prayer"),
            _Rt("st_giuseppe_moscati", "st_giuseppe_moscati", "St Giuseppe Moscati"),
            _Rt("st_margaret_of_scotland", "st_margaret_of_scotland", "St Margaret of Scotland"),
            _Rt("st_elizabeth_of_hungary", "st_elizabeth_of_hungary", "St. Elizabeth of Hungary"),
        ]
        got = _resolve(dt.date(2026, 11, 8), windows, [])
        tier2 = [
            "Saint Leo the Great",
            "Saint Andrew Avellino",
            "Saint Martin of Tours",
            "Saint Josaphat",
            "Saint Frances Cabrini",
            "Saint Homobonus",
            "Saint Albert the Great",
            "Saint Gertrude",
            "Saint Giuseppe Moscati",
            "Saint Margaret of Scotland",
            "Saint Elizabeth of Hungary",
        ]
        patrons = [p for p in PATRONS if p not in ("Saint Albert the Great", "Saint Elizabeth of Hungary")]
        self.assertEqual(got, CORE + tier2 + patrons)
        self.assertEqual(len(got), 34)

    def test_dec_21_core_saint_in_window_31(self):
        windows = [
            _Rt("impossible_requests_annunciation", "impossible_requests_annunciation", "Impossible Requests Annunciation"),
            _Rt("st_anastasia", "st_anastasia", "St. Anastasia"),
            _Rt("st_andrew_christmas", "st_andrew_christmas", "St. Andrew Christmas"),
            _Rt("nativity_of_the_lord", "nativity_of_the_lord", "The Nativity of the Lord (Christmas)"),
            _Rt("holy_innocents", "holy_innocents", "Holy Innocents"),
            _Rt("st_stephen", "st_stephen", "St. Stephen"),
            _Rt("holy_family_of_jesus_mary_and_joseph", "holy_family", "Holy Family"),
            _Rt("st_thomas_becket", "st_thomas_becket", "St Thomas Becket"),
            _Rt("st_john_the_apostle", "st_john_the_apostle", "St. John the Apostle"),
        ]
        got = _resolve(dt.date(2026, 12, 21), windows, ["Saint Peter Canisius"])
        tier2 = [
            "Saint Peter Canisius",
            "Saint Anastasia",
            "Saint Andrew",
            "Holy Innocents",
            "Saint Stephen",
            "Saint Thomas Becket",
        ]
        self.assertEqual(got, CORE + tier2 + PATRONS)
        self.assertEqual(len(got), 31)
        # John the Apostle: window open, stays in the core, once (criterion 3).
        self.assertEqual(got.count("Saint John the Apostle"), 1)
        self.assertEqual(got.index("Saint John the Apostle"), 7)

    def test_empty_tier2_is_core_plus_patrons_25(self):
        got = _resolve(dt.date(2026, 12, 30), [], [])
        self.assertEqual(got, CORE + PATRONS)
        self.assertEqual(len(got), 25)


class TestRules(unittest.TestCase):
    def test_patron_promotion_outside_pinned_days(self):
        windows = [_Rt("st_sebastian", "st_sebastian", "St. Sebastian")]
        got = _resolve(dt.date(2026, 6, 15), windows, [])
        self.assertEqual(got.count("Saint Sebastian"), 1)
        self.assertEqual(got.index("Saint Sebastian"), len(CORE))
        self.assertEqual(len(got), 25)

    def test_exclusions_marian_and_lords_feast(self):
        windows = [
            _Rt("our_lady_of_the_rosary", "our_lady_of_the_rosary", "Our Lady of the Rosary"),
            _Rt("christ_the_king", "christ_the_king", "Christ the King"),
        ]
        got = _resolve(dt.date(2026, 6, 15), windows, [])
        self.assertEqual(got, CORE + PATRONS)

    def test_unmapped_identity_skipped_with_warning(self):
        windows = [_Rt("st_nobody_real", "st_nobody_real", "St. Nobody Real")]
        got = _resolve(dt.date(2026, 6, 15), windows, [])
        self.assertEqual(got, CORE + PATRONS)
        warnings = saints_ladder.last_warnings()
        self.assertTrue(any("st_nobody_real" in w for w in warnings), warnings)

    def test_data_edit_changes_output(self):
        data = saints_ladder.load_ladder_data()
        edited = copy.deepcopy(data)
        edited["patrons"].append(
            {"key": "test-added-patron", "spoken": "Saint Test Added", "match_ids": [], "match_names": []}
        )
        got = saints_ladder.resolve_invocations(
            dt.date(2026, 12, 30), windows=[], feast_saints=[], data=edited
        )
        self.assertEqual(got[-1], "Saint Test Added")
        self.assertEqual(len(got), 26)

    def test_broken_data_raises(self):
        with self.assertRaises(Exception):
            saints_ladder.load_ladder_data(ROOT / "config" / "publish" / "does-not-exist.json")
        bad = copy.deepcopy(saints_ladder.load_ladder_data())
        bad["core"] = []
        with self.assertRaises(Exception):
            saints_ladder.resolve_invocations(
                dt.date(2026, 12, 30), windows=[], feast_saints=[], data=bad
            )

    def test_contracts_branch_falls_back_to_template(self):
        from jobs.publish import contracts as contracts_mod

        original = saints_ladder.DATA_PATH
        saints_ladder.DATA_PATH = ROOT / "config" / "publish" / "missing-ladder.json"
        try:
            block = {
                "kind": "saints-litany",
                "fallback_file": "config/publish/templates/morning-prayer/intercessory-litany.txt",
            }
            text = contracts_mod._resolve_saints_litany_content(
                block, entry={"entry_id": "test"}, target_date=dt.date(2026, 10, 9)
            )
        finally:
            saints_ladder.DATA_PATH = original
        template_text = TEMPLATE.read_text(encoding="utf-8").strip()
        self.assertEqual(text, template_text)

    def test_frame_byte_pin_against_template(self):
        text = saints_ladder.render_litany(dt.date(2026, 12, 30), windows=[], feast_saints=[])
        template_lines = TEMPLATE.read_text(encoding="utf-8").strip().split("\n")
        got_lines = text.split("\n")
        self.assertEqual(got_lines[:7], template_lines[:7])
        self.assertEqual(got_lines[-2:], template_lines[-2:])
        # Every invocation renders as the template's two-line form.
        self.assertEqual(len(got_lines), 7 + 25 * 2 + 2)
        for i in range(7, 7 + 25 * 2, 2):
            self.assertTrue(got_lines[i].endswith(","), got_lines[i])
            self.assertEqual(got_lines[i + 1], "pray for us.")


class TestIntegrationPinnedDays(unittest.TestCase):
    """Slow: the real production sources, end to end (venv only)."""

    def test_integration_oct_9(self):
        # Production truth, measured at Implement (2026-11-08): the
        # devotional calendar names ONE feast saint for Oct 9 —
        # "Saint Denis and his companions" — not the two the Plan's
        # verification set hand-read (John Leonardi is not named that
        # day). The ladder takes the calendar as it stands, so the
        # production total is 33, not 34. The stubbed case above keeps
        # the Plan's two-saint fixture as a mechanism test.
        got = saints_ladder.resolve_invocations(dt.date(2026, 10, 9))
        self.assertEqual(len(got), 33)
        self.assertEqual(got[:9], CORE)
        self.assertEqual(got.count("Saint Carlo Acutis"), 1)
        self.assertEqual(got.count("Saint Teresa of Ávila"), 1)
        tier2 = got[9:18]
        self.assertEqual(
            tier2,
            [
                "Saint Denis and Companions",
                "Saint John XXIII",
                "Saint Carlo Acutis",
                "Saint Callistus I",
                "Saint Hedwig of Silesia",
                "Saint Gerard Majella",
                "Saint Margaret Mary",
                "Saint Ignatius of Antioch",
                "Saint Luke",
            ],
        )

    def test_integration_nov_8(self):
        got = saints_ladder.resolve_invocations(dt.date(2026, 11, 8))
        self.assertEqual(len(got), 34)
        self.assertEqual(got[:9], CORE)
        tier2 = got[9:20]
        self.assertEqual(
            tier2,
            [
                "Saint Leo the Great",
                "Saint Andrew Avellino",
                "Saint Martin of Tours",
                "Saint Josaphat",
                "Saint Frances Cabrini",
                "Saint Homobonus",
                "Saint Albert the Great",
                "Saint Gertrude",
                "Saint Giuseppe Moscati",
                "Saint Margaret of Scotland",
                "Saint Elizabeth of Hungary",
            ],
        )


if __name__ == "__main__":
    unittest.main()
