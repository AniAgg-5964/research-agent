import { useState } from "react";
import "./App.css";

import ReactMarkdown from "react-markdown";
import "katex/dist/katex.min.css";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

function App() {

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("deep");
  const [persona, setPersona] = useState("architect");

  const [response, setResponse] = useState("");
  const [usage, setUsage] = useState(null);
  const [reasoning, setReasoning] = useState(null);

  const [loading, setLoading] = useState(false);

  const [showSteps, setShowSteps] = useState(false);

  // clarification state
  const [clarificationNeeded, setClarificationNeeded] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);

  const runResearch = async (finalQuery = query) => {

    if (!finalQuery.trim()) return;

    setLoading(true);
    setResponse("");
    setUsage(null);
    setReasoning(null);

    try {

      const res = await fetch("http://localhost:5000/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: finalQuery,
          mode,
          persona
        })
      });

      const data = await res.json();

      // ---------------------------
      // CLARIFICATION MODE
      // ---------------------------
      if (data.clarificationNeeded) {

        setClarificationNeeded(true);
        setQuestions(data.questions || []);
        setAnswers(new Array(data.questions.length).fill(""));

        setLoading(false);
        return;
      }

      // ---------------------------
      // NORMAL RESPONSE
      // ---------------------------

      setClarificationNeeded(false);

      setResponse(data.answer || data.error);
      setUsage(data.usage || null);
      setReasoning(data.reasoning || null);

    } catch (err) {
      setResponse("Error connecting to backend.");
    }

    setLoading(false);
  };

  // submit clarification answers
  const submitClarifications = () => {

    const clarificationText = questions
      .map((q, i) => `${q}\nAnswer: ${answers[i]}`)
      .join("\n\n");

    const updatedQuery =
      query +
      "\n\nAdditional Clarifications:\n" +
      clarificationText;

    setClarificationNeeded(false);

    runResearch(updatedQuery);
  };

  return (
    <div className="app">

      <div className="card">

        <h1>Research Agent</h1>

        <p className="subtitle">
          Memory-Augmented Deep Research Engine
        </p>

        {/* -------------------------
            USER QUERY INPUT
        -------------------------- */}

        <textarea
          placeholder="Enter your research query..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {/* -------------------------
            CONTROLS
        -------------------------- */}

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

          <button className="run-btn" onClick={() => runResearch()}>
            {loading ? "Analyzing..." : "Run Research"}
          </button>

        </div>

        {/* -------------------------
            CLARIFICATION QUESTIONS
        -------------------------- */}

        {clarificationNeeded && (

          <div className="clarification-box">

            <h3>Agent needs clarification</h3>

            {questions.map((q, i) => (
              <div key={i} className="question-block">

                <p>{q}</p>

                <textarea
                  value={answers[i]}
                  onChange={(e) => {
                    const updated = [...answers];
                    updated[i] = e.target.value;
                    setAnswers(updated);
                  }}
                  placeholder="Your answer..."
                />

              </div>
            ))}

            <button className="run-btn" onClick={submitClarifications}>
              Submit Clarifications
            </button>

          </div>
        )}

        {/* -------------------------
            TOKEN USAGE
        -------------------------- */}

        {usage && (
          <div className="usage">
            <span>Total Tokens: {usage.totalTokenCount}</span>
          </div>
        )}

        {/* -------------------------
            REASONING PIPELINE
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

        {/* -------------------------
            FINAL OUTPUT
        -------------------------- */}

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