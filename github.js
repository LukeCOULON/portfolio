/* =====================================================
   GITHUB.JS
   Récupération des dépôts GitHub, mise en cache légère,
   et petits utilitaires utilisés par project.html
   (fetchRepos, fetchReadme, langColor, getDescription, zipUrl)
===================================================== */

// v2 invalide les anciennes entrées potentiellement incohérentes.
const CACHE_KEY = `gh-repos-v2-${GITHUB_USER}`;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes


/* =====================================================
   COULEURS PAR LANGAGE
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
  return `https://github.com/${GITHUB_USER}/${repo.name}/archive/refs/heads/${encodeURIComponent(branch)}.zip`;
}


/* =====================================================
   RECUPERATION DES REPOS
===================================================== */

async function fetchRepos() {
  const cached = readCache();
  if (cached) {
    return cached;
  }

  // L'API liste au maximum 100 dépôts par page. Suivre les pages suivantes
  // évite de perdre des projets si le compte dépasse cette limite.
  const repos = [];
  for (let page = 1; ; page += 1) {
    const url = new URL(`https://api.github.com/users/${encodeURIComponent(GITHUB_USER)}/repos`);
    url.search = new URLSearchParams({
      per_page: "100",
      sort: "pushed",
      page: String(page),
    }).toString();

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      let detail = "";
      try {
        const body = await response.json();
        detail = body.message ? ` — ${body.message}` : "";
      } catch (_) {
        // Le corps de réponse peut ne pas être du JSON.
      }
      throw new Error(`Erreur GitHub API : ${response.status}${detail}`);
    }

    const pageRepos = await response.json();
    if (!Array.isArray(pageRepos)) {
      throw new Error("Réponse inattendue de l’API GitHub (liste de dépôts attendue).");
    }

    repos.push(...pageRepos);
    if (pageRepos.length < 100) {
      break;
    }
  }

  const filtered = repos.filter(repo =>
    repo && repo.name && !repo.fork && !EXCLUDE_REPOS.includes(repo.name)
  );

  writeCache(filtered);
  return filtered;
}


/* =====================================================
   RECUPERATION DU README D'UN REPO
===================================================== */

async function fetchReadme(repoName) {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(GITHUB_USER)}/${encodeURIComponent(repoName)}/readme`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Erreur GitHub API : ${response.status}`);
  }

  const data = await response.json();
  const bytes = Uint8Array.from(
    atob(data.content.replace(/\s/g, "")),
    character => character.charCodeAt(0)
  );
  return new TextDecoder("utf-8").decode(bytes);
}


/* =====================================================
   CACHE
===================================================== */

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const { timestamp, data } = JSON.parse(raw);
    if (!Array.isArray(data) || !Number.isFinite(timestamp)) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    if (Date.now() - timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY);
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
    // sessionStorage indisponible ou plein : on continue sans cache.
  }
}
