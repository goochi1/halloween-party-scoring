// Halloween Party Scoring — single-file app.
//
// Structure: pure modules (Config, Validation, Totals, Persistence) are defined
// and exported so they can be imported into a Node/jsdom test context without a
// real DOM. The DOM-facing Controller/Render layer is also exported, but the
// bootstrap that touches `document` is guarded so importing this module in tests
// does not require a browser.
//
// This is the scaffold: pure modules expose their public signatures and the
// DOM layer exposes stubs. Behavior is filled in by later tasks.

// ---------------------------------------------------------------------------
// Config module — single source of truth for teams, games, and constants.
// ---------------------------------------------------------------------------

// The four competing teams, in display order (Req 1.1).
export const TEAMS = [
  { id: "A", label: "Team A" },
  { id: "B", label: "Team B" },
  { id: "C", label: "Team C" },
  { id: "D", label: "Team D" },
];

// The six party games, in required display order (Req 1.2), with matchup text
// only for the games that define one (Req 1.3, 1.4).
export const GAMES = [
  { id: "abcd-names", label: "ABCD Names" },
  { id: "bone-finder", label: "Bone Finder" },
  { id: "ghost-catcher", label: "Ghost Catcher", matchup: "Team A vs Team B & Team C vs Team D", matchupPairs: [["A", "B"], ["C", "D"]] },
  { id: "pumpkin-toss", label: "Pumpkin Toss", matchup: "Team A vs Team C & Team B vs Team D", matchupPairs: [["A", "C"], ["B", "D"]] },
  { id: "quiet-place", label: "Quiet Place", matchup: "Team A vs Team D & Team B vs Team C", matchupPairs: [["A", "D"], ["B", "C"]] },
  { id: "human-centipede", label: "Human Centipede" },
];

// Games that permit negative scores — Quiet Place only (Req 2.4).
export const NEGATIVE_ALLOWED = new Set(["quiet-place"]);

export const SCORE_MIN = -999;
export const SCORE_MAX = 999;

// Maximum length of a custom team name; longer names are clamped (Req 11.5).
export const NAME_MAX_LEN = 30;

export const Config = { TEAMS, GAMES, NEGATIVE_ALLOWED, SCORE_MIN, SCORE_MAX, NAME_MAX_LEN };

// ---------------------------------------------------------------------------
// Validation module (pure).
// ---------------------------------------------------------------------------
// Validate a raw cell input against the scoring rules (Req 2.2, 2.4, 2.5, 2.6, 3.6).
// Returns a ValidationResult:
//   { ok: true,  value: number }
//   { ok: false, value: number, reason: "non-integer" | "out-of-range" | "negative-not-allowed" }
// On rejection, `value` is the retained `previousValue`.
export function validateScoreInput(raw, gameId, previousValue = 0) {
  const trimmed = String(raw == null ? "" : raw).trim();

  // Empty string is a cleared cell -> treated as 0 and accepted (Req 4.4).
  if (trimmed === "") {
    return { ok: true, value: 0 };
  }

  // Strictly match an optional leading + or - sign followed by digits only.
  // This rejects decimals ("1.5"), non-numerics ("abc"), lone signs ("+", "-"),
  // "NaN", "Infinity", and exponent notation ("1e3"). ASCII digits only, so
  // unicode digits are rejected as well.
  if (!/^[+-]?\d+$/.test(trimmed)) {
    return { ok: false, value: previousValue, reason: "non-integer" };
  }

  const value = Number.parseInt(trimmed, 10);

  // Defensive: guard against non-finite results (shouldn't occur given the regex).
  if (!Number.isInteger(value)) {
    return { ok: false, value: previousValue, reason: "non-integer" };
  }

  // Range check [-999, 999] (Req 2.6).
  if (value < SCORE_MIN || value > SCORE_MAX) {
    return { ok: false, value: previousValue, reason: "out-of-range" };
  }

  // Negatives only allowed for games in NEGATIVE_ALLOWED (Req 2.4, 2.5).
  if (value < 0 && !NEGATIVE_ALLOWED.has(gameId)) {
    return { ok: false, value: previousValue, reason: "negative-not-allowed" };
  }

  return { ok: true, value };
}

export const Validation = { validateScoreInput };

// ---------------------------------------------------------------------------
// Totals module (pure). (Task 3 fills in the arithmetic.)
// ---------------------------------------------------------------------------
// Sum a team's six game scores, treating missing/unset cells as zero
// (Req 2.3, 3.2, 3.3, 4.5).
export function teamTotal(scores, team) {
  const teamScores = (scores && scores[team]) || {};
  let sum = 0;
  for (const game of GAMES) {
    const value = teamScores[game.id];
    if (typeof value === "number" && Number.isFinite(value)) {
      sum += value;
    }
  }
  return sum;
}

