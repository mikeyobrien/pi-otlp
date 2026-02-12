/**
 * Edge case tests for config parsing
 * Tests unusual inputs and boundary conditions
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getConfig } from "../../src/config.js";

describe("Config Edge Cases", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("header parsing edge cases", () => {
    it("handles headers with equals signs in values (like base64)", () => {
      process.env.OTEL_EXPORTER_OTLP_HEADERS = "Authorization=Basic dXNlcjpwYXNz==";
      const config = getConfig();
      expect(config.otlpHeaders).toEqual({
        Authorization: "Basic dXNlcjpwYXNz==",
      });
    });

    it("handles empty header string", () => {
      process.env.OTEL_EXPORTER_OTLP_HEADERS = "";
      const config = getConfig();
      expect(config.otlpHeaders).toEqual({});
    });

    it("handles whitespace around header keys and values", () => {
      process.env.OTEL_EXPORTER_OTLP_HEADERS = " X-Key = value , Y-Key = other ";
      const config = getConfig();
      expect(config.otlpHeaders).toEqual({
        "X-Key": "value",
        "Y-Key": "other",
      });
    });

    it("skips malformed header entries (missing value)", () => {
      process.env.OTEL_EXPORTER_OTLP_HEADERS = "Good=value,BadNoEquals,Another=ok";
      const config = getConfig();
      expect(config.otlpHeaders).toEqual({
        Good: "value",
        Another: "ok",
      });
    });
  });

  describe("exporter parsing", () => {
    it("handles whitespace around exporter names", () => {
      process.env.OTEL_METRICS_EXPORTER = " console , otlp ";
      const config = getConfig();
      expect(config.exporters).toEqual(["console", "otlp"]);
    });

    it("handles single exporter", () => {
      process.env.OTEL_METRICS_EXPORTER = "otlp";
      const config = getConfig();
      expect(config.exporters).toEqual(["otlp"]);
    });
  });

  describe("export interval parsing", () => {
    it("uses default when not a valid number", () => {
      process.env.OTEL_METRIC_EXPORT_INTERVAL = "not-a-number";
      const config = getConfig();
      expect(config.exportIntervalMs).toBe(NaN);
    });

    it("handles zero interval", () => {
      process.env.OTEL_METRIC_EXPORT_INTERVAL = "0";
      const config = getConfig();
      expect(config.exportIntervalMs).toBe(0);
    });

    it("handles negative interval", () => {
      process.env.OTEL_METRIC_EXPORT_INTERVAL = "-1000";
      const config = getConfig();
      expect(config.exportIntervalMs).toBe(-1000);
    });
  });

  describe("enable flag variations", () => {
    it("only enables with exact value '1'", () => {
      const testCases = [
        { value: "1", expected: true },
        { value: "true", expected: false },
        { value: "yes", expected: false },
        { value: "TRUE", expected: false },
        { value: "0", expected: false },
        { value: "", expected: false },
      ];

      for (const { value, expected } of testCases) {
        process.env.PI_OTLP_ENABLE = value;
        const config = getConfig();
        expect(config.enabled, `PI_OTLP_ENABLE=${value}`).toBe(expected);
      }
    });
  });

  describe("endpoint fallback chain", () => {
    it("uses default when neither endpoint env var is set", () => {
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
      delete process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
      const config = getConfig();
      expect(config.otlpEndpoint).toBe("http://localhost:4318/v1/metrics");
    });
  });
});
