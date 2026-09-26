# Implementation Plan: Halloween Party Scoring

## Overview

Build a vanilla HTML/CSS/JS single-page app (`index.html`, `styles.css`, `app.js` in the workspace root, no build step) with pure logic modules (Config, Validation, Totals, Persistence) decoupled from a Controller/Render layer. Set up a test runner (Vitest) with fast-check for property-based testing, implement the 7 correctness properties, and add the example/integration/rendering tests from the design's Testing Strategy. Each task builds on the previous and ends with wiring the app together so no code is orphaned.

## Tasks

- [x] 1. Set up project scaffold and test tooling
  - Create `index.html`, `styles.css`, and `app.js` in the workspace root as static files openable with no toolchain
  - Add `package.json` with Vitest (jsdom environment) and fast-check as devDependencies and a `test` script
  - Add a Vitest config using the jsdom environment so DOM-facing tests run headless
  - Structure `app.js` so the pure modules (Config, Validation, Totals, Persistence) are exported/importable without a DOM, alongside the DOM-facing Controller/Render
  - _Requirements: 1.5, 10.3_

- [x] 2. Implement the Config module
  - [x] 2.1 Define teams, games, matchups, and constants
    - Define `TEAMS` (Team A–D), ordered `GAMES` (ABCD Names, Bone Finder, Ghost Catcher, Pumpkin Toss, Quiet Place, Human Centipede) with matchup text for Ghost Catcher, Pumpkin Toss, Quiet Place and none for the others
    - Define `NEGATIVE_ALLOWED` = { "quiet-place" } and `SCORE_MIN = -999`, `SCORE_MAX = 999`
    - Export the config as the single source of truth for teams/games
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.4_

  - [x]* 2.2 Write unit tests for Config correctness
    - Assert exactly four teams (A–D) and six games in the required order
    - Assert matchup strings for Ghost Catcher, Pumpkin Toss, Quiet Place and absence elsewhere
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3. Implement the Totals module (pure)
  - [x] 3.1 Implement `teamTotal` and `allTotals`
    - Sum a team's six game scores treating missing/unset cells as zero
    - Implement `formatTotal` producing a leading minus sign iff the total is negative, preserving magnitude digits
    - _Requirements: 2.3, 3.2, 3.3, 3.5, 4.5_

  - [x]* 3.2 Write property test for team totals
    - **Property 1: Team total equals the sum of its game scores** — for any score map, `teamTotal` equals the arithmetic sum of the team's six game scores with missing counted as zero
    - **Validates: Requirements 2.3, 3.2, 3.3, 4.5**
    - Tag: `// Feature: halloween-party-scoring, Property 1: Team total equals the sum of its game scores`
    - Run >=100 iterations with a score-map generator (4×6 integers, negatives for quiet-place, boundaries ±999)

  - [x]* 3.3 Write property test for negative total formatting
    - **Property 5: Negative totals display with a leading minus sign** — for any integer total, the formatted string begins with a minus iff the total is negative and otherwise preserves the magnitude digits exactly
    - **Validates: Requirements 3.5**
    - Tag: `// Feature: halloween-party-scoring, Property 5: Negative totals display with a leading minus sign`
    - Run >=100 iterations over arbitrary integers

