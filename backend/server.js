const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");
require("dotenv").config();

// Import routes
const authRoutes = require("./routes/auth");
const interviewRoutes = require("./routes/interviews");

// Initialize app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(morgan("dev"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/interviews", interviewRoutes);

// ❗ REMOVE / COMMENT THIS because it blocks React build
// app.get("/", (req, res) => {
//   res.json({ message: "Welcome to AI Interview Platform API" });
// });

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "production" ? {} : err,
  });
});

// Connect to MongoDB
mongoose
  .connect(
    process.env.MONGO_URI || "mongodb://localhost:27017/ai-interview-platform"
  )
  .then(() => {
    console.log("Connected to MongoDB");

    const path = require("path");

    // 🔥 Serve React frontend build
    app.use(express.static(path.join(__dirname, "../frontend/build")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "../frontend/build/index.html"));
    });

    // Start backend server
      app.listen(PORT, () => {
    console.log(`\n🚀 Server running at: http://localhost:${PORT}\n`);
    console.log("📌 Click the link above to open the website");
    });

  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
  process.exit(1);
});
