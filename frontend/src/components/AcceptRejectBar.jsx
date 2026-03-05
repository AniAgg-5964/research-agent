export default function AcceptRejectBar({ visible, actionLabel, onAccept, onReject, loading }) {
    if (!visible) return null;

    return (
        <div className="accept-reject-bar">
            <div className="arb-info">
                <span className="arb-icon">✏️</span>
                <span className="arb-label">
                    {loading ? "Transforming..." : `${actionLabel} applied`}
                </span>
            </div>
            {!loading && (
                <div className="arb-actions">
                    <button className="arb-accept" onClick={onAccept} id="accept-transform-btn">
                        ✓ Accept
                    </button>
                    <button className="arb-reject" onClick={onReject} id="reject-transform-btn">
                        ✗ Reject
                    </button>
                </div>
            )}
        </div>
    );
}
