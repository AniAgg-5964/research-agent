import { FiPlus, FiClock, FiChevronLeft, FiChevronRight, FiTrash2 } from "react-icons/fi";

function SessionSidebar({ sessions, activeSessionId, onSelectSession, onNewSession, onDeleteSession, collapsed, onToggleCollapse }) {

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = now - d;
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const handleDelete = (e, sessionId) => {
        e.stopPropagation();
        if (onDeleteSession) onDeleteSession(sessionId);
    };

    return (
        <div className={`session-sidebar ${collapsed ? "collapsed" : ""}`}>
            <div className="sidebar-header">
                {!collapsed && (
                    <>
                        <div className="sidebar-brand">
                            <span className="sidebar-brand-text">Mentis</span>
                        </div>
                        <button className="new-session-btn" onClick={onNewSession} id="new-session-btn">
                            <FiPlus />
                            <span>New Research</span>
                        </button>
                    </>
                )}
                <button
                    className="sidebar-toggle"
                    onClick={onToggleCollapse}
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    id="sidebar-toggle-btn"
                >
                    {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
                </button>
            </div>

            {!collapsed && (
                <div className="sidebar-sessions">
                    {sessions.length === 0 && (
                        <div className="sidebar-empty">
                            <p>No sessions yet</p>
                            <p className="sidebar-empty-hint">Start a new research to begin.</p>
                        </div>
                    )}
                    {sessions.map(s => (
                        <div
                            key={s._id}
                            className={`session-item ${activeSessionId === s._id ? "active" : ""}`}
                            onClick={() => onSelectSession(s._id)}
                            title={s.title}
                        >
                            <div className="session-item-title">{s.title}</div>
                            <div className="session-item-bottom">
                                <div className="session-item-meta">
                                    <FiClock className="session-meta-icon" />
                                    <span>{formatDate(s.createdAt)}</span>
                                </div>
                                <button
                                    className="session-delete-btn"
                                    onClick={(e) => handleDelete(e, s._id)}
                                    title="Delete session"
                                    id={`delete-session-${s._id}`}
                                >
                                    <FiTrash2 />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default SessionSidebar;
