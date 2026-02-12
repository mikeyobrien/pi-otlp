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
});
