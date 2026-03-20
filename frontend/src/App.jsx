import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./App.css";
import "katex/dist/katex.min.css";

import PipelineProgress from "./components/PipelineProgress";
import QuickTake from "./components/QuickTake";
import ReportViewer from "./components/ReportViewer";
import NotesPanel from "./components/NotesPanel";
import SessionSidebar from "./components/SessionSidebar";
import StoredSessionView from "./components/StoredSessionView";
import { FiCpu, FiMessageSquare, FiLogOut, FiUser, FiDatabase, FiZap } from "react-icons/fi";

const API_BASE = "http://localhost:5000/research";
const SESSION_API = "http://localhost:5000/api/session";

function ResearchWorkspace() {
    const navigate = useNavigate();
    const { sessionId: routeSessionId } = useParams();

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
    const [pipelineSteps, setPipelineSteps] = useState([]);
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

    useEffect(() => {
        if (token && routeSessionId && routeSessionId !== activeSessionId) {
            handleSelectSession(routeSessionId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, routeSessionId]);

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
        setPipelineSteps([]);
        navigate("/workspace");
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

        if (routeSessionId !== sessionId) {
            navigate(`/workspace/${sessionId}`);
        }

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
        setPipelineSteps([]);

        try {
            const res = await fetch(`${SESSION_API}/${sessionId}`, { headers: authHeaders });
            const data = await res.json();
            setSessionMessages(data.messages || []);
            setActiveSession(data.session || null);

            // Restore Clarification State if active
            if (data.session && data.session.clarificationNeeded) {
                setClarificationNeeded(true);
                setQuestions(data.session.clarificationQuestions || []);
                setAnswers(new Array((data.session.clarificationQuestions || []).length).fill(null));
                setClarificationDepth(data.session.clarificationDepth || 1);
            }

            // Restore Report State if available, otherwise fallback to last assistant message
            if (data.session && data.session.report) {
                setResponse(data.session.report);
                setOriginalReport(data.session.report);
            } else {
                // Show the last assistant message as the current response
                const lastAssistant = [...(data.messages || [])].reverse().find(m => m.role === "assistant" && m.type !== "followup");
                if (lastAssistant) {
                    setResponse(lastAssistant.content);
                    setOriginalReport(lastAssistant.content);
                }
            }

            // Restore Quick Take
            if (data.session && data.session.quickTake) {
                setQuickTake(data.session.quickTake);
            }

            // Restore Pipeline Stage (if pipeline was running when page refreshed)
            if (data.session && data.session.pipelineStage && data.session.pipelineStage !== "") {
                const STAGE_ORDER = [
                    "Retrieving Relevant Memory",
                    "Planning Research Strategy",
                    "Analyzing Plan",
                    "Gathering External Knowledge",
                    "Generating Research Report",
                    "Saving Knowledge to Memory",
                ];
                const stageIdx = STAGE_ORDER.indexOf(data.session.pipelineStage);
                if (stageIdx !== -1) {
                    // Build up completed steps + current active step
                    const restoredSteps = [];
                    for (let i = 0; i <= stageIdx; i++) {
                        restoredSteps.push({ stage: STAGE_ORDER[i], status: "running" });
                    }
                    setPipelineSteps(restoredSteps);
                    setLoading(true);
                } else if (data.session.pipelineStage === "waiting_for_clarification") {
                    // Pipeline paused for clarification — show pipeline at "Analyzing Plan" stage
                    setPipelineSteps([
                        { stage: "Retrieving Relevant Memory", status: "running" },
                        { stage: "Planning Research Strategy", status: "running" },
                        { stage: "Analyzing Plan", status: "running" },
                    ]);
                }
            }

            // Restore Pending Transform State
            if (data.session && data.session.pendingTransform) {
                const pt = data.session.pendingTransform;
                if (pt.type === "full") {
                    setTransformResult(pt.result);
                    setActiveAction(pt.action || "custom");
                } else if (pt.type === "selection") {
                    setSelectionResult(pt.result);
                    setSelectionSource(pt.source);
                }
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
            navigate(`/workspace/${data.id}`);
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
            setPipelineSteps([]);
        } else if (finalQuery === query) {
            setPipelineSteps([]);
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

            const reader = res.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let done = false;
            let buffer = "";
            let data = {};

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop(); // keep last incomplete line

                    for (const line of lines) {
                        if (line.trim()) {
                            try {
                                const parsed = JSON.parse(line);
                                if (parsed.type === "progress") {
                                    setPipelineSteps(prev => [...prev, { stage: parsed.stage, status: parsed.status }]);
                                } else if (parsed.type === "clarification") {
                                    data = parsed.data;
                                    data.clarificationNeeded = true;
                                } else if (parsed.type === "result") {
                                    data = parsed.data;
                                } else if (parsed.type === "error") {
                                    data = { error: parsed.error };
                                } else {
                                    // fallback for older json responses if applicable
                                    data = parsed;
                                }
                            } catch (e) {
                                console.error("Error parsing NDJSON line:", e);
                            }
                        }
                    }
                }
            }

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
    const savePendingTransform = async (pendingState) => {
        if (!activeSessionId) return;
        try {
            await fetch(`${SESSION_API}/${activeSessionId}/pending-transform`, {
                method: "PUT",
                headers: authHeaders,
                body: JSON.stringify({ pendingTransform: pendingState }),
            });
        } catch (e) {
            console.error("Failed to persist pending transform:", e);
        }
    };

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
                const resText = data.result || null;
                setTransformResult(resText);
                if (resText) {
                    savePendingTransform({ type: "full", action, result: resText });
                }
            } catch {
                console.error("Transform failed");
            }

            setActionLoading(false);
        },
        [response, activeSessionId]
    );

    const acceptTransform = async () => {
        if (transformResult) {
            const newReport = transformResult;
            setResponse(newReport);
            setOriginalReport(newReport);
            setTransformResult(null);
            setActiveAction("");
            savePendingTransform(null);

            // Persist report edits
            if (activeSessionId) {
                try {
                    await fetch(`${SESSION_API}/${activeSessionId}/report`, {
                        method: "PUT",
                        headers: authHeaders,
                        body: JSON.stringify({ report: newReport }),
                    });
                } catch (e) {
                    console.error("Failed to persist report:", e);
                }
            }
        }
    };

    const rejectTransform = () => {
        setTransformResult(null);
        setActiveAction("");
        savePendingTransform(null);
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
                const resText = data.result || null;
                setSelectionResult(resText);
                if (resText) {
                    savePendingTransform({ type: "selection", action, source: selectedText, result: resText });
                }
            } catch {
                console.error("Selection transform failed");
            }

            setActionLoading(false);
        },
        [activeSessionId]
    );

    // ==================
    // Text Replacement Helper
    // ==================
    const smartReplace = (fullText, sourceText, replacementText) => {
        if (!fullText || !sourceText) return fullText;
        if (fullText.includes(sourceText)) return fullText.replace(sourceText, replacementText);
        try {
            const escaped = sourceText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const flexiblePattern = escaped.replace(/\s+/g, '[\\s\\*_`#]*');
            const regex = new RegExp(flexiblePattern, 'i');
            return fullText.replace(regex, replacementText);
        } catch (e) {
            console.error("Smart replace failed:", e);
            return fullText;
        }
    };

    const acceptSelection = async () => {
        if (selectionResult && selectionSource) {
            const updated = smartReplace(response, selectionSource, selectionResult);
            console.log("Applying text edit:", { source: selectionSource, result: selectionResult, updatedLength: updated.length });
            setResponse(updated);
            setOriginalReport(updated);
            setSelectionResult(null);
            setSelectionSource("");
            savePendingTransform(null);

            // Persist report edits
            if (activeSessionId) {
                try {
                    await fetch(`${SESSION_API}/${activeSessionId}/report`, {
                        method: "PUT",
                        headers: authHeaders,
                        body: JSON.stringify({ report: updated }),
                    });
                } catch (e) {
                    console.error("Failed to persist report:", e);
                }
            }
        }
    };

    const rejectSelection = () => {
        setSelectionResult(null);
        setSelectionSource("");
        savePendingTransform(null);
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
                                reportText={response}
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
                                clarificationNeeded={clarificationNeeded}
                                questions={questions}
                                answers={answers}
                                onAnswerChange={(i, val) => {
                                    const updated = [...answers];
                                    updated[i] = val;
                                    setAnswers(updated);
                                }}
                                onSubmitClarification={submitClarifications}
                                pipelineActive={loading}
                                pipelineSteps={pipelineSteps}
                                pipelinePaused={clarificationNeeded}
                                quickTake={quickTake}
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
                                        <option value="quick">Quick Analysis</option>
                                        <option value="deep">Deep Research</option>
                                    </select>

                                    <select
                                        value={persona}
                                        onChange={(e) => setPersona(e.target.value)}
                                        className="dropdown"
                                        id="persona-select"
                                    >
                                        <option value="architect">Systems Architect</option>
                                        <option value="analyst">Research Analyst</option>
                                        <option value="strategist">Strategy Lead</option>
                                        <option value="general">General User</option>
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

                        {/* ---- Meta Info (Tokens & Memory) ---- */}
                        {!loading && (memoryCount !== null || usage) && (
                            <div className="meta-info-bar" style={{
                                display: "flex",
                                justifyContent: "center",
                                gap: "16px",
                                fontSize: "0.75rem",
                                color: "#9ca3af",
                                marginTop: "4px",
                                marginBottom: "16px",
                                padding: "4px 12px",
                                background: "rgba(0,0,0,0.02)",
                                borderRadius: "12px",
                                width: "fit-content",
                                margin: "4px auto 16px auto"
                            }}>
                                {memoryCount !== null && (
                                    <span title="Retrieved contextual memories" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <FiDatabase /> {memoryCount} {memoryCount === 1 ? 'memory' : 'memories'}
                                    </span>
                                )}
                                {usage && (
                                    <span title="Total tokens used" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <FiZap /> {usage.totalTokenCount} tokens
                                    </span>
                                )}
                            </div>
                        )}

                        {/* ---- Pipeline Progress ---- */}
                        <PipelineProgress active={loading} steps={pipelineSteps} paused={clarificationNeeded} />

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
