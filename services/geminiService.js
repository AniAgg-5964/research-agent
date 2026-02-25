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
// RETRY WRAPPER
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
// PERSONA SYSTEM
// ----------------------
function getPersonaInstruction(persona) {

  // =========================
  // SYSTEMS ARCHITECT
  // =========================
  if (persona === "architect") {
    return `
You are a senior distributed systems architect.

STRICT RULES:
- Focus on architecture layers and control-plane/data-plane separation.
- Discuss infrastructure constraints.
- Mention scaling bottlenecks and real-world failure modes.
- Include performance trade-offs.
- Include observability strategy.
- Mention infrastructure-level cost trade-offs (NOT business ROI).
- Avoid academic research framing.
- Avoid startup strategy language.

Tone: Technical, operational, pragmatic.
Structure:
Architecture Overview →
Control & Data Plane →
Scaling Mechanics →
Bottlenecks →
Operational Risks →
Deployment Considerations.
`;
  }

  // =========================
  // RESEARCH ANALYST
  // =========================
  if (persona === "analyst") {
    return `
You are a research analyst writing a structured technical survey.

STRICT RULES:
- Frame using theoretical models.
- Reference formal systems concepts (CAP theorem, consensus models, complexity).
- Compare approaches academically.
- Discuss limitations and open research questions.
- Use conceptual abstraction instead of operational tuning.
- Avoid DevOps advice.
- Avoid cost or ROI language.
- Avoid startup framing.

Tone: Formal, structured, analytical.
Structure:
Theoretical Framing →
Comparative Models →
Formal Trade-offs →
Limitations →
Research Gaps →
Future Directions.
`;
  }

  // =========================
  // STRATEGY LEAD
  // =========================
  if (persona === "strategist") {
    return `
You are a technology strategy lead preparing an executive briefing.

STRICT RULES:
- Focus on competitive advantage.
- Include ROI and operational cost implications.
- Discuss hiring and ecosystem maturity.
- Mention vendor lock-in risks.
- Include adoption complexity.
- Avoid low-level system internals.
- Avoid distributed systems theory.
- Avoid academic jargon.

Tone: Strategic, executive-facing, outcome-driven.
Structure:
Business Context →
Market Position →
Cost & Scaling Implications →
Talent & Ecosystem →
Risks →
Strategic Recommendation.
`;
  }

  // default fallback
  return getPersonaInstruction("architect");
}

// ----------------------
// QUICK MODE
// ----------------------
async function runQuickResearch(query, persona = "architect") {

  const personaInstruction = getPersonaInstruction(persona);

  const response = await callModelWithRetry({
    model: "models/gemini-2.5-flash-lite",
    contents: `
You are a high-performance research assistant.

${personaInstruction}

Provide a concise but structured response (max 600 words).

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
async function runDeepResearch(query, memoryContext = "", persona = "architect") {

  const personaInstruction = getPersonaInstruction(persona);

  const safeMemory = memoryContext
    ? memoryContext.substring(0, 3000)
    : "";

  // STEP 1 — ANALYSIS
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

Be structured and concise.

Research Question:
${query}
`,
  });

  const analysis = analysisResponse.text;

  // ----------------------
  // TOOL EXECUTION
  // ----------------------
  let webResults = [];
  let arxivResults = [];
  let githubResults = [];

  if (!safeMemory || safeMemory.length < 500) {
    console.log("Running external tools...");
    [webResults, arxivResults, githubResults] =
      await Promise.all([
        searchWeb(query),
        searchArxiv(query),
        searchGitHub(query),
      ]);
  } else {
    console.log("Skipping tools (strong memory found)");
  }

  const safeWeb = webResults.slice(0, 3);
  const safeArxiv = arxivResults.slice(0, 3);
  const safeGithub = githubResults.slice(0, 3);

  const toolContext = `
Web:
${safeWeb.map(r => `- ${r.title}: ${r.snippet}`).join("\n")}

arXiv:
${safeArxiv.map(p => `- ${p.title}`).join("\n")}

GitHub:
${safeGithub.map(g => `- ${g.name} (${g.stars}⭐)`).join("\n")}
`;

  // STEP 2 — FINAL REPORT
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
      webCount: safeWeb.length,
      arxivCount: safeArxiv.length,
      githubCount: safeGithub.length,
    }
  }
};
}

module.exports = {
  runQuickResearch,
  runDeepResearch,
};