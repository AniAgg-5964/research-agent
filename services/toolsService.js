const { search, SafeSearchType } = require("duck-duck-scrape");
const arxiv = require("arxiv");
const axios = require("axios");

// ---------------------------
// Web Search (DuckDuckGo)
// ---------------------------



async function searchWeb(query) {
  try {

    await new Promise(res => setTimeout(res, 1500));

    const results = await search(query, {
      safeSearch: SafeSearchType.OFF,
    });

    return results.results.slice(0, 5).map(r => ({
      title: r.title,
      snippet: r.description,
      url: r.url,
    }));
  } catch (err) {
    console.error("Web search error:", err.message);
    return [];
  }
}

// ---------------------------
// arXiv Search
// ---------------------------
async function searchArxiv(query) {
  try {
    const response = await axios.get(
      `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=3`
    );

    const raw = response.data;

    const entries = raw.split("<entry>").slice(1);

    return entries.map(entry => {
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
      const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim();
      const id = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim();

      return {
        title: title?.replace(/\n/g, " "),
        summary: summary?.substring(0, 400).replace(/\n/g, " "),
        url: id,
      };
    });
  } catch (err) {
    console.error("arXiv search error:", err.message);
    return [];
  }
}
// ---------------------------
// GitHub Search
// ---------------------------
async function searchGitHub(query) {
  try {
    const response = await axios.get(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=2`
    );

    return response.data.items.map(repo => ({
      name: repo.full_name,
      description: repo.description,
      stars: repo.stargazers_count,
      url: repo.html_url,
    }));
  } catch (err) {
    console.error("GitHub search error:", err.message);
    return [];
  }
}

module.exports = {
  searchWeb,
  searchArxiv,
  searchGitHub,
};