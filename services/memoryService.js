const { QdrantClient } = require("@qdrant/js-client-rest");
const { GoogleGenAI } = require("@google/genai");

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  checkCompatibility: false,
  timeout: 10000,
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const COLLECTION_NAME = "research_memory";

async function retryOperation(fn, retries = 3, delay = 1500) {
  let lastErr;
  for (let i = 1; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, delay * i));
      }
    }
  }
  throw lastErr;
}

// =====================================================
// Ensure Collection Exists
// =====================================================
async function initializeCollection() {
  return retryOperation(async () => {
    try {
      const existsRes = await qdrant.collectionExists(COLLECTION_NAME);
      if (!existsRes.exists) {
        await qdrant.createCollection(COLLECTION_NAME, {
          vectors: {
            size: 3072, // Gemini embedding-001 vector size
            distance: "Cosine",
          },
        });
        console.log("[Qdrant] Collection 'research_memory' created.");
      } else {
        console.log("[Qdrant] Connected to cluster: 'research_memory' ready.");
      }
    } catch (err) {
      console.error("[Qdrant] Collection initialization attempt failed:", err.message);
      throw err;
    }
  }, 3, 1000);
}

// =====================================================
// Generate Embedding
// =====================================================
async function generateEmbedding(text) {
  return retryOperation(async () => {
    try {
      const response = await ai.models.embedContent({
        model: "models/gemini-embedding-001",
        contents: text,
      });
      return response.embeddings[0].values;
    } catch (err) {
      console.error("[Gemini Embedding] Generation failed:", err.message);
      throw err;
    }
  }, 3, 1000);
}

// =====================================================
// Store Memory
// =====================================================
async function storeMemory(id, text, metadata = {}) {
  try {
    await initializeCollection();
    const vector = await generateEmbedding(text);

    await retryOperation(async () => {
      await qdrant.upsert(COLLECTION_NAME, {
        points: [
          {
            id,
            vector,
            payload: metadata,
          },
        ],
      });
    }, 3, 1000);

    console.log(`[Qdrant] Stored memory point ${id}`);
  } catch (err) {
    console.error("[Qdrant] storeMemory error:", err.message);
    throw err;
  }
}

// =====================================================
// Search Memory
// =====================================================
async function searchMemory(query) {
  try {
    await initializeCollection();
    const vector = await generateEmbedding(query);

    const response = await retryOperation(async () => {
      return await qdrant.query(COLLECTION_NAME, {
        query: vector,
        limit: 5,
        with_payload: true,
      });
    }, 3, 1000);

    return response.points || [];
  } catch (err) {
    console.error("[Qdrant] searchMemory error:", err.message);
    throw err;
  }
}

module.exports = {
  initializeCollection,
  storeMemory,
  searchMemory,
};