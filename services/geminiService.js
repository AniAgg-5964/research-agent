const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ----------------------
// QUICK MODE
// ----------------------
async function runQuickResearch(query) {
  const response = await ai.models.generateContent({
    model: "models/gemini-2.5-flash-lite",
    contents: `
You are a senior research engineer.
Provide a high-signal structured technical answer.
Be concise and practical.

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

  // STEP 1: Analysis
  const analysisResponse = await ai.models.generateContent({
    model: "models/gemini-2.5-flash-lite",
    contents: `
You are a research planner.

Break down the following research question into:
- Core technical themes
- Subtopics to analyze
- Important comparison axes
- Potential failure cases

Research Question:
${query}
`,
  });

  const analysis = analysisResponse.text;

  // STEP 2: Structured Report
  const finalResponse = await ai.models.generateContent({
    model: "models/gemini-2.5-flash-lite",
    contents: `
You are a senior research engineer assistant.

Using the following analytical breakdown:
${analysis}

Relevant past research context (if any):
${memoryContext}

Generate a production-grade structured research report.

Strictly follow this structure:

1. Executive Summary
2. Key Approaches
3. Trade-offs
4. Implementation Considerations
5. Benchmarks / Numbers (if available)
6. Failure Modes
7. Practical Recommendations
8. Confidence Score (0-100%)

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