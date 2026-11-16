const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTempo } = require("./load");
const { blk, timerDraft } = require("./fixtures");

const T = loadTempo();
const plain = o => JSON.parse(JSON.stringify(o));
const pickTimes = d => ({ work: d.blocks[0].work, restEx: d.blocks[0].restEx, restRound: d.blocks[0].restRound, restBlock: d.restBlock });
const sum = steps => steps.reduce((a, s) => a + s.dur, 0);
// Old (Task 1) step output; only auto work steps may move, by at most 1s
function matchesOld(steps, old) {
  const o = old.split(",");
  assert.equal(steps.length, o.length);
  steps.forEach((s, i) => {
    assert.equal(s.k[0], o[i][0]);
    const was = +o[i].slice(1);
    if (s.k === "work" && s.auto) assert.ok(Math.abs(s.dur - was) <= 1, `step ${i}: ${s.dur} vs ${was}`);
    else assert.equal(s.dur, was, `step ${i}`);
  });
}

test("fit: balanced, 2 supersets x 2 ex x 3 rounds, 30 min", () => {
  const d = timerDraft({}, [blk(["Squat", "Row"]), blk(["Press", "Curl"])]); T.applyFit(d);
  assert.deepEqual(pickTimes(d), { work: 84, restEx: 28, restRound: 112, restBlock: 168 });
  assert.equal(T.totalAll(d), 1800);
  matchesOld(T.buildSteps(d), "r10,w84,r28,w84,r112,w84,r28,w84,r112,w84,r28,w84,r168,w84,r28,w84,r112,w84,r28,w84,r112,w84,r28,w84");
});

test("fit: more work, 1 superset x 3 ex x 4 rounds, 20 min", () => {
  const d = timerDraft({ balance: "work", targetMin: 20 }, [blk(["Squat", "Row", "Press"], 4)]); T.applyFit(d);
  assert.deepEqual(pickTimes(d), { work: 74, restEx: 15, restRound: 60, restBlock: 112 });
  assert.equal(T.totalAll(d), 1200);
  matchesOld(T.buildSteps(d), "r10,w74,r15,w74,r15,w74,r60,w74,r15,w74,r15,w74,r60,w74,r15,w74,r15,w74,r60,w74,r15,w74,r15,w74");
});

test("fit: more rest, no transitions, 3 supersets, 45 min, no get-ready", () => {
  const d = timerDraft({ balance: "rest", restsOn: false, ready: 0, targetMin: 45 },
    [blk(["A", "B"], 3), blk(["C", "D", "E"], 2), blk(["F"], 1)]); T.applyFit(d);
  assert.deepEqual(pickTimes(d), { work: 108, restEx: 54, restRound: 216, restBlock: 324 });
  assert.equal(T.totalAll(d), 2700);
  matchesOld(T.buildSteps(d), "w108,w108,r216,w108,w108,r216,w108,w108,r324,w108,w108,w108,r216,w108,w108,w108,r324,w108");
});

test("manual mode leaves times alone", () => {
  const d = timerDraft({ autoFit: false }, [blk(["Squat", "Row"], 3)]); T.applyFit(d);
  assert.deepEqual(pickTimes(d), { work: 45, restEx: 15, restRound: 60, restBlock: 90 });
  assert.equal(T.totalAll(d), 445);
  assert.equal(T.stepsSig(T.buildSteps(d)).replace(/:[^,]*/g, ""), "r10,w45,r15,w45,r60,w45,r15,w45,r60,w45,r15,w45");
});

test("empty-named rows are skipped", () => {
  const d = timerDraft({}, [blk(["Squat", ""])]);
  const work = T.buildSteps(d).filter(s => s.k === "work");
  assert.ok(work.length > 0);
  assert.ok(work.every(s => s.e === 0));
});

test("restRatios legacy presets are exact", () => {
  for (const k of ["work", "even", "rest"]) assert.deepEqual(plain(T.restRatios({ balance: k })), plain(T.BAL[k]));
});

test("restRatios scale multiplies the even ratios", () => {
  const r = T.restRatios({ restScale: 1.5 });
  assert.deepEqual(plain(Object.keys(r).sort()), ["bl", "ex", "rd"]);
  assert.ok(Math.abs(r.ex - 0.5) < 1e-9 && Math.abs(r.rd - 2) < 1e-9 && Math.abs(r.bl - 3) < 1e-9);
});

test("normExercise", () => {
  const a = T.normExercise("Plank");
  assert.equal(typeof a.id, "string"); assert.equal(a.name, "Plank"); assert.deepEqual(plain(a.sets), []);
  assert.equal("work" in a, false); assert.equal("side" in a, false);
  assert.equal(T.normExercise({ name: "Plank", work: "60" }).work, 60);
  assert.equal("work" in T.normExercise({ work: 0 }), false);
  assert.equal("work" in T.normExercise({ work: "x" }), false);
  assert.equal("side" in T.normExercise({ side: "yes" }), false);
  assert.equal(T.normExercise({ side: true }).side, true);
});

