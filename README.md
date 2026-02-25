# 🧠 Research Agent  
### Memory-Augmented Multi-Persona Deep Research Engine

> A production-style AI research system combining semantic memory, multi-tool augmentation, and persona-controlled synthesis.

---

## 🚀 Overview

Research Agent is a full-stack AI system designed for technical and engineering audiences.  

It combines:

- 🧠 Long-term vector memory (Qdrant)
- 🔍 Live web + arXiv + GitHub search
- 🎭 Multi-persona reasoning modes
- 📊 Structured deep research pipeline
- ⚡ Quick vs Deep execution modes

Unlike simple chat systems, this agent:

- Decomposes complex research questions
- Aggregates live technical sources
- Recalls relevant past research
- Synthesizes production-grade reports

---

## 🏗 Architecture


Frontend (React)
↓
Backend (Express.js)
↓
Deep Research Pipeline
↓
[1] Memory Retrieval (Qdrant)
[2] Problem Decomposition (LLM)
[3] External Source Aggregation
- Web Search
- arXiv Papers
- GitHub Repositories
[4] Structured Synthesis
[5] Memory Storage (Vector + Payload)


---

## 🎯 Core Features

### 🧠 Semantic Memory (Qdrant)
- Stores deep research summaries as embeddings
- Injects relevant past reports based on cosine similarity
- Uses similarity threshold filtering
- Enables long-term contextual continuity

---

### 🔎 Multi-Tool Deep Research
Deep mode aggregates:

- 🌍 Web technical sources
- 📚 arXiv academic papers
- 💻 GitHub implementation repositories

All sources are compressed and synthesized into a structured report.

---

### 🎭 Multi-Persona System

The same research question can be answered from different professional lenses:

| Persona | Perspective |
|----------|-------------|
| 🏗 Systems Architect | Infrastructure & scaling focused |
| 📚 Research Analyst | Theoretical & comparative analysis |
| 🎯 Strategy Lead | Business, cost & competitive framing |

---

### ⚡ Quick vs Deep Mode

**Quick Mode**
- Concise structured answer
- No tool execution
- No memory injection

**Deep Mode**
- Multi-stage reasoning
- Tool execution
- Memory recall
- Production-grade structured report
- Visible research pipeline

---

## 📊 Deep Mode Output Structure

1. Executive Summary  
2. Key Approaches  
3. Trade-offs  
4. Implementation Considerations  
5. Benchmarks / Numbers  
6. Failure Modes  
7. Practical Recommendations  
8. Confidence Score  

---

## 🧠 Memory Model

Each deep research query stores:

- ✅ Summary embedding (vector)
- ✅ Full report (payload)
- ✅ Original query (metadata)

On new deep queries:

- Query → Embedding
- Qdrant → Similarity search
- Threshold filter applied
- Relevant full reports injected into LLM context

---

## 🛠 Tech Stack

**Frontend**
- React
- Markdown rendering
- KaTeX math support

**Backend**
- Node.js
- Express.js
- Google Gemini API
- Multi-step reasoning pipeline

**Memory**
- Qdrant (Vector Database)
- Cosine similarity search

**Tools**
- DuckDuckGo Search
- arXiv Search
- GitHub Repository Search

---

## 🧪 Example Deep Query


Design a production-grade RAG architecture for enterprise knowledge systems including chunking, retrieval, evaluation, and memory optimization.


---

## 📦 Setup Instructions

### 1️⃣ Clone the Repository


git clone https://github.com/YOUR_USERNAME/research-agent.git

cd research-agent


---

### 2️⃣ Backend Setup


npm install


Create `.env`:


GEMINI_API_KEY=your_key_here
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_key_here


Start backend:


node server.js


---

### 3️⃣ Frontend Setup


cd client
npm install
npm start


---

## 🏆 Why This Project Is Different

- Not a simple chatbot
- Not just RAG
- Not just vector search
- Not just persona prompting

It is a **memory-augmented, multi-tool, multi-perspective research engine.**

---

## 🔮 Future Improvements

- Structured memory chunking
- Source citation ranking
- Memory decay & prioritization
- Multi-hop reasoning
- Tool caching layer
- Animated research pipeline visualization

---

