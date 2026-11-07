import {
    Room,
    IFileItem,
    IChatMessage,
    IVersionSnapshot,
    IActivityLog,
    ICodeComment,
    IInterviewSession,
    IBreakpoint,
    ISessionRecording,
    IRoomDoc,
} from "./models/Room";
import crypto from "crypto";

export const getDefaultFiles = (): IFileItem[] => [
    {
        id: "folder-src",
        name: "src",
        type: "folder",
        parentId: null,
        updatedAt: new Date(),
    },
    {
        id: "file-index-js",
        name: "index.js",
        type: "file",
        parentId: "folder-src",
        content: `// Welcome to your Real-Time Collaborative Development Platform!\n// Features include:\n// ⚡ Real-Time Collaboration & Multi-Cursor\n// 💬 Integrated Chat & Code Snippets\n// 🚀 Code Execution for C++, C, Java, Python, JS\n// 📜 Version History & Diff Viewer\n// 🤖 AI Coding Assistant\n// 🎨 Collaborative Whiteboard\n// 🐙 GitHub Integration\n// 📹 Voice & Video Calling (WebRTC)\n\nfunction main() {\n  console.log("Welcome to your collaborative workspace!");\n}\n\nmain();\n`,
        updatedAt: new Date(),
    },
    {
        id: "file-styles-css",
        name: "styles.css",
        type: "file",
        parentId: "folder-src",
        content: `/* Workspace Stylesheet */\n:root {\n  --primary: #38bdf8;\n  --background: #0f172a;\n}\n`,
        updatedAt: new Date(),
    },
    {
        id: "file-main-py",
        name: "main.py",
        type: "file",
        parentId: null,
        content: `# Python Starter Script\ndef greet(name):\n    return f"Hello {name}, welcome to collaborative coding!"\n\nif __name__ == "__main__":\n    print(greet("Developer"))\n`,
        updatedAt: new Date(),
    },
    {
        id: "file-readme-md",
        name: "README.md",
        type: "file",
        parentId: null,
        content: `# Collaborative Code Project\n\nWelcome to your full-featured collaborative development platform!\n`,
        updatedAt: new Date(),
    },
];

// Debounce map for code saves: roomId:fileId -> { timeout, content }
const pendingCodeSaves = new Map<string, { timeout: NodeJS.Timeout; content: string }>();
const inMemoryFileContents = new Map<string, string>();

const getMemoryKey = (roomId: string, fileId: string) => `${roomId}:${fileId}`;

export const getOrCreateRoom = async (
    roomId: string,
    username?: string
): Promise<IRoomDoc> => {
    let room = await Room.findOne({ roomId });

    if (!room) {
        const defaultFiles = getDefaultFiles();
        const initialSnap: IVersionSnapshot = {
            id: `snap-${crypto.randomUUID()}`,
            label: "Initial Project Template",
            author: username || "System",
            files: defaultFiles,
            createdAt: new Date(),
        };

        room = await Room.create({
            roomId,
            owner: username || "Owner",
            files: defaultFiles,
            members: [
                {
                    username: username || "Anonymous",
                    role: "owner",
                    pairRole: "driver",
                    joinedAt: new Date(),
                },
            ],
            chatMessages: [
                {
                    id: `msg-${crypto.randomUUID()}`,
                    sender: "System",
                    text: `Welcome to room "${roomId}"! Use the sidebar to chat, execute code, access version history, or start a whiteboard session.`,
                    isCodeSnippet: false,
                    timestamp: new Date(),
                },
            ],
            versionSnapshots: [initialSnap],
            whiteboardElements: [],
            activityLogs: [
                {
                    id: `act-${crypto.randomUUID()}`,
                    username: username || "System",
                    action: "created_room",
                    details: "Room created with template files",
                    timestamp: new Date(),
                },
            ],
            codeComments: [],
            breakpoints: [],
            sessionRecordings: [],
            settings: {
                allowAnonymous: true,
                anonymousDefaultRole: "editor",
                inviteToken: crypto.randomUUID().slice(0, 8),
            },
        });
    } else if (username) {
        // Add member if not in members list
        const exists = room.members.some((m) => m.username === username);
        if (!exists) {
            const defaultRole = room.settings?.anonymousDefaultRole || "editor";
            room.members.push({
                username,
                role: defaultRole,
                pairRole: "navigator",
                joinedAt: new Date(),
            });
            await room.save();
        }
    }

    // Overlay pending in-memory file contents
    const mergedFiles = room.files.map((file) => {
        const fileObj = typeof (file as any).toObject === "function" ? (file as any).toObject() : file;
        const memoryKey = getMemoryKey(roomId, fileObj.id);
        if (inMemoryFileContents.has(memoryKey)) {
            return {
                ...fileObj,
                content: inMemoryFileContents.get(memoryKey),
            };
        }
        return fileObj;
    });

    room.files = mergedFiles as any;
    return room;
};

