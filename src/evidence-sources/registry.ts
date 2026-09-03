import type { TrustedEvidenceResource, TrustedProvider } from './types';

export const TRUSTED_PROVIDERS: TrustedProvider[] = [
  { id: 'meteoswiss', label: 'MeteoSwiss', scope: 'national', trust: 'official', homepage: 'https://www.meteoswiss.admin.ch/', attribution: 'Source: MeteoSwiss' },
  { id: 'swisstopo', label: 'Federal Office of Topography swisstopo', scope: 'national', trust: 'official', homepage: 'https://www.swisstopo.admin.ch/', attribution: '© swisstopo' },
  { id: 'bfs', label: 'Federal Statistical Office FSO', scope: 'national', trust: 'official', homepage: 'https://www.bfs.admin.ch/', attribution: 'Source: Federal Statistical Office FSO' },
];

export const TRUSTED_EVIDENCE_RESOURCES: TrustedEvidenceResource[] = [
  {
    id: 'meteoswiss-pollen', providerId: 'meteoswiss', label: 'Pollen stations — measured values',
    description: 'Hourly, daily and annual pollen concentrations from the official national monitoring network, including Basel station PBS.',
    topics: ['pollen', 'allergen', 'health', 'outdoor comfort'], evidenceRoleIds: ['allergen_exposure'], accessType: 'stac',
    catalogueUrl: 'https://opendatadocs.meteoswiss.ch/a-data-groundbased/a7-pollen-stations', endpoint: 'https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-pollen',
    formats: ['csv', 'json'], geographicScope: ['Switzerland', 'Basel station PBS'], spatial: { geometry: 'station points', baselFilter: 'bbox' },
    temporal: { mode: 'hourly measurements and history', frequency: 'hourly; h_now updated every 20 minutes', freshness: 'STAC item and assets carry updated timestamps' },
    browserAccess: 'direct', status: 'retrievable', licence: 'Open Data; cite Source: MeteoSwiss', curatedReason: 'Fills the running-use-case pollen gap with a Basel monitoring station.',
    notes: ['Station measurements are not a continuous exposure surface.', 'Registry status does not validate attachment to a route.'],
  },
  {
    id: 'meteoswiss-weather', providerId: 'meteoswiss', label: 'Automatic weather stations — measurement values',
    description: 'Temperature, precipitation, humidity, wind and related observations from SwissMetNet, including Basel-area stations.',
    topics: ['weather', 'temperature', 'precipitation', 'humidity', 'wind'], evidenceRoleIds: ['weather_context', 'heat_measure'], accessType: 'stac',
    catalogueUrl: 'https://opendatadocs.meteoswiss.ch/a-data-groundbased/a1-automatic-weather-stations', endpoint: 'https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-smn',
    formats: ['csv', 'json'], geographicScope: ['Switzerland', 'Basel-area stations BAS and STC'], spatial: { geometry: 'station points', baselFilter: 'bbox' },
    temporal: { mode: '10-minute through annual measurements', frequency: '10-minute files updated every 20 minutes', freshness: 'now, recent and historical assets' },
    browserAccess: 'direct', status: 'retrievable', licence: 'Open Data; cite Source: MeteoSwiss', curatedReason: 'Adds optional current conditions and temperature context to outdoor-use questions.',
    notes: ['Station values require a stated spatial attribution method before route-level use.'],
  },
  {
    id: 'swisstopo-swisstne-base', providerId: 'swisstopo', label: 'Base network swissTNE',
    description: 'Official multimodal topological edge-node network covering road, rail, cable and water transport axes.',
    topics: ['transport network', 'roads', 'paths', 'topology'], evidenceRoleIds: ['route_geometry', 'screened_network'], accessType: 'stac',
    catalogueUrl: 'https://www.swisstopo.admin.ch/en/landscape-model-swisstne-base', endpoint: 'https://data.geo.admin.ch/api/stac/v1/collections/ch.swisstopo.swisstne-base',
    formats: ['geopackage'], geographicScope: ['Switzerland', 'Liechtenstein'], spatial: { geometry: '3D nodes, edges and surfaces', baselFilter: 'none' },
    temporal: { mode: 'versioned reference network', frequency: 'annual', freshness: '2026 release dated 2026-02-24' },
    browserAccess: 'impractical', status: 'metadata_resolved', licence: 'Free use; attribution © swisstopo', curatedReason: 'A materially stronger general network backbone than 21 curated Basel cycle-route lines.',
    notes: ['Current GeoPackage download is national and about 1.06 GB.', 'The base product lacks detailed pedestrian/cycle suitability attributes.', 'Do not call it a ready-made route planner.'],
  },
  {
    id: 'swisstopo-swissalti3d', providerId: 'swisstopo', label: 'swissALTI3D elevation model',
    description: 'Official bare-earth digital elevation model supplied as spatially tiled 0.5 m and 2 m Cloud Optimized GeoTIFF or XYZ assets.',
    topics: ['elevation', 'terrain', 'slope', 'effort'], evidenceRoleIds: ['elevation_context'], accessType: 'stac',
    catalogueUrl: 'https://www.swisstopo.admin.ch/en/height-model-swissalti3d', endpoint: 'https://data.geo.admin.ch/api/stac/v1/collections/ch.swisstopo.swissalti3d',
    formats: ['geotiff', 'other'], geographicScope: ['Switzerland', 'Liechtenstein'], spatial: { geometry: 'tiled elevation raster', baselFilter: 'tile' },
    temporal: { mode: 'reference terrain model', frequency: 'six-year regional cycle', freshness: 'collection currently spans 2019–2025 source vintages' },
    browserAccess: 'direct', status: 'metadata_resolved', licence: 'Free use; attribution © swisstopo', curatedReason: 'Provides terrain elevation from which route slope and effort can be derived.',
    notes: ['STAC bbox selects Basel tiles.', 'Browser execution still needs GeoTIFF sampling and CRS-aware route profiling.', 'A source candidate is not a validated slope relationship.'],
  },
  {
    id: 'bfs-statpop', providerId: 'bfs', label: 'STATPOP population and households',
    description: 'Annual official population and household statistics with municipality and hectare-grid assets.',
    topics: ['population', 'demographics', 'denominator', 'equity'], evidenceRoleIds: ['exposed_population', 'population_denominator'], accessType: 'stac',
    catalogueUrl: 'https://opendata.swiss/en/dataset/bevolkerungsstatistik-einwohner', endpoint: 'https://data.geo.admin.ch/api/stac/v1/collections/ch.bfs.statistik-bevoelkerung_haushalte',
    formats: ['csv', 'parquet', 'geopackage', 'json'], geographicScope: ['Switzerland'], spatial: { geometry: 'municipal aggregates and hectare grid in LV95', baselFilter: 'none' },
    temporal: { mode: 'annual snapshots since 2010, with 1990/2000 census assets', frequency: 'annual', freshness: '2025 reference year published 2026-08-18' },
    browserAccess: 'impractical', status: 'metadata_resolved', licence: 'Official FSO open data; retain source attribution and dataset-specific terms', curatedReason: 'Supplies a national population denominator for access and equity questions.',
    notes: ['2025 municipality CSV is about 0.56 MB; national hectare CSV is about 66 MB and Parquet about 21 MB.', 'STAC items are national yearly packages, so bbox does not extract Basel rows.'],
  },
];

export const providerById = (id: string): TrustedProvider | undefined => TRUSTED_PROVIDERS.find(provider => provider.id === id);
export const resourceById = (id: string): TrustedEvidenceResource | undefined => TRUSTED_EVIDENCE_RESOURCES.find(resource => resource.id === id);
