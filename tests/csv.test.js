const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTempo } = require("./load");

const T = loadTempo();
const DIR = path.join(__dirname, "..", "examples", "interval-timer-routines");
const read = f => fs.readFileSync(path.join(DIR, f), "utf8");
const plain = v => JSON.parse(JSON.stringify(v));
// A plan as the timer sees it: ids on blocks and exercises, empty sets
const toTimer = p => ({ ...p, blocks: p.blocks.map((b, i) => ({ ...b, id: "b" + i, exercises: b.exercises.map((e, j) => ({ ...e, id: "e" + j, sets: [] })) })) });
// "Quick strength (5 min)" → 300
const minutesIn = name => +name.match(/\((\d+) min\)/)[1] * 60;

test("parseCSV: BOM, CRLF, quoted commas, doubled quotes, line breaks, blank lines", () => {
  const rows = T.parseCSV('﻿a,b\r\n"x, y","he said ""hi"""\r\n"multi\nline",2\r\n\r\n');
  assert.deepEqual(plain(rows), [["a", "b"], ["x, y", 'he said "hi"'], ["multi\nline", "2"]]);
});

test("parseCSV: last row without a newline, empty cells kept", () => {
  assert.deepEqual(plain(T.parseCSV("a,,c\n1,2,")), [["a", "", "c"], ["1", "2", ""]]);
});

test("routinesFromCSV: one routine, named after the file, every row pinned, cue only when present", () => {
  const r = T.routinesFromCSV("Interval,Duration (s),Cue\nPlank,30,Brace\nRest,10,\n", "03-core-blast.csv");
  assert.equal(r.error, null);
  assert.equal(r.skipped, 0);
  assert.equal(r.plans.length, 1);
  const p = r.plans[0];
  assert.equal(p.name, "core-blast");
  assert.equal(p.mode, "timer");
  assert.equal(p.autoFit, false);
  assert.equal(p.restsOn, false);
  assert.equal(p.ready, 0);
  assert.equal(p.restBlock, 0);
  assert.equal(p.targetMin, 40 / 60);
  assert.equal(p.blocks.length, 1);
  const b = p.blocks[0];
  assert.equal(b.rounds, 1);
  assert.equal(b.restEx, 0);
  assert.equal(b.restRound, 0);
  assert.deepEqual(plain(b.exercises), [{ name: "Plank", work: 30, cue: "Brace" }, { name: "Rest", work: 10 }]);
  assert.equal("cue" in b.exercises[1], false);
});

test("routinesFromCSV: Duration as m:ss; blank names and unreadable seconds are skipped and counted", () => {
  const r = T.routinesFromCSV("Exercise,Duration\nRow,1:30\n,20\nSquat,abc\nLunge,45\n", "x.csv");
  assert.equal(r.skipped, 2);
  assert.deepEqual(plain(r.plans[0].blocks[0].exercises), [{ name: "Row", work: 90 }, { name: "Lunge", work: 45 }]);
});

test("routinesFromCSV: header names ignore case and extra spaces", () => {
  const r = T.routinesFromCSV(" interval , SECONDS ,  notes\nPlank,30,Brace\n", "a.csv");
  assert.equal(r.error, null);
  assert.deepEqual(plain(r.plans[0].blocks[0].exercises), [{ name: "Plank", work: 30, cue: "Brace" }]);
});

test("routinesFromCSV: Duration (s) wins over Duration when both are present", () => {
  const r = T.routinesFromCSV("Name,Duration,Duration (s)\nPlank,0:40,40\n", "a.csv");
  assert.equal(r.plans[0].blocks[0].exercises[0].work, 40);
});

test("routinesFromCSV: missing columns and empty files import nothing and say why", () => {
  let r = T.routinesFromCSV("Foo,Bar\n1,2\n", "a.csv");
  assert.equal(r.error, "columns");
  assert.equal(r.plans.length, 0);
  r = T.routinesFromCSV("Interval,Seconds\n", "a.csv");
  assert.equal(r.error, "empty");
  assert.equal(r.plans.length, 0);
  r = T.routinesFromCSV("Interval,Seconds\n,abc\n", "a.csv");
  assert.equal(r.error, "empty");
  assert.equal(r.skipped, 1);
  r = T.routinesFromCSV("", "a.csv");
  assert.equal(r.error, "columns");
});

test("routinesFromCSV: a new superset each time Block changes", () => {
  const r = T.routinesFromCSV("Block,Name,Seconds\nA,a1,10\nA,a2,10\nB,b1,10\nA,a3,10\n", "a.csv");
  assert.deepEqual(plain(r.plans[0].blocks.map(b => b.exercises.length)), [2, 1, 1]);
});

test("routinesFromCSV: long cues are cut to 300 characters", () => {
  const r = T.routinesFromCSV(`Name,Seconds,Cue\nPlank,30,${"x".repeat(400)}\n`, "a.csv");
  assert.equal(r.plans[0].blocks[0].exercises[0].cue.length, 300);
});

for (const f of fs.readdirSync(DIR).filter(f => f.endsWith(".csv") && f !== "all-routines.csv").sort()) {
  test(`example ${f}: one workout, one step per row, plays for exactly its length`, () => {
    const rows = T.parseCSV(read(f));
    const r = T.routinesFromCSV(read(f), f);
    assert.equal(r.error, null);
    assert.equal(r.skipped, 0);
    assert.equal(r.plans.length, 1);
    const p = r.plans[0], routine = rows[1][0];
    assert.equal(p.name, routine);
    assert.equal(p.blocks.reduce((a, b) => a + b.exercises.length, 0), rows.length - 1);
    assert.equal(T.totalAll(toTimer(p)), minutesIn(routine));
    assert.equal(T.buildSteps(toTimer(p)).length, rows.length - 1);
  });
}

test("example all-routines.csv: ten workouts in file order", () => {
  const r = T.routinesFromCSV(read("all-routines.csv"), "all-routines.csv");
  assert.equal(r.error, null);
  assert.equal(r.skipped, 0);
  assert.equal(r.plans.length, 10);
  assert.equal(r.plans[0].name, "Pump and unwind (5 min)");
  assert.equal(T.totalAll(toTimer(r.plans[0])), 300);
  const full = r.plans.find(p => p.name === "Full sequence (45 min)");
  assert.equal(full.blocks.length, 6);
  assert.equal(T.totalAll(toTimer(full)), 2700);
  r.plans.forEach(p => assert.equal(T.totalAll(toTimer(p)), minutesIn(p.name)));
});

test("parseCSV: a quote inside an unquoted cell is just a character", () => {
  assert.deepEqual(plain(T.parseCSV('Plank,Keep feet 6" apart\nSquat,x\n')), [["Plank", 'Keep feet 6" apart'], ["Squat", "x"]]);
  const r = T.routinesFromCSV('Name,Seconds,Cue\nPlank,30,Keep feet 6" apart\nSquat,30,x\nLunge,30,"y"\n', "a.csv");
  assert.deepEqual(plain(r.plans[0].blocks[0].exercises.map(e => e.name)), ["Plank", "Squat", "Lunge"]);
  assert.equal(r.plans[0].blocks[0].exercises[0].cue, 'Keep feet 6" apart');
});

test("parseCSV: rows of empty cells (Excel's cleared rows) are dropped, not counted as skipped", () => {
  assert.deepEqual(plain(T.parseCSV("a,b\n,\n1,2\n , \n")), [["a", "b"], ["1", "2"]]);
  const r = T.routinesFromCSV("Name,Seconds,Cue\nPlank,30,\n,,\n,,\n", "a.csv");
  assert.equal(r.skipped, 0);
});
