# 2️⃣ Smart Mock Interview

<p align="center">
<img src="https://img.shields.io/badge/TypeScript-Frontend-blue?style=flat-square&logo=typescript" />
<img src="https://img.shields.io/badge/Node.js-Backend-green?style=flat-square&logo=node.js" />
<img src="https://img.shields.io/badge/Deployment-Render-purple?style=flat-square&logo=render" />
<img src="https://img.shields.io/github/license/Sampath2910/smart-mock-interview?style=flat-square" />
</p>

# Smart Mock Interview

Interactive web-based technical AI interview simulation platform.

**Live Demo:**  
https://smart-mock-interview-ir4w.onrender.com

A full-stack web application that allows students to practice interviews using AI. The platform simulates real interview conditions by integrating video, voice, facial expressions, and speech relevance analysis to provide a comprehensive evaluation of the student's performance.

---

## Features

*   **Authentication**: User signup and login functionality with secure session management.
*   **Dashboard**: View past interviews, historical performance statistics, and start new practice runs.
*   **Interview Setup**: Choose target domain/role, experience level, and number of questions.
*   **Live Interview Room**: Real-time voice transcription with webcam monitoring.
*   **AI Feedback**: Blended confidence scoring using `face-api.js` (facial emotions) and canvas pixel-level `OpenCVFaceAnalyzer` (gaze tracking and body language stability).
*   **Detailed Results Page**: In-depth score analysis, performance Radar charts, and optimal answers to review mistakes.

---

## Tech Stack

*   **Frontend**: React.js with TypeScript and Tailwind CSS
*   **Backend**: Node.js and Express
*   **Database**: MongoDB
*   **Authentication**: JWT
*   **Voice Input**: Web Speech API
*   **Video Recording**: `react-webcam`
*   **Charts**: `Chart.js` with `react-chartjs-2`

---

## Setup Instructions

### Prerequisites

*   Node.js (v18+)
*   MongoDB (local instance or MongoDB Atlas connection string)

### 1. Backend Setup

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create a `.env` file based on the provided `.env.example` file:
    ```env
    PORT=5000
    MONGO_URI=mongodb://127.0.0.1:27017/ai-interview-platform
    JWT_SECRET=your_jwt_secret
    NODE_ENV=development
    ```
4.  Start the server:
    ```bash
    npm run dev
    ```

### 2. Frontend Setup

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm start
    ```
4.  The application will be available at `http://localhost:3000`

---

## Usage

1.  Register a new account or log in with the test credentials:
    *   **Email**: `user@example.com`
    *   **Password**: `password123`
2.  From the dashboard, click **Start New Interview**.
3.  Select your position, target skills, and question count.
4.  Answer questions using your microphone or the text editor.
5.  Review your metrics and correct your answers against the optimal answers.

---

## License

This project is licensed under the MIT License.
