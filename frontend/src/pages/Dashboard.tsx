import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  LayoutDashboard,
  LogOut,
  PlayCircle,
  LineChart,
  UserCircle,
} from "lucide-react";

interface Interview {
  _id: string;
  domain: string;
  type: string;
  date: string;
  score: number;
}

interface UserData {
  _id: string;
  name: string;
  email: string;
}

const Dashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [userData, setUserData] = useState<UserData | null>(null);
  const successMessage = location.state?.message ?? null;

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUserData(JSON.parse(storedUser));
  }, []);

  useEffect(() => {
    const fetchInterviews = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get("http://localhost:5000/api/interviews", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInterviews(response.data);
    };
    fetchInterviews();
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-200 flex">
      {/* Sidebar */}
      <aside className="w-64 glass-effect text-white p-6 flex flex-col gap-6">
        <div className="flex items-center gap-3 text-white/90 font-semibold text-xl">
          <LayoutDashboard size={26} /> AI Mock Interview
        </div>

        <nav className="flex flex-col gap-3">
          <Link
            to="/dashboard"
            className="nav-link group"
          >
            <LayoutDashboard className="mr-2" size={20} />
            Dashboard
          </Link>

          <Link
            to="/interview-setup"
            className="nav-link group"
          >
            <PlayCircle className="mr-2" size={20} />
            Start Interview
          </Link>

          <button
            onClick={handleLogout}
            className="nav-link group text-red-300 hover:text-red-100 hover:ml-1"
          >
            <LogOut className="mr-2" size={20} />
            Logout
          </button>
        </nav>
      </aside>

      {/* Main Dashboard */}
      <main className="flex-1 p-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800">
              Welcome Back 👋
            </h1>
            <p className="text-gray-500">
              Improve and track your interview performance
            </p>
          </div>
          <Link
            to="/interview-setup"
            className="btn-primary hover:shadow-xl transition-all"
          >
            <PlayCircle size={20} className="mr-2" />
            New Interview
          </Link>
        </div>

        {/* Glass Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            {
              title: "Completed Interviews",
              value: interviews.length,
              icon: <LineChart size={28} />,
            },
            {
              title: "Average Score",
              value:
                interviews.length > 0
                  ? `${Math.round(
                      interviews.reduce((sum, x) => sum + x.score, 0) /
                        interviews.length
                    )}%`
                  : "-",
              icon: <UserCircle size={28} />,
            },
            {
              title: "Highest Score",
              value:
                interviews.length > 0
                  ? `${Math.max(...interviews.map((x) => x.score))}%`
                  : "-",
              icon: <LayoutDashboard size={28} />,
            },
          ].map((card, i) => (
            <div
              key={i}
              className="glass-card hover:scale-[1.02] transition-transform"
            >
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-700">{card.title}</p>
                <span className="text-blue-800">{card.icon}</span>
              </div>
              <h3 className="text-4xl font-semibold text-gray-900 mt-2">
                {card.value}
              </h3>
            </div>
          ))}
        </div>

        {/* Interview History */}
        <div className="glass-table p-6 rounded-xl">
          <h2 className="text-xl font-semibold mb-4">Interview History</h2>

          {interviews.length === 0 ? (
            <p className="text-gray-600">
              No interviews yet —{" "}
              <Link className="text-blue-600 underline" to="/interview-setup">
                Start one now
              </Link>
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-gray-500 uppercase text-xs">
                  <th className="table-head">Date</th>
                  <th className="table-head">Position</th>
                  <th className="table-head">Score</th>
                  <th className="table-head">Actions</th>
                </tr>
              </thead>
              <tbody>
                {interviews.map((i) => (
                  <tr key={i._id} className="hover:bg-blue-50 transition">
                    <td className="table-cell">
                      {new Date(i.date).toLocaleDateString()}
                    </td>
                    <td className="table-cell">{i.domain}</td>
                    <td className="table-cell font-semibold text-blue-700">
                      {i.score}%
                    </td>
                    <td className="table-cell">
                      <Link
                        to={`/results/${i._id}`}
                        className="text-blue-600 hover:underline"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
