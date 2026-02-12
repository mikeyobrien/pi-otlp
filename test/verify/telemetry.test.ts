/**
 * Verification tests for telemetry.ts
 * Exercises the TelemetryCollector with mock OpenTelemetry meter
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTelemetryCollector } from "../../src/telemetry.js";
import type { Meter, Counter } from "@opentelemetry/api";

interface MockHistogram {
  record: ReturnType<typeof vi.fn>;
}

function createMockMeter(): { meter: Meter; counters: Map<string, Counter>; histograms: Map<string, MockHistogram> } {
  const counters = new Map<string, Counter>();
  const histograms = new Map<string, MockHistogram>();

  const mockCounter = (name: string): Counter => {
    const counter = {
      add: vi.fn(),
    } as unknown as Counter;
    counters.set(name, counter);
    return counter;
  };

  const mockHistogram = (name: string): MockHistogram => {
    const histogram = {
      record: vi.fn(),
    };
    histograms.set(name, histogram);
    return histogram;
  };

  const meter = {
    createCounter: vi.fn((name: string) => mockCounter(name)),
    createHistogram: vi.fn((name: string) => mockHistogram(name)),
    createUpDownCounter: vi.fn(),
    createObservableCounter: vi.fn(),
    createObservableGauge: vi.fn(),
    createObservableUpDownCounter: vi.fn(),
  } as unknown as Meter;

  return { meter, counters, histograms };
}

describe("TelemetryCollector", () => {
  let collector: ReturnType<typeof createTelemetryCollector>;
  let counters: Map<string, Counter>;
  let histograms: Map<string, MockHistogram>;

  beforeEach(() => {
    const mock = createMockMeter();
    collector = createTelemetryCollector(mock.meter);
    counters = mock.counters;
    histograms = mock.histograms;
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
        durations: {
          session: { count: 0, totalMs: 0, lastMs: 0 },
          turn: { count: 0, totalMs: 0, lastMs: 0 },
          tool: { count: 0, totalMs: 0, lastMs: 0 },
        },
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

  describe("duration tracking", () => {
    it("records session duration histogram on session end", () => {
      let time = 1000;
      collector._setTimeSource?.(() => time);

      collector.recordSessionStart({ sessionId: "sess-123" });
      time = 6000; // 5 seconds later
      collector.recordSessionEnd();

      const histogram = histograms.get("pi.session.duration");
      expect(histogram?.record).toHaveBeenCalledWith(5, { "session.id": "sess-123" });
    });

    it("records turn duration histogram on turn end", () => {
      let time = 1000;
      collector._setTimeSource?.(() => time);

      collector.recordSessionStart({ sessionId: "sess-123" });
      collector.recordTurnStart();
      time = 3500; // 2.5 seconds later
      collector.recordTurnEnd();

      const histogram = histograms.get("pi.turn.duration");
      expect(histogram?.record).toHaveBeenCalledWith(2.5, { "session.id": "sess-123" });
    });

    it("records tool duration histogram on tool result", () => {
      let time = 1000;
      collector._setTimeSource?.(() => time);

      collector.recordSessionStart({ sessionId: "sess-123" });
      collector.recordToolCall({ toolName: "Bash" });
      time = 1200; // 200ms later
      collector.recordToolResult({ toolName: "Bash", success: true });

      const histogram = histograms.get("pi.tool.duration");
      expect(histogram?.record).toHaveBeenCalledWith(0.2, {
        "session.id": "sess-123",
        "tool.name": "Bash",
        success: "true",
      });
    });

    it("accumulates session duration stats", () => {
      let time = 1000;
      collector._setTimeSource?.(() => time);

      collector.recordSessionStart({ sessionId: "s1" });
      time = 4000;
      collector.recordSessionEnd();

      collector.recordSessionStart({ sessionId: "s2" });
      time = 10000;
      collector.recordSessionEnd();

      const status = collector.getStatus();
      expect(status.durations.session.count).toBe(2);
      expect(status.durations.session.totalMs).toBe(9000); // 3000 + 6000
      expect(status.durations.session.lastMs).toBe(6000);
    });

    it("accumulates turn duration stats", () => {
      let time = 1000;
      collector._setTimeSource?.(() => time);

      collector.recordTurnStart();
      time = 2000;
      collector.recordTurnEnd();

      collector.recordTurnStart();
      time = 5000;
      collector.recordTurnEnd();

      const status = collector.getStatus();
      expect(status.durations.turn.count).toBe(2);
      expect(status.durations.turn.totalMs).toBe(4000); // 1000 + 3000
      expect(status.durations.turn.lastMs).toBe(3000);
    });

    it("accumulates tool duration stats", () => {
      let time = 1000;
      collector._setTimeSource?.(() => time);

      collector.recordToolCall({ toolName: "Read" });
      time = 1100;
      collector.recordToolResult({ toolName: "Read", success: true });

      collector.recordToolCall({ toolName: "Write" });
      time = 1400;
      collector.recordToolResult({ toolName: "Write", success: true });

      const status = collector.getStatus();
      expect(status.durations.tool.count).toBe(2);
      expect(status.durations.tool.totalMs).toBe(400); // 100 + 300
      expect(status.durations.tool.lastMs).toBe(300);
    });

    it("handles concurrent tool calls", () => {
      let time = 1000;
      collector._setTimeSource?.(() => time);

      collector.recordSessionStart({ sessionId: "sess-123" });
      collector.recordToolCall({ toolName: "Read" });
      time = 1050;
      collector.recordToolCall({ toolName: "Glob" });
      time = 1150;
      collector.recordToolResult({ toolName: "Glob", success: true }); // Glob finishes first
      time = 1200;
      collector.recordToolResult({ toolName: "Read", success: true }); // Read finishes second

      const histogram = histograms.get("pi.tool.duration");
      // Glob: 1150 - 1050 = 100ms = 0.1s
      expect(histogram?.record).toHaveBeenCalledWith(0.1, {
        "session.id": "sess-123",
        "tool.name": "Glob",
        success: "true",
      });
      // Read: 1200 - 1000 = 200ms = 0.2s
      expect(histogram?.record).toHaveBeenCalledWith(0.2, {
        "session.id": "sess-123",
        "tool.name": "Read",
        success: "true",
      });
    });

    it("does not record session duration if session was not started", () => {
      collector.recordSessionEnd();

      const histogram = histograms.get("pi.session.duration");
      expect(histogram?.record).not.toHaveBeenCalled();
    });

    it("does not record turn duration if turn was not started", () => {
      collector.recordTurnEnd();

      const histogram = histograms.get("pi.turn.duration");
      expect(histogram?.record).not.toHaveBeenCalled();
    });

    it("does not record tool duration if tool was not called", () => {
      collector.recordToolResult({ toolName: "Unknown", success: true });

      const histogram = histograms.get("pi.tool.duration");
      expect(histogram?.record).not.toHaveBeenCalled();
    });

    it("returns deep copies of duration stats", () => {
      let time = 1000;
      collector._setTimeSource?.(() => time);

      collector.recordTurnStart();
      time = 2000;
      collector.recordTurnEnd();

      const status1 = collector.getStatus();
      collector.recordTurnStart();
      time = 4000;
      collector.recordTurnEnd();
      const status2 = collector.getStatus();

      expect(status1.durations.turn.count).toBe(1);
      expect(status2.durations.turn.count).toBe(2);
    });
  });
});
