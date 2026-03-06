import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { FiZap, FiFileText, FiChevronDown, FiChevronUp } from "react-icons/fi";
import FollowUpChat from "./FollowUpChat";
import ReportViewer from "./ReportViewer";

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
}) {
    const [followupMessages, setFollowupMessages] = useState([]);
    const [reportOpen, setReportOpen] = useState(false);
    const [quickTakeOpen, setQuickTakeOpen] = useState(false);

    useEffect(() => {
        const followups = messages.filter(m => m.type === "followup");
        setFollowupMessages(followups);
    }, [messages]);

    const fullReport = reportText || [...messages]
        .filter(m => m.role === "assistant" && m.type !== "followup")
        .pop()?.content || "";

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
                    {session.quickTake && (
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
                            onClick={() => setReportOpen(true)}
                            id="session-view-report-btn"
                        >
                            <FiFileText className="inline-icon" /> Full Report
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Take — expandable inline */}
            {quickTakeOpen && session.quickTake && (
                <div className="session-quicktake-inline">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {session.quickTake}
                    </ReactMarkdown>
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
                onClose={() => setReportOpen(false)}
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
