# PROJECT BRIEF — Open Data Use-Case Explorer

## Working title
Open Data Use-Case Explorer

Alternative names:
- DataFit
- OpenData Compass
- Dataset Navigator
- DataMatch
- Civic Data Explorer

## Core idea

Build an interactive HTML/web prototype for exploring a large public open-data catalogue.

The interface should not behave like a traditional dataset portal where users need to already know what they are looking for.

Instead, the user describes a real-world problem or use case, and the system helps answer:

> “Which available datasets are relevant to what I am trying to build?”

The initial data source is the Basel-Stadt Open Government Data portal:

Base portal:
https://data.bs.ch

API:
https://data.bs.ch/api/explore/v2.1

Swagger:
https://data.bs.ch/api/explore/v2.1/swagger.json

API platform:
Opendatasoft Explore API v2.1 / OAS3

Main catalogue endpoint:

GET /catalog/datasets

Dataset metadata:

GET /catalog/datasets/{dataset_id}

Dataset records:

GET /catalog/datasets/{dataset_id}/records

The API supports Opendatasoft Query Language / ODSQL.

---

# PRODUCT THESIS

Most open-data portals expose datasets as tables, filters and search results.

That works if the user already knows:

- what dataset they need
- what it is called
- who publishes it
- what terminology the administration uses

But most real users start from a problem:

- “I want to find the healthiest running route through Basel.”
- “Where would additional trees have the strongest heat-reduction effect?”
- “Which neighbourhoods have poor access to public drinking water?”
- “Could we predict where cycling infrastructure improvements would have the highest impact?”
- “Which data could help us understand noise exposure around schools?”

The application should therefore invert the usual interaction model:

```text
DATA PORTAL

dataset
    ↓
metadata
    ↓
user tries to understand usefulness


DATAFIT

use case
    ↓
semantic interpretation
    ↓
candidate datasets
    ↓
relationships
    ↓
possible combinations
    ↓
prototype / analysis suggestions
```

The LLM is not the data source.

The LLM acts as a semantic navigation and interpretation layer over the deterministic dataset catalogue.

---

# MAIN UX

The central visual should feel more like an interactive D3 knowledge map than a government portal.

Imagine a large spatial canvas containing dataset nodes.

Datasets cluster organically around themes such as:

- environment
- mobility
- climate
- population
- public space
- health
- infrastructure
- construction
- energy
- water
- education
- administration
- economy
- culture
- safety
- geography

The graph should make the data landscape understandable at a glance.

Potential node encoding:

```text
NODE SIZE
→ dataset richness / number of records / relevance

NODE POSITION
→ semantic similarity

NODE GROUP
→ topic / publisher / data family

NODE BORDER OR INDICATOR
→ live / periodically updated / static

NODE BADGES
→ geospatial
→ time series
→ API
→ CSV
→ GeoJSON
→ GPX
→ realtime
```

Avoid rainbow-network-graph aesthetics.

It should be restrained, editorial and calm.

Reference feel:

- D3 exploratory visualisation
- Arc / Linear / Mapbox level UI restraint
- modern research tool
- spatial information landscape
- not a generic “AI dashboard”

---

# MAIN LAYOUT

Desktop-first prototype.

```text
┌─────────────────────────────────────────────────────────────────┐
│ DataFit                                      Basel-Stadt OGD     │
├──────────────────────────────┬──────────────────────────────────┤
│                              │                                  │
│                              │                                  │
│      DATASET LANDSCAPE       │        CONTEXT / CHAT            │
│                              │                                  │
│      interactive D3 map      │  What are you trying to do?      │
│                              │                                  │
│                              │  [ textarea                    ]  │
│                              │                                  │
│                              │  Suggested datasets              │
│                              │                                  │
│                              │  combinations                    │
│                              │                                  │
├──────────────────────────────┴──────────────────────────────────┤
│ filters / legend / search                                       │
└─────────────────────────────────────────────────────────────────┘
```

The graph is the primary interface.

Chat is a secondary navigation mechanism.

