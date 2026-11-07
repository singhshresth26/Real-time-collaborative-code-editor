import React from "react";
import { X, Plus, Play, Loader2, Terminal as TerminalIcon } from "lucide-react";
import type { FileItem, ClientType } from "../../types";
import { getFileIcon } from "../../utils/fileIcons";

interface TabBarProps {
  openTabIds: string[];
  activeFileId: string | null;
  files: FileItem[];
  onSelectTab: (fileId: string) => void;
  onCloseTab: (fileId: string) => void;
  onNewFileClick: () => void;
  users: ClientType[];
  onRunCode?: () => void;
  isRunning?: boolean;
  activeFileLanguage?: string;
  isTerminalOpen?: boolean;
  onToggleTerminal?: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  openTabIds,
  activeFileId,
  files,
  onSelectTab,
  onCloseTab,
  onNewFileClick,
  users,
  onRunCode,
  isRunning = false,
  activeFileLanguage,
  isTerminalOpen = false,
  onToggleTerminal,
}) => {
  return (
    <div className="flex items-center justify-between bg-slate-950/80 border-b border-slate-800 select-none h-9 text-xs shrink-0 overflow-hidden">
      {/* Scrollable Tabs List */}
      <div className="flex items-center h-full overflow-x-auto no-scrollbar flex-1">
        {openTabIds.map((fileId) => {
          const file = files.find((f) => f.id === fileId);
          if (!file) return null;

          const isActive = activeFileId === fileId;

          // Collaborators on this file
          const activeCollaborators = users.filter((u) => u.activeFileId === fileId);

          return (
            <div
              key={file.id}
              onClick={() => onSelectTab(file.id)}
              onAuxClick={(e) => {
                // Middle click closes tab
                if (e.button === 1) {
                  e.preventDefault();
                  onCloseTab(file.id);
                }
              }}
              className={`group flex items-center h-full px-3 gap-2 cursor-pointer transition-colors border-r border-slate-800/80 shrink-0 max-w-[200px] relative ${
                isActive
                  ? "bg-slate-800 text-white font-medium border-t-2 border-t-sky-400"
                  : "bg-slate-900/60 text-slate-400 hover:bg-slate-850 hover:text-slate-200"
              }`}
            >
              {/* File Icon */}
              <span className="shrink-0">
                {getFileIcon({ filename: file.name })}
              </span>

              {/* File Name */}
              <span className="truncate" title={file.name}>
                {file.name}
              </span>

              {/* Other users viewing indicator */}
              {activeCollaborators.length > 0 && (
                <div className="flex items-center -space-x-1 shrink-0">
                  {activeCollaborators.map((user) => (
                    <span
                      key={user.socketId}
                      title={`${user.username} is viewing this file`}
                      className="w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-slate-900"
                    />
                  ))}
                </div>
              )}

              {/* Close Button */}
              <button
                type="button"
                title="Close"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(file.id);
                }}
                className={`p-0.5 rounded-sm hover:bg-slate-700/80 hover:text-white transition shrink-0 ${
                  isActive ? "text-slate-300" : "text-slate-500 opacity-60 group-hover:opacity-100"
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {/* New File button on tab bar */}
        <button
          type="button"
          title="New File"
          onClick={onNewFileClick}
          className="p-1.5 ml-1 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded transition shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right Actions: Run Code & Toggle Terminal */}
      <div className="flex items-center gap-1.5 px-2 shrink-0 bg-slate-950">
        {/* Toggle Terminal Button */}
        {onToggleTerminal && (
          <button
            type="button"
            title={isTerminalOpen ? "Hide Terminal" : "Show Terminal"}
            onClick={onToggleTerminal}
            className={`p-1.5 rounded transition flex items-center gap-1 text-xs ${
              isTerminalOpen
                ? "bg-slate-800 text-sky-400 border border-slate-700"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Run Button */}
        {onRunCode && activeFileId && (
          <button
            type="button"
            title="Run Code (Ctrl + Enter)"
            onClick={onRunCode}
            disabled={isRunning}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold shadow-sm transition ${
              isRunning
                ? "bg-amber-600/80 text-amber-100 cursor-not-allowed animate-pulse"
                : "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95"
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run {activeFileLanguage ? `(${activeFileLanguage})` : ""}</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
