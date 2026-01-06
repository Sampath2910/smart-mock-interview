import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const InterviewResults: React.FC = () => {
  const navigate = useNavigate();
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState("");

  // Mock interview results
  const mockResults = {
    score: 87,
    duration: "28:45",
    skills: [
      "React",
      "TypeScript",
      "State Management",
      "Performance Optimization",
    ],
    position: "Senior Frontend Developer",
    feedback: {
      strengths: [
        "Strong understanding of React hooks and component lifecycle.",
        "Excellent knowledge of performance optimization techniques.",
        "Good problem-solving approach and communication skills.",
      ],
      areasForImprovement: [
        "Could improve understanding of more advanced TypeScript concepts.",
        "Consider exploring more state management libraries beyond Redux.",
      ],
      questionFeedback: [
        {
          question:
            "Can you explain the difference between useState and useRef hooks in React?",
          score: 92,
          feedback:
            "Provided a comprehensive explanation covering all key differences with practical examples.",
        },
        {
          question:
            "How would you optimize performance in a React application that renders a large list of items?",
          score: 85,
          feedback:
            "Good understanding of virtualization and memoization, but could have mentioned windowing libraries.",
        },
        {
          question:
            "Describe your approach to testing React components. What tools and methodologies do you use?",
          score: 78,
          feedback:
            "Covered basic testing concepts but missed some important testing strategies for complex components.",
        },
        {
          question:
            "Can you explain how you would implement client-side form validation in React?",
          score: 90,
          feedback:
            "Excellent understanding of form validation approaches and libraries.",
        },
      ],
    },
  };

  // Score badge style based on score
  const getScoreClass = (score: number) => {
    if (score >= 90) return "text-green-700 bg-green-50 border border-green-200";
    if (score >= 75) return "text-blue-700 bg-blue-50 border border-blue-200";
    if (score >= 60)
      return "text-yellow-700 bg-yellow-50 border border-yellow-200";
    return "text-red-700 bg-red-50 border border-red-200";
  };

  const handleDeleteMockInterview = () => {
    setDeleteLoading(true);

    // Simulate API call with timeout
    setTimeout(() => {
      setDeleteLoading(false);
      // Navigate to dashboard with success message
      navigate("/dashboard", {
        state: { message: "Interview deleted successfully" },
      });
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-200 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-4xl space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="glass-card p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-800/70">
                AI Mock Interview
              </p>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">
                Interview Results
              </h1>
              <p className="text-xs md:text-sm text-gray-500 mt-1">
                Role: <span className="font-medium">{mockResults.position}</span>
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-xs uppercase tracking-wide text-gray-500">
                  Overall score
                </span>
                <div
                  className={`mt-1 inline-flex items-center justify-center rounded-full px-4 py-2 text-lg font-bold ${getScoreClass(
                    mockResults.score
                  )}`}
                >
                  {mockResults.score}%
                </div>
              </div>
              <div className="hidden md:flex flex-col items-end text-xs text-gray-500">
                <span>Duration</span>
                <span className="mt-1 text-sm font-medium text-gray-800">
                  {mockResults.duration}
                </span>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white/70 rounded-xl border border-white/60 shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Position
              </h3>
              <p className="text-sm font-medium text-gray-900">
                {mockResults.position}
              </p>
            </div>

            <div className="bg-white/70 rounded-xl border border-white/60 shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Duration
              </h3>
              <p className="text-sm font-medium text-gray-900">
                {mockResults.duration}
              </p>
            </div>

            <div className="bg-white/70 rounded-xl border border-white/60 shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Skills assessed
              </h3>
              <p className="text-xs text-gray-700">
                {mockResults.skills.length} key skill
                {mockResults.skills.length > 1 && "s"}
              </p>
            </div>
          </div>

          {/* Skills chips */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">
              Skills Assessed
            </h2>
            <div className="flex flex-wrap gap-2">
              {mockResults.skills.map((skill, index) => (
                <span
                  key={index}
                  className="bg-primary bg-opacity-10 text-primary px-3 py-1 rounded-full text-xs"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Feedback sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white/70 rounded-xl border border-white/60 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-emerald-700 mb-2">
                Strengths
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                {mockResults.feedback.strengths.map((strength, index) => (
                  <li key={index}>{strength}</li>
                ))}
              </ul>
            </div>

            <div className="bg-white/70 rounded-xl border border-white/60 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-amber-700 mb-2">
                Areas for Improvement
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                {mockResults.feedback.areasForImprovement.map((area, index) => (
                  <li key={index}>{area}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Question-by-question analysis */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Question-by-Question Analysis
            </h2>
            <div className="space-y-3">
              {mockResults.feedback.questionFeedback.map((item, index) => (
                <div
                  key={index}
                  className="bg-white/80 border border-gray-100 rounded-xl p-4 shadow-sm"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 gap-2">
                    <h3 className="text-sm font-medium text-gray-900 md:pr-4">
                      Q{index + 1}. {item.question}
                    </h3>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getScoreClass(
                        item.score
                      )}`}
                    >
                      {item.score}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{item.feedback}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2.5 rounded-lg bg-white/80 text-gray-800 border border-gray-200 hover:bg-gray-50 text-sm font-medium flex items-center justify-center gap-1 transition"
          >
            ← Back to Dashboard
          </button>

          <div className="flex gap-3 justify-end">
            {showDeleteConfirm ? (
              <>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2.5 rounded-lg bg-white/80 text-gray-800 border border-gray-200 hover:bg-gray-50 text-sm font-medium"
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteMockInterview}
                  className="px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition disabled:opacity-60"
                  disabled={deleteLoading}
                >
                  {deleteLoading ? "Deleting..." : "Confirm Delete"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate("/interview-setup")}
                  className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-blue-700 transition"
                >
                  Start New Interview
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
                >
                  Delete Interview
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewResults;
