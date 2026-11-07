import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Code2, ArrowRight, PlusCircle } from "lucide-react";

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const navigate = useNavigate();

  const createNewRoom = (e: React.MouseEvent) => {
    e.preventDefault();
    const id = uuidv4();
    setRoomId(id);
    toast.success("New Room ID generated!");
  };

  const joinRoom = () => {
    if (!roomId.trim() || !username.trim()) {
      toast.error("Please enter both Room ID and Username!");
      return;
    }

    navigate(`/editor/${roomId.trim()}`, {
      state: {
        username: username.trim(),
      },
    });
  };

  const handleInputEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      joinRoom();
    }
  };

  return (
    <div className="bg-slate-950 min-h-screen w-screen flex items-center justify-center p-4 selection:bg-sky-500 selection:text-slate-950 font-sans">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl text-white flex flex-col p-8 gap-6 shadow-2xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Code2 className="w-7 h-7" />
          </div>
          <div className="text-3xl font-bold tracking-tight text-center text-slate-100">
            Collaborative Code Editor
          </div>
          <p className="text-xs text-slate-400 text-center">
            Real-time VS Code-like editor with file tree, tabs, and cloud sync.
          </p>
        </div>

        {/* Inputs */}
        <div className="flex flex-col gap-3.5 w-full">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Room ID
            </label>
            <input
              type="text"
              placeholder="Enter or paste Room ID"
              onKeyUp={handleInputEnter}
              onChange={(e) => setRoomId(e.target.value)}
              value={roomId}
              className="bg-slate-950 border border-slate-700 focus:border-sky-500 text-slate-200 placeholder-slate-500 p-2.5 rounded-lg outline-none w-full text-sm font-mono transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Username
            </label>
            <input
              type="text"
              placeholder="Your display name"
              onKeyUp={handleInputEnter}
              onChange={(e) => setUsername(e.target.value)}
              value={username}
              className="bg-slate-950 border border-slate-700 focus:border-sky-500 text-slate-200 placeholder-slate-500 p-2.5 rounded-lg outline-none w-full text-sm transition"
            />
          </div>
        </div>

        {/* Join button */}
        <button
          type="button"
          className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold py-2.5 rounded-lg w-full flex items-center justify-center gap-2 shadow-lg shadow-sky-500/15 transition cursor-pointer"
          onClick={joinRoom}
        >
          <span>Join Room</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Create room link */}
        <div className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5 pt-2 border-t border-slate-800/80">
          <span>Need a new workspace?</span>
          <a
            onClick={createNewRoom}
            className="text-sky-400 hover:text-sky-300 font-semibold cursor-pointer inline-flex items-center gap-1 hover:underline"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Generate New Room</span>
          </a>
        </div>
      </div>
    </div>
  );
}
