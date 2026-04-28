import datetime
import unittest

import jobs.novena_contracts.contracts as contracts_mod
import jobs.novena_contracts.resolver as resolver_mod


class TestNovenaResolver(unittest.TestCase):
    def test_resolve_active_novenas_autopopulates_selector_window(self):
        contracts = contracts_mod.load_novena_contracts()

        day_one = resolver_mod.resolve_active_novenas(datetime.date(2026, 4, 28), contracts=contracts)
        contract_ids = [runtime.contract_id for runtime in day_one]

        self.assertEqual(contract_ids, ["catherine_of_siena_virgin", "athanasius_of_alexandria_bishop"])
        self.assertEqual(day_one[0].family_id, "standard_9_day")
        self.assertEqual(day_one[0].active_day, 9)
        self.assertEqual(day_one[0].feast["feast_date"], "2026-04-29")
        self.assertEqual(day_one[0].feast["start_date"], "2026-04-20")
        self.assertEqual(day_one[0].feast["end_date"], "2026-04-28")
        self.assertEqual(day_one[1].family_id, "standard_9_day")
        self.assertEqual(day_one[1].active_day, 6)
        self.assertEqual(day_one[1].feast["feast_date"], "2026-05-02")
        self.assertEqual(day_one[1].feast["start_date"], "2026-04-23")
        self.assertEqual(day_one[1].feast["end_date"], "2026-05-01")

    def test_resolve_active_novenas_prefers_explicit_override_over_selector_family(self):
        contracts = contracts_mod.load_novena_contracts()
        active = resolver_mod.resolve_active_novenas(datetime.date(2026, 6, 3), contracts=contracts)

        ids = [runtime.contract_id for runtime in active]
        self.assertEqual(
            ids,
            [
                "boniface_of_mainz_bishop",
                "most_holy_body_and_blood_of_christ",
                "barnabas_apostle",
                "most_sacred_heart_of_jesus",
            ],
        )
        explicit = [runtime for runtime in active if runtime.contract_id == "most_sacred_heart_of_jesus"]
        self.assertEqual(len(explicit), 1)
        self.assertEqual(explicit[0].family_id, "most_sacred_heart_of_jesus")
        self.assertEqual(explicit[0].active_day, 1)
