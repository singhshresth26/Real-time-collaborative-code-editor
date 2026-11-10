import React from "react";
import { Code2, FilePlus, FolderTree } from "lucide-react";

interface EmptyEditorProps {
  onNewFileClick: () => void;
}

export const EmptyEditor: React.FC<EmptyEditorProps> = ({ onNewFileClick }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#0c0c0e] text-zinc-400 select-none p-6">
      <div className="max-w-md w-full flex flex-col items-center text-center space-y-6">
        <div className="w-12 h-12 rounded-xl bg-[#141417] border border-zinc-800 flex items-center justify-center text-zinc-400 shadow-sm">
          <Code2 className="w-6 h-6" />
        </div>

        <div>
          <h2 className="text-base font-medium text-zinc-200">
            No Active Document
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Select a file from the explorer or create a new file to start coding together.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onNewFileClick}
            className="flex items-center justify-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 font-medium text-xs rounded-md border border-zinc-700 shadow-xs transition"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>Create File</span>
          </button>
        </div>

        <div className="pt-5 border-t border-zinc-850 text-xs text-zinc-500 flex flex-col gap-2 w-full max-w-xs text-left">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <FolderTree className="w-3 h-3 text-zinc-500" />
              File Tree
            </span>
            <span className="font-mono text-zinc-500 bg-[#161619] border border-zinc-800 px-1.5 py-0.5 rounded">
              Explorer
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">Run Active File</span>
            <span className="font-mono text-zinc-500 bg-[#161619] border border-zinc-800 px-1.5 py-0.5 rounded">
              Ctrl + Enter
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">Toggle Terminal</span>
            <span className="font-mono text-zinc-500 bg-[#161619] border border-zinc-800 px-1.5 py-0.5 rounded">
              Bottom Dock
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

