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

      // ===========================
      // 1️⃣ Search Similar Memory
      // ===========================
      const pastMemories = await searchMemory(query);

      console.log(
        "Raw retrieved memories:",
        pastMemories.map(m => ({ score: m.score }))
      );

      const SIMILARITY_THRESHOLD = 0.75;

      const filteredMemories = pastMemories.filter(
        m => m.score >= SIMILARITY_THRESHOLD
      );

      let memoryText = "";

      if (filteredMemories.length > 0) {
        // Inject stored summaries (not full reports)
        memoryText = filteredMemories
          .map(m => m.payload.summary)
          .join("\n\n");
      }

      console.log("Filtered memories count:", filteredMemories.length);
      console.log("Memory injected length:", memoryText.length);

      // ===========================
      // 2️⃣ Run Deep Research
      // ===========================
      aiResponse = await runDeepResearch(query, memoryText, persona);

      // ===========================
      // 3️⃣ Handle Clarification
      // ===========================
      if (aiResponse.clarificationNeeded) {
        console.log("Agent requested clarification");

        return res.json({
          clarificationNeeded: true,
          questions: aiResponse.questions,
          reasoning: aiResponse.reasoning || null
        });
      }

      // ===========================
      // 4️⃣ Store Memory (Compressed)
      // ===========================
      if (aiResponse.memorySummary) {
        await storeMemory(
          Date.now(),
          aiResponse.memorySummary,
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

    // ===========================
    // 5️⃣ Return Final Response
    // ===========================
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