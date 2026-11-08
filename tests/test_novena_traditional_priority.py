"""General traditional-novena priority.

John's rule (2026-11-04): "We want traditional novenas priority." Whenever
a saint has both a traditional (fixed-content) novena and a generated
short-form novena active for the same window, the traditional one runs
and the short-form does not — whether or not the saint is in the alias
table. Two traditional novenas are never merged, and a short-form novena
with no traditional counterpart still generates.
"""
import datetime
import unittest
from pathlib import Path

import jobs.novena_contracts.contracts as contracts_mod
import jobs.novena_contracts.resolver as resolver_mod


def _contract(contract_id, saint_id, saint_name, month, day, content_mode, start_offset_days=-9, duration_days=9):
    return contracts_mod.NovenaContract(
        family_id=contract_id,
        contract_id=contract_id,
        contract_type="novena_feast_rule",
        enabled=True,
        saint={"id": saint_id, "name": saint_name},
        selector=None,
        feast=contracts_mod.FeastRule(
            entry_id=contract_id,
            mode="fixed",
            month=month,
            day=day,
            name=saint_name,
        ),
        novena=contracts_mod.NovenaRule(
            duration_days=duration_days,
            start_offset_days=start_offset_days,
            content_mode=content_mode,
            template_id="standard-9-day",
        ),
        publishing=contracts_mod.PublishingRule(audio={"enabled": True}, rss={"enabled": True}),
        source_path=Path(f"{contract_id}.json"),
    )


def _ids(active):
    return sorted(runtime.contract_id for runtime in active)


class TestTraditionalPriorityGeneral(unittest.TestCase):
    def test_guardian_angel_pair_yields_traditional(self):
        # Non-alias collision proven on the real catalog: the traditional
        # "Guardian Angel" contract and the auto-materialized short-form
        # "The Holy Guardian Angels" contract cover the same Oct 2 feast
        # under different name forms, and neither is in the alias table.
        contracts = [
            _contract("guardian_angel", "guardian_angel", "Guardian Angel", 10, 2, "fixed"),
            _contract("holy_guardian_angels", "holy_guardian_angels", "The Holy Guardian Angels", 10, 2, "hybrid"),
        ]
        active = resolver_mod.resolve_active_novenas(datetime.date(2026, 9, 28), contracts=contracts)
        self.assertEqual(_ids(active), ["guardian_angel"])

    def test_alias_pair_still_yields_traditional(self):
        # Regression: alias-table saints keep their existing behavior.
        contracts = [
            _contract("st_padre_pio", "st_padre_pio", "St Padre Pio", 9, 23, "fixed"),
            _contract(
                "pius_francesco_forgione_priest",
                "pius_francesco_forgione_priest",
                "Saint Pius of Pietrelcina, Priest",
                9,
                23,
                "hybrid",
            ),
        ]
        active = resolver_mod.resolve_active_novenas(datetime.date(2026, 9, 20), contracts=contracts)
        self.assertEqual(_ids(active), ["st_padre_pio"])

    def test_off_by_one_feast_pair_yields_traditional(self):
        # Proven on the real catalog (Cyril of Jerusalem, Paul of the
        # Cross): the traditional contract anchors the feast one day
        # later than the romcal date its short-form twin uses, so the
        # windows overlap on 8 of 9 days with different feast dates.
        contracts = [
            _contract("st_cyril_of_jerusalem", "st_cyril_of_jerusalem", "St Cyril of Jerusalem", 3, 19, "fixed"),
            _contract(
                "cyril_of_jerusalem_bishop",
                "cyril_of_jerusalem_bishop",
                "Saint Cyril of Jerusalem, Bishop and Doctor of the Church",
                3,
                18,
                "hybrid",
            ),
        ]
        overlap = resolver_mod.resolve_active_novenas(datetime.date(2026, 3, 15), contracts=contracts)
        self.assertEqual(_ids(overlap), ["st_cyril_of_jerusalem"])
        # A day only the short-form window covers: the short-form runs.
        short_only = resolver_mod.resolve_active_novenas(datetime.date(2026, 3, 9), contracts=contracts)
        self.assertEqual(_ids(short_only), ["cyril_of_jerusalem_bishop"])

    def test_short_form_only_saint_still_generates(self):
        # Negative control: no traditional counterpart -> short-form runs.
        contracts = [
            _contract("bruno_of_cologne_priest", "bruno_of_cologne_priest", "Saint Bruno, Priest", 10, 6, "hybrid"),
        ]
        active = resolver_mod.resolve_active_novenas(datetime.date(2026, 10, 3), contracts=contracts)
        self.assertEqual(_ids(active), ["bruno_of_cologne_priest"])

    def test_two_traditionals_for_one_saint_are_never_merged(self):
        contracts = [
            _contract("st_corona", "st_corona", "St. Corona", 5, 14, "fixed"),
            _contract(
                "st_corona_novena_against_pandemics",
                "st_corona_novena_against_pandemics",
                "St Corona Novena Against Pandemics",
                5,
                14,
                "fixed",
            ),
        ]
        active = resolver_mod.resolve_active_novenas(datetime.date(2026, 5, 10), contracts=contracts)
        self.assertEqual(_ids(active), ["st_corona", "st_corona_novena_against_pandemics"])

    def test_distinct_saints_sharing_a_feast_are_not_merged(self):
        contracts = [
            _contract("st_john_henry_newman", "st_john_henry_newman", "St John Henry Newman", 10, 9, "fixed"),
            _contract("john_leonardi_priest", "john_leonardi_priest", "Saint John Leonardi, Priest", 10, 9, "hybrid"),
        ]
        active = resolver_mod.resolve_active_novenas(datetime.date(2026, 10, 5), contracts=contracts)
        self.assertEqual(_ids(active), ["john_leonardi_priest", "st_john_henry_newman"])

    def test_group_feast_is_not_merged_into_single_saint(self):
        # Martha alone (traditional) vs Martha, Mary and Lazarus
        # (short-form group feast): different identities, both run.
        contracts = [
            _contract("st_martha_of_bethany", "st_martha_of_bethany", "St Martha of Bethany", 7, 29, "fixed"),
            _contract(
                "martha_of_bethany_mary_of_bethany_and_lazarus_of_bethany",
                "martha_of_bethany_mary_of_bethany_and_lazarus_of_bethany",
                "Saints Martha, Mary and Lazarus",
                7,
                29,
                "hybrid",
            ),
        ]
        active = resolver_mod.resolve_active_novenas(datetime.date(2026, 7, 25), contracts=contracts)
        self.assertEqual(
            _ids(active),
            ["martha_of_bethany_mary_of_bethany_and_lazarus_of_bethany", "st_martha_of_bethany"],
        )

    def test_overlapping_windows_from_different_offsets(self):
        # Same saint identity, different start offsets: on overlap days the
        # traditional runs alone; on days only the short-form window covers,
        # the short-form still runs (the rule is per-day).
        contracts = [
            _contract(
                "guardian_angel_traditional",
                "guardian_angel",
                "Guardian Angel",
                10,
                2,
                "fixed",
                start_offset_days=-3,
            ),
            _contract(
                "guardian_angel_short",
                "guardian_angel",
                "Guardian Angel",
                10,
                2,
                "hybrid",
                start_offset_days=-9,
            ),
        ]
        overlap = resolver_mod.resolve_active_novenas(datetime.date(2026, 9, 30), contracts=contracts)
        self.assertEqual(_ids(overlap), ["guardian_angel_traditional"])
        short_only = resolver_mod.resolve_active_novenas(datetime.date(2026, 9, 25), contracts=contracts)
        self.assertEqual(_ids(short_only), ["guardian_angel_short"])


