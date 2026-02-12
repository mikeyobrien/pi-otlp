/**
 * Integration demo: simulates pi extension lifecycle
 *
 * Run with: npx tsx test/verify/integration-demo.ts
 *
 * Set PI_OTLP_ENABLE=1 and PI_OTLP_DEBUG=1 to see output.
 */

import extension from "../../src/index.js";

// Mock ExtensionAPI that simulates pi's event system
interface MockEvent {
  toolName?: string;
  isError?: boolean;
  text?: string;
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
    console.log(`[mock] registered handler for: ${event}`);
  },
  registerCommand(name: string, opts: CommandHandler) {
    commands.set(name, opts);
    console.log(`[mock] registered command: /${name}`);
  },
};

const mockCtx: MockContext = {
  sessionManager: { getSessionId: () => "demo-session-123" },
  ui: {
    async notify(msg: string) {
      console.log(`[notify]\n${msg}`);
    },
  },
};

async function simulateSession() {
  console.log("\n=== Simulating pi session ===\n");

  // Initialize extension
  extension(mockPi as unknown as Parameters<typeof extension>[0]);

  if (handlers.size === 0) {
    console.log("[demo] Extension disabled - set PI_OTLP_ENABLE=1");
    return;
  }

  // Simulate session lifecycle
  const emit = async (event: string, data: MockEvent = {}) => {
    const handler = handlers.get(event);
    if (handler) {
      console.log(`[event] ${event}`);
      await handler(data, mockCtx);
    }
  };

  await emit("session_start");

  // Simulate some turns and tools
  for (let turn = 0; turn < 3; turn++) {
    await emit("turn_start");

    await emit("input", { text: `User prompt ${turn + 1}: explain this code` });

    // Simulate tool calls
    await emit("tool_call", { toolName: "Read" });
    await emit("tool_result", { toolName: "Read", isError: false });

    await emit("tool_call", { toolName: "Bash" });
    await emit("tool_result", { toolName: "Bash", isError: turn === 1 }); // One failure

    await emit("turn_end");
  }

  // Check status command
  const statusCmd = commands.get("otlp-status");
  if (statusCmd) {
    console.log("\n[demo] Running /otlp-status command:");
    await statusCmd.handler("", mockCtx);
  }

  // Shutdown
  console.log("\n[demo] Shutting down...");
  await emit("session_shutdown");

  console.log("\n=== Demo complete ===");
}

simulateSession().catch(console.error);
