import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { FiZap, FiFileText, FiChevronDown, FiChevronUp, FiMessageSquare } from "react-icons/fi";
import FollowUpChat from "./FollowUpChat";
import ReportViewer from "./ReportViewer";
import PipelineProgress from "./PipelineProgress";

export default function StoredSessionView({
    session,
    messages,
    reportText,
    token,
    onReportAction,
    actionLoading,
    activeAction,
    transformResult,
    onAcceptTransform,
    onRejectTransform,
    onSelectionTransform,
    selectionResult,
    selectionSource,
    onAcceptSelection,
    onRejectSelection,
    onExport,
    // New props for refresh resilience
    clarificationNeeded = false,
    questions = [],
    answers = [],
    onAnswerChange,
    onSubmitClarification,
    pipelineActive = false,
    pipelineSteps = [],
    pipelinePaused = false,
    quickTake: quickTakeProp,
}) {
    const [followupMessages, setFollowupMessages] = useState([]);
    const [quickTakeOpen, setQuickTakeOpen] = useState(false);

    // Persist report modal state in sessionStorage so it survives refresh
    const reportStorageKey = `reportOpen_${session.id}`;
    const [reportOpen, setReportOpen] = useState(() => {
        return sessionStorage.getItem(reportStorageKey) === "true";
    });

    const toggleReportOpen = (open) => {
        setReportOpen(open);
        if (open) {
            sessionStorage.setItem(reportStorageKey, "true");
        } else {
            sessionStorage.removeItem(reportStorageKey);
        }
    };

    useEffect(() => {
        const followups = messages.filter(m => m.type === "followup");
        setFollowupMessages(followups);
    }, [messages]);

    const fullReport = reportText || [...messages]
        .filter(m => m.role === "assistant" && m.type !== "followup")
        .pop()?.content || "";

    // Use quickTake prop if available, otherwise fall back to session.quickTake
    const quickTakeText = quickTakeProp || session.quickTake || "";

    const handleNewMessage = (msg) => {
        setFollowupMessages(prev => [...prev, msg]);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
        });
    };

    return (
        <div className="stored-session-view">
            {/* Session Title — clean typography, no card */}
            <div className="session-title-area">
                <h1 className="session-title">{session.title}</h1>
                <p className="session-date">{formatDate(session.createdAt)}</p>

                <div className="session-title-actions">
                    {quickTakeText && (
                        <button
                            className="btn-ghost btn-sm"
                            onClick={() => setQuickTakeOpen(!quickTakeOpen)}
                            id="toggle-quicktake-btn"
                        >
                            <FiZap className="inline-icon" />
                            {quickTakeOpen ? "Hide Quick Take" : "View Quick Take"}
                            {quickTakeOpen ? <FiChevronUp className="inline-icon" /> : <FiChevronDown className="inline-icon" />}
                        </button>
                    )}
                    {fullReport && (
                        <button
                            className="btn-ghost btn-sm"
                            onClick={() => toggleReportOpen(true)}
                            id="session-view-report-btn"
                        >
                            <FiFileText className="inline-icon" /> Full Report
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Take — expandable inline */}
            {quickTakeOpen && quickTakeText && (
                <div className="session-quicktake-inline">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {quickTakeText}
                    </ReactMarkdown>
                </div>
            )}

            {/* Pipeline Progress — shown if pipeline is active or paused for clarification */}
            <PipelineProgress active={pipelineActive} steps={pipelineSteps} paused={pipelinePaused} />

            {/* Clarification Questions — restored from backend */}
            {clarificationNeeded && (
                <div className="clarification-box">
                    <h3><FiMessageSquare className="inline-icon" /> Agent needs clarification</h3>
                    {questions.map((q, i) => (
                        <div key={i} className="question-block">
                            <p>{q.question}</p>
                            {q.options.map((option, j) => (
                                <label key={j} className="option-label">
                                    <input
                                        type="radio"
                                        name={`session-question-${i}`}
                                        value={option}
                                        checked={answers[i] === option}
                                        onChange={() => onAnswerChange && onAnswerChange(i, option)}
                                    />
                                    {option}
                                </label>
                            ))}
                        </div>
                    ))}
                    <button className="run-btn" onClick={onSubmitClarification}>
                        Submit Answers
                    </button>
                </div>
            )}

            {/* Follow-Up Chat */}
            <FollowUpChat
                sessionId={session.id}
                messages={followupMessages}
                onNewMessage={handleNewMessage}
                token={token}
            />

            {/* Full Report Modal */}
            <ReportViewer
                isOpen={reportOpen}
                onClose={() => toggleReportOpen(false)}
                reportText={fullReport}
                onAction={onReportAction}
                actionLoading={actionLoading}
                activeAction={activeAction}
                transformResult={transformResult}
                onAcceptTransform={onAcceptTransform}
                onRejectTransform={onRejectTransform}
                onSelectionTransform={onSelectionTransform}
                selectionResult={selectionResult}
                selectionSource={selectionSource}
                onAcceptSelection={onAcceptSelection}
                onRejectSelection={onRejectSelection}
                onExport={onExport}
            />
        </div>
    );
}
