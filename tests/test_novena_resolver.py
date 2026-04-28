import datetime
import unittest
from unittest.mock import patch

import jobs.novena_contracts.contracts as contracts_mod
import jobs.novena_contracts.resolver as resolver_mod


class TestNovenaResolver(unittest.TestCase):
    def test_resolve_active_novenas_autopopulates_selector_window(self):
        contracts = contracts_mod.load_novena_contracts()

        day_one = resolver_mod.resolve_active_novenas(datetime.date(2026, 4, 28), contracts=contracts)
        contract_ids = [runtime.contract_id for runtime in day_one]
        by_id = {runtime.contract_id: runtime for runtime in day_one}

        self.assertEqual(
            contract_ids,
            [
                "catherine_of_siena_virgin",
                "pius_v_pope",
                "joseph_the_worker",
                "athanasius_of_alexandria_bishop",
            ],
        )
        self.assertEqual(by_id["catherine_of_siena_virgin"].family_id, "standard_9_day")
        self.assertEqual(by_id["catherine_of_siena_virgin"].active_day, 9)
        self.assertEqual(by_id["catherine_of_siena_virgin"].feast["feast_date"], "2026-04-29")
        self.assertEqual(by_id["catherine_of_siena_virgin"].feast["start_date"], "2026-04-20")
        self.assertEqual(by_id["catherine_of_siena_virgin"].feast["end_date"], "2026-04-28")

        self.assertEqual(by_id["pius_v_pope"].family_id, "standard_9_day")
        self.assertEqual(by_id["pius_v_pope"].active_day, 8)
        self.assertEqual(by_id["pius_v_pope"].feast["feast_date"], "2026-04-30")
        self.assertEqual(by_id["pius_v_pope"].feast["start_date"], "2026-04-21")
        self.assertEqual(by_id["pius_v_pope"].feast["end_date"], "2026-04-29")

        self.assertEqual(by_id["joseph_the_worker"].family_id, "standard_9_day")
        self.assertEqual(by_id["joseph_the_worker"].active_day, 7)
        self.assertEqual(by_id["joseph_the_worker"].feast["feast_date"], "2026-05-01")
        self.assertEqual(by_id["joseph_the_worker"].feast["start_date"], "2026-04-22")
        self.assertEqual(by_id["joseph_the_worker"].feast["end_date"], "2026-04-30")

        self.assertEqual(by_id["athanasius_of_alexandria_bishop"].family_id, "standard_9_day")
        self.assertEqual(by_id["athanasius_of_alexandria_bishop"].active_day, 6)
        self.assertEqual(by_id["athanasius_of_alexandria_bishop"].feast["feast_date"], "2026-05-02")
        self.assertEqual(by_id["athanasius_of_alexandria_bishop"].feast["start_date"], "2026-04-23")
        self.assertEqual(by_id["athanasius_of_alexandria_bishop"].feast["end_date"], "2026-05-01")

    def test_resolve_active_novenas_prefers_explicit_override_over_selector_family(self):
        contracts = contracts_mod.load_novena_contracts()
        active = resolver_mod.resolve_active_novenas(datetime.date(2026, 6, 3), contracts=contracts)

        ids = [runtime.contract_id for runtime in active]
        self.assertEqual(
            ids,
            [
                "boniface_of_mainz_bishop",
                "norbert_of_xanten_bishop",
                "most_holy_body_and_blood_of_christ",
                "ephrem_the_syrian_deacon",
                "barnabas_apostle",
                "most_sacred_heart_of_jesus",
            ],
        )
        explicit = [runtime for runtime in active if runtime.contract_id == "most_sacred_heart_of_jesus"]
        self.assertEqual(len(explicit), 1)
        self.assertEqual(explicit[0].family_id, "most_sacred_heart_of_jesus")
        self.assertEqual(explicit[0].active_day, 1)

    def test_resolve_active_novenas_scans_past_weekday_rows_for_optional_memorials(self):
        contracts = contracts_mod.load_novena_contracts()

        def fake_romcal_fetch_day(calendar: str, locale: str, dt: datetime.date):
            if dt == datetime.date(2026, 5, 1):
                return [
                    {
                        "id": "friday_of_the_fourth_week_of_easter",
                        "name": "Friday of the fourth week of Easter",
                        "rank": "weekday",
                        "precedence": "Precedence.weekday_13",
                    },
                    {
                        "id": "joseph_the_worker",
                        "name": "Saint Joseph the Worker",
                        "rank": "optional_memorial",
                        "precedence": "Precedence.optional_memorial_12",
                    },
                ]
            return []

        with patch.object(resolver_mod, "romcal_fetch_day", side_effect=fake_romcal_fetch_day):
            active = resolver_mod.resolve_active_novenas(datetime.date(2026, 4, 28), contracts=contracts)

        ids = [runtime.contract_id for runtime in active]
        joseph = [runtime for runtime in active if runtime.contract_id == "joseph_the_worker"]

        self.assertIn("joseph_the_worker", ids)
        self.assertNotIn("friday_of_the_fourth_week_of_easter", ids)
        self.assertEqual(len(joseph), 1)
        self.assertEqual(joseph[0].feast["feast_date"], "2026-05-01")
        self.assertEqual(joseph[0].feast["rank"], "optional_memorial")
