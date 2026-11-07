import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  compileOutput?: string;
  executionTimeMs: number;
  memoryUsageKb?: number;
  exitCode: number | string;
  status: "completed" | "failed" | "timeout" | "stopped";
}

// Map extensions or aliases to canonical language
export const detectLanguage = (filenameOrLang: string): string => {
  const ext = filenameOrLang.includes(".")
    ? filenameOrLang.split(".").pop()?.toLowerCase() || ""
    : filenameOrLang.toLowerCase();

  switch (ext) {
    case "cpp":
    case "cc":
    case "cxx":
    case "hpp":
    case "h":
    case "c++":
      return "cpp";
    case "c":
      return "c";
    case "java":
      return "java";
    case "py":
    case "python":
      return "python";
    case "js":
    case "mjs":
    case "cjs":
    case "javascript":
      return "javascript";
    case "ts":
    case "typescript":
      return "typescript";
    default:
      return ext || "plaintext";
  }
};

// Map canonical language to Wandbox compiler ID
const getWandboxCompiler = (lang: string): string | null => {
  switch (lang) {
    case "cpp":
      return "gcc-head";
    case "c":
      return "gcc-head";
    case "java":
      return "openjdk-jdk-21+35";
    case "python":
      return "cpython-3.12.7";
    case "javascript":
      return "nodejs-20.17.0";
    case "typescript":
      return "typescript-5.4.5";
    default:
      return null;
  }
};

