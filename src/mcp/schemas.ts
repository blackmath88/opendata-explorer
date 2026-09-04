import * as z from 'zod/v4';

export const questionSchema = z.string().min(3).max(2000);
export const datasetIdSchema = z.string().min(1).max(100);
export const representationTypeSchema = z.enum(['point_map', 'choropleth', 'relationship_map', 'route_comparison', 'ranked_bar', 'time_series', 'comparison_cards', 'evidence_brief']);

export const stateSchema = z.object({ catalogueSource: z.enum(['live', 'fallback']), plans: z.number(), inspections: z.number(), assessments: z.number(), executions: z.number(), persistence: z.literal('in_memory') });
export const envelopeSchema = <T extends z.ZodType>(data: T) => z.object({ data, state: stateSchema });

export const planSchema = z.object({ planId: z.string(), plan: z.object({
  intent: z.object({ statement: z.string(), domainHints: z.array(z.string()), spatialNeed: z.boolean() }).loose(),
  roles: z.array(z.object({ id: z.string(), label: z.string(), roleType: z.string(), required: z.boolean(), reason: z.string(), datasetId: z.string().optional(), origin: z.string() }).loose()),
  unresolved: z.array(z.unknown()), externalDependencies: z.array(z.unknown()),
}) });

export const resolutionSchema = planSchema.extend({ resolution: z.object({
  roles: z.array(z.object({ roleId: z.string(), label: z.string(), localStatus: z.string(), localReason: z.string(), candidates: z.array(z.object({ resourceId: z.string(), providerId: z.string(), scope: z.string(), status: z.string(), origin: z.string(), reason: z.string() })) }).loose()),
  supplemental: z.array(z.unknown()), unresolved: z.array(z.unknown()),
}) });

export const toolNames = ['search_datasets', 'build_evidence_plan', 'resolve_missing_evidence', 'inspect_dataset', 'assess_compatibility', 'validate_relationship', 'suggest_representation', 'build_result'] as const;
