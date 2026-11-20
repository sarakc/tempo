const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTempo } = require("./load");

const T = loadTempo();
const plain = x => JSON.parse(JSON.stringify(x));

test("remoteDocs: reads the records out of a sync file", () => {
  const docs = { "settings/main": { t: 5, d: { unit: "kg" } }, "workouts/x": { t: 6, del: 1 } };
  assert.deepEqual(plain(T.remoteDocs(JSON.stringify({ app: "Tempo", format: 1, docs }))), docs);
  assert.deepEqual(plain(T.remoteDocs(JSON.stringify({ app: "Tempo", format: 1, docs: {} }))), {});
});

test("remoteDocs: a cut-off, garbled or empty read throws instead of looking like an empty gist", () => {
  for (const txt of ['{"app":"Tempo","docs":{"a":{"t":1', "<!doctype html><title>Error</title>", "", "   ", "null", "[]", '"docs"', '{"app":"Tempo"}', '{"docs":[]}', '{"docs":null}', undefined, null])
    assert.throws(() => T.remoteDocs(txt), /sync file/, JSON.stringify(txt));
});

test("stampNow: never at or below the record's previous stamp, even one from a fast clock", () => {
  const ahead = Date.now() + 5 * 60e3;
  assert.ok(T.stampNow(ahead) > ahead);
  assert.ok(T.stampNow() > ahead); // and later stamps keep counting up from there
});

test("a fast device's edit doesn't undo a later edit made here once it has synced", () => {
  // the fast device (5 min ahead) sets kg; this device syncs and takes it
  const kg = { t: Date.now() + 5 * 60e3 + 1e6, d: { unit: "kg" } };
  T.noteStamp(kg.t); // what applyRemote does with each record it takes
  // a minute later this device sets lb (after a reload, so only the record's own stamp is known)
  const lb = { t: T.stampNow(kg.t), d: { unit: "lb" } };
  const m = T.mergeDocs({ "settings/main": lb }, { "settings/main": kg });
  assert.deepEqual(plain(m.out["settings/main"].d), { unit: "lb" });
  assert.equal(m.remoteDirty, true);
  assert.deepEqual(plain(m.toLocal), {});
  assert.ok(T.stampNow() > kg.t);
});
