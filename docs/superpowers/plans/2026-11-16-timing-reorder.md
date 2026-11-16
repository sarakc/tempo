# Flexible Timing, Reordering and Timer Upgrades: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Tempo's fixed-length workout timer take hand-set ("pinned") exercise, superset and rest times while spreading the remaining time evenly. Add a continuous work/rest slider, drag-and-drop reordering, undo, live ±15s, each-side exercises, warm-up/cool-down, timeline selection, weight hints and a lock-screen audio experiment.

**Architecture:** All app code stays in `index.html`. Its pure logic (helpers, constants, timing math, move operations, weight hints) sits between `/* @testable */` and `/* @end-testable */` marker comments. `tests/load.js` pulls those regions out and runs them in a Node `vm` sandbox, so `node --test` can exercise them with no packages and no build step. UI tasks are verified by a script-parse test plus listed manual checks in a browser.

**Tech Stack:** Vanilla JS, HTML, CSS (single-file PWA), Node 24 built-in test runner (`node:test`, `node:assert`, `node:vm`).

**Spec:** `docs/superpowers/specs/2026-11-16-timing-reorder-design.md` (read it first; section numbers below refer to it).

## Global Constraints

- No build step, no frameworks, no third-party libraries, no npm packages (tests use Node built-ins only).
- All app code stays in `index.html`. Do not add runtime files (`sw.js` serves them cache-first, so phones would keep stale copies). Files under `tests/` are fine because the app never loads them.
- Phone first (installed iPhone PWA, touch only). Must also work with a mouse and keyboard.
- Reuse the existing look: `.card`, chips, `.stepper`, `.seg`, the bottom sheet (`openSheet`/`closeSheet`), the toast. No visual redesign.
- Minimums: work interval 10s, any fitted rest 5s (unchanged from today).
- Rest slider: `restScale` 0.4–2.0, step 0.1, "Balanced" mark at 1.0.
- Legacy `balance` with no `restScale` keeps its exact `BAL[balance]` ratios. The slider writes `restScale`.
- Each-side switch step: 5s. Live adjust: ±15s. Undo window: about 6s. Warm-up/cool-down default: 5 min.
- Weight-hint step default: 5 when the unit is lb, 2.5 when kg.
- Old devices may read new data: exercises in saved plans become `{ name, work?, side? }` objects (old `draftFrom` already accepts objects).
- Don't push to `origin/main` (pushing deploys). Commit locally after each task.

## Review Focus

1. **Everything pinned.** If no unpinned work interval is left, the total is just the sum of the pins: no `NaN`, no `Infinity`, `d.fit.allSet === true`, and the summary says times are all set by hand. Test in Task 3.
2. **Pinning the last free exercise in a fixed-total superset.** `applyFit` ignores that superset's `lockTotal` (its total becomes the sum of its pins, no `NaN`). The time editor clears `lockTotal` and shows an undoable toast. Tests in Task 3 and Task 5.
3. **Typed times that don't parse.** `"abc"`, `""`, `"0"` and `"-5"` change nothing; `"45"` means 45 *seconds* (the existing `parseDur` treats plain numbers as minutes, so don't reuse it); `"1:30"` means 90 and `"1:75"` means 135. Test in Task 5.
4. **Empty exercise rows** ("+ Choose exercise") that carry a pin or each-side setting are ignored by fit and the timer, and keep their settings for when a name is chosen. Test in Task 3.
5. **Resume after edits.** Resume only matches when the workout's structure and exercise identities are unchanged. ±15s adjustments survive leave-and-resume. Reordering exercises with identical timings must *not* match. Tests in Task 3 (signature) and Task 11 (adjustments).

## File Structure

- `index.html`: the app. Modified throughout. Marker regions added in Task 1.
- `tests/load.js`: extracts the `@testable` regions and returns their exports. Created in Task 1.
- `tests/fixtures.js`: small builders for draft objects used across tests. Created in Task 1.
- `tests/parse.test.js`: checks the whole inline `<script>` parses. Created in Task 1.
- `tests/timing.test.js`: timing math. Created in Task 1, extended in Tasks 2–4, 11.
- `tests/model.test.js`: move operations, time parsing, weight hints. Created in Task 5, extended in Tasks 9 and 14.

Deliberate deviation from spec section 1: warm-up and cool-down are stored as `d.warmup` / `d.cooldown` (`{ name, dur }` or absent) instead of supersets with a `kind` field. Behavior is identical to the spec. This keeps superset letters (A, B, C, computed from position via `LET[bi]` in 12 places), `counts()`, drag-and-drop and the "first/last" constraint free of special cases.

---

## Stage 1: Safety net

### Task 1: Test harness and characterization tests

**Files:**
- Modify: `index.html` (marker comments only; no behavior change)
- Create: `tests/load.js`, `tests/fixtures.js`, `tests/parse.test.js`, `tests/timing.test.js`

**Interfaces:**
- Produces: `loadTempo()` in `tests/load.js` → an object with every name listed in `EXPORTS`. Later tasks add names to `EXPORTS`.
- Produces: `timerDraft(overrides, blocks)` and `blk(names, rounds, extra)` in `tests/fixtures.js`.

