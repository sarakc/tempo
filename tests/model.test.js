const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTempo } = require("./load");

const T = loadTempo();

test("parseSecs: plain numbers are seconds", () => {
  assert.equal(T.parseSecs("45"), 45);
  assert.equal(T.parseSecs(" 45 "), 45);
  assert.equal(T.parseSecs(90), 90);
});

test("parseSecs: m:ss, with overflowing seconds carried", () => {
  assert.equal(T.parseSecs("1:30"), 90);
  assert.equal(T.parseSecs("1:75"), 135);
  assert.equal(T.parseSecs("0:45"), 45);
  assert.equal(T.parseSecs("5:00"), 300);
});

test("parseSecs: empty, junk, zero and negatives give null", () => {
  for (const v of ["", "   ", "abc", "0", "-5", "0:00", "1:", ":30", "1:-5", "4.5", "1:30:00", null, undefined]) assert.equal(T.parseSecs(v), null, JSON.stringify(v));
});

const plain = x => JSON.parse(JSON.stringify(x));
const mkEx = (id, extra) => Object.assign({ id, name: id, sets: [{ w: "", r: "" }, { w: "", r: "" }, { w: "", r: "" }] }, extra);
const mkBlock = (id, ids, extra) => Object.assign({ id, rounds: 3, work: 40, restEx: 10, restRound: 60, exercises: ids.map(i => mkEx(i)) }, extra);
const names = o => o.blocks.map(b => b.exercises.map(e => e.id).join(""));

test("moveExercise: within a superset", () => {
  const o = { blocks: [mkBlock("b1", ["A", "B", "C"])] };
  T.moveExercise(o, { b: 0, e: 0 }, { b: 0, e: 2 });
  assert.deepEqual(names(o), ["BCA"]);
});

test("moveExercise: across supersets keeps id, all sets, work and side", () => {
  const ex = mkEx("X", { work: 50, side: true, sets: [{ w: "20", r: "8" }, { w: "22", r: "8" }, { w: "24", r: "6" }, { w: "26", r: "5" }] });
  const o = { blocks: [mkBlock("b1", ["A"]), mkBlock("b2", ["B"], { rounds: 2 })] };
  o.blocks[0].exercises.push(ex);
  const before = plain(ex);
  T.moveExercise(o, { b: 0, e: 1 }, { b: 1, e: 0 });
  assert.deepEqual(names(o), ["A", "XB"]);
  assert.deepEqual(plain(o.blocks[1].exercises[0]), before);
});

test("moveExercise: emptied superset is removed and target index adjusted", () => {
  const o = { blocks: [mkBlock("b1", ["A"]), mkBlock("b2", ["B"]), mkBlock("b3", ["C"])] };
  T.moveExercise(o, { b: 0, e: 0 }, { b: 2, e: 1 });
  assert.deepEqual(names(o), ["B", "CA"]);
});

test("moveExercise: dropping at blocks.length makes a new superset with the source's rounds", () => {
  const o = { blocks: [mkBlock("b1", ["A", "B"], { rounds: 4, work: 30, restEx: 5, restRound: 90 })] };
  T.moveExercise(o, { b: 0, e: 1 }, { b: 1, e: 0 });
  assert.deepEqual(names(o), ["A", "B"]);
  const n = o.blocks[1];
  assert.equal(n.rounds, 4); assert.equal(n.work, 30); assert.equal(n.restEx, 5); assert.equal(n.restRound, 90);
  assert.ok(n.id && n.id !== "b1");
});

test("moveExercise: new superset from a single-exercise source keeps order, drops the empty one", () => {
  const o = { blocks: [mkBlock("b1", ["A"]), mkBlock("b2", ["B"])] };
  T.moveExercise(o, { b: 0, e: 0 }, { b: 2, e: 0 });
  assert.deepEqual(names(o), ["B", "A"]);
});