test("planExercise", () => {
  assert.deepEqual(plain(T.planExercise({ id: "a", name: " Plank ", sets: [{ w: "", r: "" }], work: 60, side: true })), { name: "Plank", work: 60, side: true });
  assert.deepEqual(plain(T.planExercise({ id: "a", name: "Plank", sets: [] })), { name: "Plank" });
});

test("exWork and exUnits", () => {
  assert.equal(T.exWork({ work: 45 }, { work: 30 }), 45);
  assert.equal(T.exWork({}, { work: 30 }), 30);
  assert.equal(T.exUnits({ side: true }), 2);
  assert.equal(T.exUnits({}), 1);
  assert.equal(T.SIDE_SWITCH, 5);
});

/* ---------- Task 3: fit with pins, exact totals, sides and segments ---------- */
function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const finite = steps => steps.every(s => Number.isFinite(s.dur) && s.dur >= 1);
const ex = (name, extra = {}) => ({ id: "x" + name, name, sets: [], ...extra });
const custom = (id, exercises, rounds = 3, extra = {}) => ({ id, rounds, work: 45, restEx: 15, restRound: 60, exercises, ...extra });
const poolSpread = steps => {
  const pools = {};
  steps.filter(s => s.k === "work" && s.auto).forEach(s => (pools[s.pool] = pools[s.pool] || []).push(s.dur));
  return Object.values(pools).map(v => Math.max(...v) - Math.min(...v));
};
// Steps from the first to the last work step of one superset (its inner rests included)
const blockSteps = (steps, bid) => {
  const idx = steps.map((s, i) => s.bid === bid ? i : -1).filter(i => i >= 0);
  return steps.slice(idx[0], idx[idx.length - 1] + 1);
};

function genWorkout(rnd) {
  const pick = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  let n = 0;
  const blocks = Array.from({ length: pick(1, 4) }, (_, bi) => {
    const names = Array.from({ length: pick(1, 5) }, () => "X" + n++);
    const b = blk(names, pick(1, 6), { id: "g" + bi });
    b.exercises.forEach(e => { if (rnd() < 0.2) e.work = pick(10, 120); if (rnd() < 0.15) e.side = true; });
    if (rnd() < 0.1) b.exercises.push({ id: "empty" + bi, name: "", sets: [], work: 90, side: true });
    if (rnd() < 0.15) b.lockTotal = pick(120, 900);
    return b;
  });
  const o = { targetMin: 5 * pick(1, 18), restScale: Math.round((0.4 + rnd() * 1.6) * 10) / 10, restsOn: rnd() < 0.8, ready: rnd() < 0.5 ? 10 : 0, restLocks: {} };
  for (const k of ["ex", "rd", "bl"]) if (rnd() < 0.15) o.restLocks[k] = pick(5, 120);
  if (rnd() < 0.2) o.warmup = { name: "Warm-up", dur: pick(60, 600) };
  if (rnd() < 0.2) o.cooldown = { name: "", dur: pick(60, 600) };
  return timerDraft(o, blocks);
}

test("exact total, even spread and consistent totals across generated workouts", () => {
  const rnd = mulberry32(1); let checked = 0, skipped = 0;
  for (let i = 0; i < 2000; i++) {
    const d = genWorkout(rnd); T.applyFit(d);
    const steps = T.buildSteps(d), tot = T.totalAll(d), ctx = JSON.stringify(d);
    assert.ok(finite(steps), ctx);
    assert.equal(tot, sum(steps), ctx);
    const named = d.blocks.filter(b => b.exercises.some(e => e.name.trim()));
    const segs = (d.warmup?.dur || 0) + (d.cooldown?.dur || 0);
    assert.equal(tot, d.ready + segs + named.reduce((a, b) => a + T.blockTotal(b, d), 0) + (named.length - 1) * d.restBlock + d.fit.adj, ctx);
    if (d.fit.short || d.fit.allSet) { skipped++; continue; }
    checked++;
    assert.equal(tot, d.targetMin * 60, ctx);
    assert.ok(poolSpread(steps).every(x => x <= 1), ctx);
    named.filter(b => b.lockTotal && b.exercises.some(e => e.name.trim() && !e.work)).forEach(b => {
      assert.equal(sum(blockSteps(steps, b.id)), b.lockTotal, ctx);
      assert.equal(T.blockTotal(b, d), b.lockTotal, ctx);
    });
  }
  console.log(`exact total: ${checked} checked, ${skipped} skipped (short/allSet)`);
  assert.ok(checked > 500);
});

