import { useState, useEffect, useRef } from "react";
import { FiEdit3 } from "react-icons/fi";

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
            </div>
        </>
    );
}
