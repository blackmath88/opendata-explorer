import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { DataFitOrchestrator } from '../core/orchestrator';
import { datasetIdSchema, envelopeSchema, planSchema, questionSchema, representationTypeSchema, resolutionSchema } from './schemas';

const reply = (orchestrator: DataFitOrchestrator, data: unknown) => {
  const structuredContent = JSON.parse(JSON.stringify({ data, state: orchestrator.stateSummary() })) as Record<string, unknown>;
  return { content: [{ type: 'text' as const, text: JSON.stringify(structuredContent, null, 2) }], structuredContent };
};

export function registerDataFitTools(server: McpServer, orchestrator: DataFitOrchestrator): void {
  server.registerTool('search_datasets', {
    title: 'Search Basel datasets',
    description: 'Finds relevant Basel-Stadt datasets through DataFit deterministic ranking. Returns local catalogue evidence only; it does not search the web or prove compatibility.',
    inputSchema: z.object({ query: questionSchema, limit: z.number().int().min(1).max(50).default(10) }),
    outputSchema: envelopeSchema(z.object({ matches: z.array(z.object({ datasetId: z.string(), title: z.string(), provider: z.string(), relevance: z.unknown(), evidenceClass: z.string(), roleIds: z.array(z.string()), scope: z.literal('local'), sourceUrl: z.string(), availability: z.string() })) })),
  }, async ({ query, limit }) => reply(orchestrator, { matches: orchestrator.searchDatasets(query, limit) }));

  server.registerTool('build_evidence_plan', {
    title: 'Build evidence plan',
    description: 'Parses a civic question and builds the same deterministic evidence-role plan used by the DataFit web app. Roles are system inference, not publisher claims.',
    inputSchema: z.object({ question: questionSchema }), outputSchema: envelopeSchema(planSchema),
  }, async ({ question }) => reply(orchestrator, orchestrator.buildPlan(question)));

  server.registerTool('resolve_missing_evidence', {
    title: 'Resolve missing evidence',
    description: 'Resolves only missing or materially weak roles against DataFit curated official Swiss registry. A candidate access state never implies compatibility or validation.',
    inputSchema: z.object({ plan_id: z.string().optional(), question: questionSchema.optional() }).refine(value => value.plan_id || value.question, 'Provide plan_id or question.'),
    outputSchema: envelopeSchema(resolutionSchema),
  }, async ({ plan_id, question }) => reply(orchestrator, orchestrator.resolveEvidence({ planId: plan_id, question })));

  server.registerTool('inspect_dataset', {
    title: 'Inspect dataset',
    description: 'Reads a Basel dataset schema and optionally bounded records through the existing adapter. The returned observation level states whether evidence is metadata, schema, or sample based.',
    inputSchema: z.object({ dataset_id: datasetIdSchema, sample: z.boolean().default(false) }),
    outputSchema: envelopeSchema(z.object({ dataset: z.object({ id: z.string(), title: z.string(), publisher: z.string(), sourceUrl: z.string() }), structure: z.object({ datasetId: z.string(), observedFrom: z.string(), fields: z.array(z.unknown()), notes: z.array(z.string()) }).loose() })),
  }, async ({ dataset_id, sample }) => reply(orchestrator, await orchestrator.inspectDataset(dataset_id, sample)));

  server.registerTool('assess_compatibility', {
    title: 'Assess compatibility',
    description: 'Proposes a deterministic structural relationship between two inspected datasets. This is not execution validation; call validate_relationship for executable spatial proposals.',
    inputSchema: z.object({ left_dataset_id: datasetIdSchema, right_dataset_id: datasetIdSchema }),
    outputSchema: envelopeSchema(z.object({ assessment: z.object({ id: z.string(), leftDatasetId: z.string(), rightDatasetId: z.string(), relation: z.string(), evidenceLevel: z.string(), confidence: z.string(), reasons: z.array(z.string()), warnings: z.array(z.string()) }).loose(), executable: z.boolean(), execution: z.unknown().optional() })),
  }, async ({ left_dataset_id, right_dataset_id }) => reply(orchestrator, await orchestrator.checkCompatibility(left_dataset_id, right_dataset_id)));

  server.registerTool('validate_relationship', {
    title: 'Validate relationship',
    description: 'Executes the operation justified by a prior assessment. Returns confirmed, rejected, partial, or failed distinctly; a technical failure is never a rejection.',
    inputSchema: z.object({ assessment_id: z.string().min(1) }),
    outputSchema: envelopeSchema(z.object({ operation: z.object({ id: z.string(), assessmentId: z.string(), type: z.string() }).loose(), result: z.object({ id: z.string(), assessmentId: z.string(), status: z.enum(['confirmed', 'rejected', 'partial', 'failed']), evidenceLevel: z.literal('execution_validated'), validation: z.unknown(), sourceSnapshots: z.array(z.unknown()) }).loose() })),
  }, async ({ assessment_id }) => reply(orchestrator, await orchestrator.validateRelationship(assessment_id)));

  server.registerTool('suggest_representation', {
    title: 'Suggest representation',
    description: 'Returns renderer-independent RepresentationSpecs from the existing evidence and validation state. It recommends contracts but does not render or invent values.',
    inputSchema: z.object({ question: questionSchema, selected_dataset_ids: z.array(datasetIdSchema).max(20).default([]) }),
    outputSchema: envelopeSchema(z.object({ planId: z.string(), specifications: z.array(z.object({ id: z.string(), type: representationTypeSchema, title: z.string(), method: z.string(), validationState: z.string(), requiredAssessmentIds: z.array(z.string()), inputs: z.array(z.unknown()) })) })),
  }, async ({ question, selected_dataset_ids }) => reply(orchestrator, orchestrator.suggestRepresentations(question, selected_dataset_ids)));

  server.registerTool('build_result', {
    title: 'Build deterministic result',
    description: 'Builds the same serializable RepresentationResult used by the web product. Unsupported or data-blocked views remain explicit and may include a labeled evidence-brief fallback.',
    inputSchema: z.object({ question: questionSchema, selected_dataset_ids: z.array(datasetIdSchema).max(20).default([]), representation_type: representationTypeSchema.optional() }),
    outputSchema: envelopeSchema(z.object({ spec: z.object({ id: z.string(), type: representationTypeSchema, validationState: z.string() }).loose(), result: z.object({ status: z.enum(['ready', 'partial', 'blocked', 'unsupported']), requestedType: representationTypeSchema, validationState: z.string(), claims: z.array(z.unknown()), sources: z.array(z.unknown()), caveats: z.array(z.string()) }).loose() })),
  }, async ({ question, selected_dataset_ids, representation_type }) => reply(orchestrator, await orchestrator.buildResult(question, selected_dataset_ids, representation_type)));
}