test("pinned exercise keeps its time and the others share evenly", () => {
  const d = timerDraft({ targetMin: 30 }, [custom("b1", [ex("Squat"), ex("Plank", { work: 60 }), ex("Row")])]); T.applyFit(d);
  const w = T.buildSteps(d).filter(s => s.k === "work");
  assert.ok(w.filter(s => s.eid === "xPlank").every(s => s.dur === 60 && !s.auto));
  const free = w.filter(s => s.eid !== "xPlank").map(s => s.dur);
  assert.ok(Math.max(...free) - Math.min(...free) <= 1);
  assert.equal(T.totalAll(d), 1800);
});

test("pinned rests hold whatever the rest scale", () => {
  for (const k of [0.4, 1, 2]) {
    const d = timerDraft({ restScale: k, restLocks: { ex: 10 } }, [blk(["Squat", "Row", "Press"])]); T.applyFit(d);
    const sw = T.buildSteps(d).filter(s => s.sub === "switch");
    assert.ok(sw.length && sw.every(s => s.dur === 10));
    assert.equal(T.totalAll(d), 1800);
  }
});

test("pinned superset lands on its total and the workout on the target", () => {
  const d = timerDraft({}, [blk(["Squat", "Row"], 3, { id: "bA" }), blk(["Press", "Curl"], 3, { id: "bB", lockTotal: 420 }), blk(["Lunge"], 2, { id: "bC" })]); T.applyFit(d);
  const steps = T.buildSteps(d);
  assert.equal(sum(blockSteps(steps, "bB")), 420);
  assert.equal(T.blockTotal(d.blocks[1], d), 420);
  assert.equal(T.totalAll(d), 1800);
  assert.ok(steps.filter(s => s.bid === "bB").every(s => s.pool === "bB"));
  assert.ok(steps.filter(s => s.bid === "bA").every(s => s.pool === "o"));
});

test("pins shrink rests too", () => {
  const mk = pin => timerDraft({}, [custom("b1", [ex("Squat", pin ? { work: 300 } : {}), ex("Row"), ex("Press")])]);
  const a = mk(false), b = mk(true); T.applyFit(a); T.applyFit(b);
  assert.ok(b.blocks[0].restRound < a.blocks[0].restRound, `${b.blocks[0].restRound} < ${a.blocks[0].restRound}`);
  assert.ok(b.blocks[0].work < a.blocks[0].work);
  assert.equal(T.totalAll(b), 1800);
});

test("doesn't fit: pins above the target", () => {
  const d = timerDraft({ targetMin: 5 }, [custom("b1", [ex("Plank", { work: 400 }), ex("Squat")])]); T.applyFit(d);
  const steps = T.buildSteps(d);
  assert.equal(d.fit.short, true);
  assert.ok(finite(steps));
  assert.ok(Number.isFinite(T.totalAll(d)));
  assert.equal(d.fit.adj, 0);
});

test("all pinned: total is the pins plus fitted rests", () => {
  const d = timerDraft({}, [custom("b1", [ex("Plank", { work: 60 }), ex("Hold", { work: 40, side: true })], 2), custom("b2", [ex("Bridge", { work: 30 })], 2)]); T.applyFit(d);
  assert.equal(d.fit.allSet, true);
  const steps = T.buildSteps(d), b = d.blocks[0];
  assert.ok(finite(steps));
  const expect = 10 + 2 * (60 + 40 * 2 + 5) + 2 * b.restEx + b.restRound + d.restBlock + 2 * 30 + d.blocks[1].restRound;
  assert.equal(T.totalAll(d), expect);
  assert.ok([b.restEx, b.restRound, d.restBlock].every(x => Number.isFinite(x) && x >= 5));
  assert.equal(d.fit.short, false);
});

test("all pinned above the target is flagged short, durations untouched", () => {
  const a = timerDraft({ targetMin: 5 }, [custom("b1", [ex("Plank", { work: 200 }), ex("Hold", { work: 200 })])]); T.applyFit(a);
  assert.equal(a.fit.allSet, true); assert.equal(a.fit.short, true); assert.equal(a.fit.adj, 0);
  assert.ok(T.totalAll(a) > 300);
  assert.ok(T.buildSteps(a).filter(s => s.k === "work").every(s => s.dur === 200));
  const b = timerDraft({ targetMin: 5, warmup: { name: "Warm-up", dur: 600 } }, [custom("b1", [ex("Plank", { work: 20 })], 1)]); T.applyFit(b);
  assert.equal(b.fit.allSet, true); assert.equal(b.fit.short, true);
  assert.ok(finite(T.buildSteps(b)));
});

