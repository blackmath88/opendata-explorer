import { resourceById } from '../registry';
import { FederalStacClient, type StacItem } from './federal-stac';

export type MeteoSwissProduct = 'pollen' | 'weather';
export type CsvRecord = Record<string, string>;
const BASEL_BBOX: [number, number, number, number] = [7.5, 47.5, 7.7, 47.65];

/** Minimal direct-browser integration: station discovery plus bounded current CSV retrieval. */
export class MeteoSwissAdapter {
  constructor(private readonly stac = new FederalStacClient()) {}

  async baselStations(product: MeteoSwissProduct): Promise<StacItem[]> {
    const resource = resourceById(product === 'pollen' ? 'meteoswiss-pollen' : 'meteoswiss-weather');
    if (!resource?.endpoint) throw new Error(`No curated MeteoSwiss endpoint for ${product}`);
    return this.stac.items(resource.endpoint, { bbox: BASEL_BBOX, limit: 10 });
  }

  async currentObservations(product: MeteoSwissProduct, stationId: string): Promise<{ item: StacItem; asset: string; records: CsvRecord[] }> {
    const item = (await this.baselStations(product)).find(station => station.id.toLocaleLowerCase() === stationId.toLocaleLowerCase());
    if (!item) throw new Error(`Station ${stationId} is not in the curated Basel search area.`);
    const suffix = product === 'pollen' ? '_h_now.csv' : '_t_now.csv';
    const asset = Object.entries(item.assets).find(([key]) => key.endsWith(suffix));
    if (!asset) throw new Error(`No current ${product} asset is published for station ${stationId}.`);
    const csv = await this.stac.text(asset[1].href);
    return { item, asset: asset[1].href, records: parseSemicolonCsv(csv) };
  }
}

export function parseSemicolonCsv(input: string): CsvRecord[] {
  const [header, ...rows] = input.trim().split(/\r?\n/);
  if (!header) return [];
  const names = header.split(';');
  return rows.filter(Boolean).map(row => Object.fromEntries(row.split(';').map((value, index) => [names[index], value])));
}
