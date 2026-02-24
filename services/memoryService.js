const { QdrantClient } = require("@qdrant/js-client-rest");
const { GoogleGenAI } = require("@google/genai");

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const COLLECTION_NAME = "research_memory";

// Initialize collection
async function initializeCollection() {
  const collections = await qdrant.getCollections();

  const exists = collections.collections.find(
    (c) => c.name === COLLECTION_NAME
  );

  if (!exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: 3072,
        distance: "Cosine",
      },
    });
    console.log("Qdrant collection created.");
  }
}

// Generate embedding
async function generateEmbedding(text) {
  const response = await ai.models.embedContent({
    model: "models/gemini-embedding-001",
    contents: text,
  });

  // New SDK returns embeddings array
  return response.embeddings[0].values;
  console.log("Embedding size:", response.embeddings[0].values.length);
}

// Store memory
async function storeMemory(id, text, metadata = {}) {
  const vector = await generateEmbedding(text);

  await qdrant.upsert(COLLECTION_NAME, {
    points: [
      {
        id,
        vector,
        payload: metadata,
      },
    ],
  });
}

// Search memory
async function searchMemory(query) {
  const vector = await generateEmbedding(query);

  const results = await qdrant.search(COLLECTION_NAME, {
    vector,
    limit: 5,
  });

  return results;
}

module.exports = {
  initializeCollection,
  storeMemory,
  searchMemory,
};