- [x] 4. Implement the Validation module (pure)
  - [x] 4.1 Implement `validateScoreInput`
    - Trim input; treat empty string as `0` and `ok`
    - Reject non-integers (non-numeric, decimal, `NaN`, `Infinity`) with `reason: "non-integer"`, retaining `previousValue`
    - Reject integers outside `[-999, 999]` with `reason: "out-of-range"`, retaining `previousValue`
    - Reject negatives for games not in `NEGATIVE_ALLOWED` with `reason: "negative-not-allowed"`, retaining `previousValue`
    - Otherwise return `ok: true` with the parsed integer
    - _Requirements: 2.2, 2.4, 2.5, 2.6, 3.6_

  - [x]* 4.2 Write property test for accepting valid in-range integers
    - **Property 2: Valid in-range integers are accepted** — for any game and any integer in [-999, 999] (excluding negatives for non–Quiet Place games), validation returns accepted with stored value equal to the entered integer
    - **Validates: Requirements 2.2, 2.4**
    - Tag: `// Feature: halloween-party-scoring, Property 2: Valid in-range integers are accepted`
    - Run >=100 iterations with a valid-input generator (integers in [-999, 999] filtered per game negative rule)

  - [x]* 4.3 Write property test for rejecting invalid input and retaining previous value
    - **Property 3: Invalid input is rejected and the previous value is retained** — for any current stored value and any invalid input (non-integer string, out-of-range integer, negative for non–Quiet Place game), validation returns a rejection whose retained value equals the previous stored value
    - **Validates: Requirements 2.5, 2.6**
    - Tag: `// Feature: halloween-party-scoring, Property 3: Invalid input is rejected and the previous value is retained`
    - Run >=100 iterations with an invalid-input generator (decimals, letters, whitespace, `+`/`-` signs, very large numbers, unicode digits, out-of-range ints, negatives paired with non–Quiet Place games)

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement the Persistence module
  - [x] 6.1 Implement save/load/clear over localStorage
    - `saveScores` JSON-stringifies `{version:1, scores}` to `STORAGE_KEY` inside try/catch, returning `{ok}`
    - `loadScores` reads and validates: returns `ok`/`empty`/`invalid`/`unavailable`, never throws; normalizes parsed data into a complete ScoreMap (drop unknown teams/games, default missing cells to 0, coerce out-of-range or illegal-negative values to 0); treat unknown `version` as `invalid`
    - `clearScores` removes the key inside try/catch, returning `{ok}`
    - Feature-probe storage availability on init
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.2, 6.4, 10.4, 10.5_

  - [x]* 6.2 Write property test for persistence round-trip
    - **Property 6: Persistence round-trip is the identity** — for any well-formed score map, saving then loading yields an equal map
    - **Validates: Requirements 5.1, 5.3, 10.4**
    - Tag: `// Feature: halloween-party-scoring, Property 6: Persistence round-trip is the identity`
    - Run >=100 iterations with a well-formed score-map generator against a mocked/jsdom localStorage

  - [x]* 6.3 Write property test for robust loading of arbitrary storage content
    - **Property 7: Loading arbitrary storage content yields a well-formed map without throwing** — for any string content in the store, loading never throws and either returns a complete well-formed map or reports invalid/empty (which the app initializes to zeros)
    - **Validates: Requirements 5.6**
    - Tag: `// Feature: halloween-party-scoring, Property 7: Loading arbitrary storage content yields a well-formed map without throwing`
    - Run >=100 iterations with a generator of arbitrary strings, malformed JSON, and valid-JSON-with-wrong-shape

  - [x]* 6.4 Write unit tests for persistence error flows
    - Mock localStorage to cover write failure (Req 5.2), read failure (Req 5.5), no saved data → zeros (Req 5.4), and unavailable storage → in-memory + message (Req 10.5)
    - _Requirements: 5.2, 5.4, 5.5, 10.5_

- [x] 7. Build the Score Grid markup and theme styling
  - [x] 7.1 Build `index.html` structure and grid
    - Create a 4×6 grid of Score_Cells each tagged with its team+game, four Team_Total displays, the "HALLOWEEN PARTY" title, and a reset control, all on a single screen with no navigation
    - Render unset cells as empty
    - _Requirements: 2.1, 3.1, 4.1, 4.2, 4.3, 4.4_

  - [x] 7.2 Implement the theme and readability styles in `styles.css`
    - Background `#0d0d0d` full viewport; title `#b5e847` in a blackletter font (Pirata One) with a serif fallback stack preserving the neon-green color
    - Apply pink `#f4a6c8`, orange `#f08a24`, cream `#f5f0e6` accents to at least one element each; cream body/score text on `#0d0d0d` for contrast ≥4.5:1 (title/large text ≥3:1)
    - Size labels, cell values, and totals with `clamp()` to guarantee ≥24px at ≥1280px, no horizontal scroll or clipping, sticky team/game labels when cells scroll
    - _Requirements: 4.6, 7.1, 7.2, 7.3, 7.4, 7.6, 9.1, 9.2, 9.3, 9.4_

  - [x] 7.3 Add inline-SVG Halloween icons with emoji fallback
    - Render at least 8 of 10 invite icons (black cat, skull, spider web, spider, witch hat, jack-o-lantern, potion bottle, bones, candle, moth) as inline SVG, each with an emoji fallback if the SVG fails
    - _Requirements: 7.5, 8.5_

  - [x] 7.4 Add CSS ambient animations
    - Add `@keyframes` for a flickering candle (opacity/brightness), drifting spider (transform translate, ≤15% viewport displacement per cycle), and twinkling stars (opacity), using `transform`/`opacity` on decorative-only elements so scores stay fixed
    - Disable motion under `@media (prefers-reduced-motion: reduce)`
    - _Requirements: 8.1, 8.3, 8.4_

