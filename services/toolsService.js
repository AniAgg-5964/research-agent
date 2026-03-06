// services/toolsService.js

const axios = require("axios");
const { runGroqPrompt } = require("./groqService");

// ===========================
// Tavily Web Search
// ===========================

async function searchWeb(query) {

  // Guard: skip if query is empty or undefined
  if (!query || !query.trim()) {
    console.warn("Tavily search skipped: query is empty or undefined");
    return [];
  }

  try {
    console.log("Running Tavily web search...");

    const compressedQueryRaw = await runGroqPrompt(`Extract only the core research keywords from the following text. Do not include conversation history, roles, or filler words. Only return a space-separated list of keywords. Text: ${query}`);
    let compressedQuery = compressedQueryRaw.replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim().substring(0, 350);

    console.log("Tavily query:", compressedQuery);

    const response = await axios.post(
      "https://api.tavily.com/search",
      {
        query: compressedQuery,
        search_depth: "advanced",
        max_results: 5
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.TAVILY_API_KEY}`
        }
      }
    );

    const results = response.data.results || [];
    const topResults = results.slice(0, 2);

    console.log(`Tavily returned ${topResults.length} results (limited from ${results.length})`);

    return topResults.map(r => ({
      title: r.title,
      content: r.content?.substring(0, 500) || "",
      url: r.url
    }));

  } catch (err) {
    console.error("Tavily search error:", err.message);
    if (err.response) {
      console.error("Tavily error status:", err.response.status);
      console.error("Tavily error response:", err.response.data);
    }
    return [];
  }

}

// ===========================
// arXiv Official API Search
// ===========================

async function searchArxiv(query) {

  let attempt = 0;
  while (attempt < 2) {
    try {

      console.log(`Running arXiv search... (Attempt ${attempt + 1})`);

      const compressedQueryRaw = await runGroqPrompt(`Extract only the core research keywords from the following text suitable for an arXiv search. Do not include conversation history. Only return a space-separated list of keywords. Text: ${query}`);
      let compressedQuery = compressedQueryRaw.replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();

      const response = await axios.get(
        "http://export.arxiv.org/api/query",
        {
          params: {
            search_query: `all:${compressedQuery}`,
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
          title: title.replace(/\n/g, " "),
          summary: summary.substring(0, 400).replace(/\n/g, " "),
          url: id
        };

      });

    } catch (err) {

      console.error(`arXiv search error on attempt ${attempt + 1}:`, err.message);
      if (err.response && err.response.status === 503 && attempt === 0) {
        attempt++;
        await new Promise(res => setTimeout(res, 2000));
        continue;
      }
      return [];

    }
  }
  return [];

}

// ===========================
// GitHub Official REST API
// ===========================

async function searchGitHub(query) {

  let attempt = 0;
  while (attempt < 2) {
    try {

      console.log(`Running GitHub search... (Attempt ${attempt + 1})`);

      const compressedQueryRaw = await runGroqPrompt(`Extract 3-5 core technical keywords from the following text for a GitHub repository search. Do not include conversation history or roles. Only return a space-separated list of keywords. Text: ${query}`);
      let compressedQuery = compressedQueryRaw.replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();

      const githubQuery = compressedQuery
        .split(" ")
        .slice(0, 6)
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


    } catch (err) {

      console.error(`GitHub search error on attempt ${attempt + 1}:`, err.message);
      attempt++;
      if (attempt < 2) {
        await new Promise(res => setTimeout(res, 2000));
        continue;
      }
      return [];

    }
  }
  return [];

}

module.exports = {
  searchWeb,
  searchArxiv,
  searchGitHub
};
