/**
 * Verification tests for telemetry.ts
 * Exercises the TelemetryCollector with mock OpenTelemetry meter
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTelemetryCollector } from "../../src/telemetry.js";
import type { Meter, Counter } from "@opentelemetry/api";

function createMockMeter(): { meter: Meter; counters: Map<string, Counter> } {
  const counters = new Map<string, Counter>();

  const mockCounter = (name: string): Counter => {
    const counter = {
      add: vi.fn(),
    } as unknown as Counter;
    counters.set(name, counter);
    return counter;
  };

  const meter = {
    createCounter: vi.fn((name: string) => mockCounter(name)),
    createHistogram: vi.fn(),
    createUpDownCounter: vi.fn(),
    createObservableCounter: vi.fn(),
    createObservableGauge: vi.fn(),
    createObservableUpDownCounter: vi.fn(),
  } as unknown as Meter;

  return { meter, counters };
}

describe("TelemetryCollector", () => {
  let collector: ReturnType<typeof createTelemetryCollector>;
  let counters: Map<string, Counter>;

  beforeEach(() => {
    const mock = createMockMeter();
    collector = createTelemetryCollector(mock.meter);
    counters = mock.counters;
  });

  describe("recordSessionStart", () => {
    it("increments session counter with session ID", () => {
      collector.recordSessionStart({ sessionId: "sess-123" });

      const counter = counters.get("pi.session.count");
      expect(counter?.add).toHaveBeenCalledWith(1, { "session.id": "sess-123" });
    });

    it("updates status", () => {
      collector.recordSessionStart({ sessionId: "sess-456" });
      expect(collector.getStatus().sessions).toBe(1);
    });
  });

  describe("recordTurnStart", () => {
    it("increments turn counter", () => {
      collector.recordSessionStart({ sessionId: "sess-123" });
      collector.recordTurnStart();

      const counter = counters.get("pi.turn.count");
      expect(counter?.add).toHaveBeenCalledWith(1, { "session.id": "sess-123" });
    });

    it("updates status", () => {
      collector.recordTurnStart();
      collector.recordTurnStart();
      expect(collector.getStatus().turns).toBe(2);
    });
  });

  describe("recordToolCall", () => {
    it("increments tool call counter with tool name", () => {
      collector.recordSessionStart({ sessionId: "sess-123" });
      collector.recordToolCall({ toolName: "Bash" });

      const counter = counters.get("pi.tool_call.count");
      expect(counter?.add).toHaveBeenCalledWith(1, {
        "session.id": "sess-123",
        "tool.name": "Bash",
      });
    });
  });

  describe("recordToolResult", () => {
    it("increments tool result counter with success status", () => {
      collector.recordSessionStart({ sessionId: "sess-123" });
      collector.recordToolResult({ toolName: "Read", success: true });

      const counter = counters.get("pi.tool_result.count");
      expect(counter?.add).toHaveBeenCalledWith(1, {
        "session.id": "sess-123",
        "tool.name": "Read",
        success: "true",
      });
    });

    it("records failure status", () => {
      collector.recordSessionStart({ sessionId: "sess-123" });
      collector.recordToolResult({ toolName: "Bash", success: false });

      const counter = counters.get("pi.tool_result.count");
      expect(counter?.add).toHaveBeenCalledWith(1, {
        "session.id": "sess-123",
        "tool.name": "Bash",
        success: "false",
      });
    });
  });

  describe("recordUserPrompt", () => {
    it("increments prompt counter with length attribute", () => {
      collector.recordSessionStart({ sessionId: "sess-123" });
      collector.recordUserPrompt({ promptLength: 42 });

      const counter = counters.get("pi.prompt.count");
      expect(counter?.add).toHaveBeenCalledWith(1, {
        "session.id": "sess-123",
        "prompt.length": 42,
      });
    });
  });

  describe("getStatus", () => {
    it("returns accumulated counts", () => {
      collector.recordSessionStart({ sessionId: "s1" });
      collector.recordTurnStart();
      collector.recordTurnStart();
      collector.recordToolCall({ toolName: "t1" });
      collector.recordToolCall({ toolName: "t2" });
      collector.recordToolCall({ toolName: "t3" });
      collector.recordUserPrompt({ promptLength: 10 });

      expect(collector.getStatus()).toEqual({
        sessions: 1,
        turns: 2,
        tools: 3,
        prompts: 1,
        tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      });
    });

    it("returns a copy, not the internal object", () => {
      const status1 = collector.getStatus();
      collector.recordSessionStart({ sessionId: "s" });
      const status2 = collector.getStatus();

      expect(status1.sessions).toBe(0);
      expect(status2.sessions).toBe(1);
    });
  });

  describe("session lifecycle", () => {
    it("clears session ID on session end", () => {
      collector.recordSessionStart({ sessionId: "sess-123" });
      collector.recordSessionEnd();
      collector.recordTurnStart();

      const counter = counters.get("pi.turn.count");
      expect(counter?.add).toHaveBeenCalledWith(1, { "session.id": "" });
    });
  });

  describe("recordUsage", () => {
    const sampleUsage = {
      input: 100,
      output: 50,
      cacheRead: 25,
      cacheWrite: 10,
      totalTokens: 185,
      cost: {
        input: 0.001,
        output: 0.002,
        cacheRead: 0.0005,
        cacheWrite: 0.0003,
        total: 0.0038,
      },
    };

    it("records token counts by type", () => {
      collector.recordSessionStart({ sessionId: "sess-123" });
      collector.recordUsage(sampleUsage);

      const counter = counters.get("pi.token.usage");
      expect(counter?.add).toHaveBeenCalledWith(100, { "session.id": "sess-123", type: "input" });
      expect(counter?.add).toHaveBeenCalledWith(50, { "session.id": "sess-123", type: "output" });
      expect(counter?.add).toHaveBeenCalledWith(25, { "session.id": "sess-123", type: "cache_read" });
      expect(counter?.add).toHaveBeenCalledWith(10, { "session.id": "sess-123", type: "cache_write" });
    });

    it("records cost by type", () => {
      collector.recordSessionStart({ sessionId: "sess-123" });
      collector.recordUsage(sampleUsage);

      const counter = counters.get("pi.cost.usage");
      expect(counter?.add).toHaveBeenCalledWith(0.001, { "session.id": "sess-123", type: "input" });
      expect(counter?.add).toHaveBeenCalledWith(0.002, { "session.id": "sess-123", type: "output" });
      expect(counter?.add).toHaveBeenCalledWith(0.0005, { "session.id": "sess-123", type: "cache_read" });
      expect(counter?.add).toHaveBeenCalledWith(0.0003, { "session.id": "sess-123", type: "cache_write" });
    });

    it("accumulates token totals in status", () => {
      collector.recordUsage(sampleUsage);
      collector.recordUsage(sampleUsage);

      const status = collector.getStatus();
      expect(status.tokens).toEqual({
        input: 200,
        output: 100,
        cacheRead: 50,
        cacheWrite: 20,
        total: 370,
      });
    });

    it("accumulates cost totals in status", () => {
      collector.recordUsage(sampleUsage);
      collector.recordUsage(sampleUsage);

      const status = collector.getStatus();
      expect(status.cost.input).toBeCloseTo(0.002);
      expect(status.cost.output).toBeCloseTo(0.004);
      expect(status.cost.cacheRead).toBeCloseTo(0.001);
      expect(status.cost.cacheWrite).toBeCloseTo(0.0006);
      expect(status.cost.total).toBeCloseTo(0.0076);
    });
  });

  describe("getStatus with tokens and cost", () => {
    it("returns deep copies of nested objects", () => {
      const usage = {
        input: 10,
        output: 5,
        cacheRead: 2,
        cacheWrite: 1,
        totalTokens: 18,
        cost: { input: 0.01, output: 0.02, cacheRead: 0.001, cacheWrite: 0.001, total: 0.032 },
      };
      collector.recordUsage(usage);

      const status1 = collector.getStatus();
      collector.recordUsage(usage);
      const status2 = collector.getStatus();

      expect(status1.tokens.total).toBe(18);
      expect(status2.tokens.total).toBe(36);
    });
  });
});
