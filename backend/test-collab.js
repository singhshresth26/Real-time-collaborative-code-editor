const { io } = require("socket.io-client");
const mongoose = require("mongoose");

const SERVER_URL = "http://localhost:5000";
const ROOM_ID = "test-terminal-suite-" + Date.now();

const ACTIONS = {
  JOIN: 'join',
  JOINED: 'joined',
  DISCONNECTED: 'disconnected',
  CODE_CHANGE: 'code-change',
  SYNC_CODE: 'sync-code',
  LEAVE: 'leave',
  SYNC_FILES: 'sync-files',
  FILE_CREATED: 'file-created',
  FILE_RENAMED: 'file-renamed',
  FILE_DELETED: 'file-deleted',
  USER_ACTIVE_FILE: 'user-active-file',
  CURSOR_MOVE: 'cursor-move',
  CODE_RUNNING: 'code-running',
  CODE_OUTPUT: 'code-output',
};

async function runTest() {
  console.log("=== STARTING CODE EXECUTION & TERMINAL INTEGRATION TEST ===");

  // 1. Test POST /api/execute with Python
  console.log("Testing POST /api/execute (Python)...");
  const pyRes = await fetch(`${SERVER_URL}/api/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "test.py",
      code: "print('Hello from Python runner!')",
      stdin: "",
    }),
  }).then((r) => r.json());

  console.log("✓ Python result:", pyRes.output.trim(), `(${pyRes.executionTimeMs}ms)`);
  if (!pyRes.success || !pyRes.output.includes("Hello from Python runner!")) {
    throw new Error("Python execution failed: " + JSON.stringify(pyRes));
  }

  // 2. Test POST /api/execute with Custom Stdin
  console.log("Testing POST /api/execute with custom stdin (Python)...");
  const stdinRes = await fetch(`${SERVER_URL}/api/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "input_test.py",
      code: "import sys\nline = sys.stdin.readline().strip()\nprint(f'Processed: {line}')",
      stdin: "CollaborativeTerminalInput",
    }),
  }).then((r) => r.json());

  console.log("✓ Stdin result:", stdinRes.output.trim());
  if (!stdinRes.success || !stdinRes.output.includes("Processed: CollaborativeTerminalInput")) {
    throw new Error("Stdin test failed: " + JSON.stringify(stdinRes));
  }

  // 3. Test Compilation Error reporting
  console.log("Testing compilation error handling (C++ with syntax error)...");
  const errorRes = await fetch(`${SERVER_URL}/api/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "error.cpp",
      code: "#include <iostream>\nint main() { INVALID_SYNTAX_ERROR;; }",
      stdin: "",
    }),
  }).then((r) => r.json());

  console.log("✓ Error reported properly (status:", errorRes.status, "compileOutput:", errorRes.compileOutput ? "Yes" : "No", ")");
  if (errorRes.success === true || (!errorRes.compileOutput && !errorRes.error)) {
    throw new Error("Compilation error test failed: " + JSON.stringify(errorRes));
  }

  // 4. Test Socket.IO Real-time Execution broadcasting
  console.log("Testing real-time Socket.IO execution broadcast between 2 users...");
  const socketA = io(SERVER_URL);
  const socketB = io(SERVER_URL);

  await new Promise((resolve) => {
    let connected = 0;
    const check = () => { if (++connected === 2) resolve(); };
    socketA.on("connect", check);
    socketB.on("connect", check);
  });

  socketA.emit(ACTIONS.JOIN, { roomId: ROOM_ID, username: "Alice" });
  socketB.emit(ACTIONS.JOIN, { roomId: ROOM_ID, username: "Bob" });

  await new Promise((resolve) => setTimeout(resolve, 500));

  // User A runs code -> User B receives CODE_RUNNING
  await new Promise((resolve) => {
    socketB.on(ACTIONS.CODE_RUNNING, (data) => {
      if (data.username === "Alice" && data.filename === "solution.cpp") {
        console.log(`✓ Socket B received CODE_RUNNING event: ${data.username} is running ${data.filename}`);
        resolve();
      }
    });
    socketA.emit(ACTIONS.CODE_RUNNING, {
      roomId: ROOM_ID,
      username: "Alice",
      filename: "solution.cpp",
    });
  });

  // User A finishes -> User B receives CODE_OUTPUT
  await new Promise((resolve) => {
    socketB.on(ACTIONS.CODE_OUTPUT, (data) => {
      if (data.username === "Alice" && data.result.output === "Test output 123") {
        console.log(`✓ Socket B received CODE_OUTPUT event from ${data.username}`);
        resolve();
      }
    });
    socketA.emit(ACTIONS.CODE_OUTPUT, {
      roomId: ROOM_ID,
      username: "Alice",
      filename: "solution.cpp",
      result: { success: true, output: "Test output 123", executionTimeMs: 45, status: "completed" },
    });
  });

  socketA.disconnect();
  socketB.disconnect();

  console.log("=== ALL TERMINAL & CODE EXECUTION TESTS PASSED! ===");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
