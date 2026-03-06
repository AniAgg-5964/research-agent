// services/geminiService.js

const { GoogleGenAI } = require("@google/genai");
const { searchWeb, searchArxiv, searchGitHub } = require("./toolsService");
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
            if (i < retries - 1) {
                const delay = (i === 0) ? 2000 : 4000; // 2s on attempt 2, 4s on attempt 3
                console.warn(`LLM request failed (Attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`, err.message);
                await new Promise(res => setTimeout(res, delay));
            } else {
                console.error(`LLM request failed after ${retries} attempts:`, err.message);
                // gracefully return an error message
                return {
                    text: `Error: Could not retrieve response after ${retries} attempts due to network or API issue.`,
                    usageMetadata: null
                };
            }
        }
    }
}

// ===========================
// Persona System
// ===========================

function getPersonaInstruction(persona) {

    if (persona === "architect") {
        return `You are a senior distributed systems architect.
Focus on architecture layers, scaling mechanics,
performance trade-offs and operational risks.
Avoid business language.`;
    }

    if (persona === "analyst") {
        return `You are a research analyst producing structured
technical surveys focusing on comparisons,
theory and research gaps.`;
    }

    if (persona === "strategist") {
        return `
You are a technology strategy lead preparing
an executive briefing.

Focus on ROI, ecosystem maturity and
competitive advantage.
`;
    }

    if (persona === "general") {
        return `
You are an intelligent research assistant
helping a general user.

If details are missing,
make reasonable assumptions
instead of asking clarification questions.
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
`
    });

    return {
        answer: response.text,
        usage: response.usageMetadata || null
    };

}

// ===========================
// DEEP MODE
// ===========================