- [x] 8. Implement the Controller and Render layer
  - [x] 8.1 Implement render functions
    - Build the grid from Config, update cell values, render the four Team_Totals (derived, never stored), show/clear per-cell error indications, and show a dismissible non-blocking message banner
    - _Requirements: 3.1, 3.4, 3.5, 4.1, 4.3, 4.4, 4.5_

  - [x] 8.2 Implement input handling and state updates
    - On cell input, validate via the Validation module; on accept update the in-memory ScoreMap, recalc the affected Team_Total, re-render, and clear any prior error on that cell; on reject retain the previous value, flag the cell, and leave the total unchanged
    - _Requirements: 2.2, 2.4, 2.5, 2.6, 3.2, 3.6, 4.5_

  - [x]* 8.3 Write property test for invalid entry leaving team total unchanged
    - **Property 4: Invalid entry leaves the affected team total unchanged** — for any score map and any invalid input applied to any cell, the affected team's total after the attempt equals the total before
    - **Validates: Requirements 3.6**
    - Tag: `// Feature: halloween-party-scoring, Property 4: Invalid entry leaves the affected team total unchanged`
    - Run >=100 iterations combining the score-map and invalid-input generators

  - [x] 8.4 Wire persistence, startup, and reset flow
    - On init run the startup sequence: load → populate grid (or zeros) → render theme/animations, surfacing storage `unavailable`/`invalid`/read-failure messages while continuing to operate
    - Debounce saves (~250ms) so rapid typing satisfies the ≤1s persist requirement
    - Implement reset: confirmation prompt that modifies nothing until a choice; confirm zeros all cells and clears the store (retain prior data + message on clear failure); cancel retains everything
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 10.5_

  - [x]* 8.5 Write unit tests for the reset flow
    - Confirm/cancel dialog leaves scores unchanged until choice (Req 6.1); confirm zeros all and clears store (Req 6.2); cancel retains everything (Req 6.3); clear failure retains prior data + message (Req 6.4)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Add integration, rendering, and timing tests
  - [x]* 10.1 Write grid-structure and startup integration tests
    - Assert 4×6 inputs tagged team+game, four total displays, empty cells render empty; grid renders fully on load with no configuration step (Req 1.5, 4.2)
    - Assert load-to-interactive under 3s with no backend network request, no external transmission of scores, and no login required
    - _Requirements: 1.5, 2.1, 3.1, 4.1, 4.2, 4.3, 4.4, 10.1, 10.2, 10.3_

  - [x]* 10.2 Write recalc-latency and readability tests
    - Assert a score change updates the displayed total in under 200ms (Req 3.4)
    - Assert computed font size ≥24px for team labels, game labels, cell values, and totals at ≥1280px with no horizontal scroll or clipping (Req 9.1, 9.3, 9.4)
    - _Requirements: 3.4, 9.1, 9.3, 9.4_

  - [x]* 10.3 Write theme and animation tests
    - Assert background `#0d0d0d` fills the viewport; title color `#b5e847` with blackletter font and serif fallback; pink/orange/cream each applied to ≥1 element; ≥8 of 10 icons present; scoring-text contrast ≥4.5:1 and title/large-text contrast ≥3:1 (Req 7.1–7.6, 9.2)
    - Assert candle, spider, and stars animations are defined; motion confined to decorations with displacement ≤15% per cycle; `prefers-reduced-motion` disables motion; a failed decoration is omitted without interrupting scores (Req 8.1, 8.3, 8.4, 8.5)
    - Note: 30fps (Req 8.2) is verified by manual/visual check on the target display, not automated
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.3, 8.4, 8.5, 9.2_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Restructure the Score_Grid to teams-as-rows / games-as-columns with a right-hand Total column
  - [ ] 12.1 Rebuild the grid markup in `index.html`
    - Lay out one row per team (4 rows) and one column per game (6 columns, in Config order); add a leftmost team-name cell per row and a rightmost prominent Total cell per row marked `[data-total="TEAMID"]`
    - Header row lists the game names; include a matchup toggle control `[data-matchup-toggle="GAMEID"]` in the 3 head-to-head game headers only
    - Keep all 24 score inputs tagged with `data-team`/`data-game`; render unset cells as empty
    - _Requirements: 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 9.1, 9.3, 9.4_

  - [ ] 12.2 Update `styles.css` for the new orientation
    - Style large, prominent right-hand Total cells; keep score/label/total text ≥24px at ≥1280px
    - Make the team-name column, header row, and Total column sticky when the grid scrolls so totals stay always-visible
    - _Requirements: 4.11, 9.1, 9.3, 9.4_

  - [ ] 12.3 Update the render layer in `app.js` for the new DOM
    - Update `renderGrid`/`renderCell`/`renderTotals` so totals write to the right-hand `[data-total="TEAMID"]` cells and update live on input (fixes the totals-visibility regression)
    - Ensure `renderTotals` targets the new cells and recalculates on every accepted input
    - _Requirements: 3.4, 3.5, 4.5, 4.10_