// Execute using Wandbox isolated cloud sandbox
const runInWandbox = async (
  compiler: string,
  lang: string,
  rawCode: string,
  stdin: string
): Promise<ExecutionResult | null> => {
  try {
    let codeToRun = rawCode;

    // For Java in Wandbox, replace "public class <Name>" with "class <Name>"
    // so it compiles as prog.java without filename mismatch
    if (lang === "java") {
      codeToRun = codeToRun.replace(/\bpublic\s+class\b/g, "class");
    }

    const payload: Record<string, any> = {
      compiler,
      code: codeToRun,
      stdin: stdin || "",
    };

    // If C, tell gcc to compile as C
    if (lang === "c") {
      payload.options = "c11";
      payload["compiler-option-raw"] = "-x c";
    }

    const startTime = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch("https://wandbox.org/api/compile.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data: any = await response.json();
    const duration = Math.round(performance.now() - startTime);

    const compileError = data.compiler_error || data.compiler_message || "";
    const stdout = data.program_output || data.program_message || "";
    const stderr = data.program_error || "";
    const exitCode = data.status ?? "0";
    const isSuccess = exitCode === "0" && !compileError;

    return {
      success: isSuccess,
      output: stdout,
      error: stderr,
      compileOutput: compileError,
      executionTimeMs: duration,
      exitCode,
      status: isSuccess ? "completed" : "failed",
    };
  } catch (err) {
    console.warn("Wandbox execution failed or timed out, trying local runner...", err);
    return null;
  }
};

// Execute locally with process isolation and timeout
const runLocally = async (
  lang: string,
  code: string,
  stdin: string
): Promise<ExecutionResult> => {
  const tempDir = path.join(os.tmpdir(), `collab-exec-${crypto.randomUUID()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const startTime = performance.now();
  const TIMEOUT_MS = 8000;

  try {
    if (lang === "python") {
      const scriptPath = path.join(tempDir, "script.py");
      fs.writeFileSync(scriptPath, code);

      // Try python, then py
      const pythonCmd = fs.existsSync("C:\\Python315\\python.exe")
        ? "C:\\Python315\\python.exe"
        : "python";

      return await spawnAndRun(pythonCmd, [scriptPath], tempDir, stdin, startTime, TIMEOUT_MS);
    }

    if (lang === "javascript") {
      const scriptPath = path.join(tempDir, "script.js");
      fs.writeFileSync(scriptPath, code);
      return await spawnAndRun("node", [scriptPath], tempDir, stdin, startTime, TIMEOUT_MS);
    }

    if (lang === "cpp") {
      const srcPath = path.join(tempDir, "main.cpp");
      const exePath = path.join(tempDir, "main.exe");
      fs.writeFileSync(srcPath, code);

      const gppCmd = fs.existsSync("C:\\MinGW\\bin\\g++.exe")
        ? "C:\\MinGW\\bin\\g++.exe"
        : "g++";

      // Compile
      const compileRes = await spawnAndRun(
        gppCmd,
        ["-O2", srcPath, "-o", exePath],
        tempDir,
        "",
        startTime,
        TIMEOUT_MS
      );

      if (compileRes.exitCode !== 0 || !fs.existsSync(exePath)) {
        return {
          success: false,
          output: "",
          compileOutput: compileRes.error || compileRes.output || "Compilation failed",
          executionTimeMs: Math.round(performance.now() - startTime),
          exitCode: compileRes.exitCode,
          status: "failed",
        };
      }

      // Execute binary
      const runStart = performance.now();
      const runRes = await spawnAndRun(exePath, [], tempDir, stdin, runStart, TIMEOUT_MS);
      return {
        ...runRes,
        executionTimeMs: Math.round(performance.now() - startTime),
      };
    }

    if (lang === "c") {
      const srcPath = path.join(tempDir, "main.c");
      const exePath = path.join(tempDir, "main.exe");
      fs.writeFileSync(srcPath, code);

      const gccCmd = fs.existsSync("C:\\MinGW\\bin\\gcc.exe")
        ? "C:\\MinGW\\bin\\gcc.exe"
        : "gcc";

      // Compile
      const compileRes = await spawnAndRun(
        gccCmd,
        ["-O2", srcPath, "-o", exePath],
        tempDir,
        "",
        startTime,
        TIMEOUT_MS
      );

      if (compileRes.exitCode !== 0 || !fs.existsSync(exePath)) {
        return {
          success: false,
          output: "",
          compileOutput: compileRes.error || compileRes.output || "Compilation failed",
          executionTimeMs: Math.round(performance.now() - startTime),
          exitCode: compileRes.exitCode,
          status: "failed",
        };
      }

      // Execute binary
      const runStart = performance.now();
      const runRes = await spawnAndRun(exePath, [], tempDir, stdin, runStart, TIMEOUT_MS);
      return {
        ...runRes,
        executionTimeMs: Math.round(performance.now() - startTime),
      };
    }

    return {
      success: false,
      output: "",
      error: `Local execution is not configured for language: ${lang}. Please ensure an online connection to run ${lang}.`,
      executionTimeMs: 0,
      exitCode: 1,
      status: "failed",
    };
  } finally {
    // Clean up temporary files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  }
};

const spawnAndRun = (
  cmd: string,
  args: string[],
  cwd: string,
  stdin: string,
  startTime: number,
  timeoutMs: number
): Promise<ExecutionResult> => {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let isFinished = false;

    const child = spawn(cmd, args, {
      cwd,
      shell: false,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        try {
          child.kill("SIGKILL");
        } catch {}
        resolve({
          success: false,
          output: stdout,
          error: "Execution Timed Out (exceeded 8 seconds limit)",
          executionTimeMs: timeoutMs,
          exitCode: 124,
          status: "timeout",
        });
      }
    }, timeoutMs);

    if (stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    } else {
      child.stdin.end();
    }

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 500000) {
        // Prevent buffer flooding
        child.kill();
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (!isFinished) {
        isFinished = true;
        clearTimeout(timer);
        const duration = Math.round(performance.now() - startTime);
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr,
          executionTimeMs: duration,
          exitCode: code ?? 0,
          status: code === 0 ? "completed" : "failed",
        });
      }
    });

    child.on("error", (err) => {
      if (!isFinished) {
        isFinished = true;
        clearTimeout(timer);
        resolve({
          success: false,
          output: stdout,
          error: `Process error: ${err.message}`,
          executionTimeMs: Math.round(performance.now() - startTime),
          exitCode: 1,
          status: "failed",
        });
      }
    });
  });
};

export const runCode = async (
  filenameOrLang: string,
  code: string,
  stdin: string = ""
): Promise<ExecutionResult> => {
  const lang = detectLanguage(filenameOrLang);
  const wandboxCompiler = getWandboxCompiler(lang);

  // 1. Try Wandbox isolated cloud runner
  if (wandboxCompiler) {
    const cloudRes = await runInWandbox(wandboxCompiler, lang, code, stdin);
    if (cloudRes) {
      return cloudRes;
    }
  }

  // 2. Fallback to local sandbox runner
  return await runLocally(lang, code, stdin);
};
