from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Sequence, Tuple

from jobs.novena_contracts.url_import import DEFAULT_REPORT_DIR, NovenaImportReport, import_bulk_catalog, write_bulk_report

DEFAULT_TRADITIONAL_NOVENA_CATALOG_URL = "https://catholicnovenaapp.com/list-of-all-novenas/"
DEFAULT_TRADITIONAL_NOVENA_IMPORT_MONTHS = ("july", "august")
DEFAULT_TRADITIONAL_NOVENA_REPORT_DIR = DEFAULT_REPORT_DIR / "traditional-novena-july-august"

MONTH_NUMBER_TO_NAME = {
    1: "january",
    2: "february",
    3: "march",
    4: "april",
    5: "may",
    6: "june",
    7: "july",
    8: "august",
    9: "september",
    10: "october",
    11: "november",
    12: "december",
}

MONTH_NAME_TO_NUMBER = {value: key for key, value in MONTH_NUMBER_TO_NAME.items()}


def _normalize_month_value(value: Any) -> str:
    if isinstance(value, int):
        if value in MONTH_NUMBER_TO_NAME:
            return MONTH_NUMBER_TO_NAME[value]
        raise RuntimeError(f"Unsupported month value: {value}")

    cleaned = str(value or "").strip().lower()
    if not cleaned:
        raise RuntimeError("Month value cannot be empty.")
    if cleaned.isdigit():
        number = int(cleaned)
        if number in MONTH_NUMBER_TO_NAME:
            return MONTH_NUMBER_TO_NAME[number]
        raise RuntimeError(f"Unsupported month value: {value}")
    if cleaned in MONTH_NAME_TO_NUMBER:
        return cleaned
    raise RuntimeError(f"Unsupported month value: {value}")


def normalize_import_months(months: Optional[Sequence[Any]] = None) -> Tuple[str, ...]:
    source_months = months if months is not None else DEFAULT_TRADITIONAL_NOVENA_IMPORT_MONTHS
    normalized: list[str] = []
    seen: set[str] = set()
    for month in source_months:
        cleaned = _normalize_month_value(month)
        if cleaned in seen:
            continue
        seen.add(cleaned)
        normalized.append(cleaned)
    if not normalized:
        return DEFAULT_TRADITIONAL_NOVENA_IMPORT_MONTHS
    return tuple(normalized)


def traditional_bulk_report_base_path(month: Any, *, report_dir: Optional[Path] = None) -> Path:
    base_dir = Path(report_dir) if report_dir else DEFAULT_TRADITIONAL_NOVENA_REPORT_DIR
    return base_dir / f"{_normalize_month_value(month)}-bulk-report"


@dataclass(frozen=True)
class TraditionalNovenaImportRun:
    catalog_url: str
    months: Tuple[str, ...]
    reports: Tuple[NovenaImportReport, ...] = field(default_factory=tuple)

    @property
    def written(self) -> int:
        return sum(report.written for report in self.reports)

    @property
    def disabled(self) -> int:
        return sum(report.disabled for report in self.reports)

    @property
    def failed(self) -> int:
        return sum(report.hard_failures for report in self.reports)

    @property
    def total(self) -> int:
        return sum(len(report.entries) for report in self.reports)

    def summary(self) -> Dict[str, Any]:
        return {
            "catalog_url": self.catalog_url,
            "months": list(self.months),
            "written": self.written,
            "disabled": self.disabled,
            "failed": self.failed,
            "total": self.total,
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "catalog_url": self.catalog_url,
            "months": list(self.months),
            "summary": self.summary(),
            "reports": [report.to_dict() for report in self.reports],
        }


def import_traditional_novena_months(
    catalog_url: str = DEFAULT_TRADITIONAL_NOVENA_CATALOG_URL,
    *,
    months: Optional[Sequence[Any]] = None,
    output_dir: Optional[Path] = None,
    force: bool = False,
    dry_run: bool = False,
    resolve_with_openai: bool = False,
    openai_api_key: str = "",
    openai_base_url: str = "https://api.openai.com/v1",
    openai_model: str = "gpt-4.1-mini",
    fetcher: Optional[Callable[[str], str]] = None,
) -> TraditionalNovenaImportRun:
    normalized_months = normalize_import_months(months)
    reports = []
    for month in normalized_months:
        report = import_bulk_catalog(
            catalog_url,
            output_dir=output_dir,
            force=force,
            dry_run=dry_run,
            month=month,
            resolve_with_openai=resolve_with_openai,
            openai_api_key=openai_api_key,
            openai_base_url=openai_base_url,
            openai_model=openai_model,
            fetcher=fetcher,
        )
        reports.append(report)
    return TraditionalNovenaImportRun(catalog_url=catalog_url, months=normalized_months, reports=tuple(reports))


def write_traditional_novena_import_reports(
    run: TraditionalNovenaImportRun,
    *,
    report_dir: Optional[Path] = None,
) -> Tuple[Tuple[Path, Path], ...]:
    written_paths = []
    for month, report in zip(run.months, run.reports):
        report_path = traditional_bulk_report_base_path(month, report_dir=report_dir)
        written_paths.append(write_bulk_report(report, report_path=report_path))
    return tuple(written_paths)