- [ ] 13. Implement the Names module and editable team names
  - [ ] 13.1 Add the pure Names module to `app.js`
    - Implement `teamLabel(names, teamId)`, `getName`, `setName` (clamp to 30 chars), and `normalizeNames` (coerce non-strings, trim, clamp 30, drop unknown teams, treat empty as unset)
    - Add `NAME_MAX_LEN = 30` to the Config module
    - _Requirements: 11.2, 11.4, 11.5, 11.6_

  - [ ] 13.2 Add team-name inputs and wire the controller
    - Add `[data-team-name="TEAMID"]` inputs to the grid in `index.html` and style them
    - In `app.js` add `state.names`, `handleNameInput` (clamp, update `state.names`, `scheduleSave`) and `renderTeamLabels` (re-render row labels via `teamLabel`)
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ]* 13.3 Write property test for team label resolution
    - **Property 8: Team label resolves to the custom name when set, else the default** — `teamLabel` returns the custom name when it is a non-empty ≤30-char string, else the default "Team A".."Team D"
    - **Validates: Requirements 11.2, 11.4, 11.5, 11.6**
    - Tag: `// Feature: halloween-party-scoring, Property 8: Team label resolves to the custom name when set, else the default`
    - Run >=100 iterations over arbitrary team ids and custom-name strings (including empty/whitespace/over-length)

  - [ ]* 13.4 Write example tests for team-name editing
    - Editing a name updates the rendered labels and persists; empty/whitespace falls back to the default label; a >30-char name is clamped to 30
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [ ] 14. Update Persistence to v2 with team names and v1 migration
  - [ ] 14.1 Bump storage to v2 and migrate legacy payloads in `app.js`
    - Set `STORAGE_VERSION = 2`; `saveScores(scores, names)` persists `{version:2, scores, names}`; `loadScores` returns `{status, scores, names}` and normalizes names on load
    - Migrate legacy `version:1` payloads (scores only) forward — load scores, default names — instead of reporting `invalid`
    - Update all callers: `scheduleSave` passes names, `initApp` adopts loaded names, `handleReset`/`confirmReset` keeps names
    - _Requirements: 5.1, 5.2, 5.4, 5.6, 5.8, 6.4, 11.3, 11.7_

  - [ ]* 14.2 Extend the persistence round-trip property test
    - **Property 6: Persistence round-trip is the identity** (extended) — saving then loading `{scores, names}` yields equal scores and names; update the existing Property 6 test to include a names generator
    - **Validates: Requirements 5.1, 5.2, 5.4, 10.4, 11.3**
    - Tag unchanged: `// Feature: halloween-party-scoring, Property 6: Persistence round-trip is the identity`
    - Run >=100 iterations

  - [ ]* 14.3 Write property test for v1 migration
    - **Property 9: Legacy version-1 storage migrates instead of being discarded** — storing a well-formed map as `{version:1, scores}` then loading succeeds (never `invalid`), yielding the original scores and default names
    - **Validates: Requirements 5.4, 5.8, 10.4**
    - Tag: `// Feature: halloween-party-scoring, Property 9: Legacy version-1 storage migrates instead of being discarded`
    - Run >=100 iterations

  - [ ]* 14.4 Write property test for reset preserving names
    - **Property 11: Reset zeros all scores while preserving team names** — a confirmed reset leaves the names map unchanged and sets every game score to zero
    - **Validates: Requirements 6.4, 11.7**
    - Tag: `// Feature: halloween-party-scoring, Property 11: Reset zeros all scores while preserving team names`
    - Run >=100 iterations

