import { useState } from "react";
import "./App.css";

import ReactMarkdown from "react-markdown";
import "katex/dist/katex.min.css";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

function App() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("deep");
  const [response, setResponse] = useState("");
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [persona, setPersona] = useState("architect");

  const [reasoning, setReasoning] = useState(null);
  const [showSteps, setShowSteps] = useState(false);

  const runResearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setResponse("");
    setUsage(null);
    setReasoning(null);

    try {
      const res = await fetch("http://localhost:5000/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          mode,
          persona,
        }),
      });

      const data = await res.json();
      setResponse(data.answer || data.error);
      setUsage(data.usage || null);
      setReasoning(data.reasoning || null);
    } catch (err) {
      setResponse("Error connecting to backend.");
    }

    setLoading(false);
  };

  return (
    <div className="app">
      <div className="card">
        <h1>Research Agent</h1>
        <p className="subtitle">
          Memory-Augmented Deep Research Engine
        </p>

        <textarea
          placeholder="Enter your research query..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="controls">
          <div className="dropdown-group">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="dropdown"
            >
              <option value="quick">Quick Analysis</option>
              <option value="deep">Deep Research</option>
            </select>

            <select
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              className="dropdown"
            >
              <option value="architect">Systems Architect</option>
              <option value="analyst">Research Analyst</option>
              <option value="strategist">Strategy Lead</option>
            </select>
          </div>

          <button className="run-btn" onClick={runResearch}>
            {loading ? "Analyzing..." : "Run Research"}
          </button>
        </div>

        {usage && (
          <div className="usage">
            <span>Total Tokens: {usage.totalTokenCount}</span>
          </div>
        )}

        {/* -------------------------
            REASONING STEPS (Deep Mode Only)
        -------------------------- */}
        {mode === "deep" && reasoning && (
          <div className="steps-container">
            <div
              className="steps-header"
              onClick={() => setShowSteps(!showSteps)}
            >
              🔎 Research Pipeline {showSteps ? "▲" : "▼"}
            </div>

            {showSteps && (
              <div className="steps-content">
                <div className="step-block">
                  <strong>Step 1: Problem Decomposition</strong>
                  <pre>{reasoning.analysis}</pre>
                </div>

                <div className="step-block">
                  <strong>Step 2: External Source Aggregation</strong>
                  <p>
                    Web Results: {reasoning.toolSummary?.webCount || 0}
                    <br />
                    arXiv Papers: {reasoning.toolSummary?.arxivCount || 0}
                    <br />
                    GitHub Repos: {reasoning.toolSummary?.githubCount || 0}
                  </p>
                </div>

                <div className="step-block">
                  <strong>Step 3: Structured Synthesis</strong>
                  <p>
                    Final structured report generated using memory +
                    live sources + analytical breakdown.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {response && (
          <div className="output">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {response}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;