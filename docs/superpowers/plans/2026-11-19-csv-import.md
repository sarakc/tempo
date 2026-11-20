# CSV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import interval-timer CSV files as Tempo workouts that play exactly as written, with each step's cue shown on screen.

**Architecture:** Everything lives in `index.html`. The pure parsing and conversion code, and the `cue` field in `normExercise`/`planExercise`, go in the `/* @testable */` region, so `tests/load.js` can run them under `node --test`. The UI wiring (Import button, cue field, cue on the timer) is checked in headless Chrome.

**Tech Stack:** Vanilla HTML/CSS/JS with no build step. Tests use `node --test` (Node 24) with the existing `tests/load.js` vm loader.

**Spec:** `docs/superpowers/specs/2026-11-19-csv-import-design.md`

## Global Constraints
- **Test command:** `node --test` from the repo root (not `node --test tests/`). The baseline is 49 passing.
- **No dependencies:** no CSV library. The parser is hand-written.
- **Imported workout settings:** `mode:"timer"`, `autoFit:false`, `restsOn:false`, `ready:0`, `restBlock:0`, `targetMin: total/60`. Each block gets `rounds:1`, `restEx:0`, `restRound:0`. Every exercise is pinned (`work` = its seconds).
- **Cue:** a trimmed string of at most 300 characters. It is omitted when empty.
- **Existing behavior stays as it is:** fitting, playing and saving of workouts without cues are unchanged, and all 49 existing tests stay green.
- **Copy:** button "Import". Toasts: "Imported 1 workout" or "Imported N workouts", with " · K rows skipped" appended when K > 0. Errors: "No workouts found in that file" and "That CSV needs a name column (Interval, Exercise or Name) and a seconds column (Duration (s), Seconds or Duration)".

## Review Focus
- **CSV from Excel or Google Sheets:** files with a UTF-8 BOM, CRLF line endings, a trailing blank line, or quoted cells that hold commas, `""` or line breaks parse correctly. (Task 1 tests.)
- **Total runtime:** an imported routine's total from `buildSteps` must equal the file's sum of seconds for every example file. This catches any default ready countdown, rest or fitting that leaks in. (Task 1 test.)
- **Editing an imported workout keeps it exact:** opening the editor must not turn on fitting or rests. Duplicating keeps the cues. (Task 3 browser check.)
- **Swapping an exercise in the picker** must not keep the old cue. (Task 2 test via `normExercise`, plus a Task 4 browser check.)
- **A long cue on a phone-width timer** must wrap, not overflow. (Task 4 browser check at 390px.)

---

### Task 1: The CSV parser and routine converter

**Files:**
- Modify: `index.html`, adding to the `/* @testable */` region just before `/* @end-testable */`
- Modify: `tests/load.js` (EXPORTS gains `parseCSV`, `routinesFromCSV`)
- Create: `tests/csv.test.js`
- Add: `examples/interval-timer-routines/*.csv` (already moved here; commit them)

**Interfaces:**
- Produces:
  - `parseCSV(text: string) -> string[][]`: RFC 4180 rows. It strips a BOM, accepts CRLF and LF, and handles quoted fields with `,`, `""` and newlines. Fully blank lines are dropped.
  - `routinesFromCSV(text: string, fileName: string) -> { plans: Plan[], skipped: number, error: null | "columns" | "empty" }`
    - `Plan` is `{ name, mode:"timer", autoFit:false, restsOn:false, ready:0, restBlock:0, targetMin, balance:"even", restLocks:{}, blocks:[{ rounds:1, work:45, restEx:0, restRound:0, exercises:[{ name, work, cue? }] }] }`. This shape is ready for `planFromObj`.
    - Columns, routine splitting, block splitting and the file-name fallback follow the spec's "The file format" section.

- [ ] **Step 1: Write `tests/csv.test.js`**, using `loadTempo()` from `./load.js`:
  - `parseCSV('﻿a,b\r\n"x, y","he said ""hi"""\r\n"multi\nline",2\r\n\r\n')` gives `[["a","b"],["x, y",'he said "hi"'],["multi\nline","2"]]`.
  - A minimal file `Interval,Duration (s),Cue\nPlank,30,Brace\nRest,10,\n` with fileName `"03-core-blast.csv"` gives one plan named `"core-blast"`, one block, and exercises `[{name:"Plank",work:30,cue:"Brace"},{name:"Rest",work:10}]`. The second has no `cue` key. `targetMin` is `40/60`.
  - `Duration` as `1:30` gives `work: 90`. A row with a blank name or `abc` seconds is skipped, so `skipped === 2` for two such rows.
  - Headers with odd case and spaces (`" interval ", "SECONDS"`) are recognized.
  - With no name or seconds column, the result is `error === "columns"` and `plans.length === 0`. A header-only file gives `error === "empty"`.
  - A Block column with `A,A,B,A` gives 3 supersets, of sizes 2, 1 and 1.
  - **Examples:** for each file in `examples/interval-timer-routines/` except `all-routines.csv`, there is exactly one plan. Its name equals the file's `Routine` value. The number of exercises equals the number of rows. `totalAll(toTimer(plan))` equals the file's summed `Duration (s)`, where `toTimer(p)` is `{ ...p, blocks: p.blocks.map(b => ({ ...b, id: "b"+i, exercises: b.exercises.map((e, j) => ({ ...e, id: "e"+j, sets: [] })) })) }`. Add `totalAll` to EXPORTS if it isn't there (it is).
  - `all-routines.csv` gives 10 plans in file order. The first is named `"Pump and unwind (5 min)"` and lasts 300 s. `Full sequence (45 min)` has 6 supersets and lasts 2700 s.