export const updateFileContent = (roomId: string, fileId: string, content: string): void => {
    const memoryKey = getMemoryKey(roomId, fileId);
    inMemoryFileContents.set(memoryKey, content);

    const pending = pendingCodeSaves.get(memoryKey);
    if (pending) {
        clearTimeout(pending.timeout);
    }

    const timeout = setTimeout(async () => {
        try {
            await Room.updateOne(
                { roomId, "files.id": fileId },
                { $set: { "files.$.content": content, "files.$.updatedAt": new Date() } }
            );
            pendingCodeSaves.delete(memoryKey);
        } catch (error) {
            console.error(`Error saving content for file ${fileId} in room ${roomId}:`, error);
        }
    }, 600);

    pendingCodeSaves.set(memoryKey, { timeout, content });
};

export const createFileOrFolder = async (roomId: string, item: IFileItem): Promise<void> => {
    await Room.updateOne({ roomId }, { $push: { files: item } });
    if (item.type === "file" && item.content !== undefined) {
        inMemoryFileContents.set(getMemoryKey(roomId, item.id), item.content);
    }
};

export const renameFileOrFolder = async (roomId: string, id: string, newName: string): Promise<void> => {
    await Room.updateOne(
        { roomId, "files.id": id },
        { $set: { "files.$.name": newName, "files.$.updatedAt": new Date() } }
    );
};

export const deleteFileOrFolder = async (
    roomId: string,
    id: string
): Promise<{ deletedIds: string[] }> => {
    const room = await Room.findOne({ roomId });
    if (!room) return { deletedIds: [id] };

    const allFiles = room.files;
    const deletedIds = new Set<string>([id]);

    const collectDescendants = (parentId: string) => {
        for (const file of allFiles) {
            if (file.parentId === parentId && !deletedIds.has(file.id)) {
                deletedIds.add(file.id);
                if (file.type === "folder") {
                    collectDescendants(file.id);
                }
            }
        }
    };

    collectDescendants(id);
    const deletedIdArray = Array.from(deletedIds);

    await Room.updateOne(
        { roomId },
        { $pull: { files: { id: { $in: deletedIdArray } } } }
    );

    for (const dId of deletedIdArray) {
        const memKey = getMemoryKey(roomId, dId);
        inMemoryFileContents.delete(memKey);
        const pending = pendingCodeSaves.get(memKey);
        if (pending) {
            clearTimeout(pending.timeout);
            pendingCodeSaves.delete(memKey);
        }
    }

    return { deletedIds: deletedIdArray };
};

// Chat operations
export const addChatMessage = async (
    roomId: string,
    message: IChatMessage
): Promise<IChatMessage> => {
    await Room.updateOne({ roomId }, { $push: { chatMessages: message } });
    return message;
};

// Version History & Snapshots
export const createVersionSnapshot = async (
    roomId: string,
    author: string,
    label: string
): Promise<IVersionSnapshot | null> => {
    const room = await Room.findOne({ roomId });
    if (!room) return null;

    // Apply any in-memory pending edits to snapshot
    const currentFiles = room.files.map((f) => {
        const fObj = typeof (f as any).toObject === "function" ? (f as any).toObject() : f;
        const memKey = getMemoryKey(roomId, fObj.id);
        return {
            ...fObj,
            content: inMemoryFileContents.get(memKey) ?? fObj.content,
        };
    });

    const snapshot: IVersionSnapshot = {
        id: `snap-${crypto.randomUUID()}`,
        label: label || `Snapshot by ${author}`,
        author,
        files: currentFiles,
        createdAt: new Date(),
    };

    await Room.updateOne({ roomId }, { $push: { versionSnapshots: snapshot } });
    return snapshot;
};

