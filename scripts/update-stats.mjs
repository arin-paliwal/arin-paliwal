import { readFileSync, writeFileSync } from "node:fs";

const LOGIN = "arin-paliwal";
const JOINED = new Date("2022-02-22");

const token = process.env.GITHUB_TOKEN;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const gql = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers,
  body: JSON.stringify({
    query: `{ user(login: "${LOGIN}") { contributionsCollection { contributionCalendar { totalContributions } } } }`,
  }),
}).then((r) => r.json());
const contrib = gql.data.user.contributionsCollection.contributionCalendar.totalContributions;

const user = await fetch(`https://api.github.com/users/${LOGIN}`, { headers }).then((r) => r.json());

const years = Math.floor((Date.now() - JOINED.getTime()) / (365.25 * 24 * 3600 * 1000));

const readme = readFileSync("README.md", "utf8");
const hoursMatch = readme.match(/Total Time:\s*([\d,]+)\s*hrs/);

const stats = {
  "stat-contrib": contrib.toLocaleString("en-US"),
  "stat-hours": hoursMatch ? `${hoursMatch[1]}+` : null,
  "stat-repos": String(user.public_repos),
  "stat-years": `${years}+`,
};

for (const file of ["assets/stats-dark.svg", "assets/stats-light.svg"]) {
  let svg = readFileSync(file, "utf8");
  for (const [id, value] of Object.entries(stats)) {
    if (!value) continue;
    svg = svg.replace(new RegExp(`(id="${id}"[^>]*>)[^<]*(</text>)`), `$1${value}$2`);
  }
  writeFileSync(file, svg);
}

console.log("updated stats:", stats);
