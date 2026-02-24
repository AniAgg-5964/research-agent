import { useState } from "react";
import "./App.css";

function App() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("deep");
  const [response, setResponse] = useState("");
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);

  const runResearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setResponse("");
    setUsage(null);

    try {
      const res = await fetch("http://localhost:5000/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, mode }),
      });

      const data = await res.json();
      setResponse(data.answer || data.error);
      setUsage(data.usage || null);
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
          <div className="mode-toggle">
            <button
              className={mode === "quick" ? "active" : ""}
              onClick={() => setMode("quick")}
            >
              Quick
            </button>
            <button
              className={mode === "deep" ? "active" : ""}
              onClick={() => setMode("deep")}
            >
              Deep
            </button>
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

        {response && (
          <div className="output">
            <pre>{response}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;