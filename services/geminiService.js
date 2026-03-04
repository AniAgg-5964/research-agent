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

  console.log("LLM CALL 1 — ANALYSIS");

  const analysisResponse = await callModelWithRetry({
    model: "models/gemini-2.5-flash-lite",
    contents: `
You are a research planning agent.

${personaInstruction}

Analyze the research question and produce a structured plan.

  Return ONLY valid JSON.

  Do not include explanations.
  Do not include markdown.
  Do not include text before or after the JSON.

  Format:

  {
    "themes": [],
    "comparison_axes": [],
    "risks": [],
    "needs_arxiv": true,
    "needs_github": true
  }

Rules:
- Use arXiv if academic research papers are useful.
- Use GitHub if implementation examples or open-source systems are useful.
- If existing memory is sufficient, tools may be false.

Research Question:
${query}
`,
  });

  const analysis = analysisResponse.text;

  let plan;

try {
  const cleaned = analysis
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  plan = JSON.parse(cleaned);

} catch (err) {
  console.log("Plan parse failed, fallback mode");
  plan = {
    needs_arxiv: true,
    needs_github: true
  };
}

console.log("Agent Plan:", plan);

  // ===========================
  // Tool Execution
  // ===========================
  let arxivResults = [];
  let githubResults = [];

  if (plan.needs_arxiv || plan.needs_github) {
    console.log("Running external tools...");

    const toolTasks = [];

    if (plan.needs_arxiv) {
      toolTasks.push(searchArxiv(query));
    } else {
      toolTasks.push(Promise.resolve([]));
    }

    if (plan.needs_github) {
      toolTasks.push(searchGitHub(query));
    } else {
      toolTasks.push(Promise.resolve([]));
    }

    [arxivResults, githubResults] = await Promise.all(toolTasks);

  } else {
    console.log("Agent decided no tools required");
  }

  const toolContext = `
  arXiv Papers:
  ${arxivResults.length
    ? arxivResults.map(p => `- ${p.title}`).join("\n")
    : "No relevant papers found"}

  GitHub Repositories:
  ${githubResults.length
    ? githubResults.map(g => `- ${g.name} (${g.stars}⭐)`).join("\n")
    : "No relevant repositories found"}
  `;

  console.log("LLM CALL 2 — FINAL REPORT");

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

  console.log("LLM CALL 3 — MEMORY COMPRESSION");

  const summaryResponse = await callModelWithRetry({
    model: "models/gemini-2.5-flash-lite",
    contents: `
Summarize the following research into 5–6 high-signal bullet points.
Focus only on durable insights.
Avoid verbosity.

${finalResponse.text}
`,
  });

  return {
    answer: finalResponse.text,
    memorySummary: summaryResponse.text,
    usage: {
      totalTokenCount:
        (analysisResponse.usageMetadata?.totalTokenCount || 0) +
        (finalResponse.usageMetadata?.totalTokenCount || 0) +
        (summaryResponse.usageMetadata?.totalTokenCount || 0),
    },
    reasoning: {
  analysis,
  plan,
  toolSummary: {
    arxivCount: arxivResults.length,
    githubCount: githubResults.length
  }
}
  };
}

module.exports = {
  runQuickResearch,
  runDeepResearch,
};