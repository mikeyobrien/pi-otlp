import type { Meter, Counter } from "@opentelemetry/api";

export interface TelemetryCollector {
  recordSessionStart(attrs: { sessionId: string }): void;
  recordSessionEnd(): void;
  recordTurnStart(): void;
  recordTurnEnd(): void;
  recordToolCall(attrs: { toolName: string }): void;
  recordToolResult(attrs: {
    toolName: string;
    success: boolean;
  }): void;
  recordUserPrompt(attrs: { promptLength: number }): void;
  getStatus(): TelemetryStatus;
}

export interface TelemetryStatus {
  sessions: number;
  turns: number;
  tools: number;
  prompts: number;
}

interface Counters {
  sessionCounter: Counter;
  turnCounter: Counter;
  toolCallCounter: Counter;
  toolResultCounter: Counter;
  promptCounter: Counter;
}

export function createTelemetryCollector(meter: Meter): TelemetryCollector {
  const counters: Counters = {
    sessionCounter: meter.createCounter("pi.session.count", {
      description: "Count of pi coding sessions started",
      unit: "1",
    }),
    turnCounter: meter.createCounter("pi.turn.count", {
      description: "Count of agent turns (tool-calling loops)",
      unit: "1",
    }),
    toolCallCounter: meter.createCounter("pi.tool_call.count", {
      description: "Count of tool invocations",
      unit: "1",
    }),
    toolResultCounter: meter.createCounter("pi.tool_result.count", {
      description: "Count of tool completions",
      unit: "1",
    }),
    promptCounter: meter.createCounter("pi.prompt.count", {
      description: "Count of user prompts submitted",
      unit: "1",
    }),
  };

  const status: TelemetryStatus = {
    sessions: 0,
    turns: 0,
    tools: 0,
    prompts: 0,
  };

  let currentSessionId = "";

  return {
    recordSessionStart(attrs) {
      currentSessionId = attrs.sessionId;
      counters.sessionCounter.add(1, { "session.id": currentSessionId });
      status.sessions++;
    },

    recordSessionEnd() {
      currentSessionId = "";
    },

    recordTurnStart() {
      counters.turnCounter.add(1, { "session.id": currentSessionId });
      status.turns++;
    },

    recordTurnEnd() {
      // Turn end tracked via turnCounter on start
    },

    recordToolCall(attrs) {
      counters.toolCallCounter.add(1, {
        "session.id": currentSessionId,
        "tool.name": attrs.toolName,
      });
      status.tools++;
    },

    recordToolResult(attrs) {
      counters.toolResultCounter.add(1, {
        "session.id": currentSessionId,
        "tool.name": attrs.toolName,
        success: String(attrs.success),
      });
    },

    recordUserPrompt(attrs) {
      counters.promptCounter.add(1, {
        "session.id": currentSessionId,
        "prompt.length": attrs.promptLength,
      });
      status.prompts++;
    },

    getStatus() {
      return { ...status };
    },
  };
}
