import { evidenceBriefRenderer } from './evidence-brief';
import { mapRenderer } from './map';
import { plotRenderer } from './plot';
import type { RepresentationRenderer, RepresentationRenderInput, RepresentationResult } from './types';

export * from './types';
export * from './observations';

export const REPRESENTATION_RENDERERS: RepresentationRenderer[] = [mapRenderer, plotRenderer, evidenceBriefRenderer];

export function selectRenderer(input: RepresentationRenderInput['spec']): RepresentationRenderer | undefined {
  return REPRESENTATION_RENDERERS.find(renderer => renderer.supports(input));
}

export function renderRepresentation(input: RepresentationRenderInput): RepresentationResult {
  const renderer = selectRenderer(input.spec);
  if (renderer) return renderer.render(input);
  return {
    status: 'unsupported', requestedType: input.spec.type, title: input.spec.title, method: input.spec.method,
    validationState: input.spec.validationState, claims: [], sources: [], caveats: [],
    reason: input.spec.type === 'route_comparison'
      ? 'Route comparison cannot be rendered: no defensible routable network and route geometry are currently available.'
      : `${input.spec.type.replaceAll('_', ' ')} is not supported by Representation Preview v1.`,
    fallback: evidenceBriefRenderer.render({ ...input, spec: { ...input.spec, type: 'evidence_brief', title: 'Evidence brief' } }),
  };
}
