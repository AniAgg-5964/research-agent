const ACTIONS = [
    { key: "simplify", label: "Simplify", icon: "💡" },
    { key: "explain", label: "Explain", icon: "📖" },
    { key: "expand", label: "Expand", icon: "🔍" },
    { key: "technical", label: "Technical Depth", icon: "⚙️" },
];

export default function ReportActions({ onAction, loading, activeAction }) {
    return (
        <div className="report-actions">
            {ACTIONS.map((a) => (
                <button
                    key={a.key}
                    className={`report-action-btn ${activeAction === a.key ? "active" : ""}`}
                    onClick={() => onAction(a.key)}
                    disabled={loading}
                    id={`action-${a.key}`}
                >
                    <span className="action-icon">{a.icon}</span>
                    <span>{a.label}</span>
                </button>
            ))}
        </div>
    );
}
