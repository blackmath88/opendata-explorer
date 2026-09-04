import { createDataFitOrchestrator } from '../core/orchestrator';
import { POINTS, TWO_SQUARES } from '../execution/fixtures';

const orchestrator = await createDataFitOrchestrator({ fixtureGeometry: { '100008': POINTS, '100252': TWO_SQUARES } });

const runningQuestion = 'Help me understand what data I could use to build a comfortable running-route experience in Basel.';
const runningPlan = orchestrator.buildPlan(runningQuestion);
const runningResolution = orchestrator.resolveEvidence({ planId: runningPlan.planId });
const runningResult = await orchestrator.buildResult(runningQuestion, ['100052', '100032'], 'route_comparison');

const fountainQuestion = 'How many public fountains fall inside Basel Tempo-30 areas?';
await orchestrator.inspectDataset('100008');
await orchestrator.inspectDataset('100252');
const assessed = await orchestrator.checkCompatibility('100008', '100252');
const validated = await orchestrator.validateRelationship(assessed.assessment.id);
const fountainResult = await orchestrator.buildResult(fountainQuestion, ['100008', '100252'], 'relationship_map');

process.stdout.write(`${JSON.stringify({
  runningRoute: {
    planId: runningPlan.planId,
    trustedCandidates: runningResolution.resolution.roles.flatMap(role => role.candidates.map(candidate => ({ roleId: role.roleId, resourceId: candidate.resourceId, status: candidate.status }))),
    resultStatus: runningResult.result.status,
    blockedReason: runningResult.result.reason,
    fallbackRenderer: runningResult.result.fallback?.renderer,
  },
  fountainTempo30: {
    assessmentId: assessed.assessment.id,
    relation: assessed.assessment.relation,
    executionId: validated.result.id,
    executionStatus: validated.result.status,
    metrics: validated.result.output?.summary,
    resultStatus: fountainResult.result.status,
    renderer: fountainResult.result.renderer,
  },
  state: orchestrator.stateSummary(),
}, null, 2)}\n`);
