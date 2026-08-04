# @pipeworx/foursquare

Foursquare Places API v3 MCP — POI lookup with categories and popularity.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

- `search_places(query?, near?, latitude?, longitude?, radius_m?, categories?, sort?, limit?)`
- `get_place(fsq_id)`
- `nearby_places(latitude, longitude, radius_m?, categories?, limit?)`

## Auth

- **Platform key:** gateway env `PLATFORM_FOURSQUARE_KEY`.
- **BYO:** `?_apiKey=<key>` after registering at https://foursquare.com/developers/.

Foursquare's "Standard" plan is 100k req/mo free.

## Data source

`https://api.foursquare.com/v3/places` — header `Authorization: <api_key>` (no Bearer prefix).

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Foursquare data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
