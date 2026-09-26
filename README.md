# @pipeworx/foursquare

Foursquare Places API (2025 `places-api.foursquare.com`) MCP — keyless POI search with categories, address, contact, and rating-ordered results.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1683+ live data sources.

## Tools

- `search_places(query?, near?, latitude?, longitude?, radius_m?, categories?, sort?, limit?)`
- `get_place(fsq_id)`
- `nearby_places(latitude, longitude, radius_m?, categories?, limit?)`

## Auth

- **Platform key:** gateway env `PLATFORM_FOURSQUARE_KEY`.
- **BYO:** `?_apiKey=<key>` after registering at https://foursquare.com/developers/.

Foursquare's free allowance is 10,000 **Pro** calls/month.

## Ratings are a Premium field (read this before promising a rating)

Foursquare's 2025 API splits response fields into **Pro** (returned by default:
name, categories, address, lat/lon, distance, tel, website, social) and
**Premium** (`rating`, `price`, `popularity`, `hours`, `description`, tips,
photos). Premium fields only come back when named in `fields`, and any call that
names one bills at the Premium rate — **$18.75 per 1,000 calls, no free tier**
(foursquare.com/pricing, checked 2026-09-19).

Until that spend is approved for public traffic (fleet #2271), the pack requests
Premium fields **only for internal callers** (the gateway injects
`_internalCaller`). Every response carries `rating_included`, a `rating_reason`
(`included` / `not_requested` / `refused_by_vendor`) and, when the rating is
absent, a `rating_note` — so a null rating reads as *not requested* or *withheld
by the vendor*, never as *unrated*. `sort:"RATING"` is honoured by Foursquare
either way, so the ORDER is by rating even when the number is withheld. To enable
ratings for everyone flip `PREMIUM_FIELDS_PUBLIC` in `src/index.ts`.

**`refused_by_vendor` is the state you will see until Premium billing is enabled
on the platform account.** Measured 2026-09-19: naming a Premium field on the
unbilled platform key made Foursquare answer HTTP 429 on every call, so a
Premium request the vendor refuses (429/402/403) is re-run once Pro-only and
labelled, rather than failing the call or pretending the null was unrequested.
Once billing is on, the first request succeeds and the retry never happens.

## Data source

`https://places-api.foursquare.com/places` — headers `Authorization: Bearer <api_key>` and `X-Places-Api-Version: 2025-06-17`.

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "foursquare": {
      "url": "https://gateway.pipeworx.io/foursquare/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/foursquare/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1683+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/search_places \
  -H 'Content-Type: application/json' \
  -d '{"query":"coffee","near":"San Francisco, CA","sort":"RATING","limit":10}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/search_places`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Standalone (no gateway account)

This package also runs as a local stdio MCP server — no Pipeworx account, no
gateway round-trip:

```json
{
  "mcpServers": {
    "foursquare": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-foursquare"]
    }
  }
}
```

Or run it directly to confirm it starts:

```bash
npx -y @pipeworx/mcp-foursquare
```

It speaks MCP over stdin/stdout and answers `initialize`/`tools/list`/`tools/call`
for **only** this pack's tools — none of the shared meta-tools the gateway
connection above adds. Same source, same tools, no ask_pipeworx routing.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Foursquare data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
