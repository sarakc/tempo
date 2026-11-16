const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTempo } = require("./load");
const { blk, timerDraft } = require("./fixtures");

const T = loadTempo();
const plain = o => JSON.parse(JSON.stringify(o));
const pickTimes = d => ({ work: d.blocks[0].work, restEx: d.blocks[0].restEx, restRound: d.blocks[0].restRound, restBlock: d.restBlock });

test("fit: balanced, 2 supersets x 2 ex x 3 rounds, 30 min", () => {
  const d = timerDraft({}, [blk(["Squat", "Row"]), blk(["Press", "Curl"])]); T.applyFit(d);
  assert.deepEqual(pickTimes(d), { work: 84, restEx: 28, restRound: 112, restBlock: 168 });
  assert.equal(T.totalAll(d), 1802); // today drifts 2s over the target
  assert.equal(T.buildSteps(d).length, 24);
});

test("fit: more work, 1 superset x 3 ex x 4 rounds, 20 min", () => {
  const d = timerDraft({ balance: "work", targetMin: 20 }, [blk(["Squat", "Row", "Press"], 4)]); T.applyFit(d);
  assert.deepEqual(pickTimes(d), { work: 74, restEx: 15, restRound: 60, restBlock: 112 });
  assert.equal(T.totalAll(d), 1198);
});

test("fit: more rest, no transitions, 3 supersets, 45 min, no get-ready", () => {
  const d = timerDraft({ balance: "rest", restsOn: false, ready: 0, targetMin: 45 },
    [blk(["A", "B"], 3), blk(["C", "D", "E"], 2), blk(["F"], 1)]); T.applyFit(d);
  assert.deepEqual(pickTimes(d), { work: 108, restEx: 54, restRound: 216, restBlock: 324 });
  assert.equal(T.totalAll(d), 2700);
  assert.equal(T.buildSteps(d).length, 18);
});

test("manual mode leaves times alone", () => {
  const d = timerDraft({ autoFit: false }, [blk(["Squat", "Row"], 3)]); T.applyFit(d);
  assert.deepEqual(pickTimes(d), { work: 45, restEx: 15, restRound: 60, restBlock: 90 });
  assert.equal(T.totalAll(d), 445);
  assert.equal(T.buildSteps(d).length, 12);
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
