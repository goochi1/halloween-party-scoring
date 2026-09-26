import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  initApp,
  createInitialState,
  renderGrid,
  TEAMS,
  GAMES,
} from "./app.js";

// Task 10.1 — grid-structure and startup integration tests.
// Loads the real index.html into jsdom so assertions reflect the actual built
// markup, then exercises startup via the exported render/init functions.
// _Requirements: 1.5, 2.1, 3.1, 4.1, 4.2, 4.3, 4.4, 10.1, 10.2, 10.3_

// Under jsdom, import.meta.url is not a file: URL, so resolve via a real path.
const here = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(join(here, "index.html"), "utf8");
const appSource = readFileSync(join(here, "app.js"), "utf8");

const TEAM_IDS = TEAMS.map((t) => t.id);
const GAME_IDS = GAMES.map((g) => g.id);

// Inject only the <body> contents so we replace the document body with the real
// markup without duplicating <html>/<head>. Reset between tests for determinism.
function injectIndexHtml() {
  const bodyMatch = indexHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyInner = bodyMatch ? bodyMatch[1] : indexHtml;
  document.body.innerHTML = bodyInner;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("grid structure (Req 2.1, 3.1, 4.1, 4.3)", () => {
  beforeEach(() => {
    injectIndexHtml();
  });

  it("has exactly 24 .score-cell inputs covering every (team, game) once", () => {
    const cells = document.querySelectorAll(".score-cell");
    expect(cells.length).toBe(24);

    const seen = new Set();
    cells.forEach((cell) => {
      expect(cell.tagName).toBe("INPUT");
      const team = cell.getAttribute("data-team");
      const game = cell.getAttribute("data-game");
      expect(TEAM_IDS).toContain(team);
      expect(GAME_IDS).toContain(game);
      const key = team + ":" + game;
      expect(seen.has(key)).toBe(false); // no duplicate combination
      seen.add(key);
    });

    // All 24 (team, game) combinations present exactly once.
    expect(seen.size).toBe(24);
    for (const team of TEAM_IDS) {
      for (const game of GAME_IDS) {
        expect(seen.has(team + ":" + game)).toBe(true);
      }
    }
  });

  it("has four [data-total] elements for teams A/B/C/D (Req 3.1)", () => {
    const totals = document.querySelectorAll("[data-total]");
    expect(totals.length).toBe(4);
    const totalTeams = Array.from(totals)
      .map((el) => el.getAttribute("data-total"))
      .sort();
    expect(totalTeams).toEqual(["A", "B", "C", "D"]);
  });

  // ---- New layout (Task 12): teams-as-rows, games-as-columns, right-hand
  // Total column, editable team-name row labels, and matchup toggles in the
  // head-to-head game headers. These lock in the orientation so a regression
  // back to games-as-rows (or a lost Total column) fails here (Req 4.1–4.11).

  it("lays out four team ROWS, each with 6 score cells and one right-hand [data-total] (Req 4.1, 4.2, 4.3)", () => {
    const rows = document.querySelectorAll("tr.team-row[data-team-row]");
    expect(rows.length).toBe(4);

    const rowTeams = Array.from(rows)
      .map((r) => r.getAttribute("data-team-row"))
      .sort();
    expect(rowTeams).toEqual(["A", "B", "C", "D"]);

    rows.forEach((row) => {
      const team = row.getAttribute("data-team-row");

      // Exactly six .score-cell inputs in the row, all for THIS team, one per game.
      const cells = row.querySelectorAll(".score-cell");
      expect(cells.length).toBe(6);
      const gamesInRow = [];
      cells.forEach((cell) => {
        expect(cell.getAttribute("data-team")).toBe(team);
        gamesInRow.push(cell.getAttribute("data-game"));
      });
      expect(gamesInRow.slice().sort()).toEqual(GAME_IDS.slice().sort());

      // Exactly one right-hand Total cell for this team, and it's the last cell.
      const totalCells = row.querySelectorAll("[data-total]");
      expect(totalCells.length).toBe(1);
      expect(totalCells[0].getAttribute("data-total")).toBe(team);
      expect(totalCells[0].classList.contains("team-total")).toBe(true);
      expect(row.lastElementChild).toBe(totalCells[0]);
    });
  });

  it("has one editable [data-team-name] input per team with the default 'Team X' placeholders (Req 4.6)", () => {
    const nameInputs = document.querySelectorAll("[data-team-name]");
    expect(nameInputs.length).toBe(4);

    const byTeam = {};
    nameInputs.forEach((input) => {
      expect(input.tagName).toBe("INPUT");
      expect(input.classList.contains("team-name-input")).toBe(true);
      byTeam[input.getAttribute("data-team-name")] = input;
    });

    expect(Object.keys(byTeam).sort()).toEqual(["A", "B", "C", "D"]);
    expect(byTeam.A.getAttribute("placeholder")).toBe("Team A");
    expect(byTeam.B.getAttribute("placeholder")).toBe("Team B");
    expect(byTeam.C.getAttribute("placeholder")).toBe("Team C");
    expect(byTeam.D.getAttribute("placeholder")).toBe("Team D");
  });

  it("has a header row with the six game names in Config order plus a Total header (Req 4.2)", () => {
    const headerCells = document.querySelectorAll("thead tr th");
    const headerText = Array.from(headerCells).map((th) =>
      th.textContent.replace(/\s+/g, " ").trim()
    );

    // Leftmost corner label, then the six game names in order, then Total.
    const gameNames = Array.from(document.querySelectorAll("thead .game-name")).map(
      (el) => el.textContent.trim()
    );
    expect(gameNames).toEqual(GAMES.map((g) => g.label));

    // The rightmost header is the Total column label.
    expect(document.querySelector("thead .total-label")).not.toBeNull();
    expect(headerText[headerText.length - 1]).toBe("Total");
  });

  it("has exactly 3 matchup toggles on the head-to-head games and none elsewhere (Req 4.7)", () => {
    const toggles = document.querySelectorAll("[data-matchup-toggle]");
    expect(toggles.length).toBe(3);

    const toggleGames = Array.from(toggles)
      .map((b) => b.getAttribute("data-matchup-toggle"))
      .sort();
    expect(toggleGames).toEqual(["ghost-catcher", "pumpkin-toss", "quiet-place"]);

    // The other games carry no matchup toggle.
    for (const game of ["abcd-names", "bone-finder", "human-centipede"]) {
      expect(
        document.querySelector(`[data-matchup-toggle="${game}"]`)
      ).toBeNull();
    }
  });

  it("has the HALLOWEEN PARTY title and message banner, and no reset button", () => {
    const title = document.querySelector(".title");
    expect(title).not.toBeNull();
    expect(title.textContent).toContain("HALLOWEEN PARTY");

    // The reset button was removed from the UI by request.
    expect(document.querySelector("#reset-button")).toBeNull();
    expect(document.querySelector("#message-banner")).not.toBeNull();
  });
});

describe("empty cells render empty on load (Req 4.4)", () => {
  it("renders every cell empty and every total 0 for the initial state", () => {
    injectIndexHtml();

    renderGrid(createInitialState());

    document.querySelectorAll(".score-cell").forEach((cell) => {
      expect(cell.value).toBe("");
    });

    document.querySelectorAll("[data-total]").forEach((total) => {
      expect(total.textContent).toBe("0");
    });

    // Team-name inputs start empty and fall back to their default placeholders.
    document.querySelectorAll("[data-team-name]").forEach((input) => {
      expect(input.value).toBe("");
      const team = input.getAttribute("data-team-name");
      expect(input.getAttribute("placeholder")).toBe(`Team ${team}`);
    });
  });

  it("initApp with empty storage leaves cells empty and totals 0", () => {
    injectIndexHtml();
    localStorage.clear();

    initApp();

    document.querySelectorAll(".score-cell").forEach((cell) => {
      expect(cell.value).toBe("");
    });
    document.querySelectorAll("[data-total]").forEach((total) => {
      expect(total.textContent).toBe("0");
    });
    document.querySelectorAll("[data-team-name]").forEach((input) => {
      expect(input.value).toBe("");
    });
  });
});

describe("single screen, no navigation (Req 1.5, 4.2)", () => {
  beforeEach(() => {
    injectIndexHtml();
  });

  it("has exactly one main container (#app)", () => {
    const mains = document.querySelectorAll("main");
    expect(mains.length).toBe(1);
    expect(document.querySelector("#app")).not.toBeNull();
  });

  it("has no navigating <a href> links", () => {
    const navLinks = Array.from(document.querySelectorAll("a[href]")).filter(
      (a) => {
        const href = (a.getAttribute("href") || "").trim();
        // A bare "#" or empty in-page anchor doesn't navigate away.
        return href !== "" && href !== "#";
      }
    );
    expect(navLinks.length).toBe(0);
  });

  it("presents the grid on load with no configuration step (Req 1.5)", () => {
    // The grid and all 24 cells are present immediately, before any init/setup.
    expect(document.querySelector("#score-grid")).not.toBeNull();
    expect(document.querySelectorAll(".score-cell").length).toBe(24);
  });
});

describe("local-only, no backend, no login (Req 10.1, 10.2, 10.3)", () => {
  it("app.js makes no network calls (no fetch / XMLHttpRequest / remote URLs)", () => {
    // Pure localStorage + DOM: the source must not reference any network API.
    expect(appSource).not.toMatch(/\bfetch\s*\(/);
    expect(appSource).not.toMatch(/XMLHttpRequest/);
    expect(appSource).not.toMatch(/\bWebSocket\b/);
    expect(appSource).not.toMatch(/navigator\.sendBeacon/);
    // No remote endpoints embedded in the scoring logic.
    expect(appSource).not.toMatch(/https?:\/\//);
  });

  it("index.html has no login/account UI (no password/email inputs)", () => {
    injectIndexHtml();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(document.querySelector('input[type="email"]')).toBeNull();
    // No sign-in style form controls.
    const authNamed = document.querySelectorAll(
      'input[name*="user" i], input[name*="pass" i], input[name*="email" i], input[autocomplete*="password" i]'
    );
    expect(authNamed.length).toBe(0);
  });
});
