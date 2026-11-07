import React, { useState, useRef, useEffect } from "react";
import { Send, Code, Terminal, MessageSquare, Bot } from "lucide-react";
import type { ChatMessage } from "../../types";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, isCodeSnippet: boolean, language?: string) => void;
  onSendTyping: (isTyping: boolean) => void;
  typingUsers: string[];
  currentUsername: string;
  activeCodeSnippet?: string;
  activeLanguage?: string;
  onInsertCode?: (code: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  onSendTyping,
  typingUsers,
  currentUsername,
  activeCodeSnippet,
  activeLanguage,
  onInsertCode,
}) => {
  const [inputText, setInputText] = useState("");
  const [sendAsCode, setSendAsCode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    onSendTyping(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onSendTyping(false);
    }, 1500);
  };

  const handleSend = () => {
    const textToSend = inputText.trim();
    if (!textToSend) return;

    onSendMessage(textToSend, sendAsCode, activeLanguage || "javascript");
    setInputText("");
    setSendAsCode(false);
    onSendTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertCurrentFileCode = () => {
    if (activeCodeSnippet) {
      setInputText(activeCodeSnippet.slice(0, 800));
      setSendAsCode(true);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-white select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-300 uppercase">
          <MessageSquare className="w-4 h-4 text-sky-400" />
          <span>Room Chat ({messages.length})</span>
        </div>
        {activeCodeSnippet && (
          <button
            type="button"
            title="Attach snippet from active file"
            onClick={insertCurrentFileCode}
            className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 hover:bg-slate-800 px-2 py-0.5 rounded transition"
          >
            <Code className="w-3 h-3" />
            <span>Attach Code</span>
          </button>
        )}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar select-text">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs text-center p-4">
            <MessageSquare className="w-8 h-8 text-slate-700 mb-2" />
            <p>No messages in room yet.</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Start the discussion or share formatted code snippets.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === currentUsername;
            const isSystem = msg.sender === "System";

            if (isSystem) {
              return (
                <div key={msg.id} className="text-center my-2">
                  <span className="text-[10px] text-slate-500 bg-slate-950/60 px-2 py-1 rounded-full border border-slate-800 inline-flex items-center gap-1">
                    <Bot className="w-3 h-3 text-sky-400" />
                    {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5 text-[10px] text-slate-400">
                  <span className="font-semibold text-slate-300">
                    {isMe ? "You" : msg.sender}
                  </span>
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div
                  className={`max-w-[85%] rounded-lg p-2.5 text-xs ${
                    isMe
                      ? "bg-sky-600/90 text-white rounded-tr-none shadow-sm"
                      : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700"
                  }`}
                >
                  {msg.isCodeSnippet ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-300 border-b border-slate-700 pb-1">
                        <span className="font-mono uppercase font-bold text-sky-300 flex items-center gap-1">
                          <Terminal className="w-3 h-3" />
                          {msg.language || "code"}
                        </span>
                        {onInsertCode && (
                          <button
                            type="button"
                            onClick={() => onInsertCode(msg.text)}
                            className="hover:underline text-sky-200"
                          >
                            Apply to Editor
                          </button>
                        )}
                      </div>
                      <pre className="p-2 bg-slate-950/80 rounded font-mono text-[11px] overflow-x-auto text-sky-200 max-h-48 whitespace-pre-wrap select-all">
                        {msg.text}
                      </pre>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words leading-relaxed">
                      {msg.text}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="text-[11px] text-slate-400 italic flex items-center gap-1.5 pt-1">
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:0.4s]" />
            </span>
            <span>{typingUsers.join(", ")} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Footer */}
      <div className="p-2.5 border-t border-slate-800 bg-slate-950/60 shrink-0">
        <div className="flex items-center justify-between mb-1 text-[11px] text-slate-400">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={sendAsCode}
              onChange={(e) => setSendAsCode(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-3 h-3 cursor-pointer"
            />
            <span>Send as code snippet</span>
          </label>
          <span className="text-[10px] text-slate-500">Enter to send</span>
        </div>

        <div className="flex gap-2 items-end">
          <textarea
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              sendAsCode
                ? "Paste or write code snippet here..."
                : "Type message to room..."
            }
            rows={sendAsCode ? 3 : 1}
            className="flex-1 bg-slate-900 border border-slate-700 focus:border-sky-500 text-slate-100 placeholder-slate-500 p-2 rounded-md outline-none text-xs resize-none leading-relaxed font-sans"
          />

          <button
            type="button"
            title="Send Message"
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="p-2 rounded-md bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:hover:bg-sky-500 text-slate-950 transition cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
