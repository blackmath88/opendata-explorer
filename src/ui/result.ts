import type { Map as MapLibreMap } from 'maplibre-gl';
import type { RepresentationResult } from '../renderers';
import { escapeHtml } from './dom';

const COLORS = ['#2d5b49', '#8a5f2d', '#334155', '#7f443a'];

export function resultShell(result: RepresentationResult): string {
  const shown = result.status === 'unsupported' && result.fallback ? result.fallback : result;
  const fallbackNote = result.status === 'unsupported'
    ? `<div class="result-blocked"><b>Requested view unavailable.</b> ${escapeHtml(result.reason ?? '')}<br>The evidence brief below is an explicit fallback.</div>` : '';
  return `<section class="result-panel" aria-live="polite">
    <div class="result-head"><div><span class="eyebrow">Result · ${escapeHtml(shown.status)}</span><h2>${escapeHtml(shown.title)}</h2><p>${escapeHtml(shown.method)}</p></div><span class="validation-badge state-${escapeHtml(shown.validationState)}">${escapeHtml(shown.validationState.replace('_', ' '))}</span></div>
    ${fallbackNote}${shown.reason ? `<div class="result-blocked">${escapeHtml(shown.reason)}</div>` : ''}
    ${shown.view?.kind === 'map' ? `<div class="map-preview"><div class="map-legend">${shown.view.layers.map((layer, index) => `<span><i style="background:${COLORS[index % COLORS.length]}"></i>${escapeHtml(layer.label)} · ${escapeHtml(layer.scope)}</span>`).join('')}</div><div class="result-view" id="representationView"></div></div>` : '<div class="result-view" id="representationView"></div>'}
    ${renderClaims(shown)}${renderSources(shown)}
    ${shown.caveats.length ? `<details><summary>Method and caveats</summary><ul>${shown.caveats.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></details>` : ''}
  </section>`;
}

export async function mountResult(container: HTMLElement, result: RepresentationResult): Promise<(() => void) | undefined> {
  const shown = result.status === 'unsupported' && result.fallback ? result.fallback : result;
  if (!shown.view) return;
  if (shown.view.kind === 'brief') {
    container.innerHTML = `<div class="evidence-brief">${shown.view.sections.map(section => `<section><h3>${escapeHtml(section.title)}</h3>${section.items.length ? `<ul>${section.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p class="quiet">None recorded.</p>'}</section>`).join('')}</div>`;
    return;
  }
  if (shown.view.kind === 'plot') {
    const Plot = await import('@observablehq/plot');
    const data = shown.view.observations;
    const unit = data[0]?.unit ?? '';
    const chart = shown.view.chart === 'ranked_bar'
      ? Plot.plot({ marginLeft: 120, x: { label: unit }, y: { label: null }, marks: [Plot.ruleX([0]), Plot.barX(data, { x: 'value', y: 'label', sort: { y: '-x' }, fill: '#2d5b49', tip: true })] })
      : Plot.plot({ marginLeft: 54, x: { type: 'utc', label: null }, y: { label: unit }, marks: [Plot.ruleY([0]), Plot.lineY(data, { x: d => new Date(d.time!), y: 'value', stroke: '#2d5b49', marker: true, tip: true })] });
    container.append(chart);
    return () => chart.remove();
  }
  await import('maplibre-gl/dist/maplibre-gl.css');
  const maplibregl = await import('maplibre-gl');
  const mapView = shown.view;
  const map = new maplibregl.Map({ container, center: mapView.center, zoom: mapView.zoom,
    style: { version: 8, sources: {}, layers: [{ id: 'paper', type: 'background', paint: { 'background-color': '#f1eee7' } }] }, attributionControl: false });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: shown.sources.map(source => `<a href="${source.sourceUrl}">${source.provider}</a>`).join(' · ') }));
  map.on('load', () => mapView.layers.forEach((layer, index) => addLayer(maplibregl, map, layer.id, layer.features, COLORS[index % COLORS.length])));
  return () => map.remove();
}

function addLayer(maplibregl: typeof import('maplibre-gl'), map: MapLibreMap, id: string, features: unknown[], color: string): void {
  map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection });
  const types = ['fill', 'line', 'circle'] as const;
  for (const type of types) {
    const layerId = `${id}-${type}`;
    const filter = type === 'fill' ? ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]]
      : type === 'line' ? ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]]
        : ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]];
    map.addLayer({ id: layerId, source: id, type, filter: filter as never,
      paint: type === 'fill' ? { 'fill-color': color, 'fill-opacity': 0.22, 'fill-outline-color': color }
        : type === 'line' ? { 'line-color': color, 'line-width': 2.5 }
          : { 'circle-color': color, 'circle-radius': 4, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 } } as never);
    map.on('click', layerId, event => {
      const properties = event.features?.[0]?.properties ?? {};
      const details = Object.entries(properties).slice(0, 5).map(([key, value]) => `<b>${escapeHtml(key)}</b>: ${escapeHtml(String(value ?? ''))}`).join('<br>');
      new maplibregl.Popup().setLngLat(event.lngLat).setHTML(details || 'Published feature').addTo(map);
    });
    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
  }
}

function renderClaims(result: RepresentationResult): string {
  return `<div class="result-claims"><span class="eyebrow">Evidence status</span>${result.claims.map(claim => `<div class="claim claim-${claim.status}"><b>${icon(claim.status)} ${escapeHtml(claim.status)}</b><span>${escapeHtml(claim.text)}</span><small>${escapeHtml(claim.evidenceLevel.replace('_', ' '))}</small></div>`).join('')}</div>`;
}

function renderSources(result: RepresentationResult): string {
  return `<details open><summary>Sources and provenance</summary><ul class="result-sources">${result.sources.map(source => `<li><b>${escapeHtml(source.label)}</b><span>${escapeHtml(source.provider)} · ${escapeHtml(source.scope)} · ${escapeHtml(source.state)}${source.timestamp ? ` · ${escapeHtml(source.timestamp)}` : ''}</span><a href="${escapeHtml(source.sourceUrl)}" target="_blank" rel="noreferrer">Source</a></li>`).join('')}</ul></details>`;
}

const icon = (status: string): string => status === 'confirmed' ? '✓' : status === 'rejected' ? '✕' : status === 'partial' ? '△' : status === 'unresolved' ? '?' : '+';