export const restoreVersionSnapshot = async (
    roomId: string,
    snapshotId: string,
    fileId?: string
): Promise<{ files: IFileItem[]; restoredSnapshot: IVersionSnapshot } | null> => {
    const room = await Room.findOne({ roomId });
    if (!room) return null;

    const snapshot = room.versionSnapshots.find((s) => s.id === snapshotId);
    if (!snapshot) return null;

    let updatedFiles: IFileItem[];

    if (fileId) {
        // Restore only a specific file
        const targetFile = snapshot.files.find((f) => f.id === fileId);
        if (!targetFile) return null;

        updatedFiles = room.files.map((f) => (f.id === fileId ? targetFile : f));
        if (targetFile.content !== undefined) {
            inMemoryFileContents.set(getMemoryKey(roomId, fileId), targetFile.content);
        }
    } else {
        // Restore entire project
        updatedFiles = snapshot.files;
        for (const file of updatedFiles) {
            if (file.content !== undefined) {
                inMemoryFileContents.set(getMemoryKey(roomId, file.id), file.content);
            }
        }
    }

    await Room.updateOne({ roomId }, { $set: { files: updatedFiles } });
    return { files: updatedFiles, restoredSnapshot: snapshot };
};

// Whiteboard
export const saveWhiteboardElements = async (
    roomId: string,
    elements: any[]
): Promise<void> => {
    await Room.updateOne({ roomId }, { $set: { whiteboardElements: elements } });
};

// Activity Logging
export const logActivity = async (
    roomId: string,
    username: string,
    action: string,
    target?: string,
    details?: string
): Promise<IActivityLog> => {
    const log: IActivityLog = {
        id: `act-${crypto.randomUUID()}`,
        username,
        action,
        target,
        details,
        timestamp: new Date(),
    };
    await Room.updateOne({ roomId }, { $push: { activityLogs: log } });
    return log;
};

// Code Review / Comments
export const addCodeComment = async (
    roomId: string,
    comment: ICodeComment
): Promise<ICodeComment> => {
    await Room.updateOne({ roomId }, { $push: { codeComments: comment } });
    return comment;
};

export const resolveCodeComment = async (
    roomId: string,
    commentId: string,
    resolved: boolean
): Promise<void> => {
    await Room.updateOne(
        { roomId, "codeComments.id": commentId },
        { $set: { "codeComments.$.resolved": resolved } }
    );
};

export const addCommentReply = async (
    roomId: string,
    commentId: string,
    reply: { id: string; author: string; content: string; createdAt: Date }
): Promise<void> => {
    await Room.updateOne(
        { roomId, "codeComments.id": commentId },
        { $push: { "codeComments.$.replies": reply } }
    );
};

// Room Permissions & Roles
export const updateMemberRole = async (
    roomId: string,
    username: string,
    role: "owner" | "editor" | "viewer"
): Promise<void> => {
    await Room.updateOne(
        { roomId, "members.username": username },
        { $set: { "members.$.role": role } }
    );
};

export const updatePairRole = async (
    roomId: string,
    username: string,
    pairRole: "driver" | "navigator"
): Promise<void> => {
    await Room.updateOne(
        { roomId, "members.username": username },
        { $set: { "members.$.pairRole": pairRole } }
    );
};

// Interview Session
export const updateInterviewSession = async (
    roomId: string,
    session: IInterviewSession
): Promise<void> => {
    await Room.updateOne({ roomId }, { $set: { interviewSession: session } });
};

// Breakpoints
export const toggleBreakpoint = async (
    roomId: string,
    fileId: string,
    lineNumber: number
): Promise<IBreakpoint[]> => {
    const room = await Room.findOne({ roomId });
    if (!room) return [];

    const existingIdx = room.breakpoints.findIndex(
        (b) => b.fileId === fileId && b.lineNumber === lineNumber
    );

    let updatedBreakpoints: IBreakpoint[];
    if (existingIdx >= 0) {
        updatedBreakpoints = room.breakpoints.filter(
            (_, idx) => idx !== existingIdx
        );
    } else {
        updatedBreakpoints = [
            ...room.breakpoints,
            { fileId, lineNumber, enabled: true },
        ];
    }

    await Room.updateOne({ roomId }, { $set: { breakpoints: updatedBreakpoints } });
    return updatedBreakpoints;
};

// Session Recordings
export const saveSessionRecording = async (
    roomId: string,
    recording: ISessionRecording
): Promise<void> => {
    await Room.updateOne({ roomId }, { $push: { sessionRecordings: recording } });
};

export const flushPendingSavesForRoom = async (roomId?: string): Promise<void> => {
    for (const [key, item] of pendingCodeSaves.entries()) {
        const [rId, fId] = key.split(":");
        if (!roomId || rId === roomId) {
            clearTimeout(item.timeout);
            try {
                if (rId && fId) {
                    await Room.updateOne(
                        { roomId: rId, "files.id": fId },
                        { $set: { "files.$.content": item.content, "files.$.updatedAt": new Date() } }
                    );
                }
            } catch (err) {
                console.error("Error flushing pending save:", err);
            }
            pendingCodeSaves.delete(key);
        }
    }
};
