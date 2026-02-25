const { GoogleGenAI } = require("@google/genai");
const {
  searchWeb,
  searchArxiv,
  searchGitHub,
} = require("./toolsService");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ----------------------
// RETRY WRAPPER (Fix 503)
// ----------------------
async function callModelWithRetry(config, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent(config);
    } catch (err) {
      if ((err.status === 503 || err.status === 429) && i < retries - 1) {
        await new Promise(res => setTimeout(res, 2000));
      } else {
        throw err;
      }
    }
  }
}

// ----------------------
// QUICK MODE
// ----------------------
async function runQuickResearch(query) {
  const response = await callModelWithRetry({
    model: "models/gemini-2.5-flash-lite",
    contents: `
You are a senior research engineer.
Provide a high-signal structured technical answer.
Be concise and practical (max 600 words).

Query:
${query}
`,
  });

  return {
    answer: response.text,
    usage: response.usageMetadata || null,
  };
}

// ----------------------
// DEEP MODE
// ----------------------
async function runDeepResearch(query, memoryContext = "") {

  // Limit memory injection (VERY IMPORTANT)
  const safeMemory = memoryContext
    ? memoryContext.substring(0, 3000)
    : "";

  // STEP 1 — ANALYSIS
  const analysisResponse = await callModelWithRetry({
    model: "models/gemini-2.5-flash-lite",
    contents: `
You are a research planner.

Break down the following research question into:
- Core technical themes
- Subtopics to analyze
- Important comparison axes
- Potential failure cases

Be structured and concise.

Research Question:
${query}
`,
  });

  const analysis = analysisResponse.text;

  // ----------------------
  // TOOL EXECUTION (PARALLEL)
  // ----------------------
  let webResults = [];
let arxivResults = [];
let githubResults = [];

// Only run tools if memory is weak
if (!safeMemory || safeMemory.length < 500) {

  console.log("Running external tools...");

  [webResults, arxivResults, githubResults] =
    await Promise.all([
      searchWeb(query),
      searchArxiv(query),
      searchGitHub(query),
    ]);

} else {

  console.log("Skipping external tools (strong memory found)");

}
  // Limit each tool output
  const safeWeb = webResults.slice(0, 3);
  const safeArxiv = arxivResults.slice(0, 3);
  const safeGithub = githubResults.slice(0, 3);

  const toolContext = `
Web Results:
${safeWeb.map(r => `- ${r.title}: ${r.snippet} (${r.url})`).join("\n")}

arXiv Papers:
${safeArxiv.map(p => `- ${p.title}: ${p.summary} (${p.url})`).join("\n")}

GitHub Repositories:
${safeGithub.map(g => `- ${g.name} (${g.stars}⭐): ${g.description} (${g.url})`).join("\n")}
`;

  // STEP 2 — FINAL REPORT
  const finalResponse = await callModelWithRetry({
    model: "models/gemini-2.5-flash-lite",
    contents: `
You are a senior research engineer assistant.

Using the analytical breakdown:
${analysis}

Relevant past research context (if any):
${safeMemory}

External Live Research Data:
${toolContext}

Generate a production-grade structured research report.

Strict structure:

1. Executive Summary
2. Key Approaches
3. Trade-offs
4. Implementation Considerations
5. Benchmarks / Numbers (if available)
6. Failure Modes
7. Practical Recommendations
8. Confidence Score (0-100%)

Be concise but technical.

Research Question:
${query}
`,
  });

  return {
    answer: finalResponse.text,
    usage: {
      totalTokenCount:
        (analysisResponse.usageMetadata?.totalTokenCount || 0) +
        (finalResponse.usageMetadata?.totalTokenCount || 0),
    },
  };
}

module.exports = {
  runQuickResearch,
  runDeepResearch,
};