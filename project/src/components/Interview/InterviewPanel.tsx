import React, { useState, useEffect } from "react";
import type { Socket } from "socket.io-client";
import {
  Briefcase,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Clock,
  Award,
  FileCheck,
  EyeOff,
} from "lucide-react";
import toast from "react-hot-toast";
import ACTIONS from "../Actions";
import { getBackendUrl } from "../../socket";
import { getLanguageLabel } from "../../utils/language";
import type { InterviewSession, InterviewTestCase, FileItem } from "../../types";

interface InterviewPanelProps {
  socketRef: React.RefObject<Socket | null>;
  roomId: string;
  username: string;
  interviewSession?: InterviewSession | undefined;
  activeFile: FileItem | null;
  isOwner: boolean;
}

interface TestRunResult {
  testIndex: number;
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  error?: string | undefined;
}

export const InterviewPanel: React.FC<InterviewPanelProps> = ({
  socketRef,
  roomId,
  username,
  interviewSession,
  activeFile,
  isOwner,
}) => {
  const [session, setSession] = useState<InterviewSession>(
    interviewSession || {
      isActive: false,
      title: "Coding Technical Interview",
      description: "Implement a function to solve the problem described below. All test cases must pass.",
      durationMinutes: 45,
      remainingSeconds: 45 * 60,
      testCases: [
        { input: "5\n1 2 3 4 5", expectedOutput: "15", isHidden: false },
        { input: "3\n10 20 30", expectedOutput: "60", isHidden: true },
      ],
      candidateScore: 0,
      status: "pending",
    }
  );

  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<TestRunResult[]>([]);
  const [newTestInput, setNewTestInput] = useState("");
  const [newTestOutput, setNewTestOutput] = useState("");
  const [newTestHidden, setNewTestHidden] = useState(false);

  // Sync incoming interview session updates
  useEffect(() => {
    if (interviewSession) {
      setSession(interviewSession);
    }
  }, [interviewSession]);

  // Countdown timer when session is in-progress
  useEffect(() => {
    if (session.status !== "in-progress" || !session.remainingSeconds) return;

    const timer = setInterval(() => {
      setSession((prev) => {
        if (!prev.remainingSeconds || prev.remainingSeconds <= 1) {
          clearInterval(timer);
          toast("Interview time has expired!", { icon: "⏰" });
          return { ...prev, remainingSeconds: 0, status: "completed" };
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [session.status, session.remainingSeconds]);

  // Broadcast session changes
  const updateSession = (updated: InterviewSession) => {
    setSession(updated);
    socketRef.current?.emit(ACTIONS.INTERVIEW_UPDATE, {
      roomId,
      session: updated,
    });
  };

  const handleStartTimer = () => {
    updateSession({
      ...session,
      status: "in-progress",
      isActive: true,
      startedAt: new Date().toISOString(),
      remainingSeconds: session.remainingSeconds ?? session.durationMinutes * 60,
    });
    toast.success("Interview timer started");
  };

  const handlePauseTimer = () => {
    updateSession({
      ...session,
      status: "pending",
    });
    toast("Interview timer paused", { icon: "⏸️" });
  };

  const handleResetTimer = () => {
    updateSession({
      ...session,
      status: "pending",
      remainingSeconds: session.durationMinutes * 60,
      candidateScore: 0,
    });
    setTestResults([]);
    toast.success("Interview reset");
  };

  // Add new test case
  const handleAddTestCase = () => {
    if (!newTestInput.trim() || !newTestOutput.trim()) {
      toast.error("Please provide both input and expected output");
      return;
    }

    const updatedCases: InterviewTestCase[] = [
      ...session.testCases,
      {
        input: newTestInput.trim(),
        expectedOutput: newTestOutput.trim(),
        isHidden: newTestHidden,
      },
    ];

    updateSession({ ...session, testCases: updatedCases });
    setNewTestInput("");
    setNewTestOutput("");
    setNewTestHidden(false);
    toast.success("Test case added");
  };

  const handleDeleteTestCase = (index: number) => {
    const updatedCases = session.testCases.filter((_, i) => i !== index);
    updateSession({ ...session, testCases: updatedCases });
  };

  // Execute candidate's active code against test cases
  const handleRunAllTests = async () => {
    if (!activeFile) {
      toast.error("No active code file open to evaluate");
      return;
    }
    if (session.testCases.length === 0) {
      toast.error("No test cases defined for this interview");
      return;
    }

    setIsRunningTests(true);
    setTestResults([]);
    const results: TestRunResult[] = [];
    const backendUrl = getBackendUrl();
    const lang = getLanguageLabel(activeFile.name);

    for (let i = 0; i < session.testCases.length; i++) {
      const tc = session.testCases[i];
      try {
        const primaryUrl = backendUrl ? `${backendUrl}/api/execute` : "/api/execute";
        const bodyPayload = JSON.stringify({
          language: lang,
          filename: activeFile.name,
          code: activeFile.content || "",
          stdin: tc.input,
        });

        let res: Response;
        try {
          res = await fetch(primaryUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: bodyPayload,
          });
        } catch (directErr: any) {
          if (primaryUrl !== "/api/execute") {
            res = await fetch("/api/execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: bodyPayload,
            });
          } else {
            throw directErr;
          }
        }

        const data = await res.json();
        const actualTrimmed = (data.output || "").trim();
        const expectedTrimmed = tc.expectedOutput.trim();
        const passed = data.success && actualTrimmed === expectedTrimmed;

        results.push({
          testIndex: i + 1,
          passed,
          input: tc.input,
          expected: tc.expectedOutput,
          actual: actualTrimmed,
          error: data.error || data.compileOutput,
        });
      } catch (err: any) {
        results.push({
          testIndex: i + 1,
          passed: false,
          input: tc.input,
          expected: tc.expectedOutput,
          actual: "",
          error: err.message,
        });
      }
    }

    setTestResults(results);
    const passedCount = results.filter((r) => r.passed).length;
    const scorePct = Math.round((passedCount / session.testCases.length) * 100);

    const updatedSession = { ...session, candidateScore: scorePct };
    updateSession(updatedSession);
    setIsRunningTests(false);

    if (scorePct === 100) {
      toast.success(`All ${session.testCases.length} test cases passed! (100%)`, { icon: "🎉" });
    } else {
      toast(`Passed ${passedCount} / ${session.testCases.length} test cases (${scorePct}%)`);
    }
  };

  const formatTimer = (seconds?: number) => {
    const s = seconds ?? 0;
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-sky-400 uppercase">
          <Briefcase className="w-4 h-4 text-sky-400" />
          <span>Interview Mode</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>{formatTimer(session.remainingSeconds)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Timer Controls Bar */}
        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
          <div className="text-xs">
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Status</span>
            <span
              className={`font-semibold capitalize ${
                session.status === "in-progress"
                  ? "text-emerald-400"
                  : session.status === "completed"
                  ? "text-rose-400"
                  : "text-amber-400"
              }`}
            >
              {session.status}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {session.status === "in-progress" ? (
              <button
                onClick={handlePauseTimer}
                className="p-1.5 rounded bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 transition"
                title="Pause Timer"
              >
                <Pause className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleStartTimer}
                className="p-1.5 rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 transition"
                title="Start Timer"
              >
                <Play className="w-4 h-4" />
              </button>
            )}

            {isOwner && (
              <button
                onClick={handleResetTimer}
                className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white transition"
                title="Reset Interview Timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Problem Statement */}
        <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <label className="font-semibold text-slate-400 uppercase tracking-wider block">
              Problem Description
            </label>
            <span className="text-slate-500 font-mono">
              Candidate: <strong className="text-sky-400">{username}</strong>
            </span>
          </div>
          <div className="text-xs font-semibold text-slate-200">{session.title}</div>
          <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">
            {session.description}
          </p>
        </div>

        {/* Score Banner */}
        {session.candidateScore !== undefined && session.candidateScore > 0 && (
          <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="font-semibold text-emerald-300">Candidate Score</span>
                <span className="text-[10px] text-emerald-400/80 block">Automated Evaluation</span>
              </div>
            </div>
            <span className="font-mono text-base font-bold text-emerald-400">
              {session.candidateScore}%
            </span>
          </div>
        )}

        {/* Test Cases Runner Button */}
        <div>
          <button
            disabled={isRunningTests || !activeFile}
            onClick={handleRunAllTests}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition disabled:opacity-50 shadow"
          >
            <FileCheck className="w-4 h-4" />
            <span>{isRunningTests ? "Evaluating Test Cases..." : "Run Against All Test Cases"}</span>
          </button>
        </div>

        {/* Test Cases & Results */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Test Cases ({session.testCases.length})
          </label>

          <div className="space-y-2">
            {session.testCases.map((tc, idx) => {
              const res = testResults.find((r) => r.testIndex === idx + 1);

              return (
                <div
                  key={idx}
                  className="p-2.5 rounded bg-slate-950/60 border border-slate-800 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-300 flex items-center gap-1.5">
                      <span>Test Case #{idx + 1}</span>
                      {tc.isHidden && (
                        <span className="flex items-center gap-0.5 text-[10px] text-amber-400 bg-amber-500/10 px-1 rounded">
                          <EyeOff className="w-3 h-3" /> Hidden
                        </span>
                      )}
                    </span>

                    <div className="flex items-center gap-2">
                      {res && (
                        <span
                          className={`flex items-center gap-1 text-[11px] font-semibold ${
                            res.passed ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {res.passed ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" /> Passed
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5" /> Failed
                            </>
                          )}
                        </span>
                      )}

                      {isOwner && (
                        <button
                          onClick={() => handleDeleteTestCase(idx)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition"
                          title="Delete test case"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Input / Expected Output */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Input:</span>
                      <pre className="text-slate-300 truncate">{tc.input}</pre>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Expected:</span>
                      <pre className="text-slate-300 truncate">{tc.expectedOutput}</pre>
                    </div>
                  </div>

                  {/* Actual Output if evaluated */}
                  {res && !res.passed && (
                    <div className="p-1.5 rounded bg-rose-950/30 border border-rose-500/30 text-[11px] font-mono text-rose-300">
                      <span className="text-rose-400/80 block text-[10px]">Actual Output:</span>
                      <pre className="whitespace-pre-wrap">{res.actual || res.error || "No output"}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Add Test Case Form (For Interviewer/Owner) */}
        {isOwner && (
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-sky-400" />
              Add Test Case
            </span>
            <input
              type="text"
              placeholder="Standard input (stdin)..."
              value={newTestInput}
              onChange={(e) => setNewTestInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono"
            />
            <input
              type="text"
              placeholder="Expected stdout output..."
              value={newTestOutput}
              onChange={(e) => setNewTestOutput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono"
            />
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTestHidden}
                  onChange={(e) => setNewTestHidden(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700"
                />
                <span>Hidden from Candidate</span>
              </label>
              <button
                onClick={handleAddTestCase}
                className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium text-xs shadow"
              >
                Add Case
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
