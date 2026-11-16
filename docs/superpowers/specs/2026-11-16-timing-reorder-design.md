# Tempo: flexible timing, reordering and workout-timer upgrades

Date: 2026-11-16
Status: draft for review

## Why

Fixed-length timer mode ("fit to 30 min") works today, but only on the whole workout. Every
exercise gets the same work time, and the work/rest split is one of three presets. I want to
shape a workout inside the fixed length: give a hard exercise more time, keep a superset at a
set length, choose exactly how much rest I get, and let the app spread whatever time is left
evenly over everything else. I also want to rearrange exercises and supersets by dragging
instead of deleting and re-adding them.

While I'm in this code: a few smaller upgrades to the live timer and the builder that came out
of reviewing the app.

## Goals

1. Set the time of any single exercise, or the total time of any superset, inside fit mode.
   Everything I haven't set re-spreads evenly so the workout still lands on the target length.
2. Replace the three work/rest presets with a continuous control, and let me pin any rest
   length (transition, between rounds, between supersets) to an exact number of seconds.
3. Drag and drop exercises within a superset, between supersets, and reorder whole supersets.
4. Undo for removing, clearing, shuffling, moving and resetting.
5. In the live timer: +15s / −15s on the current interval.
6. "Each side" exercises that split into two halves with a switch-sides cue.
7. Warm-up and cool-down segments.
8. Tap a segment of the timeline preview to select and adjust that exercise or rest.
9. Gentle weight-increase suggestions based on history.
10. Automated tests for the timing math, written before the timing changes.
11. A short experiment to see whether sounds can keep playing with the phone locked.

## Non-goals

- Different times for individual rounds within a superset. For a longer burnout round, add a
  one-round superset with a fixed total time instead.
- New workout formats (EMOM, AMRAP, Tabata presets).
- Changing focus, meditation or alarm modes.
- Changing sync, backup or the storage format beyond the new optional fields below.
- A build step, framework, or third-party libraries.
- Redesigning the look of the app. New controls follow the existing cards, chips, steppers
  and bottom sheets.

## Anti-goals (would count as failure even if it technically works)

- The total quietly drifting away from the target as I make edits.
- Times I've set by hand that I can't see at a glance, or can't easily set back to automatic.
- Dragging that fights with scrolling on the phone, or starts by accident.
- Losing weights I've already typed in when I move an exercise.
- Breaking existing saved workouts, logged history, or a paused workout I'm resuming.

## Constraints

- The whole app is `index.html` plus `sw.js`, hosted on GitHub Pages; pushing to `main` deploys.
  No build step.
- Phone first (iPhone, installed to the home screen), touch only. Must also work with a mouse
  and keyboard on a computer.
- Works offline. `sw.js` serves everything except the page itself cache-first, so any new
  separate file would be served stale until the cache name is bumped. Keep the app code in
  `index.html`.
- Data syncs between devices record by record. Another device may briefly run the old version.
  Old versions already read exercises written as `{ name }` objects (`draftFrom` handles both
  strings and objects). They would drop the new fields if they edit and save a workout. That's
  acceptable.

## How it works today (relevant parts)

- `applyFit(d)` (`index.html` ~line 627) computes one unit `u` from the target length and the
  `BAL` ratio, then writes the same `work`, `restEx` and `restRound` to every superset, plus one
  `restBlock`. Exercises have no time of their own.
- Fit mode off (`autoFit: false`) means every superset's work, transition, round rest and total
  are typed by hand. The total field back-calculates work.
- `buildSteps(d)` turns the workout into a flat list of steps (`ready`, `work`, rest `switch`,
  `round`, `block`). The live timer reads exercise names from the draft by superset and
  exercise index.
- Resuming a paused workout matches `stepsSig(steps)`, which is only each step's kind and
  duration. Reordering exercises with the same timings would resume on the wrong exercise.
- Saved workouts (`planFromObj`) store exercises as plain name strings. Logged workouts store
  `{ name, sets }` per exercise and `work`/`restEx`/`restRound` per superset.
- The pop-up message (`toast`) ignores taps (`pointer-events: none`), so it can't carry a button.
- Nothing in the code handles reordering, drag and drop, or undo yet.

## Approaches considered

**Timing model**
- A. *Locks plus even redistribution* (chosen). Any exercise time, superset total or rest
  length can be pinned. Pinned time comes off the target first, and the rest is split evenly
  over everything not pinned. It matches what I asked for: "the others re-distribute the rest
  of the time evenly."
- B. *Relative weights* ("this exercise counts 1.5×"). Flexible, but you can't say "60 seconds"
  directly, and the numbers shift every time anything changes.
- C. *Everything manual with a remaining-time readout.* Fit mode off already does most of this.
  It doesn't do the redistribution, which is the point.

