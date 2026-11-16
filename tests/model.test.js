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
