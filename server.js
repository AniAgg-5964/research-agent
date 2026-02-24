require("dotenv").config();
const express = require("express");

const researchRoute = require("./routes/research");
const { initializeCollection } = require("./services/memoryService");

const app = express();
const cors = require("cors");
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Research Agent Running 🚀" });
});

app.use("/research", researchRoute);

const PORT = 5000;

initializeCollection();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});