**Work/rest control**
- A. *A slider that scales all rests together, plus pins for exact rest lengths* (chosen). The
  slider covers "more or less rest overall," and pins cover "I always want 10 seconds to switch."
- B. *Separate sliders for each rest type.* Four controls for something that's usually set once.

**Drag and drop**
- A. *Hand-written touch/pointer handling with a grab handle* (chosen, builder's call to
  confirm). The browser's built-in drag and drop doesn't work with touch on iOS. The app has no
  dependencies and redraws its lists from scratch on every change, which fits a small custom
  implementation well.
- B. *A library such as SortableJS, copied into the repo.* Handles touch and moving between
  lists well, but adds a dependency and a file the offline cache would serve stale, and it
  rearranges the page itself, which clashes with the app's full redraws.

**Tests**
- A. *Keep the timing math in `index.html` between marker comments. A Node test script extracts
  that section and runs it* (chosen). Keeps the single-file app and avoids the stale-cache trap.
  Node 24 is installed, so `node --test` works with no dependencies.
- B. *Move the math into `timing.js`.* Cleaner to test, but every change then needs a cache
  name bump in `sw.js` or phones keep the old math.

## The design

### 1. Data model additions (all optional, all back-compatible)

Exercise (in the draft, saved workouts and logged workouts):
- `id`: stable id (same `uid()` used for supersets). Added on load if missing.
- `work`: number of seconds, or absent. Present means this exercise's work time is pinned. It
  applies to every round.
- `side`: `true` if it's an "each side" exercise.

Superset:
- `lockTotal`: seconds, or absent. Present means the superset's total time is pinned.
- `kind`: absent for a normal superset, or `"warmup"` / `"cooldown"` (section 7).

Workout (draft, saved, logged):
- `restScale`: number, replaces `balance` (section 3). `balance` is still read when
  `restScale` is missing: `work` → 0.6, `even` → 1, `rest` → 1.5.
- `restLocks`: `{ ex?, rd?, bl? }` seconds. Each present key pins that rest type.

Saved workouts store exercises as `{ name, work?, side? }` objects instead of strings. Logged
workouts add `work` and `side` to each exercise and `lockTotal` to each superset. History shows
them but doesn't need to act on them.

### 2. The fit calculation

When fit mode is on, in this order:

1. **Available time** = target − get-ready − warm-up/cool-down segments.
2. **Rest lengths.** Take pinned supersets and pinned exercises out of the available time
   *first*, and leave them out of the interval counts. Then work out the unit `u` from what's
   left, as today, with each rest ratio multiplied by `restScale`. Then replace any rest type
   that has a pin with its pinned value (and take pinned rests out before `u` too). The result:
   when I pin something longer, unpinned work and unpinned rests shrink together, and the
   work/rest balance I chose holds. Minimum 5s per rest, as today. *(Builder's call, confirmed
   in review.)*
3. **Pinned supersets.** For each superset with `lockTotal`: its inside time = `lockTotal` − its
   own rests. Take off its pinned exercises (× rounds, × 2 if each-side). Split what's left
   evenly over its unpinned exercises. Its total is fixed, so it comes off the available time.
4. **Everything else.** From the remaining time, take off all rests outside pinned supersets
   and all pinned exercises outside pinned supersets. Split what's left evenly over every
   remaining unpinned work interval. Minimum 10s, as today.
5. **Rounding.** Work times are whole seconds, so the sum can miss the target by a few seconds.
   The leftover (positive or negative) goes onto the **last work interval of the workout**, so
   the total equals the target exactly. Store this as a step-level adjustment in `buildSteps`,
   not as a pin. (Builder may choose a different spot if this feels wrong in use. The
   requirement is that the total equals the target.)
6. **Doesn't fit.** If pins leave less than the minimum for unpinned intervals, or the pins
   alone exceed the target: show the existing "Too much to fit" warning. Its fix buttons gain
   "Set [name] back to auto" for the largest pins, next to "Make it N min" and "Use N rounds."

Pins survive changing the target length, rounds or the work/rest slider. Unpinned times re-fit.
If a pinned superset changes round count, its total stays and its intervals shrink or grow.

