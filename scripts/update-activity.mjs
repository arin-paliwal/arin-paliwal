import { readFileSync, writeFileSync } from "node:fs";

const LOGIN = "arin-paliwal";
const MAX_LEN = 76;
const MAX_ITEMS = 5;

const FONT_STACK = "'Geist', Inter, -apple-system, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO_STACK = "'Geist Mono', 'SF Mono', 'JetBrains Mono', 'Fira Code', Consolas, monospace";

const THEMES = {
  "assets/activity-dark.svg": {
    bg: "#0a0a0a", border: "#1f1f1f", dotfill: "#ffffff", dotop: "0.04",
    label: "#525252", value: "#c9c9c9", hairline: "#161616", faint: "#333333",
  },
  "assets/activity-light.svg": {
    bg: "#fafafa", border: "#e5e5e5", dotfill: "#0a0a0a", dotop: "0.06",
    label: "#a3a3a3", value: "#3d3d3d", hairline: "#f0f0f0", faint: "#d4d4d4",
  },
};

const headers = { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` };
const events = await fetch(`https://api.github.com/users/${LOGIN}/events/public?per_page=100`, { headers }).then((r) => r.json());

function ago(iso) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}H AGO`;
  return `${Math.round(hrs / 24)}D AGO`;
}

const shortRepo = (full) => full.replace(`${LOGIN}/`, "");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, MAX_LEN);

const items = [];
for (const e of Array.isArray(events) ? events : []) {
  if (items.length >= MAX_ITEMS) break;
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
  items.push({ time: ago(e.created_at), text: esc(text) });
}

if (items.length === 0) {
  items.push({ time: "QUIET", text: "nothing shipped publicly in the last few days" });
}

const now = new Date().toISOString().slice(0, 16).replace("T", " ");

function render(t, fonts) {
  const rows = [];
  items.forEach((item, i) => {
    const y = 84 + i * 68;
    rows.push(
      `  <g>\n` +
      `    <text x="64" y="${y}" class="mono" font-size="13" fill="${t.label}" letter-spacing="1.5">${item.time}</text>\n` +
      `    <text x="240" y="${y + 1}" font-size="18" fill="${t.value}" letter-spacing="0.2">${item.text}</text>\n` +
      `  </g>`,
    );
    if (i < items.length - 1) {
      rows.push(`  <line x1="64" y1="${y + 34}" x2="1136" y2="${y + 34}" stroke="${t.hairline}" stroke-width="1"/>`);
    }
  });
  const footY = 84 + (items.length - 1) * 68 + 34;
  const h = footY + 60;
  return `<svg width="1200" height="${h}" viewBox="0 0 1200 ${h}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="${t.dotfill}" fill-opacity="${t.dotop}"/>
    </pattern>
    <clipPath id="frame"><rect width="1200" height="${h}" rx="14"/></clipPath>
  </defs>
  <style>${fonts}
    text { font-family: ${FONT_STACK}; }
    .mono { font-family: ${MONO_STACK}; }
  </style>
  <g clip-path="url(#frame)">
    <rect width="1200" height="${h}" fill="${t.bg}"/>
    <rect width="1200" height="${h}" fill="url(#dots)"/>
  </g>
  <rect x="0.75" y="0.75" width="1198.5" height="${h - 1.5}" rx="13.25" fill="none" stroke="${t.border}" stroke-width="1.5"/>
${rows.join("\n")}
  <line x1="64" y1="${footY}" x2="1136" y2="${footY}" stroke="${t.hairline}" stroke-width="1"/>
  <text x="64" y="${footY + 38}" class="mono" font-size="13" fill="${t.label}" letter-spacing="1.5">RECENT SHIPMENTS</text>
  <text x="1136" y="${footY + 38}" text-anchor="end" class="mono" font-size="13" fill="${t.faint}" letter-spacing="1">SYNCED ${now} UTC</text>
</svg>
`;
}

for (const [file, t] of Object.entries(THEMES)) {
  const existing = readFileSync(file, "utf8");
  const fonts = (existing.match(/@font-face\{[\s\S]*?\}/g) ?? []).join("\n    ");
  writeFileSync(file, render(t, "\n    " + fonts));
}

console.log("activity updated:", items);
