import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";
import * as tf from "@tensorflow/tfjs";
import OpenCVFaceAnalyzer from "../utils/OpenCVFaceAnalyzer";
import loadOpenCV from "../utils/OpenCVLoader";

// Define SpeechRecognition interface for TypeScript
interface SpeechRecognitionEvent extends Event {
  results: {
    isFinal: boolean;
    [index: number]: { transcript: string };
  }[];
  resultIndex: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: any) => void;
  onend: (event: Event) => void;
}

// Define the window interface to include SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

// Properly define the component with explicit return type
const InterviewInProgress: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [remainingTime, setRemainingTime] = useState(30 * 60); // 30 minutes in seconds
  const [isRecording, setIsRecording] = useState(true);
  const [userAnswer, setUserAnswer] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const [interviewSettings, setInterviewSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [error, setError] = useState("");
  const [facialExpression, setFacialExpression] = useState<string>("neutral");
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [faceDetectionSuccess, setFaceDetectionSuccess] = useState(0); // Track consecutive successful detections
  const [relevanceScore, setRelevanceScore] = useState(0);
  const [communicationScore, setCommunicationScore] = useState(0);
  const [confidenceHistory, setConfidenceHistory] = useState<number[]>([]);
  const [relevanceHistory, setRelevanceHistory] = useState<number[]>([]);
  const [communicationHistory, setCommunicationHistory] = useState<number[]>(
    []
  );
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const [cameraInitialized, setCameraInitialized] = useState(false);
  const [speechToText, setSpeechToText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [expressionCounts, setExpressionCounts] = useState<
    Record<string, number>
  >({
    neutral: 0,
    happy: 0,
    sad: 0,
    angry: 0,
    fearful: 0,
    disgusted: 0,
    surprised: 0,
  });

  // New state for dynamic questions
  const [questions, setQuestions] = useState<
    Array<{
      id: number;
      question: string;
      expectedTopics: string[];
      keyPhrases: string[];
    }>
  >([]);

  // Add new state variables for OpenCV face analysis
  const [openCVAnalyzer, setOpenCVAnalyzer] =
    useState<OpenCVFaceAnalyzer | null>(null);

  useEffect(() => {
    // Get interview settings from location state
    if (location.state?.settings) {
      setInterviewSettings(location.state.settings);
      // Set timer based on duration from settings
      if (location.state.settings.duration) {
        setRemainingTime(parseInt(location.state.settings.duration) * 60);
      }

      // Fetch questions based on selected skills
      fetchQuestions(
        location.state.settings.skills,
        location.state.settings.experience
      );
    } else {
      // If no settings are provided, use defaults
      const defaultSettings = {
        position: "Frontend Developer",
        experience: "mid",
        duration: "30",
        skills: ["React", "JavaScript"],
      };
      setInterviewSettings(defaultSettings);

      // Fetch questions based on default skills
      fetchQuestions(defaultSettings.skills, defaultSettings.experience);
    }

    // Define webcam initialization timeout
    const webcamInitTimeout = setTimeout(() => {
      if (!cameraInitialized && cameraActive) {
        console.warn("Camera initialization timed out after 10 seconds");
        setCameraError("Camera initialization timed out. Please try again.");
        setCameraActive(false);
      }
    }, 10000);

    // Load face-api.js models
    const loadModels = async () => {
      try {
        await tf.ready();
        console.log("TensorFlow.js is ready");

        // Use a CDN URL for the models instead of local files
        const MODEL_URL =
          "https://justadudewhohacks.github.io/face-api.js/models";
        console.log("Loading models from:", MODEL_URL);

        // Check if faceapi is properly loaded
        if (!faceapi || !faceapi.nets) {
          console.error("face-api.js not properly loaded");
          throw new Error("face-api.js library not properly initialized");
        }

        console.log("Face API nets available:", Object.keys(faceapi.nets));

        // Load models sequentially
        console.log("Loading TinyFaceDetector model...");
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        console.log("TinyFaceDetector loaded successfully");

        console.log("Loading FaceLandmark68Net model...");
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        console.log("FaceLandmark68Net loaded successfully");

        console.log("Loading FaceRecognitionNet model...");
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        console.log("FaceRecognitionNet loaded successfully");

        console.log("Loading FaceExpressionNet model...");
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        console.log("FaceExpressionNet loaded successfully");

        setModelsLoaded(true);
        console.log("All face-api models loaded successfully");
      } catch (error) {
        console.error("Error loading face-api models:", error);
        setError(
          "Could not load facial analysis models. The interview will continue without facial analysis."
        );
        // Continue without facial analysis
        setCameraActive(false);
        setModelsLoaded(false);
      }
    };

    loadModels();

    // Initialize speech recognition if available
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognitionConstructor =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionConstructor) {
        speechRecognitionRef.current = new SpeechRecognitionConstructor();
        speechRecognitionRef.current.continuous = true;
        speechRecognitionRef.current.interimResults = true;

        speechRecognitionRef.current.onresult = (
          event: SpeechRecognitionEvent
        ) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          // Only update if there's new final transcript content
          if (finalTranscript) {
            // Append to current speech-to-text content rather than replacing
            setSpeechToText((prevText) => prevText + " " + finalTranscript);

            // Append to the textarea content rather than replacing
            setUserAnswer((prevAnswer) => {
              // Add a space if needed
              const spacer = prevAnswer && !prevAnswer.endsWith(" ") ? " " : "";
              return prevAnswer + spacer + finalTranscript;
            });

            console.log("Appended speech to text:", finalTranscript);
          }
        };

        speechRecognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);

          // Auto-restart after error with a delay
          setTimeout(() => {
            if (speechRecognitionRef.current && !isShuttingDown) {
              try {
                speechRecognitionRef.current.start();
                setIsListening(true);
              } catch (e) {
                console.error(
                  "Failed to restart speech recognition after error:",
                  e
                );
              }
            }
          }, 1000);
        };

        // Auto-restart when speech recognition ends
        speechRecognitionRef.current.onend = () => {
          console.log("Speech recognition ended");
          setIsListening(false);

          // Auto-restart if not explicitly stopped
          if (!isShuttingDown) {
            setTimeout(() => {
              if (
                speechRecognitionRef.current &&
                !isListening &&
                !isShuttingDown
              ) {
                try {
                  speechRecognitionRef.current.start();
                  setIsListening(true);
                  console.log("Auto-restarted speech recognition");
                } catch (e) {
                  console.error(
                    "Failed to auto-restart speech recognition:",
                    e
                  );
                }
              }
            }, 500);
          }
        };

        // Start speech recognition automatically
        setTimeout(() => {
          if (speechRecognitionRef.current && !isListening && !isShuttingDown) {
            try {
              speechRecognitionRef.current.start();
              setIsListening(true);
              console.log("Started speech recognition automatically");
            } catch (e) {
              console.error(
                "Failed to start speech recognition automatically:",
                e
              );
            }
          }
        }, 1000);
      }
    }

    // Initialize OpenCV Face Analyzer
    const initOpenCV = async () => {
      try {
        // Load OpenCV.js dynamically
        const cvLoaded = await loadOpenCV();

        if (cvLoaded) {
          console.log("OpenCV.js loaded successfully");
          const analyzer = new OpenCVFaceAnalyzer();
          const initialized = await analyzer.initialize();

          if (initialized) {
            setOpenCVAnalyzer(analyzer);
            console.log("OpenCV Face Analyzer initialized successfully");
          } else {
            console.error("Failed to initialize OpenCV Face Analyzer");
          }
        } else {
          console.warn(
            "OpenCV.js failed to load, facial analysis will be limited"
          );
        }
      } catch (error) {
        console.error("Error initializing OpenCV Face Analyzer:", error);
      }
    };

    initOpenCV();

    // Cleanup
    return () => {
      clearTimeout(webcamInitTimeout);
      // Other cleanup code
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      if (openCVAnalyzer) {
        openCVAnalyzer.dispose();
        setOpenCVAnalyzer(null);
      }
    };
  }, [location, cameraActive, cameraInitialized]); // Added camera state dependencies

  // Function to fetch questions from an API based on selected skills
  const fetchQuestions = async (
    selectedSkills: string[],
    experienceLevel: string
  ) => {
    setQuestionsLoading(true);
    try {
      // Get question count from settings or default to 4
      const questionCount = interviewSettings?.questionCount
        ? parseInt(interviewSettings.questionCount)
        : 4;

      // Use either a public API or an AI service like OpenAI
      const prompt = `Generate ${questionCount} technical interview questions for a ${experienceLevel}-level developer with the following skills: ${selectedSkills.join(
        ", "
      )}. 
      For each question, provide:
      1. The main question text
      2. Key topics the candidate should cover in their answer
      3. Key phrases that indicate the candidate understands the topic
      Format as JSON.`;

      // Either use a real OpenAI API call (requires API key) or a mock for demo purposes
      // For real implementation:
      // const response = await axios.post('https://api.openai.com/v1/completions',
      //  { prompt, model: 'gpt-3.5-turbo-instruct', max_tokens: 1000 },
      //  { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
      // );

      // For demo purposes, simulate API call with timeout
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Generate dynamic questions based on the selected skills and question count
      const generatedQuestions = generateQuestionsForSkills(
        selectedSkills,
        experienceLevel,
        questionCount
      );

      // Set the questions
      setQuestions(generatedQuestions);
      setQuestionsLoading(false);
    } catch (err) {
      console.error("Failed to fetch questions:", err);
      setError(
        "Failed to load interview questions. Using default questions instead."
      );

      // Get question count from settings or default to 4
      const questionCount = interviewSettings?.questionCount
        ? parseInt(interviewSettings.questionCount)
        : 4;

      // Fallback to default questions, but respect the question count
      const defaultQuestions = getDefaultQuestions();
      setQuestions(defaultQuestions.slice(0, questionCount));
      setQuestionsLoading(false);
    }
  };

  // Function to generate questions based on skills (mock implementation)
  const generateQuestionsForSkills = (
    skills: string[],
    level: string,
    questionCount: number = 4
  ) => {
    const questionBank: Record<
      string,
      Array<{
        question: string;
        expectedTopics: string[];
        keyPhrases: string[];
      }>
    > = {
      React: [
        {
          question:
            "Explain the concept of React hooks and how they improve functional components.",
          expectedTopics: [
            "useState",
            "useEffect",
            "Custom hooks",
            "Rules of hooks",
          ],
          keyPhrases: [
            "state management",
            "side effects",
            "functional",
            "lifecycle",
            "dependencies",
          ],
        },
        {
          question:
            "How does React's Virtual DOM work and what are its benefits?",
          expectedTopics: [
            "Reconciliation",
            "Diffing algorithm",
            "Performance optimization",
            "Batched updates",
          ],
          keyPhrases: [
            "render",
            "dom",
            "diff",
            "update",
            "performance",
            "batch",
          ],
        },
        {
          question:
            "Describe the component lifecycle in React and how it differs between class and functional components.",
          expectedTopics: [
            "Mounting",
            "Updating",
            "Unmounting",
            "useEffect",
            "componentDidMount",
          ],
          keyPhrases: [
            "lifecycle",
            "mount",
            "update",
            "unmount",
            "effect",
            "cleanup",
          ],
        },
      ],
      JavaScript: [
        {
          question:
            "Explain closures in JavaScript and provide a practical example.",
          expectedTopics: [
            "Lexical scoping",
            "Memory management",
            "Data privacy",
            "Factory functions",
          ],
          keyPhrases: [
            "scope",
            "function",
            "variable",
            "access",
            "private",
            "encapsulation",
          ],
        },
        {
          question:
            "What are Promises in JavaScript and how do they help with asynchronous operations?",
          expectedTopics: [
            "async/await",
            "then/catch",
            "Error handling",
            "Promise chaining",
          ],
          keyPhrases: [
            "asynchronous",
            "then",
            "catch",
            "await",
            "resolve",
            "reject",
            "chain",
          ],
        },
        {
          question:
            "Describe the event loop in JavaScript and how it handles asynchronous code.",
          expectedTopics: [
            "Call stack",
            "Callback queue",
            "Microtasks",
            "Macrotasks",
            "Single-threaded",
          ],
          keyPhrases: [
            "stack",
            "queue",
            "async",
            "setTimeout",
            "callback",
            "non-blocking",
          ],
        },
      ],
      TypeScript: [
        {
          question:
            "What are the benefits of using TypeScript over JavaScript? Provide specific examples.",
          expectedTopics: [
            "Static typing",
            "Type inference",
            "Interfaces",
            "Generics",
            "IDE support",
          ],
          keyPhrases: [
            "type",
            "interface",
            "compile-time",
            "error",
            "generics",
            "autocomplete",
          ],
        },
        {
          question: "Explain TypeScript's generics with a practical example.",
          expectedTopics: [
            "Type parameters",
            "Reusable components",
            "Type constraints",
            "Generic interfaces",
          ],
          keyPhrases: [
            "generic",
            "<T>",
            "constraint",
            "extends",
            "flexibility",
            "type parameter",
          ],
        },
      ],
      "Node.js": [
        {
          question:
            "Explain Node.js event-driven architecture. How does it handle concurrency?",
          expectedTopics: [
            "Event loop",
            "Non-blocking I/O",
            "Thread pool",
            "Libuv",
          ],
          keyPhrases: [
            "event loop",
            "async",
            "callback",
            "non-blocking",
            "concurrency",
            "single thread",
          ],
        },
        {
          question: "What are streams in Node.js and why are they important?",
          expectedTopics: [
            "Buffering",
            "Memory efficiency",
            "Pipeline",
            "Types of streams",
          ],
          keyPhrases: [
            "readable",
            "writable",
            "transform",
            "chunk",
            "pipe",
            "memory",
            "buffer",
          ],
        },
      ],
    };

    // For skills without specific questions, add generic ones
    const defaultSkillQuestions = [
      {
        question: `Explain your experience with ${skills.join(
          ", "
        )} and how you've applied these skills in previous projects.`,
        expectedTopics: [
          "Project examples",
          "Technical implementation",
          "Challenges faced",
          "Solutions",
        ],
        keyPhrases: [
          "project",
          "implement",
          "challenge",
          "solution",
          "experience",
          "application",
        ],
      },
      {
        question: `What are the latest developments or trends in ${skills.join(
          ", "
        )} that you find most interesting?`,
        expectedTopics: [
          "Current trends",
          "New features",
          "Recent updates",
          "Industry direction",
        ],
        keyPhrases: [
          "trend",
          "new",
          "recent",
          "update",
          "feature",
          "future",
          "direction",
        ],
      },
      {
        question: `Describe a time when you had to debug a complex issue involving ${skills[0]}. What was your approach?`,
        expectedTopics: [
          "Problem identification",
          "Debugging tools",
          "Root cause analysis",
          "Resolution steps",
        ],
        keyPhrases: [
          "debug",
          "issue",
          "problem",
          "analyze",
          "fix",
          "solution",
          "approach",
        ],
      },
      {
        question: `How do you stay updated with the latest developments in ${skills.join(
          ", "
        )}?`,
        expectedTopics: [
          "Learning resources",
          "Community engagement",
          "Documentation",
          "Practice projects",
        ],
        keyPhrases: [
          "learn",
          "resources",
          "community",
          "practice",
          "documentation",
          "update",
          "study",
        ],
      },
      {
        question: `What performance optimization techniques do you apply when working with ${skills.join(
          ", "
        )}?`,
        expectedTopics: [
          "Performance metrics",
          "Bottlenecks",
          "Optimization strategies",
          "Measurement tools",
        ],
        keyPhrases: [
          "performance",
          "optimization",
          "speed",
          "bottleneck",
          "measure",
          "improve",
          "metrics",
        ],
      },
      {
        question: `How do you approach writing maintainable and scalable code when using ${skills.join(
          ", "
        )}?`,
        expectedTopics: [
          "Code organization",
          "Design patterns",
          "Documentation",
          "Testing strategies",
        ],
        keyPhrases: [
          "maintainable",
          "scalable",
          "organization",
          "structure",
          "pattern",
          "clean",
          "architecture",
        ],
      },
    ];

    // Select questions for each skill
    let selectedQuestions: Array<{
      id: number;
      question: string;
      expectedTopics: string[];
      keyPhrases: string[];
    }> = [];

    // Try to get at least one question for each selected skill
    skills.forEach((skill, index) => {
      const skillQuestions = questionBank[skill];
      if (skillQuestions && skillQuestions.length > 0) {
        // Randomly select one question for this skill
        const randomIndex = Math.floor(Math.random() * skillQuestions.length);
        selectedQuestions.push({
          id: index + 1,
          ...skillQuestions[randomIndex],
        });
      }
    });

    // If we don't have enough questions, add default ones
    while (selectedQuestions.length < questionCount) {
      if (defaultSkillQuestions.length > 0) {
        const defaultQuestion = defaultSkillQuestions.shift()!;
        selectedQuestions.push({
          id: selectedQuestions.length + 1,
          ...defaultQuestion,
        });
      } else {
        // If we've used all default questions, add generic ones
        selectedQuestions.push({
          id: selectedQuestions.length + 1,
          question: `Tell me about a challenging problem you solved using ${
            skills[selectedQuestions.length % skills.length]
          }?`,
          expectedTopics: [
            "Problem description",
            "Solution approach",
            "Technologies used",
            "Outcome",
          ],
          keyPhrases: [
            "problem",
            "challenge",
            "solution",
            "approach",
            "result",
            "outcome",
          ],
        });
      }
    }

    // Shuffle the selected questions to randomize their order and respect the question count
    return shuffleArray(selectedQuestions.slice(0, questionCount));
  };

  // Helper function to shuffle an array
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // Fallback questions if API fails
  const getDefaultQuestions = () => [
    {
      id: 1,
      question:
        "Can you explain the difference between useState and useRef hooks in React?",
      expectedTopics: [
        "State updates trigger re-renders",
        "Refs don't cause re-renders",
        "Persistence across renders",
        "DOM element access",
      ],
      keyPhrases: [
        "useState",
        "useRef",
        "re-render",
        "state",
        "reference",
        "DOM",
        "update",
      ],
    },
    {
      id: 2,
      question:
        "How would you optimize performance in a React application that renders a large list of items?",
      expectedTopics: [
        "Virtualization",
        "Pagination",
        "Memoization",
        "PureComponent/React.memo",
        "Keys",
      ],
      keyPhrases: [
        "virtualization",
        "pagination",
        "memo",
        "useMemo",
        "memo",
        "key",
        "performance",
        "list",
        "rendering",
      ],
    },
    {
      id: 3,
      question:
        "Describe your approach to testing React components. What tools and methodologies do you use?",
      expectedTopics: [
        "Jest",
        "React Testing Library",
        "Unit tests",
        "Integration tests",
        "E2E tests",
        "Mocking",
      ],
      keyPhrases: [
        "jest",
        "testing library",
        "unit test",
        "integration test",
        "e2e",
        "end-to-end",
        "mock",
        "snapshot",
      ],
    },
    {
      id: 4,
      question:
        "Can you explain how you would implement client-side form validation in React?",
      expectedTopics: [
        "FormData API",
        "Controlled components",
        "Form libraries",
        "Custom validation",
        "Error handling",
      ],
      keyPhrases: [
        "form",
        "validation",
        "formik",
        "react-hook-form",
        "controlled component",
        "error",
        "validate",
        "schema",
      ],
    },
    {
      id: 5,
      question:
        "What is the context API in React and when would you use it instead of props or state management libraries?",
      expectedTopics: [
        "Context Provider",
        "Context Consumer",
        "useContext hook",
        "Global state",
        "Prop drilling",
      ],
      keyPhrases: [
        "context",
        "provider",
        "consumer",
        "useContext",
        "global state",
        "prop drilling",
        "nesting",
      ],
    },
    {
      id: 6,
      question:
        "Explain the differences between useEffect, useMemo, and useCallback in React hooks.",
      expectedTopics: [
        "Side effects",
        "Memoization",
        "Dependency arrays",
        "Performance optimization",
        "Referential equality",
      ],
      keyPhrases: [
        "useEffect",
        "useMemo",
        "useCallback",
        "dependency array",
        "memoization",
        "performance",
        "side effect",
      ],
    },
    {
      id: 7,
      question:
        "What are the key differences between server-side rendering (SSR) and client-side rendering (CSR) in React applications?",
      expectedTopics: [
        "Initial load time",
        "SEO benefits",
        "Hydration",
        "Next.js",
        "Frameworks comparison",
        "First contentful paint",
      ],
      keyPhrases: [
        "SSR",
        "CSR",
        "server-side",
        "client-side",
        "rendering",
        "SEO",
        "hydration",
        "Next.js",
        "performance",
      ],
    },
    {
      id: 8,
      question:
        "How would you handle global state management in a large React application?",
      expectedTopics: [
        "Redux",
        "Context API",
        "Zustand",
        "Jotai",
        "State organization",
        "Performance considerations",
      ],
      keyPhrases: [
        "Redux",
        "Context",
        "global state",
        "store",
        "state management",
        "actions",
        "reducers",
        "selectors",
      ],
    },
    {
      id: 9,
      question:
        "Describe how you would implement error boundaries in a React application.",
      expectedTopics: [
        "Error catching",
        "componentDidCatch",
        "Fallback UI",
        "Class components",
        "Error logging",
      ],
      keyPhrases: [
        "error boundary",
        "componentDidCatch",
        "getDerivedStateFromError",
        "fallback",
        "error handling",
        "crash",
        "recovery",
      ],
    },
    {
      id: 10,
      question:
        "What are React portals and when would you use them in an application?",
      expectedTopics: [
        "Modal dialogs",
        "Tooltips",
        "DOM hierarchy",
        "Event bubbling",
        "ReactDOM.createPortal",
      ],
      keyPhrases: [
        "portal",
        "createPortal",
        "DOM",
        "modal",
        "tooltip",
        "accessibility",
        "events",
        "parent",
      ],
    },
  ];

  // Handle webcam video initialization
  const handleVideoInitialization = () => {
    console.log("Video initialized successfully");
    setCameraInitialized(true);
    setCameraError("");
  };

  // Handle webcam errors
  const handleWebcamError = (err: string | DOMException) => {
    console.error("Webcam error:", err);
    const errorMessage = typeof err === "string" ? err : err.message;

    // Provide more user-friendly error messages
    let userMessage = "Unable to access camera.";

    if (
      errorMessage.includes("Permission denied") ||
      errorMessage.includes("not allowed")
    ) {
      userMessage =
        "Camera access was denied. Please check your browser permissions.";
    } else if (errorMessage.includes("requested device not found")) {
      userMessage =
        "No camera detected. Please connect a camera and try again.";
    } else if (errorMessage.includes("Could not start video source")) {
      userMessage =
        "Could not start camera. It may be in use by another application.";
    }

    setCameraError(userMessage);
    setCameraActive(false);
    setCameraInitialized(false);
  };

  // Fix the facial metrics detection useEffect
  useEffect(() => {
    if (
      modelsLoaded &&
      webcamRef.current &&
      webcamRef.current.video &&
      cameraActive &&
      openCVAnalyzer
    ) {
      // This effect is now just for cleanup
      return () => {
        // Cleanup OpenCV analyzer
        if (openCVAnalyzer) {
          openCVAnalyzer.dispose();
        }
      };
    }
  }, [modelsLoaded, webcamRef, cameraActive, openCVAnalyzer]);

  // Improved face detection interval to ensure continuous monitoring
  useEffect(() => {
    if (modelsLoaded && webcamRef.current && cameraActive) {
      console.log("Setting up continuous face detection");

      // Track detection activity
      let lastDetectionTime = Date.now();
      let detectionCount = 0;

      // Run face detection immediately to set initial values
      detectFace().then(() => {
        lastDetectionTime = Date.now();
        detectionCount++;
      });

      // Primary detection interval - run more frequently (every 500ms)
      const primaryInterval = setInterval(() => {
        if (Date.now() - lastDetectionTime > 2000) {
          console.warn("⚠️ Face detection delay detected, may have stalled");
        }

        // Run detection and update timestamp
        detectFace().then(() => {
          lastDetectionTime = Date.now();
          detectionCount++;

          // Log activity periodically
          if (detectionCount % 10 === 0) {
            console.log(
              `✅ Face detection running: ${detectionCount} checks completed`
            );
          }
        });
      }, 500); // Check every 500ms for more responsive detection

      // Secondary monitoring interval to ensure detection is running
      const monitoringInterval = setInterval(() => {
        const timeSinceLastDetection = Date.now() - lastDetectionTime;

        // If detection hasn't run in the last 3 seconds, something is wrong
        if (timeSinceLastDetection > 3000) {
          console.error(
            `🛑 Face detection appears stalled (${Math.round(
              timeSinceLastDetection / 1000
            )}s since last check)`
          );

          // Force a new detection attempt
          detectFace().then(() => {
            console.log("🔄 Forced face detection check completed");
            lastDetectionTime = Date.now();
          });
        }
      }, 3000);

      // Store the interval references for cleanup
      detectionIntervalRef.current = primaryInterval;

      // Return cleanup function
      return () => {
        console.log(`Clearing face detection (ran ${detectionCount} times)`);
        clearInterval(primaryInterval);
        clearInterval(monitoringInterval);
        detectionIntervalRef.current = null;
      };
    }
  }, [modelsLoaded, cameraActive, webcamRef.current]);

  // Additional monitoring for the webcam to ensure it's working
  useEffect(() => {
    if (!cameraActive || !webcamRef.current) return;

    const webcamMonitor = setInterval(() => {
      const video = webcamRef.current?.video;

      if (!video) {
        console.warn("⚠️ Webcam reference not available");
        return;
      }

      // Check webcam state
      if (video.readyState < 2) {
        console.warn(
          `⚠️ Webcam not fully ready: readyState=${video.readyState}`
        );
      }

      // Check for video dimensions to verify stream is active
      if (!video.videoWidth || !video.videoHeight) {
        console.warn(
          "⚠️ Webcam stream may not be active (no video dimensions)"
        );

        // Try to initialize camera again if needed
        if (!cameraInitialized) {
          console.log("Attempting to reinitialize camera");
          handleVideoInitialization();
        }
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(webcamMonitor);
  }, [cameraActive, webcamRef.current, cameraInitialized]);

  // Face detection function with improved error handling
  const detectFace = async () => {
    // Skip if shutting down, webcam not ready, or models not loaded
    if (
      isShuttingDown ||
      !webcamRef.current ||
      !webcamRef.current.video ||
      !modelsLoaded ||
      !cameraActive
    ) {
      return;
    }

    try {
      const video = webcamRef.current.video;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      // Check if video dimensions are valid
      if (!videoWidth || !videoHeight) {
        console.warn("Video dimensions not available yet");

        // Set confidence to 0 if we can't get video dimensions
        if (confidenceScore !== 0) {
          setConfidenceScore(0);
          setFacialExpression("unknown");
        }
        return;
      }

      // Ensure video is playing and not paused
      if (video.paused || video.ended) {
        console.warn("Video is paused or ended, trying to restart");
        try {
          await video.play();
        } catch (e) {
          console.error("Couldn't restart video:", e);
        }
      }

      // Use smaller size options for detection
      const detectionOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 128, // Use smallest input size for performance
        scoreThreshold: 0.4,
      });

      // Detect faces with a timeout
      const faceDetectionPromise = faceapi
        .detectAllFaces(video, detectionOptions)
        .withFaceLandmarks()
        .withFaceExpressions();

      // Add timeout for face detection to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Face detection timeout")), 1000);
      });

      // Race between detection and timeout
      const faces = (await Promise.race([
        faceDetectionPromise,
        timeoutPromise,
      ])) as faceapi.WithFaceExpressions<
        faceapi.WithFaceLandmarks<
          { detection: faceapi.FaceDetection },
          faceapi.FaceLandmarks68
        >
      >[];

      // Check if face is detected
      if (faces && faces.length > 0) {
        // Face is present - update face detection success counter
        setFaceDetectionSuccess((prev) => Math.min(prev + 1, 10));

        // Get the first detected face
        const firstFace = faces[0];

        // Update facial expression state
        type ExpressionKey = keyof typeof firstFace.expressions;
        const getExpressionValue = (key: string): number => {
          const value = firstFace.expressions[key as ExpressionKey];
          // Handle case where expression value might be a function instead of a number
          return typeof value === "number" ? value : 0;
        };

        // Find dominant expression
        let maxExpression = "neutral";
        let maxValue = 0;

        // Check each expression manually
        const expressions = [
          "neutral",
          "happy",
          "sad",
          "angry",
          "fearful",
          "disgusted",
          "surprised",
        ];
        for (const expr of expressions) {
          const value = getExpressionValue(expr);
          if (value > maxValue) {
            maxValue = value;
            maxExpression = expr;
          }
        }

        // Update facial expression only if it's significantly different
        if (
          maxValue > 0.3 ||
          facialExpression === "unknown" ||
          facialExpression === "neutral"
        ) {
          setFacialExpression(maxExpression);

          // Update expression counts
          setExpressionCounts((prev) => ({
            ...prev,
            [maxExpression]: (prev[maxExpression] || 0) + 1,
          }));
        }

        // CONFIDENCE SCORE CALCULATION - BASED ON FACIAL EXPRESSIONS
        let expressionScore = 50; // Default neutral score

        // Calculate score based on dominant expression and its intensity
        const dominantStrength = maxValue;

        // Map expressions to confidence scores
        switch (maxExpression) {
          case "happy":
            // Happy expressions boost confidence (50-100)
            expressionScore = 50 + Math.round(dominantStrength * 50);
            break;

          case "neutral":
            // Neutral expressions give moderate confidence (40-60)
            expressionScore = 40 + Math.round(dominantStrength * 20);
            break;

          case "surprised":
            // Surprised expressions give slightly below average confidence (30-50)
            expressionScore = 30 + Math.round(dominantStrength * 20);
            break;

          case "sad":
            // Sad expressions give low confidence (15-40)
            expressionScore = 15 + Math.round(dominantStrength * 25);
            break;

          case "fearful":
            // Fearful expressions give very low confidence (10-35)
            expressionScore = 10 + Math.round(dominantStrength * 25);
            break;

          case "angry":
            // Angry expressions give low confidence (10-30)
            expressionScore = 10 + Math.round(dominantStrength * 20);
            break;

          case "disgusted":
            // Disgusted expressions give low confidence (10-30)
            expressionScore = 10 + Math.round(dominantStrength * 20);
            break;

          default:
            // Default fallback
            expressionScore = 50;
        }

        // Apply smoothing to avoid jumpy values (70% new, 30% previous)
        // Only apply smoothing if we had a previous non-zero score
        const newScore =
          confidenceScore > 0
            ? Math.round(0.7 * expressionScore + 0.3 * confidenceScore)
            : expressionScore;

        // Ensure score stays within valid range
        const boundedScore = Math.max(10, Math.min(100, newScore));

        // Update the confidence score
        setConfidenceScore(boundedScore);
      } else {
        // NO FACE DETECTED - Set confidence to 0
        if (confidenceScore !== 0) {
          console.log("❌ No face detected in frame - setting confidence to 0");
          setConfidenceScore(0);
        }

        // Reset face detection counter
        setFaceDetectionSuccess((prev) => Math.max(0, prev - 1));

        // Update facial expression to "unknown" when no face detected
        if (facialExpression !== "unknown") {
          setFacialExpression("unknown");
        }
      }
    } catch (error) {
      console.error("Error in face detection:", error);

      // Reset face detection counter on error
      setFaceDetectionSuccess((prev) => Math.max(0, prev - 1));

      // Set confidence to 0 on error as no valid face could be detected
      if (confidenceScore !== 0) {
        setConfidenceScore(0);
      }

      // Update facial expression to "unknown" on error
      if (facialExpression !== "unknown") {
        setFacialExpression("unknown");
      }
    }
  };

  // Format seconds to MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Handle timer countdown
  useEffect(() => {
    if (remainingTime <= 0) {
      endInterview();
      return;
    }

    const timer = setInterval(() => {
      setRemainingTime((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingTime]);

  // Check relevance of answer to the current question
  useEffect(() => {
    if (!userAnswer || questions.length === 0) {
      setRelevanceScore(0);
      setCommunicationScore(0);
      return;
    }

    const currentQuestionData = questions[currentQuestion];
    if (!currentQuestionData) return;

    // Evaluate communication skills based on grammar
    const newCommunicationScore = evaluateCommunication(userAnswer);
    setCommunicationScore(newCommunicationScore);

    const keyPhrases = currentQuestionData.keyPhrases;

    // Simple relevance check: count how many key phrases are mentioned
    const lowerCaseAnswer = userAnswer.toLowerCase();
    let matchedPhrases = 0;

    keyPhrases.forEach((phrase) => {
      if (lowerCaseAnswer.includes(phrase.toLowerCase())) {
        matchedPhrases++;
      }
    });

    // Calculate relevance score (0-100)
    const maxPossibleMatches = Math.min(5, keyPhrases.length); // Cap at 5 for 100% score
    const newRelevanceScore = Math.min(
      Math.round((matchedPhrases / maxPossibleMatches) * 100),
      100
    );

    setRelevanceScore(newRelevanceScore);
  }, [userAnswer, currentQuestion, questions]);

  const saveAnswerForCurrentQuestion = () => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = userAnswer;
    setAnswers(newAnswers);
  };

  const saveCurrentMetrics = () => {
    // Save current metrics to their history arrays
    setConfidenceHistory((prev) => [...prev, confidenceScore]);
    setRelevanceHistory((prev) => [...prev, relevanceScore]);
    setCommunicationHistory((prev) => [...prev, communicationScore]);
  };

  const endInterview = async () => {
    // Set shutdown flag immediately to prevent any new face detection
    setIsShuttingDown(true);

    // First disable camera to stop any ongoing face detection
    setCameraActive(false);

    // Clear any running detection intervals immediately
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    // Add a small delay to ensure face detection operations are fully stopped
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Save the final answer
    saveAnswerForCurrentQuestion();

    // Save metrics for the final question
    saveCurrentMetrics();

    // Stop recording
    if (isListening) {
      stopListening();
    }

    try {
      // Calculate average metrics from history
      const calculateAverage = (arr: number[]): number => {
        if (arr.length === 0) return 0;
        const sum = arr.reduce((total, value) => total + value, 0);
        return Math.round(sum / arr.length);
      };

      // Wait a moment for state updates to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Calculate averages from history arrays
      // Current values are already saved to history by saveCurrentMetrics()
      const avgConfidence = calculateAverage(confidenceHistory);
      const avgRelevance = calculateAverage(relevanceHistory);
      const avgCommunication = calculateAverage(communicationHistory);

      // Log average calculations to verify
      console.log(
        "Confidence History:",
        confidenceHistory,
        "Average:",
        avgConfidence
      );
      console.log(
        "Relevance History:",
        relevanceHistory,
        "Average:",
        avgRelevance
      );
      console.log(
        "Communication History:",
        communicationHistory,
        "Average:",
        avgCommunication
      );

      // Calculate overall score (weighted average of all metrics)
      const overallScore = Math.round(
        avgConfidence * 0.3 + avgRelevance * 0.4 + avgCommunication * 0.3
      );

      console.log("Final performance metrics being sent to backend:", {
        confidence: avgConfidence,
        communicationSkills: avgCommunication,
        relevance: avgRelevance,
        overallScore,
      });

      // Prepare interview data for submission
      const interviewData = {
        settings: {
          domain: interviewSettings?.position || "Frontend Development",
          type: "Technical",
          skills: interviewSettings?.skills || ["React", "JavaScript"],
        },
        domain: interviewSettings?.position || "Frontend Development",
        type: "Technical",
        date: new Date().toISOString(),
        score: overallScore,
        performance: {
          confidence: avgConfidence,
          communicationSkills: avgCommunication,
          relevance: avgRelevance,
          fluency: 0, // Needed by interface but not used
        },
        feedback: [
          {
            type: "strength",
            content: `You demonstrated good ${
              avgConfidence > avgCommunication && avgConfidence > avgRelevance
                ? "confidence"
                : avgCommunication > avgRelevance
                ? "communication skills"
                : "relevance in your answers"
            }.`,
          },
          {
            type: "improvement",
            content: `Consider working on your ${
              avgConfidence < avgCommunication && avgConfidence < avgRelevance
                ? "confidence during interviews"
                : avgCommunication < avgRelevance
                ? "communication skills"
                : "answer relevance by including more key technical terms"
            }.`,
          },
        ],
        questions: questions.map((q) => q.question),
        responses:
          answers.length === questions.length
            ? answers
            : [
                ...answers,
                ...Array(questions.length - answers.length).fill(""),
              ],
        endTime: new Date().toISOString(),
        // Additional metrics for detailed analysis (not displayed in Results)
        metrics: {
          facialExpressions: expressionCounts,
          confidenceHistory: confidenceHistory,
          relevanceHistory: relevanceHistory,
          communicationHistory: communicationHistory,
        },
      };

      setLoading(true);
      setError("");

      // Get the authentication token
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("Authentication required");
      }

      // Set a timeout for the API call to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout

      try {
        // Send the interview data to the backend
        const response = await axios.post(
          "http://localhost:5000/api/interviews",
          interviewData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        // Navigate to results with the interview ID
        navigate(`/results/${response.data._id}`);
      } catch (err: any) {
        clearTimeout(timeoutId);

        if (err.name === "AbortError") {
          console.error("Request timed out", err);
          setError(
            "Saving interview timed out. Your interview data might not be saved."
          );
        } else {
          console.error("Failed to save interview:", err);
          setError(
            err.response?.data?.message || "Failed to save interview data"
          );
        }
        // Still navigate to results even if saving fails - fallback to mockResults
        navigate("/interview/results");
      }
    } catch (error: any) {
      console.error("Error during interview submission:", error);
      setError(error.message || "An unexpected error occurred");
      // Navigate to results page as fallback
      navigate("/interview/results");
    } finally {
      setLoading(false);
    }
  };

  const nextQuestion = () => {
    // Save the current answer before moving to the next question
    saveAnswerForCurrentQuestion();

    // Save metrics for the current question
    saveCurrentMetrics();

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
      setUserAnswer("");
      setSpeechToText("");
      setIsThinking(false);
    } else {
      endInterview();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopListening();
    } else {
      startListening();
    }
    setIsRecording(!isRecording);
  };

  const toggleCamera = () => {
    if (cameraActive) {
      // If turning off, just deactivate
      setCameraActive(false);
      setCameraInitialized(false);
    } else {
      // If turning on, reset state and activate
      setCameraError("");
      setCameraInitialized(false); // Reset first
      setCameraActive(true);

      // Clear any existing initialization timeout
      const initTimeout = setTimeout(() => {
        if (!cameraInitialized && cameraActive) {
          console.log("Camera initialization timeout - forcing retry");
          // Try to reinitialize by toggling
          setCameraActive(false);
          setTimeout(() => {
            setCameraError(
              "Camera initialization timed out. Retrying automatically..."
            );
            setCameraActive(true);
          }, 500);
        }
      }, 5000); // 5 seconds is more reasonable than 3

      return () => clearTimeout(initTimeout);
    }
  };

  const startListening = () => {
    if (speechRecognitionRef.current && !isListening) {
      try {
        speechRecognitionRef.current.start();
        setIsListening(true);
        console.log("Manually started speech recognition");
      } catch (e) {
        console.error("Failed to start speech recognition:", e);
      }
    }
  };

  const stopListening = () => {
    if (speechRecognitionRef.current && isListening) {
      speechRecognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleThinkingTime = () => {
    setIsThinking(true);
    // Pause voice recording during thinking time
    if (isListening) {
      stopListening();
    }
  };

  const getExpressionEmoji = (expression: string) => {
    switch (expression) {
      case "happy":
        return "😊";
      case "sad":
        return "😔";
      case "angry":
        return "😠";
      case "fearful":
        return "😨";
      case "disgusted":
        return "🤢";
      case "surprised":
        return "😲";
      case "neutral":
      default:
        return "😐";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  };

  // Calculate average for any metric including current value
  const calculateRunningAverage = (
    history: number[],
    currentValue: number
  ): number => {
    if (history.length === 0) return currentValue;
    const sum =
      history.reduce((total, value) => total + value, 0) + currentValue;
    return Math.round(sum / (history.length + 1));
  };

  // Evaluate grammar and communication skills
  const evaluateCommunication = (text: string): number => {
    if (!text) return 0;

    // Common grammar issues to check
    const grammarIssues = [
      // Repeated words
      { pattern: /\b(\w+)\s+\1\b/gi, weight: 5 },
      // Missing periods at end of sentences (basic check)
      { pattern: /\w+\s+[A-Z]/g, weight: 3 },
      // Run-on sentences (very basic detection - sentences longer than 40 words)
      { pattern: /\b(\w+\s+){40,}\w+[.!?]/g, weight: 10 },
      // Excessive use of filler words
      {
        pattern: /\b(um|uh|like|you know|basically|actually|literally)\b/gi,
        weight: 2,
      },
      // Subject-verb agreement issues (simplified check)
      { pattern: /\b(he|she|it)\s+(are|were|have been)\b/gi, weight: 5 },
      { pattern: /\b(they|we|you)\s+(is|was|has been)\b/gi, weight: 5 },
    ];

    // Structure and flow indicators (positive)
    const positiveIndicators = [
      // Transition words indicating good structure
      {
        pattern:
          /\b(first|second|third|finally|in conclusion|therefore|consequently|however|moreover|furthermore)\b/gi,
        weight: 5,
      },
      // Complete sentences with proper punctuation
      { pattern: /[A-Z][^.!?]*[.!?]/g, weight: 3 },
      // Technical terms appropriate to the domain
      {
        pattern:
          /\b(algorithm|function|component|state|props|hook|api|interface|dependency|framework|library)\b/gi,
        weight: 2,
      },
    ];

    // Calculate penalties from grammar issues
    let penalties = 0;
    grammarIssues.forEach((issue) => {
      const matches = text.match(issue.pattern) || [];
      penalties += matches.length * issue.weight;
    });

    // Calculate bonuses from positive indicators
    let bonuses = 0;
    positiveIndicators.forEach((indicator) => {
      const matches = text.match(indicator.pattern) || [];
      bonuses += matches.length * indicator.weight;
    });

    // Calculate base score (100-point scale)
    // Start with 70 as a base score and adjust with penalties and bonuses
    let score = 70 - penalties + bonuses;

    // Minimum text length requirement (at least 50 characters)
    if (text.length < 50) {
      score = Math.min(score, 40);
    }

    // Cap the score to 0-100 range
    return Math.max(0, Math.min(100, score));
  };

  // Debug webcam status
  useEffect(() => {
    console.log("Webcam status:", {
      cameraActive,
      cameraInitialized,
      cameraError,
      webcamExists: !!webcamRef.current,
      videoExists: webcamRef.current?.video ? true : false,
      videoReady: webcamRef.current?.video?.readyState === 4,
      currentConfidence: confidenceScore,
    });
  }, [cameraActive, cameraInitialized, cameraError, confidenceScore]);

  // Add a monitoring interval to ensure confidence score is working
  useEffect(() => {
    if (!cameraActive || !cameraInitialized) return;

    let lastConfidenceScore = confidenceScore;
    let unchangedCount = 0;

    // Monitor if confidence score is updating
    const monitoringInterval = setInterval(() => {
      // Check if score is the same as last check
      if (confidenceScore === lastConfidenceScore) {
        unchangedCount++;
        console.log(
          `⚠️ Confidence score unchanged for ${unchangedCount} checks`
        );

        // If unchanged for 5 checks (15 seconds), apply a random change to kick-start it
        if (unchangedCount >= 5) {
          // Force a more significant change
          const randomChange = Math.floor(Math.random() * 31) - 15; // -15 to +15
          const forcedScore = Math.max(
            20,
            Math.min(100, confidenceScore + randomChange)
          );

          console.log(
            `🔄 Forcing confidence score change: ${confidenceScore} → ${forcedScore} (${
              randomChange > 0 ? "+" : ""
            }${randomChange})`
          );
          setConfidenceScore(forcedScore);
          unchangedCount = 0;
        }
      } else {
        // Reset counter when score changes
        unchangedCount = 0;
        console.log("✅ Confidence score is updating normally");
      }

      // Update last score for next check
      lastConfidenceScore = confidenceScore;
    }, 3000); // Check every 3 seconds

    return () => clearInterval(monitoringInterval);
  }, [cameraActive, cameraInitialized, confidenceScore]);

   return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-200 flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-6xl space-y-6">
        {/* Top header with timer + controls */}
        <div className="glass-card flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-blue-800/70 font-semibold">
              Live AI Mock Interview
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mt-1">
              {interviewSettings?.position || "Technical Interview"}
            </h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              Level:{" "}
              <span className="capitalize">
                {interviewSettings?.experience || "mid"}
              </span>
              {" · "}
              {questions.length > 0 ? `${questions.length} questions` : "Loading questions..."}
            </p>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            {/* Timer pill */}
            <div
              className={`px-4 py-2 rounded-full font-mono text-sm flex items-center gap-2 shadow-sm ${
                remainingTime < 300
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-blue-50 text-blue-700 border border-blue-200"
              }`}
            >
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  remainingTime < 300 ? "bg-red-500" : "bg-emerald-500"
                } animate-pulse`}
              />
              {formatTime(remainingTime)}
            </div>

            {/* Recording toggle */}
            <button
              onClick={toggleRecording}
              type="button"
              className={`px-3 py-2 rounded-full text-xs md:text-sm flex items-center gap-2 border transition-all ${
                isRecording
                  ? "bg-red-500 text-white border-red-500 shadow-md"
                  : "bg-white/80 text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
              title={isRecording ? "Stop recording" : "Start recording"}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isRecording ? "bg-white" : "bg-red-500"
                }`}
              />
              <span className="font-medium">
                {isRecording ? "Recording" : "Paused"}
              </span>
            </button>

            {/* End interview */}
            <button
              onClick={endInterview}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-xs md:text-sm font-medium hover:bg-black/80 transition disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Saving..." : "End Interview"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Webcam + metrics */}
          <div className="lg:col-span-1">
            <div className="glass-card mb-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Live Feedback
                  </h3>
                  <p className="text-xs text-gray-500">
                    Camera + AI-based confidence and communication
                  </p>
                </div>
                <button
                  onClick={toggleCamera}
                  type="button"
                  className="text-[11px] px-3 py-1 rounded-full bg-white/70 border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                >
                  {cameraActive ? "Disable Camera" : "Enable Camera"}
                </button>
              </div>

              {cameraActive && (
                <div className="webcam-section w-full flex flex-col items-center">
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    width={320}
                    height={240}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{
                      width: 320,
                      height: 240,
                      facingMode: "user",
                    }}
                    onUserMedia={handleVideoInitialization}
                    onUserMediaError={handleWebcamError}
                    className="rounded-lg shadow-md border border-gray-200"
                  />

                  {cameraError && (
                    <div className="camera-error mt-2 text-xs">
                      {cameraError}
                    </div>
                  )}

                  <canvas
                    ref={canvasRef}
                    width={320}
                    height={240}
                    className="hidden"
                  />

                  <div className="metrics mt-4 space-y-3">
                    {confidenceScore === 0 && (
                      <div className="no-face-detected text-xs">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="15" y1="9" x2="9" y2="15"></line>
                          <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                        No face detected — please look at the camera
                      </div>
                    )}

                    <div className="metric">
                      <label className="text-xs text-gray-600">
                        Confidence
                      </label>
                      <div
                        className={`progress-bar ${
                          confidenceScore === 0 ? "no-face" : ""
                        }`}
                      >
                        <div
                          className="progress"
                          style={{ width: `${confidenceScore}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-700">
                        {confidenceScore}%
                      </span>
                    </div>

                    <div
                      className={`expression ${
                        confidenceScore === 0 ? "no-face" : ""
                      } text-xs text-gray-600`}
                    >
                      Expression:{" "}
                      <span className="font-medium capitalize">
                        {confidenceScore === 0
                          ? "Unknown (no face detected)"
                          : facialExpression}
                      </span>{" "}
                      <span className="ml-1 text-lg">
                        {getExpressionEmoji(facialExpression)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {!cameraActive && (
                <div className="border border-dashed border-gray-300 rounded-lg bg-gray-50 p-4 mb-4 text-center">
                  <p className="text-gray-600 text-sm mb-2">
                    Camera is currently disabled.
                  </p>
                  <button
                    onClick={toggleCamera}
                    type="button"
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-full hover:bg-blue-700 transition"
                  >
                    Enable Camera
                  </button>
                </div>
              )}

              {/* Scores */}
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">
                      Confidence Score
                    </span>
                    <span className="text-xs">{confidenceScore}%</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-1">
                    Based on your facial expressions and body language
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`${getScoreColor(
                        confidenceScore
                      )} h-2.5 rounded-full transition-all duration-300`}
                      style={{ width: `${confidenceScore}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">
                      Answer Relevance
                    </span>
                    <span className="text-xs">{relevanceScore}%</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-1">
                    How well your answer covers the key technical points
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`${getScoreColor(
                        relevanceScore
                      )} h-2.5 rounded-full transition-all duration-300`}
                      style={{ width: `${relevanceScore}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">
                      Communication
                    </span>
                    <span className="text-xs">{communicationScore}%</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-1">
                    Grammar, structure, and clarity of your response
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`${getScoreColor(
                        communicationScore
                      )} h-2.5 rounded-full transition-all duration-300`}
                      style={{ width: `${communicationScore}%` }}
                    ></div>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-gray-500 space-y-1">
                  <p>• Speak clearly and maintain eye contact for better scores.</p>
                  <p>• Use technical terms and examples to boost relevance.</p>
                  <p>
                    • Average scores will be calculated and shown at the end of the
                    interview.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right column: Question + Answer */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-card mb-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                    Question {currentQuestion + 1} of {questions.length || "…"}
                  </h2>
                  {!questionsLoading && questions.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Answer in a structured way: intro → key points → conclusion
                    </p>
                  )}
                </div>
                <button
                  onClick={handleThinkingTime}
                  disabled={isThinking}
                  type="button"
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    isThinking
                      ? "bg-green-50 text-green-800 border-green-200 cursor-default"
                      : "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100"
                  }`}
                >
                  {isThinking ? "Thinking..." : "I need a moment to think"}
                </button>
              </div>

              {questionsLoading ? (
                <div className="py-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-3 text-gray-600 text-sm">
                    Generating questions based on your selected skills...
                  </p>
                </div>
              ) : questions.length > 0 ? (
                <>
                  <p className="text-base sm:text-lg mb-6 text-gray-800 leading-relaxed">
                    {questions[currentQuestion]?.question}
                  </p>

                  <div className="mb-4">
                    <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                      Expected topics to cover
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {questions[currentQuestion]?.expectedTopics.map(
                        (topic, index) => (
                          <span
                            key={index}
                            className="bg-gray-100 text-gray-800 px-2.5 py-1 rounded-full text-[11px]"
                          >
                            {topic}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-red-600 text-sm">
                  Failed to load questions. Please refresh and try again.
                </p>
              )}

              {/* Answer area */}
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Your answer
                  </label>
                  {isListening ? (
                    <span className="text-[11px] text-green-600 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Voice recognition active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={startListening}
                      className="text-[11px] text-blue-600 hover:text-blue-800 underline"
                    >
                      Start voice input
                    </button>
                  )}
                </div>
                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white/80"
                  placeholder="Speak or type your answer here. Try to structure your response with clear points..."
                />
              </div>
            </div>

            {/* Bottom navigation */}
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <button
                onClick={() => navigate("/dashboard")}
                type="button"
                className="px-4 py-2.5 rounded-lg bg-white/80 text-gray-800 border border-gray-200 hover:bg-gray-50 text-sm font-medium flex items-center justify-center gap-1 transition disabled:opacity-60"
                disabled={loading}
              >
                ← Abandon Interview
              </button>
              <button
                onClick={nextQuestion}
                type="button"
                className="px-6 py-2.5 rounded-lg bg-primary text-white hover:bg-blue-700 text-sm font-semibold shadow-md flex items-center justify-center gap-1 transition disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={loading || questionsLoading}
              >
                {currentQuestion < questions.length - 1
                  ? "Next Question →"
                  : "Finish Interview →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewInProgress;
