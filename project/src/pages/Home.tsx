import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
  Terminal,
  ArrowRight,
  Plus,
  Users,
  Cpu,
  Video,
  Shield,
  History,
} from "lucide-react";

interface RecentRoom {
  roomId: string;
  username: string;
  visitedAt: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"create" | "join">("create");
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState(() => localStorage.getItem("collab_username") || "");
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("collab_recent_rooms");
      if (stored) {
        setRecentRooms(JSON.parse(stored).slice(0, 4));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveRoomHistory = (rId: string, uName: string) => {
    localStorage.setItem("collab_username", uName);
    try {
      const stored = localStorage.getItem("collab_recent_rooms");
      const list: RecentRoom[] = stored ? JSON.parse(stored) : [];
      const updated = [
        { roomId: rId, username: uName, visitedAt: new Date().toLocaleDateString() },
        ...list.filter((r) => r.roomId !== rId),
      ].slice(0, 5);
      localStorage.setItem("collab_recent_rooms", JSON.stringify(updated));
      setRecentRooms(updated);
    } catch {
      // ignore
    }
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast.error("Please enter your display name");
      return;
    }
    const newRoomId = uuidv4().slice(0, 8);
    saveRoomHistory(newRoomId, username.trim());
    navigate(`/editor/${newRoomId}`, {
      state: { username: username.trim() },
    });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim() || !username.trim()) {
      toast.error("Please enter both Room ID and Display Name");
      return;
    }
    saveRoomHistory(roomId.trim(), username.trim());
    navigate(`/editor/${roomId.trim()}`, {
      state: { username: username.trim() },
    });
  };

  const handleJoinRecent = (r: RecentRoom) => {
    navigate(`/editor/${r.roomId}`, {
      state: { username: username.trim() || r.username },
    });
  };

  return (
    <div className="min-h-screen w-screen bg-[#09090b] text-zinc-100 flex flex-col justify-between selection:bg-zinc-700 selection:text-white font-sans bg-grid-pattern relative overflow-x-hidden">
      {/* Top Navigation */}
      <header className="h-14 border-b border-zinc-800/80 px-6 flex items-center justify-between backdrop-blur-md bg-[#09090b]/80 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-zinc-100 shadow-sm">
            <Terminal className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-zinc-100">
            CollabIDE
          </span>
          <span className="text-[11px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
            v2.4
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <a
            href="https://github.com/singhshresth26/Real-time-collaborative-code-editor"
            target="_blank"
            rel="noreferrer"
            className="text-zinc-400 hover:text-zinc-200 transition font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60"
          >
            <span>GitHub Repository</span>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 z-10 max-w-4xl mx-auto w-full my-8">
        {/* Hero Text */}
        <div className="text-center max-w-xl mx-auto mb-8 space-y-2.5">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-100">
            Real-time collaborative workspace.
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Multi-language code execution, low-latency live cursor synchronization, in-browser audio/video calls, and version history.
          </p>
        </div>

        {/* Core Card */}
        <div className="w-full max-w-md bg-[#121214] border border-zinc-800 rounded-xl shadow-2xl p-6 relative">
          {/* Segmented Tab Switcher */}
          <div className="grid grid-cols-2 p-1 bg-zinc-900/80 rounded-lg border border-zinc-800/80 mb-6 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("create")}
              className={`py-1.5 rounded-md transition ${
                activeTab === "create"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              New Workspace
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("join")}
              className={`py-1.5 rounded-md transition ${
                activeTab === "join"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Join Session
            </button>
          </div>

          {/* Form */}
          {activeTab === "create" ? (
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex, Sarah"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition font-sans"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer active:scale-[0.99]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Workspace</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Room ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. room-abc-123"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  autoFocus
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition font-sans"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer active:scale-[0.99]"
              >
                <span>Join Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* Recent Rooms */}
          {recentRooms.length > 0 && (
            <div className="mt-6 pt-5 border-t border-zinc-800/80">
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 mb-2.5">
                <History className="w-3.5 h-3.5 text-zinc-500" />
                <span>Recent Workspaces</span>
              </div>
              <div className="space-y-1.5">
                {recentRooms.map((r) => (
                  <button
                    key={r.roomId}
                    type="button"
                    onClick={() => handleJoinRecent(r)}
                    className="w-full flex items-center justify-between p-2 rounded-md bg-zinc-900/60 hover:bg-zinc-800/60 border border-zinc-800 text-xs transition text-left group"
                  >
                    <span className="font-mono text-zinc-300 group-hover:text-zinc-100">
                      {r.roomId}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {r.visitedAt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Clean Tech Spec Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 w-full max-w-2xl text-xs text-zinc-400">
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/70">
            <Users className="w-4 h-4 text-zinc-300 shrink-0" />
            <span>Real-time Delta Sync</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/70">
            <Cpu className="w-4 h-4 text-zinc-300 shrink-0" />
            <span>Sandboxed Execution</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/70">
            <Video className="w-4 h-4 text-zinc-300 shrink-0" />
            <span>WebRTC Audio & Video</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/70">
            <Shield className="w-4 h-4 text-zinc-300 shrink-0" />
            <span>Room Roles & Pair Mode</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-10 border-t border-zinc-800/60 px-6 flex items-center justify-between text-xs text-zinc-500 backdrop-blur-sm bg-[#09090b]/80 z-10">
        <span>CollabIDE &bull; Production Ready</span>
        <span>Node.js &bull; WebSockets &bull; MongoDB</span>
      </footer>
    </div>
  );
}
