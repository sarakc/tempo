# CSV import (design)

Date: 2026-11-19 · Size: small project · Approved by Sara in conversation, 2026-11-19

## Why
Sara has interval-timer routines as CSV files (`examples/interval-timer-routines/`, ten routines from 5 to
60 minutes, plus `all-routines.csv` with all of them). She wants to import a file and get a
Tempo workout without building it by hand. This also settles the TODO item about porting
workout-app's CSV import.

## Goals
- On the Workouts page, **Import** a `.csv` file. Each routine in it becomes a saved workout.
- An imported routine **plays exactly as written**: the same steps in the same order, with the same
  seconds and the same total (a 5-minute routine runs 5:00).
- Imported workouts are ordinary workouts. They can be edited, duplicated, moved to folders,
  starred and deleted like any other.
- Each step's **cue** is shown on screen while that step runs. Cues can be edited in the exercise sheet.

## Non-goals
- Rebuilding routines into Tempo's structure. Rounds stay written out ("…, round 2"), left and
  right stay separate steps, and Rest and Get ready rows stay their own steps.
- Exporting to CSV.
- Reading Sara's planning spreadsheet (`workout-app/examples/Workouts - all-organized.csv`).
- Reading cues aloud.

## Anti-goals
- An imported routine whose length or step order drifts from the file.
- An import that silently drops rows. Skipped rows are counted and reported.
- Changing how existing workouts fit or play.

## Approaches considered
1. **Play as written** (chosen). Every row is a pinned exercise. Fitting and auto-rests are off.
2. Rebuild the Tempo way: collapse rounds and sides, and turn rows into rests. Rejected because
   the timing would only roughly match the file and one-off rests would be lost.

## The file format
- The first row is the header. Columns are matched by name, ignoring case and extra spaces.
  Other columns are ignored.
  - **Name** (required): `Interval`, `Exercise`, `Name` or `Step name`
  - **Seconds** (required): `Duration (s)` or `Seconds`. Otherwise `Duration`, read as seconds or m:ss.
  - **Routine** (optional): splits the file into workouts. Without it, the whole file is one workout,
    named after the file (with a leading `NN-` number and the `.csv` dropped).
  - **Block** (optional): a new superset starts each time the value changes.
  - **Cue** (optional): `Cue` or `Notes`.
- Standard CSV rules apply: quoted fields may hold commas, quotes (`""`) and line breaks. The file may
  use CRLF or LF and may start with a UTF-8 BOM.
- A row with an empty name or unreadable seconds is skipped and counted. A file with no usable rows,
  or without the two required columns, imports nothing and says why.

## How an import maps onto Tempo
- Each routine becomes a workout with `mode: "timer"`, `autoFit: false`, `restsOn: false`, `ready: 0`,
  `restBlock: 0`, and `targetMin` set to the total in minutes. It goes into the folder being viewed,
  the way **New** does.
- Each block becomes a superset with `rounds: 1`, `restEx: 0` and `restRound: 0`. Block names are dropped,
  because Tempo letters supersets A, B, C… in the same order.
- Each row becomes an exercise `{ name, work: seconds, cue? }`. Every exercise is pinned, so it plays at
  exactly its seconds. Type is not used.
- Importing one routine opens it in the editor. Importing several shows a toast ("Imported 10 workouts")
  and stays on the list. Re-importing makes new copies; it never overwrites.

## Cues in Tempo
- An exercise may carry `cue` (a trimmed string, at most 300 characters). Saving, loading, duplicating
  and syncing keep it.
- When an exercise is swapped for a different one in the picker, its cue is cleared. Its time and side stay, as the picker
  has always kept them. "Fill for me" clears time, side and cue, as it already cleared time and side.
- **Editor:** the cue shows as a small muted line under the exercise name. The exercise sheet (the time
  editor) has a "Cue" text field.
- **Player:** during a work step, the cue shows under the exercise name.

## Left to the builder
Button placement and styling within the existing Workouts header and sheet patterns, and how a
long cue wraps on the timer screen.
