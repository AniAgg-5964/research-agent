// services/toolsService.js

const axios = require("axios");

// ===========================
// Tavily Web Search
// ===========================

async function searchWeb(query) {

try {


console.log("Running Tavily web search...");

const response = await axios.post(
  "https://api.tavily.com/search",
  {
    api_key: process.env.TAVILY_API_KEY,
    query: query,
    search_depth: "advanced",
    max_results: 5
  }
);

const results = response.data.results || [];

return results.map(r => ({
  title: r.title,
  content: r.content?.substring(0,400) || "",
  url: r.url
}));


} catch(err) {


console.error("Tavily search error:", err.message);
return [];

}

}

// ===========================
// arXiv Official API Search
// ===========================

async function searchArxiv(query) {

try {


console.log("Running arXiv search...");

const response = await axios.get(
  "http://export.arxiv.org/api/query",
  {
    params: {
      search_query: `all:${query}`,
      start: 0,
      max_results: 3
    }
  }
);

const raw = response.data;

const entries = raw.split("<entry>").slice(1);

return entries.map(entry => {

  const title =
    entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || "";

  const summary =
    entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim() || "";

  const id =
    entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() || "";

  return {
    title: title.replace(/\n/g," "),
    summary: summary.substring(0,400).replace(/\n/g," "),
    url: id
  };

});


} catch(err) {


console.error("arXiv search error:", err.message);
return [];


}

}

// ===========================
// GitHub Official REST API
// ===========================

async function searchGitHub(query) {

try {


console.log("Running GitHub search...");

const githubQuery = query
  .replace(/[^\w\s]/g,"")
  .split(" ")
  .slice(0,6)
  .join(" ");

console.log("GitHub query:", githubQuery);

const response = await axios.get(
  "https://api.github.com/search/repositories",
  {
    params: {
      q: githubQuery,
      sort: "stars",
      order: "desc",
      per_page: 3
    },
    headers: process.env.GITHUB_TOKEN
      ? {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
        }
      : {}
  }
);

const repos = response.data.items || [];

return repos.map(repo => ({
  name: repo.full_name,
  description: repo.description,
  stars: repo.stargazers_count,
  url: repo.html_url
}));


} catch(err) {


console.error("GitHub search error:", err.message);
return [];


}

}

module.exports = {
searchWeb,
searchArxiv,
searchGitHub
};
