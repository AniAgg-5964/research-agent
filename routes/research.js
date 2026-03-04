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

      console.log(
        "Raw retrieved memories:",
        pastMemories.map(m => ({ score: m.score }))
      );

      let memoryText = "";
      const SIMILARITY_THRESHOLD = 0.75;

      const filteredMemories = pastMemories.filter(
        m => m.score >= SIMILARITY_THRESHOLD
      );

      if (filteredMemories.length > 0) {
        // 🔥 IMPORTANT: inject stored summaries, NOT full reports
        memoryText = filteredMemories
          .map(m => m.payload.summary)
          .join("\n\n");
      }

      console.log("Filtered memories count:", filteredMemories.length);
      console.log("Memory injected length:", memoryText.length);

      // 2️⃣ Run deep research (this already generates memorySummary internally)
      aiResponse = await runDeepResearch(query, memoryText, persona);

      // 3️⃣ Store compressed summary embedding + full report payload
      if (aiResponse.memorySummary) {
        await storeMemory(
          Date.now(),
          aiResponse.memorySummary, // 🔥 store compressed summary embedding
          {
            query,
            summary: aiResponse.memorySummary,
            fullReport: aiResponse.answer
          }
        );
      }

    } else {
      aiResponse = await runQuickResearch(query, persona);
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