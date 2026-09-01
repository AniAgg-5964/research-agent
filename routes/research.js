const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const { runQuickResearch, runDeepResearch } = require("../services/geminiService");
const { storeMemory, searchMemory } = require("../services/memoryService");
const { runGroqPrompt } = require("../services/groqService");
const Message = require("../models/Message");
const ResearchSession = require("../models/ResearchSession");

router.post("/", async (req, res) => {
  try {
    const { query, mode, persona, clarificationDepth = 0, sessionId } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");

    const emitProgress = (stage, status = "running") => {
      res.write(JSON.stringify({ type: "progress", stage, status }) + "\n");
      // Persist pipeline stage to MongoDB so frontend can restore on refresh
      if (sessionId) {
        ResearchSession.findByIdAndUpdate(sessionId, { $set: { pipelineStage: stage } }).catch(err => {
          console.error("Failed to persist pipeline stage:", err.message);
        });
      }
    };

    // ===========================
    // Build context from previous session messages
    // ===========================
    let contextPrefix = "";
    if (sessionId) {
      try {
        const prevMessages = await Message.find({ sessionId })
          .sort({ timestamp: -1 })
          .limit(10)
          .lean();

        if (prevMessages.length > 0) {
          const chronological = prevMessages.reverse();
          contextPrefix = "Previous conversation context:\n" +
            chronological
              .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.substring(0, 500)}`)
              .join("\n") +
            "\n\n---\nCurrent query:\n";
          console.log(`Injected ${chronological.length} previous messages as context`);
        }
      } catch (ctxErr) {
        console.error("Context injection error:", ctxErr.message);
      }
    }

    if (sessionId) {
      try {
        // Ensure session exists in MongoDB with current user ownership
        if (req.user?.id) {
          const existingSession = await ResearchSession.findById(sessionId);
          if (!existingSession) {
            await ResearchSession.create({
              _id: sessionId,
              userId: req.user.id,
              title: query.substring(0, 60),
            });
            console.log(`[Session] Created missing session document for ${sessionId}`);
          }
        }

        const existingUserMsg = await Message.findOne({ sessionId, role: "user", content: query });
        if (!existingUserMsg) {
          await Message.create({
            sessionId,
            role: "user",
            content: query,
            type: "research"
          });
        }
      } catch (userMsgErr) {
        console.error("User message DB save warning:", userMsgErr.message);
      }
    }

    const enrichedQuery = contextPrefix + query;

    let aiResponse;
    let memoryCount = 0;

    if (mode === "deep") {

      // ===========================
      // 1️⃣ Search Similar Memory
      // ===========================
      emitProgress("Retrieving Relevant Memory");
      let pastMemories = [];
      try {
        pastMemories = await searchMemory(enrichedQuery);
        console.log(
          "Raw retrieved memories:",
          pastMemories.map(m => ({ score: m.score }))
        );
      } catch (memErr) {
        console.error("Memory search failed (continuing without memory):", memErr.message);
      }

      const SIMILARITY_THRESHOLD = 0.75;

      const filteredMemories = pastMemories.filter(
        m => m.score >= SIMILARITY_THRESHOLD
      );
      memoryCount = filteredMemories.length;

      let memoryText = "";

      if (filteredMemories.length > 0) {
        // Inject stored summaries (not full reports)
        memoryText = filteredMemories
          .map(m => m.payload.summary)
          .join("\n\n");
      }

      const MAX_MEMORY_CHARS = 3000;
      if (memoryText.length > MAX_MEMORY_CHARS) {
        memoryText = memoryText.substring(0, MAX_MEMORY_CHARS);
      }

      console.log("Filtered memories count:", filteredMemories.length);
      console.log("Memory injected length:", memoryText.length);

      // ===========================
      // 2️⃣ Run Deep Research
      // ===========================
      aiResponse = await runDeepResearch(enrichedQuery, memoryText, persona, clarificationDepth, emitProgress);

      // ===========================
      // 3️⃣ Handle Clarification
      // ===========================
      if (aiResponse.clarificationNeeded) {
        console.log("Agent requested clarification");

        if (sessionId) {
          try {
            await ResearchSession.findByIdAndUpdate(sessionId, {
              $set: {
                clarificationNeeded: true,
                clarificationQuestions: aiResponse.questions,
                clarificationDepth: clarificationDepth || 0,
                pipelineStage: "waiting_for_clarification"
              }
            });
          } catch (err) {
            console.error("Failed to save clarification state to session:", err.message);
          }
        }

        res.write(JSON.stringify({
          type: "clarification",
          data: {
            clarificationNeeded: true,
            questions: aiResponse.questions,
            reasoning: aiResponse.reasoning || null
          }
        }) + "\n");
        return res.end();
      }

      // ===========================
      // 4️⃣ Store Memory (Compressed)
      // ===========================
      if (aiResponse.memorySummary) {
        emitProgress("Saving Knowledge to Memory");
        try {
          await storeMemory(
            crypto.randomUUID(),
            aiResponse.memorySummary,
            {
              query,
              summary: aiResponse.memorySummary,
              fullReport: aiResponse.answer
            }
          );
        } catch (memErr) {
          console.error("Memory storage failed (research still saved):", memErr.message);
        }
      }

    } else {
      console.log("[Route] Running QUICK mode for query:", query.substring(0, 60) + "...");
      aiResponse = await runQuickResearch(enrichedQuery, persona);
      console.log("[Route] Quick mode complete, answer length:", aiResponse.answer?.length || 0);
    }

    // Persist completed research report and message to MongoDB session
    if (sessionId && aiResponse?.answer && !aiResponse.answer.startsWith("Error:")) {
      try {
        await ResearchSession.findByIdAndUpdate(
          sessionId,
          {
            $set: {
              ...(req.user?.id ? { userId: req.user.id } : {}),
              clarificationNeeded: false,
              clarificationQuestions: [],
              clarificationDepth: 0,
              report: aiResponse.answer,
              pipelineStage: ""
            }
          },
          { upsert: true, new: true }
        );
        await Message.create({
          sessionId,
          role: "assistant",
          content: aiResponse.answer,
          type: "research"
        });
        console.log(`[Session] Persisted research report and assistant message to session ${sessionId}`);
      } catch (err) {
        console.error("Failed to persist report to session:", err.message);
      }
    }

    // ===========================
    // 5️⃣ Return Final Response
    // ===========================
    res.write(JSON.stringify({
      type: "result",
      data: {
        answer: aiResponse.answer,
        usage: aiResponse.usage,
        mode: mode || "quick",
        reasoning: aiResponse.reasoning || null,
        memoryCount: memoryCount
      }
    }) + "\n");
    res.end();

  } catch (error) {
    console.error("FULL ERROR:", error);

    if (!res.headersSent) {
      res.status(500).json({
        error: "Something went wrong",
        details: error.message
      });
    } else {
      res.write(JSON.stringify({
        type: "error",
        error: "Something went wrong",
        details: error.message
      }) + "\n");
      res.end();
    }
  }
});

// ===========================
// TRANSFORM (Groq only)
// ===========================
router.post("/transform", async (req, res) => {
  try {
    const { text, action, instruction } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const prompts = {
      simplify: `Rewrite the following text in simpler, more accessible language. Keep the same structure and meaning but make it easy to understand for a general audience.\n\nText:\n${text}`,
      explain: `Explain the following text for a beginner who has no background in this topic. Break down complex concepts, define technical terms, and use analogies where helpful.\n\nText:\n${text}`,
      expand: `Expand the following text with deeper explanations, additional context, examples, and supporting details. Maintain the same structure but make it more comprehensive.\n\nText:\n${text}`,
      technical: `Rewrite the following text with much deeper technical depth. Add implementation details, technical specifications, architecture considerations, performance implications, and edge cases. Target an expert audience.\n\nText:\n${text}`,
      rewrite: `Rewrite the following text more clearly and concisely while preserving the original meaning.\n\nText:\n${text}`,
      shorten: `Shorten the following text significantly while keeping the key points and essential information. Be concise.\n\nText:\n${text}`,
      clarify: `Clarify the following text by making ambiguous parts more precise, restructuring confusing sentences, and ensuring the meaning is crystal clear.\n\nText:\n${text}`,
      custom: `${instruction || "Improve the following text."}\n\nText:\n${text}`
    };

    const prompt = prompts[action] || prompts.custom;
    const result = await runGroqPrompt(prompt);

    res.json({ result });
  } catch (error) {
    console.error("Transform error:", error.message);
    res.status(500).json({ error: "Transform failed", details: error.message });
  }
});

// ===========================
// QUICK TAKE (Groq only)
// ===========================
router.post("/quick-take", async (req, res) => {
  try {
    const { reportText } = req.body;

    if (!reportText) {
      return res.status(400).json({ error: "Report text is required" });
    }

    const prompt = `You are a research summarizer. Given the following research report, generate a Quick Take summary in markdown format.

Structure your response EXACTLY like this:

## Overview
1-2 sentence overview of the research findings.

## Key Insights
- Insight 1
- Insight 2
- Insight 3
- Insight 4
(provide 4-6 bullet insights)

## Key Takeaway
One sentence that captures the single most important finding or conclusion.

Research Report:
${reportText.substring(0, 6000)}`;

    const quickTake = await runGroqPrompt(prompt);

    res.json({ quickTake });
  } catch (error) {
    console.error("Quick Take error:", error.message);
    res.status(500).json({ error: "Quick Take generation failed", details: error.message });
  }
});

module.exports = router;