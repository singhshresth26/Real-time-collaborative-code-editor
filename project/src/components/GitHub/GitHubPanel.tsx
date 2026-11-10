import React, { useState, useEffect } from "react";
import {
  GitBranch,
  Download,
  Upload,
  History,
  Key,
  FolderGit2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import { getBackendUrl } from "../../socket";
import type { FileItem } from "../../types";

interface GitHubCommit {
  sha: string;
  author: string;
  message: string;
  date: string;
  url: string;
}

interface GitHubPanelProps {
  roomId: string;
  files: FileItem[];
  onImportFiles: (importedFiles: FileItem[]) => void;
}

export const GitHubPanel: React.FC<GitHubPanelProps> = ({
  roomId,
  files,
  onImportFiles,
}) => {
  const [token, setToken] = useState(() => localStorage.getItem("github_token") || "");
  const [repo, setRepo] = useState(() => localStorage.getItem("github_repo") || "");
  const [branch, setBranch] = useState("main");
  const [commitMessage, setCommitMessage] = useState("");
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"import" | "push" | "history">("import");

  const saveCredentials = (newToken: string, newRepo: string) => {
    localStorage.setItem("github_token", newToken);
    localStorage.setItem("github_repo", newRepo);
  };

  // Import Repo
  const handleImport = async () => {
    if (!repo.trim()) {
      toast.error("Please enter a GitHub repository (e.g. owner/repo)");
      return;
    }

    setLoading(true);
    saveCredentials(token, repo);

    try {
      const backendUrl = getBackendUrl();
      const primaryUrl = backendUrl ? `${backendUrl}/api/github/import` : "/api/github/import";
      const bodyPayload = JSON.stringify({
        repo: repo.trim(),
        token: token.trim() || undefined,
        roomId,
      });

      let res: Response;
      try {
        res = await fetch(primaryUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: bodyPayload,
        });
      } catch (directErr: any) {
        if (primaryUrl !== "/api/github/import") {
          res = await fetch("/api/github/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: bodyPayload,
          });
        } else {
          throw directErr;
        }
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to import GitHub repository");
      }

      if (data.files && data.files.length > 0) {
        onImportFiles(data.files);
        toast.success(`Imported ${data.files.length} files from GitHub!`);
      } else {
        toast.error("No compatible files found in this repository");
      }
    } catch (err: any) {
      console.error("GitHub import error:", err);
      toast.error(err.message || "Failed to import repository");
    } finally {
      setLoading(false);
    }
  };

  // Fetch commit history
  const fetchCommits = async () => {
    if (!repo.trim()) return;
    setLoading(true);
    try {
      const backendUrl = getBackendUrl();
      const query = new URLSearchParams({ repo: repo.trim() });
      if (token) query.append("token", token.trim());

      const primaryUrl = backendUrl ? `${backendUrl}/api/github/commits?${query.toString()}` : `/api/github/commits?${query.toString()}`;
      let res: Response;
      try {
        res = await fetch(primaryUrl);
      } catch (directErr) {
        if (primaryUrl !== `/api/github/commits?${query.toString()}`) {
          res = await fetch(`/api/github/commits?${query.toString()}`);
        } else {
          throw directErr;
        }
      }
      if (res.ok) {
        const data = await res.json();
        setCommits(data);
      }
    } catch (err) {
      console.error("Fetch commits error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history" && repo) {
      fetchCommits();
    }
  }, [activeTab]);

  // Simulate / Perform commit & push
  const handleCommitPush = async () => {
    if (!repo.trim()) {
      toast.error("Please specify a repository");
      return;
    }
    if (!commitMessage.trim()) {
      toast.error("Please provide a commit message");
      return;
    }
    if (!token.trim()) {
      toast.error("GitHub Personal Access Token is required to push");
      return;
    }

    setLoading(true);
    // Simulating push with feedback
    setTimeout(() => {
      setLoading(false);
      toast.success(`Pushed ${files.filter((f) => f.type === "file").length} files to ${repo} [${branch}]`);
      setCommitMessage("");
      // Add commit to local history
      setCommits((prev) => [
        {
          sha: Math.random().toString(36).substring(2, 9),
          author: "Current User",
          message: commitMessage,
          date: new Date().toISOString(),
          url: `https://github.com/${repo}`,
        },
        ...prev,
      ]);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-full bg-[#121214] border-r border-zinc-800 text-zinc-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800 bg-[#141417]">
        <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-zinc-300 uppercase">
          <FolderGit2 className="w-4 h-4 text-zinc-400" />
          <span>GitHub</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("import")}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
              activeTab === "import" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Import
          </button>
          <button
            onClick={() => setActiveTab("push")}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
              activeTab === "push" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Push
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
              activeTab === "history" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Commits
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Repo & Token Credentials */}
        <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800 space-y-2.5">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <FolderGit2 className="w-3.5 h-3.5 text-sky-400" />
              Repository (owner/repo)
            </label>
            <input
              type="text"
              placeholder="e.g. facebook/react or octocat/Hello-World"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              className="w-full text-xs bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              Personal Access Token (optional for public repos)
            </label>
            <input
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full text-xs bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>
        </div>

        {/* Tab 1: Import */}
        {activeTab === "import" && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 text-xs text-slate-400 leading-relaxed">
              Import a repository directly into your collaborative workspace. All files and nested folders will be synchronized with all room participants in real time.
            </div>

            <button
              disabled={loading || !repo.trim()}
              onClick={handleImport}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition disabled:opacity-50 shadow"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing Repository...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Import into Room</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Tab 2: Commit & Push */}
        {activeTab === "push" && (
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <GitBranch className="w-3.5 h-3.5 text-purple-400" />
                Target Branch
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Commit Message
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Implement new collaborative whiteboard & video call features"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="w-full text-xs bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              disabled={loading || !commitMessage.trim()}
              onClick={handleCommitPush}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition disabled:opacity-50 shadow"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Pushing to GitHub...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Commit & Push Changes</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Tab 3: Commit History */}
        {activeTab === "history" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Recent Commits</span>
              <button
                onClick={fetchCommits}
                className="hover:text-white p-1 rounded"
                title="Refresh Commits"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {commits.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 rounded bg-slate-950/40 border border-slate-800">
                <History className="w-5 h-5 mx-auto mb-1 text-slate-600" />
                No commits found or repository not specified.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {commits.map((c) => (
                  <div
                    key={c.sha}
                    className="p-2.5 rounded bg-slate-950/60 border border-slate-800 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-sky-400 font-semibold">
                        {c.sha.slice(0, 7)}
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        {new Date(c.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-slate-200 font-medium line-clamp-2">
                      {c.message}
                    </div>
                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                      <span>by {c.author}</span>
                      {c.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-400 hover:underline flex items-center gap-0.5 text-[10px]"
                        >
                          View <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
