export interface OtlpConfig {
  enabled: boolean;
  debug: boolean;
  exporters: ("console" | "otlp")[];
  otlpEndpoint: string;
  otlpHeaders: Record<string, string>;
  exportIntervalMs: number;
}

export function getConfig(): OtlpConfig {
  const enabled = process.env.PI_OTLP_ENABLE === "1";
  const debug = process.env.PI_OTLP_DEBUG === "1";

  const exporterStr = process.env.OTEL_METRICS_EXPORTER ?? "console";
  const exporters = exporterStr.split(",").map((e) => e.trim()) as ("console" | "otlp")[];

  const otlpEndpoint =
    process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
    "http://localhost:4318/v1/metrics";

  const otlpHeaders = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS ?? "");

  const exportIntervalMs = parseInt(
    process.env.OTEL_METRIC_EXPORT_INTERVAL ?? "60000",
    10
  );

  return {
    enabled,
    debug,
    exporters,
    otlpEndpoint,
    otlpHeaders,
    exportIntervalMs,
  };
}

function parseHeaders(headerStr: string): Record<string, string> {
  if (!headerStr) return {};

  const headers: Record<string, string> = {};
  const pairs = headerStr.split(",");

  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split("=");
    if (key && valueParts.length > 0) {
      headers[key.trim()] = valueParts.join("=").trim();
    }
  }

  return headers;
}
