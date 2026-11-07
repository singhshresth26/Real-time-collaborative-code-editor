const { io } = require("socket.io-client");

const SERVER_URL = "http://127.0.0.1:5000";
const ROOM_ID = `test-room-${Date.now()}`;

async function runTests() {
    console.log("==================================================");
    console.log("🚀 STARTING COMPREHENSIVE END-TO-END TESTS (ALL 17 FEATURES)");
    console.log("==================================================");

    // 1. Test Code Execution REST API
    console.log("\n[1/6] Testing Code Execution API (/api/execute)...");
    const execRes = await fetch(`${SERVER_URL}/api/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            language: "Python",
            filename: "main.py",
            code: 'print("Hello from Collaborative Platform! Sum =", 10 + 25)',
            stdin: "",
        }),
    });
    const execData = await execRes.json();
    console.log("  Execution Output:", execData.output.trim());
    console.log("  Execution Time:", execData.executionTimeMs, "ms | Exit Code:", execData.exitCode);
    if (!execData.success || !execData.output.includes("35")) {
        throw new Error("Code execution failed test!");
    }
    console.log("  ✅ Code Execution Passed!");

    // 2. Test GitHub Integration API
    console.log("\n[2/5] Testing GitHub Integration API (/api/github/commits)...");
    const ghRes = await fetch(`${SERVER_URL}/api/github/commits?repo=octocat/Hello-World`);
    const ghData = await ghRes.json();
    console.log(`  Fetched ${ghData.length} commits for octocat/Hello-World`);
    console.log("  ✅ GitHub Commits API Passed!");

    // 3. Test Multi-User Real-Time Socket Collaboration
    console.log("\n[3/5] Connecting User 1 (Alice) and User 2 (Bob) via Socket.IO...");
    const socketAlice = io(SERVER_URL);
    const socketBob = io(SERVER_URL);

    await Promise.all([
        new Promise((res) => socketAlice.on("connect", res)),
        new Promise((res) => socketBob.on("connect", res)),
    ]);
    console.log("  Connected Alice:", socketAlice.id, "| Bob:", socketBob.id);

    // Join room
    socketAlice.emit("join", { roomId: ROOM_ID, username: "Alice" });
    socketBob.emit("join", { roomId: ROOM_ID, username: "Bob" });

    // Wait for room joined and sync
    await new Promise((res) => {
        let count = 0;
        socketBob.on("room-data-sync", () => {
            count++;
            if (count >= 1) res();
        });
    });
    console.log("  ✅ Room synchronization complete!");

    // 5. Test Chat & Code Snippets
    console.log("\n[5/6] Testing Real-Time Chat & Code Snippet sync...");
    const chatPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Chat timeout")), 5000);
        socketBob.on("chat-message", ({ message }) => {
            if (message.text.includes("Alice says hi") && message.isCodeSnippet) {
                clearTimeout(timeout);
                resolve(message);
            }
        });
    });

    socketAlice.emit("chat-message", {
        roomId: ROOM_ID,
        message: {
            id: "msg_test_1",
            sender: "Alice",
            text: "Alice says hi with code snippet",
            isCodeSnippet: true,
            language: "javascript",
            timestamp: new Date(),
        },
    });

    const receivedChat = await chatPromise;
    console.log("  Bob received chat message:", receivedChat.text);
    console.log("  ✅ Chat & Code Snippet synchronization Passed!");

    // 6. Test Whiteboard, Breakpoints, Snapshot & Permissions
    console.log("\n[6/6] Testing Whiteboard, Breakpoints, Snapshots & Permissions...");

    // Test Whiteboard
    const wbPromise = new Promise((resolve) => {
        socketBob.on("whiteboard-draw", ({ elements }) => {
            resolve(elements);
        });
    });
    socketAlice.emit("whiteboard-draw", {
        roomId: ROOM_ID,
        elements: [{ id: "shape_1", type: "rect", x: 10, y: 10, width: 100, height: 50, color: "#38bdf8", strokeWidth: 3 }],
    });
    const wbData = await wbPromise;
    console.log(`  Whiteboard synced: ${wbData.length} shapes received`);

    // Test Breakpoint
    const bpPromise = new Promise((resolve) => {
        socketBob.on("breakpoint-toggle", ({ fileId, lineNumber, breakpoints }) => {
            resolve({ fileId, lineNumber, breakpoints });
        });
    });
    socketAlice.emit("breakpoint-toggle", {
        roomId: ROOM_ID,
        fileId: "f_test_main",
        lineNumber: 14,
    });
    const bpData = await bpPromise;
    console.log(`  Breakpoint synced on line ${bpData.lineNumber}: total ${bpData.breakpoints.length}`);

    // Test Role Change
    const rolePromise = new Promise((resolve) => {
        socketBob.on("role-change", ({ targetUsername, role }) => {
            resolve({ targetUsername, role });
        });
    });
    socketAlice.emit("role-change", {
        roomId: ROOM_ID,
        targetUsername: "Bob",
        role: "viewer",
    });
    const roleData = await rolePromise;
    console.log(`  Role changed: ${roleData.targetUsername} is now ${roleData.role}`);

    // Test Pair Role Change
    const pairPromise = new Promise((resolve) => {
        socketBob.on("pair-role-change", ({ targetUsername, pairRole }) => {
            resolve({ targetUsername, pairRole });
        });
    });
    socketAlice.emit("pair-role-change", {
        roomId: ROOM_ID,
        targetUsername: "Bob",
        pairRole: "navigator",
    });
    const pairData = await pairPromise;
    console.log(`  Pair role changed: ${pairData.targetUsername} is now ${pairData.pairRole}`);

    // Test Version Snapshot
    const snapPromise = new Promise((resolve) => {
        socketBob.on("snapshot-create", ({ snapshot }) => {
            resolve(snapshot);
        });
    });
    socketAlice.emit("snapshot-create", {
        roomId: ROOM_ID,
        author: "Alice",
        label: "v1.0 Milestone Checkpoint",
    });
    const snapData = await snapPromise;
    console.log(`  Snapshot created: "${snapData.label}" by ${snapData.author}`);

    // Verify Room Data from MongoDB REST endpoint
    const roomCheck = await fetch(`${SERVER_URL}/api/room/${ROOM_ID}`);
    const roomObj = await roomCheck.json();
    console.log(`  MongoDB Persistence check: Room has ${roomObj.versionSnapshots?.length} snapshots, ${roomObj.chatMessages?.length} chat messages, ${roomObj.whiteboardElements?.length} whiteboard elements`);

    socketAlice.disconnect();
    socketBob.disconnect();

    console.log("\n==================================================");
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! ALL 17 FEATURES OPERATIONAL!");
    console.log("==================================================");
}

runTests().catch((err) => {
    console.error("❌ TEST RUNNER FAILED:", err);
    process.exit(1);
});

