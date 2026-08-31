import { readFileSync, writeFileSync } from "node:fs";

const LOGIN = "arin-paliwal";
const JOINED = new Date("2022-02-22");
const BAR_X = 64;
const BAR_W = 1072;
const BAR_GAP = 4;
const IGNORED = new Set(["Other", "YAML", "JSON", "TOML", "Markdown", "Text", "Ezhil"]);
const SEG_FILLS = {
  "stats-dark.svg": ["#d4d4d4", "#8a8a8a", "#525252", "#3a3a3a"],
  "stats-light.svg": ["#404040", "#6f6f6f", "#a3a3a3", "#c9c9c9"],
};

const ghHeaders = { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "Content-Type": "application/json" };

const gql = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: ghHeaders,
  body: JSON.stringify({
    query: `{ user(login: "${LOGIN}") { contributionsCollection { contributionCalendar { totalContributions } } } }`,
  }),
}).then((r) => r.json());
const contrib = gql.data.user.contributionsCollection.contributionCalendar.totalContributions;

const user = await fetch(`https://api.github.com/users/${LOGIN}`, { headers: ghHeaders }).then((r) => r.json());
const years = Math.floor((Date.now() - JOINED.getTime()) / (365.25 * 24 * 3600 * 1000));

const wakaKey = process.env.WAKATIME_API_KEY;
const wakaAuth = { Authorization: `Basic ${Buffer.from(wakaKey).toString("base64")}` };

let hours = null;
let languages = null;
try {
  const total = await fetch("https://wakatime.com/api/v1/users/current/all_time_since_today", { headers: wakaAuth }).then((r) => r.json());
  hours = Math.floor(total.data.total_seconds / 3600);
  const stats = await fetch("https://wakatime.com/api/v1/users/current/stats/all_time", { headers: wakaAuth }).then((r) => r.json());
  languages = stats.data.languages.filter((l) => !IGNORED.has(l.name)).slice(0, 4);
} catch (err) {
  console.warn("wakatime fetch failed, keeping existing values:", err.message);
}

const tiles = {
  "stat-contrib": contrib.toLocaleString("en-US"),
  "stat-hours": hours ? `${hours.toLocaleString("en-US")}+` : null,
  "stat-repos": String(user.public_repos),
  "stat-years": `${years}+`,
};

for (const [file, fills] of Object.entries(SEG_FILLS)) {
  const path = `assets/${file}`;
  let svg = readFileSync(path, "utf8");

  for (const [id, value] of Object.entries(tiles)) {
    if (!value) continue;
    svg = svg.replace(new RegExp(`(id="${id}"[^>]*>)[^<]*(</text>)`), `$1${value}$2`);
  }

  if (languages) {
    let x = BAR_X;
    languages.forEach((lang, i) => {
      const w = Math.max(6, Math.round((BAR_W * lang.percent) / 100));
      svg = svg.replace(
        new RegExp(`<rect id="seg${i + 1}"[^>]*/>`),
        `<rect id="seg${i + 1}" x="${x}" y="306" width="${w}" height="7" rx="3.5" fill="${fills[i]}"/>`,
      );
      svg = svg.replace(
        new RegExp(`(<text id="leg${i + 1}"[^>]*>)[^<]*(</text>)`),
        `$1${lang.name.toUpperCase()} ${lang.percent.toFixed(1)}%$2`,
      );
      x += w + BAR_GAP;
    });
  }

  writeFileSync(path, svg);
}

console.log("updated:", tiles, languages?.map((l) => `${l.name} ${l.percent}%`));
