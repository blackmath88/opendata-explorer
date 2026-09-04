export interface StacAsset { href: string; type?: string; created?: string; updated?: string; }
export interface StacItem {
  id: string;
  bbox?: number[];
  geometry?: { type: string; coordinates: unknown };
  properties: { title?: string; datetime?: string; created?: string; updated?: string };
  assets: Record<string, StacAsset>;
}
export interface StacCollection {
  id: string; title: string; description: string; license?: string; updated?: string;
  extent?: { spatial?: { bbox?: number[][] }; temporal?: { interval?: Array<Array<string | null>> } };
}

type Fetch = typeof fetch;

/** Read-only client for the official Federal Spatial Data Infrastructure STAC API. */
export class FederalStacClient {
  constructor(private readonly fetcher: Fetch = fetch) {}

  async collection(endpoint: string): Promise<StacCollection> {
    return this.json<StacCollection>(endpoint);
  }

  async items(endpoint: string, options: { bbox?: [number, number, number, number]; limit?: number } = {}): Promise<StacItem[]> {
    const url = new URL(`${endpoint.replace(/\/$/, '')}/items`);
    if (options.bbox) url.searchParams.set('bbox', options.bbox.join(','));
    url.searchParams.set('limit', String(options.limit ?? 20));
    const response = await this.json<{ features: StacItem[] }>(url.toString());
    return response.features;
  }

  async text(url: string): Promise<string> {
    const response = await this.fetcher(url, { headers: { Accept: 'text/csv,text/plain' } });
    if (!response.ok) throw new Error(`Federal data request failed (${response.status}) for ${url}`);
    return response.text();
  }

  private async json<T>(url: string): Promise<T> {
    const response = await this.fetcher(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Federal STAC request failed (${response.status}) for ${url}`);
    return response.json() as Promise<T>;
  }
}
