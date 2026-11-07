import React, { useState } from "react";
import {
  History,
  Plus,
  RotateCcw,
  GitCommit,
  Clock,
  User,
  FileCode,
  FileDiff,
} from "lucide-react";
import * as Diff from "diff";
import type { VersionSnapshot, FileItem } from "../../types";

interface VersionHistoryPanelProps {
  snapshots: VersionSnapshot[];
  currentFiles: FileItem[];
  activeFileId: string | null;
  onCreateSnapshot: (label: string) => void;
  onRestoreSnapshot: (snapshotId: string, fileId?: string) => void;
  currentUsername: string;
}

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  snapshots,
  currentFiles,
  activeFileId,
  onCreateSnapshot,
  onRestoreSnapshot,
}) => {
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(
    snapshots.length > 0 ? snapshots[snapshots.length - 1]?.id || null : null
  );
  const [isCreating, setIsCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [showDiff, setShowDiff] = useState(false);

  const activeFile = currentFiles.find((f) => f.id === activeFileId);
  const selectedSnapshot = snapshots.find((s) => s.id === selectedSnapshotId);

  // Compare active file between current version and selected snapshot
  const snapshotFile = selectedSnapshot?.files.find((f) => f.id === activeFileId);
  const currentContent = activeFile?.content || "";
  const snapshotContent = snapshotFile?.content || "";

  // Compute diff lines using jsdiff
  const diffParts = Diff.diffLines(snapshotContent, currentContent);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    onCreateSnapshot(newLabel.trim());
    setNewLabel("");
    setIsCreating(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-white select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-300 uppercase">
          <History className="w-4 h-4 text-sky-400" />
          <span>Snapshots ({snapshots.length})</span>
        </div>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1 text-[11px] bg-sky-500 hover:bg-sky-400 text-slate-950 px-2 py-0.5 rounded font-medium transition cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Checkpoint</span>
        </button>
      </div>

      {/* Inline Create Snapshot Form */}
      {isCreating && (
        <form onSubmit={handleCreateSubmit} className="p-2.5 bg-slate-950/80 border-b border-slate-800">
          <label className="block text-[11px] text-slate-400 mb-1 font-medium">
            Checkpoint Description:
          </label>
          <input
            type="text"
            autoFocus
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Added login button logic..."
            className="w-full p-1.5 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded outline-none focus:border-sky-500 mb-2"
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newLabel.trim()}
              className="px-2.5 py-0.5 rounded text-[11px] bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium disabled:opacity-50"
            >
              Save Snapshot
            </button>
          </div>
        </form>
      )}

      {/* Snapshot List & Diff Mode Selector */}
      <div className="flex border-b border-slate-800 text-xs">
        <button
          type="button"
          onClick={() => setShowDiff(false)}
          className={`flex-1 py-1.5 text-center font-medium border-b-2 transition ${
            !showDiff
              ? "border-sky-400 text-sky-300 bg-slate-850/50"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          History Timeline
        </button>
        <button
          type="button"
          onClick={() => setShowDiff(true)}
          className={`flex-1 py-1.5 text-center font-medium border-b-2 transition flex items-center justify-center gap-1 ${
            showDiff
              ? "border-sky-400 text-sky-300 bg-slate-850/50"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileDiff className="w-3.5 h-3.5" />
          <span>Diff Viewer</span>
        </button>
      </div>

      {/* Content Area */}
      {!showDiff ? (
        /* Timeline View */
        <div className="flex-1 p-2.5 overflow-y-auto space-y-2 custom-scrollbar">
          {snapshots.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No snapshots created yet.
            </div>
          ) : (
            [...snapshots].reverse().map((snap) => {
              const isSelected = snap.id === selectedSnapshotId;

              return (
                <div
                  key={snap.id}
                  onClick={() => setSelectedSnapshotId(snap.id)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition ${
                    isSelected
                      ? "bg-slate-800 border-sky-500 shadow-sm"
                      : "bg-slate-900/60 border-slate-800 hover:bg-slate-850 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-1">
                    <span className="flex items-center gap-1.5 truncate">
                      <GitCommit className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="truncate" title={snap.label}>
                        {snap.label}
                      </span>
                    </span>
                    {isSelected && (
                      <span className="text-[10px] text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded font-normal">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-500" />
                      {snap.author}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(snap.createdAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Restore Options on Selection */}
                  {isSelected && (
                    <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center gap-2">
                      {activeFile && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRestoreSnapshot(snap.id, activeFile.id);
                          }}
                          className="flex-1 flex items-center justify-center gap-1 text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-200 py-1 rounded transition"
                        >
                          <FileCode className="w-3 h-3 text-sky-400" />
                          <span>Restore File</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRestoreSnapshot(snap.id);
                        }}
                        className="flex-1 flex items-center justify-center gap-1 text-[10px] bg-red-600/80 hover:bg-red-600 text-white py-1 rounded transition"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore Project</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Diff Viewer View */
        <div className="flex-1 p-2.5 overflow-y-auto flex flex-col custom-scrollbar">
          <div className="mb-2 text-[11px] text-slate-400 flex items-center justify-between pb-1 border-b border-slate-800">
            <span>
              Comparing: <span className="text-slate-200 font-mono">{activeFile?.name || "None"}</span>
            </span>
            <span className="text-[10px] text-slate-500">
              Snapshot vs Current
            </span>
          </div>

          <div className="flex-1 bg-slate-950 rounded-md p-2 font-mono text-[11px] overflow-auto select-text leading-relaxed border border-slate-800/80">
            {diffParts.length === 0 ? (
              <div className="text-slate-500 text-center py-6 text-xs">
                No differences detected between versions.
              </div>
            ) : (
              diffParts.map((part, index) => {
                const color = part.added
                  ? "bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500"
                  : part.removed
                  ? "bg-red-950/40 text-red-300 border-l-2 border-red-500 line-through opacity-75"
                  : "text-slate-400";

                return (
                  <div key={index} className={`px-1 py-0.5 whitespace-pre-wrap ${color}`}>
                    {part.added ? "+ " : part.removed ? "- " : "  "}
                    {part.value}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
