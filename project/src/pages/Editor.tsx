import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useNavigate, Navigate, useParams } from "react-router-dom";
import type { Socket } from "socket.io-client";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import {
  Files,
  Users as UsersIcon,
  Copy,
  LogOut,
  Terminal as TerminalIcon,
  MessageSquare,
  History,
  FolderGit2,
  Activity as ActivityIcon,
  MessageSquareCode,
  Briefcase,
  Bug,
  Palette,
  PhoneCall,
  ShieldCheck,
  Video,
  Radio,
  Eye,
} from "lucide-react";

import Users from "../components/Users";
import EditorPanel from "../components/EditorPanel";
import { FileExplorer } from "../components/FileExplorer/FileExplorer";
import { TabBar } from "../components/TabBar/TabBar";
import { EmptyEditor } from "../components/EmptyEditor";
import { TerminalPanel } from "../components/Terminal/TerminalPanel";
import { ChatPanel } from "../components/Chat/ChatPanel";
import { VersionHistoryPanel } from "../components/VersionHistory/VersionHistoryPanel";
import { VideoCallPanel } from "../components/VideoCall/VideoCallPanel";
import { WhiteboardModal } from "../components/Whiteboard/WhiteboardModal";
import { GitHubPanel } from "../components/GitHub/GitHubPanel";
import { ActivityPanel } from "../components/Activity/ActivityPanel";
import { CodeReviewPanel } from "../components/CodeReview/CodeReviewPanel";
import { InterviewPanel } from "../components/Interview/InterviewPanel";
import { DebuggerPanel } from "../components/Debugger/DebuggerPanel";
import { PermissionsModal } from "../components/Permissions/PermissionsModal";
import { SessionReplayModal } from "../components/Replay/SessionReplayModal";

import ACTIONS from "../components/Actions";
import { initSocket, getBackendUrl } from "../socket";
import { getLanguageLabel } from "../utils/language";
import type {
  FileItem,
  ClientType,
  ExecutionResult,
  ExecutionStatus,
  ChatMessage,
  VersionSnapshot,
  ActivityLog,
  CodeComment,
  InterviewSession,
  Breakpoint,
  RoomSettings,
  MemberRole,
  PairRole,
  SessionRecording,
  SessionRecordingEvent,
} from "../types";

type LocationState = {
  username?: string;
};

type SidebarTab =
  | "explorer"
  | "chat"
  | "history"
  | "github"
  | "activity"
  | "review"
  | "interview"
  | "debugger"
  | "collaborators";