- [ ] **Step 1: Add marker regions in `index.html`.** Wrap three existing sections in `/* @testable */` … `/* @end-testable */`:
  1. the helper constants `esc` through `clone` (currently lines 459–468), but not `lsGet`/`lsSet`;
  2. `const LENS` through `const BAL` (lines 525–528);
  3. the whole `/* ---------- timer math ---------- */` section up to (not including) `/* ---------- history index ---------- */`. Move `const stepsSig` (line 1136) into this region.

  The timing region reads `DEF.targetMin`. The loader injects `DEF`. Don't move `DEF`.

- [ ] **Step 2: Write `tests/load.js`.** `loadTempo()` reads `index.html`, concatenates every `@testable` region in order, and appends `;({ ...EXPORTS })`. It runs the result with `vm.runInNewContext(code, { DEF: { targetMin: 30 } })` and returns the object. Start with `EXPORTS = ["buildSteps","applyFit","totalAll","counts","blockTotal","blockFixed","stepsSig","BAL"]`. Also export `scriptSource()`, which returns the text between `<script>` and `</script>`.

- [ ] **Step 3: Write `tests/fixtures.js`.**
  - `blk(names, rounds = 3, extra = {})` returns `{ id, rounds, work: 45, restEx: 15, restRound: 60, exercises: names.map((n, i) => ({ id: "e" + i + n, name: n, sets: [] })), ...extra }`, with a stable id taken from the names.
  - `timerDraft(overrides, blocks)` returns `{ mode: "timer", autoFit: true, targetMin: 30, balance: "even", restsOn: true, ready: 10, restBlock: 90, blocks, ...overrides }`.

- [ ] **Step 4: Write `tests/parse.test.js`.** `test("app script parses")`: `new vm.Script(scriptSource())` doesn't throw.

- [ ] **Step 5: Write characterization tests in `tests/timing.test.js`.** These are today's exact outputs (probed from the current code):

```js
test("fit: balanced, 2 supersets x 2 ex x 3 rounds, 30 min", () => {
  const d = timerDraft({}, [blk(["Squat","Row"]), blk(["Press","Curl"])]); T.applyFit(d);
  assert.deepEqual(pickTimes(d), { work: 84, restEx: 28, restRound: 112, restBlock: 168 });
  assert.equal(T.totalAll(d), 1802);           // today drifts 2s over the target
  assert.equal(T.buildSteps(d).length, 24);
});
test("fit: more work, 1 superset x 3 ex x 4 rounds, 20 min", () => { /* balance:"work", targetMin:20 */ /* work 74, restEx 15, restRound 60, restBlock 112, total 1198 */ });
test("fit: more rest, no transitions, 3 supersets, 45 min, no get-ready", () => { /* balance:"rest", restsOn:false, ready:0, blocks [A,B]x3,[C,D,E]x2,[F]x1 */ /* work 108, restEx 54, restRound 216, restBlock 324, total 2700, 18 steps */ });
test("manual mode leaves times alone", () => { /* autoFit:false, [Squat,Row]x3 */ /* work 45, restEx 15, restRound 60, total 445, 12 steps */ });
test("empty-named rows are skipped", () => { /* blk(["Squat",""]) → 1 named exercise: steps only reference e:0 */ });
```

  `pickTimes(d)` reads `work`/`restEx`/`restRound` from `d.blocks[0]` and `restBlock` from `d`.

- [ ] **Step 6: Run** `node --test tests/`. Expected: all pass (these lock in current behavior).

- [ ] **Step 7: Commit** `test: add timing harness and characterization tests`.

---

## Stage 2: Timing model

### Task 2: Data model fields and legacy compatibility

**Files:**
- Modify: `index.html`: timing region (new helpers), `mkBlock`, `draftFrom`, `normDraft`, `planFromObj`, `finishWorkout`, `timingFrom`
- Test: `tests/timing.test.js`

**Interfaces:**
- Produces (all in the timing region, exported):
  - `restRatios(d) -> { ex, rd, bl }`: if `num(d.restScale) != null`, return `BAL.even` × `restScale` for each key. Otherwise return `BAL[d.balance] || BAL.even`.
  - `exWork(e, b) -> number`: `int(e.work, null) ?? int(b.work, 1)`.
  - `exUnits(e) -> 1 | 2`: 2 when `e.side`.
  - `normExercise(e) -> { id, name, sets, work?, side? }`: accepts a string or an object. Adds `id` (via `uid()`) when missing, drops `work` unless it's a positive integer, and keeps `side` only when it's `true`.
  - `planExercise(e) -> { name, work?, side? }`: what saved plans store.
  - `SIDE_SWITCH = 5`.
- Workout fields from spec section 1: `restScale`, `restLocks: { ex?, rd?, bl? }`, `warmup?: { name, dur }`, `cooldown?: { name, dur }`. Superset fields: `lockTotal`.

- [ ] **Step 1: Failing tests:**
  - `restRatios legacy`: for each of `work`, `even` and `rest`, `restRatios({ balance: k })` deep-equals `BAL[k]`.
  - `restRatios scale`: `restRatios({ restScale: 1.5 })` deep-equals `{ ex: 0.5, rd: 2, bl: 3 }` (within 1e-9).
  - `normExercise`: `"Plank"` → `{ name: "Plank", sets: [], id: <string> }`. `{ name: "Plank", work: "60" }` keeps `work: 60`. `{ work: 0 }` and `{ work: "x" }` drop `work`. `{ side: "yes" }` drops `side`.
  - `planExercise`: `{ id, name: " Plank ", sets: [..], work: 60, side: true }` → `{ name: "Plank", work: 60, side: true }`. A plain one → `{ name: "Plank" }`.
