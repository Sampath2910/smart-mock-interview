import React, { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import api from "../utils/api";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Radar } from "react-chartjs-2";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface InterviewData {
  _id: string;
  domain: string;
  type: string;
  date: string;
  score: number;
  questions: string[];
  responses: string[];
  correctAnswers?: string[];
  performance: {
    confidence: number;
    communicationSkills: number;
    relevance: number;
    fluency?: number;
  };
  feedback: {
    type: string;
    content: string;
  }[];
}

const Results: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [interview, setInterview] = useState<InterviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetchInterviewDetails = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          throw new Error("Authentication required");
        }

        const response = await api.get(`/api/interviews/${id}`);

        setInterview(response.data);
      } catch (err: any) {
        console.error("Failed to fetch interview details:", err);
        setError(
          err.response?.data?.message || "Failed to load interview data"
        );
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchInterviewDetails();
    }
  }, [id]);

  // Format date
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDeleteInterview = async () => {
    if (!id) return;

    setDeleteLoading(true);
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("Authentication required");
      }

      await api.delete(`/api/interviews/${id}`);

      // Redirect to dashboard after successful deletion
      navigate("/dashboard", {
        state: { message: "Interview deleted successfully" },
      });
    } catch (err: any) {
      console.error("Failed to delete interview:", err);
      setError(err.response?.data?.message || "Failed to delete interview");
      setShowDeleteConfirm(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8 flex justify-center items-center">
        <div className="text-lg">Loading interview results...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <div className="text-center mt-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-primary text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          Interview not found
        </div>
        <div className="text-center mt-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-primary text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-3xl font-bold mb-6">Interview Results</h1>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Performance Summary</h2>
        <div className="mb-6">
          <p className="text-lg">
            Overall Score:{" "}
            <span className="font-bold text-green-600">{interview.score}%</span>
          </p>
          <p>Position: {interview.domain}</p>
          <p>Date: {formatDate(interview.date)}</p>
        </div>

        {interview.performance && (() => {
          const radarData = {
            labels: ["Confidence", "Communication Skills", "Relevance"],
            datasets: [
              {
                label: "Score",
                data: [
                  interview.performance.confidence || 0,
                  interview.performance.communicationSkills || 0,
                  interview.performance.relevance || 0,
                ],
                backgroundColor: "rgba(30, 64, 175, 0.15)",
                borderColor: "rgb(30, 64, 175)",
                borderWidth: 2,
                pointBackgroundColor: "rgb(30, 64, 175)",
                pointBorderColor: "#fff",
                pointHoverBackgroundColor: "#fff",
                pointHoverBorderColor: "rgb(30, 64, 175)",
              },
            ],
          };

          const radarOptions = {
            scales: {
              r: {
                angleLines: {
                  display: true,
                },
                suggestedMin: 0,
                suggestedMax: 100,
              },
            },
            plugins: {
              legend: {
                display: false,
              },
            },
          };

          return (
            <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-gray-50/50 p-6 rounded-xl border border-gray-100">
              <div>
                <h3 className="font-semibold text-lg mb-4 text-gray-800">
                  Performance Metrics
                </h3>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-semibold text-gray-700">Confidence</p>
                      <p className="text-sm font-bold text-blue-600">
                        {interview.performance.confidence}%
                      </p>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 mt-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${interview.performance.confidence}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-semibold text-gray-700">
                        Communication Skills
                      </p>
                      <p className="text-sm font-bold text-purple-600">
                        {interview.performance.communicationSkills}%
                      </p>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 mt-2 overflow-hidden">
                      <div
                        className="bg-purple-500 h-2.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${interview.performance.communicationSkills}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-semibold text-gray-700">Relevance</p>
                      <p className="text-sm font-bold text-yellow-600">
                        {interview.performance.relevance}%
                      </p>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 mt-2 overflow-hidden">
                      <div
                        className="bg-yellow-500 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${interview.performance.relevance}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm max-w-[280px] mx-auto w-full">
                <div className="w-full aspect-square">
                  <Radar data={radarData} options={radarOptions} />
                </div>
              </div>
            </div>
          );
        })()}

        <div className="mb-6">
          <h3 className="font-semibold text-lg mb-2">Feedback</h3>

          {interview.feedback.map((item, index) => (
            <div
              key={index}
              className={`p-4 border rounded mb-2 ${
                item.type === "strength"
                  ? "bg-green-50 border-green-200"
                  : item.type === "improvement"
                  ? "bg-red-50 border-red-200"
                  : "bg-blue-50 border-blue-200"
              }`}
            >
              <p
                className={`${
                  item.type === "strength"
                    ? "text-green-800"
                    : item.type === "improvement"
                    ? "text-red-800"
                    : "text-blue-800"
                }`}
              >
                <span className="font-bold capitalize">{item.type}: </span>
                {item.content}
              </p>
            </div>
          ))}
        </div>

        {interview.questions && interview.questions.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-2">
              Questions & Responses
            </h3>
            {interview.questions.map((question, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded p-4 mb-4"
              >
                <p className="font-medium mb-2">
                  Q{index + 1}: {question}
                </p>
                <div className="bg-gray-50 p-3 rounded mb-2">
                  <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wide">
                    Your Response
                  </p>
                  <p className="text-gray-700">
                    {interview.responses[index] || "No response recorded"}
                  </p>
                </div>
                {interview.correctAnswers && interview.correctAnswers[index] && (
                  <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded">
                    <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide mb-1">
                      Optimal / Correct Answer
                    </p>
                    <p className="text-gray-800 text-sm">
                      {interview.correctAnswers[index]}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <Link
            to="/dashboard"
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
          >
            Back to Dashboard
          </Link>

          <div className="flex gap-3">
            {showDeleteConfirm ? (
              <>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteInterview}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  disabled={deleteLoading}
                >
                  {deleteLoading ? "Deleting..." : "Confirm Delete"}
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Delete Interview
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Results;
