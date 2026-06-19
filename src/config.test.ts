import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getConfig } from "./config.js";

describe("getConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear basic auth vars so they don't inject an Authorization header
    delete process.env.PI_OTLP_BASIC_AUTH_USER;
    delete process.env.PI_OTLP_BASIC_AUTH_PASSWORD;
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

  it("appends /v1/metrics to OTEL_EXPORTER_OTLP_ENDPOINT", () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://collector:4318";
    const config = getConfig();
    expect(config.otlpEndpoint).toBe("http://collector:4318/v1/metrics");
  });

  it("does not double-append /v1/metrics to OTEL_EXPORTER_OTLP_ENDPOINT", () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://collector:4318/v1/metrics";
    const config = getConfig();
    expect(config.otlpEndpoint).toBe("http://collector:4318/v1/metrics");
  });

  it("strips trailing slash from OTEL_EXPORTER_OTLP_ENDPOINT", () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://collector:4318/otlp/";
    const config = getConfig();
    expect(config.otlpEndpoint).toBe("http://collector:4318/otlp/v1/metrics");
  });

  it("uses OTEL_EXPORTER_OTLP_METRICS_ENDPOINT as-is (full URL)", () => {
    process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT = "http://metrics:4318/custom/path";
    const config = getConfig();
    expect(config.otlpEndpoint).toBe("http://metrics:4318/custom/path");
  });

  it("prefers OTEL_EXPORTER_OTLP_METRICS_ENDPOINT over general endpoint", () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://general:4318";
    process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT = "http://metrics:4318/v1/metrics";
    const config = getConfig();
    expect(config.otlpEndpoint).toBe("http://metrics:4318/v1/metrics");
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

  it("returns undefined user by default", () => {
    delete process.env.PI_OTLP_USER_LABEL;
    const config = getConfig();
    expect(config.user).toBeUndefined();
  });

  it("reads PI_OTLP_USER when set", () => {
    process.env.PI_OTLP_USER_LABEL = "alice";
    const config = getConfig();
    expect(config.user).toBe("alice");
  });

  it("sets Authorization header from basic auth env vars", () => {
    process.env.PI_OTLP_BASIC_AUTH_USER = "123456";
    process.env.PI_OTLP_BASIC_AUTH_PASSWORD = "glc_abc123";
    const config = getConfig();
    const expected = `Basic ${Buffer.from("123456:glc_abc123").toString("base64")}`;
    expect(config.otlpHeaders["Authorization"]).toBe(expected);
  });

  it("does not set Authorization header when only user is set", () => {
    process.env.PI_OTLP_BASIC_AUTH_USER = "123456";
    delete process.env.PI_OTLP_BASIC_AUTH_PASSWORD;
    const config = getConfig();
    expect(config.otlpHeaders["Authorization"]).toBeUndefined();
  });

  it("does not set Authorization header when only password is set", () => {
    delete process.env.PI_OTLP_BASIC_AUTH_USER;
    process.env.PI_OTLP_BASIC_AUTH_PASSWORD = "glc_abc123";
    const config = getConfig();
    expect(config.otlpHeaders["Authorization"]).toBeUndefined();
  });

  it("basic auth overrides Authorization from OTEL_EXPORTER_OTLP_HEADERS", () => {
    process.env.OTEL_EXPORTER_OTLP_HEADERS = "Authorization=Bearer old-token";
    process.env.PI_OTLP_BASIC_AUTH_USER = "user";
    process.env.PI_OTLP_BASIC_AUTH_PASSWORD = "pass";
    const config = getConfig();
    const expected = `Basic ${Buffer.from("user:pass").toString("base64")}`;
    expect(config.otlpHeaders["Authorization"]).toBe(expected);
  });
});
