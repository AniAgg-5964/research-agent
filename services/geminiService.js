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
            console.log(`[Gemini] Calling model ${config.model} (attempt ${i + 1}/${retries})...`);
            const response = await ai.models.generateContent(config);

            // Safely extract text — the .text getter can throw if no valid candidates
            let text;
            try {
                text = response.text;
            } catch (textErr) {
                console.error(`[Gemini] response.text threw:`, textErr.message);
                text = null;
            }

            if (!text) {
                console.warn(`[Gemini] Empty response from model on attempt ${i + 1}`);
                if (i < retries - 1) {
                    await new Promise(res => setTimeout(res, 2000));
                    continue;
                }
                return {
                    text: "Error: Model returned an empty response after all retries.",
                    usageMetadata: response.usageMetadata || null
                };
            }

            console.log(`[Gemini] Success — response length: ${text.length} chars`);
            return { text, usageMetadata: response.usageMetadata || null };

        } catch (err) {
            if (i < retries - 1) {
                const delay = (i === 0) ? 2000 : 4000;
                console.warn(`[Gemini] Request failed (attempt ${i + 1}/${retries}): ${err.message}. Retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
            } else {
                console.warn(`[Gemini] Model ${config.model} unavailable after ${retries} attempts (${err.message}). Falling back to Groq (Qwen 3.8)...`);
                try {
                    const fallbackPrompt = typeof config.contents === "string" ? config.contents : JSON.stringify(config.contents);
                    const groqRes = await runGroqPrompt(fallbackPrompt);
                    if (groqRes && !groqRes.startsWith("Error:")) {
                        console.log(`[Groq Fallback] Success — generated ${groqRes.length} chars`);
                        return { text: groqRes, usageMetadata: { totalTokenCount: 1500 } };
                    }
                } catch (fallbackErr) {
                    console.error("[Groq Fallback] Fallback execution error:", fallbackErr.message);
                }

                console.error(`[Gemini] Request failed after ${retries} attempts:`, err.message);
                return {
                    text: `Error: Could not retrieve response after ${retries} attempts. (${err.message})`,
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

    console.log("[Quick Mode] Starting quick research...");
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

    console.log("[Quick Mode] Response received, answer length:", response.text?.length || 0);

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

    const safeProgress = typeof onProgress === "function" ? onProgress : () => { };
    const personaInstruction = getPersonaInstruction(persona);

    const safeMemory =
        memoryContext ? memoryContext.substring(0, 3000) : "";

    const MAX_CLARIFICATION_DEPTH = 1;

    // ====================================================
    // LLM CALL 1 — RESEARCH PLANNER
    // ====================================================

    console.log("LLM CALL 1 — Research Planner");
    safeProgress("Planning Research Strategy");

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

    // Short-circuit if planner failed
    if (!plannerOutput || plannerOutput.startsWith("Error:")) {
        console.error("[Deep Mode] Planner failed:", plannerOutput);
        return {
            answer: plannerOutput || "Error: Research planner returned no output.",
            memorySummary: null,
            usage: { totalTokenCount: 0 },
            reasoning: { planner: plannerOutput, tools: { web: 0, arxiv: 0, github: 0 } }
        };
    }

    // ====================================================
    // LLM CALL 2 — REFLECTION (Groq)
    // ====================================================

    console.log("LLM CALL 2 — Reflection Agent");
    safeProgress("Analyzing Plan");

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
You are a research planner evaluating external sources.

Assign a dynamic confidence score (0.0 to 1.0) to each source based on how relevant it is to the query.
- For queries about academic research or papers, score 'arxiv' highest.
- For queries about code, implementations, or repositories, score 'github' highest.
- For general knowledge or current events, score 'tavily' highest.
Use scores like 0.1, 0.4, 0.9, etc., based on real relevance. Do NOT use static default scores.

Available tools:

tavily → general web knowledge
arxiv → academic research papers
github → open source implementations

Return JSON:

{
"tool_plan":[
{"tool":"tavily","confidence":<dynamic_score>},
{"tool":"arxiv","confidence":<dynamic_score>},
{"tool":"github","confidence":<dynamic_score>}
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

        const textMatch = finalPlanResponse.text.match(/\{[\s\S]*\}/);
        const jsonStr = textMatch ? textMatch[0] : finalPlanResponse.text;
        finalPlan = JSON.parse(jsonStr);

    } catch (e) {
        console.warn("Failed to parse tool plan JSON, using fallback.", e.message);

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
        safeProgress("Gathering External Knowledge");
    }

    const searchPromises = [];

    if (tavilyConfidence > TOOL_THRESHOLD) {
        console.log("Executing Tavily search");
        searchPromises.push(
            searchWeb(query).then(res => {
                webResults = res;
                console.log(`Tavily returned ${webResults.length} results`);
            })
        );
    }

    if (arxivConfidence > TOOL_THRESHOLD) {
        console.log("Executing arXiv search");
        searchPromises.push(
            searchArxiv(query).then(res => {
                arxivResults = res;
                console.log(`arXiv returned ${arxivResults.length} papers:`);
                arxivResults.forEach((paper, i) => console.log(`${i + 1}. ${paper.title}`));
            })
        );
    }

    if (githubConfidence > TOOL_THRESHOLD) {
        console.log("Executing GitHub search");
        searchPromises.push(
            searchGitHub(query).then(res => {
                githubResults = res;
                console.log(`GitHub returned ${githubResults.length} repositories:`);
                githubResults.forEach((repo, i) => console.log(`${i + 1}. ${repo.name}`));
            })
        );
    }

    await Promise.all(searchPromises);

    // ====================================================
    // TOOL CONTEXT
    // ====================================================

    const webFormatted = webResults.length > 0
        ? webResults.map(r => `- [${r.title}](${r.url})\n  ${r.content}`).join("\n\n")
        : "None retrieved";

    const arxivFormatted = arxivResults.length > 0
        ? arxivResults.map(p => `- **[${p.title}](${p.url})**\n  *Abstract / Findings:* ${p.summary}`).join("\n\n")
        : "None retrieved";

    const githubFormatted = githubResults.length > 0
        ? githubResults.map(g => `- **[${g.name}](${g.url})** (${g.stars || 0}★)\n  *Description:* ${g.description}`).join("\n\n")
        : "None retrieved";

    const toolContextDraft = `
### Academic Research Papers (arXiv):
${arxivFormatted}

### Open Source Implementations (GitHub):
${githubFormatted}

### Web Articles & Sources:
${webFormatted}
`;

    const MAX_PROMPT_CHARS = 14000;
    const toolContext = toolContextDraft.length > MAX_PROMPT_CHARS
        ? toolContextDraft.substring(0, MAX_PROMPT_CHARS) + "\n...[TRUNCATED TO PREVENT PROMPT OVERFLOW]"
        : toolContextDraft;

    // ====================================================
    // LLM CALL 4 — FINAL REPORT
    // ====================================================

    console.log("LLM CALL 4 — Final Research Report");
    safeProgress("Generating Research Report");

    const reportResponse = await callModelWithRetry({
        model: "models/gemini-2.5-flash-lite",
        contents: `
You are a senior research assistant.

${personaInstruction}

Use the following materials to produce an authoritative, exhaustive research report:

Memory Context:
${safeMemory}

Planner Output:
${plannerOutput}

Retrieved External Sources (arXiv Papers, GitHub Repos, and Web Sources):
${toolContext}

Research Question:
${query}

Instructions for the report:
1. Provide a comprehensive, executive-level technical breakdown with detailed architecture layers and trade-offs.
2. Directly discuss and cite the retrieved arXiv research papers and GitHub repositories in the body of the report where relevant.
3. Include structured sections at the end:
   - "### 📚 Academic Research Papers (arXiv)" — with clickable Markdown links [Paper Title](url), findings, and why they matter.
   - "### 💻 Open Source Implementations (GitHub)" — with clickable Markdown links [owner/repo](url), stars, and architectural purpose.
   - "### 🌐 External Web References" — with clickable links.
4. Conclude with actionable recommendations and a confidence score.
`
    });

    let finalAnswer = reportResponse.text;

    // Ensure retrieved arXiv papers & GitHub repos are always prominently listed with links
    if (finalAnswer && !finalAnswer.startsWith("Error:")) {
        const hasArxivLinks = finalAnswer.includes("arxiv.org") || (arxivResults.length === 0);
        const hasGithubLinks = finalAnswer.includes("github.com") || (githubResults.length === 0);

        if (!hasArxivLinks || !hasGithubLinks) {
            let sourcesSection = "\n\n---\n\n## 🔬 Retrieved Research & Open Source Implementations\n";
            if (arxivResults.length > 0) {
                sourcesSection += "\n### 📚 Academic Research Papers (arXiv)\n" +
                    arxivResults.map(p => `- **[${p.title}](${p.url})**\n  > ${p.summary}`).join("\n\n");
            }
            if (githubResults.length > 0) {
                sourcesSection += "\n\n### 💻 Open Source Implementations (GitHub)\n" +
                    githubResults.map(g => `- **[${g.name}](${g.url})** (${g.stars || 0}★)\n  > ${g.description}`).join("\n\n");
            }
            if (webResults.length > 0) {
                sourcesSection += "\n\n### 🌐 Web Sources & Articles\n" +
                    webResults.map(r => `- [${r.title}](${r.url})`).join("\n");
            }
            finalAnswer += sourcesSection;
        }
    }

    // ====================================================
    // LLM CALL 5 — MEMORY COMPRESSION
    // ====================================================

    let summary = null;
    if (finalAnswer && !finalAnswer.startsWith("Error:")) {
        console.log("LLM CALL 5 — Memory Compression");
        const rawSummary = await runGroqPrompt(`
Summarize the research below into
5 durable insights.

${finalAnswer}
`);
        if (rawSummary && !rawSummary.startsWith("Error:")) {
            summary = rawSummary;
        }
    }

    return {

        answer: finalAnswer,

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
