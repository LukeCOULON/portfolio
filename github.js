// ============================================================
// Tout ce qui parle à l'API GitHub. Rien à modifier ici en temps normal.
// ============================================================

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function cacheSet(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

async function ghFetch(url, opts = {}) {
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json", ...(opts.headers || {}) }
  });
  if (!res.ok) {
    const err = new Error(`GitHub API a répondu ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return opts.raw ? res.text() : res.json();
}

// Liste des repos publics, forks et repos exclus retirés
async function fetchRepos() {
  const cacheKey = `gh:repos:${GITHUB_USER}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const data = await ghFetch(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`);
  const filtered = data
    .filter(r => !r.fork)
    .filter(r => !EXCLUDE_REPOS.includes(r.name));

  cacheSet(cacheKey, filtered);
  return filtered;
}

// Détails d'un repo précis
async function fetchRepo(name) {
  const cacheKey = `gh:repo:${GITHUB_USER}:${name}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const data = await ghFetch(`https://api.github.com/repos/${GITHUB_USER}/${name}`);
  cacheSet(cacheKey, data);
  return data;
}

// README brut (markdown) d'un repo, "" si absent
async function fetchReadme(name) {
  const cacheKey = `gh:readme:${GITHUB_USER}:${name}`;
  const cached = cacheGet(cacheKey);
  if (cached !== null) return cached;

  try {
    const text = await ghFetch(`https://api.github.com/repos/${GITHUB_USER}/${name}/readme`, {
      headers: { Accept: "application/vnd.github.raw" },
      raw: true
    });
    cacheSet(cacheKey, text);
    return text;
  } catch {
    cacheSet(cacheKey, "");
    return "";
  }
}

function getDescription(repo) {
  return DESCRIPTION_OVERRIDES[repo.name] || repo.description || "Pas encore de description sur GitHub.";
}

const LANG_COLORS = {
  javascript: "#ffb454", typescript: "#5aa9e6", python: "#6fd6c4", html: "#e0704a",
  css: "#a780e0", java: "#e0a15e", go: "#5ecbb0", rust: "#e0824f", c: "#8fa3b3",
  "c++": "#8fa3b3", "c#": "#7fae5e", ruby: "#e05f6e", php: "#8892bf", shell: "#9aa0a6",
  default: "#9aa0a6"
};
function langColor(lang) {
  if (!lang) return LANG_COLORS.default;
  return LANG_COLORS[lang.toLowerCase()] || LANG_COLORS.default;
}

function zipUrl(repo) {
  const branch = repo.default_branch || "main";
  return `https://github.com/${repo.full_name}/archive/refs/heads/${branch}.zip`;
}
