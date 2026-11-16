# Open question: what happens to leftover time when everything is pinned?

Status: **open — to discuss in a fresh session**
Raised: 2026-11-16, during the final review of the `timing-reorder` branch (spec: `docs/superpowers/specs/2026-11-16-timing-reorder-design.md`)

## The situation

A workout has a target length (e.g. 30 min). Fitting normally stretches or shrinks work and rest to hit that target exactly. Pins override that: an exercise's work time or a superset's total can be set by hand.

The question is what to do when **every** exercise (or every superset) is pinned, and the pinned times add up to **less** than the target.

## The options

1. **Stretch the rests to fill the target.** The workout still ends at the target length. The extra time goes into rests, either between rounds, between supersets, or both.
   - Plus: the target always holds.
   - Minus: rests can become very long and surprising. For example, 1 superset × [60s, 30s] × 3 rounds at 30 min gives 138s transitions and 553s (~9 min) round rests.
2. **End early.** The workout is the sum of the pins plus normal rests. The target is treated as "set by hand" and is no longer honoured.
   - Plus: predictable, nothing stretches.
   - Minus: the target is silently not met. The UI should say so, e.g. "All times set by hand · 22:30 of 30:00".
3. **Middle ground** (not yet explored), for example:
   - stretch rests only up to a cap and end early past it;
   - ask the user once with a "Fill the rest with rest / End early" choice;
   - put the leftover only into between-superset rests, never into round rests.

## Where the code is today

- With every exercise pinned (`d.fit.allSet`), the code **stretches the rests** (option 1). The Today fit line then says only "All times are set by hand · 30:00" and hides the rest chips, so the stretched rests are invisible (review item M3, parked).
- The plan contradicts itself on this point.
  - Task 3's test expects the rests to stretch.
  - Review Focus 1 says that when everything is pinned, the total is the sum of the pins.
- The spec is silent.
- With every *superset* pinned (nothing automatic outside them), the C2 fix made the workout **end early** (option 2). It now ends at the sum of the pins, e.g. 15:22 against a 30-min target, labelled "All times are set by hand". Rest between supersets follows the pinned supersets' own work/rest balance; in the two-supersets-at-7:00 case that is 87s, where the old code stretched it to 950s.
- So the two "everything pinned" cases now behave **differently**: pinned exercises stretch the rests, pinned supersets end early. Deciding this question should probably make them consistent.

## Things to decide

- Which option, or which middle ground?
- Does the answer differ for "all exercises pinned" vs "all supersets pinned"?
- What should the summary line and rest chips show in this state?
- Should there be a rest cap, and if so, how big?
- With only supersets pinned, changing the target length does nothing visible until the target drops below the pins. Is that acceptable?
- **Should a rest pin (e.g. "round rest = 1:30") also apply inside a superset whose total is pinned?** Today it does. Also, the rest editor shows the automatic value even when you open it from a rest inside a pinned superset, which can look wrong. This was found in the fix-wave re-review and parked as a minor.

## Related

- Final review report (deleted with the workspace after merge; its findings are summarised in the git log): items C2, M3, and the "Declined to judge" section.
- Spec §2 (fitting and pins).