Do not make this look like ChatGPT with a graph attached.

---

# USE-CASE INPUT

Example prompt:

> I want to build a running-route planner that avoids heavy traffic and pollution, prefers shaded and green streets, shows drinking fountains and warns about construction sites.

The system should return something closer to:

## Strong matches

### Baumkronenbedeckung
Why:
Can estimate shade exposure along candidate route geometry.

Potential derived feature:
`percentage_of_route_under_canopy`

### Baumkataster
Why:
Provides detailed point-level tree information.

Potential derived feature:
`tree_density_along_route`

### Luftqualitätsmessungen
Why:
Can estimate current or historical pollution exposure.

Potential derived feature:
`air_quality_score`

### Baustellen
Why:
Can detect conflicts between route and ongoing construction.

Potential derived feature:
`construction_warning`

### Brunnen
Why:
Can identify drinking-water points near the route.

Potential derived feature:
`water_points`

---

## Interesting combinations

Tree canopy + temperature:
→ estimate heat exposure

Traffic + air quality:
→ environmental stress score

Pedestrian zones + speed data:
→ low-traffic comfort score

Elevation + route geometry:
→ difficulty / climbing score

---

## Missing data

The interface should also explicitly identify missing data.

Example:

> Pollen data does not appear to be present in the Basel OGD catalogue. Consider adding an external pollen API.

This is important.

The model must not pretend that a dataset exists.

---

# DATASET DETAIL INTERACTION

Clicking a dataset node opens a side panel.

Example:

```text
BAUMKRONENBEDECKUNG

Dataset ID
100357

Publisher
Basel-Stadt

Description
Tree canopy coverage derived from LiDAR data.

Type
Geospatial

Geometry
Raster / spatial coverage

Years
2012
2021
2024

Possible uses
• shade analysis
• urban heat analysis
• green-space assessment
• route comfort scoring

Potential joins
• temperature
• street network
• population
• noise
• traffic

Useful for current use case
HIGH

Reason
Directly supports estimating shade exposure along a route.

[View API]
[Inspect fields]
[Add to workspace]
```

---

# USE-CASE WORKSPACE

Users should be able to collect datasets into a temporary workspace.

Example:

```text
RUNNING ROUTE PROJECT

Selected datasets

✓ Tree canopy
✓ Air quality
✓ Drinking fountains
✓ Construction sites
✓ Traffic speed

Potential pipeline

OSM route geometry
      ↓
sample route
      ↓
intersect canopy
      ↓
query nearest air sensors
      ↓
find fountains within 100 m
      ↓
intersect construction geometry
      ↓
route score
```

This could later become an automatically generated technical implementation brief.

---

# LLM ROLE

The LLM should reason over structured metadata.

Prefer this architecture:

```text
Basel OGD API
      ↓
catalogue ingestion
      ↓
normalized metadata
      ↓
semantic embeddings / classification
      ↓
dataset graph
      ↓
LLM
      ↓
use-case interpretation
```

Do not send an uncontrolled raw web search to the model.

The canonical source is the catalogue.

The model should be able to reason about:

- semantic relevance
- direct vs indirect usefulness
- possible joins
- spatial compatibility
- temporal compatibility
- likely derived indicators
- missing information
- alternative datasets
- limitations

---

# RELEVANCE MODEL

Potential scoring dimensions:

```json
{
  "semantic_match": 0.0,
  "geographic_match": 0.0,
  "temporal_match": 0.0,
  "spatial_compatibility": 0.0,
  "data_quality": 0.0,
  "freshness": 0.0,
  "joinability": 0.0,
  "derived_value": 0.0
}
```

Do not hide the reasoning completely.

Expose concise explanations:

> Strong match because the dataset contains geospatial tree-canopy coverage that can be intersected directly with route geometry.

---

# DATA GRAPH

Create relationships beyond simple categories.

Example:

```text
Baumkataster
   │
   ├── related_to → Baumkronenbedeckung
   │
   ├── can_combine_with → Temperatur
   │
   ├── can_combine_with → Strassennetz
   │
   └── supports → Urban Heat Analysis
```