class TestTraditionalPriorityRealCatalog(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contracts = contracts_mod.load_novena_contracts()

    def _resolve(self, day):
        return resolver_mod.resolve_active_novenas(day, contracts=self.contracts)

    def test_real_catalog_guardian_angels(self):
        active = self._resolve(datetime.date(2026, 9, 28))
        ids = _ids(active)
        self.assertIn("guardian_angel", ids)
        self.assertNotIn("holy_guardian_angels", ids)

    def test_real_catalog_charbel(self):
        active = self._resolve(datetime.date(2026, 7, 20))
        ids = _ids(active)
        self.assertIn("st_charbel", ids)
        self.assertNotIn("sharbel_makhluf_priest", ids)

    def test_real_catalog_all_souls(self):
        active = self._resolve(datetime.date(2026, 10, 28))
        ids = _ids(active)
        self.assertIn("holy_souls_in_purgatory", ids)
        self.assertNotIn("commemoration_of_all_the_faithful_departed", ids)

    def test_real_catalog_cyril_of_jerusalem(self):
        active = self._resolve(datetime.date(2026, 3, 15))
        ids = _ids(active)
        self.assertIn("st_cyril_of_jerusalem", ids)
        self.assertNotIn("cyril_of_jerusalem_bishop", ids)

    def test_real_catalog_paul_of_the_cross(self):
        active = self._resolve(datetime.date(2026, 10, 15))
        ids = _ids(active)
        self.assertIn("st_paul_of_the_cross", ids)
        self.assertNotIn("paul_of_the_cross_priest", ids)

    def test_real_catalog_short_form_only_saint_still_runs(self):
        active = self._resolve(datetime.date(2026, 11, 4))
        self.assertIn("josaphat_kuntsevych_bishop", _ids(active))


if __name__ == "__main__":
    unittest.main()
