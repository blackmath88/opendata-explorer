# Discovery UI for open data: problem statement and research prompt

## Problem statement

**DataFit** helps people find and combine open datasets for a concrete question, e.g. *"a comfortable running route in Basel with shade, clean air, fountains, low traffic"*. The catalogue is Basel-Stadt OGD: 361 datasets live, 44 in the offline snapshot. Each dataset carries rich metadata: topic, geometry type, temporal cadence, record count, fields, publisher, licence, and a relevance class for the current question (direct / supporting / contextual / missing).

The Discover view has to do two jobs at once:
1. **Show the whole catalogue honestly.** A user must be able to see that a known dataset exists, and how the visible set relates to the total.
2. **Show what fits the question.** Which datasets serve which evidence role, how strong the match is, what's missing, and whether the data is structurally usable (spatial? time series? enough records?).

**What we tried and what went wrong:**
- **Force-directed graph (v1).** 80 of 361 datasets drawn, 24 labelled, nodes moving on every render. It created a credible false impression that data was missing (UX_EVALUATION.md: *critical*).
- **Zoomable circle-packing (v2).**
  - Hierarchical and complete, but noisy.
  - Labels competed with circles and were covered by child bubbles.
  - Deeper levels only appeared on zoom, and circle area wasted space.
  - It needed icons, counter-scaling and label rules just to stay readable.
- **Card treemap (v3, current branch).**
  - Category cards → subcategory tiles → dataset lists.
  - Calmer and labels fit, but tile *area* encodes only count.
  - Relevance to the question is reduced to two small badges.
  - Readiness (spatial/time/records) isn't visible until you open a dataset.
  - At 361 datasets the "Other" buckets grow into big blank tiles.

**The open question.** What presentation lets a non-expert, within ~10 seconds:
- see *what kinds* of data exist,
- see *where the fit for their question* is,
- see *what's missing*,
- and within one or two clicks reach a specific dataset and judge whether it's usable, with no hidden subsets, no layout churn, and readable at 361+ datasets and on a 390px phone?

**Constraints:**
- Vanilla TypeScript + Vite, D3 available, no framework.
- Design system in DESIGN.md: a calm public-sector look, 1–1.5px line icons, and one green primary with warn/danger tones.
- Metadata only. There are no thumbnails or previews beyond what's cached.
- Must degrade honestly in fallback mode.

## Research questions

1. **Overview form.** For a catalogue of 100–1,000 datasets with 2–3 hierarchy levels and several cross-cutting facets, which overview works best, and why? Candidates: card grid, treemap, faceted list, matrix/heatmap (facet × facet), small multiples, a "data grid" coverage table, or a hybrid.
2. **Encoding fit vs. existence.** How do strong catalogues show *relevance to a query* separately from *what exists*, without ranking hiding the long tail? That includes position, size, colour, badges and separate lanes.
3. **Readiness at a glance.** How do they show usability (format, geometry, cadence, completeness, licence, freshness) *before* the detail page? Which 3–5 signals matter most to a first-time user?
4. **Gaps as first-class content.** Who shows *missing* data explicitly, for example "no dataset covers X", or coverage matrices with empty cells? How?
5. **Faceting and lenses.** Do users understand switchable "group by" lenses (topic / space / time / readiness), or do facet filters with counts work better? How should counts behave when filters combine?
6. **Scale and honesty.** Patterns for showing that everything is there: totals, "showing N of M", complete paged lists, no silent truncation.
7. **Mobile.** Which of these patterns survive at 390px?
8. **Icons and wayfinding.** Where do category icons actually improve scanning (topic tiles, facets), and where are they decoration?

## Examples to study (and what to look at)