test("moveBlock: 0 -> 2 on three supersets", () => {
  const o = { blocks: [mkBlock("b1", ["A"]), mkBlock("b2", ["B"]), mkBlock("b3", ["C"])] };
  T.moveBlock(o, 0, 2);
  assert.deepEqual(o.blocks.map(b => b.id), ["b2", "b3", "b1"]);
});

const sess = (...sets) => ({ sets: sets.map(([w, r]) => ({ w, r })) });

test("suggestWeight: same top weight and reps held or up suggests +step", () => {
  assert.equal(T.suggestWeight([sess(["25", "10"]), sess(["25", "10"])], 5), "30");
  assert.equal(T.suggestWeight([sess(["25", "12"]), sess(["25", "10"])], 5), "30");
});

test("suggestWeight: no suggestion when reps dropped, weight differs, mixed, or one session", () => {
  assert.equal(T.suggestWeight([sess(["25", "8"]), sess(["25", "10"])], 5), null);
  assert.equal(T.suggestWeight([sess(["25", ""]), sess(["22.5", ""])], 5), null);
  assert.equal(T.suggestWeight([sess(["25", "10"]), sess(["25", ""])], 5), null);
  assert.equal(T.suggestWeight([sess(["25", "10"])], 5), null);
});

test("suggestWeight: no reps logged, fractional step", () => {
  assert.equal(T.suggestWeight([sess(["25", ""]), sess(["25", ""])], 2.5), "27.5");
});

test("exLabel: saved exercises read as names, old strings and new objects alike", () => {
  const saved = [T.planExercise({ id: "a", name: " Plank ", sets: [], work: 60, side: true }), T.planExercise({ name: "Squat", sets: [] }), "Row", null];
  const line = saved.map(T.exLabel).join(", ");
  assert.equal(line, "Plank, Squat, Row, ");
  assert.doesNotMatch(line, /\[object/);
});

test("cue: trimmed and kept by normExercise and planExercise", () => {
  assert.equal(T.normExercise({ name: "A", cue: "  Brace  " }).cue, "Brace");
  assert.equal(T.planExercise({ name: "A", cue: " Brace " }).cue, "Brace");
  assert.equal(T.normExercise(T.planExercise({ name: "A", cue: "Brace" })).cue, "Brace");
});

test("cue: empty or missing cues leave no cue key", () => {
  assert.equal("cue" in T.planExercise({ name: "A", cue: "" }), false);
  assert.equal("cue" in T.normExercise({ name: "A", cue: "   " }), false);
  assert.equal("cue" in T.normExercise("Plank"), false);
  assert.equal("cue" in T.planExercise({ name: "A", cue: 5 }), false);
});

test("cue: cut to 300 characters", () => {
  assert.equal(T.normExercise({ name: "A", cue: "x".repeat(400) }).cue.length, 300);
  assert.equal(T.planExercise({ name: "A", cue: "x".repeat(400) }).cue.length, 300);
});

test("draftDay: the day you did it, not the day the draft was made", () => {
  const today = T.dayOf(Date.now());
  assert.equal(T.draftDay({ date: "2026-01-02" }), today);
  assert.equal(T.draftDay({ date: "2026-01-02", doneOn: "2026-01-05" }), "2026-01-05");
  assert.equal(T.draftDay({ date: "2026-01-02", dateSet: true, doneOn: "2026-01-05" }), "2026-01-02");
  assert.equal(T.draftDay({ date: "", dateSet: true }), today);
  assert.equal(T.dayOf(new Date(2026, 2, 9, 23, 59).getTime()), "2026-03-09");
});

test("LET: superset letters run A to Z, then AA, AB, …", () => {
  assert.deepEqual([0, 1, 9, 10, 25, 26, 27, 51, 52, 701, 702].map(i => T.LET(i)), ["A", "B", "J", "K", "Z", "AA", "AB", "AZ", "BA", "ZZ", "AAA"]);
});
