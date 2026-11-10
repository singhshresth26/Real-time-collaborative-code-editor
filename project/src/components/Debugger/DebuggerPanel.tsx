import React, { useState } from "react";
import type { Socket } from "socket.io-client";
import {
  Bug,
  CircleDot,
  Plus,
  Trash2,
  Eye,
  Layers,
} from "lucide-react";
import toast from "react-hot-toast";
import ACTIONS from "../Actions";
import type { Breakpoint, FileItem } from "../../types";

interface DebuggerPanelProps {
  socketRef: React.RefObject<Socket | null>;
  roomId: string;
  breakpoints: Breakpoint[];
  activeFile: FileItem | null;
  files: FileItem[];
  onNavigateToLine: (fileId: string, lineNumber: number) => void;
}

interface WatchVariable {
  id: string;
  expression: string;
  value: string;
}

export const DebuggerPanel: React.FC<DebuggerPanelProps> = ({
  socketRef,
  roomId,
  breakpoints,
  activeFile,
  files,
  onNavigateToLine,
}) => {
  const [newBpLine, setNewBpLine] = useState<number>(1);
  const [watchExpressions, setWatchExpressions] = useState<WatchVariable[]>([
    { id: "w1", expression: "result", value: "undefined" },
    { id: "w2", expression: "i", value: "0" },
  ]);
  const [newWatchExp, setNewWatchExp] = useState("");

  const handleToggleBreakpoint = (fileId: string, lineNumber: number) => {
    socketRef.current?.emit(ACTIONS.BREAKPOINT_TOGGLE, {
      roomId,
      fileId,
      lineNumber,
    });
  };

  const handleAddBreakpoint = () => {
    if (!activeFile) {
      toast.error("Please open a file to add a breakpoint");
      return;
    }
    handleToggleBreakpoint(activeFile.id, Number(newBpLine) || 1);
    toast.success(`Breakpoint set at line ${newBpLine}`);
  };

  const handleAddWatch = () => {
    if (!newWatchExp.trim()) return;
    setWatchExpressions((prev) => [
      ...prev,
      {
        id: `w_${Date.now()}`,
        expression: newWatchExp.trim(),
        value: "pending evaluation...",
      },
    ]);
    setNewWatchExp("");
  };

  const handleDeleteWatch = (id: string) => {
    setWatchExpressions((prev) => prev.filter((w) => w.id !== id));
  };

  return (
    <div className="flex flex-col h-full bg-[#121214] border-r border-zinc-800 text-zinc-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800 bg-[#141417]">
        <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-zinc-300 uppercase">
          <Bug className="w-4 h-4 text-zinc-400" />
          <span>Debugger</span>
        </div>
        <span className="text-[11px] font-mono text-zinc-400 bg-[#18181b] border border-zinc-800 px-2 py-0.5 rounded">
          {breakpoints.length} Breakpoints
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Quick Add Breakpoint on Active File */}
        <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">Set Breakpoint</span>
            <span className="text-[11px] font-mono text-sky-400 truncate max-w-[120px]">
              {activeFile ? activeFile.name : "No file open"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={newBpLine}
              onChange={(e) => setNewBpLine(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono"
              placeholder="Line #"
            />
            <button
              disabled={!activeFile}
              onClick={handleAddBreakpoint}
              className="flex-1 flex items-center justify-center gap-1.5 py-1 px-3 rounded bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition disabled:opacity-50 shadow"
            >
              <CircleDot className="w-3.5 h-3.5 text-rose-200" />
              <span>Add Breakpoint</span>
            </button>
          </div>
        </div>

        {/* Breakpoints List */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <CircleDot className="w-3.5 h-3.5 text-rose-400" />
            Synchronized Breakpoints
          </label>
          {breakpoints.length === 0 ? (
            <div className="text-xs text-slate-500 italic p-3 text-center bg-slate-950/40 rounded border border-slate-800">
              No breakpoints set. Click line numbers or use the form above.
            </div>
          ) : (
            <div className="space-y-1.5">
              {breakpoints.map((bp) => {
                const targetFile = files.find((f) => f.id === bp.fileId);

                return (
                  <div
                    key={`${bp.fileId}_${bp.lineNumber}`}
                    className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800 text-xs"
                  >
                    <button
                      onClick={() => onNavigateToLine(bp.fileId, bp.lineNumber)}
                      className="flex items-center gap-2 text-slate-300 hover:text-sky-400 font-mono"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm" />
                      <span className="truncate max-w-[110px]">{targetFile?.name || "File"}</span>
                      <span className="text-amber-400 font-semibold">:L{bp.lineNumber}</span>
                    </button>

                    <button
                      onClick={() => handleToggleBreakpoint(bp.fileId, bp.lineNumber)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition"
                      title="Remove breakpoint"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Watch Expressions */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Eye className="w-3.5 h-3.5 text-sky-400" />
            Watch Expressions
          </label>
          <div className="space-y-1.5 mb-2">
            {watchExpressions.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800 text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sky-300 font-semibold">{w.expression}:</span>
                  <span className="text-slate-400">{w.value}</span>
                </div>
                <button
                  onClick={() => handleDeleteWatch(w.id)}
                  className="p-1 text-slate-500 hover:text-rose-400 transition"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Watch variable / expression..."
              value={newWatchExp}
              onChange={(e) => setNewWatchExp(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddWatch();
              }}
              className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            <button
              onClick={handleAddWatch}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Execution Call Stack / State Notes */}
        <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 space-y-1.5 text-xs">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            Call Stack / Execution Info
          </span>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Breakpoints are synchronized across all participants in this room. Triggering execution will pause and highlight at the active breakpoint lines.
          </p>
        </div>
      </div>
    </div>
  );
};
