from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, Optional

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.publish.contracts import DEFAULT_CONTRACT_DIR, build_text_jobs, load_publish_contracts
from jobs.publish.notion import build_notion_client, upsert_text_jobs_to_notion



def run_text_pipeline(*, contract_dir: Optional[Path] = None, notion_token: Optional[str] = None) -> Dict[str, Any]:
    contracts = load_publish_contracts(contract_dir or DEFAULT_CONTRACT_DIR)
    jobs = build_text_jobs(contracts)
    client = build_notion_client(notion_token)
    result = upsert_text_jobs_to_notion(jobs, client=client)
    result["jobs"] = len(jobs)
    result["contracts"] = len(contracts)
    return result



def main() -> int:
    try:
        result = run_text_pipeline()
        print(
            f"text_pipeline contracts={result['contracts']} jobs={result['jobs']} created={result['created']} updated={result['updated']}"
        )
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
