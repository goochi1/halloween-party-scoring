import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createInitialState,
  handleNameInput,
  renderTeamNames,
  attachNameListeners,
  teamLabel,
  getName,
  setName,
  TEAMS,
  NAME_MAX_LEN,
} from "./app.js";

// Task 13.4 — example tests for editable team names (Req 11.1–11.6).
// Loads the real index.html <body> into jsdom (with the <script> tag stripped
// so app.js doesn't auto-bootstrap) so assertions reflect the actual markup:
// per-team [data-team-name] inputs inside the row headers and [data-total]
// cells whose aria-label surfaces the resolved name.

// Resolve from process.cwd() (the package root) rather than import.meta.url,
// which is not a file: URL under jsdom.
const indexHtml = readFileSync(join(process.cwd(), "index.html"), "utf8");

// Inject only the <body> contents and strip the module <script> tag so
// importing/loading the markup never triggers app.js's own initApp bootstrap.
function injectIndexHtml() {
  const bodyMatch = indexHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyInner = bodyMatch ? bodyMatch[1] : indexHtml;
  const withoutScript = bodyInner.replace(/<script[\s\S]*?<\/script>/gi, "");
  document.body.innerHTML = withoutScript;
}

// Fire a native "input" event so attached listeners run.
function dispatchInput(el) {
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
}

function nameInput(team) {
  return document.querySelector('[data-team-name="' + team + '"]');
}

function totalCell(team) {
  return document.querySelector('[data-total="' + team + '"]');
}

function defaultLabel(team) {
  return TEAMS.find((t) => t.id === team).label;
}

beforeEach(() => {
  document.body.innerHTML = "";
  injectIndexHtml();
});

describe("editing a name updates rendered input/label and state (Req 11.1, 11.2)", () => {
  it("typing a name stores it in state and updates getName + total aria-label", () => {
    const state = createInitialState();
    attachNameListeners(state, document);

    const team = "A";
    const input = nameInput(team);
    input.value = "Ghosts";
    dispatchInput(input);

    expect(state.names[team]).toBe("Ghosts");
    expect(getName(state.names, team)).toBe("Ghosts");
    expect(totalCell(team).getAttribute("aria-label")).toBe("Ghosts total");
  });
});

describe("renderTeamNames reflects stored names on load (Req 11.2)", () => {
  it("writes stored names into inputs and leaves unset teams empty with default placeholder", () => {
    const state = createInitialState();
    state.names = setName(state.names, "B", "Witches");

    renderTeamNames(state, document);

    // Team with a stored name shows it in the input.
    expect(nameInput("B").value).toBe("Witches");

    // Team without a custom name: empty input, placeholder is the default label.
    const cInput = nameInput("C");
    expect(cInput.value).toBe("");
    expect(cInput.getAttribute("placeholder")).toBe(defaultLabel("C"));
  });
});

describe("empty / whitespace falls back to default label (Req 11.4, 11.6)", () => {
  it("teamLabel returns the default when the stored name is empty or whitespace", () => {
    const state = createInitialState();
    const team = "D";

    // Empty resolves to default.
    expect(teamLabel(state.names, team)).toBe(defaultLabel(team));

    // Whitespace-only: the raw value may be retained, but the resolved label
    // is still the default.
    handleNameInput(state, team, "   ", document);
    expect(teamLabel(state.names, team)).toBe(defaultLabel(team));
  });
});

describe("30-char clamp (Req 11.5)", () => {
  it("clamps a name longer than 30 characters to exactly the first 30", () => {
    const state = createInitialState();
    const team = "A";
    const long = "x".repeat(40);

    handleNameInput(state, team, long, document);

    expect(state.names[team].length).toBe(NAME_MAX_LEN);
    expect(state.names[team]).toBe(long.slice(0, NAME_MAX_LEN));
  });
});

describe("onChange callback fires on edit (persistence hook)", () => {
  it("invokes the callback with the edited team id", () => {
    const state = createInitialState();
    const spy = vi.fn();
    attachNameListeners(state, document, spy);

    const team = "C";
    const input = nameInput(team);
    input.value = "Skeletons";
    dispatchInput(input);

    expect(spy).toHaveBeenCalledWith(team);
  });
});

describe("editing a name does not change scores (Req 11.3)", () => {
  it("leaves state.scores unchanged after a name edit", () => {
    const state = createInitialState();
    const before = structuredClone(state.scores);

    handleNameInput(state, "B", "Mummies", document);

    expect(state.scores).toEqual(before);
  });
});
