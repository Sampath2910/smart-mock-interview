const mongoose = require("mongoose");

const FeedbackItemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["strength", "improvement", "tip"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
});

const PerformanceSchema = new mongoose.Schema({
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  technicalCorrectness: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  communicationSkills: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  relevance: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  fluency: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
});

const InterviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  domain: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["Technical", "HR"],
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  questions: {
    type: [String],
    required: true,
  },
  responses: {
    type: [String],
    default: [],
  },
  correctAnswers: {
    type: [String],
    default: [],
  },
  performance: {
    type: PerformanceSchema,
    default: () => ({}),
  },
  feedback: {
    type: [FeedbackItemSchema],
    default: [],
  },
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  screenshot: {
    type: String,
    default: null,
  },
});

module.exports = mongoose.model("Interview", InterviewSchema);
