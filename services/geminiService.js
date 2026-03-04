// services/geminiService.js

const { GoogleGenAI } = require("@google/genai");
const { searchArxiv, searchGitHub } = require("./toolsService");
const { runGroqPrompt } = require("./groqService");

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
Focus on architecture layers, scaling mechanics, performance trade-offs, and operational risks.
Avoid business language.
`;
  }

  if (persona === "analyst") {
    return `
You are a research analyst producing structured technical surveys.
Focus on theoretical framing, comparisons, and research gaps.
`;
  }

  if (persona === "strategist") {
    return `
You are a technology strategy lead preparing an executive briefing.
Focus on competitive advantage, ROI implications, and ecosystem maturity.
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
You are a research assistant.

${personaInstruction}

Provide a concise structured answer.

Query:
${query}
`,
  });

  return {
    answer: response.text,
    usage: response.usageMetadata || null
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

  // ====================================================
  // LLM CALL 1 — PLANNER (Gemini)
  // ====================================================

  console.log("LLM CALL 1 — Research Planner");

  const plannerResponse = await callModelWithRetry({
    model: "models/gemini-2.5-flash-lite",
    contents: `
You are a research planning agent.

${personaInstruction}

Break down the research question into:

- themes
- comparison axes
- risks

Return ONLY JSON:

{
 "themes": [],
 "comparison_axes": [],
 "risks": []
}

Research Question:
${query}
`
  });

  const plannerOutput = plannerResponse.text;

  // ====================================================
  // LLM CALL 2 — REFLECTION (Groq)
  // ====================================================

  console.log("LLM CALL 2 — Reflection Agent");

  const reflection = await runGroqPrompt(`
You are a critical research reviewer.

Your job is to detect whether the research plan is missing critical
information required to produce a high-quality answer.

You MUST check for:

- missing scale assumptions
- missing infrastructure assumptions
- missing domain context
- missing constraints
- missing performance targets

If any of these are missing, you MUST ask clarification questions.

Return ONLY JSON:

{
 "needs_clarification": true or false,
 "questions": []
}

PLAN:
${plannerOutput}

USER QUERY:
${query}
`);

  let reflectionPlan;

  try {
    reflectionPlan = JSON.parse(
      reflection.replace(/```json/g,"").replace(/```/g,"").trim()
    );
  } catch {
    reflectionPlan = {
      needs_clarification:false,
      questions:[]
    };
  }

  if(reflectionPlan.needs_clarification){
    return {
      clarificationNeeded:true,
      questions:reflectionPlan.questions,
      reasoning:{ plannerOutput }
    };
  }

  // ====================================================
  // LLM CALL 3 — FINAL PLANNING + TOOL DECISION (Gemini)
  // ====================================================

  console.log("LLM CALL 3 — Final Planner + Tool Decision");

  const finalPlanResponse = await callModelWithRetry({
    model:"models/gemini-2.5-flash-lite",
    contents:`
You are a research planning agent.

Given the plan below decide tool usage.

Return JSON:

{
 "tool_plan":[
   {"tool":"arxiv","confidence":0.0},
   {"tool":"github","confidence":0.0}
 ]
}

PLAN:
${plannerOutput}

Memory:
${safeMemory}

Query:
${query}
`
  });

  let finalPlan;

  try{
    finalPlan = JSON.parse(
      finalPlanResponse.text.replace(/```json/g,"").replace(/```/g,"").trim()
    );
  }catch{
    finalPlan = {
      tool_plan:[
        {tool:"arxiv",confidence:0.7},
        {tool:"github",confidence:0.7}
      ]
    }
  }

  const TOOL_THRESHOLD = 0.6;

  const arxivConfidence =
    finalPlan.tool_plan?.find(t=>t.tool==="arxiv")?.confidence || 0;

  const githubConfidence =
    finalPlan.tool_plan?.find(t=>t.tool==="github")?.confidence || 0;

  let arxivResults = [];
  let githubResults = [];

  console.log("Tool Confidence:",{
    arxiv:arxivConfidence,
    github:githubConfidence
  });

  if(arxivConfidence>TOOL_THRESHOLD){
    console.log("Executing arXiv search");
    arxivResults = await searchArxiv(query);
  }

  if(githubConfidence>TOOL_THRESHOLD){
    console.log("Executing GitHub search");
    githubResults = await searchGitHub(query);
  }

  const toolContext = `
arXiv:
${arxivResults.map(p=>`- ${p.title}`).join("\n")}

GitHub:
${githubResults.map(g=>`- ${g.name}`).join("\n")}
`;

  // ====================================================
  // LLM CALL 4 — FINAL REPORT (Gemini)
  // ====================================================

  console.log("LLM CALL 4 — Final Research Report");

  const reportResponse = await callModelWithRetry({
    model:"models/gemini-2.5-flash-lite",
    contents:`
You are a senior research assistant.

${personaInstruction}

Use:

Memory Context:
${safeMemory}

Planner Output:
${plannerOutput}

External Research:
${toolContext}

Research Question:
${query}

Generate a structured research report.

End with confidence score.
`
  });

  // ====================================================
  // LLM CALL 5 — MEMORY COMPRESSION (Groq)
  // ====================================================

  console.log("LLM CALL 5 — Memory Compression");

  const summary = await runGroqPrompt(`
Summarize the research below into
5 concise durable insights.

${reportResponse.text}
`);

  return {
    answer:reportResponse.text,
    memorySummary:summary,
    usage:{
      totalTokenCount:
        (plannerResponse.usageMetadata?.totalTokenCount||0)+
        (reportResponse.usageMetadata?.totalTokenCount||0)
    },
    reasoning:{
      planner:plannerOutput,
      tools:{
        arxiv:arxivResults.length,
        github:githubResults.length
      }
    }
  };

}

module.exports = {
  runQuickResearch,
  runDeepResearch
};