export default function EditorPage() {
  const socketRef = useRef<Socket | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();

  // Support Anonymous Room join link via query param: /editor/:roomId?invite=...
  const queryParams = new URLSearchParams(location.search);
  const inviteToken = queryParams.get("invite");
  const queryRole = queryParams.get("role") as MemberRole | null;

  const [username] = useState<string>(() => {
    const passedName = (location.state as LocationState | null)?.username;
    if (passedName) return passedName;
    const sessionName = sessionStorage.getItem(`anon_user_${roomId}`);
    if (sessionName) return sessionName;
    if (inviteToken) {
      const generated = `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
      sessionStorage.setItem(`anon_user_${roomId}`, generated);
      return generated;
    }
    return "";
  });

  // Workspace and Editor State
  const [files, setFiles] = useState<FileItem[]>([]);
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [users, setUsers] = useState<ClientType[]>([]);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("explorer");

  // Terminal & Code Execution State
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(240);
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);
  const [terminalTab, setTerminalTab] = useState<"output" | "input">("output");
  const [stdin, setStdin] = useState("");
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>("idle");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Collaborative Platform States
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [versionSnapshots, setVersionSnapshots] = useState<VersionSnapshot[]>([]);
  const [whiteboardElements, setWhiteboardElements] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [codeComments, setCodeComments] = useState<CodeComment[]>([]);
  const [interviewSession, setInterviewSession] = useState<InterviewSession | undefined>(undefined);
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);
  const [roomSettings, setRoomSettings] = useState<RoomSettings | undefined>(undefined);
  const [roomOwner, setRoomOwner] = useState<string>("");
  const [userRole, setUserRole] = useState<MemberRole>(queryRole || "editor");
  const [pairRole, setPairRole] = useState<PairRole>("driver");
  const [sessionStartTime] = useState<number>(Date.now());
  const [sessionRecordings, setSessionRecordings] = useState<SessionRecording[]>([]);
  const [activeRecordingEvents, setActiveRecordingEvents] = useState<SessionRecordingEvent[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  // Modals visibility
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [isReplayOpen, setIsReplayOpen] = useState(false);

  // Follow Me Mode
  const [isFollowLeader, setIsFollowLeader] = useState(false);
  const [activeLeaderName, setActiveLeaderName] = useState<string | null>(null);
  const [highlightLine, setHighlightLine] = useState<number | null>(null);

  // Refs for callbacks
  const filesRef = useRef<FileItem[]>(files);
  filesRef.current = files;

  const openTabIdsRef = useRef<string[]>(openTabIds);
  openTabIdsRef.current = openTabIds;

  const activeFileIdRef = useRef<string | null>(activeFileId);
  activeFileIdRef.current = activeFileId;

  const isRecordingRef = useRef(isRecording);
  isRecordingRef.current = isRecording;

  const isFollowLeaderRef = useRef(isFollowLeader);
  isFollowLeaderRef.current = isFollowLeader;

  // Active File object
  const activeFile = files.find((f) => f.id === activeFileId) || null;

  // Record an event if session recording is active
  const recordEvent = useCallback((type: string, data: any) => {
    if (!isRecordingRef.current) return;
    const evt: SessionRecordingEvent = {
      timestamp: Date.now(),
      type,
      username,
      data,
    };
    setActiveRecordingEvents((prev) => [...prev, evt]);
  }, [username]);

  // Initialize Socket connection
  useEffect(() => {
    if (!username || !roomId) return;

    const init = async () => {
      try {
        socketRef.current = await initSocket();

        socketRef.current.on("connect_error", handleErrors);
        socketRef.current.on("connect_failed", handleErrors);

        function handleErrors(err: unknown) {
          console.error("Socket error:", err);
          toast.error("Socket connection failed");
          navigate("/");
        }

        // Join the room
        socketRef.current.emit(ACTIONS.JOIN, {
          roomId,
          username,
        });

        // Room joined event
        socketRef.current.on(
          ACTIONS.JOINED,
          ({
            clients,
            username: joinedUser,
          }: {
            clients: ClientType[];
            username: string;
            socketId: string;
          }) => {
            if (joinedUser !== username) {
              toast.success(`${joinedUser} joined the room`);
            }
            setUsers(clients);
          }
        );

        // Initial files synchronization from MongoDB
        socketRef.current.on(
          ACTIONS.SYNC_FILES,
          ({ files: syncedFiles }: { files: FileItem[] }) => {
            setFiles(syncedFiles);

            if (syncedFiles.length > 0) {
              const defaultFile =
                syncedFiles.find(
                  (f) =>
                    f.type === "file" &&
                    (f.name === "index.js" || f.name.includes("index"))
                ) || syncedFiles.find((f) => f.type === "file");

              if (defaultFile) {
                setOpenTabIds([defaultFile.id]);
                setActiveFileId(defaultFile.id);

                socketRef.current?.emit(ACTIONS.USER_ACTIVE_FILE, {
                  roomId,
                  fileId: defaultFile.id,
                });
              }
            }
          }
        );

        // Complete Room Data Synchronization (from MongoDB)
        socketRef.current.on(
          ACTIONS.ROOM_DATA_SYNC,
          ({ room }: { room: any }) => {
            if (!room) return;
            if (room.owner) {
              setRoomOwner(room.owner);
              if (room.owner === username) {
                setUserRole("owner");
              }
            }
            if (room.chatMessages) setChatMessages(room.chatMessages);
            if (room.versionSnapshots) setVersionSnapshots(room.versionSnapshots);
            if (room.whiteboardElements) setWhiteboardElements(room.whiteboardElements);
            if (room.activityLogs) setActivityLogs(room.activityLogs);
            if (room.codeComments) setCodeComments(room.codeComments);
            if (room.interviewSession) setInterviewSession(room.interviewSession);
            if (room.breakpoints) setBreakpoints(room.breakpoints);
            if (room.settings) setRoomSettings(room.settings);
            if (room.sessionRecordings) setSessionRecordings(room.sessionRecordings);

            // Set role from members list if present
            if (room.members && Array.isArray(room.members)) {
              const memberRecord = room.members.find((m: any) => m.username === username);
              if (memberRecord) {
                if (memberRecord.role) setUserRole(memberRecord.role);
                if (memberRecord.pairRole) setPairRole(memberRecord.pairRole);
              }
            }
          }
        );

        // Real-time file created by collaborator
        socketRef.current.on(
          ACTIONS.FILE_CREATED,
          ({ file }: { file: FileItem }) => {
            setFiles((prev) => {
              if (prev.some((f) => f.id === file.id)) return prev;
              return [...prev, file];
            });
          }
        );

        // Real-time file renamed by collaborator
        socketRef.current.on(
          ACTIONS.FILE_RENAMED,
          ({ id, newName }: { id: string; newName: string }) => {
            setFiles((prev) =>
              prev.map((f) => (f.id === id ? { ...f, name: newName } : f))
            );
          }
        );

        // Real-time file deleted by collaborator
        socketRef.current.on(
          ACTIONS.FILE_DELETED,
          ({ deletedIds }: { id: string; deletedIds: string[] }) => {
            const deletedSet = new Set(deletedIds);

            setFiles((prev) => prev.filter((f) => !deletedSet.has(f.id)));

            setOpenTabIds((prev) => {
              const remaining = prev.filter((tabId) => !deletedSet.has(tabId));
              return remaining;
            });

            setActiveFileId((currentActive) => {
              if (currentActive && deletedSet.has(currentActive)) {
                const remaining = openTabIdsRef.current.filter(
                  (tabId) => !deletedSet.has(tabId)
                );
                return remaining.length > 0 ? remaining[0] : null;
              }
              return currentActive;
            });
          }
        );

        // Remote peer active file tracking
        socketRef.current.on(
          ACTIONS.USER_ACTIVE_FILE,
          ({
            socketId,
            fileId,
          }: {
            socketId: string;
            username: string;
            fileId: string | null;
          }) => {
            setUsers((prev) =>
              prev.map((u) =>
                u.socketId === socketId ? { ...u, activeFileId: fileId } : u
              )
            );
          }
        );

        // Real-Time Chat Message arrived
        socketRef.current.on(
          ACTIONS.CHAT_MESSAGE,
          ({ message }: { message: ChatMessage }) => {
            setChatMessages((prev) => [...prev, message]);
            if (message.sender !== username && sidebarTab !== "chat") {
              setUnreadChatCount((prev) => prev + 1);
            }
          }
        );

        // Chat Typing indicator
        socketRef.current.on(
          ACTIONS.CHAT_TYPING,
          ({ username: typer, isTyping }: { username: string; isTyping: boolean }) => {
            setTypingUsers((prev) => {
              if (isTyping) {
                return prev.includes(typer) ? prev : [...prev, typer];
              }
              return prev.filter((u) => u !== typer);
            });
          }
        );

        // Version History Snapshot Created
        socketRef.current.on(
          ACTIONS.SNAPSHOT_CREATE,
          ({ snapshot }: { snapshot: VersionSnapshot }) => {
            setVersionSnapshots((prev) => [snapshot, ...prev]);
            toast.success(`New snapshot created: ${snapshot.label}`);
          }
        );

        // Version History Snapshot Restored
        socketRef.current.on(
          ACTIONS.SNAPSHOT_RESTORE,
          ({
            files: restoredFiles,
            restoredSnapshot,
          }: {
            files: FileItem[];
            restoredSnapshot: VersionSnapshot;
          }) => {
            setFiles(restoredFiles);
            toast.success(`Restored to snapshot "${restoredSnapshot.label}"`);
          }
        );

        // Role & Permission Changes
        socketRef.current.on(
          ACTIONS.ROLE_CHANGE,
          ({ targetUsername, role }: { targetUsername: string; role: MemberRole }) => {
            if (targetUsername === username) {
              setUserRole(role);
              toast(`Your role has been set to ${role.toUpperCase()}`, { icon: "🛡️" });
            }
            setUsers((prev) =>
              prev.map((u) => (u.username === targetUsername ? { ...u, role } : u))
            );
          }
        );

        socketRef.current.on(
          ACTIONS.PAIR_ROLE_CHANGE,
          ({ targetUsername, pairRole: newPairRole }: { targetUsername: string; pairRole: PairRole }) => {
            if (targetUsername === username) {
              setPairRole(newPairRole);
              toast(`Pair role updated: You are now ${newPairRole.toUpperCase()}`, { icon: "🤝" });
            }
            setUsers((prev) =>
              prev.map((u) => (u.username === targetUsername ? { ...u, pairRole: newPairRole } : u))
            );
          }
        );

        // Follow Me Mode Events
        socketRef.current.on(
          ACTIONS.FOLLOW_LEADER_TOGGLE,
          ({
            leaderUsername,
            isActive,
          }: {
            leaderSocketId: string;
            leaderUsername: string;
            isActive: boolean;
          }) => {
            if (isActive) {
              setActiveLeaderName(leaderUsername);
              toast(`${leaderUsername} started leading the session`, { icon: "🎯" });
            } else {
              setActiveLeaderName(null);
              setIsFollowLeader(false);
              toast("Leader session ended", { icon: "🛑" });
            }
          }
        );

        socketRef.current.on(
          ACTIONS.LEADER_NAVIGATE,
          ({
            fileId,
            cursor,
          }: {
            leaderSocketId: string;
            fileId: string;
            cursor?: { from: number; to: number };
          }) => {
            if (isFollowLeaderRef.current && fileId) {
              setActiveFileId(fileId);
              setOpenTabIds((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]));
              if (cursor) {
                // Keep follower in sync with leader
                recordEvent("leader_navigate", { fileId, cursor });
              }
            }
          }
        );

        // Code Review Comments
        socketRef.current.on(
          ACTIONS.COMMENT_ADD,
          ({ comment }: { comment: CodeComment }) => {
            setCodeComments((prev) => [...prev, comment]);
            if (comment.author !== username) {
              toast(`New review comment on line ${comment.lineNumber}`, { icon: "💬" });
            }
          }
        );

        socketRef.current.on(
          ACTIONS.COMMENT_RESOLVE,
          ({ commentId, resolved }: { commentId: string; resolved: boolean }) => {
            setCodeComments((prev) =>
              prev.map((c) => (c.id === commentId ? { ...c, resolved } : c))
            );
          }
        );

        socketRef.current.on(
          ACTIONS.COMMENT_REPLY,
          ({ commentId, reply }: { commentId: string; reply: any }) => {
            setCodeComments((prev) =>
              prev.map((c) =>
                c.id === commentId
                  ? { ...c, replies: [...(c.replies || []), reply] }
                  : c
              )
            );
          }
        );

        // Shared Breakpoints
        socketRef.current.on(
          ACTIONS.BREAKPOINT_TOGGLE,
          ({ breakpoints: updatedBreakpoints }: { breakpoints: Breakpoint[] }) => {
            setBreakpoints(updatedBreakpoints);
          }
        );

        // Interview Mode Update
        socketRef.current.on(
          ACTIONS.INTERVIEW_UPDATE,
          ({ session }: { session: InterviewSession }) => {
            setInterviewSession(session);
          }
        );

        // Session Recording Save
        socketRef.current.on(
          ACTIONS.RECORDING_SAVE,
          ({ recording }: { recording: SessionRecording }) => {
            setSessionRecordings((prev) => [recording, ...prev]);
            toast.success(`Session replay saved: ${recording.title}`);
          }
        );

        // Code running notification
        socketRef.current.on(
          ACTIONS.CODE_RUNNING,
          ({
            username: runnerName,
            filename,
          }: {
            socketId: string;
            username: string;
            filename: string;
          }) => {
            toast(`${runnerName} is running ${filename}...`, {
              icon: "⚡",
              duration: 3000,
            });
          }
        );

        // Code output notification
        socketRef.current.on(
          ACTIONS.CODE_OUTPUT,
          ({
            username: runnerName,
            filename,
            result,
          }: {
            socketId: string;
            username: string;
            filename: string;
            result: ExecutionResult;
          }) => {
            if (result.success) {
              toast.success(`${runnerName}'s ${filename} completed in ${result.executionTimeMs}ms`, {
                duration: 3500,
              });
            } else {
              toast.error(`${runnerName}'s ${filename} failed (Exit ${result.exitCode})`, {
                duration: 4000,
              });
            }
          }
        );

        // User disconnected
        socketRef.current.on(
          ACTIONS.DISCONNECTED,
          ({
            socketId,
            username: leftUser,
          }: {
            socketId: string;
            username: string;
          }) => {
            toast.success(`${leftUser} left the room`);
            setUsers((prev) =>
              prev.filter((user) => user.socketId !== socketId)
            );
          }
        );
      } catch (err) {
        console.error(err);
        toast.error("Connection failed");
      }
    };

    init();

    return () => {
      socketRef.current?.disconnect();
    };
  }, [roomId, username, navigate]);

  // Code change in active file
  const handleCodeChange = useCallback(
    (fileId: string, newCode: string) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, content: newCode } : f))
      );
      recordEvent("code_edit", { fileId, codeLength: newCode.length });
    },
    [recordEvent]
  );

  // Remote code change received for background file
  const handleRemoteCodeChange = useCallback(
    (fileId: string, newCode: string) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, content: newCode } : f))
      );
    },
    []
  );

  // Apply AI code or Chat snippet directly to active file
  const handleApplyCode = useCallback(
    (fileId: string, newCode: string) => {
      handleCodeChange(fileId, newCode);
      if (socketRef.current && roomId) {
        socketRef.current.emit(ACTIONS.CODE_CHANGE, {
          roomId,
          fileId,
          code: newCode,
        });
      }
      toast.success("Code applied to editor");
    },
    [handleCodeChange, roomId]
  );

  // Navigate to file and highlight line
  const handleNavigateToLine = useCallback(
    (fileId: string, lineNumber: number) => {
      if (!openTabIds.includes(fileId)) {
        setOpenTabIds((prev) => [...prev, fileId]);
      }
      setActiveFileId(fileId);
      setHighlightLine(lineNumber);
      setTimeout(() => setHighlightLine(null), 2500);
    },
    [openTabIds]
  );

  // Select file to edit
  const handleSelectFile = useCallback(
    (file: FileItem) => {
      if (!openTabIds.includes(file.id)) {
        setOpenTabIds((prev) => [...prev, file.id]);
      }
      setActiveFileId(file.id);

      recordEvent("switch_tab", { fileId: file.id, filename: file.name });

      if (socketRef.current && roomId) {
        socketRef.current.emit(ACTIONS.USER_ACTIVE_FILE, {
          roomId,
          fileId: file.id,
        });

        // Broadcast file change if user is leading the session
        if (activeLeaderName === username) {
          socketRef.current.emit(ACTIONS.LEADER_NAVIGATE, {
            roomId,
            fileId: file.id,
          });
        }
      }
    },
    [openTabIds, roomId, activeLeaderName, username, recordEvent]
  );

  // Select tab by ID (for TabBar)
  const handleSelectTabById = useCallback(
    (fileId: string) => {
      const file = filesRef.current.find((f) => f.id === fileId);
      if (file) {
        handleSelectFile(file);
      }
    },
    [handleSelectFile]
  );

  // Close tab
  const handleCloseTab = useCallback(
    (fileIdToClose: string) => {
      const nextOpenTabs = openTabIds.filter((id) => id !== fileIdToClose);
      setOpenTabIds(nextOpenTabs);

      if (activeFileId === fileIdToClose) {
        const nextActiveId =
          nextOpenTabs.length > 0 ? nextOpenTabs[nextOpenTabs.length - 1] : null;
        setActiveFileId(nextActiveId);

        if (socketRef.current && roomId) {
          socketRef.current.emit(ACTIONS.USER_ACTIVE_FILE, {
            roomId,
            fileId: nextActiveId,
          });
        }
      }
    },
    [openTabIds, activeFileId, roomId]
  );

  // Create file or folder
  const handleCreateFile = useCallback(
    (name: string, type: "file" | "folder", parentId: string | null = null, initialContent?: string) => {
      const newFile: FileItem = {
        id: uuidv4(),
        name,
        type,
        parentId,
        content: initialContent ?? (type === "file" ? "" : undefined),
      };

      setFiles((prev) => [...prev, newFile]);

      if (type === "file") {
        setOpenTabIds((prev) => [...prev, newFile.id]);
        setActiveFileId(newFile.id);
      }

      if (socketRef.current && roomId) {
        socketRef.current.emit(ACTIONS.FILE_CREATED, {
          roomId,
          file: newFile,
        });
      }

      toast.success(`Created ${type}: ${name}`);
    },
    [roomId]
  );

  // Rename file
  const handleRenameFile = useCallback(
    (id: string, newName: string) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, name: newName } : f))
      );

      if (socketRef.current && roomId) {
        socketRef.current.emit(ACTIONS.FILE_RENAMED, {
          roomId,
          id,
          newName,
        });
      }
    },
    [roomId]
  );

  // Delete file or folder
  const handleDeleteFile = useCallback(
    (id: string) => {
      const findDescendants = (parentId: string): string[] => {
        const children = filesRef.current.filter((f) => f.parentId === parentId);
        let ids: string[] = [];
        for (const child of children) {
          ids.push(child.id);
          if (child.type === "folder") {
            ids = ids.concat(findDescendants(child.id));
          }
        }
        return ids;
      };

      const deletedIds = [id, ...findDescendants(id)];
      const deletedSet = new Set(deletedIds);

      setFiles((prev) => prev.filter((f) => !deletedSet.has(f.id)));
      setOpenTabIds((prev) => prev.filter((tabId) => !deletedSet.has(tabId)));

      setActiveFileId((current) => {
        if (current && deletedSet.has(current)) {
          const remaining = openTabIdsRef.current.filter(
            (tabId) => !deletedSet.has(tabId)
          );
          return remaining.length > 0 ? remaining[0] : null;
        }
        return current;
      });

      if (socketRef.current && roomId) {
        socketRef.current.emit(ACTIONS.FILE_DELETED, {
          roomId,
          id,
        });
      }

      toast.success("Item deleted");
    },
    [roomId]
  );

  // Execute active code file
  const handleRunCode = useCallback(async () => {
    if (!activeFile) {
      toast.error("Please open a file to run");
      return;
    }

    if (executionStatus === "running") {
      toast.error("A process is already running. Click Stop first.");
      return;
    }

    setIsTerminalOpen(true);
    setIsTerminalCollapsed(false);
    setTerminalTab("output");
    setExecutionStatus("running");
    setExecutionResult(null);

    recordEvent("run_code", { filename: activeFile.name });

    if (socketRef.current && roomId) {
      socketRef.current.emit(ACTIONS.CODE_RUNNING, {
        roomId,
        username,
        filename: activeFile.name,
      });
    }

    abortControllerRef.current = new AbortController();

    try {
      const backendUrl = getBackendUrl();
      const primaryUrl = backendUrl ? `${backendUrl}/api/execute` : "/api/execute";
      let response: Response;

      try {
        response = await fetch(primaryUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: getLanguageLabel(activeFile.name),
            filename: activeFile.name,
            code: activeFile.content || "",
            stdin,
          }),
          signal: abortControllerRef.current.signal,
        });
      } catch (directErr: any) {
        if (directErr.name === "AbortError") throw directErr;
        // Retry with relative path via dev proxy if direct origin failed
        if (primaryUrl !== "/api/execute") {
          response = await fetch("/api/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              language: getLanguageLabel(activeFile.name),
              filename: activeFile.name,
              code: activeFile.content || "",
              stdin,
            }),
            signal: abortControllerRef.current.signal,
          });
        } else {
          throw directErr;
        }
      }

      if (!response.ok) {
        throw new Error(`Execution error HTTP ${response.status}`);
      }

      const res: ExecutionResult = await response.json();
      setExecutionResult(res);
      setExecutionStatus(res.status);

      if (socketRef.current && roomId) {
        socketRef.current.emit(ACTIONS.CODE_OUTPUT, {
          roomId,
          username,
          filename: activeFile.name,
          result: res,
        });
      }

      if (res.success) {
        toast.success(`Completed in ${res.executionTimeMs}ms`);
      } else {
        toast.error(`Execution finished with errors`);
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setExecutionStatus("stopped");
        setExecutionResult({
          success: false,
          output: "",
          error: "Execution was terminated by user.",
          executionTimeMs: 0,
          exitCode: 130,
          status: "stopped",
        });
        toast("Execution stopped", { icon: "🛑" });
      } else {
        setExecutionStatus("failed");
        setExecutionResult({
          success: false,
          output: "",
          error: `Execution error: ${err.message}`,
          executionTimeMs: 0,
          exitCode: 1,
          status: "failed",
        });
      }
    }
  }, [activeFile, executionStatus, stdin, roomId, username, recordEvent]);

  // Stop running execution
  const handleStopExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Clear terminal output
  const handleClearTerminal = useCallback(() => {
    setExecutionResult(null);
    setExecutionStatus("idle");
  }, []);

  // Follow Me Mode toggle
  const toggleLeadSession = () => {
    const isCurrentlyLeading = activeLeaderName === username;
    const nextState = !isCurrentlyLeading;

    socketRef.current?.emit(ACTIONS.FOLLOW_LEADER_TOGGLE, {
      roomId,
      leaderUsername: username,
      isActive: nextState,
    });

    if (nextState) {
      setActiveLeaderName(username);
      toast.success("You are now leading the session! Peers will follow your navigation.");
    } else {
      setActiveLeaderName(null);
      toast("You stopped leading the session.");
    }
  };

  const toggleFollowMode = () => {
    setIsFollowLeader((prev) => {
      const next = !prev;
      toast(next ? `Following ${activeLeaderName}` : "Stopped following leader", { icon: "🎯" });
      return next;
    });
  };

  // Copy Room ID
  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId || "");
      toast.success("Room ID copied to clipboard");
    } catch (err) {
      toast.error("Could not copy Room ID");
    }
  };

  // Leave room
  const leaveRoom = () => {
    navigate("/");
  };

  if (!username && !inviteToken) {
    return <Navigate to="/" />;
  }

  const activeLangLabel = activeFile
    ? getLanguageLabel(activeFile.name)
    : "Plain Text";

  // Enforce Viewer / Navigator permission
  const isReadOnly = userRole === "viewer" || pairRole === "navigator";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* VS Code Activity Bar (Leftmost Icon Rail) */}
      <div className="w-12 bg-slate-950 border-r border-slate-800 flex flex-col items-center justify-between py-2 shrink-0 z-20">
        {/* Primary Feature Tabs */}
        <div className="flex flex-col items-center gap-1.5 w-full">
          {/* 1. File Explorer */}
          <button
            type="button"
            title="File Explorer"
            onClick={() => setSidebarTab("explorer")}
            className={`w-9 h-9 rounded-md flex items-center justify-center transition relative ${
              sidebarTab === "explorer"
                ? "bg-slate-800 text-sky-400 border-l-2 border-sky-400"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Files className="w-4 h-4" />
          </button>

          {/* 2. Real-Time Chat */}
          <button
            type="button"
            title="Real-Time Chat"
            onClick={() => {
              setSidebarTab("chat");
              setUnreadChatCount(0);
            }}
            className={`w-9 h-9 rounded-md flex items-center justify-center transition relative ${
              sidebarTab === "chat"
                ? "bg-slate-800 text-sky-400 border-l-2 border-sky-400"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* 3. Version History */}
          <button
            type="button"
            title="Version History & Snapshots"
            onClick={() => setSidebarTab("history")}
            className={`w-9 h-9 rounded-md flex items-center justify-center transition relative ${
              sidebarTab === "history"
                ? "bg-slate-800 text-sky-400 border-l-2 border-sky-400"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <History className="w-4 h-4" />
          </button>

          {/* 4. GitHub Integration */}
          <button
            type="button"
            title="GitHub Integration"
            onClick={() => setSidebarTab("github")}
            className={`w-9 h-9 rounded-md flex items-center justify-center transition relative ${
              sidebarTab === "github"
                ? "bg-slate-800 text-sky-400 border-l-2 border-sky-400"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <FolderGit2 className="w-4 h-4" />
          </button>

          {/* 5. Activity & Metrics */}
          <button
            type="button"
            title="Activity Logs & Contributions"
            onClick={() => setSidebarTab("activity")}
            className={`w-9 h-9 rounded-md flex items-center justify-center transition relative ${
              sidebarTab === "activity"
                ? "bg-slate-800 text-sky-400 border-l-2 border-sky-400"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <ActivityIcon className="w-4 h-4" />
          </button>

          {/* 6. Code Review */}
          <button
            type="button"
            title="Code Review & Inline Comments"
            onClick={() => setSidebarTab("review")}
            className={`w-9 h-9 rounded-md flex items-center justify-center transition relative ${
              sidebarTab === "review"
                ? "bg-slate-800 text-sky-400 border-l-2 border-sky-400"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <MessageSquareCode className="w-4 h-4" />
            {codeComments.filter((c) => !c.resolved).length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-sky-500 text-slate-950 text-[9px] font-bold rounded-full flex items-center justify-center">
                {codeComments.filter((c) => !c.resolved).length}
              </span>
            )}
          </button>

          {/* 7. Interview Mode */}
          <button
            type="button"
            title="Interview Mode & Evaluation"
            onClick={() => setSidebarTab("interview")}
            className={`w-9 h-9 rounded-md flex items-center justify-center transition relative ${
              sidebarTab === "interview"
                ? "bg-slate-800 text-sky-400 border-l-2 border-sky-400"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Briefcase className="w-4 h-4 text-amber-400" />
          </button>

          {/* 8. Shared Debugger */}
          <button
            type="button"
            title="Shared Debugger & Breakpoints"
            onClick={() => setSidebarTab("debugger")}
            className={`w-9 h-9 rounded-md flex items-center justify-center transition relative ${
              sidebarTab === "debugger"
                ? "bg-slate-800 text-sky-400 border-l-2 border-sky-400"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Bug className="w-4 h-4 text-rose-400" />
            {breakpoints.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full" />
            )}
          </button>

          {/* 9. Collaborators */}
          <button
            type="button"
            title="Room Collaborators"
            onClick={() => setSidebarTab("collaborators")}
            className={`w-9 h-9 rounded-md flex items-center justify-center transition relative ${
              sidebarTab === "collaborators"
                ? "bg-slate-800 text-sky-400 border-l-2 border-sky-400"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <UsersIcon className="w-4 h-4" />
            {users.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-slate-950 text-[10px] font-bold rounded-full flex items-center justify-center">
                {users.length}
              </span>
            )}
          </button>

          {/* Terminal Quick Toggle */}
          <button
            type="button"
            title="Toggle Terminal"
            onClick={() => {
              setIsTerminalOpen((prev) => !prev);
              if (isTerminalCollapsed) setIsTerminalCollapsed(false);
            }}
            className={`w-9 h-9 rounded-md flex items-center justify-center transition ${
              isTerminalOpen
                ? "bg-slate-800 text-sky-400 border-l-2 border-sky-400"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <TerminalIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom Utility Modals & Actions */}
        <div className="flex flex-col items-center gap-2 w-full pt-2 border-t border-slate-900">
          {/* Whiteboard Modal Toggle */}
          <button
            type="button"
            title="Collaborative Whiteboard"
            onClick={() => setIsWhiteboardOpen(true)}
            className="w-8 h-8 rounded flex items-center justify-center text-slate-400 hover:text-sky-400 hover:bg-slate-900 transition"
          >
            <Palette className="w-4 h-4" />
          </button>

          {/* Video Call Modal Toggle */}
          <button
            type="button"
            title="Voice & Video Calling"
            onClick={() => setIsVideoCallOpen(true)}
            className="w-8 h-8 rounded flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:bg-slate-900 transition"
          >
            <PhoneCall className="w-4 h-4" />
          </button>

          {/* Permissions & Roles Modal Toggle */}
          <button
            type="button"
            title="Room Permissions & Roles"
            onClick={() => setIsPermissionsOpen(true)}
            className="w-8 h-8 rounded flex items-center justify-center text-slate-400 hover:text-amber-400 hover:bg-slate-900 transition"
          >
            <ShieldCheck className="w-4 h-4" />
          </button>

          {/* Session Recording & Replay */}
          <button
            type="button"
            title="Session Recording & Replay"
            onClick={() => setIsReplayOpen(true)}
            className={`w-8 h-8 rounded flex items-center justify-center transition ${
              isRecording
                ? "text-rose-400 bg-rose-500/20"
                : "text-slate-400 hover:text-purple-400 hover:bg-slate-900"
            }`}
          >
            <Video className="w-4 h-4" />
          </button>

          {/* Copy Room ID */}
          <button
            type="button"
            title="Copy Room ID"
            onClick={copyRoomId}
            className="w-8 h-8 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-900 transition"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Leave Room */}
          <button
            type="button"
            title="Leave Room"
            onClick={leaveRoom}
            className="w-8 h-8 rounded flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Primary Sidebar Panels */}
      <div className="w-64 sm:w-72 bg-slate-900 flex flex-col border-r border-slate-800 shrink-0">
        {sidebarTab === "explorer" && (
          <FileExplorer
            files={files}
            activeFileId={activeFileId}
            onSelectFile={handleSelectTabById}
            onCreateFile={handleCreateFile}
            onRenameFile={handleRenameFile}
            onDeleteFile={handleDeleteFile}
            users={users}
            roomId={roomId}
          />
        )}

        {sidebarTab === "chat" && (
          <ChatPanel
            messages={chatMessages}
            onSendMessage={(text, isCodeSnippet, lang) => {
              const msg: ChatMessage = {
                id: `msg_${Date.now()}`,
                sender: username,
                text,
                isCodeSnippet,
                language: lang,
                timestamp: new Date().toISOString(),
              };
              socketRef.current?.emit(ACTIONS.CHAT_MESSAGE, { roomId, message: msg });
            }}
            onSendTyping={(isTyping) => {
              socketRef.current?.emit(ACTIONS.CHAT_TYPING, { roomId, username, isTyping });
            }}
            typingUsers={typingUsers}
            currentUsername={username}
            activeCodeSnippet={activeFile?.content}
            activeLanguage={activeFile ? getLanguageLabel(activeFile.name) : "javascript"}
            onInsertCode={(code) => {
              if (activeFile) {
                handleApplyCode(activeFile.id, code);
              }
            }}
          />
        )}

        {sidebarTab === "history" && (
          <VersionHistoryPanel
            snapshots={versionSnapshots}
            currentFiles={files}
            activeFileId={activeFileId}
            currentUsername={username}
            onCreateSnapshot={(label) => {
              socketRef.current?.emit(ACTIONS.SNAPSHOT_CREATE, {
                roomId,
                author: username,
                label,
              });
            }}
            onRestoreSnapshot={(snapshotId, fileId) => {
              socketRef.current?.emit(ACTIONS.SNAPSHOT_RESTORE, {
                roomId,
                snapshotId,
                fileId,
                username,
              });
            }}
          />
        )}

        {sidebarTab === "github" && (
          <GitHubPanel
            roomId={roomId || ""}
            files={files}
            onImportFiles={(imported) => {
              setFiles(imported);
              if (imported.length > 0) {
                const first = imported.find((f) => f.type === "file");
                if (first) {
                  setOpenTabIds([first.id]);
                  setActiveFileId(first.id);
                }
              }
            }}
          />
        )}

        {sidebarTab === "activity" && (
          <ActivityPanel
            activityLogs={activityLogs}
            users={users}
            sessionStartTime={sessionStartTime}
          />
        )}

        {sidebarTab === "review" && (
          <CodeReviewPanel
            socketRef={socketRef}
            roomId={roomId || ""}
            username={username}
            comments={codeComments}
            activeFile={activeFile}
            files={files}
            onNavigateToLine={handleNavigateToLine}
          />
        )}

        {sidebarTab === "interview" && (
          <InterviewPanel
            socketRef={socketRef}
            roomId={roomId || ""}
            username={username}
            interviewSession={interviewSession}
            activeFile={activeFile}
            isOwner={userRole === "owner"}
          />
        )}

        {sidebarTab === "debugger" && (
          <DebuggerPanel
            socketRef={socketRef}
            roomId={roomId || ""}
            breakpoints={breakpoints}
            activeFile={activeFile}
            files={files}
            onNavigateToLine={handleNavigateToLine}
          />
        )}

        {sidebarTab === "collaborators" && (
          <div className="flex flex-col h-full bg-slate-900">
            {/* Collaborators Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-300 uppercase">
                <UsersIcon className="w-4 h-4 text-sky-400" />
                <span>Room Members ({users.length})</span>
              </div>
            </div>

            {/* Collaborators List */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2">
              {users.map((user) => {
                const viewingFile = files.find((f) => f.id === user.activeFileId);
                const isCurrent = user.username === username;
                const role = user.role || (isCurrent ? userRole : "editor");
                const currentPair = user.pairRole || "driver";

                return (
                  <div
                    key={user.socketId}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <Users username={user.username} />
                      <div>
                        <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                          {user.username}
                          {isCurrent && (
                            <span className="text-[10px] text-sky-400 bg-sky-500/10 px-1 rounded">
                              you
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                          <span className="uppercase text-slate-500">{role}</span>
                          <span>•</span>
                          <span className="text-emerald-400 uppercase">{currentPair}</span>
                        </div>
                        {viewingFile && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate max-w-[120px]">
                            <span>Viewing:</span>
                            <span className="text-sky-300 font-mono truncate">
                              {viewingFile.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20" />
                  </div>
                );
              })}
            </div>

            {/* Quick Action Footer in Sidebar */}
            <div className="p-3 border-t border-slate-800 flex flex-col gap-2 bg-slate-950/40">
              <button
                type="button"
                onClick={copyRoomId}
                className="w-full flex items-center justify-center gap-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-md transition border border-slate-700"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Room ID</span>
              </button>
              <button
                type="button"
                onClick={leaveRoom}
                className="w-full flex items-center justify-center gap-2 text-xs font-semibold bg-red-600/80 hover:bg-red-600 text-white py-2 rounded-md transition shadow"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave Room</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Work Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-900">
        {/* Top Floating Notification / Role / Follow Me Banner */}
        <div className="h-8 bg-slate-950/90 border-b border-slate-800 px-3 flex items-center justify-between text-xs">
          {/* Left: Role & Pair Programming Indicator */}
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1 text-[11px] font-mono text-slate-300">
              <span>Role:</span>
              <strong className={`uppercase ${userRole === "owner" ? "text-amber-400" : userRole === "viewer" ? "text-rose-400" : "text-sky-400"}`}>
                {userRole}
              </strong>
              {roomOwner && (
                <span className="text-[10px] text-slate-500 font-sans hidden md:inline">
                  (Owner: {roomOwner})
                </span>
              )}
            </span>

            <span className="text-slate-700">|</span>

            <span className="flex items-center gap-1 text-[11px] font-mono">
              <span className="text-slate-400">Pair:</span>
              <strong className={`uppercase ${pairRole === "driver" ? "text-emerald-400" : "text-purple-400"}`}>
                {pairRole}
              </strong>
              {pairRole === "navigator" && (
                <span className="text-[10px] text-slate-500 font-sans">(Read-Only)</span>
              )}
            </span>

            {isReadOnly && (
              <span className="text-[10px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/20 font-semibold">
                Viewing Mode
              </span>
            )}
          </div>

          {/* Right: Follow Me Mode Controls */}
          <div className="flex items-center gap-2">
            {activeLeaderName ? (
              activeLeaderName === username ? (
                <button
                  onClick={toggleLeadSession}
                  className="flex items-center gap-1 text-[11px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 transition animate-pulse"
                >
                  <Radio className="w-3 h-3 text-amber-400" />
                  <span>You are Leading Session (Stop)</span>
                </button>
              ) : (
                <button
                  onClick={toggleFollowMode}
                  className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition ${
                    isFollowLeader
                      ? "bg-sky-500/20 border-sky-500/30 text-sky-300 font-semibold"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  <span>{isFollowLeader ? `Following ${activeLeaderName}` : `Follow ${activeLeaderName}`}</span>
                </button>
              )
            ) : (
              <button
                onClick={toggleLeadSession}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-sky-300 hover:bg-slate-900 px-2 py-0.5 rounded transition"
                title="Lead others: their editors will follow your navigation"
              >
                <Radio className="w-3 h-3" />
                <span>Lead Session</span>
              </button>
            )}
          </div>
        </div>

        {/* Editor Tabs Bar */}
        <TabBar
          openTabIds={openTabIds}
          activeFileId={activeFileId}
          files={files}
          onSelectTab={handleSelectTabById}
          onCloseTab={handleCloseTab}
          onNewFileClick={() => handleCreateFile(`new_file_${openTabIds.length + 1}.js`, "file", null)}
          users={users}
          onRunCode={handleRunCode}
          isRunning={executionStatus === "running"}
          activeFileLanguage={activeLangLabel}
          isTerminalOpen={isTerminalOpen}
          onToggleTerminal={() => {
            setIsTerminalOpen((prev) => !prev);
            if (isTerminalCollapsed) setIsTerminalCollapsed(false);
          }}
        />

        {/* Editor Panel or Empty State */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
          {activeFile ? (
            <EditorPanel
              socketRef={socketRef}
              roomId={roomId}
              activeFile={activeFile}
              files={files}
              onCodeChange={handleCodeChange}
              onRemoteCodeChange={handleRemoteCodeChange}
              onRunCode={handleRunCode}
              isReadOnly={isReadOnly}
              highlightLine={highlightLine}
            />
          ) : (
            <EmptyEditor
              onNewFileClick={() =>
                handleCreateFile(`new_file_${openTabIds.length + 1}.js`, "file", null)
              }
            />
          )}
        </div>

        {/* Docked Resizable Terminal Panel */}
        <TerminalPanel
          isOpen={isTerminalOpen}
          onClose={() => setIsTerminalOpen(false)}
          height={terminalHeight}
          setHeight={setTerminalHeight}
          isMaximized={isTerminalMaximized}
          setIsMaximized={setIsTerminalMaximized}
          isCollapsed={isTerminalCollapsed}
          setIsCollapsed={setIsTerminalCollapsed}
          result={executionResult}
          status={executionStatus}
          stdin={stdin}
          setStdin={setStdin}
          onClear={handleClearTerminal}
          onStop={handleStopExecution}
          onRun={handleRunCode}
          activeFileName={activeFile?.name}
          activeLanguage={activeLangLabel}
          terminalTab={terminalTab}
          setTerminalTab={setTerminalTab}
        />
      </div>

      {/* 6. Voice & Video Collaboration Modal / Sidebar Overlay */}
      <VideoCallPanel
        socketRef={socketRef}
        roomId={roomId || ""}
        username={username}
        isOpen={isVideoCallOpen}
        onClose={() => setIsVideoCallOpen(false)}
      />

      {/* 7. Collaborative Whiteboard Modal */}
      <WhiteboardModal
        isOpen={isWhiteboardOpen}
        onClose={() => setIsWhiteboardOpen(false)}
        socketRef={socketRef}
        roomId={roomId || ""}
        initialElements={whiteboardElements}
      />

      {/* 11 & 12 & 16. Permissions, Pair Programming & Anonymous Rooms Modal */}
      <PermissionsModal
        isOpen={isPermissionsOpen}
        onClose={() => setIsPermissionsOpen(false)}
        socketRef={socketRef}
        roomId={roomId || ""}
        currentUser={username}
        users={users}
        userRole={userRole}
        pairRole={pairRole}
        settings={roomSettings}
      />

      {/* 17. Session Recording & Replay Modal */}
      <SessionReplayModal
        isOpen={isReplayOpen}
        onClose={() => setIsReplayOpen(false)}
        socketRef={socketRef}
        roomId={roomId || ""}
        recordings={sessionRecordings}
        activeRecordingEvents={activeRecordingEvents}
        isRecording={isRecording}
        onToggleRecording={() => {
          setIsRecording((prev) => {
            const next = !prev;
            toast(next ? "Session recording started" : "Session recording paused", {
              icon: next ? "🔴" : "⏸️",
            });
            return next;
          });
        }}
      />
    </div>
  );
}
