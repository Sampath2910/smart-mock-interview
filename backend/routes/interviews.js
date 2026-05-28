const express = require("express");
const router = express.Router();
const Interview = require("../models/Interview");
const { protect } = require("../middleware/auth");

// AI analysis mock function
const analyzeInterview = (questions, responses) => {
  // In a real application, this would integrate with an AI service
  // For demo purposes, we're generating mock analysis results

  // Generate random performance scores
  const performance = {
    confidence: Math.floor(Math.random() * 30) + 60, // 60-90
    technicalCorrectness: Math.floor(Math.random() * 30) + 60, // 60-90
    communicationSkills: Math.floor(Math.random() * 30) + 60, // 60-90
    relevance: Math.floor(Math.random() * 30) + 60, // 60-90
    fluency: Math.floor(Math.random() * 30) + 60, // 60-90
  };

  // Calculate overall score (average of all metrics)
  const score = Math.floor(
    Object.values(performance).reduce((sum, val) => sum + val, 0) /
      Object.values(performance).length
  );

  // Generate feedback
  const strengths = [
    "Good technical knowledge demonstrated throughout the interview.",
    "Clear and concise explanations of complex concepts.",
    "Good use of relevant examples to illustrate points.",
    "Maintained good eye contact during responses.",
    "Structured answers logically with clear beginnings and conclusions.",
  ];

  const improvements = [
    "Could improve answer depth by providing more technical details.",
    "Some hesitation when answering technical questions.",
    "Consider using more industry-specific terminology.",
    "Responses could be more concise for some questions.",
    "Could improve body language and hand gestures while speaking.",
  ];

  const tips = [
    "Practice explaining technical concepts to non-technical audiences.",
    "Prepare a wider range of examples from personal experience.",
    "Focus on maintaining consistent speaking pace throughout answers.",
    "Consider the STAR method (Situation, Task, Action, Result) for behavioral questions.",
    "Research the latest trends in the field to include in future interviews.",
  ];

  // Randomly select feedback items
  const randomSelect = (arr, count) => {
    const selected = [];
    const copy = [...arr];
    for (let i = 0; i < count; i++) {
      if (copy.length === 0) break;
      const index = Math.floor(Math.random() * copy.length);
      selected.push(copy[index]);
      copy.splice(index, 1);
    }
    return selected;
  };

  const feedback = [
    ...randomSelect(strengths, 2).map((content) => ({
      type: "strength",
      content,
    })),
    ...randomSelect(improvements, 2).map((content) => ({
      type: "improvement",
      content,
    })),
    ...randomSelect(tips, 2).map((content) => ({ type: "tip", content })),
  ];

  return { performance, score, feedback };
};

// @route   GET /api/interviews
// @desc    Get all interviews for a user
// @access  Private
router.get("/", protect, async (req, res) => {
  try {
    const interviews = await Interview.find({ user: req.user._id }).sort({
      date: -1,
    });

    res.status(200).json(interviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/interviews/:id
// @desc    Get interview by ID
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }

    // Check if interview belongs to user
    if (interview.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this interview",
      });
    }

    res.status(200).json(interview);
  } catch (err) {
    console.error(err);
    if (err.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   POST /api/interviews
// @desc    Create a new interview
// @access  Private
router.post("/", protect, async (req, res) => {
  try {
    const {
      settings,
      questions,
      responses,
      correctAnswers,
      screenshot,
      endTime,
      performance,
      score,
      feedback,
    } = req.body;

    if (!settings || !questions || !responses) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    console.log("Received interview data from client:");
    console.log("Performance metrics:", performance);
    console.log("Score:", score);
    console.log("Has screenshot:", !!screenshot);

    // Use provided analysis data if available, otherwise generate it
    let analysis;
    if (performance && typeof score === "number") {
      // Use client-provided performance metrics and score
      console.log("Using client-provided metrics");
      analysis = {
        performance,
        score,
        feedback: feedback || analyzeInterview(questions, responses).feedback,
      };
    } else {
      // Fall back to generated analysis
      console.log(
        "Generating metrics (client metrics not provided or invalid)"
      );
      analysis = analyzeInterview(questions, responses);
    }

    // Create interview
    const interview = await Interview.create({
      user: req.user._id,
      domain: settings.domain,
      type: settings.type,
      date: endTime || Date.now(),
      questions,
      responses,
      correctAnswers: correctAnswers || [],
      performance: analysis.performance,
      score: analysis.score,
      feedback: analysis.feedback,
      screenshot,
    });

    console.log("Created interview with metrics:", analysis.performance);
    res.status(201).json(interview);
  } catch (err) {
    console.error(err);
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   DELETE /api/interviews/:id
// @desc    Delete an interview
// @access  Private
router.delete("/:id", protect, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }

    // Check if interview belongs to user
    if (interview.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to delete this interview",
      });
    }

    await interview.deleteOne();

    res.status(200).json({
      success: true,
      message: "Interview deleted",
    });
  } catch (err) {
    console.error(err);
    if (err.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
