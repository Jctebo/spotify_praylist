#!/usr/bin/env python3
"""v569 cost watch (the v565 fold-in): a small monthly read of the
Cloudflare lines for Ora Pro Nobis, read against the governing
measure — cost per prayer.

Reads (via the Cloudflare connector's registered API helper):
  - R2 storage for bucket ora-pro-nobis-audio (objects + bytes)
  - R2 operations for the bucket, trailing 30 days, by action type
  - Zone requests for audio.orapronobis.media, trailing 30 days
    (the aggregate listening volume — play counting stays
    aggregate only; no per-user tracking exists or is added)

Writes a JSON report to stdout (and to --out PATH when given):
the raw lines, the priced estimate at Cloudflare list rates, and
cost per prayer = monthly Cloudflare cost / monthly audio-host
requests. Rates are named constants below; when they change,
change them here and the report says which rates it used.
"""
import argparse
import json
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, "/home/hatch/workspace/custom-connectors/custom.cloudflare/bin")
from cf import request  # noqa: E402

ACCOUNT = "19135db329e6018b318b33b72aa6e3f3"
ZONE = "939c4ae2561f7669cedd1532f7d45343"
BUCKET = "ora-pro-nobis-audio"
AUDIO_HOST = "audio.orapronobis.media"

# Cloudflare list rates (2026-11): R2 standard storage $0.015 per
# GB-month; Class A operations (Put/List/...) $4.50 per million;
# Class B operations (Get/Head/...) $0.36 per million. Egress free.
RATES = {
    "r2_storage_gb_month": 0.015,
    "r2_class_a_per_million": 4.50,
    "r2_class_b_per_million": 0.36,
}
CLASS_A = {"PutObject", "PutObjects", "ListObjects", "ListBuckets",
           "PutBucket", "CopyObject", "CompleteMultipartUpload",
           "CreateMultipartUpload", "UploadPart"}
CLASS_B = {"GetObject", "GetObjects", "HeadObject", "HeadBucket",
           "DeleteObject", "DeleteObjects"}


def gql(query):
    r = request("POST", "/graphql", {"query": query})
    if r.get("errors"):
        raise RuntimeError(f"graphql: {r['errors']}")
    return r["data"]["viewer"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=30)
    f = "%Y-%m-%dT%H:%M:%SZ"
    q = """query { viewer { accounts(filter: {accountTag: "%s"}) {
      r2StorageAdaptiveGroups(limit: 5, filter: {bucketName: "%s",
        datetime_geq: "%s", datetime_leq: "%s"}) { max { objectCount payloadSize metadataSize } }
      r2OperationsAdaptiveGroups(limit: 100, filter: {bucketName: "%s",
        datetime_geq: "%s", datetime_leq: "%s"}) { sum { requests } dimensions { actionType } }
    } } }""" % (ACCOUNT, BUCKET, start.strftime(f), now.strftime(f),
                BUCKET, start.strftime(f), now.strftime(f))
    acct = gql(q)["accounts"][0]
    storage = (acct.get("r2StorageAdaptiveGroups") or [{}])[0].get("max", {})
    ops = {}
    for row in acct.get("r2OperationsAdaptiveGroups") or []:
        ops[row["dimensions"]["actionType"]] = row["sum"]["requests"]
    qz = """query { viewer { zones(filter: {zoneTag: "%s"}) {
      httpRequestsAdaptiveGroups(limit: 10, filter: {datetime_geq: "%s",
        datetime_leq: "%s", clientRequestHTTPHost: "%s"}) { count }
    } } }""" % (ZONE, start.strftime(f), now.strftime(f), AUDIO_HOST)
    # The volume leg is best-effort: the standing token carries no
    # zone analytics scope, so a refused read records null + the
    # refusal, and cost per prayer stands uncomputed until the
    # scope joins the token. The R2 cost lines above are the
    # watch's substance and always read.
    audio_requests = None
    volume_note = None
    try:
        zone_rows = gql(qz)["zones"][0].get("httpRequestsAdaptiveGroups") or []
        audio_requests = sum(r["count"] for r in zone_rows)
    except RuntimeError as e:
        volume_note = f"zone analytics read refused: {e}"

    gb = (storage.get("payloadSize") or 0) / 1e9
    class_a = sum(n for a, n in ops.items() if a in CLASS_A)
    class_b = sum(n for a, n in ops.items() if a in CLASS_B)
    storage_cost = gb * RATES["r2_storage_gb_month"]
    ops_cost = (class_a / 1e6) * RATES["r2_class_a_per_million"] + \
               (class_b / 1e6) * RATES["r2_class_b_per_million"]
    monthly = storage_cost + ops_cost
    report = {
        "generatedAt": now.isoformat(),
        "windowDays": 30,
        "bucket": BUCKET,
        "storage": {"objects": storage.get("objectCount"),
                    "payloadBytes": storage.get("payloadSize"),
                    "metadataBytes": storage.get("metadataSize")},
        "operations30d": ops,
        "audioHostRequests30d": audio_requests,
        "volumeNote": volume_note,
        "rates": RATES,
        "estimate": {
            "storageCostMonthly": round(storage_cost, 4),
            "operationsCostMonthly": round(ops_cost, 4),
            "cloudflareMonthly": round(monthly, 4),
            "costPerPrayer": (round(monthly / audio_requests, 6)
                              if audio_requests else None),
            "costPerThousandGets": (round(monthly / (ops.get("GetObject", 0) / 1000.0), 6)
                                    if ops.get("GetObject") else None),
        },
    }
    text = json.dumps(report, indent=2)
    if args.out:
        with open(args.out, "w") as fh:
            fh.write(text + "\n")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
