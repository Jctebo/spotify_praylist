import datetime
import unittest
from pathlib import Path

import jobs.novena_contracts.contracts as contracts_mod
import jobs.novena_contracts.resolver as resolver_mod
from jobs.novena_contracts import saint_aliases


def _contract(contract_id, saint_name, month, day, content_mode):
    return contracts_mod.NovenaContract(
        family_id=contract_id,
        contract_id=contract_id,
        contract_type="novena_feast_rule",
        enabled=True,
        saint={"id": contract_id, "name": saint_name},
        selector=None,
        feast=contracts_mod.FeastRule(
            entry_id=contract_id,
            mode="fixed",
            month=month,
            day=day,
            name=saint_name,
        ),
        novena=contracts_mod.NovenaRule(
            duration_days=9,
            start_offset_days=-9,
            content_mode=content_mode,
            template_id="standard-9-day",
        ),
        publishing=contracts_mod.PublishingRule(audio={"enabled": True}, rss={"enabled": True}),
        source_path=Path(f"{contract_id}.json"),
    )


class TestSaintAliasNormalization(unittest.TestCase):
    def test_accents_and_honorifics_normalize_together(self):
        self.assertEqual(
            saint_aliases.normalize_saint_name("St. Thérèse of Lisieux"),
            saint_aliases.normalize_saint_name("Saint Therese of Lisieux"),
        )
        self.assertEqual(
            saint_aliases.normalize_saint_name("St Padre Pio"),
            saint_aliases.normalize_saint_name("Padre Pio"),
        )

    def test_mt_and_mount_unify(self):
        self.assertEqual(
            saint_aliases.normalize_saint_name("Our Lady of Mt. Carmel"),
            saint_aliases.normalize_saint_name("Our Lady of Mount Carmel"),
        )


class TestSaintAliasResolution(unittest.TestCase):
    def test_padre_pio_forms_resolve_to_one_contract(self):
        for form in (
            "Padre Pio",
            "Padre Pio of Pietrelcina",
            "St. Pio of Pietrelcina",
            "St. Padre Pio",
            "Saint Pius of Pietrelcina, Priest",
        ):
            self.assertEqual(
                saint_aliases.canonical_contract_id(saint_name=form),
                "st_padre_pio",
                form,
            )
        for identifier in ("pius_francesco_forgione_priest", "padre_pio_of_pietrelcina", "st_padre_pio"):
            self.assertEqual(
                saint_aliases.canonical_contract_id(contract_id=identifier),
                "st_padre_pio",
                identifier,
            )

    def test_therese_forms_resolve_to_one_contract(self):
        for form in (
            "St. Therese of Lisieux",
            "St. Thérèse of Lisieux",
            "St. Therese of the Child Jesus",
            "St. Thérèse of the Child Jesus",
            "Therese of Lisieux",
            "Saint Thérèse of the Child Jesus, Virgin and Doctor of the Church",
        ):
            self.assertEqual(
                saint_aliases.canonical_contract_id(saint_name=form),
                "st_therese_of_lisieux_rose",
                form,
            )
        self.assertEqual(
            saint_aliases.canonical_contract_id(contract_id="therese_of_the_child_jesus_and_the_holy_face_of_lisieux_virgin"),
            "st_therese_of_lisieux_rose",
        )

    def test_unlisted_saint_is_untouched(self):
        self.assertIsNone(saint_aliases.canonical_contract_id(saint_name="St. Anthony of Padua"))
        self.assertIsNone(saint_aliases.canonical_contract_id(contract_id="anthony_of_padua"))


class TestAliasGenerationDedupe(unittest.TestCase):
    def test_padre_pio_pair_yields_one_novena(self):
        contracts = [
            _contract("st_padre_pio", "St Padre Pio", 9, 23, "fixed"),
            _contract("pius_francesco_forgione_priest", "Saint Pius of Pietrelcina, Priest", 9, 23, "hybrid"),
        ]
        active = resolver_mod.resolve_active_novenas(datetime.date(2026, 9, 20), contracts=contracts)
        self.assertEqual([runtime.contract_id for runtime in active], ["st_padre_pio"])

    def test_therese_pair_yields_one_novena(self):
        contracts = [
            _contract("st_therese_of_lisieux_rose", "St. Therese of Lisieux Rose", 10, 1, "fixed"),
            _contract(
                "therese_of_the_child_jesus_and_the_holy_face_of_lisieux_virgin",
                "Saint Thérèse of the Child Jesus, Virgin and Doctor of the Church",
                10,
                1,
                "hybrid",
            ),
        ]
        active = resolver_mod.resolve_active_novenas(datetime.date(2026, 9, 28), contracts=contracts)
        self.assertEqual([runtime.contract_id for runtime in active], ["st_therese_of_lisieux_rose"])

    def test_bernardine_pair_yields_one_novena(self):
        # Additional saint found by the catalog audit: the traditional
        # contract even misspells the name ("Bernadine") while the
        # short-form contract carries the calendar form ("Bernardine").
        contracts = [
            _contract("st_bernadine_of_siena", "St Bernadine of Siena", 5, 20, "fixed"),
            _contract("bernardine_of_siena_priest", "Saint Bernardine of Siena, Priest", 5, 20, "hybrid"),
        ]
        active = resolver_mod.resolve_active_novenas(datetime.date(2026, 5, 15), contracts=contracts)
        self.assertEqual([runtime.contract_id for runtime in active], ["st_bernadine_of_siena"])

    def test_distinct_saints_are_not_merged(self):
        contracts = [
            _contract("st_padre_pio", "St Padre Pio", 9, 23, "fixed"),
            _contract("pius_francesco_forgione_priest", "Saint Pius of Pietrelcina, Priest", 9, 23, "hybrid"),
            _contract("st_therese_of_lisieux_rose", "St. Therese of Lisieux Rose", 9, 23, "fixed"),
        ]
        active = resolver_mod.resolve_active_novenas(datetime.date(2026, 9, 20), contracts=contracts)
        self.assertEqual(
            sorted(runtime.contract_id for runtime in active),
            ["st_padre_pio", "st_therese_of_lisieux_rose"],
        )


class TestAliasAgainstRealCatalog(unittest.TestCase):
    def test_real_catalog_padre_pio_day_resolves_to_single_traditional(self):
        contracts = contracts_mod.load_novena_contracts()
        active = resolver_mod.resolve_active_novenas(datetime.date(2026, 9, 20), contracts=contracts)
        pio = [
            runtime
            for runtime in active
            if saint_aliases.canonical_contract_id(
                contract_id=runtime.contract_id,
                saint_id=runtime.saint.get("id"),
                saint_name=runtime.saint.get("name"),
            )
            == "st_padre_pio"
        ]
        self.assertEqual([runtime.contract_id for runtime in pio], ["st_padre_pio"])

    def test_real_catalog_therese_day_resolves_to_single_traditional(self):
        contracts = contracts_mod.load_novena_contracts()
        active = resolver_mod.resolve_active_novenas(datetime.date(2026, 9, 28), contracts=contracts)
        therese = [
            runtime
            for runtime in active
            if saint_aliases.canonical_contract_id(
                contract_id=runtime.contract_id,
                saint_id=runtime.saint.get("id"),
                saint_name=runtime.saint.get("name"),
            )
            == "st_therese_of_lisieux_rose"
        ]
        self.assertEqual([runtime.contract_id for runtime in therese], ["st_therese_of_lisieux_rose"])


if __name__ == "__main__":
    unittest.main()
