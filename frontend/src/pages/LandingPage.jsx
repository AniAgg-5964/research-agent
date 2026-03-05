import { useNavigate } from "react-router-dom";
import "./LandingPage.css";

export default function LandingPage() {
    const navigate = useNavigate();

    const handleLaunch = () => {
        const token = localStorage.getItem("token");
        if (token) {
            navigate("/workspace");
        } else {
            navigate("/signup");
        }
    };

    return (
        <div className="landing-page">
            <div className="container">

                {/* NAVBAR */}
                <nav className="navbar">
                    <h2 className="logo">Cerebro</h2>

                    <ul className="nav-links">
                        <li>How it Works</li>
                        <li>Features</li>
                        <li>Use Cases</li>
                        <li>Comparison</li>
                    </ul>

                    <div className="nav-buttons">
                        <button className="login-btn" onClick={() => navigate("/login")}>Sign In</button>
                        <button className="launch-btn" onClick={handleLaunch}>Launch Workspace</button>
                    </div>
                </nav>

                {/* HERO SECTION */}
                <section className="hero">
                    <h1>
                        AI That Thinks, Researches,<br />
                        and Remembers
                    </h1>

                    <p>
                        Move beyond simple chatbots. Cerebro is an intelligent workspace that
                        retrieves past knowledge, orchestrates tools, analyzes context,
                        and generates structured research reports.
                    </p>

                    <div className="hero-buttons">
                        <button className="start-btn" onClick={handleLaunch}>Start Research</button>
                        <button className="outline-btn">See How It Works</button>
                    </div>
                </section>

                {/* ENGINE SECTION */}
                <section className="engine">
                    <h2>The Engine Inside</h2>
                    <p className="section-sub">
                        A transparent, multi-step reasoning process designed for deep intellectual work.
                    </p>

                    <div className="engine-container">
                        <div className="engine-step">
                            <div className="engine-icon">🔍</div>
                            <p>User Query</p>
                        </div>
                        <div className="engine-line"></div>
                        <div className="engine-step">
                            <div className="engine-icon purple">🗂</div>
                            <p>Memory Retrieval</p>
                        </div>
                        <div className="engine-line"></div>
                        <div className="engine-step">
                            <div className="engine-icon green">🔧</div>
                            <p>Tool Execution</p>
                        </div>
                        <div className="engine-line"></div>
                        <div className="engine-step">
                            <div className="engine-icon yellow">📊</div>
                            <p>AI Analysis</p>
                        </div>
                        <div className="engine-line"></div>
                        <div className="engine-step">
                            <div className="engine-icon gray">📄</div>
                            <p>Research Report</p>
                        </div>
                    </div>
                </section>

                {/* WHO IS CEREBRO FOR */}
                <section className="who">
                    <h2>Who is Cerebro For?</h2>
                    <p className="section-sub">
                        Designed for professionals who need depth, accuracy, and structured knowledge.
                    </p>

                    <div className="card-grid">
                        <div className="card">
                            <h3>Researchers</h3>
                            <p>Explore scientific literature and generate comprehensive reviews.</p>
                        </div>
                        <div className="card">
                            <h3>Developers</h3>
                            <p>Investigate technical architectures and summarize API documentation.</p>
                        </div>
                        <div className="card">
                            <h3>Students</h3>
                            <p>Break down complex subjects using reliable external sources.</p>
                        </div>
                        <div className="card">
                            <h3>Knowledge Teams</h3>
                            <p>Build persistent shared knowledge bases across organizations.</p>
                        </div>
                    </div>
                </section>

                {/* FEATURES */}
                <section className="features">
                    <h2>Built for Serious Research</h2>
                    <p className="section-sub">
                        Cerebro combines the flexibility of LLMs with the reliability of external tools and persistent storage.
                    </p>

                    <div className="feature-grid">
                        <div className="feature-card">
                            <div className="icon">📚</div>
                            <h3>Memory-Augmented Research</h3>
                            <p>The AI remembers past research sessions and automatically retrieves relevant knowledge context for new queries.</p>
                        </div>
                        <div className="feature-card">
                            <div className="icon">🔧</div>
                            <h3>Tool-Orchestrated Intelligence</h3>
                            <p>Seamlessly integrates with external APIs like Arxiv, GitHub, and live web search to gather up-to-date factual data.</p>
                        </div>
                        <div className="feature-card">
                            <div className="icon">📄</div>
                            <h3>Structured Research Reports</h3>
                            <p>Outputs are generated as beautifully organized markdown-native research documents rather than ephemeral chat messages.</p>
                        </div>
                        <div className="feature-card">
                            <div className="icon">📈</div>
                            <h3>Transparent AI Reasoning</h3>
                            <p>Observe the agent's internal monologue. See exactly how it retrieved memory, selected tools, and reached its conclusions.</p>
                        </div>
                        <div className="feature-card">
                            <div className="icon">📦</div>
                            <h3>Persistent Knowledge System</h3>
                            <p>Every research summary is automatically stored as vectorized memory, continuously improving the system's future results.</p>
                        </div>
                        <div className="feature-card">
                            <div className="icon">🛡</div>
                            <h3>Credible & Cited</h3>
                            <p>Every factual claim is backed by a generated citation linking directly to the source tool or retrieved memory document.</p>
                        </div>
                    </div>
                </section>

                {/* COMPARISON */}
                <section className="comparison">
                    <h2>Beyond the Chatbot</h2>

                    <div className="comparison-grid">
                        <div className="compare-box red">
                            <h3>Standard AI Chat</h3>
                            <ul>
                                <li>Answers immediate questions</li>
                                <li>Forgets context</li>
                                <li>Limited training data</li>
                                <li>Opaque reasoning</li>
                                <li>Temporary responses</li>
                            </ul>
                        </div>

                        <div className="compare-box blue">
                            <h3>Cerebro Platform</h3>
                            <ul>
                                <li>Multi-step research</li>
                                <li>Long-term memory</li>
                                <li>External APIs & tools</li>
                                <li>Transparent reasoning</li>
                                <li>Structured reports</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="cta">
                    <h2>Start Your First AI Research Session</h2>
                    <p>Join professionals using Cerebro to accelerate research and knowledge discovery.</p>
                    <button className="launch-btn big" onClick={handleLaunch}>Launch the Research Workspace</button>
                </section>

                {/* FOOTER */}
                <footer className="footer">
                    <div className="footer-grid">
                        <div>
                            <h3>Cerebro</h3>
                            <p>AI workspace for deep research and knowledge orchestration.</p>
                        </div>
                        <div>
                            <h4>Product</h4>
                            <p>Features</p>
                            <p>Pricing</p>
                        </div>
                        <div>
                            <h4>Resources</h4>
                            <p>Documentation</p>
                            <p>API</p>
                            <p>Blog</p>
                        </div>
                        <div>
                            <h4>Company</h4>
                            <p>About</p>
                            <p>Contact</p>
                            <p>Privacy</p>
                        </div>
                    </div>
                </footer>

            </div>
        </div>
    );
}