- [ ] **Step 2: Run** `node --test`. Expected: the new tests fail with `parseCSV is not defined`. The 49 existing tests still pass.
- [ ] **Step 3: Implement** `parseCSV` (a character-level state machine) and `routinesFromCSV`. Reuse `parseSecs` for `m:ss` and plain seconds.
- [ ] **Step 4: Run** `node --test`. Expected: all pass.
- [ ] **Step 5: Commit** `git add examples tests index.html && git commit -m "feat: parse interval-timer CSV files into workouts"`

### Task 2: The `cue` field on exercises

**Files:** Modify `index.html` (`normExercise`, `planExercise`, the picker swap near `slots.forEach((e, i) => { if (picks[i] …` which deletes `work`/`side`, and the `finishWorkout` exercise mapping only if the history should keep cues; it shouldn't), plus `tests/model.test.js`

**Interfaces:**
- Produces: `normExercise(e).cue` and `planExercise(e).cue`. Each is present only when it's a non-empty trimmed string, cut to 300 characters.

- [ ] **Step 1: Add tests to `tests/model.test.js`:**
  - `normExercise({name:"A", cue:"  Brace  "}).cue === "Brace"`
  - `planExercise({name:"A", cue:""})` has no `cue` key
  - a 400-character cue is cut to 300
  - `normExercise("Plank")` has no cue
- [ ] **Step 2: Run** `node --test`. Expected: the new tests fail.
- [ ] **Step 3: Implement.** Carry `cue` in both functions. In the picker swap, add `delete e.cue`.
- [ ] **Step 4: Run** `node --test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: exercises can carry a cue`

### Task 3: The Import button

**Files:** Modify `index.html`: `viewPlans()` header (next to `new-t`), a hidden `<input type="file" id="import-file" accept=".csv,text/csv">` rendered in `viewPlans`, the `data-act` switch (`case "import"`), and the `change` handler next to `restore-file`.

**Interfaces:** Consumes `routinesFromCSV`, `planFromObj(o, name)` and `createPlan(p, open)`.

- [ ] **Step 1: Write a browser check** (headless Chrome via DevTools; set the input's files with `DOM.setFileInputFiles`). Run it and watch it fail:
  - Importing `examples/interval-timer-routines/03-quick-strength-5-min.csv` opens the editor on "Quick strength (5 min)", with 12 exercises, a total of 5:00 and fitting off.
  - Importing `all-routines.csv` shows "Imported 10 workouts" and adds 10 rows to the list.
  - Importing a `.csv` with no usable columns shows the columns error and adds nothing.
  - Duplicate the imported workout: the copy also totals 5:00.
  - Start it: the first step is the first row (no 10-second get-ready countdown).
- [ ] **Step 2: Implement.**
  - Add a secondary `btn sm` "Import" before "New".
  - On change, `await file.text()`, then call `routinesFromCSV(text, file.name)`.
  - For each plan, call `createPlan(planFromObj(Object.assign(plan, { folder }), plan.name), plans.length === 1)`, where `folder` follows `new-t`'s rule.
  - Show the toast per Global Constraints, then reset the input's `value` so the same file can be chosen again.
- [ ] **Step 3: Run** the browser check and `node --test`. Expected: all pass.
- [ ] **Step 4: Commit** `feat: import CSV files as workouts`

### Task 4: Showing and editing cues

**Files:** Modify `index.html`:
- the exercise row in the editor (the `<div class="ex"><div class="exn">…` template): add a muted `.excue` line
- `renderTimeEditor`: for `t.t === "ex"`, add a `<label class="fld"><span>Cue</span><textarea class="in" rows="2" data-te-cue maxlength="300">` field
- the input handler next to `"teIn" in t.dataset`: set or delete `o.blocks[S.te.b].exercises[S.te.e].cue` and call `touch(o)`
- the timer body: on a work step, add `<div class="tcue">${esc(cue)}</div>` after `tname2`, using the cue of `S.draft.blocks[tgt.b].exercises[tgt.e]`
- CSS for `.excue` and `.tcue`, wrapping long words with `overflow-wrap:anywhere`

- [ ] **Step 1: Write a browser check** and watch it fail:
  - The imported "Pump and unwind (5 min)" shows its first cue under "360 breathing (standing)" in the editor.
  - Edit the cue in the sheet. It saves, and still shows after a reload.
  - Start the workout: the timer shows the cue during the first step.
  - Swap an exercise in the picker: the cue line disappears.
  - At 390px with a 300-character cue: no horizontal overflow on the timer.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** the browser check and `node --test`. Expected: all pass.
- [ ] **Step 4: Commit** `feat: show and edit exercise cues`. Also mark the TODO.md Tempo item about porting workout-app's CSV import as decided ("CSV import built 2026-11-19; the spreadsheet templates aren't ported").
