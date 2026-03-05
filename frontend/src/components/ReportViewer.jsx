import { useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import ReportActions from "./ReportActions";
import AcceptRejectBar from "./AcceptRejectBar";
import TextSelectionToolbar from "./TextSelectionToolbar";

export default function ReportViewer({
    isOpen,
    onClose,
    reportText,
    onAction,
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
    const contentRef = useRef(null);

    if (!isOpen) return null;

    const displayText = transformResult || reportText;

    return (
        <div className="report-overlay" onClick={onClose}>
            <div className="report-modal" onClick={(e) => e.stopPropagation()}>
                <div className="report-modal-header">
                    <h2>Research Report</h2>
                    <div className="report-modal-header-actions">
                        <button
                            className="btn-ghost"
                            onClick={() => onExport("report")}
                            id="export-report-btn"
                        >
                            📄 Export PDF
                        </button>
                        <button className="report-close" onClick={onClose} id="close-report-btn">
                            ×
                        </button>
                    </div>
                </div>

                <AcceptRejectBar
                    visible={!!transformResult}
                    actionLabel={activeAction}
                    onAccept={onAcceptTransform}
                    onReject={onRejectTransform}
                    loading={actionLoading}
                />

                {selectionResult && (
                    <div className="selection-result-bar">
                        <div className="srb-header">
                            <span>✏️ Selection edit applied</span>
                            <div className="srb-actions">
                                <button className="arb-accept" onClick={onAcceptSelection}>✓ Accept</button>
                                <button className="arb-reject" onClick={onRejectSelection}>✗ Reject</button>
                            </div>
                        </div>
                        <div className="srb-preview">
                            <div className="srb-original">
                                <strong>Original:</strong>
                                <p>{selectionSource}</p>
                            </div>
                            <div className="srb-arrow">→</div>
                            <div className="srb-modified">
                                <strong>Modified:</strong>
                                <p>{selectionResult}</p>
                            </div>
                        </div>
                    </div>
                )}

                <ReportActions
                    onAction={onAction}
                    loading={actionLoading}
                    activeAction={activeAction}
                />

                <div className="report-content" ref={contentRef}>
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {displayText}
                    </ReactMarkdown>
                </div>

                <TextSelectionToolbar
                    containerRef={contentRef}
                    onTransform={onSelectionTransform}
                />
            </div>
        </div>
    );
}
