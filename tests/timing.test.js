const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTempo } = require("./load");
const { blk, timerDraft } = require("./fixtures");

const T = loadTempo();
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
