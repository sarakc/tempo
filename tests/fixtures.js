function blk(names, rounds = 3, extra = {}) {
  return {
    id: "b" + names.join(""),
    rounds,
    work: 45,
    restEx: 15,
    restRound: 60,
    exercises: names.map((n, i) => ({ id: "e" + i + n, name: n, sets: [] })),
    ...extra,
  };
}

function timerDraft(overrides, blocks) {
  return { mode: "timer", autoFit: true, targetMin: 30, balance: "even", restsOn: true, ready: 10, restBlock: 90, blocks, ...overrides };
}

module.exports = { blk, timerDraft };
