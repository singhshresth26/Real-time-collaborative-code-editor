import React, { useState, useRef, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import type { FileItem, ClientType, NewItemPrompt } from "../../types";
import { getFileIcon } from "../../utils/fileIcons";

interface FileTreeItemProps {
  item: FileItem;
  allItems: FileItem[];
  depth: number;
  expandedFolders: Set<string>;
  toggleFolder: (folderId: string) => void;
  activeFileId: string | null;
  onSelectFile: (fileId: string) => void;
  onStartCreate: (parentId: string | null, type: "file" | "folder") => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string, name: string, isFolder: boolean) => void;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  newItemPrompt: NewItemPrompt | null;
  onSubmitNewItem: (name: string) => void;
  onCancelNewItem: () => void;
  users: ClientType[];
}

export const FileTreeItem: React.FC<FileTreeItemProps> = ({
  item,
  allItems,
  depth,
  expandedFolders,
  toggleFolder,
  activeFileId,
  onSelectFile,
  onStartCreate,
  onRename,
  onDelete,
  renamingId,
  setRenamingId,
  newItemPrompt,
  onSubmitNewItem,
  onCancelNewItem,
  users,
}) => {
  const isFolder = item.type === "folder";
  const isExpanded = expandedFolders.has(item.id);
  const isActive = activeFileId === item.id;
  const isRenaming = renamingId === item.id;

  const [renameValue, setRenameValue] = useState(item.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [newChildName, setNewChildName] = useState("");
  const newChildInputRef = useRef<HTMLInputElement>(null);

  // Focus rename input on mount
  useEffect(() => {
    if (isRenaming) {
      setRenameValue(item.name);
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 50);
    }
  }, [isRenaming, item.name]);

  // Focus new child input if this folder is the target parent
  const isCreatingInside = newItemPrompt?.parentId === item.id;
  useEffect(() => {
    if (isCreatingInside) {
      setNewChildName("");
      setTimeout(() => {
        newChildInputRef.current?.focus();
      }, 50);
    }
  }, [isCreatingInside]);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== item.name) {
      onRename(item.id, trimmed);
    }
    setRenamingId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setRenamingId(null);
      setRenameValue(item.name);
    }
  };

  const handleNewChildSubmit = () => {
    const trimmed = newChildName.trim();
    if (trimmed) {
      onSubmitNewItem(trimmed);
      setNewChildName("");
    } else {
      onCancelNewItem();
    }
  };

  const handleNewChildKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleNewChildSubmit();
    } else if (e.key === "Escape") {
      onCancelNewItem();
      setNewChildName("");
    }
  };

  // Find children if folder
  const children = isFolder
    ? allItems
        .filter((i) => i.parentId === item.id)
        .sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === "folder" ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        })
    : [];

  // Collaborators currently viewing this file
  const activeCollaborators = !isFolder
    ? users.filter((u) => u.activeFileId === item.id)
    : [];

  return (
    <div className="select-none text-xs">
      <div
        className={`group flex items-center h-7 px-1 rounded-sm cursor-pointer transition-colors relative ${
          isActive
            ? "bg-slate-700/80 text-white font-medium border-l-2 border-sky-400 pl-[calc(0.25rem-2px)]"
            : "hover:bg-slate-800/60 text-slate-300 hover:text-white"
        }`}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        onClick={(e) => {
          e.stopPropagation();
          if (isFolder) {
            toggleFolder(item.id);
          } else {
            onSelectFile(item.id);
          }
        }}
      >
        {/* Folder expand chevron or spacing */}
        {isFolder ? (
          <span
            className="w-4 h-4 flex items-center justify-center shrink-0 mr-0.5 text-slate-400 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              toggleFolder(item.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </span>
        ) : (
          <span className="w-4 h-4 shrink-0 mr-0.5" />
        )}

        {/* Icon */}
        <span className="mr-1.5 shrink-0 flex items-center">
          {getFileIcon({
            filename: item.name,
            isFolder,
            isOpen: isExpanded,
          })}
        </span>

        {/* Name or Rename Input */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 text-sky-300 border border-sky-500 rounded px-1 py-0 text-xs outline-none flex-1 max-w-[140px]"
          />
        ) : (
          <span className="truncate flex-1" title={item.name}>
            {item.name}
          </span>
        )}

        {/* Peer avatars / dots */}
        {activeCollaborators.length > 0 && !isRenaming && (
          <div className="flex items-center gap-0.5 ml-1 mr-1">
            {activeCollaborators.map((peer) => (
              <span
                key={peer.socketId}
                title={`${peer.username} is editing this file`}
                className="w-2 h-2 rounded-full bg-emerald-400 border border-slate-900 inline-block animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Action buttons on hover */}
        {!isRenaming && (
          <div className="hidden group-hover:flex items-center gap-1 ml-auto pr-1 shrink-0 bg-slate-800/90 rounded px-1 py-0.5 shadow-sm">
            {isFolder && (
              <>
                <button
                  type="button"
                  title="New File Inside"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isExpanded) toggleFolder(item.id);
                    onStartCreate(item.id, "file");
                  }}
                  className="p-0.5 hover:text-sky-300 rounded hover:bg-slate-700"
                >
                  <FilePlus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  title="New Folder Inside"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isExpanded) toggleFolder(item.id);
                    onStartCreate(item.id, "folder");
                  }}
                  className="p-0.5 hover:text-sky-300 rounded hover:bg-slate-700"
                >
                  <FolderPlus className="w-3 h-3" />
                </button>
              </>
            )}

            <button
              type="button"
              title="Rename"
              onClick={(e) => {
                e.stopPropagation();
                setRenamingId(item.id);
              }}
              className="p-0.5 hover:text-yellow-300 rounded hover:bg-slate-700"
            >
              <Pencil className="w-3 h-3" />
            </button>

            <button
              type="button"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id, item.name, isFolder);
              }}
              className="p-0.5 hover:text-red-400 rounded hover:bg-slate-700"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* If folder is expanded, show its children and inline creator */}
      {isFolder && isExpanded && (
        <div className="relative">
          {/* Indent guideline */}
          <div
            className="absolute top-0 bottom-0 border-l border-slate-700/40 pointer-events-none"
            style={{ left: `${depth * 14 + 14}px` }}
          />

          {/* Child creation input */}
          {isCreatingInside && (
            <div
              className="flex items-center h-7 px-1 rounded-sm bg-slate-800/40"
              style={{ paddingLeft: `${(depth + 1) * 14 + 6}px` }}
            >
              <span className="w-4 h-4 shrink-0 mr-0.5" />
              <span className="mr-1.5 shrink-0">
                {getFileIcon({
                  filename: newChildName || "new",
                  isFolder: newItemPrompt.type === "folder",
                  isOpen: false,
                })}
              </span>
              <input
                ref={newChildInputRef}
                type="text"
                placeholder={
                  newItemPrompt.type === "folder" ? "folder-name" : "file-name.ext"
                }
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                onKeyDown={handleNewChildKeyDown}
                onBlur={handleNewChildSubmit}
                className="bg-slate-900 text-sky-200 border border-sky-500 rounded px-1.5 py-0.5 text-xs outline-none w-full max-w-[150px]"
              />
            </div>
          )}

          {/* Render children */}
          {children.map((child) => (
            <FileTreeItem
              key={child.id}
              item={child}
              allItems={allItems}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              activeFileId={activeFileId}
              onSelectFile={onSelectFile}
              onStartCreate={onStartCreate}
              onRename={onRename}
              onDelete={onDelete}
              renamingId={renamingId}
              setRenamingId={setRenamingId}
              newItemPrompt={newItemPrompt}
              onSubmitNewItem={onSubmitNewItem}
              onCancelNewItem={onCancelNewItem}
              users={users}
            />
          ))}
        </div>
      )}
    </div>
  );
};