In fit-off (manual) mode, superset fields work as they do today. Pinned exercise times still
apply (an exercise with `work` uses it instead of the superset's work), so a 60s plank stays
60s in either mode. Specifically *(builder's calls)*:
- The superset total chip drives the existing "Block time" field: it back-calculates the
  superset's work and doesn't set `lockTotal`. That back-calculation leaves pinned exercises at
  their pinned time and spreads the rest over the unpinned ones.
- `restLocks` don't apply in manual mode, because each superset's own rest fields are what
  count there.
- `lockTotal` and `restLocks` are kept when fit mode is turned off, but they do nothing until
  it's turned back on.

**Pins when an exercise is replaced** *(builder's call)*: choosing a different exercise for a
row in the picker keeps that row's pin and each-side setting. It's a deliberate swap, and the
bold chip shows the pin. Shuffle and "Fill for me" clear the pin and each-side setting on every
row they replace, so a random pick never inherits a hand-set time. Undo restores them.

**Existing workouts** *(builder's calls)*: a saved or logged workout that still has `balance`
and no `restScale` keeps its exact old ratios (`BAL[balance]`) until I move the slider. So the
only change for old workouts is the rounding adjustment in step 5. A workout paused at the
moment this ships won't match its resume data afterward (because of the new resume check in
section 6 and the rounding change), and it will offer a fresh start. That's acceptable as a
one-time thing.

### 3. Work/rest slider

Replaces the "More work / Balanced / More rest" buttons in Timing options.

- One slider, `restScale` from 0.4 to 2.0 in steps of 0.1. Labels at the ends: "More work" and
  "More rest." A small mark at 1.0 is labeled "Balanced."
- Under it, a live line with the resulting times, e.g. "38s work · 12s switch · 50s between
  rounds · 75s between supersets."
- Each rest value in that line, and in the fit summary on Today and in the builder, is a
  tappable chip. Tapping opens the time editor (section 4) for that rest type. A pinned rest
  shows a small lock icon. Pinned rests ignore the slider.

### 4. Setting times: the time editor sheet

One bottom sheet used everywhere a time can be set:

- Title: what's being set ("Plank," "Superset B," "Transition").
- The current time, large, with −5 / +5 buttons and a field to type `45` or `1:30`.
- "Back to auto," shown only when the time is pinned.
- A line saying what happens to the rest, e.g. "The other 7 exercises go to 41s each."
- For an exercise: an "Each side" toggle, "Move up" / "Move down" (a non-drag alternative), and
  "Remove."

Where it opens from:
- **Exercise rows in the builder** show a time chip on the right: muted when automatic, bold
  with a lock icon when pinned. Tap the chip to open the sheet. Tapping the name still opens the
  exercise picker.
- **Superset header** shows the superset's total as a chip next to the rounds stepper, same
  behavior.
- **Rest chips** (section 3).
- **Timeline preview** (section 5).

Changing any time recalculates immediately and updates the total, the timeline and every other
chip.

### 5. Timeline preview: tap to select

Dragging segment edges on the timeline isn't workable on a phone: a 30-minute workout has
around 60 segments in about 340 pixels. So instead:

- Tapping the timeline selects the segment under the finger and highlights it plus every other
  segment of the same exercise (or same rest type).
- A small strip under the timeline names the selection ("Plank · 45s × 3 rounds"). The strip
  is the time editor's entry point: tap it to open the sheet.
- Sliding a finger along the timeline moves the selection, which makes it easy to explore.

### 6. Drag and drop, and undo

**Dragging**
- Each exercise row gets a grab handle (⋮⋮) on the left. Each superset header's letter badge is
  also its handle.
- A drag starts only from a handle, so scrolling anywhere else works normally. On touch, it
  starts after the finger moves a few pixels on the handle, with a short vibration on pickup.
- While dragging: the row lifts and follows the finger, a gap opens where it would land, and
  the page scrolls automatically near the top or bottom edge.
- Exercises can be dropped anywhere in any superset. Dropping on "+ Add superset" creates a new
  superset with that exercise.
- Supersets reorder among themselves. Letters (A, B, C) follow position. Warm-up stays first
  and cool-down stays last.
- If moving an exercise empties a superset, the empty superset is removed (undoable).
- **Weights entered so far move with the exercise.** Its sets list is kept whole even when the
  new superset has fewer rounds (logging already only saves the first N), so moving it back
  restores everything.
- Pins move with the exercise. A pinned superset keeps its total, so its exercises re-spread.
- Keyboard and mouse: "Move up" / "Move down" in the time editor sheet does the same thing.

**Undo**
- Removing an exercise or superset, Clear, Shuffle / Fill for me, a drag move and "Back to
  auto" all show a message with an **Undo** button for about 6 seconds.
- One level: a snapshot of the workout taken before the action. Undo restores it and saves.
- The message needs to accept taps (it currently can't). Existing confirmations stay as they
  are. Deleting a logged workout from History stays confirm-only, because it syncs.

**Resume safety**
- Resume matching includes each work step's superset id and exercise id, not just durations.
  A paused workout that was reordered won't resume on the wrong exercise. It just offers a
  fresh start, as it does today when timings change.

### 7. Warm-up and cool-down

- "+ Add warm-up" above the first superset and "+ Add cool-down" below the last, in the builder.
  At most one of each.
- Each is a single timed segment with an optional name (default "Warm-up" / "Cool-down") and a
  length (default 5 min, set with the time editor). Always pinned. Never re-fit.
- They count toward the target length (the target is the time I have in total), so fit mode
  takes them off first.
- In the live timer they show with their name and a calm phase label, using the rest colors.
  No rounds and no weights to log.
- *(Builder's calls.)* No rest step after the warm-up or before the cool-down. The segment
  itself is the transition. They're timer mode only and hidden in reps mode. They're saved to
  history as a named segment with its length, so the existing "drop supersets with no named
  exercises" rule in `buildSteps` and `finishWorkout` needs an exception for them.

### 8. Each-side exercises

- Toggled in the exercise's time editor sheet. The exercise row shows "each side."
- In the timer it becomes two work intervals back to back: "Plank · side 1," then a 5-second
  "Switch sides" step with voice cue and vibration, then "side 2."
- In fit mode it counts as two work intervals, so each side gets a normal interval's time. A
  pinned time is **per side**.
- Logging is unchanged: one weight/reps entry per round.

### 9. Live timer: +15s / −15s

- Two small buttons beside the big countdown, on work and rest steps alike.
- They change only the current interval in this session. The saved workout doesn't change.
- −15s never goes below 1 second left. If that's already where it is, it acts like skip.
- "Left" time and the progress bar update immediately. The 3-2-1 countdown and voice cues still
  fire correctly after an adjustment.
- Adjustments are saved with resume data, so leaving and resuming keeps them.

### 10. Weight suggestions

- On the existing "Last time" line, add "· try 27.5" when both:
  - the last two logged sessions of that exercise used the same top weight, and
  - reps were logged and didn't drop between them, or reps weren't logged at all.
- Increase step is a new setting under Settings, defaulting to 5 lb or 2.5 kg to match the
  chosen unit.
- It's only a hint. It never fills a field. The faded placeholder stays as last time's weight.

### 11. Tests for the timing math

Written first, before any timing changes, against today's behavior. Then extended for each
new feature.

- Put the timing math (`buildSteps`, `counts`, `applyFit`, `blockFixed`, `blockTotal`,
  `totalAll` and new helpers) between two marker comments in `index.html`. The functions it
  depends on (`int`, `num`, `DEF`) must be available inside the block or passed in.
- `tests/timing.test.js` (Node, `node --test`, no packages) reads `index.html`, pulls out the
  marked section, runs it in a sandbox and checks:
  - total equals the target exactly in fit mode, across a spread of generated workouts
    (1–4 supersets, 1–5 exercises, 1–6 rounds, targets 5–90 min, random pins and slider values);
  - pinned exercises, superset totals and rests come out exactly as pinned;
  - unpinned intervals are equal to each other (apart from the single rounding adjustment);
  - the minimums hold, and "doesn't fit" is reported rather than producing negative times;
  - old saved workouts (string exercises, `balance` instead of `restScale`) give the same times
    as today, apart from the rounding adjustment on the last work interval.
- Stage 1 tests pin down today's exact output. When stage 2 adds the rounding adjustment,
  update those expectations on purpose, and only for the last interval.

### 12. Lock-screen audio experiment

A time-boxed experiment, not a promised feature.
- Test on my iPhone, as an installed app: while the workout timer runs, play a silent looping
  audio element alongside the existing sounds, and set lock-screen media info (workout name,
  current exercise).
- Keep it only if cues still play with the screen locked for at least a full 30-minute
  workout. If so, add it as a setting ("Keep sounds playing when locked," on by default) and
  update the README's "Good to know" section. If not, write down what happened in this
  document and drop it.

## Build order

Each stage is usable and deployable on its own:

1. Tests for today's timing math (section 11).
2. Timing model: data fields, fit calculation, time editor sheet, exercise and superset chips,
   rest chips and pins, slider, saving and logging the new fields (sections 1–4).
3. Timeline tap-to-select (section 5).
4. Undo, then drag and drop and move up/down, then resume safety (section 6).
5. Live timer +15s / −15s (section 9), each-side exercises (section 8), warm-up and cool-down
   (section 7).
6. Weight suggestions (section 10).
7. Lock-screen audio experiment (section 12).

## Left to the builder

- Exact visuals of chips, handles, the lifted row and the drop gap, within the existing style.
- The drag start threshold, the scroll-zone size and the vibration pattern.
- How undo snapshots are stored, and the code structure of the fit calculation, as long as the
  tests in section 11 pass.
- The "Switch sides" step length (5s suggested) and whether it plays the rest sound or its own.
- How History displays pins and each-side (a quiet note is enough).
