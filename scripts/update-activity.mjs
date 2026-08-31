import { readFileSync, writeFileSync } from "node:fs";

const LOGIN = "arin-paliwal";
const MAX_LEN = 76;

const headers = { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` };
const events = await fetch(`https://api.github.com/users/${LOGIN}/events/public?per_page=100`, { headers }).then((r) => r.json());

function ago(iso) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}H AGO`;
  return `${Math.round(hrs / 24)}D AGO`;
}

function shortRepo(full) {
  return full.replace(`${LOGIN}/`, "");
}

const items = [];
for (const e of Array.isArray(events) ? events : []) {
  if (items.length >= 5) break;
  const repo = shortRepo(e.repo?.name ?? "");
  let text = null;
  if (e.type === "PushEvent") {
    const n = e.payload.commits?.length ?? e.payload.size ?? 0;
    text = n > 0 ? `pushed ${n} commit${n === 1 ? "" : "s"} to ${repo}` : `pushed to ${repo}`;
  } else if (e.type === "PullRequestEvent" && ["opened", "closed"].includes(e.payload.action)) {
    const verb = e.payload.action === "opened" ? "opened" : e.payload.pull_request?.merged ? "merged" : "closed";
    text = `${verb} a pull request in ${repo}`;
  } else if (e.type === "CreateEvent" && e.payload.ref_type === "repository") {
    text = `created a new repo: ${repo}`;
  } else if (e.type === "WatchEvent") {
    text = `starred ${repo}`;
  } else if (e.type === "ReleaseEvent" && e.payload.action === "published") {
    text = `published a release in ${repo}`;
  } else if (e.type === "IssuesEvent" && e.payload.action === "opened") {
    text = `opened an issue in ${repo}`;
  }
  if (!text) continue;
  if (items.length && items[items.length - 1].text === text) continue;
  items.push({ time: ago(e.created_at), text });
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, MAX_LEN);

const now = new Date().toISOString().slice(0, 16).replace("T", " ");

for (const file of ["assets/activity-dark.svg", "assets/activity-light.svg"]) {
  let svg = readFileSync(file, "utf8");
  for (let i = 1; i <= 5; i++) {
    const item = items[i - 1];
    svg = svg.replace(new RegExp(`(id="act${i}-time"[^>]*>)[^<]*(</text>)`), `$1${item ? item.time : "&#160;"}$2`);
    svg = svg.replace(new RegExp(`(id="act${i}-text"[^>]*>)[^<]*(</text>)`), `$1${item ? esc(item.text) : "&#160;"}$2`);
  }
  svg = svg.replace(/(id="act-updated"[^>]*>)[^<]*(<\/text>)/, `$1SYNCED ${now} UTC$2`);
  writeFileSync(file, svg);
}

console.log("activity updated:", items);