test("fixed superset with every exercise pinned ignores its total", () => {
  const d = timerDraft({}, [blk(["Squat", "Row"], 3, { id: "bA" }), custom("bB", [ex("Plank", { work: 60 }), ex("Hold", { work: 30 })], 2, { lockTotal: 600 })]); T.applyFit(d);
  const steps = T.buildSteps(d), B = d.blocks[1];
  assert.ok(finite(steps));
  assert.equal(sum(blockSteps(steps, "bB")), 2 * (60 + 30) + 2 * B.restEx + B.restRound);
  assert.equal(T.totalAll(d), 1800);
});

test("empty rows with pins or sides are ignored", () => {
  const base = () => timerDraft({}, [custom("b1", [ex("Squat"), ex("Row")])]);
  const a = base(), b = base();
  b.blocks[0].exercises.push({ id: "xe", name: "", sets: [], work: 60, side: true });
  T.applyFit(a); T.applyFit(b);
  assert.equal(T.stepsSig(T.buildSteps(b)), T.stepsSig(T.buildSteps(a)));
  assert.ok(T.buildSteps(b).every(s => s.eid !== "xe" && s.sub !== "side"));
  assert.deepEqual(plain(T.counts(b)), plain(T.counts(a)));
});

test("each side: two halves with a switch between, counted as two units", () => {
  const d = timerDraft({}, [custom("b1", [ex("Squat"), ex("Lunge", { side: true }), ex("Row")])]); T.applyFit(d);
  const steps = T.buildSteps(d);
  const i = steps.findIndex(s => s.eid === "xLunge");
  assert.equal(steps[i].side, 1);
  assert.deepEqual(plain({ k: steps[i + 1].k, sub: steps[i + 1].sub, dur: steps[i + 1].dur }), { k: "rest", sub: "side", dur: 5 });
  assert.equal(steps[i + 2].eid, "xLunge"); assert.equal(steps[i + 2].side, 2);
  const w = steps.filter(s => s.k === "work").map(s => s.dur);
  assert.ok(Math.max(...w) - Math.min(...w) <= 1);
  assert.equal(T.counts(d).nW, 12);
  assert.equal(T.totalAll(d), 1800);
  assert.match(T.stepsSig(steps), /:b1\.xLunge:s1,r5,w\d+:b1\.xLunge:s2/);
});

test("segments come first and last, count toward the target, no rest next to them", () => {
  const d = timerDraft({ warmup: { name: "Warm-up", dur: 300 }, cooldown: { name: "", dur: 120 } }, [blk(["Squat", "Row"], 3, { id: "bA" }), blk(["Press"], 2, { id: "bB" })]); T.applyFit(d);
  const steps = T.buildSteps(d);
  assert.equal(steps[0].k, "ready");
  assert.deepEqual(plain(steps[1]), { k: "seg", sub: "warmup", name: "Warm-up", dur: 300 });
  assert.deepEqual(plain(steps[steps.length - 1]), { k: "seg", sub: "cooldown", name: "Cool-down", dur: 120 });
  assert.equal(steps[2].k, "work"); assert.equal(steps[steps.length - 2].k, "work");
  assert.equal(T.totalAll(d), 1800);
});

test("signature: swapping two identically timed exercises changes it", () => {
  const a = timerDraft({}, [blk(["Squat", "Row"])]), b = timerDraft({}, [blk(["Squat", "Row"])]);
  b.blocks[0].exercises.reverse();
  T.applyFit(a); T.applyFit(b);
  const sa = T.stepsSig(T.buildSteps(a)), sb = T.stepsSig(T.buildSteps(b));
  assert.equal(sa.replace(/:[^,]*/g, ""), sb.replace(/:[^,]*/g, ""));
  assert.notEqual(sa, sb);
  assert.match(sa, /w\d+:bSquatRow\.e0Squat,/);
});

test("backCalcWork: pinned exercises keep their time", () => {
  const d = timerDraft({ autoFit: false }, [custom("b1", [ex("Squat"), ex("Plank", { work: 60 })])]);
  assert.equal(T.backCalcWork(d.blocks[0], d, 600), 85);
});

test("backCalcWork: fully pinned superset returns existing work", () => {
  const d = timerDraft({ autoFit: false }, [custom("b1", [ex("Squat", { work: 40 }), ex("Plank", { work: 60 })])]);
  assert.equal(T.backCalcWork(d.blocks[0], d, 600), 45);
});

test("backCalcWork: each-side exercise counts two units and switch steps", () => {
  const d = timerDraft({ autoFit: false }, [custom("b1", [ex("Squat"), ex("Lunge", { side: true })])]);
  const w = T.backCalcWork(d.blocks[0], d, 600);
  assert.equal(w, Math.round((600 - 3 * 15 - 2 * 60 - 3 * 5) / 9));
  d.blocks[0].work = w;
  assert.ok(Math.abs(T.blockTotal(d.blocks[0], d) - 600) <= 9);
});
