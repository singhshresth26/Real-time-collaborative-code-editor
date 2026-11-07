import React, { useState, useEffect } from "react";
import {
  Activity,
  Clock,
  UserCheck,
  FileCode,
  Play,
  Camera,
  GitCommit,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import type { ActivityLog, ClientType } from "../../types";

interface ActivityPanelProps {
  activityLogs: ActivityLog[];
  users: ClientType[];
  sessionStartTime: number;
}

export const ActivityPanel: React.FC<ActivityPanelProps> = ({
  activityLogs,
  users,
  sessionStartTime,
}) => {
  const [sessionDuration, setSessionDuration] = useState("0m 0s");

  // Timer update
  useEffect(() => {
    const interval = setInterval(() => {
      const diffSecs = Math.max(0, Math.floor((Date.now() - sessionStartTime) / 1000));
      const hours = Math.floor(diffSecs / 3600);
      const minutes = Math.floor((diffSecs % 3600) / 60);
      const seconds = diffSecs % 60;

      if (hours > 0) {
        setSessionDuration(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setSessionDuration(`${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // Compute contribution metrics
  const contributionsByUser = activityLogs.reduce((acc, log) => {
    const user = log.username || "Anonymous";
    if (!acc[user]) {
      acc[user] = {
        edits: 0,
        runs: 0,
        snapshots: 0,
        comments: 0,
        total: 0,
      };
    }
    acc[user].total += 1;

    if (log.action.includes("file") || log.action.includes("code")) {
      acc[user].edits += 1;
    } else if (log.action.includes("execut") || log.action.includes("run")) {
      acc[user].runs += 1;
    } else if (log.action.includes("snapshot")) {
      acc[user].snapshots += 1;
    } else if (log.action.includes("comment")) {
      acc[user].comments += 1;
    }

    return acc;
  }, {} as Record<string, { edits: number; runs: number; snapshots: number; comments: number; total: number }>);

  const getActivityIcon = (action: string) => {
    if (action.includes("execut") || action.includes("run")) {
      return <Play className="w-3.5 h-3.5 text-amber-400" />;
    }
    if (action.includes("snapshot")) {
      return <Camera className="w-3.5 h-3.5 text-purple-400" />;
    }
    if (action.includes("git")) {
      return <GitCommit className="w-3.5 h-3.5 text-sky-400" />;
    }
    if (action.includes("join") || action.includes("role")) {
      return <UserCheck className="w-3.5 h-3.5 text-emerald-400" />;
    }
    return <FileCode className="w-3.5 h-3.5 text-blue-400" />;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-sky-400 uppercase">
          <Activity className="w-4 h-4 text-sky-400" />
          <span>Activity & Metrics</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono bg-slate-800/60 px-2 py-0.5 rounded">
          <Clock className="w-3 h-3 text-sky-400" />
          <span>{sessionDuration}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* User Contributions Overview */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Member Contributions
            </span>
            <span className="text-[10px] text-slate-500 font-normal">
              {users.length} active
            </span>
          </label>
          <div className="space-y-2">
            {Object.keys(contributionsByUser).length === 0 ? (
              <div className="text-xs text-slate-500 italic p-2 bg-slate-950/40 rounded border border-slate-800">
                No recorded actions yet
              </div>
            ) : (
              Object.entries(contributionsByUser).map(([username, stats]) => (
                <div
                  key={username}
                  className="p-2.5 rounded bg-slate-950/50 border border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{username}</span>
                    <span className="text-[11px] font-mono text-sky-400">
                      {stats.total} actions
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                    <div>
                      <span className="text-slate-500 block">Edits</span>
                      <span className="font-mono text-slate-300 font-medium">{stats.edits}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Runs</span>
                      <span className="font-mono text-amber-300 font-medium">{stats.runs}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Snaps</span>
                      <span className="font-mono text-purple-300 font-medium">{stats.snapshots}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Comments</span>
                      <span className="font-mono text-emerald-300 font-medium">{stats.comments}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Activity Timeline */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
            Recent Activity Feed
          </label>
          {activityLogs.length === 0 ? (
            <div className="text-xs text-slate-500 italic p-3 text-center bg-slate-950/40 rounded border border-slate-800">
              No recent activity recorded
            </div>
          ) : (
            <div className="relative pl-3 space-y-3 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {activityLogs.slice(-25).reverse().map((log) => (
                <div key={log.id} className="relative pl-2.5 text-xs space-y-0.5">
                  <div className="absolute -left-[14px] top-1 p-0.5 rounded-full bg-slate-900 border border-slate-700">
                    {getActivityIcon(log.action)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-300">{log.username}</span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[11px] leading-snug">
                    {log.details || log.action}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
