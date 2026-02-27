// services/geminiService.js

const { GoogleGenAI } = require("@google/genai");
const { searchArxiv, searchGitHub } = require("./toolsService");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ===========================
// Retry Wrapper
// ===========================
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

// ===========================
// Persona System
// ===========================
function getPersonaInstruction(persona) {
  if (persona === "architect") {
    return `
You are a senior distributed systems architect.

Focus on:
- Architecture layers
- Control-plane/data-plane separation
- Infrastructure constraints
- Scaling bottlenecks
- Performance trade-offs
- Observability strategy
- Operational risks

Avoid:
- Academic survey framing
- Startup ROI language
`;
  }

  if (persona === "analyst") {
    return `
You are a research analyst writing a structured technical survey.

Focus on:
- Theoretical framing
- Comparative models
- Formal trade-offs
- System limitations
- Research gaps
- Future directions

Avoid:
- DevOps tuning advice
- Business or ROI language
`;
  }

  if (persona === "strategist") {
    return `
You are a technology strategy lead preparing an executive briefing.

Focus on:
- Competitive advantage
- ROI implications
- Cost structure
- Talent ecosystem
- Vendor lock-in risk
- Adoption complexity

Avoid:
- Low-level system internals
- Distributed systems theory
`;
  }

  return getPersonaInstruction("architect");
}

// ===========================
// QUICK MODE
// ===========================
async function runQuickResearch(query, persona = "architect") {
  const personaInstruction = getPersonaInstruction(persona);

  const response = await callModelWithRetry({
    model: "models/gemini-2.5-flash-lite",
    contents: `
You are a high-performance research assistant.

${personaInstruction}

Provide a concise structured answer (max 600 words).

Query:
${query}
`,
  });

  return {
    answer: response.text,
    usage: response.usageMetadata || null,
  };
}

// ===========================
// DEEP MODE
// ===========================
async function runDeepResearch(query, memoryContext = "", persona = "architect") {
  const personaInstruction = getPersonaInstruction(persona);

  const safeMemory = memoryContext
    ? memoryContext.substring(0, 3000)
    : "";

  // STEP 1 — Analytical Breakdown
  const analysisResponse = await callModelWithRetry({
    model: "models/gemini-2.5-flash-lite",
    contents: `
You are a research planner.

${personaInstruction}

Break the research question into:
- Core themes
- Comparative axes
- Risk dimensions
- Failure scenarios

Research Question:
${query}
`,
  });

  const analysis = analysisResponse.text;

  // ===========================
  // Tool Execution
  // ===========================
  let arxivResults = [];
  let githubResults = [];

  if (!safeMemory || safeMemory.length < 500) {
    console.log("Running external tools...");
    [arxivResults, githubResults] = await Promise.all([
      searchArxiv(query),
      searchGitHub(query),
    ]);
  } else {
    console.log("Skipping tools (strong memory found)");
  }

  const toolContext = `
arXiv Papers:
${arxivResults.map(p => `- ${p.title}`).join("\n")}

GitHub Repositories:
${githubResults.map(g => `- ${g.name} (${g.stars}⭐)`).join("\n")}
`;

  // STEP 2 — Final Report
  const finalResponse = await callModelWithRetry({
    model: "models/gemini-2.5-flash-lite",
    contents: `
You are a senior research assistant.

${personaInstruction}

Use:

Analytical Breakdown:
${analysis}

Memory Context:
${safeMemory}

External Research:
${toolContext}

Generate a structured report.

End with:
Confidence Score (0–100%)

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
    reasoning: {
      analysis,
      toolSummary: {
        arxivCount: arxivResults.length,
        githubCount: githubResults.length,
      },
    },
  };
}

module.exports = {
  runQuickResearch,
  runDeepResearch,
};