import type { Meter, Counter, Histogram } from "@opentelemetry/api";

export interface UsageData {
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
}

export interface TelemetryCollector {
  recordSessionStart(attrs: { sessionId: string; provider?: string; model?: string }): void;
  recordSessionEnd(): void;
  recordTurnStart(): void;
  recordTurnEnd(): void;
  recordToolCall(attrs: { toolName: string }): void;
  recordToolResult(attrs: {
    toolName: string;
    success: boolean;
  }): void;
  recordUserPrompt(attrs: { promptLength: number }): void;
  recordUsage(usage: UsageData): void;
  /** Update provider/model (e.g., when user switches models mid-session) */
  setProviderModel(provider: string, model: string): void;
  getStatus(): TelemetryStatus;
  /** For testing: allows injecting a custom time source */
  _setTimeSource?(fn: () => number): void;
}

export interface DurationStats {
  count: number;
  totalMs: number;
  lastMs: number;
}

export interface TelemetryStatus {
  sessions: number;
  turns: number;
  tools: number;
  prompts: number;
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  durations: {
    session: DurationStats;
    turn: DurationStats;
    tool: DurationStats;
  };
}

interface Counters {
  sessionCounter: Counter;
  turnCounter: Counter;
  toolCallCounter: Counter;
  toolResultCounter: Counter;
  promptCounter: Counter;
  tokenCounter: Counter;
  costCounter: Counter;
}

interface Histograms {
  sessionDuration: Histogram;
  turnDuration: Histogram;
  toolDuration: Histogram;
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
    tokenCounter: meter.createCounter("pi.token.usage", {
      description: "Token usage by type (input/output/cache)",
      unit: "tokens",
    }),
    costCounter: meter.createCounter("pi.cost.usage", {
      description: "Cost in USD by type (input/output/cache)",
      unit: "USD",
    }),
  };

  const histograms: Histograms = {
    sessionDuration: meter.createHistogram("pi.session.duration", {
      description: "Session duration in seconds",
      unit: "s",
    }),
    turnDuration: meter.createHistogram("pi.turn.duration", {
      description: "Turn duration in seconds",
      unit: "s",
    }),
    toolDuration: meter.createHistogram("pi.tool.duration", {
      description: "Tool execution duration in seconds",
      unit: "s",
    }),
  };

  const status: TelemetryStatus = {
    sessions: 0,
    turns: 0,
    tools: 0,
    prompts: 0,
    tokens: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
    durations: {
      session: { count: 0, totalMs: 0, lastMs: 0 },
      turn: { count: 0, totalMs: 0, lastMs: 0 },
      tool: { count: 0, totalMs: 0, lastMs: 0 },
    },
  };

  let currentSessionId = "";
  let currentProvider = "unknown";
  let currentModel = "unknown";

  // Timing state
  let sessionStartTime: number | null = null;
  let turnStartTime: number | null = null;
  const toolStartTimes = new Map<string, number>();

  // Time source (injectable for testing)
  let now = () => Date.now();

  // Helper to get common attributes including provider/model
  const getBaseAttrs = () => ({
    "session.id": currentSessionId,
    "provider": currentProvider,
    "model": currentModel,
  });

  return {
    recordSessionStart(attrs) {
      currentSessionId = attrs.sessionId;
      currentProvider = attrs.provider ?? "unknown";
      currentModel = attrs.model ?? "unknown";
      sessionStartTime = now();
      counters.sessionCounter.add(1, getBaseAttrs());
      status.sessions++;
    },

    recordSessionEnd() {
      if (sessionStartTime !== null) {
        const durationMs = now() - sessionStartTime;
        const durationS = durationMs / 1000;
        histograms.sessionDuration.record(durationS, getBaseAttrs());
        status.durations.session.count++;
        status.durations.session.totalMs += durationMs;
        status.durations.session.lastMs = durationMs;
        sessionStartTime = null;
      }
      currentSessionId = "";
    },

    recordTurnStart() {
      turnStartTime = now();
      counters.turnCounter.add(1, getBaseAttrs());
      status.turns++;
    },

    recordTurnEnd() {
      if (turnStartTime !== null) {
        const durationMs = now() - turnStartTime;
        const durationS = durationMs / 1000;
        histograms.turnDuration.record(durationS, getBaseAttrs());
        status.durations.turn.count++;
        status.durations.turn.totalMs += durationMs;
        status.durations.turn.lastMs = durationMs;
        turnStartTime = null;
      }
    },

    recordToolCall(attrs) {
      toolStartTimes.set(attrs.toolName, now());
      counters.toolCallCounter.add(1, {
        ...getBaseAttrs(),
        "tool.name": attrs.toolName,
      });
      status.tools++;
    },

    recordToolResult(attrs) {
      const startTime = toolStartTimes.get(attrs.toolName);
      if (startTime !== undefined) {
        const durationMs = now() - startTime;
        const durationS = durationMs / 1000;
        histograms.toolDuration.record(durationS, {
          ...getBaseAttrs(),
          "tool.name": attrs.toolName,
          success: String(attrs.success),
        });
        status.durations.tool.count++;
        status.durations.tool.totalMs += durationMs;
        status.durations.tool.lastMs = durationMs;
        toolStartTimes.delete(attrs.toolName);
      }
      counters.toolResultCounter.add(1, {
        ...getBaseAttrs(),
        "tool.name": attrs.toolName,
        success: String(attrs.success),
      });
    },

    recordUserPrompt(attrs) {
      counters.promptCounter.add(1, {
        ...getBaseAttrs(),
        "prompt.length": attrs.promptLength,
      });
      status.prompts++;
    },

    setProviderModel(provider: string, model: string) {
      currentProvider = provider;
      currentModel = model;
    },

    recordUsage(usage) {
      const baseAttrs = getBaseAttrs();

      counters.tokenCounter.add(usage.input, { ...baseAttrs, type: "input" });
      counters.tokenCounter.add(usage.output, { ...baseAttrs, type: "output" });
      counters.tokenCounter.add(usage.cacheRead, { ...baseAttrs, type: "cache_read" });
      counters.tokenCounter.add(usage.cacheWrite, { ...baseAttrs, type: "cache_write" });

      counters.costCounter.add(usage.cost.input, { ...baseAttrs, type: "input" });
      counters.costCounter.add(usage.cost.output, { ...baseAttrs, type: "output" });
      counters.costCounter.add(usage.cost.cacheRead, { ...baseAttrs, type: "cache_read" });
      counters.costCounter.add(usage.cost.cacheWrite, { ...baseAttrs, type: "cache_write" });

      status.tokens.input += usage.input;
      status.tokens.output += usage.output;
      status.tokens.cacheRead += usage.cacheRead;
      status.tokens.cacheWrite += usage.cacheWrite;
      status.tokens.total += usage.totalTokens;

      status.cost.input += usage.cost.input;
      status.cost.output += usage.cost.output;
      status.cost.cacheRead += usage.cost.cacheRead;
      status.cost.cacheWrite += usage.cost.cacheWrite;
      status.cost.total += usage.cost.total;
    },

    getStatus() {
      return {
        ...status,
        tokens: { ...status.tokens },
        cost: { ...status.cost },
        durations: {
          session: { ...status.durations.session },
          turn: { ...status.durations.turn },
          tool: { ...status.durations.tool },
        },
      };
    },

    _setTimeSource(fn: () => number) {
      now = fn;
    },
  };
}
