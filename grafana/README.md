# Pi-OTLP Grafana Dashboard

Comprehensive observability dashboard for the pi-coding-agent OpenTelemetry extension.

## Quick Start

1. Import `pi-otlp-dashboard.json` into Grafana (Dashboards > Import)
2. Select your Prometheus data source
3. Ensure OTLP metrics are flowing to your Prometheus instance

## Requirements

- Grafana 10.0+
- Prometheus data source with OTLP metrics
- pi-otlp extension running with `OTEL_EXPORTER_OTLP_ENDPOINT` configured

## Dashboard Sections

### Overview Row
| Panel | Description |
|-------|-------------|
| Total Sessions | Count of coding sessions started |
| Total Turns | Agent turn count (tool-calling loops) |
| Total Tool Calls | Number of tool invocations |
| Total Tokens | Cumulative token usage |
| Total Cost | Cumulative USD cost |
| Tool Error Rate | Percentage of failed tool calls |

### Session & Turn Activity
- **Activity Rate**: Sessions/s, Turns/s, Prompts/s over time
- **Turns by Session**: Stacked bar chart of turns per session

### Token Usage
- **Token Usage Over Time**: Stacked area chart (input, output, cache_read, cache_write)
- **Token Distribution**: Pie chart breakdown
- **Cache Hit Ratio**: Gauge showing cache effectiveness

### Cost Analytics
- **Cost Over Time**: Stacked area chart by cost type
- **Cost Distribution**: Pie chart breakdown
- **Avg Cost per Turn**: Mean cost per agent turn
- **Avg Cost per Session**: Mean cost per session

### Tool Performance
- **Tool Calls by Type**: Bar chart of tool usage
- **Tool Results (Success/Failure)**: Success vs failure by tool
- **Tool Usage Distribution**: Pie chart of tool popularity
- **Tool Error Rates**: Table with error rate per tool
- **Tool Duration (p50)**: Horizontal bar gauge of median latencies

### Duration Histograms
- **Session Duration Percentiles**: p50, p95, p99 session lengths
- **Turn Duration Percentiles**: p50, p95, p99 turn times
- **Tool Duration Percentiles**: p50, p95, p99 tool execution times
- **Tool Duration by Type (p50/p95)**: Per-tool latency breakdown

## Metrics Reference

### Counters
| Metric | Labels | Description |
|--------|--------|-------------|
| `pi_session_count_total` | `session_id` | Sessions started |
| `pi_turn_count_total` | `session_id` | Agent turns |
| `pi_tool_call_count_total` | `session_id`, `tool_name` | Tool invocations |
| `pi_tool_result_count_total` | `session_id`, `tool_name`, `success` | Tool completions |
| `pi_prompt_count_total` | `session_id`, `prompt_length` | User prompts |
| `pi_token_usage_total` | `session_id`, `type` | Token usage |
| `pi_cost_usage_total` | `session_id`, `type` | Cost in USD |

### Histograms
| Metric | Labels | Description |
|--------|--------|-------------|
| `pi_session_duration` | `session_id` | Session duration (seconds) |
| `pi_turn_duration` | `session_id` | Turn duration (seconds) |
| `pi_tool_duration` | `session_id`, `tool_name`, `success` | Tool execution time (seconds) |

### Label Values
- `type` (tokens/cost): `input`, `output`, `cache_read`, `cache_write`
- `success` (tool results): `true`, `false`

## Variables

| Variable | Description |
|----------|-------------|
| `datasource` | Prometheus data source selector |
| `session_id` | Filter by session (multi-select) |
| `tool_name` | Filter by tool (multi-select) |

## OTLP Configuration

```bash
# Enable telemetry
export PI_OTLP_ENABLE=1

# Configure exporters (console, otlp, or both)
export OTEL_METRICS_EXPORTER=otlp

# OTLP endpoint (Prometheus remote write or OTLP collector)
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/metrics

# Optional: authentication
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer token"

# Export interval (ms)
export OTEL_METRIC_EXPORT_INTERVAL=10000
```

## Example Prometheus Config

If using OpenTelemetry Collector with Prometheus:

```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318

exporters:
  prometheus:
    endpoint: 0.0.0.0:9090

service:
  pipelines:
    metrics:
      receivers: [otlp]
      exporters: [prometheus]
```
