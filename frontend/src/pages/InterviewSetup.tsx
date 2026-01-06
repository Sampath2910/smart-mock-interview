import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const InterviewSetup: React.FC = () => {
  const navigate = useNavigate();
  const [position, setPosition] = useState("");
  const [experience, setExperience] = useState("mid");
  const [duration, setDuration] = useState("30");
  const [questionCount, setQuestionCount] = useState("4");
  const [skills, setSkills] = useState<string[]>(["React", "JavaScript"]);
  const [customSkill, setCustomSkill] = useState("");

  const allSkills = [
    "React",
    "JavaScript",
    "TypeScript",
    "Node.js",
    "HTML/CSS",
    "Redux",
    "Next.js",
    "GraphQL",
    "REST APIs",
    "Testing",
  ];

  const handleSkillToggle = (skill: string) => {
    skills.includes(skill)
      ? setSkills(skills.filter((s) => s !== skill))
      : setSkills([...skills, skill]);
  };

  const addCustomSkill = () => {
    if (customSkill && !skills.includes(customSkill)) {
      setSkills([...skills, customSkill]);
      setCustomSkill("");
    }
  };

  const startInterview = (e: React.FormEvent) => {
    e.preventDefault();

    const settings = {
      position,
      experience,
      duration,
      skills,
      questionCount,
    };

    navigate("/interview/in-progress", { state: { settings } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-200 p-10 flex justify-center">
      <form
        onSubmit={startInterview}
        className="glass-auth max-w-2xl w-full p-10"
      >
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-10">
          Setup Your Interview 🎤
        </h1>

        <div className="flex flex-col gap-6">
          <div>
            <label className="auth-label">Position / Role</label>
            <input
              type="text"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Frontend Developer / React Engineer"
              className="auth-input"
              required
            />
          </div>

          <div>
            <label className="auth-label">Experience Level</label>
            <select
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="auth-input"
            >
              <option value="junior">Junior (0–2 years)</option>
              <option value="mid">Mid-level (3–5 years)</option>
              <option value="senior">Senior (6+ years)</option>
            </select>
          </div>

          <div>
            <label className="auth-label">Interview Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="auth-input"
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </div>

          <div>
            <label className="auth-label">Number of Questions</label>
            <div className="flex gap-4">
              {["4", "7", "10"].map((count) => (
                <label key={count} className="flex items-center gap-2">
                  <input
                    type="radio"
                    value={count}
                    checked={questionCount === count}
                    onChange={(e) => setQuestionCount(e.target.value)}
                  />
                  {count} Questions
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="auth-label">Skills to Focus On</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {allSkills.map((skill) => (
                <button
                  type="button"
                  key={skill}
                  onClick={() => handleSkillToggle(skill)}
                  className={`px-3 py-1 rounded-full text-sm transition ${
                    skills.includes(skill)
                      ? "bg-blue-700 text-white"
                      : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>

            <div className="flex mt-2">
              <input
                type="text"
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                placeholder="Add custom skill"
                className="auth-input rounded-r-none"
              />
              <button
                type="button"
                onClick={addCustomSkill}
                className="btn-primary rounded-l-none"
              >
                Add
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4">
            <Link
              to="/dashboard"
              className="text-gray-600 hover:text-gray-800 text-sm"
            >
              ← Back to Dashboard
            </Link>
            <button
              type="submit"
              className="btn-primary px-6 py-3"
              disabled={!position || skills.length === 0}
            >
              Start Interview
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default InterviewSetup;
