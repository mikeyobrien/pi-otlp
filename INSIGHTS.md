# Insights — 2026-02-12

## Traffic & Usage

**Pre-launch — no user data yet**

- **npm package:** Not published (`@mikeyobrien/pi-otlp` prepared but not in registry)
- **GitHub repo:** Not pushed to remote (no stars/forks/issues)
- **Downloads:** N/A

## Product State

**Phase 4 Complete — npm Publish Ready:**

| Category | Metrics | Status |
|----------|---------|--------|
| Counters | `pi.session.count`, `pi.turn.count`, `pi.tool_call.count`, `pi.tool_result.count`, `pi.prompt.count` | ✅ |
| Usage | `pi.token.usage`, `pi.cost.usage` | ✅ |
| Durations | `pi.session.duration`, `pi.turn.duration`, `pi.tool.duration` | ✅ |
| Package | README, .npmignore, correct org name | ✅ |

**Current Metrics (10 total):**
- `pi.session.count` — Session starts
- `pi.turn.count` — Agent turns (tool loops)
- `pi.tool_call.count` — Tool invocations (by tool name)
- `pi.tool_result.count` — Tool completions (success/failure)
- `pi.prompt.count` — User prompts (with length attribute)
- `pi.token.usage` — Token counts (type: input/output/cache_read/cache_write)
- `pi.cost.usage` — Cost in USD (type: input/output/cache_read/cache_write)
- `pi.session.duration` — Session duration histogram (seconds)
- `pi.turn.duration` — Turn duration histogram (seconds)
- `pi.tool.duration` — Tool execution duration histogram (seconds, by tool name)

**Package Details:**
- Name: `@mikeyobrien/pi-otlp`
- Version: `0.1.0`
- Size: 5.5 kB (6 files)
- Tests: 49/49 passing
- TypeScript: Clean (no errors)

## User Feedback

- **Open issues:** 0 (repo not public)
- **Common requests:** N/A (no users yet)
- **Market signals:** High demand for AI agent observability

## Errors & Issues

- **Build errors:** None (typecheck passes)
- **Test failures:** None (49/49 passing)
- **Known gaps:** None — core metrics complete, package ready

## Market Context

**Vibe Coding Observability Trend (2026):**

The market is validating our approach. According to VictoriaMetrics:
- "All major vibe coding tools now support OpenTelemetry" (Claude Code, OpenAI Codex, Gemini CLI, Qwen Code, OpenCode)
- VictoriaMetrics Stack + OpenTelemetry enables "powerful, cost-effective monitoring"
- "OpenTelemetry auto-instrumentation is an ideal solution for AI agents"

**OpenTelemetry GenAI Semantic Conventions (Stable):**
- `gen_ai.client.token.usage` — Histogram for input/output tokens (Recommended)
- `gen_ai.client.operation.duration` — Operation duration in seconds (Required) ✅ Aligned
- `gen_ai.server.time_per_output_token` — Decode phase performance
- `gen_ai.server.time_to_first_token` — Prefill phase latency

**Datadog LLM Observability** now natively supports OpenTelemetry GenAI Semantic Conventions (v1.37+) — validating the standard as production-ready.

**pi-coding-agent ecosystem:**
- Extensions enabled via TypeScript modules with hot reloading
- No telemetry extension exists yet — we are first-mover
- Package installation: `pi install npm:@mikeyobrien/pi-otlp`

## Signals for Next Round

- **User pain points:** None discovered (pre-launch)
- **Opportunities:** npm publish to enable installation; GitHub visibility for community feedback
- **Technical debt:** None
- **Growth levers:** VictoriaMetrics + OTel stack compatibility, first-mover advantage

## Recommended Next Moves

1. **npm publish:** Execute `npm publish --access public` to release 0.1.0 — this is the BLOCKER preventing user adoption
2. **GitHub push:** Make repo public for discoverability and community contributions
3. **VictoriaMetrics integration guide:** The market is moving toward VictoriaMetrics + OTel for vibe coding observability
4. **Grafana dashboard:** Create example dashboard template for pi metrics

**Data-driven reasoning:**
- Core metrics complete (10 metrics covering counts, usage, and durations) — nothing more to build for MVP
- Package is ready (6 files, 5.5 kB, 49 tests passing)
- Market validation: VictoriaMetrics blog confirms "all major vibe coding tools now support OpenTelemetry"
- First-mover advantage is READY to capitalize — users literally cannot install until we publish
- The only remaining step is `npm publish --access public`

## Sources

- [OpenTelemetry](https://opentelemetry.io/)
- [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [OpenTelemetry GenAI Metrics](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/)
- [Datadog LLM Observability supports OTel GenAI](https://www.datadoghq.com/blog/llm-otel-semantic-convention/)
- [pi-coding-agent on npm](https://www.npmjs.com/package/@mariozechner/pi-coding-agent)
- [pi-coding-agent extensions docs](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md)
- [VictoriaMetrics Vibe Coding Observability](https://victoriametrics.com/blog/vibe-coding-observability/)
- [VictoriaMetrics AI Agents Observability](https://victoriametrics.com/blog/ai-agents-observability/)
- [VictoriaMetrics OpenTelemetry Metrics Backend](https://oneuptime.com/blog/post/2026-02-06-victoriametrics-opentelemetry-metrics-backend/view)