- [ ] 15. Implement the matchup announcement
  - [ ] 15.1 Add structured matchup pairs and the pure Matchup module to `app.js`
    - Add `matchupPairs` to Config `GAMES`: ghost-catcher `[["A","B"],["C","D"]]`, pumpkin-toss `[["A","C"],["B","D"]]`, quiet-place `[["A","D"],["B","C"]]`
    - Implement pure `formatMatchup(pairs, names)` that resolves each team id via `teamLabel` and preserves the pairing/grouping structure
    - _Requirements: 12.3, 12.4_

  - [ ] 15.2 Add the matchup toggle controls and overlay markup/styles
    - Add icon toggle buttons to the head-to-head game headers in `index.html` and a dismissible overlay element
    - Style the overlay large and room-readable in `styles.css`
    - _Requirements: 9.1, 12.1, 12.2, 12.6_

  - [ ] 15.3 Wire the matchup controller in `app.js`
    - Implement `renderMatchupAnnouncement`/`showMatchup`/`hideMatchup`/`toggleMatchup` and attach listeners on `[data-matchup-toggle]`
    - Overlay content uses `formatMatchup(GAMES[gameId].matchupPairs, state.names)`; toggling opens/closes; dismiss preserves scores and names
    - _Requirements: 12.1, 12.3, 12.4, 12.5, 12.6_

  - [ ]* 15.4 Write property test for matchup formatting
    - **Property 10: Matchup announcement substitutes current names and preserves structure** — `formatMatchup(pairs, names)` substitutes every team id via `teamLabel`, leaves no residual default "Team X" for a team with a custom name, and preserves the number and grouping of pairs
    - **Validates: Requirements 12.3, 12.4**
    - Tag: `// Feature: halloween-party-scoring, Property 10: Matchup announcement substitutes current names and preserves structure`
    - Run >=100 iterations

  - [ ]* 15.5 Write example tests for the matchup overlay
    - Matchup control appears only on head-to-head games; clicking shows the overlay with substituted (custom) names; toggling/dismissing hides it; dismiss preserves scores and names
    - _Requirements: 12.1, 12.2, 12.5, 12.6_

- [ ] 16. Update existing DOM/integration tests for the new layout
  - Update the grid-startup, recalc-latency/readability, and theme/animation tests to reflect teams-as-rows + right-hand Total column + team-name inputs + matchup controls, and keep them green
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 9.1, 9.2, 9.3, 9.4_

- [ ] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass (existing + new), ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for a faster MVP.
- Each task references specific requirements for traceability; property tasks also reference their design property.
- Property-based tests (Properties 1–11) each run >=100 iterations and carry the `// Feature: halloween-party-scoring, Property {n}: {text}` tag. Properties 8–11 are added with tasks 13–15; Property 6's test is extended in task 14.2.
- Frame-rate (Req 8.2) is intentionally covered by manual/visual verification since headless fps measurement is unreliable.
- Checkpoints ensure incremental validation of the pure logic before and after the DOM layer is wired.
- Tasks 12–16 append the teams-as-rows/Total-column layout, editable team names, v2 persistence with v1 migration, and the matchup announcement onto the completed base (tasks 1–11).
- Waves 7+ serialize all `app.js`, `index.html`, and `styles.css` edits so no two tasks write the same file in parallel; pure-logic and separate-test-file tasks parallelize only where they touch no shared source file.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1", "6.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "3.3", "4.2", "4.3", "6.2", "6.3", "6.4", "7.1"] },
    { "id": 3, "tasks": ["7.2", "7.3", "7.4", "8.1"] },
    { "id": 4, "tasks": ["8.2"] },
    { "id": 5, "tasks": ["8.3", "8.4"] },
    { "id": 6, "tasks": ["8.5", "10.1", "10.2", "10.3"] },
    { "id": 7, "tasks": ["12.1"] },
    { "id": 8, "tasks": ["12.2"] },
    { "id": 9, "tasks": ["12.3"] },
    { "id": 10, "tasks": ["13.1", "13.3"] },
    { "id": 11, "tasks": ["13.2"] },
    { "id": 12, "tasks": ["14.1", "13.4"] },
    { "id": 13, "tasks": ["15.1", "14.2", "14.3", "14.4"] },
    { "id": 14, "tasks": ["15.2"] },
    { "id": 15, "tasks": ["15.3", "15.4"] },
    { "id": 16, "tasks": ["15.5", "16"] }
  ]
}
```
