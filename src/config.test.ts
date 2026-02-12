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

  it("uses OTEL_EXPORTER_OTLP_ENDPOINT", () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://collector:4318";
    const config = getConfig();
    expect(config.otlpEndpoint).toBe("http://collector:4318");
  });

  it("prefers OTEL_EXPORTER_OTLP_METRICS_ENDPOINT over general endpoint", () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://general:4318";
    process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT = "http://metrics:4318";
    const config = getConfig();
    expect(config.otlpEndpoint).toBe("http://metrics:4318");
  });

  it("parses OTEL_EXPORTER_OTLP_HEADERS", () => {
    process.env.OTEL_EXPORTER_OTLP_HEADERS = "Authorization=Bearer token,X-Api-Key=key123";
    const config = getConfig();
    expect(config.otlpHeaders).toEqual({
      Authorization: "Bearer token",
      "X-Api-Key": "key123",
    });
  });

  it("parses OTEL_METRIC_EXPORT_INTERVAL", () => {
    process.env.OTEL_METRIC_EXPORT_INTERVAL = "5000";
    const config = getConfig();
    expect(config.exportIntervalMs).toBe(5000);
  });
});
