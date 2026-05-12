interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Foursquare Places MCP (v3 Places API)
 *
 * POI lookup with rich tags and popularity. Stronger free tier than Google
 * Places (100k req/mo on the Standard plan). Pairs with `overpass` (OSM
 * coverage is broader but less canonical) and `geo` / `nominatim`.
 *
 * API: https://docs.foursquare.com/developer/reference/place-search
 * Auth: header `Authorization: <api_key>` (no Bearer prefix — Foursquare uses
 * a raw key with the Authorization header).
 *
 * Tools:
 * - search_places:  text/category search with location bias
 * - get_place:      full details by fsq_id
 * - nearby_places:  POIs near a lat/lon without a query
 */


const BASE_URL = 'https://api.foursquare.com/v3/places';

const tools: McpToolExport['tools'] = [
  {
    name: 'search_places',
    description:
      'Search Foursquare places. Combine `query` (free text like "coffee", "italian food", "hardware store") with a location anchor — either `near` (e.g., "Brooklyn, NY"), or `latitude`+`longitude`, or `bbox`. Returns place name, fsq_id, categories, address, distance, lat/lon, and popularity.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text query (e.g., "coffee shop", "hardware store")' },
        near: { type: 'string', description: 'Place name to anchor the search ("Brooklyn, NY", "Tokyo")' },
        latitude: { type: 'number', description: 'Center latitude (pair with longitude)' },
        longitude: { type: 'number', description: 'Center longitude' },
        radius_m: { type: 'number', description: '1-100000 metres (only with lat/lon)' },
        categories: { type: 'string', description: 'Comma-separated Foursquare category IDs' },
        sort: {
          type: 'string',
          description: 'RELEVANCE (default) | DISTANCE | POPULARITY | RATING',
          enum: ['RELEVANCE', 'DISTANCE', 'POPULARITY', 'RATING'],
        },
        limit: { type: 'number', description: 'Results (1-50, default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'get_place',
    description:
      'Get full details for a Foursquare place by fsq_id. Returns name, categories, address, geocodes, social media, website, hours, rating, price, popularity, tips counts.',
    inputSchema: {
      type: 'object',
      properties: {
        fsq_id: { type: 'string', description: 'Foursquare place ID (returned by search_places)' },
      },
      required: ['fsq_id'],
    },
  },
  {
    name: 'nearby_places',
    description:
      'POIs near a lat/lon without a search term — useful for "what\'s around me?" agents. Optionally filter by Foursquare category.',
    inputSchema: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: 'Latitude' },
        longitude: { type: 'number', description: 'Longitude' },
        radius_m: { type: 'number', description: '1-100000 metres (default 500)' },
        categories: { type: 'string', description: 'Comma-separated Foursquare category IDs' },
        limit: { type: 'number', description: 'Results (1-50, default 20)' },
      },
      required: ['latitude', 'longitude'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = (args._apiKey as string | undefined)?.trim();
  if (!apiKey) {
    throw new Error(
      'Foursquare requires an API key. Contact the operator about platform credentials, or BYO via ?_apiKey=<key> after registering at https://foursquare.com/developers/.',
    );
  }
  switch (name) {
    case 'search_places':
      return searchPlaces(apiKey, args);
    case 'get_place':
      return getPlace(apiKey, reqStr(args, 'fsq_id', '"4d4b7105d754a06372d81259"'));
    case 'nearby_places':
      return nearbyPlaces(apiKey, args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function reqStr(args: Record<string, unknown>, key: string, example: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`Required argument "${key}" is missing or empty. Pass a string like ${example}.`);
  }
  return v;
}

async function fsqFetch<T>(apiKey: string, path: string, params?: URLSearchParams): Promise<T> {
  const url = `${BASE_URL}${path}${params ? `?${params}` : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: apiKey, Accept: 'application/json' },
  });
  if (res.status === 401 || res.status === 403) throw new Error('Foursquare: unauthorized — check the API key');
  if (res.status === 404) throw new Error('Foursquare: not found (HTTP 404)');
  if (res.status === 429) throw new Error('Foursquare: rate-limit (HTTP 429)');
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Foursquare error: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

interface FsqCategory {
  id?: number;
  name?: string;
  short_name?: string;
  plural_name?: string;
}

interface FsqPlace {
  fsq_id?: string;
  name?: string;
  categories?: FsqCategory[];
  chains?: { id?: string; name?: string }[];
  closed_bucket?: string;
  distance?: number;
  geocodes?: { main?: { latitude?: number; longitude?: number } };
  location?: {
    address?: string;
    locality?: string;
    region?: string;
    country?: string;
    postcode?: string;
    formatted_address?: string;
    neighborhood?: string[];
  };
  link?: string;
  related_places?: unknown;
  timezone?: string;
  popularity?: number;
  rating?: number;
  price?: number;
  hours?: { display?: string; open_now?: boolean };
  website?: string;
  tel?: string;
  email?: string;
  social_media?: Record<string, string>;
  tips?: { count?: number };
  description?: string;
}

function normalizePlace(p: FsqPlace) {
  return {
    fsq_id: p.fsq_id ?? null,
    name: p.name ?? null,
    categories: (p.categories ?? []).map((c) => c.name).filter(Boolean),
    category_ids: (p.categories ?? []).map((c) => c.id).filter((x): x is number => x != null),
    address: p.location?.formatted_address ?? p.location?.address ?? null,
    locality: p.location?.locality ?? null,
    region: p.location?.region ?? null,
    country: p.location?.country ?? null,
    postcode: p.location?.postcode ?? null,
    latitude: p.geocodes?.main?.latitude ?? null,
    longitude: p.geocodes?.main?.longitude ?? null,
    distance_m: p.distance ?? null,
    popularity: p.popularity ?? null,
    rating: p.rating ?? null,
    price: p.price ?? null,
    website: p.website ?? null,
    tel: p.tel ?? null,
    hours: p.hours?.display ?? null,
    open_now: p.hours?.open_now ?? null,
    chain: p.chains?.[0]?.name ?? null,
    timezone: p.timezone ?? null,
    description: p.description ?? null,
    foursquare_url: p.link ? `https://foursquare.com${p.link}` : null,
  };
}

