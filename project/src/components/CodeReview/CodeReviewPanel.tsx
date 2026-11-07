import React, { useState } from "react";
import type { Socket } from "socket.io-client";
import {
  MessageSquareCode,
  CheckCircle,
  Plus,
  Send,
  Filter,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
import ACTIONS from "../Actions";
import type { CodeComment, FileItem } from "../../types";

interface CodeReviewPanelProps {
  socketRef: React.RefObject<Socket | null>;
  roomId: string;
  username: string;
  comments: CodeComment[];
  activeFile: FileItem | null;
  files: FileItem[];
  onNavigateToLine: (fileId: string, lineNumber: number) => void;
}

export const CodeReviewPanel: React.FC<CodeReviewPanelProps> = ({
  socketRef,
  roomId,
  username,
  comments,
  activeFile,
  files,
  onNavigateToLine,
}) => {
  const [filterCurrentFile, setFilterCurrentFile] = useState(false);
  const [filterResolved, setFilterResolved] = useState<"all" | "open" | "resolved">("open");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCommentLine, setNewCommentLine] = useState<number>(1);
  const [newCommentContent, setNewCommentContent] = useState("");
  const [replyContentMap, setReplyContentMap] = useState<Record<string, string>>({});

  const filteredComments = comments.filter((c) => {
    if (filterCurrentFile && activeFile && c.fileId !== activeFile.id) return false;
    if (filterResolved === "open" && c.resolved) return false;
    if (filterResolved === "resolved" && !c.resolved) return false;
    return true;
  });

  const handleAddComment = () => {
    if (!activeFile) {
      toast.error("Please open a file to add a comment");
      return;
    }
    if (!newCommentContent.trim()) {
      toast.error("Please enter comment text");
      return;
    }

    const newComment: CodeComment = {
      id: `comment_${Date.now()}`,
      fileId: activeFile.id,
      lineNumber: Number(newCommentLine) || 1,
      author: username,
      content: newCommentContent.trim(),
      resolved: false,
      createdAt: new Date().toISOString(),
      replies: [],
    };

    socketRef.current?.emit(ACTIONS.COMMENT_ADD, {
      roomId,
      comment: newComment,
    });

    setNewCommentContent("");
    setShowAddForm(false);
    toast.success("Code review comment added");
  };

  const handleToggleResolve = (commentId: string, currentResolved: boolean) => {
    socketRef.current?.emit(ACTIONS.COMMENT_RESOLVE, {
      roomId,
      commentId,
      resolved: !currentResolved,
    });
    toast.success(!currentResolved ? "Comment marked as resolved" : "Comment reopened");
  };

  const handleSendReply = (commentId: string) => {
    const text = replyContentMap[commentId]?.trim();
    if (!text) return;

    const reply = {
      id: `reply_${Date.now()}`,
      author: username,
      content: text,
      createdAt: new Date(),
    };

    socketRef.current?.emit(ACTIONS.COMMENT_REPLY, {
      roomId,
      commentId,
      reply,
    });

    setReplyContentMap((prev) => ({ ...prev, [commentId]: "" }));
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-sky-400 uppercase">
          <MessageSquareCode className="w-4 h-4 text-sky-400" />
          <span>Code Review</span>
        </div>
        <button
          onClick={() => setShowAddForm((prev) => !prev)}
          className="flex items-center gap-1 text-[11px] font-medium bg-sky-600 hover:bg-sky-500 text-white px-2 py-0.5 rounded transition shadow"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="p-2 border-b border-slate-800/80 bg-slate-950/20 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <button
            onClick={() => setFilterResolved("open")}
            className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition ${
              filterResolved === "open" ? "bg-slate-800 text-sky-400 font-bold" : "text-slate-500"
            }`}
          >
            Open
          </button>
          <button
            onClick={() => setFilterResolved("resolved")}
            className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition ${
              filterResolved === "resolved" ? "bg-slate-800 text-sky-400 font-bold" : "text-slate-500"
            }`}
          >
            Resolved
          </button>
          <button
            onClick={() => setFilterResolved("all")}
            className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition ${
              filterResolved === "all" ? "bg-slate-800 text-sky-400 font-bold" : "text-slate-500"
            }`}
          >
            All
          </button>
        </div>

        <button
          onClick={() => setFilterCurrentFile((prev) => !prev)}
          className={`text-[10px] px-1.5 py-0.5 rounded border transition ${
            filterCurrentFile
              ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
              : "border-slate-800 text-slate-500 hover:text-slate-400"
          }`}
        >
          Current File Only
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* New Comment Form */}
        {showAddForm && (
          <div className="p-3 rounded-lg bg-slate-950/80 border border-sky-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-sky-400">Add Inline Review Comment</span>
              <span className="text-slate-400 font-mono text-[11px]">
                {activeFile ? activeFile.name : "No file open"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-slate-400">Line #:</label>
              <input
                type="number"
                min={1}
                value={newCommentLine}
                onChange={(e) => setNewCommentLine(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 font-mono"
              />
            </div>
            <textarea
              rows={2}
              placeholder="Leave constructive feedback or ask a question about this line..."
              value={newCommentContent}
              onChange={(e) => setNewCommentContent(e.target.value)}
              className="w-full text-xs bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-2 py-1 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddComment}
                className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold"
              >
                Post Comment
              </button>
            </div>
          </div>
        )}

        {/* Comments List */}
        {filteredComments.length === 0 ? (
          <div className="text-xs text-slate-500 italic p-4 text-center bg-slate-950/40 rounded border border-slate-800">
            No code review comments match the filter.
          </div>
        ) : (
          filteredComments.map((comment) => {
            const targetFile = files.find((f) => f.id === comment.fileId);

            return (
              <div
                key={comment.id}
                className={`p-3 rounded-lg border transition ${
                  comment.resolved
                    ? "bg-slate-950/30 border-slate-800/60 opacity-75"
                    : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* File & Line Header */}
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <button
                    onClick={() => onNavigateToLine(comment.fileId, comment.lineNumber)}
                    className="flex items-center gap-1.5 text-sky-400 hover:underline font-mono"
                    title="Click to jump to line in editor"
                  >
                    <span>{targetFile?.name || "File"}</span>
                    <span className="text-slate-500">:</span>
                    <span className="text-amber-400 font-bold">L{comment.lineNumber}</span>
                  </button>

                  <button
                    onClick={() => handleToggleResolve(comment.id, comment.resolved)}
                    className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${
                      comment.resolved
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "border-slate-800 text-slate-400 hover:text-emerald-400"
                    }`}
                  >
                    {comment.resolved ? (
                      <>
                        <Check className="w-2.5 h-2.5" /> Resolved
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-2.5 h-2.5" /> Resolve
                      </>
                    )}
                  </button>
                </div>

                {/* Author & Timestamp */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                  <span className="font-medium text-slate-300">{comment.author}</span>
                  <span>{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {/* Content */}
                <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {comment.content}
                </p>

                {/* Threaded Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-2 pl-2">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="text-xs space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span className="font-medium text-sky-300">{reply.author}</span>
                          <span>{new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="text-slate-300 text-[11px] leading-snug">
                          {reply.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Box */}
                <div className="mt-2.5 pt-1.5 border-t border-slate-800/60 flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Reply to thread..."
                    value={replyContentMap[comment.id] || ""}
                    onChange={(e) =>
                      setReplyContentMap((prev) => ({ ...prev, [comment.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSendReply(comment.id);
                    }}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    onClick={() => handleSendReply(comment.id)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded transition"
                    title="Send reply"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
