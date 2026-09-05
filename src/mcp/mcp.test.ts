import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDataFitOrchestrator } from '../core/orchestrator';
import { POINTS, TWO_SQUARES } from '../execution/fixtures';
import { buildEvidencePlan } from '../evidence';
import { fallbackDatasets } from '../data/fallback';
import { parseUseCaseIntent } from '../intent';
import { createDataFitMcpServer } from './server';
import { toolNames } from './schemas';

const running = 'Help me understand what data I could use to build a comfortable running-route experience in Basel.';
let client: Client;
let server: ReturnType<typeof createDataFitMcpServer>;

beforeEach(async () => {
  const orchestrator = await createDataFitOrchestrator({ fixtureGeometry: { '100008': POINTS, '100252': TWO_SQUARES } });
  server = createDataFitMcpServer(orchestrator);
  client = new Client({ name: 'datafit-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

afterEach(async () => {
  await client.close();
  await server.close();
});

async function call(name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError).not.toBe(true);
  return result.structuredContent as { data: any; state: Record<string, unknown> };
}

describe('DataFit MCP server', () => {
  it('initializes and registers exactly the product tool surface with JSON schemas', async () => {
    const listed = await client.listTools();
    expect(listed.tools.map(tool => tool.name)).toEqual(toolNames);
    expect(listed.tools.every(tool => tool.inputSchema.type === 'object')).toBe(true);
    expect(listed.tools.every(tool => tool.outputSchema?.type === 'object')).toBe(true);
  });

  it('rejects invalid tool input through the SDK schema boundary', async () => {
    const result = await client.callTool({ name: 'search_datasets', arguments: { query: '', limit: 500 } });
    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual(expect.objectContaining({ text: expect.stringContaining('Input validation error') }));
  });

  it('builds the same evidence plan as the shared web core', async () => {
    const output = await call('build_evidence_plan', { question: running });
    expect(output.data.plan).toEqual(buildEvidencePlan(parseUseCaseIntent(running), fallbackDatasets));
    expect(output.data.planId).toMatch(/^PLN-/);
  });

  it('preserves trusted candidate state, national scope and curation provenance', async () => {
    const output = await call('resolve_missing_evidence', { question: running });
    const candidates = output.data.resolution.roles.flatMap((role: any) => role.candidates);
    expect(candidates).toContainEqual(expect.objectContaining({ resourceId: 'meteoswiss-pollen', status: 'retrievable', scope: 'national', origin: 'system_inference' }));
    expect(candidates.every((candidate: any) => !('compatible' in candidate))).toBe(true);
  });

  it('inspects dataset structure with explicit provenance', async () => {
    const output = await call('inspect_dataset', { dataset_id: '100008', sample: true });
    expect(output.data.structure.observedFrom).toBe('schema');
    expect(output.data.structure.notes.join(' ')).toContain('Fallback mode');
  });

  it('returns stable assessment IDs and explicit executability', async () => {
    const first = await call('assess_compatibility', { left_dataset_id: '100008', right_dataset_id: '100252' });
    const second = await call('assess_compatibility', { left_dataset_id: '100008', right_dataset_id: '100252' });
    expect(first.data.assessment.id).toBe(second.data.assessment.id);
    expect(first.data.assessment.relation).toBe('spatial_join');
    expect(first.data.executable).toBe(true);
  });

  it('executes the fountain/Tempo-30 fixture flow and preserves execution semantics', async () => {
    const assessed = await call('assess_compatibility', { left_dataset_id: '100008', right_dataset_id: '100252' });
    const validated = await call('validate_relationship', { assessment_id: assessed.data.assessment.id });
    expect(validated.data.result.status).toBe('confirmed');
    expect(validated.data.result.evidenceLevel).toBe('execution_validated');
    expect(validated.data.result.output.summary.matchedSourceFeatures).toBe(3);
    const tool = (await client.listTools()).tools.find(item => item.name === 'validate_relationship')!;
    expect(JSON.stringify(tool.outputSchema)).toContain('rejected');
    expect(JSON.stringify(tool.outputSchema)).toContain('partial');
    expect(JSON.stringify(tool.outputSchema)).toContain('failed');
  });

  it('returns renderer-independent representation specs', async () => {
    const output = await call('suggest_representation', { question: running, selected_dataset_ids: ['100052', '100032'] });
    expect(output.data.specifications[0]).toEqual(expect.objectContaining({ type: 'route_comparison', validationState: 'proposed' }));
  });

  it('keeps the running-route result unsupported instead of generating routes', async () => {
    const output = await call('build_result', { question: running, selected_dataset_ids: ['100052', '100032'], representation_type: 'route_comparison' });
    expect(output.data.result.status).toBe('unsupported');
    expect(output.data.result.reason).toContain('no defensible routable network');
    expect(output.data.result.fallback.renderer).toBe('evidence_brief');
  });

  it('builds a renderable fixture-backed map after confirmed fountain containment', async () => {
    const assessed = await call('assess_compatibility', { left_dataset_id: '100008', right_dataset_id: '100252' });
    await call('validate_relationship', { assessment_id: assessed.data.assessment.id });
    const output = await call('build_result', { question: 'How many fountains fall inside Tempo-30 areas?', selected_dataset_ids: ['100008', '100252'], representation_type: 'relationship_map' });
    expect(output.data.result).toEqual(expect.objectContaining({ status: 'ready', renderer: 'map', validationState: 'validated' }));
    expect(output.data.result.claims).toContainEqual(expect.objectContaining({ status: 'confirmed', evidenceLevel: 'execution_validated' }));
  });

  it('keeps all ordinary server calls offline and reports in-memory state', async () => {
    const output = await call('search_datasets', { query: 'trees and fountains', limit: 4 });
    expect(output.data.matches).toHaveLength(4);
    expect(output.state).toEqual(expect.objectContaining({ catalogueSource: 'fallback', persistence: 'in_memory' }));
  });
});
