import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

const ROWS = 6;
const COLS = 7;
const CELL = 76;
const GRID_X = 334;
const GRID_Y = 132;
const R = 26;

const STATE_PATH = "game/state.json";
const TEAM_NAME = { S: "TEAM SOLID", H: "TEAM HOLLOW" };

const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));

const colArg = process.argv[2];
let message = null;

if (colArg && colArg !== "--render") {
  const col = parseInt(colArg, 10) - 1;
  if (!(col >= 0 && col < COLS)) {
    output("result", "invalid");
    output("message", "That column does not exist. Pick a column between 1 and 7.");
    process.exit(0);
  }
  let row = -1;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (state.board[r][col] === null) { row = r; break; }
  }
  if (row === -1) {
    output("result", "full");
    output("message", `Column ${col + 1} is already full. Pick another column from the board on my profile.`);
    process.exit(0);
  }

  const team = state.turn;
  state.board[row][col] = team;
  state.moves += 1;
  state.last = { col, row };

  if (wins(state.board, row, col, team)) {
    state.tally[team] += 1;
    message = `That was the winning move! ${TEAM_NAME[team]} takes game #${state.game}. A fresh board is up, come defend the title.`;
    resetBoard();
  } else if (state.moves === ROWS * COLS) {
    state.tally.D += 1;
    message = `Board full, game #${state.game} is a draw. New game is live, first move sets the tone.`;
    resetBoard();
  } else {
    state.turn = team === "S" ? "H" : "S";
    message = `Move played: ${TEAM_NAME[team].toLowerCase()} dropped into column ${col + 1}. ${TEAM_NAME[state.turn]} is up next, the board on my profile is live.`;
  }

  output("result", "played");
  output("message", message);
}

function resetBoard() {
  state.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  state.turn = state.game % 2 === 0 ? "S" : "H";
  state.game += 1;
  state.moves = 0;
  state.last = null;
}

function wins(b, r, c, t) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    let n = 1;
    for (const s of [1, -1]) {
      let rr = r + dr * s, cc = c + dc * s;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && b[rr][cc] === t) {
        n += 1; rr += dr * s; cc += dc * s;
      }
    }
    if (n >= 4) return true;
  }
  return false;
}

function output(key, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  else console.log(`${key}: ${value}`);
}

const THEMES = {
  "assets/game-board-dark.svg": {
    empty: "#1f1f1f", solid: "#ededed", hollow: "#8a8a8a",
    lastRing: "#ededed", text: "#525252",
  },
  "assets/game-board-light.svg": {
    empty: "#e5e5e5", solid: "#171717", hollow: "#6f6f6f",
    lastRing: "#171717", text: "#a3a3a3",
  },
};

for (const [file, t] of Object.entries(THEMES)) {
  let svg = readFileSync(file, "utf8");

  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = GRID_X + c * CELL + CELL / 2;
      const cy = GRID_Y + r * CELL + CELL / 2;
      const v = state.board[r][c];
      const isLast = state.last && state.last.row === r && state.last.col === c;
      if (v === "S") {
        cells.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="${t.solid}"${isLast ? ' class="dropin"' : ""}/>`);
      } else if (v === "H") {
        cells.push(`<circle cx="${cx}" cy="${cy}" r="${R - 3}" fill="none" stroke="${t.hollow}" stroke-width="5"${isLast ? ' class="dropin"' : ""}/>`);
      } else {
        cells.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${t.empty}" stroke-width="1.5"/>`);
      }
      if (isLast) {
        cells.push(`<circle cx="${cx}" cy="${cy}" r="${R + 7}" fill="none" stroke="${t.lastRing}" stroke-opacity="0.35" stroke-width="1.5" class="dropin"/>`);
      }
    }
  }

  svg = svg.replace(/<g id="board">[\s\S]*?<\/g><!--\/board-->/, `<g id="board">${cells.join("")}</g><!--/board-->`);
  svg = svg.replace(/(id="gamestat"[^>]*>)[^<]*(<\/text>)/, `$1GAME #${state.game} · ${state.moves} MOVES · SOLID ${state.tally.S} — HOLLOW ${state.tally.H} — DRAWS ${state.tally.D}$2`);
  svg = svg.replace(/(id="turnstat"[^>]*>)[^<]*(<\/text>)/, `$1${TEAM_NAME[state.turn]} TO MOVE$2`);
  writeFileSync(file, svg);
}

writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
console.log("board rendered", { game: state.game, moves: state.moves, turn: state.turn });
