# pi-otlp

OpenTelemetry metrics extension for [pi-coding-agent](https://github.com/badlogic/pi-mono).

## Installation

```bash
pi install npm:@mobrienv/pi-otlp
```

Or add to `~/.pi/agent/settings.json`:

```json
{
  "extensions": ["~/path/to/pi-otlp"]
}
```

## Configuration

Enable via environment variables:

```bash
# Required: enable the extension
export PI_OTLP_ENABLE=1

# Choose exporters (console, otlp, or both)
export OTEL_METRICS_EXPORTER=console

# For OTLP export
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/metrics

# Optional: export interval (default: 60000ms)
export OTEL_METRIC_EXPORT_INTERVAL=10000

# Optional: debug logging
export PI_OTLP_DEBUG=1
```

## Metrics

| Metric | Description |
|--------|-------------|
| `pi.session.count` | Sessions started |
| `pi.turn.count` | Agent turns (tool-calling loops) |
| `pi.tool_call.count` | Tool invocations |
| `pi.tool_result.count` | Tool completions |
| `pi.prompt.count` | User prompts |

## Commands

- `/otlp-status` — Show telemetry status

## License

MIT
