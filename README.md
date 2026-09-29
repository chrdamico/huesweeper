# Huesweeper

A colour logic puzzle for the phone, inspired by *ColorSweeper*. Installable as a PWA, works offline, no build step.

Each number counts how many of its neighbours share the number's own colour. Colour every empty cell so all numbers are right. Every puzzle has exactly one solution and never needs a guess.

## Content

- **Campaign**: 10 worlds × 8 levels. Each world adds a rule: mirror / point symmetry, 3 and 4 colours, silent givens (no number), masks (number with hidden colour), cross (4 neighbours), wraparound edges, knight moves, and mixes.
- **Daily**: one seeded puzzle per day (same for everyone), a rule theme per weekday, streaks, share text.
- **Endless**: random puzzles with your own size, difficulty and rule mix.
- **Gallery**: 12 picture puzzles that reveal pixel art.
- Hints that explain the deduction, undo/redo, notes, mistake highlighting, colour-blind symbols, 6 palettes, light/dark theme, sound and haptics.

## Develop

```bash
npm run serve          # http://localhost:8080
npm test               # solver, generator and level tests
npm run levels         # regenerate public/js/levels-data.js after editing campaign.js or pictures.js
npm run icons          # regenerate icons (needs Python + Pillow)
```

`public/` is the whole site. Engine: `board.js` (rules), `solver.js` (constraint propagation, pair reasoning, trial), `generator.js` (carves clues from a full board while the solver still finishes), `hint.js`.

## Deploy

Static hosting of `public/`. Both pipelines run the tests, stamp the service worker with the commit SHA (so installed apps update), and publish:

- **GitHub Pages**: `.github/workflows/pages.yml`. In the repo, set *Settings → Pages → Source* to *GitHub Actions*.
- **GitLab Pages**: `.gitlab-ci.yml` (`pages` job on the default branch).

## Install on a phone

Open the site. Android/Chrome: tap **Install app** on the home screen (or browser menu → *Install app*). iPhone/Safari: *Share → Add to Home Screen*.

Nunito font: SIL Open Font License. Not affiliated with ColorSweeper or its developers.
