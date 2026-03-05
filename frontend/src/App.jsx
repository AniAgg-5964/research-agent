import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";
import "katex/dist/katex.min.css";

import PipelineProgress from "./components/PipelineProgress";
import QuickTake from "./components/QuickTake";
import ReportViewer from "./components/ReportViewer";
import NotesPanel from "./components/NotesPanel";
import SessionSidebar from "./components/SessionSidebar";
import StoredSessionView from "./components/StoredSessionView";
import { FiCpu, FiMessageSquare, FiLogOut, FiUser } from "react-icons/fi";

const API_BASE = "http://localhost:5000/research";
const SESSION_API = "http://localhost:5000/api/session";

function ResearchWorkspace() {
    const navigate = useNavigate();

    // User profile
    const storedUser = JSON.parse(localStorage.getItem("user") || "null");
    const token = localStorage.getItem("token");
    const [profileOpen, setProfileOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

    // Auth headers helper
    const authHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
    };

    // ==================
    // Session state
    // ==================
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [sessionMessages, setSessionMessages] = useState([]);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [sessionLoading, setSessionLoading] = useState(false);
    const [activeSession, setActiveSession] = useState(null);
    const loadingSessionRef = useRef(null);

    // ==================
    // Core state
    // ==================
    const [query, setQuery] = useState("");
    const [mode, setMode] = useState("deep");
    const [persona, setPersona] = useState("architect");

    const [response, setResponse] = useState("");
    const [usage, setUsage] = useState(null);
    const [reasoning, setReasoning] = useState(null);
    const [memoryCount, setMemoryCount] = useState(null);

    const [loading, setLoading] = useState(false);
    const [showSteps, setShowSteps] = useState(false);

    // Quick Take state
    const [quickTake, setQuickTake] = useState("");
    const [quickTakeLoading, setQuickTakeLoading] = useState(false);

    // Report viewer (modal) state
    const [reportOpen, setReportOpen] = useState(false);

    // Transform state (full report actions)
    const [transformResult, setTransformResult] = useState(null);
    const [originalReport, setOriginalReport] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [activeAction, setActiveAction] = useState("");

    // Selection transform state
    const [selectionResult, setSelectionResult] = useState(null);
    const [selectionSource, setSelectionSource] = useState("");

    // Notes panel
    const [notesOpen, setNotesOpen] = useState(false);

    // Clarification state
    const [clarificationNeeded, setClarificationNeeded] = useState(false);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState([]);
    const [clarificationDepth, setClarificationDepth] = useState(0);

    // ==================
    // Load sessions on mount
    // ==================
    useEffect(() => {
        if (token) {
            fetchSessions();
        }
    }, [token]);

    const fetchSessions = async () => {
        try {
            const res = await fetch(`${SESSION_API}/list`, { headers: authHeaders });
            const data = await res.json();
            if (Array.isArray(data)) {
                setSessions(data);
            }
        } catch (err) {
            console.error("Failed to load sessions:", err);
        }
    };

    // ==================
    // Session management
    // ==================
    const handleNewSession = () => {
        setActiveSessionId(null);
        setActiveSession(null);
        setSessionMessages([]);
        setQuery("");
        setResponse("");
        setUsage(null);
        setReasoning(null);
        setMemoryCount(null);
        setQuickTake("");
        setTransformResult(null);
        setSelectionResult(null);
        setClarificationNeeded(false);
    };

    const handleDeleteSession = async (sessionId) => {
        try {
            await fetch(`${SESSION_API}/${sessionId}`, {
                method: "DELETE",
                headers: authHeaders,
            });
            if (activeSessionId === sessionId) {
                handleNewSession();
            }
            await fetchSessions();
        } catch (err) {
            console.error("Failed to delete session:", err);
        }
    };

    const handleSelectSession = async (sessionId) => {
        // Prevent duplicate concurrent fetches
        if (loadingSessionRef.current === sessionId) return;
        loadingSessionRef.current = sessionId;

        setActiveSessionId(sessionId);
        setSessionLoading(true);
        setResponse("");
        setUsage(null);
        setReasoning(null);
        setMemoryCount(null);
        setQuickTake("");
        setTransformResult(null);
        setSelectionResult(null);
        setClarificationNeeded(false);

        try {
            const res = await fetch(`${SESSION_API}/${sessionId}`, { headers: authHeaders });
            const data = await res.json();
            setSessionMessages(data.messages || []);
            setActiveSession(data.session || null);

            // Show the last assistant message as the current response
            const lastAssistant = [...(data.messages || [])].reverse().find(m => m.role === "assistant" && m.type !== "followup");
            if (lastAssistant) {
                setResponse(lastAssistant.content);
                setOriginalReport(lastAssistant.content);
            }

            // Set query to last user message
            const lastUser = [...(data.messages || [])].reverse().find(m => m.role === "user" && m.type !== "followup");
            if (lastUser) {
                setQuery(lastUser.content);
            }
        } catch (err) {
            console.error("Failed to load session:", err);
        }

        setSessionLoading(false);
        loadingSessionRef.current = null;
    };

    const storeMessage = async (sessionId, role, content) => {
        try {
            await fetch(`${SESSION_API}/${sessionId}/message`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({ role, content }),
            });
        } catch (err) {
            console.error("Failed to store message:", err);
        }
    };

    const createSession = async (queryText) => {
        try {
            const res = await fetch(`${SESSION_API}/create`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({ query: queryText }),
            });
            const data = await res.json();
            setActiveSessionId(data.id);
            await fetchSessions();
            return data.id;
        } catch (err) {
            console.error("Failed to create session:", err);
            return null;
        }
    };

    // ==================
    // Research execution
    // ==================
    const runResearch = async (finalQuery = query) => {
        if (!finalQuery.trim()) return;

        setLoading(true);
        setResponse("");
        setUsage(null);
        setReasoning(null);
        setQuickTake("");
        setTransformResult(null);
        setSelectionResult(null);

        // Reset depth if it's a completely new query (not a clarification submit)
        if (finalQuery === query && clarificationDepth > 0) {
            setClarificationDepth(0);
        }

        // Create or use existing session
        let currentSessionId = activeSessionId;
        if (!currentSessionId) {
            currentSessionId = await createSession(finalQuery);
        }

        // Store user message
        if (currentSessionId) {
            await storeMessage(currentSessionId, "user", finalQuery);
            setSessionMessages(prev => [...prev, { role: "user", content: finalQuery, timestamp: new Date().toISOString() }]);
        }

        try {
            const res = await fetch(API_BASE, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: finalQuery,
                    mode,
                    persona,
                    clarificationDepth: finalQuery === query ? 0 : clarificationDepth,
                    sessionId: currentSessionId,
                }),
            });

            const data = await res.json();

            // Clarification mode
            if (data.clarificationNeeded) {
                setClarificationNeeded(true);
                setQuestions(data.questions || []);
                setAnswers(new Array(data.questions.length).fill(null));
                setClarificationDepth(prev => prev + 1);
                setLoading(false);
                return;
            }

            // Normal response
            setClarificationNeeded(false);
            const reportText = data.answer || data.error;
            setResponse(reportText);
            setOriginalReport(reportText);
            setUsage(data.usage || null);
            setReasoning(data.reasoning || null);
            setMemoryCount(data.memoryCount !== undefined ? data.memoryCount : null);

            // Store assistant message
            if (currentSessionId && reportText && !data.error) {
                await storeMessage(currentSessionId, "assistant", reportText);
                setSessionMessages(prev => [...prev, { role: "assistant", content: reportText, timestamp: new Date().toISOString() }]);
            }

            // Generate Quick Take & persist to session
            if (reportText && !data.error) {
                setQuickTakeLoading(true);
                try {
                    const qtRes = await fetch(`${API_BASE}/quick-take`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ reportText }),
                    });
                    const qtData = await qtRes.json();
                    const qt = qtData.quickTake || "";
                    setQuickTake(qt);

                    // Persist quickTake to session
                    if (currentSessionId && qt) {
                        try {
                            await fetch(`${SESSION_API}/${currentSessionId}/summary`, {
                                method: "PUT",
                                headers: authHeaders,
                                body: JSON.stringify({ quickTake: qt }),
                            });
                        } catch (e) {
                            console.error("Failed to persist quickTake:", e);
                        }
                    }
                } catch {
                    console.error("Quick Take generation failed");
                }
                setQuickTakeLoading(false);
            }
        } catch {
            setResponse("Error connecting to backend.");
        }

        setLoading(false);
    };

    // ==================
    // Clarification submit
    // ==================
    const submitClarifications = () => {
        const clarificationText = questions
            .map((q, i) => `${q.question}\nSelected Option: ${answers[i]}`)
            .join("\n\n");

        const updatedQuery = query + "\n\nAdditional Clarifications:\n" + clarificationText;
        setClarificationNeeded(false);
        runResearch(updatedQuery);
    };

    // ==================
    // Report transform (full report actions)
    // ==================
    const handleReportAction = useCallback(
        async (action) => {
            if (!response) return;
            setActionLoading(true);
            setActiveAction(action);

            try {
                const res = await fetch(`${API_BASE}/transform`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: response, action }),
                });
                const data = await res.json();
                setTransformResult(data.result || null);
            } catch {
                console.error("Transform failed");
            }

            setActionLoading(false);
        },
        [response]
    );

    const acceptTransform = () => {
        if (transformResult) {
            setResponse(transformResult);
            setOriginalReport(transformResult);
            setTransformResult(null);
            setActiveAction("");
        }
    };

    const rejectTransform = () => {
        setTransformResult(null);
        setActiveAction("");
    };

    // ==================
    // Selection transform (inline text editing)
    // ==================
    const handleSelectionTransform = useCallback(
        async (selectedText, action, instruction) => {
            setSelectionSource(selectedText);
            setActionLoading(true);

            try {
                const res = await fetch(`${API_BASE}/transform`, {
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
            const updated = response.replace(selectionSource, selectionResult);
            setResponse(updated);
            setOriginalReport(updated);
            setSelectionResult(null);
            setSelectionSource("");
        }
    };

    const rejectSelection = () => {
        setSelectionResult(null);
        setSelectionSource("");
    };

    // ==================
    // Export (PDF via browser print)
    // ==================
    const handleExport = (type) => {
        const content = type === "quicktake" ? quickTake : response;
        if (!content) return;

        const printWindow = window.open("", "_blank");
        printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Research Report</title>
        <style>
          body {
            font-family: 'Georgia', 'Times New Roman', serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 0 20px;
            color: #1a1a1a;
            line-height: 1.8;
            font-size: 14px;
          }
          h1 { font-size: 24px; border-bottom: 2px solid #333; padding-bottom: 8px; }
          h2 { font-size: 20px; margin-top: 24px; color: #2563eb; }
          h3 { font-size: 16px; margin-top: 18px; }
          code { background: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
          pre { background: #f3f4f6; padding: 16px; border-radius: 6px; overflow-x: auto; }
          blockquote { border-left: 3px solid #2563eb; padding-left: 12px; color: #555; }
          ul, ol { padding-left: 24px; }
          li { margin: 4px 0; }
          table { border-collapse: collapse; width: 100%; margin: 12px 0; }
          th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
          th { background: #f3f4f6; }
          .header { text-align: center; margin-bottom: 30px; }
          .header p { color: #666; font-size: 12px; }
          @media print {
            body { margin: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${type === "quicktake" ? "Quick Take Summary" : "Research Report"}</h1>
          <p>Generated by Research Agent · ${new Date().toLocaleDateString()}</p>
        </div>
        <div id="content"></div>
        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>
        <script>
          document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(content)});
          setTimeout(() => { window.print(); }, 500);
        <\/script>
      </body>
      </html>
    `);
        printWindow.document.close();
    };

    // ==================
    // Render
    // ==================
    return (
        <div className="app">
            {/* ---- Session Sidebar ---- */}
            <SessionSidebar
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelectSession={handleSelectSession}
                onNewSession={handleNewSession}
                onDeleteSession={handleDeleteSession}
                collapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            <div className="main-container">
                {/* ===== STORED SESSION VIEW ===== */}
                {activeSessionId && activeSession ? (
                    <>
                        {/* Brand + Profile row (always visible) */}
                        <div className="input-card session-brand-card">
                            <div className="brand-row">
                                <div className="brand">
                                    <div className="brand-icon"><FiCpu /></div>
                                    <div>
                                        <h1>Mentis</h1>
                                        <p className="subtitle">Agentic Deep Research Workspace</p>
                                    </div>
                                </div>

                                <div className="user-profile">
                                    <button
                                        className="profile-btn"
                                        onClick={() => setProfileOpen(!profileOpen)}
                                        id="profile-toggle-btn"
                                    >
                                        <FiUser />
                                        <span>{storedUser?.name || "User"}</span>
                                    </button>

                                    {profileOpen && (
                                        <div className="profile-dropdown">
                                            <div className="profile-info">
                                                <div className="profile-avatar">
                                                    {(storedUser?.name || "U").charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="profile-name">{storedUser?.name || "User"}</p>
                                                    <p className="profile-email">{storedUser?.email || ""}</p>
                                                </div>
                                            </div>
                                            <button className="logout-btn" onClick={handleLogout}>
                                                <FiLogOut /> Sign Out
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {sessionLoading ? (
                            <div className="session-loading">
                                <div className="spinner" />
                                <span>Loading session...</span>
                            </div>
                        ) : (
                            <StoredSessionView
                                session={activeSession}
                                messages={sessionMessages}
                                token={token}
                                onReportAction={handleReportAction}
                                actionLoading={actionLoading}
                                activeAction={activeAction}
                                transformResult={transformResult}
                                onAcceptTransform={acceptTransform}
                                onRejectTransform={rejectTransform}
                                onSelectionTransform={handleSelectionTransform}
                                selectionResult={selectionResult}
                                selectionSource={selectionSource}
                                onAcceptSelection={acceptSelection}
                                onRejectSelection={rejectSelection}
                                onExport={handleExport}
                            />
                        )}
                    </>
                ) : (
                    <>
                        {/* ===== NEW RESEARCH WORKSPACE ===== */}
                        <div className="input-card">
                            <div className="brand-row">
                                <div className="brand">
                                    <div className="brand-icon"><FiCpu /></div>
                                    <div>
                                        <h1>Mentis</h1>
                                        <p className="subtitle">Agentic Deep Research Workspace</p>
                                    </div>
                                </div>

                                <div className="user-profile">
                                    <button
                                        className="profile-btn"
                                        onClick={() => setProfileOpen(!profileOpen)}
                                        id="profile-toggle-btn"
                                    >
                                        <FiUser />
                                        <span>{storedUser?.name || "User"}</span>
                                    </button>

                                    {profileOpen && (
                                        <div className="profile-dropdown">
                                            <div className="profile-info">
                                                <div className="profile-avatar">
                                                    {(storedUser?.name || "U").charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="profile-name">{storedUser?.name || "User"}</p>
                                                    <p className="profile-email">{storedUser?.email || ""}</p>
                                                </div>
                                            </div>
                                            <button className="logout-btn" onClick={handleLogout}>
                                                <FiLogOut /> Sign Out
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <textarea
                                placeholder="Enter your research query..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        runResearch();
                                    }
                                }}
                                id="research-query-input"
                            />

                            <div className="controls">
                                <div className="dropdown-group">
                                    <select
                                        value={mode}
                                        onChange={(e) => setMode(e.target.value)}
                                        className="dropdown"
                                        id="mode-select"
                                    >
                                        <option value="quick">⚡ Quick Analysis</option>
                                        <option value="deep">🔬 Deep Research</option>
                                    </select>

                                    <select
                                        value={persona}
                                        onChange={(e) => setPersona(e.target.value)}
                                        className="dropdown"
                                        id="persona-select"
                                    >
                                        <option value="architect">🏗️ Systems Architect</option>
                                        <option value="analyst">📊 Research Analyst</option>
                                        <option value="strategist">🎯 Strategy Lead</option>
                                        <option value="general">👤 General User</option>
                                    </select>
                                </div>

                                <button
                                    className="run-btn"
                                    onClick={() => runResearch()}
                                    disabled={loading || !query.trim()}
                                    id="run-research-btn"
                                >
                                    {loading ? (
                                        <span className="btn-loading">
                                            <span className="spinner" />
                                            Researching...
                                        </span>
                                    ) : (
                                        "Run Research"
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* ---- Memory Context Indicator ---- */}
                        {memoryCount !== null && !loading && (
                            <div className="memory-indicator" style={{ textAlign: "center", fontSize: "0.85rem", color: "#666", marginBottom: "20px" }}>
                                <strong>Memory Context</strong><br />
                                {memoryCount} similar {memoryCount === 1 ? 'memory' : 'memories'} retrieved
                            </div>
                        )}

                        {/* ---- Pipeline Progress ---- */}
                        <PipelineProgress active={loading} />

                        {/* ---- Quick Take Loading ---- */}
                        {quickTakeLoading && !loading && (
                            <div className="quicktake-loading">
                                <div className="spinner" />
                                <span>Generating Quick Take...</span>
                            </div>
                        )}

                        {/* ---- Clarification Questions ---- */}
                        {clarificationNeeded && (
                            <div className="clarification-box">
                                <h3><FiMessageSquare className="inline-icon" /> Agent needs clarification</h3>
                                {questions.map((q, i) => (
                                    <div key={i} className="question-block">
                                        <p>{q.question}</p>
                                        {q.options.map((option, j) => (
                                            <label key={j} className="option-label">
                                                <input
                                                    type="radio"
                                                    name={`question-${i}`}
                                                    value={option}
                                                    checked={answers[i] === option}
                                                    onChange={() => {
                                                        const updated = [...answers];
                                                        updated[i] = option;
                                                        setAnswers(updated);
                                                    }}
                                                />
                                                {option}
                                            </label>
                                        ))}
                                    </div>
                                ))}
                                <button className="run-btn" onClick={submitClarifications}>
                                    Submit Answers
                                </button>
                            </div>
                        )}



                        {/* ---- Token Usage Indicator ---- */}
                        {usage && !loading && (
                            <div className="token-usage" style={{ textAlign: "center", fontSize: "0.85rem", color: "#888", marginBottom: "10px" }}>
                                Tokens: {usage.totalTokenCount}
                            </div>
                        )}

                        {/* ---- Quick Take ---- */}
                        <QuickTake
                            quickTake={quickTake}
                            onViewFullReport={() => setReportOpen(true)}
                            onExport={handleExport}
                        />

                        {/* ---- Full Report Modal ---- */}
                        <ReportViewer
                            isOpen={reportOpen}
                            onClose={() => setReportOpen(false)}
                            reportText={response}
                            onAction={handleReportAction}
                            actionLoading={actionLoading}
                            activeAction={activeAction}
                            transformResult={transformResult}
                            onAcceptTransform={acceptTransform}
                            onRejectTransform={rejectTransform}
                            onSelectionTransform={handleSelectionTransform}
                            selectionResult={selectionResult}
                            selectionSource={selectionSource}
                            onAcceptSelection={acceptSelection}
                            onRejectSelection={rejectSelection}
                            onExport={handleExport}
                        />
                    </>
                )}
            </div>

            {/* ---- Notes Panel ---- */}
            <NotesPanel
                isOpen={notesOpen}
                onToggle={() => setNotesOpen(!notesOpen)}
                query={query}
            />
        </div>
    );
}

export default ResearchWorkspace;
