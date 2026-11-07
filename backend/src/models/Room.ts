import mongoose, { Schema, Document } from "mongoose";

export interface IFileItem {
    id: string;
    name: string;
    type: "file" | "folder";
    parentId: string | null;
    content?: string | undefined;
    updatedAt?: Date | undefined;
}

export interface IChatMessage {
    id: string;
    sender: string;
    text: string;
    isCodeSnippet?: boolean | undefined;
    language?: string | undefined;
    timestamp: Date;
}

export interface IVersionSnapshot {
    id: string;
    label: string;
    author: string;
    files: IFileItem[];
    createdAt: Date;
}

export interface IActivityLog {
    id: string;
    username: string;
    action: string;
    target?: string | undefined;
    details?: string | undefined;
    timestamp: Date;
}

export interface ICodeComment {
    id: string;
    fileId: string;
    lineNumber: number;
    author: string;
    content: string;
    resolved: boolean;
    createdAt: Date;
    replies: {
        id: string;
        author: string;
        content: string;
        createdAt: Date;
    }[];
}

export interface IInterviewTestCase {
    input: string;
    expectedOutput: string;
    isHidden?: boolean | undefined;
}

export interface IInterviewSession {
    isActive: boolean;
    title: string;
    description: string;
    durationMinutes: number;
    startedAt?: Date | undefined;
    remainingSeconds?: number | undefined;
    testCases: IInterviewTestCase[];
    candidateScore?: number | undefined;
    notes?: string | undefined;
    status: "pending" | "in-progress" | "completed";
}

export interface IBreakpoint {
    fileId: string;
    lineNumber: number;
    enabled: boolean;
}

export interface IRoomMember {
    username: string;
    role: "owner" | "editor" | "viewer";
    pairRole?: "driver" | "navigator" | undefined;
    joinedAt: Date;
}

export interface ISessionRecordingEvent {
    timestamp: number;
    type: string;
    username: string;
    data: any;
}

export interface ISessionRecording {
    id: string;
    title: string;
    startedAt: Date;
    durationMs: number;
    events: ISessionRecordingEvent[];
}

export interface IRoomDoc extends Document {
    roomId: string;
    owner: string;
    files: IFileItem[];
    members: IRoomMember[];
    chatMessages: IChatMessage[];
    versionSnapshots: IVersionSnapshot[];
    whiteboardElements: any[];
    activityLogs: IActivityLog[];
    codeComments: ICodeComment[];
    interviewSession?: IInterviewSession;
    breakpoints: IBreakpoint[];
    sessionRecordings: ISessionRecording[];
    settings: {
        allowAnonymous: boolean;
        anonymousDefaultRole: "editor" | "viewer";
        inviteToken: string;
    };
    createdAt: Date;
    updatedAt: Date;
}

const FileItemSchema = new Schema<IFileItem>(
    {
        id: { type: String, required: true },
        name: { type: String, required: true },
        type: { type: String, enum: ["file", "folder"], required: true },
        parentId: { type: String, default: null },
        content: { type: String, default: "" },
        updatedAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const ChatMessageSchema = new Schema<IChatMessage>(
    {
        id: { type: String, required: true },
        sender: { type: String, required: true },
        text: { type: String, required: true },
        isCodeSnippet: { type: Boolean, default: false },
        language: { type: String, default: "plaintext" },
        timestamp: { type: Date, default: Date.now },
    },
    { _id: false }
);

const VersionSnapshotSchema = new Schema<IVersionSnapshot>(
    {
        id: { type: String, required: true },
        label: { type: String, required: true },
        author: { type: String, required: true },
        files: [FileItemSchema],
        createdAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const ActivityLogSchema = new Schema<IActivityLog>(
    {
        id: { type: String, required: true },
        username: { type: String, required: true },
        action: { type: String, required: true },
        target: { type: String },
        details: { type: String },
        timestamp: { type: Date, default: Date.now },
    },
    { _id: false }
);

const CodeCommentSchema = new Schema<ICodeComment>(
    {
        id: { type: String, required: true },
        fileId: { type: String, required: true },
        lineNumber: { type: Number, required: true },
        author: { type: String, required: true },
        content: { type: String, required: true },
        resolved: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
        replies: [
            {
                id: { type: String, required: true },
                author: { type: String, required: true },
                content: { type: String, required: true },
                createdAt: { type: Date, default: Date.now },
            },
        ],
    },
    { _id: false }
);

const RoomSchema = new Schema<IRoomDoc>(
    {
        roomId: { type: String, required: true, unique: true, index: true },
        owner: { type: String, default: "" },
        files: [FileItemSchema],
        members: [
            {
                username: { type: String, required: true },
                role: {
                    type: String,
                    enum: ["owner", "editor", "viewer"],
                    default: "editor",
                },
                pairRole: {
                    type: String,
                    enum: ["driver", "navigator"],
                    default: "driver",
                },
                joinedAt: { type: Date, default: Date.now },
            },
        ],
        chatMessages: [ChatMessageSchema],
        versionSnapshots: [VersionSnapshotSchema],
        whiteboardElements: { type: [Schema.Types.Mixed] as any, default: [] },
        activityLogs: [ActivityLogSchema],
        codeComments: [CodeCommentSchema],
        interviewSession: {
            isActive: { type: Boolean, default: false },
            title: { type: String, default: "Technical Coding Interview" },
            description: { type: String, default: "Solve the challenge and pass all test cases." },
            durationMinutes: { type: Number, default: 45 },
            startedAt: { type: Date },
            remainingSeconds: { type: Number, default: 2700 },
            testCases: [
                {
                    input: { type: String, default: "" },
                    expectedOutput: { type: String, default: "" },
                    isHidden: { type: Boolean, default: false },
                },
            ],
            candidateScore: { type: Number, default: 0 },
            notes: { type: String, default: "" },
            status: {
                type: String,
                enum: ["pending", "in-progress", "completed"],
                default: "pending",
            },
        },
        breakpoints: [
            {
                fileId: { type: String, required: true },
                lineNumber: { type: Number, required: true },
                enabled: { type: Boolean, default: true },
            },
        ],
        sessionRecordings: [
            {
                id: { type: String, required: true },
                title: { type: String, required: true },
                startedAt: { type: Date, default: Date.now },
                durationMs: { type: Number, default: 0 },
                events: [Schema.Types.Mixed],
            },
        ],
        settings: {
            allowAnonymous: { type: Boolean, default: true },
            anonymousDefaultRole: {
                type: String,
                enum: ["editor", "viewer"],
                default: "editor",
            },
            inviteToken: { type: String, default: "" },
        },
    },
    { timestamps: true }
);

export const Room = mongoose.model<IRoomDoc>("Room", RoomSchema);
