import { useState, useEffect, useCallback, useRef } from "react";
import { FiEdit2, FiScissors, FiSearch, FiEdit3, FiMessageSquare } from "react-icons/fi";

export default function TextSelectionToolbar({ containerRef, onTransform }) {
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [selectedText, setSelectedText] = useState("");
    const [showCustom, setShowCustom] = useState(false);
    const [customInstruction, setCustomInstruction] = useState("");
    const toolbarRef = useRef(null);

    const handleSelectionChange = useCallback(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();

        if (!text || text.length < 5) {
            // Small delay to allow button clicks to register before hiding
            setTimeout(() => {
                const sel = window.getSelection()?.toString().trim();
                if (!sel || sel.length < 5) {
                    setVisible(false);
                    setShowCustom(false);
                }
            }, 200);
            return;
        }

        // Check if selection is within the report container
        if (containerRef?.current) {
            const range = selection.getRangeAt(0);
            const container = containerRef.current;
            if (!container.contains(range.commonAncestorContainer)) {
                return;
            }
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        setSelectedText(text);
        setPosition({
            top: rect.top + window.scrollY - 50,
            left: rect.left + window.scrollX + rect.width / 2,
        });
        setVisible(true);
    }, [containerRef]);

    useEffect(() => {
        document.addEventListener("mouseup", handleSelectionChange);
        return () => document.removeEventListener("mouseup", handleSelectionChange);
    }, [handleSelectionChange]);

    const handleAction = (action) => {
        if (selectedText) {
            onTransform(selectedText, action);
            setVisible(false);
            window.getSelection()?.removeAllRanges();
        }
    };

    const handleCustomSubmit = () => {
        if (selectedText && customInstruction.trim()) {
            onTransform(selectedText, "custom", customInstruction);
            setVisible(false);
            setShowCustom(false);
            setCustomInstruction("");
            window.getSelection()?.removeAllRanges();
        }
    };

    if (!visible) return null;

    return (
        <div
            className="text-selection-toolbar"
            ref={toolbarRef}
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
            }}
        >
            <div className="tst-buttons">
                <button onClick={() => handleAction("rewrite")} className="tst-btn" id="tst-rewrite">
                    <FiEdit2 className="inline-icon" /> Rewrite
                </button>
                <button onClick={() => handleAction("shorten")} className="tst-btn" id="tst-shorten">
                    <FiScissors className="inline-icon" /> Shorten
                </button>
                <button onClick={() => handleAction("clarify")} className="tst-btn" id="tst-clarify">
                    <FiSearch className="inline-icon" /> Clarify
                </button>
                <button
                    onClick={() => {
                        if (window.__appendToNotes) {
                            window.__appendToNotes(selectedText);
                        }
                        setVisible(false);
                        window.getSelection()?.removeAllRanges();
                    }}
                    className="tst-btn tst-copy"
                    id="tst-copy-notes"
                >
                    <FiEdit3 className="inline-icon" /> Copy to Notes
                </button>
                <button
                    onClick={() => setShowCustom(!showCustom)}
                    className={`tst-btn ${showCustom ? "active" : ""}`}
                    id="tst-custom-toggle"
                >
                    <FiMessageSquare className="inline-icon" /> Custom
                </button>
            </div>
            {showCustom && (
                <div className="tst-custom">
                    <input
                        type="text"
                        value={customInstruction}
                        onChange={(e) => setCustomInstruction(e.target.value)}
                        placeholder='e.g. "Convert to bullet points"'
                        className="tst-custom-input"
                        id="tst-custom-input"
                        onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
                        autoFocus
                    />
                    <button onClick={handleCustomSubmit} className="tst-submit" id="tst-custom-submit">
                        →
                    </button>
                </div>
            )}
        </div>
    );
}
