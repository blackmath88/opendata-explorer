# Trusted Evidence Registry v1 — findings

Verified 4 September 2026 against official provider documentation, live response headers/assets, and the federal `data.geo.admin.ch` STAC API. The registry is deliberately small: it is a deterministic gap-filler for evidence roles, not a federated search engine.

## Decision summary

| Evidence need | Curated official resource | Basel relevance | Browser feasibility | Registry decision |
|---|---|---|---|---|
| Pollen / allergen exposure | MeteoSwiss pollen stations | Basel station PBS is returned by a Basel bounding-box query | Direct STAC JSON and small current CSV; CORS enabled | `retrievable`; proposed dependency only |
| Current weather / heat context | MeteoSwiss SwissMetNet | Basel-area stations BAS and STC | Direct STAC JSON and bounded current CSV; CORS enabled | `retrievable`; optional context only |
| General route network | swisstopo swissTNE Base | National network includes Basel | Official download is a 1,056,394,105-byte national GeoPackage ZIP | `metadata_resolved`; propose only when local backbone is weak |
| Elevation / effort | swisstopo swissALTI3D | STAC bbox resolves Basel tiles | Direct 0.5 m/2 m COG or XYZ tiles; app still needs raster and CRS-aware sampling | `metadata_resolved`; not a validated slope |
| Population denominator | BFS STATPOP | Municipality and hectare-grid coverage includes Basel | Municipality CSV is manageable; fine grid is a large national package with no STAC bbox subset | `metadata_resolved`; no runtime adapter in v1 |

## MeteoSwiss

### Pollen stations

- Official documentation: <https://opendatadocs.meteoswiss.ch/a-data-groundbased/a7-pollen-stations>
- STAC collection: <https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-pollen>
- Basel station discovered from bbox `7.5,47.5,7.7,47.65`: PBS at approximately `7.583931,47.5618`.
- Current hourly asset: `ogd-pollen_pbs_h_now.csv`; the documented current product is updated every 20 minutes.
- The CSV provides station observations. It does **not** provide a continuous pollen surface or prove exposure along a route.

### Automatic weather stations

- Official documentation: <https://opendatadocs.meteoswiss.ch/a-data-groundbased/a1-automatic-weather-stations>
- STAC collection: <https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-smn>
- The Basel bbox resolves BAS and STC stations. Products cover temperature, precipitation, humidity, wind and related measures from ten-minute to annual grains.
- Current ten-minute CSV assets are documented as updating every 20 minutes.

Both collections and sampled CSV assets returned `access-control-allow-origin: *` when tested with a browser `Origin` header. The minimal adapter therefore performs direct, read-only station discovery followed by retrieval of one current CSV. MeteoSwiss states that its Open Data may be used without restriction and requires attribution as `Source: MeteoSwiss`.

## swisstopo / geo.admin.ch

### swissTNE Base network

- Product page: <https://www.swisstopo.admin.ch/en/landscape-model-swisstne-base>
- STAC collection: <https://data.geo.admin.ch/api/stac/v1/collections/ch.swisstopo.swisstne-base>
- The product is an official multimodal topological edge-node network for Switzerland and Liechtenstein, versioned annually with stable identifiers and change history. It is genuine network/topology evidence, not merely road-line geometry.
- The current 2026 GeoPackage asset is national and approximately 1.06 GB. The STAC item is a whole-country release; a bbox does not produce a Basel extract.
- It is a stronger general network backbone than a small hand-curated local route set. Topology checks support routing connectivity, but the base product is not a ready-made running router and lacks the detailed pedestrian access, comfort, restriction, and weighting semantics needed to claim suitable route generation.

### swissALTI3D

- Product page: <https://www.swisstopo.admin.ch/en/height-model-swissalti3d>
- STAC collection: <https://data.geo.admin.ch/api/stac/v1/collections/ch.swisstopo.swissalti3d>
- Bare-earth elevation is available as spatially tiled 0.5 m and 2 m Cloud Optimized GeoTIFF and XYZ assets. Basel bbox queries return the relevant tiles.
- Direct asset access is practical and CORS-enabled, but route effort requires explicit tile selection, coordinate transformation and sampling along route geometry. That operation is not implemented in v1.

The applicable free-geodata terms and dataset-specific terms must be retained; display attribution is `© swisstopo`. The official STAC interface is documented at <https://www.geo.admin.ch/en/rest-interface-stac-api>.

## Federal Statistical Office (BFS/FSO)

- Discovery record: <https://opendata.swiss/en/dataset/bevolkerungsstatistik-einwohner>
- STAC collection: <https://data.geo.admin.ch/api/stac/v1/collections/ch.bfs.statistik-bevoelkerung_haushalte>
- STATPOP provides annual population and household statistics at municipality and hectare-grid levels. The collection currently reaches reference year 2025.
- The 2025 municipality CSV is approximately 0.56 MB. The national hectare CSV is approximately 66 MB and its Parquet equivalent approximately 21 MB.
- CORS is enabled, but the yearly STAC item is a national package and bbox does not filter the records. Municipality data is too coarse for neighbourhood equity; the hectare product requires a real ingest/filter path. It is therefore metadata-resolved, not runtime evidence in v1.

## opendata.swiss

- Catalogue: <https://opendata.swiss/>
- Access mechanism: national metadata catalogue and canonical dataset pages; v1 uses it only to confirm publisher identity and link to the official record.
- It is useful for metadata discovery and source validation, not browser retrieval or runtime execution in this milestone. DataFit does not search, harvest, or federate the full catalogue.
- The authoritative machine-readable assets remain the provider/FSDI endpoints above. Catalogue presence alone does not establish retrieval, inspection, compatibility, or execution validity.

## Proxy decision

No proxy is justified for v1. The official STAC metadata and tested assets are directly accessible with CORS. The constraints are large files, specialist formats and spatial processing—not cross-origin access. A proxy that merely relays bytes would not solve these constraints; a service that subsets GeoPackage, Parquet or raster data would be a new ingestion architecture and is outside this milestone.

## Resolver policy and evidence ladder

1. An adequate Basel catalogue dataset wins. No national replacement is shown.
2. A materially weak local source remains visible, with a national source proposed as a possible stronger backbone.
3. A missing role receives candidates only through an explicit curated role-to-resource mapping.
4. Registry presence carries the highest access state verified by curation: MeteoSwiss CSV resources are `retrievable`; file-based federal resources are `metadata_resolved`. No v1 resource is `inspected`. These states never mean structurally compatible, sample-validated or execution-validated.
5. Validation remains a separate operation. In particular, a station, network, raster tile or denominator cannot be attached to a route or neighbourhood until the relevant relationship has been checked.

## Acceptance demonstrations

### Running comfort / effort

For a request to build a comfortable Basel running route using shade, clean air, fountains, low traffic and sensible effort:

- local Basel evidence remains primary for trees/shade, air monitoring, traffic context, fountains and construction where the catalogue supports it;
- the small local route set can be marked weak as a general backbone and swissTNE proposed without pretending it is routing-ready;
- swissALTI3D fills the known elevation-source gap;
- MeteoSwiss pollen fills the allergen-source gap, and current weather can appear as optional context;
- route-to-point, route-to-station and route-to-raster relationships remain unvalidated until executed.

### Public-service access / equity

For a question such as “Where is access to public fountains or green space weakest, especially for underserved neighbourhoods?” local amenities and Basel geography stay primary. BFS STATPOP is proposed only for the population-denominator gap. A trustworthy result still needs a stated walking network, an accessibility method, spatial resolution appropriate to neighbourhood claims, and relationship validation; the registry does not silently turn national population files into a Basel equity result.