// Return every team's total as Record<TeamId, number>.
export function allTotals(scores) {
  const totals = {};
  for (const team of TEAMS) {
    totals[team.id] = teamTotal(scores, team.id);
  }
  return totals;
}

// Format a total with a leading minus sign iff negative, preserving magnitude
// digits (e.g. -5 -> "-5", 0 -> "0", 12 -> "12") (Req 3.5).
export function formatTotal(total) {
  return total < 0 ? "-" + Math.abs(total) : String(total);
}

export const Totals = { teamTotal, allTotals, formatTotal };

// ---------------------------------------------------------------------------
// Names module (pure) — resolves and normalizes custom team names (Req 11).
//
// A NameMap is Record<TeamId, string>: it holds only custom names. An absent
// entry, an empty string, or a whitespace-only string all mean "use the default
// label" — that fallback is resolved at display time by teamLabel, so the map
// itself never has to store defaults. Custom names are clamped to NAME_MAX_LEN
// (30) characters but are NOT trimmed when stored (the Host may be mid-typing);
// trimming only decides default-vs-custom inside teamLabel.
// ---------------------------------------------------------------------------

// Look up a team's default label ("Team A".."Team D") from Config TEAMS.
// Falls back to the raw teamId if it is not a known team.
function defaultTeamLabel(teamId) {
  const team = TEAMS.find((t) => t.id === teamId);
  return team ? team.label : (teamId == null ? "" : String(teamId));
}

// Resolve a team's display label (Req 11.2, 11.4, 11.6): return the custom name
// when names[teamId] is a string that is non-empty after trimming (internal
// formatting preserved), else the team's default label. Unknown team ids fall
// back to the default lookup (the TEAMS label, or the id itself if truly
// unknown, or "" if nullish).
export function teamLabel(names, teamId) {
  const raw = names && names[teamId];
  if (typeof raw === "string" && raw.trim() !== "") {
    return raw;
  }
  return defaultTeamLabel(teamId);
}

// Return the raw stored custom name for a team, or "" when unset/non-string.
export function getName(names, teamId) {
  const raw = names && names[teamId];
  return typeof raw === "string" ? raw : "";
}

// Immutable update: return a NEW NameMap with teamId set to `raw` clamped to
// NAME_MAX_LEN characters (Req 11.5). Not trimmed — the Host may be typing
// spaces. Other teams' names are preserved.
export function setName(names, teamId, raw) {
  const next = Object.assign({}, names);
  next[teamId] = String(raw == null ? "" : raw).slice(0, NAME_MAX_LEN);
  return next;
}

// Coerce arbitrary parsed data into a clean NameMap (Req 11.5, 11.6):
//   - start from an empty object,
//   - for each known TEAM id, if raw[id] is a string, store it clamped to
//     NAME_MAX_LEN (consistent with setName — no trimming); "" is kept as unset,
//   - drop non-string values (treated as unset),
//   - drop unknown team ids.
export function normalizeNames(raw) {
  const map = {};
  if (raw == null || typeof raw !== "object") {
    return map;
  }
  for (const team of TEAMS) {
    const value = raw[team.id];
    if (typeof value === "string") {
      map[team.id] = value.slice(0, NAME_MAX_LEN);
    }
  }
  return map;
}

// The default/empty NameMap for the controller and persistence. Kept simple:
// an empty object means "all teams use their default label".
export function emptyNameMap() {
  return {};
}

export const Names = { teamLabel, getName, setName, normalizeNames, emptyNameMap, NAME_MAX_LEN };

// ---------------------------------------------------------------------------
// Matchup module (pure) — builds a head-to-head game's announcement text from
// its structured `matchupPairs`, substituting each team id with its current
// label via teamLabel (Req 12.3, 12.4).
//
// Because every id is resolved through teamLabel, a team with a custom name
// always shows that name and the literal "Team X" default appears only where a
// name is unset. The number and grouping of pairs is preserved: each pair
// renders as "LABEL_A vs LABEL_B" and pairs join with " & ", so with default
// names the output reproduces the original human-readable matchup string.
// ---------------------------------------------------------------------------

// Separator between "vs" sides within one pair and between pairs.
const MATCHUP_VS = " vs ";
const MATCHUP_JOIN = " & ";

// Look up a game's Config entry by id, or undefined if not a known game.
export function gameById(gameId) {
  return GAMES.find((g) => g.id === gameId);
}

// Build the matchup announcement text. `pairs` is an array of [teamIdA, teamIdB]
// tuples; `names` is a NameMap. Returns "" for null/empty pairs. Malformed pairs
// (not a 2-length array) are skipped defensively so a bad entry can't break the
// whole announcement.
export function formatMatchup(pairs, names) {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    return "";
  }
  const parts = [];
  for (const pair of pairs) {
    if (!Array.isArray(pair) || pair.length !== 2) {
      continue;
    }
    const left = teamLabel(names, pair[0]);
    const right = teamLabel(names, pair[1]);
    parts.push(left + MATCHUP_VS + right);
  }
  return parts.join(MATCHUP_JOIN);
}

