from __future__ import annotations


class PublishMissingDataError(RuntimeError):
    """Raised when a publish block cannot resolve required upstream data."""


class DailyIntroMissingDataError(PublishMissingDataError):
    """Raised when the daily intro cannot find usable Gospel data."""
