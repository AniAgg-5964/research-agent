import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { FiSend, FiSearch } from "react-icons/fi";

const SESSION_API = "http://localhost:5000/api/session";

export default function FollowUpChat({ sessionId, messages, onNewMessage, token }) {
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async (overrideText) => {
        const question = (overrideText || input).trim();
        if (!question || loading) return;

        setInput("");
        setLoading(true);

        onNewMessage({ role: "user", content: question, timestamp: new Date().toISOString() });

        try {
            const res = await fetch(`${SESSION_API}/${sessionId}/followup`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({ question }),
            });
            const data = await res.json();

            if (data.answer) {
                onNewMessage({ role: "assistant", content: data.answer, timestamp: new Date().toISOString() });
            } else {
                onNewMessage({ role: "assistant", content: "Sorry, I couldn't generate a response.", timestamp: new Date().toISOString() });
            }
        } catch {
            onNewMessage({ role: "assistant", content: "Error connecting to server.", timestamp: new Date().toISOString() });
        }

        setLoading(false);
        inputRef.current?.focus();
    };

    return (
        <div className="followup-chat">
            {/* Messages */}
            <div className="followup-messages">
                {messages.length === 0 && !loading && (
                    <div className="followup-empty">
                        <p>Ask a follow-up question about this research</p>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`followup-msg followup-msg-${msg.role}`}>
                        <span className="followup-msg-role">
                            {msg.role === "user" ? "You" : "Mentis"}
                        </span>
                        <div className="followup-msg-content">
                            {msg.role === "assistant" ? (
                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {msg.content}
                                </ReactMarkdown>
                            ) : (
                                <p>{msg.content}</p>
                            )}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="followup-msg followup-msg-assistant">
                        <span className="followup-msg-role">Mentis</span>
                        <div className="followup-msg-content">
                            <div className="followup-typing">
                                <span className="typing-dot" />
                                <span className="typing-dot" />
                                <span className="typing-dot" />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="followup-input-area">
                <div className="followup-input-wrapper">
                    <FiSearch className="followup-input-icon" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="followup-input"
                        placeholder="Ask a follow-up question..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        disabled={loading}
                        id="followup-input"
                    />
                    <button
                        className="followup-send-btn"
                        onClick={() => handleSend()}
                        disabled={!input.trim() || loading}
                        id="followup-send-btn"
                    >
                        <FiSend />
                    </button>
                </div>
            </div>
        </div>
    );
}