export const Matchup = { formatMatchup, gameById };

// ---------------------------------------------------------------------------
// Persistence module — localStorage adapter. (Task 6 fills in save/load/clear.)
// ---------------------------------------------------------------------------
export const STORAGE_KEY = "halloween-party-scoring:v1";

// The persisted schema version. Version 2 adds a `names` map alongside scores;
// legacy version 1 payloads (scores only) are migrated forward on load.
const STORAGE_VERSION = 2;

// Return the live localStorage object, or null if it cannot be accessed.
// Merely *referencing* localStorage can throw (e.g. SecurityError in some
// sandboxed/blocked contexts), so the access itself is wrapped in try/catch.
function getStorage() {
  try {
    // eslint-disable-next-line no-undef
    const ls = typeof localStorage !== "undefined" ? localStorage : null;
    return ls || null;
  } catch (_e) {
    return null;
  }
}

// Feature-probe: can we actually read and write localStorage in this session?
// Used by the controller to decide whether persistence is available.
export function isStorageAvailable() {
  const ls = getStorage();
  if (!ls) {
    return false;
  }
  try {
    const probe = "__hps_probe__";
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return true;
  } catch (_e) {
    return false;
  }
}

// Build a complete, all-zero ScoreMap from Config TEAMS/GAMES. Exported so the
// controller and tests can reuse the canonical empty shape.
export function emptyScoreMap() {
  const map = {};
  for (const team of TEAMS) {
    const row = {};
    for (const game of GAMES) {
      row[game.id] = 0;
    }
    map[team.id] = row;
  }
  return map;
}

// Coerce a single stored cell value into a valid Game_Score, else 0.
// Rejects non-integers, out-of-range values, and illegal negatives.
function coerceCellValue(raw, gameId) {
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    return 0;
  }
  if (raw < SCORE_MIN || raw > SCORE_MAX) {
    return 0;
  }
  if (raw < 0 && !NEGATIVE_ALLOWED.has(gameId)) {
    return 0;
  }
  return raw;
}

// Normalize arbitrary parsed `scores` data into a complete ScoreMap: every team
// (A–D) and every game present, unknown teams/games dropped, missing cells
// defaulted to 0, and out-of-range/illegal values coerced to 0.
function normalizeScores(rawScores) {
  const map = emptyScoreMap();
  if (rawScores == null || typeof rawScores !== "object") {
    return map;
  }
  for (const team of TEAMS) {
    const rawRow = rawScores[team.id];
    if (rawRow == null || typeof rawRow !== "object") {
      continue;
    }
    for (const game of GAMES) {
      map[team.id][game.id] = coerceCellValue(rawRow[game.id], game.id);
    }
  }
  return map;
}

// Read and validate persisted scores. Never throws.
export function loadScores() {
  const ls = getStorage();
  if (!ls) {
    return { status: "unavailable" };
  }

  let rawString;
  try {
    rawString = ls.getItem(STORAGE_KEY);
  } catch (_e) {
    // getItem itself failed — treat as unavailable storage.
    return { status: "unavailable" };
  }

  if (rawString == null) {
    return { status: "empty" };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawString);
  } catch (_e) {
    return { status: "invalid" };
  }

  // Shape check: must be an object carrying a scores object.
  if (
    parsed == null ||
    typeof parsed !== "object" ||
    parsed.scores == null ||
    typeof parsed.scores !== "object"
  ) {
    return { status: "invalid" };
  }

  // Version handling / migration.
  if (parsed.version === 2) {
    // Current shape: scores + names, both normalized.
    return {
      status: "ok",
      scores: normalizeScores(parsed.scores),
      names: normalizeNames(parsed.names),
    };
  }

  if (parsed.version === 1) {
    // Legacy scores-only payload — migrate forward: load scores, default names
    // (normalizeNames(undefined) -> {}). Never reported invalid (Req 5.8).
    return {
      status: "ok",
      scores: normalizeScores(parsed.scores),
      names: normalizeNames(undefined),
    };
  }

  // Any other/unknown version is not something we can trust.
  return { status: "invalid" };
}

// Persist the given ScoreMap and NameMap as `{ version:2, scores, names }`.
// Backward-tolerant: if called with only scores, names defaults to {} so we
// never write `undefined`. Never throws.
export function saveScores(scores, names) {
  const ls = getStorage();
  if (!ls) {
    return { ok: false };
  }
  try {
    const payload = JSON.stringify({
      version: STORAGE_VERSION,
      scores,
      names: names == null ? {} : names,
    });
    ls.setItem(STORAGE_KEY, payload);
    return { ok: true };
  } catch (_e) {
    return { ok: false };
  }
}

