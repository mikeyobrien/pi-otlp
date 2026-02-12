/**
 * Verification tests for the extension entry point
 * Tests the extension initialization and event subscriptions
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock OpenTelemetry before importing the module
vi.mock("@opentelemetry/api", () => ({
  metrics: {
    setGlobalMeterProvider: vi.fn(),
  },
  diag: {
    setLogger: vi.fn(),
  },
  DiagConsoleLogger: vi.fn(),
  DiagLogLevel: { DEBUG: 1 },
}));

vi.mock("@opentelemetry/sdk-metrics", () => {
  return {
    MeterProvider: class MockMeterProvider {
      getMeter() {
        return {
          createCounter: () => ({ add: vi.fn() }),
          createHistogram: () => ({ record: vi.fn() }),
        };
      }
      shutdown() {
        return Promise.resolve();
      }
    },
    PeriodicExportingMetricReader: class MockReader {
      constructor() {}
    },
    ConsoleMetricExporter: class MockConsoleExporter {
      constructor() {}
    },
  };
});

vi.mock("@opentelemetry/exporter-metrics-otlp-http", () => ({
  OTLPMetricExporter: class MockOTLPExporter {
    constructor() {}
  },
}));

vi.mock("@opentelemetry/resources", () => ({
  Resource: class MockResource {
    constructor() {}
  },
}));

vi.mock("@opentelemetry/semantic-conventions", () => ({
  ATTR_SERVICE_NAME: "service.name",
  ATTR_SERVICE_VERSION: "service.version",
}));

interface MockExtensionAPI {
  handlers: Map<string, (event: unknown, ctx: unknown) => Promise<void>>;
  commands: Map<string, { description: string; handler: (args: string, ctx: unknown) => Promise<void> }>;
  on: (event: string, handler: (event: unknown, ctx: unknown) => Promise<void>) => void;
  registerCommand: (name: string, opts: { description: string; handler: (args: string, ctx: unknown) => Promise<void> }) => void;
}

function createMockExtensionAPI(): MockExtensionAPI {
  const handlers = new Map<string, (event: unknown, ctx: unknown) => Promise<void>>();
  const commands = new Map<string, { description: string; handler: (args: string, ctx: unknown) => Promise<void> }>();

  return {
    handlers,
    commands,
    on(event, handler) {
      handlers.set(event, handler);
    },
    registerCommand(name, opts) {
      commands.set(name, opts);
    },
  };
}

describe("Extension", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("does nothing when PI_OTLP_ENABLE is not set", async () => {
    delete process.env.PI_OTLP_ENABLE;
    const { default: extension } = await import("../../src/index.js");
    const api = createMockExtensionAPI();

    extension(api as unknown as Parameters<typeof extension>[0]);

    expect(api.handlers.size).toBe(0);
    expect(api.commands.size).toBe(0);
  });

  it("registers event handlers when enabled", async () => {
    process.env.PI_OTLP_ENABLE = "1";
    process.env.OTEL_METRICS_EXPORTER = "console";

    const { default: extension } = await import("../../src/index.js");
    const api = createMockExtensionAPI();

    extension(api as unknown as Parameters<typeof extension>[0]);

    expect(api.handlers.has("session_start")).toBe(true);
    expect(api.handlers.has("session_shutdown")).toBe(true);
    expect(api.handlers.has("turn_start")).toBe(true);
    expect(api.handlers.has("turn_end")).toBe(true);
    expect(api.handlers.has("tool_call")).toBe(true);
    expect(api.handlers.has("tool_result")).toBe(true);
    expect(api.handlers.has("input")).toBe(true);
  });

  it("registers the otlp-status command", async () => {
    process.env.PI_OTLP_ENABLE = "1";
    process.env.OTEL_METRICS_EXPORTER = "console";

    const { default: extension } = await import("../../src/index.js");
    const api = createMockExtensionAPI();

    extension(api as unknown as Parameters<typeof extension>[0]);

    expect(api.commands.has("otlp-status")).toBe(true);
    expect(api.commands.get("otlp-status")?.description).toBe("Show OTLP telemetry status");
  });
});
