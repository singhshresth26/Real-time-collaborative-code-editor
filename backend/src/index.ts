import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import path from "path";
import cors from "cors";
import { Server, Socket } from "socket.io";
import ACTIONS from "./actions";
import { connectDB } from "./db";
import {
    getOrCreateRoom,
    updateFileContent,
    createFileOrFolder,
    renameFileOrFolder,
    deleteFileOrFolder,
    flushPendingSavesForRoom,
    addChatMessage,
    createVersionSnapshot,
    restoreVersionSnapshot,
    saveWhiteboardElements,
    logActivity,
    addCodeComment,
    resolveCodeComment,
    addCommentReply,
    updateMemberRole,
    updatePairRole,
    updateInterviewSession,
    toggleBreakpoint,
    saveSessionRecording,
} from "./roomService";
import { IFileItem, IChatMessage, ICodeComment, IInterviewSession, ISessionRecording } from "./models/Room";
import { runCode } from "./codeRunner";
import { importFromGitHub, getGitHubCommits } from "./githubService";

const app = express();
const server = http.createServer(app);

// Enable CORS for all cross-origin requests (e.g. Vite on 5173, LAN IP, remote devices)
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
}));

// Fallback manual CORS header handler for all responses and preflight OPTIONS
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 1. Code execution endpoint
app.post("/api/execute", async (req, res) => {
    try {
        const { language, code, stdin, filename } = req.body;
        if (!code || typeof code !== "string") {
            return res.status(400).json({
                success: false,
                output: "",
                error: "No code provided to execute",
                executionTimeMs: 0,
                exitCode: 1,
                status: "failed",
            });
        }

        const result = await runCode(filename || language || "python", code, stdin || "");
        res.json(result);
    } catch (err: any) {
        console.error("Execution API error:", err);
        res.status(500).json({
            success: false,
            output: "",
            error: err.message || "Execution server error",
            executionTimeMs: 0,
            exitCode: 1,
            status: "failed",
        });
    }
});

// 2. GitHub Integration endpoints
app.post("/api/github/import", async (req, res) => {
    try {
        const { repo, token, roomId } = req.body;
        const result = await importFromGitHub(repo, token);
        if (result.success && roomId && result.files.length > 0) {
            // Also log activity in the room
            await logActivity(roomId, "System", "github_import", repo, `Imported ${result.files.length} files from GitHub`);
        }
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ success: false, files: [], error: err.message });
    }
});

app.get("/api/github/commits", async (req, res) => {
    try {
        const repo = req.query.repo as string;
        const token = req.query.token as string | undefined;
        if (!repo) return res.status(400).json([]);
        const commits = await getGitHubCommits(repo, token);
        res.json(commits);
    } catch {
        res.status(500).json([]);
    }
});

