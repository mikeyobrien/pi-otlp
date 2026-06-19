export interface OtlpConfig {
  enabled: boolean;
  debug: boolean;
  exporters: ("console" | "otlp")[];
  otlpEndpoint: string;
  otlpHeaders: Record<string, string>;
  exportIntervalMs: number;
  user?: string;
}

export function getConfig(): OtlpConfig {
  const enabled = process.env.PI_OTLP_ENABLE === "1";
  const debug = process.env.PI_OTLP_DEBUG === "1";

  const exporterStr = process.env.OTEL_METRICS_EXPORTER ?? "console";
  const exporters = exporterStr.split(",").map((e) => e.trim()) as ("console" | "otlp")[];

  // OTEL_EXPORTER_OTLP_METRICS_ENDPOINT is the full URL (per OTel spec)
  // OTEL_EXPORTER_OTLP_ENDPOINT is the base URL — we append /v1/metrics
  let otlpEndpoint: string;
  if (process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT) {
    otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
  } else if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/+$/, "");
    otlpEndpoint = base.endsWith("/v1/metrics") ? base : `${base}/v1/metrics`;
  } else {
    otlpEndpoint = "http://localhost:4318/v1/metrics";
  }

  const otlpHeaders = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS ?? "");

  const basicAuthUser = process.env.PI_OTLP_BASIC_AUTH_USER;
  const basicAuthPassword = process.env.PI_OTLP_BASIC_AUTH_PASSWORD;
  if (basicAuthUser && basicAuthPassword) {
    const encoded = Buffer.from(`${basicAuthUser}:${basicAuthPassword}`).toString("base64");
    otlpHeaders["Authorization"] = `Basic ${encoded}`;
  }

  const exportIntervalMs = parseInt(
    process.env.OTEL_METRIC_EXPORT_INTERVAL ?? "60000",
    10
  );

  const user = process.env.PI_OTLP_USER_LABEL || undefined;

  return {
    enabled,
    debug,
    exporters,
    otlpEndpoint,
    otlpHeaders,
    exportIntervalMs,
    user,
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
