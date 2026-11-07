import React, { useState, useRef, useEffect } from "react";
import {
  FilePlus,
  FolderPlus,
  ChevronsDownUp,
  FolderTree,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import type { FileItem, ClientType, NewItemPrompt } from "../../types";
import { FileTreeItem } from "./FileTreeItem";
import { getFileIcon } from "../../utils/fileIcons";

interface FileExplorerProps {
  files: FileItem[];
  activeFileId: string | null;
  onSelectFile: (fileId: string) => void;
  onCreateFile: (name: string, type: "file" | "folder", parentId: string | null) => void;
  onRenameFile: (id: string, newName: string) => void;
  onDeleteFile: (id: string) => void;
  users: ClientType[];
  roomId?: string;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  activeFileId,
  onSelectFile,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
  users,
  roomId,
}) => {
  // Folder open/closed state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    // Default open root folders
    const initial = new Set<string>();
    files.forEach((f) => {
      if (f.type === "folder") initial.add(f.id);
    });
    return initial;
  });

  // State for creating new item
  const [newItemPrompt, setNewItemPrompt] = useState<NewItemPrompt | null>(null);
  const [rootItemName, setRootItemName] = useState("");
  const rootInputRef = useRef<HTMLInputElement>(null);

  // State for renaming
  const [renamingId, setRenamingId] = useState<string | null>(null);

  // State for delete confirmation modal
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
    isFolder: boolean;
  } | null>(null);

  // Focus root input when active
  useEffect(() => {
    if (newItemPrompt && newItemPrompt.parentId === null) {
      setRootItemName("");
      setTimeout(() => {
        rootInputRef.current?.focus();
      }, 50);
    }
  }, [newItemPrompt]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const collapseAllFolders = () => {
    setExpandedFolders(new Set());
  };

  const startCreate = (parentId: string | null, type: "file" | "folder") => {
    setNewItemPrompt({ parentId, type });
    if (parentId) {
      // Ensure parent folder is expanded
      setExpandedFolders((prev) => new Set(prev).add(parentId));
    }
  };

  const validateName = (name: string, parentId: string | null): boolean => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name cannot be empty");
      return false;
    }
    if (/[/\\?%*:|"<>]/g.test(trimmed)) {
      toast.error('Name cannot contain invalid characters: / \\ ? % * : | " < >');
      return false;
    }

    // Check sibling collisions
    const siblings = files.filter((f) => f.parentId === parentId);
    if (siblings.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`"${trimmed}" already exists in this folder`);
      return false;
    }

    return true;
  };

  const handleSubmitNewItem = (name: string) => {
    if (!newItemPrompt) return;
    const trimmed = name.trim();
    if (validateName(trimmed, newItemPrompt.parentId)) {
      onCreateFile(trimmed, newItemPrompt.type, newItemPrompt.parentId);
      setNewItemPrompt(null);
      setRootItemName("");
    }
  };

  const handleCancelNewItem = () => {
    setNewItemPrompt(null);
    setRootItemName("");
  };

  const handleRename = (id: string, newName: string) => {
    const item = files.find((f) => f.id === id);
    if (!item) return;

    // Check sibling collisions
    const siblings = files.filter((f) => f.parentId === item.parentId && f.id !== id);
    if (siblings.some((s) => s.name.toLowerCase() === newName.toLowerCase())) {
      toast.error(`"${newName}" already exists in this folder`);
      return;
    }

    onRenameFile(id, newName);
  };

  const handleDeleteRequest = (id: string, name: string, isFolder: boolean) => {
    setDeleteConfirm({ id, name, isFolder });
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      onDeleteFile(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  // Get root items (parentId is null)
  const rootItems = files
    .filter((f) => f.parentId === null)
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="flex flex-col h-full bg-slate-900 select-none border-r border-slate-800">
      {/* Explorer Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-300 uppercase">
          <FolderTree className="w-4 h-4 text-sky-400" />
          <span>Explorer</span>
        </div>

        {/* Global Explorer Action Buttons */}
        <div className="flex items-center gap-1 text-slate-400">
          <button
            type="button"
            title="New File"
            onClick={() => startCreate(null, "file")}
            className="p-1 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="New Folder"
            onClick={() => startCreate(null, "folder")}
            className="p-1 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Collapse All Folders"
            onClick={collapseAllFolders}
            className="p-1 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <ChevronsDownUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Workspace Room Name Label */}
      <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase bg-slate-950/40 flex items-center justify-between">
        <span className="truncate">WORKSPACE : {roomId ? roomId.slice(0, 8) : "PROJECT"}</span>
        <span className="text-[10px] text-slate-500 font-normal">
          {files.filter((f) => f.type === "file").length} files
        </span>
      </div>

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto px-1 py-1.5 space-y-0.5 custom-scrollbar">
        {/* Root level inline creator */}
        {newItemPrompt && newItemPrompt.parentId === null && (
          <div className="flex items-center h-7 px-2 rounded-sm bg-slate-800/40">
            <span className="w-4 h-4 shrink-0 mr-0.5" />
            <span className="mr-1.5 shrink-0">
              {getFileIcon({
                filename: rootItemName || "new",
                isFolder: newItemPrompt.type === "folder",
                isOpen: false,
              })}
            </span>
            <input
              ref={rootInputRef}
              type="text"
              placeholder={
                newItemPrompt.type === "folder" ? "folder-name" : "file-name.ext"
              }
              value={rootItemName}
              onChange={(e) => setRootItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmitNewItem(rootItemName);
                } else if (e.key === "Escape") {
                  handleCancelNewItem();
                }
              }}
              onBlur={() => {
                if (rootItemName.trim()) {
                  handleSubmitNewItem(rootItemName);
                } else {
                  handleCancelNewItem();
                }
              }}
              className="bg-slate-900 text-sky-200 border border-sky-500 rounded px-1.5 py-0.5 text-xs outline-none w-full max-w-[150px]"
            />
          </div>
        )}

        {/* Root items */}
        {rootItems.length === 0 && !newItemPrompt ? (
          <div className="text-center py-6 px-3 text-slate-500 text-xs">
            <p>No files in project.</p>
            <button
              onClick={() => startCreate(null, "file")}
              className="mt-2 text-sky-400 hover:underline inline-flex items-center gap-1"
            >
              <FilePlus className="w-3 h-3" /> Create a file
            </button>
          </div>
        ) : (
          rootItems.map((item) => (
            <FileTreeItem
              key={item.id}
              item={item}
              allItems={files}
              depth={0}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              activeFileId={activeFileId}
              onSelectFile={onSelectFile}
              onStartCreate={startCreate}
              onRename={handleRename}
              onDelete={handleDeleteRequest}
              renamingId={renamingId}
              setRenamingId={setRenamingId}
              newItemPrompt={newItemPrompt}
              onSubmitNewItem={handleSubmitNewItem}
              onCancelNewItem={handleCancelNewItem}
              users={users}
            />
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 max-w-sm w-full shadow-2xl text-white">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-semibold text-base">
                Delete {deleteConfirm.isFolder ? "Folder" : "File"}?
              </h3>
            </div>
            <p className="text-sm text-slate-300 mb-1">
              Are you sure you want to delete{" "}
              <span className="font-mono text-sky-300 font-medium">
                "{deleteConfirm.name}"
              </span>
              ?
            </p>
            {deleteConfirm.isFolder && (
              <p className="text-xs text-amber-300/90 mb-4 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                Warning: All files and nested folders inside this directory will be permanently removed.
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3 py-1.5 text-xs font-medium rounded bg-red-600 hover:bg-red-500 text-white transition shadow"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
