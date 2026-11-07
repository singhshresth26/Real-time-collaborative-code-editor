const ACTIONS = {
    // Existing Room & Code Sync
    JOIN: 'join',
    JOINED: 'joined',
    DISCONNECTED: 'disconnected',
    CODE_CHANGE: 'code-change',
    SYNC_CODE: 'sync-code',
    LEAVE: 'leave',
    SYNC_FILES: 'sync-files',
    ROOM_DATA_SYNC: 'room-data-sync',
    FILE_CREATED: 'file-created',
    FILE_RENAMED: 'file-renamed',
    FILE_DELETED: 'file-deleted',
    USER_ACTIVE_FILE: 'user-active-file',
    CURSOR_MOVE: 'cursor-move',
    CODE_RUNNING: 'code-running',
    CODE_OUTPUT: 'code-output',

    // Real-Time Chat
    CHAT_MESSAGE: 'chat-message',
    CHAT_TYPING: 'chat-typing',

    // Collaborative Whiteboard
    WHITEBOARD_DRAW: 'whiteboard-draw',
    WHITEBOARD_CLEAR: 'whiteboard-clear',

    // Version History
    SNAPSHOT_CREATE: 'snapshot-create',
    SNAPSHOT_RESTORE: 'snapshot-restore',

    // Roles & Permissions & Pair Programming
    ROLE_CHANGE: 'role-change',
    PAIR_ROLE_CHANGE: 'pair-role-change',

    // Follow Me Mode
    FOLLOW_LEADER_TOGGLE: 'follow-leader-toggle',
    LEADER_NAVIGATE: 'leader-navigate',

    // Code Review & Inline Comments
    COMMENT_ADD: 'comment-add',
    COMMENT_RESOLVE: 'comment-resolve',
    COMMENT_REPLY: 'comment-reply',

    // Shared Debugging
    BREAKPOINT_TOGGLE: 'breakpoint-toggle',

    // Interview Mode
    INTERVIEW_UPDATE: 'interview-update',

    // WebRTC Voice & Video Collaboration
    WEBRTC_SIGNAL: 'webrtc-signal',
    WEBRTC_USER_JOINED: 'webrtc-user-joined',
    WEBRTC_USER_LEFT: 'webrtc-user-left',
    WEBRTC_MEDIA_STATE: 'webrtc-media-state',

    // Session Recording
    RECORDING_SAVE: 'recording-save',
};

export default ACTIONS;
