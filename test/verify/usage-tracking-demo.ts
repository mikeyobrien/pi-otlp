/**
 * Usage tracking demo: verifies token and cost metrics work end-to-end
 *
 * Run with: PI_OTLP_ENABLE=1 npx tsx test/verify/usage-tracking-demo.ts
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
  sessionManager: { getSessionId: () => "usage-demo-session" },
  ui: {
    async notify(msg: string) {
      console.log(`\n[STATUS OUTPUT]\n${msg}\n`);
    },
  },
};

async function verifyUsageTracking() {
  console.log("=== Usage Tracking Verification ===\n");

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
  await emit("session_start");

  // Simulate turn with usage data (like pi would provide)
  await emit("turn_start");
  await emit("input", { text: "What is the meaning of life?" });

  // Turn end with assistant message containing usage
  await emit("turn_end", {
    message: {
      role: "assistant",
      usage: {
        input: 1500,
        output: 750,
        cacheRead: 200,
        cacheWrite: 50,
        totalTokens: 2500,
        cost: {
          input: 0.015,
          output: 0.0225,
          cacheRead: 0.001,
          cacheWrite: 0.0005,
          total: 0.039,
        },
      },
    },
  });

  // Second turn
  await emit("turn_start");
  await emit("input", { text: "Tell me more" });
  await emit("turn_end", {
    message: {
      role: "assistant",
      usage: {
        input: 2000,
        output: 500,
        cacheRead: 300,
        cacheWrite: 100,
        totalTokens: 2900,
        cost: {
          input: 0.02,
          output: 0.015,
          cacheRead: 0.0015,
          cacheWrite: 0.001,
          total: 0.0375,
        },
      },
    },
  });

  // Verify status shows accumulated values
  console.log("Expected totals:");
  console.log("  Tokens: 5400 (in: 3500, out: 1250, cache: 500/150)");
  console.log("  Cost: $0.0765");

  const statusCmd = commands.get("otlp-status");
  if (statusCmd) {
    await statusCmd.handler("", mockCtx);
  }

  // Edge cases
  console.log("\n--- Edge Case: turn_end without usage ---");
  await emit("turn_start");
  await emit("turn_end", { message: { role: "assistant" } }); // No usage property

  console.log("--- Edge Case: turn_end with user message (not assistant) ---");
  await emit("turn_start");
  await emit("turn_end", { message: { role: "user" } }); // Wrong role

  console.log("--- Edge Case: turn_end without message ---");
  await emit("turn_start");
  await emit("turn_end", {}); // No message at all

  // Final status should be unchanged from earlier
  console.log("\nFinal status (should be same as before edge cases):");
  if (statusCmd) {
    await statusCmd.handler("", mockCtx);
  }

  await emit("session_shutdown");
  console.log("\n=== Verification Complete ===");
}

verifyUsageTracking().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
