# derive-finished-course.py — builds tests/fixtures-v614/bible-finished.json
# from the PRODUCTION course payload tests/fixtures-v603/bible-folded.json
# (Bible in a Year, core-folded): the finished-course variant — every
# entry listened, currentKey null, listenedCount = total. This is the
# payload shape the server serves for a course the listener has
# finished (podPayload: current = first unlistened entry, else null).
# Usage: python3 derive-finished-course.py <bible-folded.json> <out.json>
import json, sys
p = json.load(open(sys.argv[1]))
for e in p["entries"]:
    e["listened"] = True
    e["positionS"] = None
p["currentKey"] = None
p["listenedCount"] = len(p["entries"])
json.dump(p, open(sys.argv[2], 'w'), indent=2)
print("entries", len(p["entries"]), "all listened; currentKey null")
