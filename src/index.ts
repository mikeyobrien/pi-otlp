import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { metrics, DiagConsoleLogger, DiagLogLevel, diag } from "@opentelemetry/api";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
} from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { Resource } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { createTelemetryCollector, type TelemetryCollector } from "./telemetry.js";
import { getConfig } from "./config.js";

const SERVICE_NAME = "pi-coding-agent";
const VERSION = "0.1.0";

let collector: TelemetryCollector | null = null;
let meterProvider: MeterProvider | null = null;
let currentProvider: string = "unknown";
let currentModel: string = "unknown";

export default function (pi: ExtensionAPI) {
  const config = getConfig();

  if (!config.enabled) {
    return;
  }

  if (config.debug) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: VERSION,
    "os.type": process.platform,
    "host.arch": process.arch,
  });

  const readers = [];

  if (config.exporters.includes("console")) {
    readers.push(
      new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
        exportIntervalMillis: config.exportIntervalMs,
      })
    );
  }

  if (config.exporters.includes("otlp")) {
    const otlpExporter = new OTLPMetricExporter({
      url: config.otlpEndpoint,
      headers: config.otlpHeaders,
    });
    readers.push(
      new PeriodicExportingMetricReader({
        exporter: otlpExporter,
        exportIntervalMillis: config.exportIntervalMs,
      })
    );
  }

  if (readers.length === 0) {
    return;
  }

  meterProvider = new MeterProvider({
    resource,
    readers,
  });

  metrics.setGlobalMeterProvider(meterProvider);

  const meter = meterProvider.getMeter("com.pi.otlp");
  collector = createTelemetryCollector(meter);

  // Session lifecycle events
  pi.on("session_start", async (_event, ctx) => {
    // Capture initial provider/model
    const model = ctx.model;
    if (model) {
      currentProvider = model.provider as string;
      currentModel = model.id;
    }
    collector?.recordSessionStart({
      sessionId: ctx.sessionManager?.getSessionId() ?? "unknown",
      provider: currentProvider,
      model: currentModel,
    });
  });

  pi.on("session_shutdown", async () => {
    collector?.recordSessionEnd();
    await shutdown();
  });

  // Turn events for tracking agent activity
  pi.on("turn_start", async () => {
    collector?.recordTurnStart();
  });

  pi.on("turn_end", async (event) => {
    collector?.recordTurnEnd();

    if (event.message && "role" in event.message && event.message.role === "assistant") {
      const assistantMsg = event.message as { usage?: { input: number; output: number; cacheRead: number; cacheWrite: number; totalTokens: number; cost: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number } } };
      if (assistantMsg.usage) {
        collector?.recordUsage(assistantMsg.usage);
      }
    }
  });

  // Tool events
  pi.on("tool_call", async (event) => {
    collector?.recordToolCall({
      toolName: event.toolName,
    });
  });

  pi.on("tool_result", async (event) => {
    collector?.recordToolResult({
      toolName: event.toolName,
      success: !event.isError,
    });
  });

  // User input event
  pi.on("input", async (event, ctx) => {
    if (event.text) {
      collector?.recordUserPrompt({
        promptLength: event.text.length,
      });
    }
    // Update provider/model from current model context
    const model = ctx.model;
    if (model) {
      const provider = model.provider as string;
      const modelId = model.id;
      if (provider !== currentProvider || modelId !== currentModel) {
        currentProvider = provider;
        currentModel = modelId;
        collector?.setProviderModel(provider, modelId);
      }
    }
  });

  // Register /otlp-status command
  pi.registerCommand("otlp-status", {
    description: "Show OTLP telemetry status",
    async handler(_args, ctx) {
      const defaultStatus = {
        sessions: 0,
        turns: 0,
        tools: 0,
        prompts: 0,
        tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        durations: {
          session: { count: 0, totalMs: 0, lastMs: 0 },
          turn: { count: 0, totalMs: 0, lastMs: 0 },
          tool: { count: 0, totalMs: 0, lastMs: 0 },
        },
      };
      const status = collector?.getStatus() ?? defaultStatus;
      const formatCost = (c: number) => `$${c.toFixed(4)}`;
      const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
      };
      const avgMs = (stats: { count: number; totalMs: number }) =>
        stats.count > 0 ? Math.round(stats.totalMs / stats.count) : 0;
      await ctx.ui.notify(
        `OTLP Telemetry Status:\n` +
          `  Sessions: ${status.sessions}\n` +
          `  Turns: ${status.turns}\n` +
          `  Tool calls: ${status.tools}\n` +
          `  Prompts: ${status.prompts}\n` +
          `  Tokens: ${status.tokens.total} (in: ${status.tokens.input}, out: ${status.tokens.output}, cache: ${status.tokens.cacheRead}/${status.tokens.cacheWrite})\n` +
          `  Cost: ${formatCost(status.cost.total)} (in: ${formatCost(status.cost.input)}, out: ${formatCost(status.cost.output)})\n` +
          `  Durations:\n` +
          `    Session: ${formatDuration(status.durations.session.lastMs)} last, ${formatDuration(avgMs(status.durations.session))} avg\n` +
          `    Turn: ${formatDuration(status.durations.turn.lastMs)} last, ${formatDuration(avgMs(status.durations.turn))} avg\n` +
          `    Tool: ${formatDuration(status.durations.tool.lastMs)} last, ${formatDuration(avgMs(status.durations.tool))} avg\n` +
          `  Exporters: ${config.exporters.join(", ")}\n` +
          `  Endpoint: ${config.otlpEndpoint}`
      );
    },
  });
}

async function shutdown(): Promise<void> {
  if (meterProvider) {
    await meterProvider.shutdown();
    meterProvider = null;
    collector = null;
  }
}
