# @pipeworx/foursquare

Foursquare Places API (2025 `places-api.foursquare.com`) MCP — keyless POI search with categories, address, contact, and rating-ordered results.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1865+ live data sources. This is an independent, unofficial integration — not affiliated with, endorsed by, or published by the upstream provider.

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

Both URLs reach the same gateway and the same 1865+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/search_places \
  -H 'Content-Type: application/json' \
  -d '{"query":"coffee","near":"San Francisco, CA","sort":"RATING","limit":10}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/search_places`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Run it from npm

`@pipeworx/mcp-foursquare` is a local stdio bridge to the Pipeworx gateway: your MCP client
starts it with `npx`, and it forwards every call to the same
`https://gateway.pipeworx.io/foursquare/mcp` endpoint shown above. It needs network access;
there is no offline mode.

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

Without a key it calls anonymously, capped at 50 calls a day. A free account
raises that to 200 a day: get a key at https://pipeworx.io/signup and add
`"env": { "PIPEWORX_API_KEY": "<your key>" }` to the server entry.
The key is sent as a Bearer token, the same way a hosted connection sends it,
so calls are metered and billed exactly as they are there.

It lists **only** this pack's tools by default. Set `PIPEWORX_META_TOOLS=1` to
also list `ask_pipeworx` and the other gateway-wide tools.

Behind an HTTPS proxy: Node's built-in `fetch` does not read `HTTPS_PROXY` by
default. Newer Node releases honour it when `NODE_USE_ENV_PROXY=1` is set; check
your Node version's documentation.

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
