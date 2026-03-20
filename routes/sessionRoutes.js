const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const ResearchSession = require("../models/ResearchSession");
const Message = require("../models/Message");
const { runGroqPrompt } = require("../services/groqService");

// ===========================
// Helper: Generate title from query
// ===========================
function generateTitle(query) {
    if (!query || !query.trim()) return "Untitled Research";

    // 1. Get the first meaningful sentence/phrase (split by common punctuation)
    let title = query.split(/[.?!;\n]/)[0].trim();

    // 2. Remove common conversational or filler prefixes
    const prefixesToRemove = [
        "conduct a deep technical investigation of",
        "conduct a deep investigation of",
        "deep technical investigation of",
        "conduct a research on",
        "conduct research on",
        "research",
        "investigate",
        "tell me about",
        "explain",
        "what is",
        "how does",
        "find information on"
    ];

    let lowerTitle = title.toLowerCase();
    for (const prefix of prefixesToRemove) {
        if (lowerTitle.startsWith(prefix)) {
            // Remove the prefix and trim
            title = title.substring(prefix.length).trim();
            lowerTitle = title.toLowerCase();
            break; // only remove the first matching prefix
        }
    }

    // If we stripped it to nothing, fallback (unlikely but safe)
    if (!title) title = query.trim().substring(0, 40);

    // 3. Limit to around 8 words max for conciseness
    const words = title.split(/\s+/);
    if (words.length > 8) {
        title = words.slice(0, 8).join(" ");
    }

    // 4. Capitalize first letter of each word
    title = title
        .split(" ")
        .map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : "")
        .join(" ")
        .trim();

    return title;
}

// ===========================
// POST /api/session/create
// ===========================
router.post("/create", authMiddleware, async (req, res) => {
    try {
        const { query } = req.body;
        const title = generateTitle(query);
        console.log(`[Session] Creating new session: "${title}" for user ${req.user.id}`);

        const session = await ResearchSession.create({
            userId: req.user.id,
            title,
        });

        res.status(201).json({
            id: session._id,
            title: session.title,
            createdAt: session.createdAt,
        });
    } catch (error) {
        console.error("Create session error:", error.message);
        res.status(500).json({ error: "Failed to create session." });
    }
});

// ===========================
// GET /api/session/list
// ===========================
router.get("/list", authMiddleware, async (req, res) => {
    try {
        const sessions = await ResearchSession.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .select("_id title createdAt quickTake")
            .lean();

        res.json(sessions);
    } catch (error) {
        console.error("List sessions error:", error.message);
        res.status(500).json({ error: "Failed to list sessions." });
    }
});

// ===========================
// GET /api/session/:id
// ===========================
router.get("/:id", authMiddleware, async (req, res) => {
    try {
        console.log(`[Session] Loading session ${req.params.id}`);
        // Verify session belongs to user
        const session = await ResearchSession.findOne({
            _id: req.params.id,
            userId: req.user.id,
        });

        if (!session) {
            return res.status(404).json({ error: "Session not found." });
        }

        const messages = await Message.find({ sessionId: req.params.id })
            .sort({ timestamp: 1 })
            .lean();

        res.json({
            session: {
                id: session._id,
                title: session.title,
                createdAt: session.createdAt,
                quickTake: session.quickTake || "",
                report: session.report || "",
                clarificationNeeded: session.clarificationNeeded || false,
                clarificationQuestions: session.clarificationQuestions || [],
                clarificationDepth: session.clarificationDepth || 0,
                partialPipelineState: session.partialPipelineState || {},
                pendingTransform: session.pendingTransform || null,
                pipelineStage: session.pipelineStage || "",
            },
            messages,
        });
    } catch (error) {
        console.error("Get session error:", error.message);
        res.status(500).json({ error: "Failed to get session." });
    }
});

// ===========================
// PUT /api/session/:id/summary
// Persist quickTake after research
// ===========================
router.put("/:id/summary", authMiddleware, async (req, res) => {
    try {
        const { quickTake } = req.body;

        const session = await ResearchSession.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { $set: { quickTake: quickTake || "" } },
            { returnDocument: "after" }
        );

        if (!session) {
            return res.status(404).json({ error: "Session not found." });
        }

        console.log(`[Session] Saved quickTake for session ${req.params.id}`);
        res.json({ success: true });
    } catch (error) {
        console.error("Save summary error:", error.message);
        res.status(500).json({ error: "Failed to save summary." });
    }
});

// ===========================
// PUT /api/session/:id/report
// Persist report edits
// ===========================
router.put("/:id/report", authMiddleware, async (req, res) => {
    try {
        const { report } = req.body;

        const session = await ResearchSession.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { $set: { report: report || "" } },
            { new: true }
        );

        if (!session) {
            return res.status(404).json({ error: "Session not found." });
        }

        console.log(`[Session] Saved report for session ${req.params.id}`);
        res.json({ success: true });
    } catch (error) {
        console.error("Save report error:", error.message);
        res.status(500).json({ error: "Failed to save report." });
    }
});

