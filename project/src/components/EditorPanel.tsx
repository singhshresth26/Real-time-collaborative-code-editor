import { useEffect, useRef, useState, useMemo } from "react";
import type { Socket } from "socket.io-client";

import { EditorState, Compartment } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { oneDark } from "@codemirror/theme-one-dark";

import ACTIONS from "./Actions";
import type { FileItem } from "../types";
import { getLanguageExtension, getLanguageLabel } from "../utils/language";
import {
  peerCursorsField,
  setPeerCursorsEffect,
  getPeerColor,
  type PeerCursorData,
} from "../utils/peerCursors";
import { Check, Cloud } from "lucide-react";

interface EditorProps {
  socketRef: React.MutableRefObject<Socket | null>;
  roomId?: string;
  activeFile: FileItem | null;
  files: FileItem[];
  onCodeChange: (fileId: string, code: string) => void;
  onRemoteCodeChange?: (fileId: string, code: string) => void;
  onRunCode?: () => void;
  isReadOnly?: boolean;
  highlightLine?: number | null;
  onCursorChange?: ((pos: { line: number; col: number; from: number; to: number }) => void) | undefined;
}

export default function EditorPanel({
  socketRef,
  roomId,
  activeFile,
  files,
  onCodeChange,
  onRemoteCodeChange,
  onRunCode,
  isReadOnly = false,
  highlightLine,
  onCursorChange,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<EditorView | null>(null);
  const languageCompartment = useRef(new Compartment());
  const editableCompartment = useRef(new Compartment());

  const onRunCodeRef = useRef(onRunCode);
  onRunCodeRef.current = onRunCode;

  const onCursorChangeRef = useRef(onCursorChange);
  onCursorChangeRef.current = onCursorChange;

  // Cursor position tracking for status bar
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [isSaved, setIsSaved] = useState(true);

  // References to keep event handlers up-to-date without recreating editor
  const activeFileRef = useRef<FileItem | null>(activeFile);
  activeFileRef.current = activeFile;

  const isRemoteUpdating = useRef(false);

  // Map to store peer cursors: socketId -> PeerCursorData
  const peerCursorsMap = useRef<Map<string, PeerCursorData>>(new Map());

  // Helper to re-render peer cursor decorations
  const refreshPeerCursors = () => {
    if (!editorRef.current) return;
    const cursors = Array.from(peerCursorsMap.current.values());
    editorRef.current.dispatch({
      effects: setPeerCursorsEffect.of(cursors),
    });
  };

  // Calculate breadcrumb path for status bar
  const breadcrumbPath = useMemo(() => {
    if (!activeFile) return "";
    const segments: string[] = [activeFile.name];
    let currParentId = activeFile.parentId;

    while (currParentId) {
      const parent = files.find((f) => f.id === currParentId);
      if (parent) {
        segments.unshift(parent.name);
        currParentId = parent.parentId;
      } else {
        break;
      }
    }

    return segments.join(" > ");
  }, [activeFile, files]);

  // Initialize CodeMirror instance once
  useEffect(() => {
    if (!containerRef.current) return;

    const initialLang = activeFile
      ? getLanguageExtension(activeFile.name)
      : [];

    const editorTheme = EditorView.theme({
      "&": {
        height: "100%",
        fontSize: "13.5px",
        fontFamily:
          "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, Consolas, monospace",
        backgroundColor: "#0f172a",
      },
      ".cm-scroller": {
        overflow: "auto",
        fontFamily: "inherit",
        lineHeight: "1.6",
      },
      ".cm-gutters": {
        backgroundColor: "#090d16",
        color: "#475569",
        borderRight: "1px solid #1e293b",
        paddingRight: "8px",
      },
      ".cm-activeLine": {
        backgroundColor: "rgba(51, 65, 85, 0.25)",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "rgba(51, 65, 85, 0.4)",
        color: "#94a3b8",
      },
      "&.cm-focused .cm-cursor": {
        borderLeftColor: "#38bdf8",
        borderLeftWidth: "2px",
      },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
        {
          backgroundColor: "#334155 !important",
        },
    });

    const startState = EditorState.create({
      doc: activeFile?.content ?? "",
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),
        languageCompartment.current.of(initialLang),
        editableCompartment.current.of([
          EditorView.editable.of(!isReadOnly),
          EditorState.readOnly.of(Boolean(isReadOnly)),
        ]),
        peerCursorsField,
        oneDark,
        editorTheme,
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              if (onRunCodeRef.current) {
                onRunCodeRef.current();
                return true;
              }
              return false;
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
          ...closeBracketsKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          // Track local cursor position & broadcast to peers
          if (update.selectionSet || update.docChanged) {
            const head = update.state.selection.main.head;
            const anchor = update.state.selection.main.anchor;
            const line = update.state.doc.lineAt(head);
            setCursorPos({
              line: line.number,
              col: head - line.from + 1,
            });

            if (onCursorChangeRef.current) {
              onCursorChangeRef.current({
                line: line.number,
                col: head - line.from + 1,
                from: anchor,
                to: head,
              });
            }

            const curr = activeFileRef.current;
            if (curr && socketRef.current) {
              socketRef.current.emit(ACTIONS.CURSOR_MOVE, {
                roomId,
                fileId: curr.id,
                from: anchor,
                to: head,
              });
            }
          }

          // Granular change tracking for concurrent collaborative editing
          if (update.docChanged && !isRemoteUpdating.current) {
            const code = update.state.doc.toString();
            const curr = activeFileRef.current;

            if (curr) {
              // Extract granular changes so peers can apply delta without overwriting their own edits
              const changes: { from: number; to: number; insert: string }[] = [];
              update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
                changes.push({
                  from: fromA,
                  to: toA,
                  insert: inserted.toString(),
                });
              });

              setIsSaved(false);
              onCodeChange(curr.id, code);

              if (socketRef.current) {
                socketRef.current.emit(ACTIONS.CODE_CHANGE, {
                  roomId,
                  fileId: curr.id,
                  changes,
                  code,
                });
              }

              // Visual indication of saving to MongoDB
              setTimeout(() => {
                setIsSaved(true);
              }, 800);
            }
          }
        }),
      ],
    });

    editorRef.current = new EditorView({
      state: startState,
      parent: containerRef.current,
    });

    return () => {
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, []);

  // Handle active file switching
  useEffect(() => {
    if (!editorRef.current || !activeFile) return;

    // Clear peer cursors when switching files
    peerCursorsMap.current.clear();
    refreshPeerCursors();

    const currentDoc = editorRef.current.state.doc.toString();
    const targetDoc = activeFile.content ?? "";

    // Switch doc content and reconfigure language compartment
    isRemoteUpdating.current = true;
    editorRef.current.dispatch({
      changes: {
        from: 0,
        to: currentDoc.length,
        insert: targetDoc,
      },
      effects: languageCompartment.current.reconfigure(
        getLanguageExtension(activeFile.name)
      ),
    });
    isRemoteUpdating.current = false;

    // Send initial cursor position on the newly activated file
    if (socketRef.current) {
      const head = editorRef.current.state.selection.main.head;
      const anchor = editorRef.current.state.selection.main.anchor;
      socketRef.current.emit(ACTIONS.CURSOR_MOVE, {
        roomId,
        fileId: activeFile.id,
        from: anchor,
        to: head,
      });
    }
  }, [activeFile?.id]);

  // Reconfigure editable state when permission or pair role changes
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.dispatch({
      effects: editableCompartment.current.reconfigure([
        EditorView.editable.of(!isReadOnly),
        EditorState.readOnly.of(Boolean(isReadOnly)),
      ]),
    });
  }, [isReadOnly]);

  // Scroll and jump to line when requested (e.g. from code review or debugger)
  useEffect(() => {
    if (!editorRef.current || !highlightLine) return;
    try {
      const totalLines = editorRef.current.state.doc.lines;
      const targetLine = Math.min(Math.max(1, highlightLine), totalLines);
      const lineObj = editorRef.current.state.doc.line(targetLine);
      editorRef.current.dispatch({
        selection: { anchor: lineObj.from, head: lineObj.to },
        scrollIntoView: true,
      });
    } catch (err) {
      console.error("Failed to jump to line:", err);
    }
  }, [highlightLine]);

  // Listen for remote code changes from peer collaborators
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleCodeChange = ({
      fileId,
      changes,
      code,
    }: {
      fileId?: string;
      changes?: { from: number; to: number; insert: string }[];
      code: string;
      socketId?: string;
    }) => {
      // Notify parent state to update file content in memory
      if (fileId && onRemoteCodeChange) {
        onRemoteCodeChange(fileId, code);
      }

      // If this incoming code change is for the currently active file, apply it in CodeMirror
      const curr = activeFileRef.current;
      const isTargetFile = !fileId || (curr && curr.id === fileId);

      if (isTargetFile && editorRef.current) {
        isRemoteUpdating.current = true;
        let appliedGranularly = false;

        // Apply granular changes if available to preserve user cursor and allow concurrent typing
        if (changes && Array.isArray(changes) && changes.length > 0) {
          try {
            editorRef.current.dispatch({
              changes,
            });
            appliedGranularly = true;
          } catch {
            appliedGranularly = false;
          }
        }

        // Fallback: if granular dispatch failed or was not provided, sync the full document
        if (!appliedGranularly) {
          const currentDoc = editorRef.current.state.doc.toString();
          if (code !== currentDoc) {
            editorRef.current.dispatch({
              changes: {
                from: 0,
                to: currentDoc.length,
                insert: code,
              },
            });
          }
        }

        isRemoteUpdating.current = false;
      }
    };

    const handleCursorMove = ({
      socketId,
      username,
      fileId,
      from,
      to,
    }: {
      socketId: string;
      username: string;
      fileId: string;
      from: number;
      to: number;
    }) => {
      // Ignore own cursor updates
      if (socketId === socket.id) return;

      const curr = activeFileRef.current;
      if (!curr || fileId !== curr.id) {
        // Peer is on another file: remove from this file's cursor decorations
        if (peerCursorsMap.current.has(socketId)) {
          peerCursorsMap.current.delete(socketId);
          refreshPeerCursors();
        }
        return;
      }

      // Assign unique peer color and save
      const color = getPeerColor(socketId || username);
      peerCursorsMap.current.set(socketId, {
        socketId,
        username,
        color,
        from,
        to,
      });

      refreshPeerCursors();
    };

    const handleUserActiveFile = ({
      socketId,
      fileId,
    }: {
      socketId: string;
      fileId: string | null;
    }) => {
      // If peer switched to another file, remove their cursor from our current view
      if (fileId !== activeFileRef.current?.id && peerCursorsMap.current.has(socketId)) {
        peerCursorsMap.current.delete(socketId);
        refreshPeerCursors();
      }
    };

    const handleDisconnected = ({ socketId }: { socketId: string }) => {
      if (peerCursorsMap.current.has(socketId)) {
        peerCursorsMap.current.delete(socketId);
        refreshPeerCursors();
      }
    };

    socket.on(ACTIONS.CODE_CHANGE, handleCodeChange);
    socket.on(ACTIONS.CURSOR_MOVE, handleCursorMove);
    socket.on(ACTIONS.USER_ACTIVE_FILE, handleUserActiveFile);
    socket.on(ACTIONS.DISCONNECTED, handleDisconnected);

    return () => {
      socket.off(ACTIONS.CODE_CHANGE, handleCodeChange);
      socket.off(ACTIONS.CURSOR_MOVE, handleCursorMove);
      socket.off(ACTIONS.USER_ACTIVE_FILE, handleUserActiveFile);
      socket.off(ACTIONS.DISCONNECTED, handleDisconnected);
    };
  }, [socketRef.current, onRemoteCodeChange]);

  const languageLabel = activeFile ? getLanguageLabel(activeFile.name) : "Plain Text";

  return (
    <div className="flex flex-col w-full h-full bg-[#0c0c0e] overflow-hidden">
      {/* Editor Body */}
      <div ref={containerRef} className="flex-1 w-full h-full overflow-hidden" />

      {/* VS Code-style Status Bar */}
      <div className="flex items-center justify-between px-3 h-6 bg-[#121214] border-t border-zinc-800/80 text-[11px] text-zinc-400 select-none shrink-0 font-mono">
        {/* Left: Path Breadcrumb & Sync Status */}
        <div className="flex items-center gap-3 truncate">
          <span className="text-zinc-400 font-sans truncate" title={breadcrumbPath}>
            {breadcrumbPath}
          </span>
          <div className="flex items-center gap-1 text-[10px]">
            {isSaved ? (
              <span className="flex items-center gap-1 text-zinc-400">
                <Check className="w-3 h-3 text-zinc-400" />
                <span className="hidden sm:inline">Synced</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-zinc-400 animate-pulse">
                <Cloud className="w-3 h-3" />
                <span className="hidden sm:inline">Saving...</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Language, Cursor position, Indentation */}
        <div className="flex items-center gap-4 shrink-0">
          {isReadOnly && (
            <span className="text-[10px] text-zinc-400 bg-zinc-800/80 px-1.5 py-0.2 rounded font-sans border border-zinc-700">
              Read-Only
            </span>
          )}
          <span>
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span className="hidden md:inline">Spaces: 2</span>
          <span className="hidden md:inline">UTF-8</span>
          <span className="text-zinc-300 font-sans font-medium">
            {languageLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
