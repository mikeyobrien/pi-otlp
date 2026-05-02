import { OTLPMetricExporter as ProtoExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPMetricExporter as HttpExporter } from "@opentelemetry/exporter-metrics-otlp-http";

export function createOtlpExporter() {
  const protocol = (
    process.env.OTEL_EXPORTER_OTLP_METRICS_PROTOCOL ??
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL ??
    "http/protobuf"
  ).toLowerCase();

  switch (protocol) {
    case "http/json":
      return new HttpExporter();
    case "grpc":
      throw new Error("gRPC OTLP exporter not supported");
    case "http/protobuf":
    default:
      return new ProtoExporter();
  }
}

export function getOtelDiagnostics(): string {
  const lines: string[] = [];

  const protocol = process.env.OTEL_EXPORTER_OTLP_METRICS_PROTOCOL ?? process.env.OTEL_EXPORTER_OTLP_PROTOCOL;
  const protocolSource = process.env.OTEL_EXPORTER_OTLP_METRICS_PROTOCOL
    ? "OTEL_EXPORTER_OTLP_METRICS_PROTOCOL"
    : process.env.OTEL_EXPORTER_OTLP_PROTOCOL
    ? "OTEL_EXPORTER_OTLP_PROTOCOL"
    : "default";
  lines.push(`  Protocol: ${protocol ?? "http/protobuf"} (from ${protocolSource})`);

  const endpoint = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const endpointSource = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
    ? "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT"
    : process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? "OTEL_EXPORTER_OTLP_ENDPOINT"
    : "SDK default (http://localhost:4318)";
  lines.push(`  Endpoint: ${endpoint ?? "SDK default"} (from ${endpointSource})`);

  const hasHeaders = !!process.env.OTEL_EXPORTER_OTLP_HEADERS;
  lines.push(`  Headers: ${hasHeaders ? "set (OTEL_EXPORTER_OTLP_HEADERS)" : "none"}`);

  return lines.join("\n");
}