// 4. Room Data query endpoint
app.get("/api/room/:roomId", async (req, res) => {
    try {
        const room = await getOrCreateRoom(req.params.roomId);
        res.json(room);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

type Client = {
    socketId: string;
    username: string;
};

const userSocketMap: Record<string, string> = {};

const getAllConnectedClients = (roomId: string): Client[] => {
    const room = io.sockets.adapter.rooms.get(roomId);

    if (!room) return [];

    return Array.from(room).map((socketId) => ({
        socketId,
        username: userSocketMap[socketId] ?? "",
    }));
};

const buildPath = path.join(__dirname, "..", "build");
app.use(express.static(buildPath));

app.use((req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
});

io.on("connection", (socket: Socket) => {
    console.log("Socket connected:", socket.id);

    socket.on(
        ACTIONS.JOIN,
        async ({ roomId, username }: { roomId: string; username: string }) => {
            userSocketMap[socket.id] = username;
            socket.join(roomId);

            try {
                // Retrieve or initialize complete project from MongoDB
                const room = await getOrCreateRoom(roomId, username);

                const clients = getAllConnectedClients(roomId);

                // Log join activity
                await logActivity(roomId, username, "member_joined", undefined, "Joined the collaboration room");

                // Notify all clients in the room about the new participant
                clients.forEach(({ socketId }) => {
                    io.to(socketId).emit(ACTIONS.JOINED, {
                        clients,
                        username,
                        socketId: socket.id,
                    });
                });

                // Send files to newly joined client
                socket.emit(ACTIONS.SYNC_FILES, { files: room.files });

                // Synchronize complete room data (chat, snapshots, whiteboard, comments, interview, breakpoints, settings)
                socket.emit(ACTIONS.ROOM_DATA_SYNC, {
                    room: {
                        roomId: room.roomId,
                        owner: room.owner,
                        members: room.members,
                        chatMessages: room.chatMessages,
                        versionSnapshots: room.versionSnapshots,
                        whiteboardElements: room.whiteboardElements,
                        activityLogs: room.activityLogs,
                        codeComments: room.codeComments,
                        interviewSession: room.interviewSession,
                        breakpoints: room.breakpoints,
                        settings: room.settings,
                    },
                });
            } catch (error) {
                console.error("Error during room join:", error);
            }
        }
    );

    // Code changes with granular deltas
    socket.on(
        ACTIONS.CODE_CHANGE,
        ({
            roomId,
            fileId,
            changes,
            code,
        }: {
            roomId: string;
            fileId?: string;
            changes?: { from: number; to: number; insert: string }[];
            code: string;
        }) => {
            if (fileId) {
                updateFileContent(roomId, fileId, code);
                socket.to(roomId).emit(ACTIONS.CODE_CHANGE, {
                    fileId,
                    changes,
                    code,
                    socketId: socket.id,
                });
            } else {
                socket.to(roomId).emit(ACTIONS.CODE_CHANGE, { code });
            }
        }
    );

    socket.on(
        ACTIONS.SYNC_CODE,
        ({
            socketId,
            code,
            fileId,
        }: {
            socketId: string;
            code: string;
            fileId?: string;
        }) => {
            io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code, fileId });
        }
    );

    // Broadcast cursor position and text selection
    socket.on(
        ACTIONS.CURSOR_MOVE,
        ({
            roomId,
            fileId,
            from,
            to,
        }: {
            roomId: string;
            fileId: string;
            from: number;
            to: number;
        }) => {
            socket.to(roomId).emit(ACTIONS.CURSOR_MOVE, {
                socketId: socket.id,
                username: userSocketMap[socket.id] || "Collaborator",
                fileId,
                from,
                to,
            });
        }
    );

    // Create file or folder
    socket.on(
        ACTIONS.FILE_CREATED,
        async ({ roomId, file }: { roomId: string; file: IFileItem }) => {
            try {
                await createFileOrFolder(roomId, file);
                await logActivity(roomId, userSocketMap[socket.id] || "User", "created_file", file.name, `Created ${file.type} "${file.name}"`);
                io.to(roomId).emit(ACTIONS.FILE_CREATED, { file });
            } catch (err) {
                console.error("Error creating file/folder:", err);
            }
        }
    );

    // Rename file or folder
    socket.on(
        ACTIONS.FILE_RENAMED,
        async ({
            roomId,
            id,
            newName,
        }: {
            roomId: string;
            id: string;
            newName: string;
        }) => {
            try {
                await renameFileOrFolder(roomId, id, newName);
                await logActivity(roomId, userSocketMap[socket.id] || "User", "renamed_file", newName, `Renamed item to "${newName}"`);
                io.to(roomId).emit(ACTIONS.FILE_RENAMED, { id, newName });
            } catch (err) {
                console.error("Error renaming file/folder:", err);
            }
        }
    );

    // Delete file or folder
    socket.on(
        ACTIONS.FILE_DELETED,
        async ({ roomId, id }: { roomId: string; id: string }) => {
            try {
                const { deletedIds } = await deleteFileOrFolder(roomId, id);
                await logActivity(roomId, userSocketMap[socket.id] || "User", "deleted_file", id, `Deleted item and descendants (${deletedIds.length})`);
                io.to(roomId).emit(ACTIONS.FILE_DELETED, { id, deletedIds });
            } catch (err) {
                console.error("Error deleting file/folder:", err);
            }
        }
    );

    // Broadcast active file
    socket.on(
        ACTIONS.USER_ACTIVE_FILE,
        ({ roomId, fileId }: { roomId: string; fileId: string | null }) => {
            socket.to(roomId).emit(ACTIONS.USER_ACTIVE_FILE, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
                fileId,
            });
        }
    );

    // Code execution notifications
    socket.on(
        ACTIONS.CODE_RUNNING,
        ({
            roomId,
            filename,
            username,
        }: {
            roomId: string;
            filename: string;
            username: string;
        }) => {
            logActivity(roomId, username, "executed_code", filename, `Executed file: ${filename}`).catch(console.error);
            socket.to(roomId).emit(ACTIONS.CODE_RUNNING, {
                socketId: socket.id,
                username,
                filename,
            });
        }
    );

    socket.on(
        ACTIONS.CODE_OUTPUT,
        ({
            roomId,
            filename,
            username,
            result,
        }: {
            roomId: string;
            filename: string;
            username: string;
            result: any;
        }) => {
            socket.to(roomId).emit(ACTIONS.CODE_OUTPUT, {
                socketId: socket.id,
                username,
                filename,
                result,
            });
        }
    );

    // 2. Real-Time Chat Events
    socket.on(
        ACTIONS.CHAT_MESSAGE,
        async ({ roomId, message }: { roomId: string; message: IChatMessage }) => {
            try {
                const saved = await addChatMessage(roomId, message);
                io.to(roomId).emit(ACTIONS.CHAT_MESSAGE, { message: saved });
            } catch (err) {
                console.error("Chat message error:", err);
            }
        }
    );

    socket.on(
        ACTIONS.CHAT_TYPING,
        ({ roomId, username, isTyping }: { roomId: string; username: string; isTyping: boolean }) => {
            socket.to(roomId).emit(ACTIONS.CHAT_TYPING, {
                socketId: socket.id,
                username,
                isTyping,
            });
        }
    );

    // 4. Version History Events
    socket.on(
        ACTIONS.SNAPSHOT_CREATE,
        async ({ roomId, author, label }: { roomId: string; author: string; label: string }) => {
            try {
                const snapshot = await createVersionSnapshot(roomId, author, label);
                if (snapshot) {
                    await logActivity(roomId, author, "created_snapshot", label, `Created version checkpoint: "${label}"`);
                    io.to(roomId).emit(ACTIONS.SNAPSHOT_CREATE, { snapshot });
                }
            } catch (err) {
                console.error("Snapshot creation error:", err);
            }
        }
    );

    socket.on(
        ACTIONS.SNAPSHOT_RESTORE,
        async ({ roomId, snapshotId, fileId, username }: { roomId: string; snapshotId: string; fileId?: string; username: string }) => {
            try {
                const res = await restoreVersionSnapshot(roomId, snapshotId, fileId);
                if (res) {
                    await logActivity(roomId, username, "restored_snapshot", res.restoredSnapshot.label, `Restored files from snapshot "${res.restoredSnapshot.label}"`);
                    io.to(roomId).emit(ACTIONS.SNAPSHOT_RESTORE, {
                        files: res.files,
                        restoredSnapshot: res.restoredSnapshot,
                        fileId,
                    });
                }
            } catch (err) {
                console.error("Snapshot restore error:", err);
            }
        }
    );

    // 7. Collaborative Whiteboard Events
    socket.on(
        ACTIONS.WHITEBOARD_DRAW,
        ({ roomId, elements }: { roomId: string; elements: any[] }) => {
            // Forward stroke to collaborators
            socket.to(roomId).emit(ACTIONS.WHITEBOARD_DRAW, { elements });
            // Debounce save to MongoDB
            saveWhiteboardElements(roomId, elements).catch(console.error);
        }
    );

    socket.on(
        ACTIONS.WHITEBOARD_CLEAR,
        async ({ roomId }: { roomId: string }) => {
            try {
                await saveWhiteboardElements(roomId, []);
                io.to(roomId).emit(ACTIONS.WHITEBOARD_CLEAR);
            } catch (err) {
                console.error("Whiteboard clear error:", err);
            }
        }
    );

    // 10. Follow Me Mode Events
    socket.on(
        ACTIONS.FOLLOW_LEADER_TOGGLE,
        ({ roomId, leaderUsername, isActive }: { roomId: string; leaderUsername: string; isActive: boolean }) => {
            socket.to(roomId).emit(ACTIONS.FOLLOW_LEADER_TOGGLE, {
                leaderSocketId: socket.id,
                leaderUsername,
                isActive,
            });
        }
    );

    socket.on(
        ACTIONS.LEADER_NAVIGATE,
        ({ roomId, fileId, cursor }: { roomId: string; fileId: string; cursor?: { from: number; to: number } }) => {
            socket.to(roomId).emit(ACTIONS.LEADER_NAVIGATE, {
                leaderSocketId: socket.id,
                fileId,
                cursor,
            });
        }
    );

    // 11 & 12. Permissions & Pair Programming Roles
    socket.on(
        ACTIONS.ROLE_CHANGE,
        async ({ roomId, targetUsername, role }: { roomId: string; targetUsername: string; role: "owner" | "editor" | "viewer" }) => {
            try {
                await updateMemberRole(roomId, targetUsername, role);
                await logActivity(roomId, userSocketMap[socket.id] || "Owner", "role_changed", targetUsername, `Changed role of ${targetUsername} to ${role}`);
                io.to(roomId).emit(ACTIONS.ROLE_CHANGE, { targetUsername, role });
            } catch (err) {
                console.error("Role change error:", err);
            }
        }
    );

    socket.on(
        ACTIONS.PAIR_ROLE_CHANGE,
        async ({ roomId, targetUsername, pairRole }: { roomId: string; targetUsername: string; pairRole: "driver" | "navigator" }) => {
            try {
                await updatePairRole(roomId, targetUsername, pairRole);
                io.to(roomId).emit(ACTIONS.PAIR_ROLE_CHANGE, { targetUsername, pairRole });
            } catch (err) {
                console.error("Pair role error:", err);
            }
        }
    );

    // 13. Code Review Comments
    socket.on(
        ACTIONS.COMMENT_ADD,
        async ({ roomId, comment }: { roomId: string; comment: ICodeComment }) => {
            try {
                const saved = await addCodeComment(roomId, comment);
                await logActivity(roomId, comment.author, "added_comment", `Line ${comment.lineNumber}`, comment.content);
                io.to(roomId).emit(ACTIONS.COMMENT_ADD, { comment: saved });
            } catch (err) {
                console.error("Add comment error:", err);
            }
        }
    );

    socket.on(
        ACTIONS.COMMENT_RESOLVE,
        async ({ roomId, commentId, resolved }: { roomId: string; commentId: string; resolved: boolean }) => {
            try {
                await resolveCodeComment(roomId, commentId, resolved);
                io.to(roomId).emit(ACTIONS.COMMENT_RESOLVE, { commentId, resolved });
            } catch (err) {
                console.error("Resolve comment error:", err);
            }
        }
    );

    socket.on(
        ACTIONS.COMMENT_REPLY,
        async ({
            roomId,
            commentId,
            reply,
        }: {
            roomId: string;
            commentId: string;
            reply: { id: string; author: string; content: string; createdAt: Date };
        }) => {
            try {
                await addCommentReply(roomId, commentId, reply);
                io.to(roomId).emit(ACTIONS.COMMENT_REPLY, { commentId, reply });
            } catch (err) {
                console.error("Comment reply error:", err);
            }
        }
    );

    // 14. Interview Mode
    socket.on(
        ACTIONS.INTERVIEW_UPDATE,
        async ({ roomId, session }: { roomId: string; session: IInterviewSession }) => {
            try {
                await updateInterviewSession(roomId, session);
                io.to(roomId).emit(ACTIONS.INTERVIEW_UPDATE, { session });
            } catch (err) {
                console.error("Interview update error:", err);
            }
        }
    );

    // 15. Shared Breakpoints
    socket.on(
        ACTIONS.BREAKPOINT_TOGGLE,
        async ({ roomId, fileId, lineNumber }: { roomId: string; fileId: string; lineNumber: number }) => {
            try {
                const updatedBreakpoints = await toggleBreakpoint(roomId, fileId, lineNumber);
                io.to(roomId).emit(ACTIONS.BREAKPOINT_TOGGLE, {
                    fileId,
                    lineNumber,
                    breakpoints: updatedBreakpoints,
                });
            } catch (err) {
                console.error("Breakpoint toggle error:", err);
            }
        }
    );

    // 6. WebRTC Voice & Video Calling Signaling
    socket.on(
        ACTIONS.WEBRTC_SIGNAL,
        ({ targetSocketId, signal, username }: { targetSocketId: string; signal: any; username: string }) => {
            io.to(targetSocketId).emit(ACTIONS.WEBRTC_SIGNAL, {
                fromSocketId: socket.id,
                username,
                signal,
            });
        }
    );

    socket.on(
        ACTIONS.WEBRTC_USER_JOINED,
        ({ roomId, username }: { roomId: string; username: string }) => {
            socket.to(roomId).emit(ACTIONS.WEBRTC_USER_JOINED, {
                socketId: socket.id,
                username,
            });
        }
    );

    socket.on(
        ACTIONS.WEBRTC_USER_LEFT,
        ({ roomId }: { roomId: string }) => {
            socket.to(roomId).emit(ACTIONS.WEBRTC_USER_LEFT, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        }
    );

    socket.on(
        ACTIONS.WEBRTC_MEDIA_STATE,
        ({
            roomId,
            isAudioMuted,
            isVideoOff,
            isScreenSharing,
        }: {
            roomId: string;
            isAudioMuted: boolean;
            isVideoOff: boolean;
            isScreenSharing: boolean;
        }) => {
            socket.to(roomId).emit(ACTIONS.WEBRTC_MEDIA_STATE, {
                socketId: socket.id,
                isAudioMuted,
                isVideoOff,
                isScreenSharing,
            });
        }
    );

    // 17. Session Recording
    socket.on(
        ACTIONS.RECORDING_SAVE,
        async ({ roomId, recording }: { roomId: string; recording: ISessionRecording }) => {
            try {
                await saveSessionRecording(roomId, recording);
                io.to(roomId).emit(ACTIONS.RECORDING_SAVE, { recording });
            } catch (err) {
                console.error("Session recording save error:", err);
            }
        }
    );

    socket.on("disconnecting", () => {
        const rooms = [...socket.rooms];

        rooms.forEach((roomId) => {
            flushPendingSavesForRoom(roomId).catch(console.error);

            // Notify WebRTC call departure if connected
            socket.to(roomId).emit(ACTIONS.WEBRTC_USER_LEFT, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });

            socket.to(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });

        delete userSocketMap[socket.id];
    });
});

const PORT = process.env.PORT ?? 5000;

// Connect to MongoDB and start server
connectDB().then(() => {
    server.listen(Number(PORT), "0.0.0.0", () => {
        console.log(`Server running on port ${PORT} (0.0.0.0)`);
    });
});
