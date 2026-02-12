# Product Vision

**pi-otlp** is a pi extension that exports OpenTelemetry Protocol (OTLP) metrics and events, enabling observability for pi coding sessions similar to Claude Code's telemetry.

## Architecture Tiers

### Tier 1: Core Pillars
| Pillar | Purpose | Existing |
|--------|---------|----------|
| Metrics Collector | Collect session, token, tool usage metrics | — |
| Event Emitter | Emit structured events (tool calls, prompts, errors) | — |
| OTLP Exporter | Export via gRPC/HTTP to OTLP backends | — |

### Tier 2: Surface
| Surface | Purpose | Existing |
|---------|---------|----------|
| pi Extension | Extension entry point, lifecycle hooks | — |
| CLI Flags | --otlp-endpoint, --otlp-protocol configuration | — |
| Status Widget | Show export status in TUI | — |

### Tier 3: Ecosystem
| Type | Examples |
|------|----------|
| Demos | Example Grafana dashboards, collector configs |
| Docs | Setup guide, metric reference |

### Tier 4: Business
| Category | Purpose |
|----------|---------|
| Market | Competitor analysis, positioning |
| Presence | README, npm package page |
| Acquisition | npm install, pi install |
| Revenue | N/A (open source) |

## Cohesion Rules
- Tier 1: Must extend or connect pillars
- Tier 2: Must consume 2+ core modules
- Tier 3: Must demonstrate/document Tier 1/2
- Tier 4: Must have Surface first, reference MARKET.md
- Dogfooding: Use pi-otlp to monitor pi-otlp development

## Fit Test
1. Which tier?
2. Which category?
3. Connects to?
4. One-sentence relationship to users/customers
