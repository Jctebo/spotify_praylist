// harness-v564.mjs — v564 (Domain move: the public build on
// app.orapronobis.media). Static confinement + posture checks
// against the committed tree; the served legs (wrangler dev
// --remote with the LOCAL_DEV probe header, then the live public
// host after the domain attaches) are run at Ship and recorded in
// the release doc. Run from the repo root:  node harness-v564.mjs
import { readFileSync } from "node:fs";

let ok = 0, bad = 0;
const check = (name, cond) => { if (cond) { ok++; console.log("ok   -", name); } else { bad++; console.log("FAIL -", name); } };
const idx = readFileSync("app/worker/src/index.ts", "utf8");

// S1: the public host constant + gate exist.
check("S1 public host + gate present", idx.includes('const PUBLIC_HOST = "app.orapronobis.media"') && idx.includes("function publicGate("));
// S2: the gate refuses every non-GET with the pointer.
check("S2 writes refused with the pointer", idx.includes('if (request.method !== "GET")') && idx.includes('code: "personal-in-app"'));
// S3: personal reads answer canned empties at the gate.
check("S3 canned empties", idx.includes('sub === "intentions") return json({ ok: true, intentions: [] })') && idx.includes('sub === "starred") return json({ ok: true, starred: [] })') && idx.includes('"mass-personal-prayer") return json({ ok: true, before: [], after: [], afterMass: [], preMass: [] })'));
// S4: the gate stands where johnOnly stood, on the public host only.
check("S4 gate placement", idx.includes("if (pub) {\n        const gated = publicGate(request, seg, url);"));
// S5: prayerDayPayload sanitizes under pub (no draw, no completions, no addendum).
check("S5 day builder pub folds", idx.includes("const draw = pub ? new Map<number, number>() : await prayerDrawForDate(env, date)") && idx.includes("const addRow = pub ? null :"));
// S6: playerDayPayload sanitizes under pub (profile, positions, block order, additions, introTexts).
check("S6 shell builder pub folds", idx.includes("const profileStore = pub ? null : await prayerProfileStore(env)") && idx.includes("const introTexts = pub ? {} : await playerIntroTexts(env, presented)") && idx.includes("additions: pub ? [] :"));
// S7: the manifest passes pub through; the day + shell routes pass pub.
check("S7 pub threading", idx.includes("await dayManifestPayload(env, date, pub)") && idx.includes("await playerDayPayload(env, dateParam, pub)") && idx.includes("await prayerDayPayload(env, date, pub)"));
// S8: podcasts payloads strip listen state under pub, at the session route only (5 sites).
check("S8 podcasts strip sites", (idx.match(/pub \? stripListenState\(await pod/g) ?? []).length === 5);
// S9: the agent door is untouched by the gate (its block still precedes the session gate).
check("S9 door precedes gate", idx.indexOf('seg[1] === "agent"') < idx.indexOf("const pub = isPublicHost(request, env);"));
// S10: the exam-today canned shape never runs the creating builder on the public host.
check("S10 exam canned at gate", idx.includes('fam === "exam" && sub === "today"') && idx.includes("run: null, prompts: []"));
// S11: no sign-in surface was built (no login/auth route exists).
check("S11 no sign-in built", !idx.includes("/api/auth") && !idx.includes("oauth") && !/seg\[2\] === "login"/.test(idx));
// S12: the PRAYER_AUDIO map stands in index.ts (byte-equality vs
// main is verified at Ship from the clean checkout).
check("S12 prayer audio map intact", idx.includes("PRAYER_AUDIO"));

console.log(`\nharness-v564: ${ok} ok / ${bad} not-ok`);
process.exit(bad ? 1 : 0);
