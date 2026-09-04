import type { RepresentationRenderer } from './types';
import { claimsFrom, provenanceFrom } from './shared';

export const mapRenderer: RepresentationRenderer = {
  id: 'map',
  supports: spec => spec.type === 'point_map' || spec.type === 'relationship_map',
  render(input) {
    const layers = (input.layers ?? []).filter(layer => layer.features.some(feature => feature.geometry));
    const common = { requestedType: input.spec.type, title: input.spec.title, method: input.spec.method,
      validationState: input.spec.validationState, claims: claimsFrom(input), sources: provenanceFrom(input) };
    if (!layers.length) return { ...common, status: 'blocked', renderer: 'map', reason: 'No retrievable GeoJSON geometry is available for the selected evidence.', caveats: [] };
    const caveats = layers.filter(layer => layer.truncated).map(layer => `${layer.label} was truncated for preview performance.`);
    return { ...common, status: caveats.length ? 'partial' : 'ready', renderer: 'map', caveats,
      view: { kind: 'map', layers, center: [7.5886, 47.5596], zoom: 12 } };
  },
};
