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
