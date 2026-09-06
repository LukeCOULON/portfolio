/* =====================================================
   GITHUB.JS
   Récupération des dépôts GitHub, mise en cache légère,
   et petits utilitaires utilisés par project.html
   (fetchRepos, fetchReadme, langColor, getDescription, zipUrl)
===================================================== */

const CACHE_KEY = `gh-repos-${GITHUB_USER}`;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes


/* =====================================================
   COULEURS PAR LANGAGE
   (mêmes teintes que GitHub, pour rester familier)
===================================================== */

const LANGUAGE_COLORS = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Java: "#b07219",
  "C": "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  Go: "#00ADD8",
  Rust: "#dea584",
  PHP: "#4F5D95",
  Shell: "#89e051",
  Lua: "#000080",
  Ruby: "#701516",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
};

function langColor(language) {
  return LANGUAGE_COLORS[language] || "var(--muted)";
}


/* =====================================================
   DESCRIPTION (avec override manuel possible)
===================================================== */

function getDescription(repo) {
  if (DESCRIPTION_OVERRIDES && DESCRIPTION_OVERRIDES[repo.name]) {
    return DESCRIPTION_OVERRIDES[repo.name];
  }
  return repo.description || "Aucune description disponible.";
}


/* =====================================================
   URL DE TELECHARGEMENT ZIP
===================================================== */

function zipUrl(repo) {
  const branch = repo.default_branch || "main";
  return `https://github.com/${GITHUB_USER}/${repo.name}/archive/refs/heads/${branch}.zip`;
}


/* =====================================================
   RECUPERATION DES REPOS (avec cache sessionStorage)
===================================================== */

async function fetchRepos() {

  const cached = readCache();

  if (cached) {
    return cached;
  }

  const response = await fetch(
    `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=pushed`,
    { headers: { Accept: "application/vnd.github+json" } }
  );

  if (!response.ok) {
    throw new Error(`Erreur GitHub API : ${response.status}`);
  }

  const repos = await response.json();

  const filtered = repos.filter(repo =>
    !repo.fork &&
    !EXCLUDE_REPOS.includes(repo.name)
  );

  writeCache(filtered);

  return filtered;

}


/* =====================================================
   RECUPERATION DU README D'UN REPO
===================================================== */

async function fetchReadme(repoName) {

  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_USER}/${repoName}/readme`,
    { headers: { Accept: "application/vnd.github+json" } }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Erreur GitHub API : ${response.status}`);
  }

  const data = await response.json();

  // Le contenu est encodé en base64 (UTF-8)
  const decoded = decodeURIComponent(
    atob(data.content.replace(/\n/g, ""))
      .split("")
      .map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("")
  );

  return decoded;

}


/* =====================================================
   CACHE (évite de spammer l'API GitHub, limitée
   à 60 requêtes/heure sans authentification)
===================================================== */

function readCache() {

  try {

    const raw = sessionStorage.getItem(CACHE_KEY);

    if (!raw) {
      return null;
    }

    const { timestamp, data } = JSON.parse(raw);

    if (Date.now() - timestamp > CACHE_TTL_MS) {
      return null;
    }

    return data;

  } catch (error) {
    return null;
  }

}

function writeCache(data) {

  try {

    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), data })
    );

  } catch (error) {
    // sessionStorage indisponible ou plein : on continue sans cache
  }

}
