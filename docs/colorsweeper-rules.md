# ColorSweeper: what is known about its rules (research, Oct 2026)

ColorSweeper is by ARRKKA (Korea). The original release was on Steam (demo) and mobile in 2024. Com2uS Holdings published the global mobile release on 2026-07-02. The developer says it has **17 variant rules**, and **up to 6 can combine on one board**. No public source lists all 17. Below is everything found, with confidence.

Legend: **C** = confirmed by the developer, official account or several sources · **L** = likely, from screenshots or one source · **?** = name known, mechanics unknown.

## Board basics

- **C** Main rule: a numbered cell counts the cells among its 8 neighbours that have its colour. Area-count clues never count themselves.
- **C** The base game uses **3 colours**; "Palettes" stages use 4 and some modes use 2. The developer says 2 colours are meant for speed and 4 for careful inference.
- **C** Sizes run from 3×3 to 10×10. Chapters have 4 stages; the 4th stage is the hard one, and 10×10 appears only there.
- **C** Each clue shows at most 2 pieces of information. Ray = direction + number, Count = colour + number.
- **C** Players can skip rules they dislike, and no overall completion percentage is shown.

## Rules

| Rule | What we know | Conf. |
|---|---|---|
| Basic (sprout icon) | Number = same-colour cells among the 8 neighbours | C |
| Hidden numbers (die ⚀ icon) | Some coloured givens show a dot instead of a number | L (screenshots) |
| Palettes | 4-colour boards | C |
| **Ray** | An arrow before the number: in that direction there are exactly N cells of the clue's colour. One review says "consecutive"; another says "that many exist". Screenshots show horizontal and diagonal arrows | C (semantics partly unclear) |
| **Knight** | A cell with a knight piece: **at least one** cell a knight's move away has the same colour as that cell (interview caption). Long-press shows the knight range | C |
| **Symmetry** | Special cells with a mirror-axis icon (vertical, horizontal or diagonal). "Uses the symmetric pattern of facing cells"; the developer: "the opposite of the yellow arrow is required to create symmetry". Most likely the cells facing each other across that axis around the clue have the same colour. Long-press shows the range | C name / L semantics |
| **Count** | Colour + number. Probably the coloured circles outside rows and columns: the number of cells of that colour in the line. Grey circles may be counts with a hidden colour | L |
| **Streak** | Line clue (numbers outside rows and columns): the **longest block** (unbroken run of one colour, any colour) in that row or column. The developer solved Streak 12 using "maximum length 3" | C |
| **Block** | Uses "blocks" (unbroken horizontal or vertical runs of one colour) and their lengths. Exact clue unknown | ? |
| **Duo** | "Shows the number of 2-long same-colour runs" | L |
| **Stick** | Clue = length of the block that **contains the clue cell** (counts itself, unlike area clues) | C |
| **Pattern** | Cells with the same pattern symbol have identical neighbourhoods: in each of the 8 directions the neighbour is always "same colour as me" or always "different from me" (official X post) | C |
| **Poly**, **Major** | Added June 2026 (v1.4.2 to 1.4.3) | ? |
| **Hard** (book 📖 icon) | Unlocks late; needs proof by contradiction (assume, find a clash) | C |
| Disguised | Selectable in Random mode in the 2024 version | ? |

## Interaction and meta features

- **C** 3 hearts: a wrong paint costs a heart. Stamina tickets are refunded after a flawless clear, so careful play is effectively free.
- **C** A paint / **X-mark** toggle. Double-tap a satisfied clue to X its remaining cells. "Sweep": when a cell has X marks for all colours but one, the remaining colour follows.
- **C** **Sketch** mode (unlocks at level 16): a scratch layer to try paint and X marks for what-if reasoning. Lab option "temporary paint": strokes apply only when you press the wave button.
- **C** Long-press a clue shows a clue-specific sentence ("there are 3 red cells around") and its range.
- **C** Hints are a "nudge": they show which cell to deduce next. Hints are a currency.
- **C** Daily Challenge with Easy, Normal and Hard plus Top-30 rankings, Series Rankings per rule, Time Attack, achievements and emblems, a sticker Art Gallery, seasonal events, a co-op "World Painter" event, PvP (planned), account linking and colour themes.

## Huesweeper status vs this list

Have: basic count, 3 and 4 colours (2 too), hidden numbers (Silent), proof-by-contradiction difficulty (Hard), daily, random/custom, gallery, hints.
Different: Knight (ours changes what numbers count), Symmetry (ours makes the whole solution symmetric), Tallies (ours count only colour 1).
Missing: Ray, knight-piece Knight, axis Symmetry, per-colour Count line clues, Streak, Stick, Duo, Block, Pattern, Poly, Major, lives, X-mark mode / Sweep, Sketch, Time Attack, achievements.

## Sources

- Steam store, screenshots and threads "Stuck on Streak 12" and "Stuck on Symmetry 8" (developer answers): https://store.steampowered.com/app/3128730/ColorSweeper/ , https://steamcommunity.com/app/3128730/discussions/
- App Store listing, screenshots and version history (Poly & Major, Time Attack, Series Rankings): https://apps.apple.com/us/app/colorsweeper/id6756171201
- Developer interview, ThisIsGame (17 rules, max 6 combined, Ray/Count clues, Stick/Block/Duo/Streak blocks, Knight, Hard, Sketch, tickets): https://www.thisisgame.com/articles/427455
- Official X post on the Pattern rule: https://x.com/ColorSweeper/status/2076941179279802825
- Financial Today review (Ray, Duo): https://www.ftoday.co.kr/news/articleView.html?idxno=361591
- GameFocus preview (Ray, Symmetry, Knight): http://www.gamefocus.co.kr/detail.php?number=177271
- Digital Daily interview (17 rules, 6 combined, long-press, nudge hints, chapter sizes): https://www.ddaily.co.kr/page/view/2026070311365927057
- Skich summary (Streak line rule, standard vs reductio mode): https://skich.app/games/color-mine-puzzle
- Gamerch JP beginner guide (double-tap X, Sweep): https://gamerch.com/colorsweeper/995046
