import React, { useRef, useEffect } from "react";
import {
  Terminal as TerminalIcon,
  Play,
  Square,
  Trash2,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Loader2,
} from "lucide-react";
import type { ExecutionResult, ExecutionStatus } from "../../types";

interface TerminalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  height: number;
  setHeight: (height: number) => void;
  isMaximized: boolean;
  setIsMaximized: React.Dispatch<React.SetStateAction<boolean>>;
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  result: ExecutionResult | null;
  status: ExecutionStatus;
  stdin: string;
  setStdin: (val: string) => void;
  onClear: () => void;
  onStop: () => void;
  onRun?: () => void;
  activeFileName?: string;
  activeLanguage?: string;
  terminalTab: "output" | "input";
  setTerminalTab: (tab: "output" | "input") => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  isOpen,
  onClose,
  height,
  setHeight,
  isMaximized,
  setIsMaximized,
  isCollapsed,
  setIsCollapsed,
  result,
  status,
  stdin,
  setStdin,
  onClear,
  onStop,
  onRun,
  activeFileName,
  activeLanguage,
  terminalTab,
  setTerminalTab,
}) => {
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const startHeight = useRef(height);
  const outputContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll output container on new result
  useEffect(() => {
    if (outputContainerRef.current) {
      outputContainerRef.current.scrollTop = outputContainerRef.current.scrollHeight;
    }
  }, [result, status]);

  // Handle resizing via drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaY = dragStartY.current - e.clientY;
      const newHeight = Math.max(120, Math.min(window.innerHeight * 0.85, startHeight.current + deltaY));
      setHeight(newHeight);
      if (isCollapsed) setIsCollapsed(false);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [setHeight, isCollapsed, setIsCollapsed]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartY.current = e.clientY;
    startHeight.current = height;
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  };

  if (!isOpen) return null;

  const currentHeight = isCollapsed ? 34 : isMaximized ? "75vh" : `${height}px`;

  return (
    <div
      style={{ height: currentHeight }}
      className="flex flex-col w-full bg-[#0e0e11] border-t border-zinc-800/80 transition-[height] duration-75 relative z-20 shrink-0 select-none shadow-2xl"
    >
      {/* Drag handle */}
      {!isCollapsed && !isMaximized && (
        <div
          onMouseDown={handleDragStart}
          className="w-full h-1.5 absolute -top-1 left-0 cursor-ns-resize hover:bg-zinc-600 transition z-30"
          title="Drag to resize terminal"
        />
      )}

      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 h-8 bg-[#121214] border-b border-zinc-800/80 shrink-0 text-xs text-zinc-300">
        {/* Left: Title & Tabs */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium text-zinc-200">
            <TerminalIcon className="w-3.5 h-3.5 text-zinc-400" />
            <span className="uppercase text-[11px] tracking-wider text-zinc-400">Terminal</span>
          </div>

          {/* Sub-tabs: Output & Input */}
          <div className="flex items-center bg-[#18181b] rounded p-0.5 border border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setTerminalTab("output");
                if (isCollapsed) setIsCollapsed(false);
              }}
              className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${
                terminalTab === "output"
                  ? "bg-zinc-800 text-zinc-100 shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Output
            </button>
            <button
              type="button"
              onClick={() => {
                setTerminalTab("input");
                if (isCollapsed) setIsCollapsed(false);
              }}
              className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition flex items-center gap-1.5 ${
                terminalTab === "input"
                  ? "bg-zinc-800 text-zinc-100 shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span>Custom Input</span>
              {stdin.trim() && (
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 inline-block" />
              )}
            </button>
          </div>

          {/* Status Badge */}
          <div className="hidden sm:flex items-center gap-1.5">
            {status === "running" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-amber-300 border border-amber-500/20 animate-pulse">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                Running...
              </span>
            )}
            {status === "completed" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/30 text-emerald-400 border border-emerald-800/30">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Completed
              </span>
            )}
            {status === "failed" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-rose-950/30 text-rose-300 border border-rose-800/30">
                <AlertCircle className="w-2.5 h-2.5" />
                Failed (Exit {result?.exitCode ?? 1})
              </span>
            )}
            {status === "timeout" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-orange-950/30 text-orange-300 border border-orange-800/30">
                <Clock className="w-2.5 h-2.5" />
                Timed Out (8s limit)
              </span>
            )}
            {status === "stopped" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                <Square className="w-2.5 h-2.5" />
                Stopped
              </span>
            )}
            {status === "idle" && !result && (
              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                <HelpCircle className="w-3 h-3" />
                Ready to run
              </span>
            )}
          </div>
        </div>

        {/* Right: Timing / Memory & Actions */}
        <div className="flex items-center gap-2">
          {/* Execution Time */}
          {result && result.executionTimeMs > 0 && (
            <div className="hidden md:flex items-center gap-1 text-[10px] text-zinc-400 font-mono bg-[#18181b] px-2 py-0.5 rounded border border-zinc-800">
              <Clock className="w-3 h-3 text-zinc-400" />
              <span>{result.executionTimeMs} ms</span>
            </div>
          )}

          {/* Run button shortcut if idle */}
          {status !== "running" && onRun && (
            <button
              type="button"
              title="Run Code (Ctrl+Enter)"
              onClick={onRun}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs"
            >
              <Play className="w-3 h-3 fill-current" />
              <span className="hidden sm:inline">Run</span>
            </button>
          )}

          {/* Stop Button */}
          {status === "running" && (
            <button
              type="button"
              title="Stop Execution"
              onClick={onStop}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-600 hover:bg-rose-500 text-white transition"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop</span>
            </button>
          )}

          {/* Clear Terminal */}
          <button
            type="button"
            title="Clear Terminal"
            onClick={onClear}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Maximize / Restore */}
          <button
            type="button"
            title={isMaximized ? "Restore Height" : "Maximize Terminal"}
            onClick={() => {
              setIsMaximized((prev) => !prev);
              if (isCollapsed) setIsCollapsed(false);
            }}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition"
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Collapse / Expand Toggle */}
          <button
            type="button"
            title={isCollapsed ? "Expand Terminal" : "Collapse Terminal"}
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition"
          >
            {isCollapsed ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Close Panel */}
          <button
            type="button"
            title="Close Terminal Panel"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Content (Hidden if collapsed) */}
      {!isCollapsed && (
        <div className="flex-1 overflow-hidden relative flex flex-col bg-[#0c0c0e] font-mono text-xs select-text">
          {terminalTab === "output" ? (
            <div
              ref={outputContainerRef}
              className="flex-1 p-3 overflow-y-auto space-y-2 select-text custom-scrollbar leading-relaxed"
            >
              {/* Program Output Banner */}
              {activeFileName && (
                <div className="text-[11px] text-zinc-500 pb-1 border-b border-zinc-800/60 flex items-center justify-between">
                  <span>
                    Executing: <span className="text-zinc-300">{activeFileName}</span>{" "}
                    ({activeLanguage})
                  </span>
                  <span>{new Date().toLocaleTimeString()}</span>
                </div>
              )}

              {/* Compilation Errors */}
              {result?.compileOutput && (
                <div className="p-2.5 rounded bg-[#1c1214] border border-rose-900/40 text-rose-300 font-mono text-xs whitespace-pre-wrap">
                  <div className="text-rose-400 font-semibold mb-1 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Compilation Error:
                  </div>
                  {result.compileOutput}
                </div>
              )}

              {/* Standard Output */}
              {result?.output && (
                <div className="text-zinc-100 whitespace-pre-wrap font-mono">
                  {result.output}
                </div>
              )}

              {/* Runtime Errors */}
              {result?.error && (
                <div className="p-2.5 rounded bg-[#1c1214] border border-rose-900/40 text-rose-300 font-mono text-xs whitespace-pre-wrap">
                  <div className="text-rose-400 font-semibold mb-1 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Runtime Error:
                  </div>
                  {result.error}
                </div>
              )}

              {/* Execution Summary Footer */}
              {result && (
                <div className="pt-2 text-[11px] text-zinc-500 border-t border-zinc-800/60 flex items-center gap-4">
                  <span className={result.success ? "text-emerald-400" : "text-rose-400"}>
                    Process finished with exit code {result.exitCode}
                  </span>
                  {result.executionTimeMs > 0 && (
                    <span>Time: {result.executionTimeMs}ms</span>
                  )}
                </div>
              )}

              {/* Empty / Initial State */}
              {!result && status === "idle" && (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center py-6">
                  <TerminalIcon className="w-8 h-8 text-zinc-700 mb-2" />
                  <p className="text-xs">No execution output yet.</p>
                  <p className="text-[11px] text-zinc-600 mt-1">
                    Click <span className="text-emerald-400 font-medium">Run</span> or press{" "}
                    <kbd className="px-1.5 py-0.5 bg-zinc-900 rounded border border-zinc-800 text-zinc-400 font-mono text-[10px]">
                      Ctrl + Enter
                    </kbd>{" "}
                    to compile & execute.
                  </p>
                </div>
              )}

              {/* Running Spinner in Terminal */}
              {status === "running" && (
                <div className="flex items-center gap-2 text-zinc-400 text-xs py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Compiling and executing code in sandboxed container...</span>
                </div>
              )}
            </div>
          ) : (
            /* Custom Input Tab (stdin) */
            <div className="flex-1 flex flex-col p-3 bg-[#0c0c0e]">
              <div className="text-[11px] text-zinc-400 mb-1 flex items-center justify-between">
                <span>Standard Input (stdin):</span>
                <span className="text-[10px] text-zinc-500">
                  Passed to cin / Scanner / sys.stdin
                </span>
              </div>
              <textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="Type input data here (e.g. 5&#10;10 20 30 40 50)..."
                className="flex-1 w-full p-2.5 bg-[#141416] text-zinc-200 border border-zinc-800 rounded font-mono text-xs outline-none focus:border-zinc-600 resize-none leading-relaxed"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

