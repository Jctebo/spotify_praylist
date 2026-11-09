
import importlib.util, json, sys, urllib.request
BASE = "http://127.0.0.1:8931"
TOKEN = "harness-token"
def local_call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
        headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")
spec = importlib.util.spec_from_file_location("push_helper", r"/home/hatch/workspace/.worktrees/v334/jobs/push_episodes_to_app.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
helper.door.BASE = BASE
helper.door.call = local_call
def _headers(extra):
    out = ["-H", "Authorization: Bearer " + TOKEN]
    for k, v in extra.items():
        out += ["-H", f"{k}: {v}"]
    return out
helper.door._headers = _headers
sys.argv = ["push_episodes_to_app.py", "--report", r"/tmp/v318-helper-eyIhte/report.json"]
rc = helper.main()
assert rc == 0, f"helper exit {rc}"
status, stored = local_call("GET", "/api/agent/player/stored-day")
# v324 Implement named update (harness-only): the push helper now
# appends the nine external rows to the same commit (§2.7), so the
# stored day carries 3 own + 9 external rows; for this 2027 fixture
# date every external stands missing (no live feed carries it).
assert stored["storedDate"] == "2027-04-03" and stored["episodeCount"] == 12, stored
assert stored["textsPresent"] == 1 and stored["textsMissing"] == 11, stored
assert stored["tracksPresent"] == 2 and stored["tracksMissing"] == 10, stored
assert stored["externalsPresent"] == 0 and stored["externalsMissing"] == 9, stored
print("HELPER-V318: PASS")
