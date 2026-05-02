export interface OtlpConfig {
  enabled: boolean;
  debug: boolean;
  exporters: ("console" | "otlp")[];
  exportIntervalMs: number;
}

export function getConfig(): OtlpConfig {
  const enabled = process.env.PI_OTLP_ENABLE === "1";
  const debug = process.env.PI_OTLP_DEBUG === "1";

  const exporterStr = process.env.OTEL_METRICS_EXPORTER ?? "console";
  const exporters = exporterStr.split(",").map((e) => e.trim()) as ("console" | "otlp")[];

  const exportIntervalMs = parseInt(
    process.env.OTEL_METRIC_EXPORT_INTERVAL ?? "60000",
    10
  );

  return {
    enabled,
    debug,
    exporters,
    exportIntervalMs,
  };
}
