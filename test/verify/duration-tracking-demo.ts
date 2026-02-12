/**
 * Duration tracking demo: verifies session/turn/tool duration histograms work end-to-end
 *
 * Run with: PI_OTLP_ENABLE=1 npx tsx test/verify/duration-tracking-demo.ts
 */

import extension from "../../src/index.js";

interface MockEvent {
  toolName?: string;
  isError?: boolean;
  text?: string;
  message?: {
    role: string;
    usage?: {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
      totalTokens: number;
      cost: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        total: number;
      };
    };
  };
}

interface MockContext {
  sessionManager?: { getSessionId: () => string };
  ui: { notify: (msg: string) => Promise<void> };
}

type EventHandler = (event: MockEvent, ctx: MockContext) => Promise<void>;

interface CommandHandler {
  description: string;
  handler: (args: string, ctx: MockContext) => Promise<void>;
}

const handlers = new Map<string, EventHandler>();
const commands = new Map<string, CommandHandler>();

const mockPi = {
  on(event: string, handler: EventHandler) {
    handlers.set(event, handler);
  },
  registerCommand(name: string, opts: CommandHandler) {
    commands.set(name, opts);
  },
};

const mockCtx: MockContext = {
  sessionManager: { getSessionId: () => "duration-demo-session" },
  ui: {
    async notify(msg: string) {
      console.log(`\n[STATUS OUTPUT]\n${msg}\n`);
    },
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyDurationTracking() {
  console.log("=== Duration Tracking Verification ===\n");

  // Initialize extension
  extension(mockPi as unknown as Parameters<typeof extension>[0]);

  if (handlers.size === 0) {
    console.log("ERROR: Extension disabled - set PI_OTLP_ENABLE=1");
    process.exit(1);
  }

  const emit = async (event: string, data: MockEvent = {}) => {
    const handler = handlers.get(event);
    if (handler) {
      await handler(data, mockCtx);
    }
  };

  // Start session
  console.log("Starting session...");
  await emit("session_start");

  // Turn 1: Simple turn with one tool
  console.log("\n--- Turn 1: Single tool (Bash) ---");
  await emit("turn_start");
  await sleep(100); // Simulate turn processing
  await emit("tool_call", { toolName: "Bash" });
  await sleep(50); // Simulate tool execution
  await emit("tool_result", { toolName: "Bash", isError: false });
  await sleep(50);
  await emit("turn_end", { message: { role: "assistant" } });

  // Turn 2: Multiple concurrent tools
  console.log("\n--- Turn 2: Concurrent tools (Read, Glob) ---");
  await emit("turn_start");
  await sleep(30);
  await emit("tool_call", { toolName: "Read" }); // Read starts
  await sleep(20);
  await emit("tool_call", { toolName: "Glob" }); // Glob starts while Read running
  await sleep(40);
  await emit("tool_result", { toolName: "Glob", isError: false }); // Glob finishes first
  await sleep(30);
  await emit("tool_result", { toolName: "Read", isError: false }); // Read finishes second
  await sleep(20);
  await emit("turn_end", { message: { role: "assistant" } });

  // Turn 3: Tool with failure
  console.log("\n--- Turn 3: Failed tool (Write) ---");
  await emit("turn_start");
  await sleep(50);
  await emit("tool_call", { toolName: "Write" });
  await sleep(75);
  await emit("tool_result", { toolName: "Write", isError: true });
  await sleep(25);
  await emit("turn_end", { message: { role: "assistant" } });

  // Check status mid-session
  console.log("\n--- Status mid-session ---");
  const statusCmd = commands.get("otlp-status");
  if (statusCmd) {
    await statusCmd.handler("", mockCtx);
  }

  // End session
  console.log("\n--- Ending session ---");
  await sleep(100);
  await emit("session_shutdown");

  // Final status
  console.log("\n--- Final status after session end ---");
  if (statusCmd) {
    await statusCmd.handler("", mockCtx);
  }

  // Edge cases
  console.log("\n=== Edge Case Testing ===");

  // Edge case: turn_end without turn_start
  console.log("\n--- Edge Case: turn_end without turn_start ---");
  await emit("turn_end", { message: { role: "assistant" } });

  // Edge case: tool_result without tool_call
  console.log("--- Edge Case: tool_result without tool_call ---");
  await emit("tool_result", { toolName: "Unknown", isError: false });

  // Edge case: session_shutdown without session_start
  console.log("--- Edge Case: session_shutdown without session_start ---");
  await emit("session_shutdown");

  // Status should show 0 for duration if no session started
  console.log("\n--- Status after edge cases (should be unchanged) ---");
  if (statusCmd) {
    await statusCmd.handler("", mockCtx);
  }

  // Second session to verify accumulation
  console.log("\n=== Second Session (verify accumulation) ===");
  await emit("session_start");
  await emit("turn_start");
  await sleep(150);
  await emit("turn_end", { message: { role: "assistant" } });
  await sleep(50);
  await emit("session_shutdown");

  console.log("\n--- Final accumulated status ---");
  if (statusCmd) {
    await statusCmd.handler("", mockCtx);
  }

  console.log("\n=== Verification Complete ===");
  console.log("Expected behavior:");
  console.log("  - Session durations accumulated across 2 sessions");
  console.log("  - Turn durations accumulated across 4 turns");
  console.log("  - Tool durations accumulated across 4 tool calls");
  console.log("  - Edge cases did not crash or corrupt state");
}

verifyDurationTracking().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
