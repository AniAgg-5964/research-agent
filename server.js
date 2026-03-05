require("dotenv").config();
const express = require("express");

const connectDB = require("./config/db");
const researchRoute = require("./routes/research");
const authRoutes = require("./routes/authRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const { initializeCollection } = require("./services/memoryService");

const app = express();
const cors = require("cors");
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Research Agent Running" });
});

// Auth routes
app.use("/api/auth", authRoutes);

// Session routes
app.use("/api/session", sessionRoutes);

// Research routes (existing — unchanged)
app.use("/research", researchRoute);

const PORT = 5000;

// Connect MongoDB then start server
connectDB().then(() => {
  initializeCollection();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});