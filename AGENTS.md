# Repository agent guide

## What this repo is
Tempo: workout, focus (pomodoro), meditation and alarm timers in one page (`index.html`),
with a service worker (`sw.js`) for offline use. GitHub Pages serves `main`, so pushing
deploys. User-facing notes are in [README.txt](README.txt).

## Other readers depend on this repo
Sara's private apps read Tempo's sync gist and plan to link into Tempo. So:

- **The sync file is shared.** `tempo-sync.json` in a secret gist:
  `{ app, format, updatedAt, docs }`, `docs` keyed per record, each `{ t, d }` or `{ t, del }`,
  newest change wins (`mergeDocs`, `remoteDocs`). Change its shape only with a new `format`
  number, and keep reading the old one.
- **Same origin, shared storage.** Tempo shares `sarakc.github.io` with the Warm Kitchen finder.
  The finder can reuse Tempo's token (it reads `tempo.sync` from localStorage), so keep that
  key's shape (`{ token, gistId, … }`).
- **Deep links** (planned, not built): `#start=<mode>` to start a workout, focus or meditation.
  Add them as an addition; don't repurpose existing hashes.
- This repo is public. Don't name or describe the private apps in it.

## Working
- Tests: `node --test tests/*.test.js`. Pure functions sit between `/* @testable */` and
  `/* @end-testable */`; `tests/load.js` exports them.
- Bump `CACHE` in `sw.js` when its file list changes.
- Keep it one self-contained page with no build step.
