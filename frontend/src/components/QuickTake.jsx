import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export default function QuickTake({ quickTake, onViewFullReport, onExport }) {
    if (!quickTake) return null;

    return (
        <div className="quick-take">
            <div className="quick-take-header">
                <div className="quick-take-badge">⚡ Quick Take</div>
            </div>
            <div className="quick-take-content">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {quickTake}
                </ReactMarkdown>
            </div>
            <div className="quick-take-actions">
                <button className="btn-primary" onClick={onViewFullReport} id="view-full-report-btn">
                    View Full Report →
                </button>
                <button className="btn-ghost" onClick={() => onExport("quicktake")} id="export-quicktake-btn">
                    📄 Export
                </button>
            </div>
        </div>
    );
}
