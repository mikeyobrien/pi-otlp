import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getConfig } from "./config.js";

describe("getConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns disabled by default", () => {
    delete process.env.PI_OTLP_ENABLE;
    const config = getConfig();
    expect(config.enabled).toBe(false);
  });

  it("enables when PI_OTLP_ENABLE=1", () => {
    process.env.PI_OTLP_ENABLE = "1";
    const config = getConfig();
    expect(config.enabled).toBe(true);
  });

  it("parses OTEL_METRICS_EXPORTER", () => {
    process.env.OTEL_METRICS_EXPORTER = "console,otlp";
    const config = getConfig();
    expect(config.exporters).toEqual(["console", "otlp"]);
  });

  it("defaults to console exporter", () => {
    delete process.env.OTEL_METRICS_EXPORTER;
    const config = getConfig();
    expect(config.exporters).toEqual(["console"]);
  });

  it("parses OTEL_METRIC_EXPORT_INTERVAL", () => {
    process.env.OTEL_METRIC_EXPORT_INTERVAL = "5000";
    const config = getConfig();
    expect(config.exportIntervalMs).toBe(5000);
  });
});
