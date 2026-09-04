# MCP Orchestrator v1

DataFit exposes its existing deterministic workflow through the official MCP
TypeScript SDK v2 and local stdio transport.

```text
Web UI ──┐
         ├── DataFit core → intent → evidence → resolution → validation → result
MCP ─────┘
```

The MCP layer registers product-level tools; it does not classify datasets,
invent relationships, or generate conclusions independently. The web UI and
MCP import the same intent, evidence, trusted-resolution, compatibility,
execution, representation, and renderer functions.

## Run

Requires Node.js 20 or newer.

```bash
npm install
npm run mcp
```

The default mode uses the frozen Basel catalogue snapshot and makes no network
requests. Inspection reaches schema evidence; spatial execution is unavailable.
To use the live Basel catalogue and bounded GeoJSON execution:

```bash
DATAFIT_LIVE=1 npm run mcp
```

No API key is required. Logs use stderr because stdout is reserved for MCP
JSON-RPC.

Provider-neutral host configuration:

```json
{
  "mcpServers": {
    "datafit": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/absolute/path/to/opendata-explorer",
      "env": {
        "DATAFIT_LIVE": "1"
      }
    }
  }
}
```

Omit `env` for deterministic offline catalogue use.

## Tools

| Tool | Purpose | Important boundary |
| --- | --- | --- |
| `search_datasets` | Rank Basel datasets for a question | Local catalogue only; no web search or compatibility claim |
| `build_evidence_plan` | Parse intent and assign analytical roles | Roles are DataFit system inference |
| `resolve_missing_evidence` | Fill missing/weak roles from the trusted registry | Candidate state is not compatibility |
| `inspect_dataset` | Read schema and optionally bounded samples | Returns the actual observation level |
| `assess_compatibility` | Propose a structural relationship | Not execution validation |
| `validate_relationship` | Execute a justified spatial operation | `failed` is distinct from `rejected` |
| `suggest_representation` | Return `RepresentationSpec` values | Does not render or invent values |
| `build_result` | Return the web product's serializable result model | Blocked/unsupported states remain explicit |

Tool responses include `structuredContent` plus a readable JSON text block.
Stable identifiers (`planId`, dataset IDs, assessment IDs, operation IDs,
execution IDs, representation IDs) support multi-step host orchestration.

## State and provenance

Intent parsing, evidence planning, trusted resolution, and representation
recommendation are deterministic and recomputable. Inspections, assessments,
and execution results are held in memory for the lifetime of one server
process. There are no persistent projects or history in v1.

Structured outputs retain publisher links, observation/evidence levels,
DataFit inference origin, trusted candidate scope/status, execution snapshots,
and retrieval timestamps where they exist.

No MCP resources are registered in v1. Tools already return stable IDs and the
core demo does not benefit from a second retrieval surface. Resources can be
added later if cross-session or externally addressable state becomes real.

## Deterministic demo

```bash
npm run mcp:demo
```

The demo requires no LLM and no internet. It runs two flows:

1. Running route: resolves MeteoSwiss/swisstopo candidates, refuses fake route
   comparison, and returns an evidence-brief fallback.
2. Fountains and Tempo-30: inspects two frozen schemas, assesses containment,
   executes it over deterministic GeoJSON, and returns a confirmed renderable
   relationship-map result.

## Limitations

- stdio only; no hosted HTTP transport;
- default server execution disabled because the offline catalogue contains no geometry;
- live mode depends on availability of `data.bs.ch`;
- in-memory state disappears when the host stops the process;
- no routing engine, LLM, arbitrary web search, federation, auth, or persistence.
