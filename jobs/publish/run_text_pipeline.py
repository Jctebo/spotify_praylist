from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, Optional

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.publish.contracts import DEFAULT_CONTRACT_DIR, build_text_jobs, load_publish_contracts
from jobs.publish.local_state import DEFAULT_STATE_PATH, contract_completion_keys, update_publish_state



def run_text_pipeline(*, contract_dir: Optional[Path] = None, state_path: Optional[Path] = None) -> Dict[str, Any]:
    resolved_contract_dir = Path(contract_dir or DEFAULT_CONTRACT_DIR)
    contracts = load_publish_contracts(resolved_contract_dir)
    jobs = build_text_jobs(contracts)
    output_state_path = Path(state_path) if state_path else (
        DEFAULT_STATE_PATH if resolved_contract_dir == DEFAULT_CONTRACT_DIR else resolved_contract_dir.parent / ".cache" / "publish_state" / "state.json"
    )
    state_result = update_publish_state(
        jobs,
        path=output_state_path,
        completion_keys=contract_completion_keys(contracts),
    )
    return {
        "jobs": len(jobs),
        "contracts": len(contracts),
        "updated": len(jobs),
        **state_result,
    }



def main() -> int:
    try:
        result = run_text_pipeline()
        print(
            f"text_pipeline contracts={result['contracts']} jobs={result['jobs']} updated={result['updated']} state_path={result['state_path']}"
        )
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
