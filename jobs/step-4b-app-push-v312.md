# Step 4B — drafted in full at v312 Plan (E8) for insertion at Ship

Implement does NOT edit the live nightly job sheet; the Ship pass
inserts the text below into the `ora-pro-nobis-nightly-run` job sheet
(the v306 precedent — the job-sheet edit is a Ship step), after step
4's publish verification and before the ledger flip.

---

**Step 4B — APP PUSH (v312):** after step 4's publish verification
completes and BEFORE the ledger flip, run
`jobs/push_episodes_to_app.py --report <the run's report.json>` for
the target date. The push is part of the publish tail: a timeout or
failure is completed by `--reconcile` exactly like the rest of the
tail, ledger flip still last. The closing report gains the mandatory
field **'App push (v312)'**: date pushed · episode count (present /
missing) · per-track audio verified · the stored date after the push,
read back from the app.

---

Ordering note (pinned at Plan): the episode push and the Intentions
segment push are independent by construction. The replace-day commit
deletes only rows and objects whose date is not the target date, so
it cannot delete a same-day segment whether that segment arrives
before or after the episode commit; the segment push remains the
standing idempotent upsert keyed (date, block). The guard is the
read-back: the commit returns `segmentsHeld` for the target date and
the stored-day route re-reads it; any block whose segment has not
landed continues to be named by the standing `audioMissing` report —
a gap is named in a report, never silently absorbed.