- [ ] **Step 2: Run** `node --test tests/`. Expected: new tests FAIL with "not a function".
- [ ] **Step 3: Implement the helpers** above.
- [ ] **Step 4: Wire the model:**
  - `mkBlock` exercises go through `normExercise`, keeping `work`/`side` from source objects.
  - `draftFrom` passes source exercise objects (not just names) and copies `lockTotal`.
  - `timingFrom` adds `restScale`, `restLocks` (default `{}`), `warmup` and `cooldown`, all copied from the source when present.
  - `normDraft` runs `normExercise` on every exercise.
  - `planFromObj` stores `exercises: named.map(planExercise)`, plus `lockTotal`, `restScale`, `restLocks`, `warmup` and `cooldown`. When `restScale` is set, also write `balance` as the nearest preset (≤0.8 → `work`, ≥1.25 → `rest`, otherwise `even`) for old devices.
  - `finishWorkout` adds `work`/`side` per exercise and `lockTotal` per superset, plus the workout-level fields above.
- [ ] **Step 5: Run** `node --test tests/`. Expected: PASS, including the Task 1 characterization tests.
- [ ] **Step 6: Commit** `feat: add pin, side and rest-scale fields with legacy compatibility`.

### Task 3: Fit calculation with pins, exact totals, sides and segments

**Files:**
- Modify: `index.html` timing region: `counts`, `blockFixed`, `blockTotal`, `buildSteps`, `applyFit`, `stepsSig`
- Test: `tests/timing.test.js`

