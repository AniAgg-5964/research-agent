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

    // Take first 60 chars, trim to last complete word
    let title = query.trim().substring(0, 60);
    const lastSpace = title.lastIndexOf(" ");
    if (lastSpace > 20 && title.length >= 60) {
        title = title.substring(0, lastSpace);
    }

    // Capitalize first letter of each word
    title = title
        .split(" ")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

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
            { quickTake: quickTake || "" },
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

