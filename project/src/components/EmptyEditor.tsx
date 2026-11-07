import React from "react";
import { Code2, FilePlus, FolderTree } from "lucide-react";

interface EmptyEditorProps {
  onNewFileClick: () => void;
}

export const EmptyEditor: React.FC<EmptyEditorProps> = ({ onNewFileClick }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-900/95 text-slate-400 select-none p-6">
      <div className="max-w-md w-full flex flex-col items-center text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-inner">
          <Code2 className="w-9 h-9" />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-slate-200">
            No Open Files
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Select a file from the explorer on the left or create a new file to start coding.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onNewFileClick}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium text-xs rounded-md shadow-sm transition"
          >
            <FilePlus className="w-4 h-4" />
            <span>Create New File</span>
          </button>
        </div>

        <div className="pt-6 border-t border-slate-800 text-xs text-slate-500 flex flex-col gap-2 w-full max-w-xs text-left">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5 text-slate-400" />
              Browse files & folders
            </span>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
              Sidebar
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Multiple Editor Tabs</span>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
              Top Bar
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Real-time Multi-user Sync</span>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800 px-1.5 py-0.5 rounded">
              Socket.IO
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

