import datetime
import unittest
from unittest.mock import patch
from pathlib import Path

import jobs.novena_contracts.contracts as contracts_mod
import jobs.novena_contracts.resolver as resolver_mod


class TestNovenaResolver(unittest.TestCase):
    def test_resolve_active_novenas_uses_materialized_short_forms_without_selector(self):
        contracts = contracts_mod.load_novena_contracts()

        day_one = resolver_mod.resolve_active_novenas(datetime.date(2026, 4, 28), contracts=contracts)
        contract_ids = [runtime.contract_id for runtime in day_one]
        by_id = {runtime.contract_id: runtime for runtime in day_one}

        self.assertNotIn("standard_9_day", contract_ids)
        self.assertEqual(by_id["pius_v_pope"].family_id, "pius_v_pope")
        self.assertEqual(by_id["pius_v_pope"].active_day, 8)
        self.assertEqual(by_id["pius_v_pope"].feast["feast_date"], "2026-04-30")
        self.assertEqual(by_id["pius_v_pope"].feast["start_date"], "2026-04-21")
        self.assertEqual(by_id["pius_v_pope"].feast["end_date"], "2026-04-29")

        self.assertEqual(by_id["athanasius_of_alexandria_bishop"].family_id, "athanasius_of_alexandria_bishop")
        self.assertEqual(by_id["athanasius_of_alexandria_bishop"].active_day, 6)
        self.assertEqual(by_id["athanasius_of_alexandria_bishop"].feast["feast_date"], "2026-05-02")
        self.assertEqual(by_id["athanasius_of_alexandria_bishop"].feast["start_date"], "2026-04-23")
        self.assertEqual(by_id["athanasius_of_alexandria_bishop"].feast["end_date"], "2026-05-01")

    def test_resolve_active_novenas_prefers_explicit_override_over_selector_family(self):
        contracts = contracts_mod.load_novena_contracts()
        active = resolver_mod.resolve_active_novenas(datetime.date(2026, 6, 3), contracts=contracts)

        ids = [runtime.contract_id for runtime in active]
        explicit = [runtime for runtime in active if runtime.contract_id == "sacred_heart"]
        self.assertEqual(len(explicit), 1)
        self.assertEqual(explicit[0].family_id, "sacred_heart")
        self.assertEqual(explicit[0].active_day, 1)
        self.assertNotIn("standard_9_day", ids)

    def test_resolve_active_novenas_derives_immaculate_heart_feast_date(self):
        contracts = contracts_mod.load_novena_contracts()
        active = resolver_mod.resolve_active_novenas(datetime.date(2026, 6, 4), contracts=contracts)
        immaculate = [runtime for runtime in active if runtime.contract_id == "immaculate_heart_of_mary"]

        self.assertEqual(len(immaculate), 1)
        self.assertEqual(immaculate[0].feast["feast_date"], "2026-06-13")
        self.assertEqual(immaculate[0].feast["start_date"], "2026-06-04")
        self.assertEqual(immaculate[0].active_day, 1)

    def test_resolve_active_novenas_uses_traditional_fatima_without_short_form_duplicate(self):
        contracts = contracts_mod.load_novena_contracts()
        active = resolver_mod.resolve_active_novenas(datetime.date(2026, 5, 4), contracts=contracts)

        ids = [runtime.contract_id for runtime in active if runtime.contract_id == "our_lady_of_fatima"]
        by_id = {runtime.contract_id: runtime for runtime in active}

        self.assertEqual(ids, ["our_lady_of_fatima"])
        self.assertEqual(by_id["our_lady_of_fatima"].family_id, "our_lady_of_fatima")
        self.assertEqual(by_id["our_lady_of_fatima"].active_day, 1)
        self.assertEqual(by_id["our_lady_of_fatima"].feast["feast_date"], "2026-05-13")

    def test_resolve_active_novenas_uses_our_lady_of_the_snows_without_mary_major_duplicate(self):
        contracts = contracts_mod.load_novena_contracts()
        active = resolver_mod.resolve_active_novenas(datetime.date(2026, 8, 4), contracts=contracts)

        ids = [runtime.contract_id for runtime in active]
        snows = [runtime for runtime in active if runtime.contract_id == "our_lady_of_the_snows"]

        self.assertEqual(len(snows), 1)
        self.assertEqual(snows[0].active_day, 9)
        self.assertEqual(snows[0].feast["feast_date"], "2026-08-05")
        self.assertNotIn("dedication_of_the_basilica_of_saint_mary_major", ids)

    def test_resolve_active_novenas_ignores_disabled_explicit_feast_overrides(self):
        disabled_feast = contracts_mod.NovenaContract(
            family_id="disabled_catherine_override",
            contract_id="catherine_of_siena_virgin",
            contract_type="novena_feast_rule",
            enabled=False,
            saint={"id": "catherine_of_siena_virgin", "name": "Saint Catherine of Siena"},
            selector=None,
            feast=contracts_mod.FeastRule(
                entry_id="catherine_of_siena_virgin",
                mode="fixed",
                month=4,
                day=29,
                name="Saint Catherine of Siena",
            ),
            novena=contracts_mod.NovenaRule(
                duration_days=9,
                start_offset_days=-9,
                content_mode="hybrid",
                template_id="standard-9-day",
            ),
            publishing=contracts_mod.PublishingRule(audio={"enabled": True}, rss={"enabled": True}),
            source_path=Path("disabled.json"),
        )
        selector_family = contracts_mod.NovenaContract(
            family_id="standard_9_day",
            contract_id="standard_9_day",
            contract_type="novena_feast_rule",
            enabled=True,
            saint={},
            selector=contracts_mod.SelectorRule(mode="auto", ranks=("solemnity", "feast", "memorial", "optional_memorial")),
            feast=None,
            novena=contracts_mod.NovenaRule(
                duration_days=9,
                start_offset_days=-9,
                content_mode="hybrid",
                template_id="standard-9-day",
            ),
            publishing=contracts_mod.PublishingRule(audio={"enabled": True}, rss={"enabled": True}),
            source_path=Path("selector.json"),
        )

        active = resolver_mod.resolve_active_novenas(datetime.date(2026, 4, 28), contracts=[disabled_feast, selector_family])
        ids = [runtime.contract_id for runtime in active]

        self.assertIn("catherine_of_siena_virgin", ids)
        self.assertNotIn("disabled_catherine_override", [runtime.family_id for runtime in active])
