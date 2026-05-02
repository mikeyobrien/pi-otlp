import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createOtlpExporter, getOtelDiagnostics } from "./otlp-exporter.js";
import { OTLPMetricExporter as ProtoExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPMetricExporter as HttpExporter } from "@opentelemetry/exporter-metrics-otlp-http";

describe("createOtlpExporter", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns ProtoExporter by default", () => {
    delete process.env.OTEL_EXPORTER_OTLP_PROTOCOL;
    delete process.env.OTEL_EXPORTER_OTLP_METRICS_PROTOCOL;
    const exporter = createOtlpExporter();
    expect(exporter).toBeInstanceOf(ProtoExporter);
  });

  it("returns ProtoExporter for http/protobuf", () => {
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL = "http/protobuf";
    const exporter = createOtlpExporter();
    expect(exporter).toBeInstanceOf(ProtoExporter);
  });

  it("returns HttpExporter for http/json", () => {
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL = "http/json";
    const exporter = createOtlpExporter();
    expect(exporter).toBeInstanceOf(HttpExporter);
  });

  it("prefers OTEL_EXPORTER_OTLP_METRICS_PROTOCOL over general", () => {
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL = "http/protobuf";
    process.env.OTEL_EXPORTER_OTLP_METRICS_PROTOCOL = "http/json";
    const exporter = createOtlpExporter();
    expect(exporter).toBeInstanceOf(HttpExporter);
  });

  it("throws for grpc protocol", () => {
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL = "grpc";
    expect(() => createOtlpExporter()).toThrow("gRPC OTLP exporter not supported");
  });

  it("is case-insensitive", () => {
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL = "HTTP/JSON";
    const exporter = createOtlpExporter();
    expect(exporter).toBeInstanceOf(HttpExporter);
  });
});

describe("getOtelDiagnostics", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("shows defaults when no env vars set", () => {
    delete process.env.OTEL_EXPORTER_OTLP_PROTOCOL;
    delete process.env.OTEL_EXPORTER_OTLP_METRICS_PROTOCOL;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_HEADERS;

    const diag = getOtelDiagnostics();
    expect(diag).toContain("http/protobuf");
    expect(diag).toContain("from default");
    expect(diag).toContain("SDK default");
    expect(diag).toContain("Headers: none");
  });

  it("shows OTEL_EXPORTER_OTLP_PROTOCOL source", () => {
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL = "http/json";
    const diag = getOtelDiagnostics();
    expect(diag).toContain("from OTEL_EXPORTER_OTLP_PROTOCOL");
  });

  it("shows OTEL_EXPORTER_OTLP_METRICS_PROTOCOL source when set", () => {
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL = "http/protobuf";
    process.env.OTEL_EXPORTER_OTLP_METRICS_PROTOCOL = "http/json";
    const diag = getOtelDiagnostics();
    expect(diag).toContain("from OTEL_EXPORTER_OTLP_METRICS_PROTOCOL");
  });

  it("shows OTEL_EXPORTER_OTLP_ENDPOINT source", () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "https://collector.example.com/otlp";
    const diag = getOtelDiagnostics();
    expect(diag).toContain("https://collector.example.com/otlp");
    expect(diag).toContain("from OTEL_EXPORTER_OTLP_ENDPOINT");
  });

  it("shows OTEL_EXPORTER_OTLP_METRICS_ENDPOINT over general", () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "https://general.example.com";
    process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT = "https://metrics.example.com";
    const diag = getOtelDiagnostics();
    expect(diag).toContain("https://metrics.example.com");
    expect(diag).toContain("from OTEL_EXPORTER_OTLP_METRICS_ENDPOINT");
  });

  it("shows headers as set when OTEL_EXPORTER_OTLP_HEADERS is present", () => {
    process.env.OTEL_EXPORTER_OTLP_HEADERS = "Authorization=Basic abc123";
    const diag = getOtelDiagnostics();
    expect(diag).toContain("Headers: set (OTEL_EXPORTER_OTLP_HEADERS)");
  });
});