**Interfaces:**
- Consumes: `restRatios`, `exWork`, `exUnits`, `SIDE_SWITCH` (Task 2).
- Produces:
  - `applyFit(d)` sets `b.work` (that superset's *unpinned* work time), `b.restEx`, `b.restRound`, `d.restBlock`, `b.adj` (seconds, for pinned supersets) and `d.fit = { short: bool, allSet: bool, adj: number }`. No-op when not timer mode or not `autoFit`, as today.
  - `buildSteps(d)` step shapes:
    - work: `{ k: "work", dur, b, r, e, bid, eid, side?: 1|2, pool: "o" | bid, auto: bool }`
    - side switch: `{ k: "rest", sub: "side", dur: SIDE_SWITCH }`
    - segment: `{ k: "seg", sub: "warmup" | "cooldown", name, dur }`
    - existing `ready`, `switch`, `round` and `block` steps unchanged.
  - Step order: ready, warm-up, supersets, cool-down. No rest step next to a segment.
  - `stepsSig(steps)`: work steps include `bid.eid` and `side`, so `"w84:b1.e0"` and `"w84:b1.e0:s1"`.
  - `blockTotal(b, d)`: pinned superset returns `lockTotal`. Otherwise Σ(R·exUnits·exWork) + R·sides·SIDE_SWITCH + `blockFixed`.

- [ ] **Step 1: Failing tests** (use fixtures; `sum(steps)` = total duration):
  - `exact total`: across a generated spread of workouts (1–4 supersets, 1–5 exercises, 1–6 rounds, targets 5–90 min in steps of 5, `restScale` from 0.4 to 2.0, random pins), for every case where `d.fit.short === false`: `totalAll(d) === targetMin*60`. Use a seeded generator (e.g. mulberry32 with seed 1) so failures reproduce.
  - `even spread`: in each such case, the durations of auto work steps in one pool differ by at most 1s.
  - `pinned exercise`: `[Squat, Plank{work:60}, Row]` × 3 at 30 min. Every Plank work step is 60, and Squat/Row equal each other ±1.
  - `pinned rests`: `restLocks: { ex: 10 }` makes every `switch` step 10s whatever the `restScale`.
  - `pinned superset`: `lockTotal: 420` on superset B. B's steps sum to exactly 420, and the whole workout still equals the target.
  - `pins shrink rests too`: pinning one exercise to a large value makes `restRound` strictly smaller than in the same workout without the pin (spec: rests shrink with work).
  - `doesn't fit`: pins summing above the target → `d.fit.short === true`, no step under 1s, no `NaN`.
  - `all pinned` (Review Focus 1): every exercise pinned → `d.fit.allSet === true`, finite total equal to the pins plus fitted rests, no `NaN`.
  - `last free exercise in fixed superset` (Review Focus 2): superset with `lockTotal` and all its exercises pinned → its steps sum to its pins plus rests, no `NaN`.
  - `empty rows` (Review Focus 4): `{ name: "", work: 60, side: true }` produces no steps and doesn't change the fit.
  - `each side`: `{ name: "Lunge", side: true }` produces two work steps `side: 1` then `side: 2` with a 5s `side` step between, and counts as 2 units (each half equals the other auto work ±1).
  - `segments`: `warmup: { name: "Warm-up", dur: 300 }` → first step after `ready` is `{ k: "seg", dur: 300 }`, total still equals the target, no rest step adjacent.
  - `signature`: swapping two exercises with identical timings changes `stepsSig`.
  - Update Task 1 characterization tests: case A total becomes exactly 1800. Every other step duration matches the old output except at most the auto work steps adjusted by 1s.
- [ ] **Step 2: Run** `node --test tests/`. Expected: new tests FAIL.
- [ ] **Step 3: Implement `applyFit`.** The algorithm (the signature doesn't determine it):

```text
segs   = (warmup?.dur||0) + (cooldown?.dur||0)
T      = targetSec - ready - segs
named  = supersets with ≥1 named exercise; locked = named with lockTotal AND ≥1 unpinned named exercise
outer  = named - locked
r      = restRatios(d); P = restLocks || {}
counts over OUTER only:  Wu = Σ R·units(unpinned)   Wp = Σ R·units(e)·e.work (pinned)
                         Sw = Σ R·sides·SIDE_SWITCH  nE = restsOn ? Σ R(n-1) : 0   nR = Σ (R-1)
nB     = named.length - 1            (between-superset rests are always outer)
fixed  = Σ locked lockTotal + Wp + Sw + (P.ex??0)·nE + (P.rd??0)·nR + (P.bl??0)·nB
denom  = Wu + (P.ex==null ? r.ex·nE : 0) + (P.rd==null ? r.rd·nR : 0) + (P.bl==null ? r.bl·nB : 0)
u      = denom > 0 ? (T - fixed) / denom : 0
ex = P.ex ?? max(5, round(u·r.ex));  rd = P.rd ?? max(5, round(u·r.rd));  bl = P.bl ?? max(5, round(u·r.bl))
if Wu == 0: allSet = true; w = 0 (unused)
else: w = round((T - Σlocked - Wp - Sw - ex·nE - rd·nR - bl·nB) / Wu); if w < 10: w = 10, short = true
every superset: restEx = ex, restRound = rd;  outer supersets: work = w;  d.restBlock = bl
each locked b:  inner = lockTotal - (restsOn ? R(n-1)·ex : 0) - (R-1)·rd - R·sides·SW - Σ R·units·e.work(pinned in b)
                b.work = round(inner / (R·Σunits(unpinned in b))); if < 10: b.work = 10, short = true
                b.adj = lockTotal - blockTotal_without_adj(b)
d.fit.adj = short || allSet ? 0 : (T + segs + ready) - total_without_adj - Σ locked b.adj
```

- [ ] **Step 4: Implement `buildSteps`.** Emit the step shapes above. Use `exWork` per exercise. Then, per pool (`"o"` uses `d.fit.adj`, each locked `bid` uses `b.adj`), spread the adjustment by adding `sign(adj)` × 1s to auto work steps of that pool, walking from the last step backward, round-robin until it's used up. Never take a step below 1s.
- [ ] **Step 5: Update `counts`, `blockFixed`, `blockTotal`, `totalAll` and `stepsSig`** to match the interfaces. `counts` returns `nW` in units (sides count 2).
- [ ] **Step 6: Run** `node --test tests/`. Expected: PASS.
- [ ] **Step 7: Commit** `feat: fit with pinned exercises, supersets and rests; exact totals`.

### Task 4: Manual mode, fit fixes and fit summary

**Files:**
- Modify: `index.html`: timing region (`backCalcWork`), the `,total` change handler (~line 2240), `fitFixes`, `fitSummary`
- Test: `tests/timing.test.js`

**Interfaces:**
- Produces: `backCalcWork(b, d, totalSec) -> number`. Pinned exercises keep their time. Returns the unpinned work, at least 5, spread over R·units(unpinned). With no unpinned exercise, returns `b.work` unchanged.
- Produces: `fitFixes(o)` also lists up to two "Set {name} back to auto" buttons (`data-act="unpin"`, `data-b`, `data-e`, largest pins first) and "Set Superset {L} back to auto" (`data-act="unpin-blk"`). They appear when `o.fit.short` is true or `totalAll(o) > target + fitTol`.

- [ ] **Step 1: Failing tests:** `backCalcWork` on `[Squat, Plank{work:60}]` × 3, `restEx` 15, `restRound` 60, total 600 → `(600 - 3·15 - 2·60 - 3·60) / 3` rounded = 85. Fully pinned superset → returns the existing `b.work`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `backCalcWork` and use it in the `,total` change handler. Manual mode ignores `restLocks` and `lockTotal` (`applyFit` already returns early), so no other change is needed there.
- [ ] **Step 4: Update `fitSummary`.** When `o.fit.allSet`, show "All times are set by hand · {fmt(total)}". Add the unpin buttons to `fitFixes` and handle `unpin` (delete `e.work`) and `unpin-blk` (delete `b.lockTotal`) in the click switch, followed by `touch(o); render()`.
- [ ] **Step 5: Run** `node --test tests/`. Expected: PASS. **Manual check:** in timer mode, set fit off, type a Block time, and confirm a pinned exercise keeps its time.
- [ ] **Step 6: Commit** `feat: manual-mode block time respects pins; unpin fixes`.

### Task 5: Time editor sheet and time chips

**Files:**
- Modify: `index.html`: timing region (`parseSecs`), new `openTimeEditor`/`renderTimeEditor`, `viewBuilder` (exercise rows, superset header), `fitSummary` (rest chips), click and input handlers, CSS
- Create: `tests/model.test.js`

**Interfaces:**
- Produces: `parseSecs(v) -> number | null`. `"45"` → 45, `"1:30"` → 90, `"1:75"` → 135. `""`, `"abc"`, `"0"`, `"-5"` → `null`.
- Produces: `openTimeEditor(target)`, where target is `{ t: "ex", b, e }`, `{ t: "blk", b }`, `{ t: "rest", k: "ex" | "rd" | "bl" }` or `{ t: "seg", which: "warmup" | "cooldown" }`. It stores the target in `S.te` and renders through `openSheet`.
- Produces click actions: `te-step` (`data-d` ±5), `te-auto`, `te-side`, `te-up`, `te-down`, `te-rm`, `te-open` (opens from a chip with the target in `data-te` as JSON). Input `data-te-in` applies `parseSecs` on change.
- Consumes: `applyFit`, `blockTotal`, `exWork` (Tasks 2–3).

- [ ] **Step 1: Failing test** (`tests/model.test.js`): `parseSecs` cases from Review Focus 3. Add `parseSecs` to `EXPORTS`.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3:** implement `parseSecs` in the timing region. **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Build the sheet** per spec section 4:
  - Title, big current time, −5/+5, a text field, and "Back to auto" only when pinned.
  - A preview line computed by cloning `cur()`, applying the pending value and running `applyFit`. Format: "The other {n} exercises go to {w}s each." For rests: "Work goes to {w}s."
  - For `t: "ex"`, also show the each-side toggle, Move up/down (wired in Task 9; hide until then) and Remove.
  - Floors: work 10, rest 5, segment 60. Values below the floor clamp to it.
  - Pinning an exercise sets `e.work`. Pinning a superset sets `b.lockTotal` (fit on) or calls `backCalcWork` (fit off). Pinning a rest sets `o.restLocks[k]`.
  - If a pin leaves a `lockTotal` superset with no unpinned exercise, delete `lockTotal` and `toast("Superset {L} total now comes from its exercises")`. The toast becomes undoable in Task 8.
  - Every change runs `touch(o)`, `updTimerUI()` and re-renders the sheet.
- [ ] **Step 6: Add chips.**
  - Exercise rows in `viewBuilder` (timer mode only): a right-aligned chip `sx(exWork(e,b))`, `.chip.auto` when unpinned, `.chip.pin` with a lock icon when pinned.
  - Superset header: a total chip using `fmt(blockTotal)`.
  - `fitSummary`: each rest value becomes a chip, pinned ones show the lock.
  - All chips use `data-act="te-open"`. Add `IC.lock` (16px padlock SVG via `svgI`).
- [ ] **Step 7: Run** `node --test tests/`. Expected: PASS (parse test included). **Manual check** (`open index.html`, timer mode, 30 min):
  - Pin one exercise to 60s → the others shrink and the total stays 30:00.
  - "Back to auto" restores the previous times.
  - Pin "switch" to 10s → the transitions show 10s.
- [ ] **Step 8: Commit** `feat: time editor sheet with exercise, superset and rest pins`.

### Task 6: Work/rest slider

**Files:**
- Modify: `index.html`: the Timing options block in `viewBuilder` (~line 980), the `data-bind` input handler, CSS

**Interfaces:**
- Consumes: `restRatios` (Task 2), rest chips (Task 5).

- [ ] **Step 1: Replace the three `bal` buttons** with `<input type="range" min="0.4" max="2" step="0.1" data-bind="restScale">`.
  - Its starting value is `restScale`, or the legacy mapping (`work` 0.6, `even` 1, `rest` 1.5) when that's missing.
  - End labels "More work" / "More rest", and a tick labeled "Balanced" at 1.0.
  - Beneath it, a live line of rest chips: "{w}s work · {ex}s switch · {rd}s between rounds · {bl}s between supersets" (from Task 5's chip renderer).
- [ ] **Step 2: Input handler.** `restScale` stores `num(t.value)`, then `touch(o)`, `updTimerUI()` and refreshes the live line in place without a full `render()`, so the slider keeps focus while dragging. Remove the `bal` click case.
- [ ] **Step 3: Run** `node --test tests/`. Expected: PASS. **Manual check:**
  - Moving the slider updates times live, and the total stays exact.
  - A pinned rest doesn't move.
  - An old saved plan opens showing its old times until the slider is touched.
- [ ] **Step 4: Commit** `feat: continuous work/rest slider`.

---

## Stage 3: Timeline

### Task 7: Timeline tap-to-select

**Files:**
- Modify: `index.html`: `timeline()`, new `tlPick(x)`, `pointerdown`/`pointermove` listeners on `#tl`, selection strip under the timeline, CSS

**Interfaces:**
- Consumes: `buildSteps` step fields `bid`, `eid`, `sub` (Task 3), `openTimeEditor` (Task 5).
- Produces: `S.tlSel`, which is `null`, `{ t: "ex", b, e }`, `{ t: "rest", k }` (step `sub` `switch` → `ex`, `round` → `rd`, `block` → `bl`) or `{ t: "seg", which }`.

- [ ] **Step 1: Tag segments.** Each `<i>` in `timeline()` gets `data-si`. Segments matching `S.tlSel` get class `sel`. CSS: non-selected segments dim to 35% when a selection exists.
- [ ] **Step 2: Pointer selection.** On `pointerdown`/`pointermove` (with `setPointerCapture`) over `#tl`, map the x position to a step index using the cumulative `flex` widths, set `S.tlSel` and update classes plus the strip in place (no full render).
  - Ready and side-switch steps don't select.
  - CSS `#tl { touch-action: pan-y }` so a vertical scroll still works.
- [ ] **Step 3: Strip.** One line under the timeline: "Plank · 45s × 3 rounds", "Switch · 15s × 8" or "Warm-up · 5:00". It's a button with `data-act="te-open"` and the target. It's hidden when nothing is selected. Clear `S.tlSel` when the workout's structure changes.
- [ ] **Step 4: Run** `node --test tests/`. Expected: PASS. **Manual check** on a phone-width window: slide across the timeline and the selection follows the finger. Tapping the strip opens the editor for that exercise.
- [ ] **Step 5: Commit** `feat: select timeline segments to edit their time`.

---

## Stage 4: Undo and reordering

### Task 8: Undo

**Files:**
- Modify: `index.html`: `toast`, `#toast` CSS, new `snapUndo`/`doUndo`, the `rm-ex`, `rm-block`, `clear`, `doFill`, `te-auto` and unpin paths

**Interfaces:**
- Produces: `snapUndo(msg)` stores `S.undo = { plan: isPlan(cur()), obj: clone(cur()), at: Date.now() }` and calls `toast(msg, true)`.
- Produces: `toast(msg, undoable)`. When `undoable`, it renders `msg` plus `<button data-act="undo">Undo</button>`, the toast gets `pointer-events: auto`, and it stays for 6000ms (otherwise 2600ms, as today).
- Produces: `doUndo()` restores `S.undo.obj` into `S.draft` (via `normDraft`) or `S.edit.obj`, then `touch()`s, `render()`s and clears `S.undo`. Ignored after 6.5s.
- Consumed by Tasks 9, 10.

- [ ] **Step 1: Implement** `toast` / `snapUndo` / `doUndo` and the `undo` click case.
- [ ] **Step 2: Call `snapUndo` before** each of these, with messages "Exercise removed", "Superset removed", "Cleared", "Shuffled", "Back to auto" and "Superset {L} total now comes from its exercises":
  - `rm-ex` and `rm-block` (keep the existing `rm-block` confirmation if there is one);
  - `clear` (inside its existing confirmation callback);
  - `doFill`;
  - `te-auto`, `unpin` and `unpin-blk`;
  - the `lockTotal` auto-clear in Task 5.
- [ ] **Step 3: Pins when exercises are replaced** (spec section 2). `doFill` deletes `work` and `side` on each row it renames. `pickName` (the picker swap) keeps them.
- [ ] **Step 4: Run** `node --test tests/`. Expected: PASS. **Manual check:**
  - Remove an exercise with weights typed in → Undo brings back the exercise and its weights.
  - Shuffle → Undo restores the names and pins.
- [ ] **Step 5: Commit** `feat: undo for remove, clear, shuffle and unpin`.

### Task 9: Move operations and Move up/down

**Files:**
- Modify: `index.html`: new `@testable` region holding `moveExercise` and `moveBlock` (near the model section; they must not call `settings()`), time editor `te-up`/`te-down`
- Test: `tests/model.test.js`

**Interfaces:**
- Produces: `moveExercise(o, from, to) -> void`.
  - `from = { b, e }`, `to = { b, e }`, where `to.e` is the insertion index *after* removing from the source. `to.b === o.blocks.length` means "new superset".
  - Mutates `o`. The exercise object moves whole (`id`, `sets`, `work`, `side`).
  - A new superset copies `rounds`/`work`/`restEx`/`restRound` from the source superset and gets a fresh `id` (`uid()`).
  - If the source superset ends up with zero exercises, it's removed (adjust `to.b` when the removed index is below it).
- Produces: `moveBlock(o, from, to) -> void`, which reorders `o.blocks`.
- Consumed by Task 10.

- [ ] **Step 1: Failing tests:**
  - Within a superset: `[A, B, C]`, move 0 → 2 gives `[B, C, A]`.
  - Across supersets: the exercise keeps its `id`, `sets` (all of them, even when the target has fewer rounds), `work` and `side`.
  - Moving the last exercise out removes the empty superset and the target index is still right.
  - Dropping at `blocks.length` creates a superset with the source's rounds.
  - `moveBlock` 0 → 2 on 3 supersets.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3:** implement both and add them to `EXPORTS`. **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Move up/down in the editor.**
  - `te-up`/`te-down` call `snapUndo("Moved")` and then `moveExercise`.
  - Moving the first exercise of a superset up places it at the end of the previous superset. Moving the last one down places it at the start of the next superset. The buttons are disabled at the very top and bottom.
  - `S.te` follows the moved exercise, and the sheet re-renders.
  - Unhide the buttons that Task 5 hid.
- [ ] **Step 6: Commit** `feat: move exercises and supersets, with move up/down`.

### Task 10: Drag and drop

**Files:**
- Modify: `index.html`: drag handles in `viewBuilder`, new `dragStart`/`dragMove`/`dragEnd`, `render()` and `softRender()` guard, CSS

**Interfaces:**
- Consumes: `moveExercise`, `moveBlock` (Task 9), `snapUndo` (Task 8), `buzz`.
- Produces: `S.drag`, which is `null` or `{ kind: "ex" | "blk", from, ghost, placeholder, pointerId, startY, active }`.

- [ ] **Step 1: Handles.**
  - Exercise rows get a `⋮⋮` handle (`data-drag="ex" data-b data-e`) at the left of `.exn`.
  - The superset letter badge gets `data-drag="blk" data-b`.
  - CSS for handles: `touch-action: none; cursor: grab`, at least a 32px touch target.
- [ ] **Step 2: Pointer handling.**
  - `pointerdown` on `[data-drag]` records the start position and calls `setPointerCapture`.
  - The drag activates after 6px of movement: `buzz(15)`, clone the row as a fixed-position ghost, and replace the original with a same-height placeholder.
  - `pointermove` moves the ghost. It finds the insertion point from the midpoints of the `.ex` rows (for exercises) or superset `.card`s (for supersets), and moves the placeholder there. The "+ Add superset" button is a drop zone meaning `to.b = blocks.length`.
  - Auto-scroll with `requestAnimationFrame` when the pointer is within 60px of the viewport's top or bottom edge.
  - `pointerup` runs `snapUndo("Moved")`, `moveExercise`/`moveBlock`, `touch(o)` and `render()`. `pointercancel` and Escape abort and restore the row.
- [ ] **Step 3: Guard redraws.** While `S.drag?.active`, `render()` and `softRender()` set `S.renderPending = true` and return. `dragEnd` renders once if something was pending. Sync updates can arrive mid-drag, so this matters.
- [ ] **Step 4: Run** `node --test tests/`. Expected: PASS. **Manual check** (phone-width window with touch emulation, and the real iPhone after deploy):
  - Scrolling by swiping on exercise names doesn't start a drag.
  - Dragging a handle reorders the exercise.
  - Dragging to another superset keeps typed weights.
  - Dragging onto "+ Add superset" creates a new superset.
  - Undo reverses the move.
- [ ] **Step 5: Commit** `feat: drag and drop exercises and supersets`.

---

## Stage 5: Live timer

### Task 11: ±15s on the current interval

**Files:**
- Modify: `index.html`: timing region (`applyAdj`), `T` state, `startTimer`, `saveResume`, `drawTimer`, click cases `t-plus`/`t-minus`
- Test: `tests/timing.test.js`

**Interfaces:**
- Produces: `applyAdj(steps, adj) -> steps` (new array). `adj` is `{ [stepIndex]: seconds }`. Each step's `dur` becomes `max(1, dur + adj[i])`.
- `T.adj` holds the session's adjustments. The resume record gains `adj`. `T.sig` stays the *unadjusted* signature, so `resumeOK`'s comparison is unchanged.

- [ ] **Step 1: Failing tests** (Review Focus 5):
  - `applyAdj` adds and floors at 1.
  - `stepsSig(buildSteps(d))` is equal before and after `applyAdj` is used for display (the signature is computed from base steps).
  - A reordered workout's signature differs (already covered in Task 3; reference it, don't duplicate).
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3:** implement `applyAdj` and export it. **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Wire the timer.**
  - `startTimer` applies `r.adj` when resuming.
  - `t-plus` adds 15 to `T.adj[T.i]`, `T.steps[T.i].dur`, `T.endAt` (or `T.remaining` when paused) and saves.
  - `t-minus` takes off up to 15, leaving at least 1s remaining. If there's 1s or less left, it calls `gotoStep(T.i + 1)`.
  - Reset `T.cueKey` so the 3-2-1 cues fire correctly after an adjustment.
  - `saveResume` stores `adj`.
  - The buttons (`−15` / `+15`) sit either side of `#tnum` and only show while the timer is running.
- [ ] **Step 6: Manual check:**
  - +15 during a rest extends it, and "left" grows by 15.
  - −15 near the end skips ahead.
  - Leave → Resume keeps the adjustment.
- [ ] **Step 7: Commit** `feat: add or remove 15 seconds on the live interval`.

### Task 12: Each-side exercises in the UI and cues

**Files:**
- Modify: `index.html`: time editor (`te-side`), exercise row label, `phaseInfo`, `cue`, `drawTimer`, `exName` callers

**Interfaces:**
- Consumes: `side` steps from Task 3.

- [ ] **Step 1: The `te-side` toggle** flips `e.side` (`true` / deleted), then `touch` and re-render. The exercise row shows a small "each side" tag.
- [ ] **Step 2: Timer.**
  - A work step with `side` shows "{name} · side {n}".
  - A `sub: "side"` rest shows the label "Switch sides". Its cue is the rest sound, `buzz([80,60,80])` and `say("Switch sides")`.
  - The "Up next" logic treats side 2 as the same exercise, so it doesn't announce "Next, Lunge" between the halves.
- [ ] **Step 3: Run** `node --test tests/`. Expected: PASS. **Manual check:** an each-side exercise runs side 1 → 5s switch → side 2. A pinned 30s means 30s per side.
- [ ] **Step 4: Commit** `feat: each-side exercises`.

### Task 13: Warm-up and cool-down

**Files:**
- Modify: `index.html`: `viewBuilder` (add/remove rows, timer mode only), time editor `t: "seg"`, `phaseInfo`, `cue`, `drawTimer`, `finishWorkout`, `viewHistory`, `planFromObj`

**Interfaces:**
- Consumes: `d.warmup` / `d.cooldown` and `seg` steps (Tasks 2–3).

- [ ] **Step 1: Builder** (timer mode only):
  - "+ Add warm-up" above the first superset card and "+ Add cool-down" below the last. Each creates `{ name: "Warm-up" | "Cool-down", dur: 300 }`.
  - Once added, it shows as a slim card with an editable name field (`data-bind` path `warmup.name` / `cooldown.name`, handled in the input handler), a time chip (opens `te-open` with `t: "seg"`) and a remove button (undoable).
  - Hidden in reps mode, but the data is kept.
- [ ] **Step 2: Timer.**
  - A `seg` step shows the segment name in large type with the label "Warm-up" / "Cool-down", in the rest colors.
  - Its cue is the rest sound plus `say(name)`. Fix the places that assume a non-work step is followed by a work step:
    - `phaseInfo` returns `{ label, sub: "" }` for `seg`;
    - `drawTimer` shows "Up next: {first exercise}" during a warm-up and "Last stretch" style text during the cool-down.
- [ ] **Step 3: Logging.**
  - `finishWorkout` saves `warmup`/`cooldown` (timer mode only) on the logged workout.
  - `viewHistory` prints "Warm-up · 5:00" / "Cool-down · 5:00" lines.
  - `planFromObj` saves them (already in Task 2's field list; verify).
- [ ] **Step 4: Run** `node --test tests/`. Expected: PASS. **Manual check:**
  - A 30-minute workout with a 5-minute warm-up runs 5:00 of warm-up, then the supersets, and totals 30:00.
  - Logging shows the warm-up in History.
- [ ] **Step 5: Commit** `feat: warm-up and cool-down segments`.

---

## Stage 6: Weight hints

### Task 14: Weight-increase suggestion

**Files:**
- Modify: `index.html`: testable `suggestWeight`, the "Last time" hint in `viewBuilder` (~line 1013) and the post-workout log (`doneLog`), Settings (new numeric field), `DEF`
- Test: `tests/model.test.js`

**Interfaces:**
- Produces: `suggestWeight(sessions, step) -> string | null`.
  - `sessions` is a newest-first array of `{ sets: [{ w, r }] }`, the shape stored in `S.lastIdx`.
  - It returns `String(top + step)`, trimmed of trailing zeros, when the two newest sessions have the same top weight (> 0, the max `num(w)` across their sets) and either both have reps logged with total reps in the newest ≥ the previous, or neither has reps logged.
  - Otherwise it returns `null`. A mix of reps and no reps also returns `null`.
- `DEF.wtStep = null`. The effective step is `settings().wtStep ?? (unit === "kg" ? 2.5 : 5)`.

- [ ] **Step 1: Failing tests:**
  - `[25×10, 25×10]` → `"30"`.
  - `[25×12, 25×10]` → `"30"`.
  - `[25×8, 25×10]` → `null`.
  - `[25, 22.5]` → `null`.
  - With step 2.5: `[25, 25]` (no reps) → `"27.5"`.
  - `[25×10, 25]` (mixed) → `null`.
  - Only one session → `null`.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3:** implement and export. **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Show it.**
  - Append " · try {x}" to the "Last time (…)" hint line in the builder and to the post-workout log row label, when `suggestWeight` returns a value.
  - Placeholders stay as last time's weight, and nothing gets auto-filled.
  - Add a "Weight step" field in Settings next to the unit.
- [ ] **Step 6: Commit** `feat: suggest a weight increase from history`.

---

## Stage 7: Experiment

### Task 15: Lock-screen audio experiment

**Files:**
- Modify: `index.html`: `DEF.bgAudio = false`, Settings toggle "Keep sounds playing when locked (experimental)", `startTimer` / `togglePause` / `finishTimer` / `closeTimer`, `cue`
- Modify (only if the experiment succeeds): `README.txt`, the spec's section 12

**Interfaces:**
- Produces: `bgAudioOn()` / `bgAudioOff()`.
  - Turning it on creates (once) an `<audio loop playsinline>` whose `src` is a Blob URL of a 1-second silent 8kHz mono WAV, built in code. It plays it and sets `navigator.mediaSession.metadata = new MediaMetadata({ title: exName, artist: "Tempo" })`.
  - It's called from `startTimer` (inside the user's tap) when `settings().bgAudio` is on, and turned off in `finishTimer` / `closeTimer`.
  - `cue()` updates the metadata title on each step.

- [ ] **Step 1: Implement** behind the setting, off by default.
- [ ] **Step 2: Run** `node --test tests/`. Expected: PASS. **Commit** `feat: experimental keep-sounds-playing-when-locked setting`.
- [ ] **Step 3: Hand off to the user** (only they can run this). The test:
  1. Deploy.
  2. On the installed iPhone app, turn the setting on.
  3. Start a 30-minute workout and lock the phone.
  4. Note whether every cue plays through to the end, and whether the lock screen shows the exercise.
- [ ] **Step 4: Follow up on the result.**
  - If it works: default the setting to on, drop "(experimental)", and update README "Good to know".
  - If it doesn't: remove the code. Either way, record what happened in spec section 12.
  - Commit.
