#!/usr/bin/env python3
"""v569 cache warming at publish time: after a day publishes, walk
the day's dated assets in the public feed and request each one
once through the edge, so the first listener in each region is
served from the tiered cache instead of paying the origin fill.
A second request per asset reports its cf-cache-status — the
warmth proof (HIT means the fill stands).

Usage: python3 runner/warm_day_cache.py YYYY-MM-DD [--feed URL]
Prints one line per asset plus a summary; exit 0 when every asset
answered 200/206, 1 otherwise. Stores nothing.
"""
import argparse
import re
import sys
import urllib.request

FEED = "https://orapronobis.media/podcast.xml"
UA = {"User-Agent": "ora-pro-nobis-cache-warmer/1.0"}


def fetch(url, rng=None):
    headers = dict(UA)
    if rng:
        headers["Range"] = rng
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as res:
        body = res.read()
        return res.status, res.headers.get("cf-cache-status"), len(body)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("date")
    ap.add_argument("--feed", default=FEED)
    args = ap.parse_args()
    status, _, _ = fetch(args.feed)
    if status != 200:
        print(f"feed fetch failed: HTTP {status}")
        return 1
    req = urllib.request.Request(args.feed, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as res:
        xml = res.read().decode("utf-8", "replace")
    urls = []
    for tag in re.findall(r"<enclosure\b[^>]*>", xml):
        m = re.search(r'\burl="([^"]+)"', tag)
        if m and args.date in m.group(1) and m.group(1) not in urls:
            urls.append(m.group(1))
    if not urls:
        print(f"no dated assets found for {args.date}")
        return 1
    bad = 0
    for url in urls:
        try:
            s1, _, n = fetch(url)
            s2, cache2, _ = fetch(url, rng="bytes=0-99")
            ok = s1 in (200, 206) and s2 in (200, 206)
            if not ok:
                bad += 1
            print(f"{'ok' if ok else 'FAIL'} {url.rsplit('/', 1)[-1]} "
                  f"prime={s1} ({n} B) recheck={s2} cf-cache={cache2}")
        except Exception as e:  # noqa: BLE001
            bad += 1
            print(f"FAIL {url}: {e}")
    print(f"warmed {len(urls) - bad}/{len(urls)} assets for {args.date}")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
