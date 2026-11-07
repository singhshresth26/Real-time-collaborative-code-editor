import React, { useState } from "react";
import type { Socket } from "socket.io-client";
import {
  ShieldCheck,
  Copy,
  Check,
  Users,
  Code,
  Key,
  X,
  Shuffle,
} from "lucide-react";
import toast from "react-hot-toast";
import ACTIONS from "../Actions";
import type { ClientType, MemberRole, PairRole, RoomSettings } from "../../types";

interface PermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  socketRef: React.RefObject<Socket | null>;
  roomId: string;
  currentUser: string;
  users: ClientType[];
  userRole: MemberRole;
  pairRole: PairRole;
  settings?: RoomSettings | undefined;
}

export const PermissionsModal: React.FC<PermissionsModalProps> = ({
  isOpen,
  onClose,
  socketRef,
  roomId,
  currentUser,
  users,
  userRole,
  pairRole,
  settings = {
    allowAnonymous: true,
    anonymousDefaultRole: "editor",
    inviteToken: "inv_secret_token",
  },
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [allowAnon, setAllowAnon] = useState(settings.allowAnonymous);
  const [anonRole, setAnonRole] = useState<"editor" | "viewer">(settings.anonymousDefaultRole);

  const isOwner = userRole === "owner";

  // Change a member's role
  const handleRoleChange = (targetUsername: string, newRole: MemberRole) => {
    socketRef.current?.emit(ACTIONS.ROLE_CHANGE, {
      roomId,
      targetUsername,
      role: newRole,
    });
    toast.success(`Updated ${targetUsername}'s role to ${newRole}`);
  };

  // Change Pair Programming role
  const handlePairRoleChange = (targetUsername: string, newPairRole: PairRole) => {
    socketRef.current?.emit(ACTIONS.PAIR_ROLE_CHANGE, {
      roomId,
      targetUsername,
      pairRole: newPairRole,
    });
    toast.success(`Assigned ${targetUsername} as ${newPairRole}`);
  };

  // Swap Driver & Navigator between first 2 users
  const handleSwapDriverNavigator = () => {
    if (users.length < 2) {
      toast.error("Pair programming requires at least 2 users in the room");
      return;
    }
    const currentDriver = users.find((u) => u.pairRole === "driver") || users[0];
    const currentNav = users.find((u) => u.socketId !== currentDriver.socketId) || users[1];

    handlePairRoleChange(currentDriver.username, "navigator");
    handlePairRoleChange(currentNav.username, "driver");
    toast.success(`Swapped pair roles: ${currentNav.username} is now Driver!`);
  };

  // Copy anonymous invite link
  const inviteLink = `${window.location.origin}/editor/${roomId}?invite=${settings.inviteToken}&role=${anonRole}`;

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    toast.success("Shareable room link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
            <ShieldCheck className="w-5 h-5" />
            <span>Room Permissions & Roles</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Pair Programming Mode Widget */}
          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                <Code className="w-4 h-4 text-emerald-400" />
                <span>Pair Programming ({pairRole})</span>
              </span>
              <button
                onClick={handleSwapDriverNavigator}
                className="flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 px-2 py-0.5 rounded border border-sky-500/20 transition"
                title="Swap Driver and Navigator roles"
              >
                <Shuffle className="w-3 h-3" />
                <span>Swap Roles</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <strong>Driver:</strong> Has direct editing authority. <br />
              <strong>Navigator:</strong> Reviews code, suggests changes, leaves review comments (view-only).
            </p>
          </div>

          {/* Members List & Roles */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5 text-sky-400" />
              Room Members ({users.length})
            </label>
            <div className="space-y-2">
              {users.map((u) => {
                const isYou = u.username === currentUser;
                const role = u.role || (isYou && isOwner ? "owner" : "editor");
                const currentPair = u.pairRole || "driver";

                return (
                  <div
                    key={u.socketId}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                        <span>{u.username}</span>
                        {isYou && (
                          <span className="text-[10px] text-sky-400 bg-sky-500/10 px-1 rounded">
                            you
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>Role: <strong className="text-slate-300 uppercase">{role}</strong></span>
                        <span>•</span>
                        <span>Pair: <strong className="text-emerald-400 uppercase">{currentPair}</strong></span>
                      </div>
                    </div>

                    {isOwner ? (
                      <div className="flex items-center gap-2">
                        {/* Member Role Select */}
                        <select
                          value={role}
                          onChange={(e) => handleRoleChange(u.username, e.target.value as MemberRole)}
                          className="bg-slate-900 border border-slate-800 text-xs rounded px-2 py-1 text-slate-200 font-medium"
                        >
                          <option value="owner">Owner</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>

                        {/* Pair Role Select */}
                        <select
                          value={currentPair}
                          onChange={(e) => handlePairRoleChange(u.username, e.target.value as PairRole)}
                          className="bg-slate-900 border border-slate-800 text-xs rounded px-2 py-1 text-emerald-400 font-medium"
                        >
                          <option value="driver">Driver</option>
                          <option value="navigator">Navigator</option>
                        </select>
                      </div>
                    ) : (
                      <div className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                        {role} / {currentPair}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Anonymous Rooms & Shareable Invite Link */}
          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-3">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
              <Key className="w-4 h-4 text-amber-400" />
              Anonymous Access & Shareable Link
            </span>

            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Allow Anonymous Joining</span>
              <input
                type="checkbox"
                checked={allowAnon}
                onChange={(e) => setAllowAnon(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Default Role for Joiners</span>
              <select
                value={anonRole}
                onChange={(e) => setAnonRole(e.target.value as "editor" | "viewer")}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
              >
                <option value="editor">Editor (Can type & run)</option>
                <option value="viewer">Viewer (Read-only)</option>
              </select>
            </div>

            <div className="pt-2">
              <label className="text-[11px] text-slate-400 block mb-1">
                Direct Invite Link:
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono truncate"
                />
                <button
                  onClick={handleCopyInviteLink}
                  className="flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold shadow transition"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? "Copied!" : "Copy"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
