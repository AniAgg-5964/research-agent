const express = require("express");
const router = express.Router();
const { runQuickResearch, runDeepResearch } = require("../services/geminiService");
const { storeMemory, searchMemory } = require("../services/memoryService");

router.post("/", async (req, res) => {
  try {
    const { query, mode, persona } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    let aiResponse;

    if (mode === "deep") {

  // 1️⃣ Search similar past research
  const pastMemories = await searchMemory(query);

  console.log("Raw retrieved memories:", pastMemories.map(m => ({
  score: m.score
})));

  let memoryText = "";
  const SIMILARITY_THRESHOLD = 0.75;

  const filteredMemories = pastMemories.filter(
    m => m.score >= SIMILARITY_THRESHOLD
  );

  if (filteredMemories.length > 0) {
    memoryText = filteredMemories
      .map(m => m.payload.fullReport)
      .join("\n\n");
  }

  console.log("Filtered memories count:", filteredMemories.length);

  console.log("Memory injected length:", memoryText.length);
  
  // 2️⃣ Run deep research with memory
  aiResponse = await runDeepResearch(query, memoryText,persona);

  // 3️⃣ Generate summary for storage
  const summaryResponse = await runQuickResearch(
    `Summarize the following research in 5-6 concise bullet points:\n\n${aiResponse.answer}`
  );

  // 4️⃣ Store summary embedding + full report payload
  await storeMemory(
    Date.now(),
    summaryResponse.answer,
    {
      query,
      fullReport: aiResponse.answer
    }
  );
} else {
      aiResponse = await runQuickResearch(query,persona);
    }

    res.json({
      answer: aiResponse.answer,
      usage: aiResponse.usage,
      mode: mode || "quick",
      reasoning: aiResponse.reasoning || null
    });

  } catch (error) {
    console.error("FULL ERROR:", error);
    res.status(500).json({
      error: "Something went wrong",
      details: error.message
    });
  }
});

module.exports = router;