Potential relationship types:

```text
same_topic
same_publisher
spatially_joinable
temporally_joinable
derived_from
complements
supports_use_case
alternative_to
requires_external_data
```

The graph should become more interesting after a use case is entered.

Unrelated nodes can fade.

Relevant nodes move or highlight.

Connections between useful datasets appear.

---

# EXAMPLE USE CASES FOR DEMO

Include several example prompts users can click.

### Running
Find datasets that could help build pleasant running routes with shade, clean air, water and low traffic.

### Urban heat
Where would additional trees or shading interventions have the biggest impact?

### Cycling
Which datasets could help identify dangerous or uncomfortable cycling corridors?

### Public space
Where is access to public fountains, benches or green spaces weakest?

### Construction
How could we understand the combined impact of construction activity on mobility?

### Schools
Which environmental datasets could help assess conditions around schools?

---

# BASEL OGD LICENSING

Do not assume that every dataset has exactly the same licence.

Global portal conditions permit broad reuse, but individual dataset metadata may contain additional attribution or licensing information.

Capture per dataset:

```json
{
  "license": "",
  "publisher": "",
  "attribution": "",
  "commercial_use": "",
  "source_url": ""
}
```

Never imply that this application is an official Basel-Stadt service.

The Basel OGD terms explicitly prohibit creating the impression of official endorsement or affiliation.

---

# METADATA MODEL

Normalize catalogue records approximately like this:

```json
{
  "id": "100357",
  "title": "Baumkronenbedeckung",
  "description": "",
  "publisher": "",
  "themes": [],
  "keywords": [],
  "license": "",
  "modified": "",
  "records_count": null,

  "data_characteristics": {
    "geospatial": true,
    "time_series": false,
    "realtime": false,
    "geometry_type": "",
    "temporal_coverage": []
  },

  "formats": [
    "json",
    "csv",
    "geojson"
  ],

  "fields": [],

  "semantic": {
    "summary": "",
    "topics": [],
    "entities": [],
    "possible_uses": [],
    "possible_joins": []
  }
}
```

---

# FIRST BUILD

Do not attempt to build a production system yet.

Create a standalone responsive HTML prototype.

Prefer:

- HTML
- CSS
- vanilla JS or lightweight JS
- D3.js for graph / spatial layout

No large application framework is necessary for the first experiment.

The prototype should demonstrate:

1. dataset landscape
2. filtering/search
3. dataset detail inspection
4. use-case text input
5. simulated or real relevance ranking
6. visual highlighting of matching datasets
7. dataset combination suggestions
8. workspace / selected dataset list

If direct API querying from the browser works cleanly, use the Basel API.

Otherwise include a realistic cached sample catalogue and document how live API ingestion should work.

---

# DESIGN DIRECTION

Visual character:

- very clean
- calm
- information-dense but not crowded
- Swiss/editorial rather than startup SaaS
- generous typography
- nearly monochrome
- subtle borders
- soft canvas background
- datasets as restrained spatial objects
- limited accent colour for selection/relevance

Avoid:

- gradient-heavy UI
- glassmorphism
- giant cards everywhere
- generic AI sparkles
- chatbot as primary interface
- multicoloured knowledge graph
- excessive rounded corners
- “AI-powered” marketing language

The interesting thing is the data landscape, not the AI.

---

# CORE PRODUCT PRINCIPLE

Do not ask:

> Which dataset are you searching for?

Ask:

> What are you trying to understand or build?

Then make the available public data intelligible around that question.

---

# LONGER-TERM IDEA

This architecture should not be Basel-specific.

Basel is the first catalogue.

Potential later sources:

- opendata.swiss
- Zurich Open Data
- Swiss federal datasets
- European Data Portal
- municipal open-data portals
- scientific open-data catalogues
- organisational internal data catalogues

The broader product idea is therefore:

> A semantic interface over data catalogues that maps real-world questions to available evidence.

For now, however, scope the prototype strictly to Basel-Stadt OGD and make that experience excellent.