async function runDeepResearch(
    query,
    memoryContext = "",
    persona = "architect",
    clarificationDepth = 0,
    onProgress = () => { }
) {

    const personaInstruction = getPersonaInstruction(persona);

    const safeMemory =
        memoryContext ? memoryContext.substring(0, 3000) : "";

    const MAX_CLARIFICATION_DEPTH = 1;

    // ====================================================
    // LLM CALL 1 — RESEARCH PLANNER
    // ====================================================

    console.log("LLM CALL 1 — Research Planner");
    onProgress("Planning Research Strategy");

    const plannerResponse = await callModelWithRetry({
        model: "models/gemini-2.5-flash-lite",
        contents: `
You are a research planning agent.

${personaInstruction}

Break down the research question into:

* themes
* comparison_axes
* risks

Return JSON only:

{
"themes":[],
"comparison_axes":[],
"risks":[]
}

Query:
${query}
`
    });

    const plannerOutput = plannerResponse.text;

    // ====================================================
    // LLM CALL 2 — REFLECTION (Groq)
    // ====================================================

    console.log("LLM CALL 2 — Reflection Agent");
    onProgress("Analyzing Plan");

    const reflection = await runGroqPrompt(`
You are a critical research reviewer.

Your job is to detect missing information.

If essential information is missing,
generate multiple choice clarification questions.

Rules:

* Maximum 6 questions
* Each question must contain 3–4 options

Return JSON only:

{
"needs_clarification":true or false,
"questions":[
{
"question":"text",
"options":["A","B","C"]
}
]
}

PLAN:
${plannerOutput}

QUERY:
${query}
`);

    let reflectionPlan;

    try {

        reflectionPlan = JSON.parse(
            reflection.replace(/`json/g, "")
                .replace(/`/g, "")
                .trim()
        );

    } catch {

        reflectionPlan = {
            needs_clarification: false,
            questions: []
        };

    }

    // limit questions
    if (reflectionPlan.questions) {
        reflectionPlan.questions =
            reflectionPlan.questions.slice(0, 6);
    }

    // prevent infinite clarification loops
    if (
        persona !== "general" &&
        reflectionPlan.needs_clarification &&
        clarificationDepth < MAX_CLARIFICATION_DEPTH
    ) {

        return {
            clarificationNeeded: true,
            questions: reflectionPlan.questions,
            clarificationDepth: clarificationDepth + 1,
            reasoning: { planner: plannerOutput }
        };

    }

    // ====================================================
    // LLM CALL 3 — TOOL DECISION
    // ====================================================

    console.log("LLM CALL 3 — Tool Planning");

    const finalPlanResponse = await callModelWithRetry({
        model: "models/gemini-2.5-flash-lite",
        contents: `
You are a research planner.

Decide which external sources
are useful for answering the query.

Available tools:

tavily → general web knowledge
arxiv → academic research papers
github → open source implementations

Return JSON:

{
"tool_plan":[
{"tool":"tavily","confidence":0.0},
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

    try {

        finalPlan = JSON.parse(
            finalPlanResponse.text
                .replace(/`json/g, "")
                .replace(/`/g, "")
                .trim()
        );

    } catch {

        finalPlan = {
            tool_plan: [
                { tool: "tavily", confidence: 0.8 },
                { tool: "arxiv", confidence: 0.6 },
                { tool: "github", confidence: 0.6 }
            ]
        };

    }

    const TOOL_THRESHOLD = 0.6;

    let webResults = [];
    let arxivResults = [];
    let githubResults = [];

    const tavilyConfidence =
        finalPlan.tool_plan?.find(t => t.tool === "tavily")?.confidence || 0;

    const arxivConfidence =
        finalPlan.tool_plan?.find(t => t.tool === "arxiv")?.confidence || 0;

    const githubConfidence =
        finalPlan.tool_plan?.find(t => t.tool === "github")?.confidence || 0;

    console.log("Tool Confidence:", {
        tavily: tavilyConfidence,
        arxiv: arxivConfidence,
        github: githubConfidence
    });

    // execute tools

    if (tavilyConfidence > TOOL_THRESHOLD || arxivConfidence > TOOL_THRESHOLD || githubConfidence > TOOL_THRESHOLD) {
        onProgress("Gathering External Knowledge");
    }

    if (tavilyConfidence > TOOL_THRESHOLD) {
        console.log("Executing Tavily search");
        webResults = await searchWeb(query);
    }

    if (arxivConfidence > TOOL_THRESHOLD) {
        console.log("Executing arXiv search");
        arxivResults = await searchArxiv(query);
    }

    if (githubConfidence > TOOL_THRESHOLD) {
        console.log("Executing GitHub search");
        githubResults = await searchGitHub(query);
    }

    // ====================================================
    // TOOL CONTEXT
    // ====================================================

    const toolContextDraft = `

Web Results:
${webResults.map(r => `- ${r.title}: ${r.content}`).join("\n")}

arXiv Papers:
${arxivResults.map(p => `- ${p.title}: ${p.summary}`).join("\n")}

GitHub Repositories:
${githubResults.map(g => `- ${g.name}: ${g.description}`).join("\n")}
`;

    const MAX_PROMPT_CHARS = 12000;
    const toolContext = toolContextDraft.length > MAX_PROMPT_CHARS
        ? toolContextDraft.substring(0, MAX_PROMPT_CHARS) + "\n...[TRUNCATED TO PREVENT PROMPT OVERFLOW]"
        : toolContextDraft;

    // ====================================================
    // LLM CALL 4 — FINAL REPORT
    // ====================================================

    console.log("LLM CALL 4 — Final Research Report");
    onProgress("Generating Research Report");

    const reportResponse = await callModelWithRetry({
        model: "models/gemini-2.5-flash-lite",
        contents: `
You are a senior research assistant.

${personaInstruction}

Use:

Memory Context:
${safeMemory}

Planner Output:
${plannerOutput}

External Sources:
${toolContext}

Research Question:
${query}

Generate a structured research report.

End with confidence score.
`
    });

    // ====================================================
    // LLM CALL 5 — MEMORY COMPRESSION
    // ====================================================

    console.log("LLM CALL 5 — Memory Compression");

    const summary = await runGroqPrompt(`
Summarize the research below into
5 durable insights.

${reportResponse.text}
`);

    return {

        answer: reportResponse.text,

        memorySummary: summary,

        usage: {
            totalTokenCount:
                (plannerResponse.usageMetadata?.totalTokenCount || 0) +
                (reportResponse.usageMetadata?.totalTokenCount || 0)
        },

        reasoning: {
            planner: plannerOutput,
            tools: {
                web: webResults.length,
                arxiv: arxivResults.length,
                github: githubResults.length
            }
        }

    };

}

module.exports = {
    runQuickResearch,
    runDeepResearch
};