| Example | Look at |
|---|---|
| **HDX (Humanitarian Data Exchange), "Data Grids"** | Coverage matrix of data category × country, with empty cells as explicit gaps. The closest match to "what's missing for my question". |
| **opendata.swiss / data.europa.eu (CKAN)** | Faceted search with counts (theme, format, organisation, licence), result cards, and how they label completeness and formats. |
| **Kaggle Datasets** | Dataset cards with a usability score, file types and size shown before opening; how one quality number is communicated. |
| **Google Dataset Search** | Result cards with provider, update date, format and licence; how cross-catalogue results are made comparable. |
| **Our World in Data (catalogue and grapher)** | Topic pages grouping datasets by question; strong titles and subtitles; how "what this data can answer" is written. |
| **ArcGIS Hub / Socrata / Opendatasoft portals** | Geometry-type badges, map thumbnails, "type" facets (map / table / file); what spatial users need first. |
| **Observable / Datawrapper galleries** | Card density, and when a small preview beats a label. |
| **Google Data Cards Playbook; Gebru et al., "Datasheets for Datasets"** | Which descriptors people actually read, and layered disclosure (at a glance → detail). |
| **Shneiderman, "Overview first, zoom and filter, details on demand"; the treemap papers** | When area encoding helps, and when it misleads. |
| **Hearst, "Flamenco" faceted navigation; Pirolli & Card, "information scent"** | Why faceted counts guide exploration, and how labels create scent. |
| **Stadt Zürich / Wien / London datastores** | Municipal peers with similar catalogue size; any topic-icon systems and how they're used. |

## What a good answer delivers

- A comparison table: pattern × (completeness honesty, fit visibility, gap visibility, readiness at a glance, scale to 1,000, mobile), with a concrete example for each cell.
- 2–3 recommended designs for DataFit, each with a wireframe description, what it shows at 10 seconds / 1 click / 2 clicks, and its failure mode.
- The 3–5 readiness signals to show on every dataset card, with rationale.
- A recommendation on whether category icons belong on topic tiles, facets, or both.
- Sources for every claim: links, screenshots, or papers.

---

## Research prompt (copy-paste)

> I'm designing the dataset discovery view for **DataFit**, a tool that helps non-experts find and combine open datasets (Basel-Stadt OGD, ~361 datasets) for a concrete question such as "a comfortable running route with shade, clean air and fountains". Each dataset has metadata: topic (2-level taxonomy), geometry type, update cadence, record count, fields, publisher, licence, plus a per-question relevance class (direct / supporting / contextual) and explicit *missing* evidence roles.
>
> We've tried three overviews:
> 1. A force-directed graph: only 80 of 361 drawn, 24 labelled, and unstable.
> 2. Zoomable circle-packing: complete but noisy, with labels covered by bubbles and depth hidden behind zoom.
> 3. A card treemap (category → subcategory → dataset list): calmer, but area encodes only count, relevance is two small badges, readiness is invisible until a detail click, and "Other" buckets grow into big empty tiles.
>
> **Research how the best data catalogues and data-discovery interfaces present many heterogeneous datasets so that a first-time user can, within ~10 seconds, see what kinds of data exist, where the fit for their question is, and what's missing, and within 1–2 clicks judge whether a specific dataset is usable.**
>
> Study and cite concrete examples, including:
> - HDX Data Grids (coverage matrices with explicit gaps)
> - opendata.swiss / data.europa.eu (CKAN faceted search)
> - Kaggle dataset cards (usability score)
> - Google Dataset Search result cards
> - Our World in Data topic pages
> - ArcGIS Hub / Opendatasoft portals (geometry and type badges)
> - municipal datastores (Zürich, Wien, London)
> - Google's Data Cards Playbook and "Datasheets for Datasets"
> - Shneiderman's "overview first" and the treemap work, Hearst's faceted navigation (Flamenco), and Pirolli & Card's information scent
>
> For each pattern (card grid, treemap, faceted list, facet × facet matrix, small multiples, coverage grid, hybrids), assess:
> - completeness honesty (no silent truncation)
> - visibility of query fit vs. mere existence
> - visibility of gaps
> - readiness at a glance
> - scaling to 1,000 datasets
> - behaviour at 390px mobile width
> - the role of category icons
>
> Deliver:
> 1. a comparison table with an example per cell
> 2. 2–3 recommended designs for DataFit, each with a wireframe description, what the user learns at 10 seconds / 1 click / 2 clicks, and its main failure mode
> 3. the 3–5 readiness signals every dataset card should show, with rationale
> 4. where topic icons help versus decorate
>
> Constraints: vanilla TypeScript and D3, a calm public-sector design system (one green primary, warn/danger tones, 1–1.5px line icons), metadata only (no previews), and honest behaviour in an offline fallback of 44 datasets.
>
> Prefer evidence (studies, usability findings, documented design rationale) over opinion, and link every source.
