import { FiSun, FiBookOpen, FiSearch, FiSettings } from "react-icons/fi";

const ACTIONS = [
    { key: "simplify", label: "Simplify", icon: <FiSun /> },
    { key: "explain", label: "Explain", icon: <FiBookOpen /> },
    { key: "expand", label: "Expand", icon: <FiSearch /> },
    { key: "technical", label: "Technical Depth", icon: <FiSettings /> },
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