// Remove persisted scores. Never throws.
export function clearScores() {
  const ls = getStorage();
  if (!ls) {
    return { ok: false };
  }
  try {
    ls.removeItem(STORAGE_KEY);
    return { ok: true };
  } catch (_e) {
    return { ok: false };
  }
}

export const Persistence = {
  STORAGE_KEY,
  loadScores,
  saveScores,
  clearScores,
  isStorageAvailable,
  emptyScoreMap,
};

// ---------------------------------------------------------------------------
// Controller / Render (DOM-facing). Exported for tests but only run against a
// real document via initApp().
//
// Render functions are pure DOM writers: they read from a passed-in `state` and
// write to a passed-in `root` (defaulting to the global `document`) so they can
// be exercised under jsdom. They never read the DOM to derive state, and they
// guard every lookup so a missing element is skipped rather than throwing.
// ---------------------------------------------------------------------------

// A cell's identity key inside state.entered.
function entryKey(team, game) {
  return team + ":" + game;
}

// Build the initial app state: all-zero scores, no errors, nothing entered yet,
// storage assumed ok until the startup sequence (Task 8.4) probes it.
export function createInitialState() {
  return {
    scores: emptyScoreMap(),
    names: emptyNameMap(),
    errors: {},
    entered: new Set(),
    storage: "ok",
    // Id of the head-to-head game whose matchup overlay is currently open, or
    // null when the overlay is closed (Req 12.1, 12.5).
    openMatchup: null,
  };
}

// Look up the <input> for one cell. Returns null if absent.
function findCell(root, team, game) {
  if (!root || typeof root.querySelector !== "function") {
    return null;
  }
  return root.querySelector('.score-cell[data-team="' + team + '"][data-game="' + game + '"]');
}

// Render a single cell's value (Req 4.4, 4.5). An unset cell — value 0 that has
// not been explicitly entered — renders as empty; any other value renders as its
// number. This keeps 0 stored internally while showing a blank box on load.
export function renderCell(state, team, game, root = document) {
  const input = findCell(root, team, game);
  if (!input) {
    return;
  }
  const row = (state.scores && state.scores[team]) || {};
  const value = typeof row[game] === "number" ? row[game] : 0;
  const entered = state.entered && state.entered.has(entryKey(team, game));
  input.value = value === 0 && !entered ? "" : String(value);
}

// Render every team's Team_Total into its [data-total] cell (Req 3.1, 3.5).
// Totals are always derived here, never stored. Direct textContent writes keep
// each update O(1) and well within the 200ms budget (Req 3.4).
export function renderTotals(state, root = document) {
  if (!root || typeof root.querySelector !== "function") {
    return;
  }
  for (const team of TEAMS) {
    const el = root.querySelector('[data-total="' + team.id + '"]');
    if (!el) {
      continue;
    }
    el.textContent = formatTotal(teamTotal(state.scores, team.id));
  }
}

// Populate all 24 cells and the four totals (Req 4.1). Full-grid render used on
// startup and after a reset.
export function renderGrid(state, root = document) {
  for (const team of TEAMS) {
    for (const game of GAMES) {
      renderCell(state, team.id, game.id, root);
    }
  }
  renderTotals(state, root);
}

// Flag a cell as invalid with an accessible error indication (Req 2.5, 2.6, 3.6).
export function showCellError(team, game, reason, root = document) {
  const input = findCell(root, team, game);
  if (!input) {
    return;
  }
  input.classList.add("invalid");
  input.setAttribute("aria-invalid", "true");
  if (reason != null) {
    input.setAttribute("data-error", String(reason));
    input.setAttribute("title", String(reason));
  }
}

// Clear a cell's error indication.
export function clearCellError(team, game, root = document) {
  const input = findCell(root, team, game);
  if (!input) {
    return;
  }
  input.classList.remove("invalid");
  input.removeAttribute("aria-invalid");
  input.removeAttribute("data-error");
  input.removeAttribute("title");
}

// Show the non-blocking status/error banner (Req 5.2, 5.5, 5.6, 6.4, 10.5).
// `kind` drives styling via data-kind ("info" | "error").
export function showMessage(text, kind = "info", root = document) {
  if (!root || typeof root.querySelector !== "function") {
    return;
  }
  const banner = root.querySelector("#message-banner");
  if (!banner) {
    return;
  }
  banner.textContent = text == null ? "" : String(text);
  banner.setAttribute("data-kind", kind);
  banner.hidden = false;
}

// Hide and empty the banner.
export function clearMessage(root = document) {
  if (!root || typeof root.querySelector !== "function") {
    return;
  }
  const banner = root.querySelector("#message-banner");
  if (!banner) {
    return;
  }
  banner.textContent = "";
  banner.removeAttribute("data-kind");
  banner.hidden = true;
}