async function searchPlaces(apiKey: string, args: Record<string, unknown>) {
  const params = new URLSearchParams();
  if (args.query) params.set('query', String(args.query));
  if (args.near) params.set('near', String(args.near));
  if (typeof args.latitude === 'number' && typeof args.longitude === 'number') {
    params.set('ll', `${args.latitude},${args.longitude}`);
  }
  if (args.radius_m) params.set('radius', String(Math.min(100000, Math.max(1, args.radius_m as number))));
  if (args.categories) params.set('categories', String(args.categories));
  if (args.sort) params.set('sort', String(args.sort));
  params.set('limit', String(Math.min(50, Math.max(1, (args.limit as number) ?? 10))));

  const data = await fsqFetch<{ results?: FsqPlace[] }>(apiKey, '/search', params);
  return {
    count: data.results?.length ?? 0,
    results: (data.results ?? []).map(normalizePlace),
  };
}

async function getPlace(apiKey: string, fsqId: string) {
  const params = new URLSearchParams({
    fields:
      'fsq_id,name,categories,chains,distance,geocodes,location,link,timezone,popularity,rating,price,hours,website,tel,email,social_media,tips,description',
  });
  const data = await fsqFetch<FsqPlace>(apiKey, `/${encodeURIComponent(fsqId)}`, params);
  return normalizePlace(data);
}

async function nearbyPlaces(apiKey: string, args: Record<string, unknown>) {
  const params = new URLSearchParams({
    ll: `${args.latitude},${args.longitude}`,
    radius: String(Math.min(100000, Math.max(1, (args.radius_m as number) ?? 500))),
    limit: String(Math.min(50, Math.max(1, (args.limit as number) ?? 20))),
  });
  if (args.categories) params.set('categories', String(args.categories));

  const data = await fsqFetch<{ results?: FsqPlace[] }>(apiKey, '/nearby', params);
  return {
    center: { latitude: args.latitude, longitude: args.longitude },
    count: data.results?.length ?? 0,
    results: (data.results ?? []).map(normalizePlace),
  };
}

export default { tools, callTool, meter: { credits: 2 } } satisfies McpToolExport;
