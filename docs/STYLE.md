# Style guide

The look of Tempo. Some of Sara's private apps follow this look too, and changes to it are
made to them together. What every project shares is in
[STYLE-PRINCIPLES.md](../../STYLE-PRINCIPLES.md) (outside this repo). Being rebuilt section by
section. For now it describes the look as built.

## Character

Clean and sporty: neutral greys, near-black ink, one bright highlight, big confident numbers.
Rounded cards on a soft ground. Light and dark follow the system.

## Colour

| Role | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--bg` / `--bg2` | `#f5f5f3` / `#ecece9` | `#0b0b0c` / `#1b1b1e` | the page; button and segment grounds |
| `--card` | `#ffffff` | `#151517` | cards |
| `--ink` / `--muted` | `#121214` / `#6f6f75` | `#f3f3f1` / `#9a9aa1` | text; secondary text |
| `--line` / `--hair` | `#ebebe7` / 6% ink | `#26262a` / 6% white | borders; card edges |
| `--accent` | `#121214` (ink) | `#d4ff3a` (chartreuse) | selected and primary controls |
| `--hi` | `#d4ff3a` | | the running rest pill |
| `--t-work`, `--t-rest`, `--t-ready`, `--t-done` | chartreuse, ink, grey, ink | | the timer's phases |
| `--warn` | `#c0362c` | `#ff8a7a` | errors and destructive actions |

Chartreuse marks work and what is running; everything else stays neutral.

## Type

- Text: the system sans, 15px with line height 1.45.
- Numbers, headings and titles: Space Grotesk 500–700, self-hosted. Big timer figures use
  tabular figures, tight negative tracking and sizes that scale with the screen.
- The phase label is in caps with wide tracking.

## Shape and depth

- Cards: 20px radius, a hairline edge, a soft shadow in light mode and none in dark.
- Controls: 12px radius; pills fully round.
- The bottom navigation is frosted glass over the page.

## Implementation notes

Kept apart until we decide where implementation guidance lives.

- Tokens are the `:root` blocks at the top of `index.html`'s `<style>`, light then dark
  (`prefers-color-scheme`). Fonts are in `fonts/`.