// Handle a single cell edit: validate the raw input against the previous stored
// value, update in-memory state on accept (or retain on reject), and keep the
// affected Team_Total in sync (Req 2.2, 2.4, 2.5, 2.6, 3.2, 3.6, 4.5).
//
// Deliberately does NOT re-render the edited cell's <input> — the user is still
// typing in it — but it does recompute and re-render totals. On reject, scores
// are left unchanged so the total naturally stays put (Req 3.6).
//
// Task 8.4 hooks debounced persistence in after this returns; nothing here
// touches storage.
export function handleCellInput(state, team, game, rawValue, root = document) {
  const key = entryKey(team, game);
  const row = (state.scores && state.scores[team]) || {};
  const previousValue = typeof row[game] === "number" ? row[game] : 0;

  const result = validateScoreInput(rawValue, game, previousValue);
  const trimmed = String(rawValue == null ? "" : rawValue).trim();

  if (result.ok) {
    if (state.scores[team]) {
      state.scores[team][game] = result.value;
    }

    // Track whether the cell should render as populated vs. empty (Req 4.4).
    // Non-empty input marks it entered; a cleared cell (empty text -> 0) drops
    // the marker so it renders blank again.
    if (trimmed !== "") {
      state.entered.add(key);
    } else if (result.value === 0) {
      state.entered.delete(key);
    }

    // Clear any prior error on this cell.
    clearCellError(team, game, root);
    delete state.errors[key];
  } else {
    // Reject: retain previous value (already in state.scores), flag the cell,
    // and leave the total unchanged (Req 3.6).
    state.errors[key] = result.reason;
    showCellError(team, game, result.reason, root);
  }

  // Recompute totals. On reject this is harmless (identical result); on accept
  // it reflects the new value (Req 3.2, 4.5). Cheaper than diffing which team
  // changed and keeps a single code path.
  renderTotals(state, root);

  return result;
}

