import { useState, useEffect, useCallback, useRef } from "react";
import { FiEdit2, FiScissors, FiSearch, FiEdit3, FiMessageSquare } from "react-icons/fi";

export default function TextSelectionToolbar({ containerRef, onTransform }) {
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [selectedText, setSelectedText] = useState("");
    const [showCustom, setShowCustom] = useState(false);
    const [customInstruction, setCustomInstruction] = useState("");
    const toolbarRef = useRef(null);

    const handleSelectionChange = useCallback((e) => {
        let text = "";
        let rect = null;

        const activeEl = document.activeElement;
        const isTextarea = activeEl && activeEl.tagName === 'TEXTAREA';

        if (isTextarea) {
            const start = activeEl.selectionStart;
            const end = activeEl.selectionEnd;
            if (start !== undefined && end !== undefined && start !== end) {
                text = activeEl.value.substring(start, end).trim();
            }
        } else {
            const selection = window.getSelection();
            text = selection?.toString().trim();
        }

        if (!text || text.length < 5) {
            // Small delay to allow button clicks to register before hiding
            setTimeout(() => {
                let selText = "";
                const activeElnow = document.activeElement;
                if (activeElnow && activeElnow.tagName === 'TEXTAREA') {
                    const start = activeElnow.selectionStart;
                    const end = activeElnow.selectionEnd;
                    if (start !== undefined && end !== undefined && start !== end) {
                        selText = activeElnow.value.substring(start, end).trim();
                    }
                } else {
                    selText = window.getSelection()?.toString().trim();
                }

                if (!selText || selText.length < 5) {
                    setVisible(false);
                    setShowCustom(false);
                }
            }, 200);
            return;
        }

        // Check if selection is within the report container
        if (containerRef?.current) {
            const container = containerRef.current;
            if (isTextarea) {
                if (activeEl !== container) return;
            } else {
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    if (!container.contains(range.commonAncestorContainer)) {
                        return;
                    }
                }
            }
        }

        if (isTextarea) {
            // For textarea, position near the cursor event
            const x = e && e.clientX ? e.clientX : position.left;
            const y = e && e.clientY ? e.clientY : position.top;
            setPosition({
                top: Math.max(0, y - 50),
                left: x,
            });
        } else {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                rect = range.getBoundingClientRect();
                setPosition({
                    top: Math.max(0, rect.top - 50),
                    left: rect.left + rect.width / 2,
                });
            }
        }

        setSelectedText(text);
        setVisible(true);
    }, [containerRef, position.left, position.top]);

    useEffect(() => {
        document.addEventListener("mouseup", handleSelectionChange);
        return () => document.removeEventListener("mouseup", handleSelectionChange);
    }, [handleSelectionChange]);

    const handleAction = (action) => {
        if (selectedText) {
            onTransform(selectedText, action);
            setVisible(false);
            const activeEl = document.activeElement;
            if (activeEl && activeEl.tagName === 'TEXTAREA') {
                activeEl.setSelectionRange(0, 0); // clear textarea selection
            } else {
                window.getSelection()?.removeAllRanges();
            }
        }
    };

    const handleCustomSubmit = () => {
        if (selectedText && customInstruction.trim()) {
            onTransform(selectedText, "custom", customInstruction);
            setVisible(false);
            setShowCustom(false);
            setCustomInstruction("");
            const activeEl = document.activeElement;
            if (activeEl && activeEl.tagName === 'TEXTAREA') {
                activeEl.setSelectionRange(0, 0); // clear textarea selection
            } else {
                window.getSelection()?.removeAllRanges();
            }
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
