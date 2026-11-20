const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTempo } = require("./load");

const T = loadTempo();
const MIN = 60e3;
// A running timer as startSession builds it, started at time 0
const startAt = steps => ({ steps, i: 0, paused: false, endAt: steps[0].dur * 1000, lastTick: 0, spent: {} });
// The 100 ms interval while the screen is on; returns "done" if the last step ended on the way
function ticks(t, from, to) {
  for (let now = from; now <= to; now += 100) { const r = T.catchUp(t, now); if (r === "done") return { done: true, at: now }; }
  return { done: false };
}
const focusSet = { focusRounds: 4, focusMin: 25, shortBreak: 5, longBreak: 15, longEvery: 4, autoBreaks: true };

test("catchUp: a gap is shared out over the steps it covered, by their scheduled ends", () => {
  const steps = [{ dur: 10 }, { dur: 20 }, { dur: 30 }], t = startAt(steps);
  assert.equal(T.catchUp(t, 25e3), "moved");
  assert.equal(t.i, 1);
  assert.deepEqual({ ...t.spent }, { 0: 10e3, 1: 15e3 });
  assert.equal(t.endAt, 30e3);
  assert.equal(T.catchUp(t, 26e3), "");
  assert.equal(t.spent[1], 16e3);
});

test("catchUp: past the last step it reports done, and endAt is the workout's scheduled end", () => {
  const steps = [{ dur: 60 }, { dur: 600 }], t = startAt(steps);
  ticks(t, 100, 5 * MIN + 1000); // lock with 5 minutes left …
  assert.equal(T.catchUp(t, 5 * MIN + 1000 + 60 * MIN), "done"); // … and come back an hour later
  assert.equal(t.endAt, 660e3);
});

test("catchUp: stops at a hold step, paused from its scheduled start", () => {
  const steps = [{ dur: 10 }, { dur: 20, hold: true }, { dur: 30 }], t = startAt(steps);
  assert.equal(T.catchUp(t, 50e3), "moved");
  assert.equal(t.i, 1);
  assert.equal(t.paused, true);
  assert.equal(t.pausedAt, 10e3);
  assert.equal(t.remaining, 20e3);
  assert.deepEqual({ ...t.spent }, { 0: 10e3 });
});

test("meditation locked 5 s in, reopened 8 minutes later and ended early logs the time sat", () => {
  const steps = T.medSteps({ medSettle: 15, medMin: 10 }), t = startAt(steps);
  ticks(t, 100, 5000);
  T.catchUp(t, 5000 + 8 * MIN); // the screen comes back on
  ticks(t, 5000 + 8 * MIN + 100, 5000 + 8 * MIN + 1000); // then End is tapped
  const got = T.loggedTime(steps, t.spent, true, "med");
  assert.equal(got.sec, 5 + 8 * 60 + 1 - 15); // everything after the 15 s settle-in
});

test("4 x 25 focus with automatic breaks, locked from 27:00 to 57:00, then completed, logs 100 min and 4 rounds", () => {
  const steps = T.focusSteps(focusSet), t = startAt(steps);
  ticks(t, 100, 27 * MIN);
  T.catchUp(t, 57 * MIN);
  const end = ticks(t, 57 * MIN + 100, 200 * MIN);
  assert.equal(end.done, true);
  assert.equal(t.endAt, 115 * MIN);
  assert.deepEqual({ ...T.loggedTime(steps, t.spent, false, "focus") }, { sec: 100 * 60, rounds: 4 });
});

test("loggedTime: ended early counts only what was spent; a round needs 90% of its time", () => {
  const steps = T.focusSteps(focusSet);
  assert.deepEqual({ ...T.loggedTime(steps, { 0: 25 * MIN, 1: 5 * MIN, 2: 22.5 * MIN }, true, "focus") }, { sec: 47.5 * 60, rounds: 2 });
  assert.deepEqual({ ...T.loggedTime(steps, { 0: 25 * MIN, 1: 5 * MIN, 2: 22 * MIN }, true, "focus") }, { sec: 47 * 60, rounds: 1 });
});