// Wire input/change listeners onto every .score-cell so edits flow through
// handleCellInput (Req 2.2, 3.4). Uses "change" for commit-style validation so
// partial entry like a lone "-" isn't flagged mid-type, plus an "input"
// listener that live-updates totals ONLY while the current text parses as a
// valid, in-range integer for that game — giving responsive totals without
// firing error styling on every keystroke. Guards missing elements.
// The optional third argument `onChange(result, team, game)` is invoked after an
// accepted commit ("change") and after a live-accepted "input" so callers can
// react (e.g. schedule a debounced save) without this module knowing about
// persistence. It is optional; when absent, behavior is unchanged.
export function attachCellListeners(state, root = document, onChange) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return;
  }
  const cells = root.querySelectorAll(".score-cell[data-team][data-game]");
  cells.forEach((input) => {
    const team = input.getAttribute("data-team");
    const game = input.getAttribute("data-game");
    if (!team || !game) {
      return;
    }

    // Commit: full validation, error flagging, and authoritative state update.
    input.addEventListener("change", () => {
      const result = handleCellInput(state, team, game, input.value, root);
      if (typeof onChange === "function") {
        onChange(result, team, game);
      }
    });

    // Live: update the in-memory value and totals only when the current text is
    // already a valid entry, so totals track typing without flagging "-"/partial
    // input mid-entry. Anything not-yet-valid is left for the "change" commit.
    input.addEventListener("input", () => {
      const row = (state.scores && state.scores[team]) || {};
      const previousValue = typeof row[game] === "number" ? row[game] : 0;
      const preview = validateScoreInput(input.value, game, previousValue);
      const trimmed = input.value.trim();
      // Only mirror non-empty, valid text live; empty/clears and invalids wait
      // for commit so we don't churn state or zero a total mid-edit.
      if (preview.ok && trimmed !== "") {
        if (state.scores[team]) {
          state.scores[team][game] = preview.value;
        }
        state.entered.add(entryKey(team, game));
        renderTotals(state, root);
        if (typeof onChange === "function") {
          onChange(preview, team, game);
        }
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Editable team names (Req 11.1, 11.2, 11.3).
//
// Each team's row header th ([data-team-label="TEAMID"]) contains an
// <input data-team-name="TEAMID"> holding the editable custom name. The input
// is the source of truth the Host types into; renderTeamNames only writes it on
// full renders (startup/reset), never mid-typing. A resolved label (e.g. the
// total's aria-label) is updated via teamLabel so screen readers announce the
// current name.
// ---------------------------------------------------------------------------

// Set each team-name input's value to the raw stored custom name (Req 11.2).
// An empty stored name leaves the input empty so its placeholder (the default
// label) shows. Also refresh any resolved label surfaced outside the input
// (the total cell's aria-label). Guards missing elements; safe headless.
export function renderTeamNames(state, root = document) {
  if (!root || typeof root.querySelector !== "function") {
    return;
  }
  const names = (state && state.names) || {};
  for (const team of TEAMS) {
    const input = root.querySelector('[data-team-name="' + team.id + '"]');
    if (input) {
      // Only written on full renders, so we never clobber active typing.
      input.value = getName(names, team.id);
    }
    // Keep the total's accessible label in sync with the resolved name.
    const total = root.querySelector('[data-total="' + team.id + '"]');
    if (total) {
      total.setAttribute("aria-label", teamLabel(names, team.id) + " total");
    }
  }
}

// Handle a single team-name edit (Req 11.1, 11.2, 11.3, 11.5): clamp+store the
// raw value via setName (30-char cap) without trimming the user's in-progress
// text, refresh the resolved label display (total aria-label), and return the
// stored name. Never touches scores.
export function handleNameInput(state, team, rawValue, root = document) {
  state.names = setName(state.names, team, rawValue);
  const stored = getName(state.names, team);
  if (root && typeof root.querySelector === "function") {
    const total = root.querySelector('[data-total="' + team + '"]');
    if (total) {
      total.setAttribute("aria-label", teamLabel(state.names, team) + " total");
    }
  }
  return stored;
}

// Wire "input" listeners onto every [data-team-name] input so edits flow through
// handleNameInput, then invoke the optional onChange(team) so callers can react
// (e.g. schedule a debounced save). maxlength=30 limits typing in the browser;
// setName clamps defensively. Guards missing elements; safe headless.
export function attachNameListeners(state, root = document, onChange) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return;
  }
  const inputs = root.querySelectorAll("[data-team-name]");
  inputs.forEach((input) => {
    const team = input.getAttribute("data-team-name");
    if (!team) {
      return;
    }
    input.addEventListener("input", () => {
      handleNameInput(state, team, input.value, root);
      if (typeof onChange === "function") {
        onChange(team);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Matchup announcement controller (Req 12.1, 12.3, 12.4, 12.5, 12.6).
//
// The head-to-head game headers carry a [data-matchup-toggle="GAMEID"] button.
// Clicking one reveals #matchup-overlay whose #matchup-content shows the game's
// matchup, resolved from CURRENT team names via formatMatchup. Toggling the same
// game closes it; toggling a different game while open swaps the content and
// stays open. Dismiss/backdrop/Escape close it. None of this touches scores or
// names (Req 12.6). All lookups are guarded so the module is headless-safe.
// ---------------------------------------------------------------------------

// True when #matchup-overlay exists and is currently visible (not [hidden]).
function isMatchupOpen(root) {
  if (!root || typeof root.querySelector !== "function") {
    return false;
  }
  const overlay = root.querySelector("#matchup-overlay");
  return !!overlay && overlay.hidden !== true;
}

// Write the game's matchup text into #matchup-content using the CURRENT team
// names (Req 12.3, 12.4). Looks the game up via gameById; if it has no
// matchupPairs (not a head-to-head game) or the element/game is missing, does
// nothing. Does NOT change overlay visibility.
export function renderMatchupAnnouncement(state, gameId, root = document) {
  if (!root || typeof root.querySelector !== "function") {
    return;
  }
  const game = gameById(gameId);
  if (!game || !game.matchupPairs) {
    return;
  }
  const content = root.querySelector("#matchup-content");
  if (!content) {
    return;
  }
  const names = (state && state.names) || {};
  // Display-only: put the "&" on its own line between the two pairings so the
  // second pairing reads under the first. formatMatchup itself is unchanged
  // (still returns the " & "-joined string); we only reformat for the overlay.
  const text = formatMatchup(game.matchupPairs, names);
  content.textContent = text.replace(/ & /g, "\n&\n");
}

// Reveal the overlay for `gameId`: fill its content, un-hide #matchup-overlay,
// record the open game on state, and move focus to the dismiss control for
// accessibility (guarded if focus isn't available) (Req 12.1, 12.5).
export function showMatchup(state, gameId, root = document) {
  renderMatchupAnnouncement(state, gameId, root);
  if (!root || typeof root.querySelector !== "function") {
    return;
  }
  const overlay = root.querySelector("#matchup-overlay");
  if (!overlay) {
    return;
  }
  overlay.hidden = false;
  if (state) {
    state.openMatchup = gameId;
  }
  const dismiss = root.querySelector("#matchup-dismiss");
  if (dismiss && typeof dismiss.focus === "function") {
    try {
      dismiss.focus();
    } catch (_e) {
      // Focus is best-effort; ignore environments where it throws.
    }
  }
}

// Hide the overlay and clear the open-game marker. Never touches scores/names
// (Req 12.6).
export function hideMatchup(state, root = document) {
  if (state) {
    state.openMatchup = null;
  }
  if (!root || typeof root.querySelector !== "function") {
    return;
  }
  const overlay = root.querySelector("#matchup-overlay");
  if (!overlay) {
    return;
  }
  overlay.hidden = true;
}

// Toggle the matchup for `gameId`: if that game's overlay is already open, close
// it; otherwise open it (opening a different game while open just swaps content
// and keeps it open) (Req 12.1, 12.5).
export function toggleMatchup(state, gameId, root = document) {
  if (state && state.openMatchup === gameId && isMatchupOpen(root)) {
    hideMatchup(state, root);
  } else {
    showMatchup(state, gameId, root);
  }
}

// Wire the matchup controls (Req 12.1, 12.5, 12.6):
//   - each [data-matchup-toggle] button toggles its game's overlay,
//   - #matchup-dismiss closes the overlay,
//   - a click on the overlay backdrop (the overlay element itself, not the
//     inner panel) closes it; a click inside .matchup-overlay-inner does not,
//   - Escape closes it while open.
// Guards missing elements; safe headless.
export function attachMatchupListeners(state, root = document) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return;
  }

  const toggles = root.querySelectorAll("[data-matchup-toggle]");
  toggles.forEach((button) => {
    const gameId = button.getAttribute("data-matchup-toggle");
    if (!gameId) {
      return;
    }
    button.addEventListener("click", () => {
      toggleMatchup(state, gameId, root);
    });
  });

  if (typeof root.querySelector !== "function") {
    return;
  }

  const dismiss = root.querySelector("#matchup-dismiss");
  if (dismiss) {
    dismiss.addEventListener("click", () => {
      hideMatchup(state, root);
    });
  }

  const overlay = root.querySelector("#matchup-overlay");
  if (overlay) {
    // Backdrop click: only the overlay element itself dismisses. A click that
    // lands on the inner panel (or its descendants) leaves it open (Req 12.5).
    overlay.addEventListener("click", (event) => {
      if (event && event.target === overlay) {
        hideMatchup(state, root);
      }
    });
  }

  // Escape closes the overlay when it is open. A document-level listener keeps
  // this simple regardless of where focus currently sits.
  const doc = typeof root.addEventListener === "function" ? root : null;
  if (doc) {
    doc.addEventListener("keydown", (event) => {
      if (event && event.key === "Escape" && isMatchupOpen(root)) {
        hideMatchup(state, root);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Persistence wiring: debounced save + reset flow (Req 5.1, 5.2, 6.1–6.4).
// ---------------------------------------------------------------------------

// Kind marker written on the banner for a save-write failure, so a later
// successful save clears only that message and leaves an unavailable/invalid
// notice intact.
const SAVE_ERROR_KIND = "save-error";

// Module-level debounce timer for scheduleSave. A single timer is sufficient
// because there is one live app instance per document.
let _saveTimer = null;

// Debounced persist (~250ms) so rapid typing coalesces into one write, keeping
// the persist-within-1s requirement satisfied without thrashing storage (Req 5.1).
export function scheduleSave(state, root = document, delay = 250) {
  // If storage is known-unavailable, skip entirely — the unavailable message is
  // already shown and there is nothing to write (Req 5.5, 10.5).
  if (state && state.storage === "unavailable") {
    return;
  }

  if (_saveTimer != null) {
    clearTimeout(_saveTimer);
  }

  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    const result = saveScores(state.scores, state.names);
    if (!result || result.ok !== true) {
      // Write failed — keep in-memory scores/render intact, surface a message
      // (Req 5.2).
      showMessage("Couldn't save scores.", "error", root);
      if (root && typeof root.querySelector === "function") {
        const banner = root.querySelector("#message-banner");
        if (banner) {
          banner.setAttribute("data-kind", SAVE_ERROR_KIND);
        }
      }
    } else {
      // Success — clear only a lingering save-error banner; leave any
      // unavailable/invalid notice untouched.
      if (root && typeof root.querySelector === "function") {
        const banner = root.querySelector("#message-banner");
        if (banner && banner.getAttribute("data-kind") === SAVE_ERROR_KIND) {
          clearMessage(root);
        }
      }
    }
  }, delay);
}

// Ask for confirmation via the ambient confirm dialog, if one exists. In a
// headless context with no confirm available, treat as confirmed=false so
// nothing is destroyed implicitly.
function confirmReset() {
  const message = "Clear all scores? This cannot be undone.";
  if (typeof globalThis !== "undefined" && typeof globalThis.confirm === "function") {
    return globalThis.confirm(message);
  }
  // No dialog available (headless): do not clear anything implicitly.
  return false;
}

// Reset flow (Req 6.1–6.4). Requests confirmation first and modifies nothing on
// cancel. On confirm, clears the store (when available); a clear failure retains
// prior data and messages, while success (or nothing-to-clear) zeros all cells.
export function handleReset(state, root = document) {
  // Req 6.1: confirmation before clearing; Req 6.3: cancel retains everything.
  if (!confirmReset()) {
    return false;
  }

  // Req 6.2/6.4: only attempt to clear the store when storage is available.
  if (state.storage !== "unavailable") {
    const cleared = clearScores();
    if (!cleared || cleared.ok !== true) {
      // Clear failed — retain prior in-memory data and inform the user (Req 6.4).
      showMessage("Reset didn't complete — saved scores were kept.", "error", root);
      return false;
    }
  }

  // Success (or nothing to clear): zero all SCORES but KEEP team NAMES
  // (Req 6.4, 11.7). Names survive a reset.
  state.scores = emptyScoreMap();
  state.entered = new Set();
  state.errors = {};

  // clearScores removed the key entirely; immediately re-persist the kept names
  // (with zeroed scores) so the store retains them rather than being left empty.
  // A re-save failure is non-fatal — names remain in memory (Req 11.7).
  if (state.storage !== "unavailable") {
    saveScores(emptyScoreMap(), state.names);
  }

  for (const team of TEAMS) {
    for (const game of GAMES) {
      clearCellError(team.id, game.id, root);
    }
  }
  renderGrid(state, root);
  renderTeamNames(state, root);
  clearMessage(root);
  return true;
}

// Full startup sequence (Req 5.1, 5.3, 5.4, 5.5, 5.6, 6.1, 10.5): build state,
// load persisted scores, surface any storage messages while continuing to
// operate, render the grid, and wire input + reset handlers. Guarded so a
// headless import (no document) does nothing.
export function initApp() {
  if (typeof document === "undefined") {
    return;
  }
  const root = document;
  const state = createInitialState();

  const loaded = loadScores();
  switch (loaded.status) {
    case "ok":
      // Adopt saved scores AND names (Req 5.1, 11.3). Mark every non-zero cell
      // as entered so it renders as a number; zero cells stay empty per Req 4.4.
      state.scores = loaded.scores;
      state.names = loaded.names || {};
      for (const team of TEAMS) {
        for (const game of GAMES) {
          const value = state.scores[team.id] && state.scores[team.id][game.id];
          if (typeof value === "number" && value !== 0) {
            state.entered.add(entryKey(team.id, game.id));
          }
        }
      }
      state.storage = "ok";
      break;
    case "empty":
      // No saved data — leave zeros; writing works (Req 5.4).
      state.storage = "ok";
      break;
    case "invalid":
      // Corrupt/incompatible saved data — start fresh but keep writing (Req 5.6).
      showMessage("Saved scores were invalid; starting fresh.", "error", root);
      state.storage = "ok";
      break;
    case "unavailable":
    default:
      // Read failed / storage unusable — operate in-memory only (Req 5.5, 10.5).
      state.storage = "unavailable";
      showMessage(
        "Scores won't be saved — storage is unavailable in this browser session.",
        "info",
        root
      );
      break;
  }

  // Independently probe writability: a read can succeed while writes fail. If we
  // can't persist, downgrade to unavailable and message (unless already done).
  if (!isStorageAvailable()) {
    if (state.storage !== "unavailable") {
      state.storage = "unavailable";
      showMessage(
        "Scores won't be saved — storage is unavailable in this browser session.",
        "info",
        root
      );
    }
  }

  renderGrid(state, root);
  attachCellListeners(state, root, () => scheduleSave(state, root));

  // Editable team names (Req 11.1–11.3). Runs AFTER state.names has been adopted
  // from load above, so any custom names persisted in a v2 payload show on
  // startup. scheduleSave persists names alongside scores.
  renderTeamNames(state, root);
  attachNameListeners(state, root, () => scheduleSave(state, root));

  // Wire the matchup announcement toggles/overlay (Req 12.1, 12.5, 12.6). Runs
  // after names are adopted so the overlay reflects current custom names.
  attachMatchupListeners(state, root);

  // Wire the reset control (Req 6.1).
  if (typeof root.querySelector === "function") {
    const resetButton = root.querySelector("#reset-button");
    if (resetButton) {
      resetButton.addEventListener("click", () => handleReset(state, root));
    }
  }
}

export const Controller = {
  initApp,
  createInitialState,
  renderCell,
  renderTotals,
  renderGrid,
  showCellError,
  clearCellError,
  showMessage,
  clearMessage,
  handleCellInput,
  attachCellListeners,
  renderTeamNames,
  handleNameInput,
  attachNameListeners,
  renderMatchupAnnouncement,
  showMatchup,
  hideMatchup,
  toggleMatchup,
  attachMatchupListeners,
  scheduleSave,
  handleReset,
};

// ---------------------------------------------------------------------------
// DOM bootstrap — guarded so importing this module in a headless test context
// (no document) does nothing. In a browser, initialize on DOM ready.
// ---------------------------------------------------------------------------
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
}
