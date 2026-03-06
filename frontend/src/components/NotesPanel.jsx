import { useState, useEffect, useRef, useCallback } from "react";
import { FiEdit3, FiEdit2 } from "react-icons/fi";
import TextSelectionToolbar from "./TextSelectionToolbar";

export default function NotesPanel({ isOpen, onToggle, query }) {
    const [notes, setNotes] = useState("");
    const textareaRef = useRef(null);
    const storageKey = `research-notes-${query || "global"}`;

    // Load notes from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) setNotes(saved);
        else setNotes("");
    }, [storageKey]);

    // Transform State
    const [selectionResult, setSelectionResult] = useState(null);
    const [selectionSource, setSelectionSource] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    const handleSelectionTransform = useCallback(
        async (selectedText, action, instruction) => {
            setSelectionSource(selectedText);
            setActionLoading(true);

            try {
                const res = await fetch(`http://localhost:5000/research/transform`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: selectedText, action, instruction }),
                });
                const data = await res.json();
                setSelectionResult(data.result || null);
            } catch {
                console.error("Selection transform failed");
            }

            setActionLoading(false);
        },
        []
    );

    const acceptSelection = () => {
        if (selectionResult && selectionSource) {
            const updated = notes.replace(selectionSource, selectionResult);
            setNotes(updated);
            localStorage.setItem(storageKey, updated);
            setSelectionResult(null);
            setSelectionSource("");
        }
    };

    const rejectSelection = () => {
        setSelectionResult(null);
        setSelectionSource("");
    };

    // Save notes on change
    const handleChange = (e) => {
        const val = e.target.value;
        setNotes(val);
        localStorage.setItem(storageKey, val);
    };

    // Append text to notes (called externally via ref or prop callback)
    const appendToNotes = (text) => {
        const newNotes = notes + (notes ? "\n\n---\n\n" : "") + text;
        setNotes(newNotes);
        localStorage.setItem(storageKey, newNotes);
    };

    // Expose appendToNotes globally so other components can use it
    useEffect(() => {
        window.__appendToNotes = appendToNotes;
        return () => { delete window.__appendToNotes; };
    });

    return (
        <>
            <button
                className={`notes-toggle ${isOpen ? "open" : ""}`}
                onClick={onToggle}
                id="notes-toggle-btn"
                title="Research Notes"
            >
                <FiEdit3 />
            </button>

            <div className={`notes-panel ${isOpen ? "open" : ""}`}>
                <div className="notes-header">
                    <h3>Research Notes</h3>
                    <button className="notes-close" onClick={onToggle}>×</button>
                </div>
                <div className="notes-body">
                    {actionLoading && (
                        <div className="notes-transform-loading" style={{ padding: '8px', fontSize: '12px', color: '#666', background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
                            Processing text selection...
                        </div>
                    )}
                    {selectionResult && (
                        <div className="selection-result-bar" style={{ margin: 0, borderBottom: '1px solid #ddd', borderLeft: 'none', borderRight: 'none', borderTop: 'none', borderRadius: 0 }}>
                            <div className="srb-header">
                                <span><FiEdit2 className="inline-icon" /> Selection edit applied</span>
                                <div className="srb-actions">
                                    <button className="arb-accept" onClick={acceptSelection}>✓ Accept</button>
                                    <button className="arb-reject" onClick={rejectSelection}>✗ Reject</button>
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
                    <textarea
                        ref={textareaRef}
                        value={notes}
                        onChange={handleChange}
                        placeholder="Type your notes here...&#10;&#10;You can also copy parts of the report using the text selection toolbar."
                        className="notes-textarea"
                        id="notes-textarea"
                    />
                </div>
                <div className="notes-footer">
                    <span className="notes-status">
                        {notes.length > 0 ? `${notes.length} chars · Auto-saved` : "No notes yet"}
                    </span>
                    {notes.length > 0 && (
                        <button
                            className="notes-clear"
                            onClick={() => {
                                setNotes("");
                                localStorage.removeItem(storageKey);
                            }}
                            id="notes-clear-btn"
                        >
                            Clear
                        </button>
                    )}
                </div>
                <TextSelectionToolbar
                    containerRef={textareaRef}
                    onTransform={handleSelectionTransform}
                />
            </div>
        </>
    );
}
