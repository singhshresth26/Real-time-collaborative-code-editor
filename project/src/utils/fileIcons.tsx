import React from "react";
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  Hash,
  Terminal,
  Settings,
  Database,
  File,
} from "lucide-react";

interface FileIconProps {
  filename: string;
  isFolder?: boolean;
  isOpen?: boolean;
  className?: string;
}

export const getFileIcon = ({
  filename,
  isFolder = false,
  isOpen = false,
  className = "w-4 h-4 shrink-0",
}: FileIconProps): React.ReactNode => {
  if (isFolder) {
    if (isOpen) {
      return <FolderOpen className={`${className} text-sky-400`} />;
    }
    return <Folder className={`${className} text-sky-400`} />;
  }

  const lowerName = filename.toLowerCase();
  const ext = lowerName.split(".").pop() || "";

  // Exact file name matches
  if (lowerName === ".gitignore" || lowerName.startsWith(".git")) {
    return <Terminal className={`${className} text-orange-500`} />;
  }
  if (lowerName.startsWith(".env")) {
    return <Settings className={`${className} text-yellow-500`} />;
  }
  if (lowerName === "package.json") {
    return <FileJson className={`${className} text-emerald-400`} />;
  }
  if (lowerName === "tsconfig.json") {
    return <FileCode className={`${className} text-blue-400`} />;
  }

  // Extension matches
  switch (ext) {
    case "js":
    case "mjs":
    case "cjs":
      return (
        <span
          className={`${className} flex items-center justify-center font-bold text-[10px] text-yellow-400 bg-yellow-400/20 rounded-xs px-0.5 leading-none`}
        >
          JS
        </span>
      );
    case "ts":
      return (
        <span
          className={`${className} flex items-center justify-center font-bold text-[10px] text-blue-400 bg-blue-400/20 rounded-xs px-0.5 leading-none`}
        >
          TS
        </span>
      );
    case "jsx":
      return (
        <span
          className={`${className} flex items-center justify-center font-bold text-[9px] text-cyan-400 bg-cyan-400/20 rounded-xs px-0.5 leading-none`}
        >
          JSX
        </span>
      );
    case "tsx":
      return (
        <span
          className={`${className} flex items-center justify-center font-bold text-[9px] text-indigo-400 bg-indigo-400/20 rounded-xs px-0.5 leading-none`}
        >
          TSX
        </span>
      );
    case "html":
    case "htm":
      return <FileCode className={`${className} text-orange-500`} />;
    case "css":
    case "scss":
    case "sass":
    case "less":
      return <Hash className={`${className} text-blue-400`} />;
    case "json":
      return <FileJson className={`${className} text-amber-300`} />;
    case "md":
    case "markdown":
      return <FileText className={`${className} text-sky-300`} />;
    case "py":
    case "python":
      return (
        <span
          className={`${className} flex items-center justify-center font-bold text-[10px] text-emerald-400 bg-emerald-400/20 rounded-xs px-0.5 leading-none`}
        >
          PY
        </span>
      );
    case "c":
    case "cpp":
    case "h":
    case "hpp":
    case "cc":
      return (
        <span
          className={`${className} flex items-center justify-center font-bold text-[9px] text-blue-500 bg-blue-500/20 rounded-xs px-0.5 leading-none`}
        >
          C++
        </span>
      );
    case "java":
      return (
        <span
          className={`${className} flex items-center justify-center font-bold text-[9px] text-red-400 bg-red-400/20 rounded-xs px-0.5 leading-none`}
        >
          JV
        </span>
      );
    case "rs":
      return (
        <span
          className={`${className} flex items-center justify-center font-bold text-[10px] text-orange-400 bg-orange-400/20 rounded-xs px-0.5 leading-none`}
        >
          RS
        </span>
      );
    case "go":
      return (
        <span
          className={`${className} flex items-center justify-center font-bold text-[10px] text-cyan-300 bg-cyan-300/20 rounded-xs px-0.5 leading-none`}
        >
          GO
        </span>
      );
    case "sql":
      return <Database className={`${className} text-purple-400`} />;
    case "sh":
    case "bash":
    case "zsh":
      return <Terminal className={`${className} text-green-400`} />;
    default:
      return <File className={`${className} text-gray-400`} />;
  }
};

