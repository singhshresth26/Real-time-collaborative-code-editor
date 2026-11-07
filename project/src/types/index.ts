export type FileNodeType = 'file' | 'folder';

export interface FileItem {
  id: string;
  name: string;
  type: FileNodeType;
  parentId: string | null;
  content?: string | undefined;
  updatedAt?: number | string | Date | undefined;
}

export type MemberRole = 'owner' | 'editor' | 'viewer';
export type PairRole = 'driver' | 'navigator';

export interface ClientType {
  socketId: string;
  username: string;
  activeFileId?: string | null | undefined;
  role?: MemberRole | undefined;
  pairRole?: PairRole | undefined;
}

export interface NewItemPrompt {
  parentId: string | null;
  type: FileNodeType;
}

export type ExecutionStatus = "idle" | "running" | "completed" | "failed" | "timeout" | "stopped";

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string | undefined;
  compileOutput?: string | undefined;
  executionTimeMs: number;
  memoryUsageKb?: number | undefined;
  exitCode: number | string;
  status: ExecutionStatus;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  isCodeSnippet?: boolean | undefined;
  language?: string | undefined;
  timestamp: string | Date;
}

export interface VersionSnapshot {
  id: string;
  label: string;
  author: string;
  files: FileItem[];
  createdAt: string | Date;
}

export interface ActivityLog {
  id: string;
  username: string;
  action: string;
  target?: string | undefined;
  details?: string | undefined;
  timestamp: string | Date;
}

export interface CommentReply {
  id: string;
  author: string;
  content: string;
  createdAt: string | Date;
}

export interface CodeComment {
  id: string;
  fileId: string;
  lineNumber: number;
  author: string;
  content: string;
  resolved: boolean;
  createdAt: string | Date;
  replies: CommentReply[];
}

export interface InterviewTestCase {
  input: string;
  expectedOutput: string;
  isHidden?: boolean | undefined;
}

export interface InterviewSession {
  isActive: boolean;
  title: string;
  description: string;
  durationMinutes: number;
  startedAt?: string | Date | undefined;
  remainingSeconds?: number | undefined;
  testCases: InterviewTestCase[];
  candidateScore?: number | undefined;
  notes?: string | undefined;
  status: "pending" | "in-progress" | "completed";
}

export interface Breakpoint {
  fileId: string;
  lineNumber: number;
  enabled: boolean;
}

export interface RoomSettings {
  allowAnonymous: boolean;
  anonymousDefaultRole: "editor" | "viewer";
  inviteToken: string;
}

export interface SessionRecordingEvent {
  timestamp: number;
  type: string;
  username: string;
  data: any;
}

export interface SessionRecording {
  id: string;
  title: string;
  startedAt: string | Date;
  durationMs: number;
  events: SessionRecordingEvent[];
}
