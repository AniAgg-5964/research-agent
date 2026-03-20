const mongoose = require("mongoose");

const researchSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    quickTake: {
        type: String,
        default: "",
    },
    report: {
        type: String,
        default: "",
    },
    clarificationNeeded: {
        type: Boolean,
        default: false,
    },
    clarificationQuestions: {
        type: Array,
        default: [],
    },
    clarificationDepth: {
        type: Number,
        default: 0,
    },
    partialPipelineState: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    pendingTransform: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    pipelineStage: {
        type: String,
        default: "",
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model("ResearchSession", researchSessionSchema);