// ===========================
// PUT /api/session/:id/clarification
// Persist clarification state
// ===========================
router.put("/:id/clarification", authMiddleware, async (req, res) => {
    try {
        const { clarificationNeeded, clarificationQuestions, clarificationDepth, partialPipelineState } = req.body;

        const session = await ResearchSession.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            {
                $set: {
                    clarificationNeeded: !!clarificationNeeded,
                    clarificationQuestions: clarificationQuestions || [],
                    clarificationDepth: clarificationDepth || 0,
                    partialPipelineState: partialPipelineState || {}
                }
            },
            { new: true }
        );

        if (!session) {
            return res.status(404).json({ error: "Session not found." });
        }

        console.log(`[Session] Saved clarification state for session ${req.params.id}`);
        res.json({ success: true });
    } catch (error) {
        console.error("Save clarification error:", error.message);
        res.status(500).json({ error: "Failed to save clarification state." });
    }
});

// ===========================
// PUT /api/session/:id/pending-transform
// Persist pending edit state
// ===========================
router.put("/:id/pending-transform", authMiddleware, async (req, res) => {
    try {
        const { pendingTransform } = req.body;

        const session = await ResearchSession.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { $set: { pendingTransform: pendingTransform || null } },
            { new: true }
        );

        if (!session) {
            return res.status(404).json({ error: "Session not found." });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Save pending transform error:", error.message);
        res.status(500).json({ error: "Failed to save pending transform." });
    }
});

// ===========================
// POST /api/session/:id/message
// ===========================
router.post("/:id/message", authMiddleware, async (req, res) => {
    try {
        const { role, content } = req.body;

        if (!role || !content) {
            return res.status(400).json({ error: "Role and content are required." });
        }

        if (!["user", "assistant"].includes(role)) {
            return res.status(400).json({ error: "Role must be 'user' or 'assistant'." });
        }

        // Verify session belongs to user
        const session = await ResearchSession.findOne({
            _id: req.params.id,
            userId: req.user.id,
        });

        if (!session) {
            return res.status(404).json({ error: "Session not found." });
        }

        const message = await Message.create({
            sessionId: req.params.id,
            role,
            content,
        });

        res.status(201).json({
            id: message._id,
            sessionId: message.sessionId,
            role: message.role,
            content: message.content,
            timestamp: message.timestamp,
        });
    } catch (error) {
        console.error("Store message error:", error.message);
        res.status(500).json({ error: "Failed to store message." });
    }
});

// ===========================
// POST /api/session/:id/followup
// Lightweight follow-up using Groq
// ===========================
router.post("/:id/followup", authMiddleware, async (req, res) => {
    try {
        const { question } = req.body;

        if (!question || !question.trim()) {
            return res.status(400).json({ error: "Question is required." });
        }

        // Fetch session with quickTake
        const session = await ResearchSession.findOne({
            _id: req.params.id,
            userId: req.user.id,
        });

        if (!session) {
            return res.status(404).json({ error: "Session not found." });
        }

        // Get recent follow-up conversation for context
        const recentMessages = await Message.find({
            sessionId: req.params.id,
            type: "followup",
        })
            .sort({ timestamp: -1 })
            .limit(10)
            .lean();

        const chatHistory = recentMessages.reverse()
            .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
            .join("\n");

        // Build prompt with quickTake context
        const contextText = session.quickTake || "No research summary available.";
        const prompt = `You are a helpful research assistant. You have access to the following research context from a previous deep research session.

Research Context:
${contextText}

${chatHistory ? `Previous Follow-up Conversation:\n${chatHistory}\n` : ""}
User Question: ${question}

Respond concisely and helpfully based on the research context. If the question goes beyond the available context, say so honestly.`;

        console.log(`[Followup] Processing follow-up for session ${req.params.id}`);

        // Store user message
        await Message.create({
            sessionId: req.params.id,
            role: "user",
            content: question,
            type: "followup",
        });

        // Call Groq
        const answer = await runGroqPrompt(prompt);

        // Store assistant message
        await Message.create({
            sessionId: req.params.id,
            role: "assistant",
            content: answer,
            type: "followup",
        });

        res.json({ answer });
    } catch (error) {
        console.error("Followup error:", error.message);
        res.status(500).json({ error: "Follow-up failed.", details: error.message });
    }
});

// ===========================
// DELETE /api/session/:id
// ===========================
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const session = await ResearchSession.findOne({
            _id: req.params.id,
            userId: req.user.id,
        });

        if (!session) {
            return res.status(404).json({ error: "Session not found." });
        }

        // Delete all messages for this session
        await Message.deleteMany({ sessionId: req.params.id });

        // Delete the session itself
        await ResearchSession.deleteOne({ _id: req.params.id });

        console.log(`[Session] Deleted session ${req.params.id} and its messages`);
        res.json({ success: true });
    } catch (error) {
        console.error("Delete session error:", error.message);
        res.status(500).json({ error: "Failed to delete session." });
    }
});

module.exports = router;

