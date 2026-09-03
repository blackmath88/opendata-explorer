import type {
  DatasetRecord,
  EvidenceClass,
  EvidencePlan,
  EvidenceRoleType,
  PlannedRole,
  UseCaseIntent,
} from './types';
import { conceptById, matchesCatalogueTerm } from './vocabulary';
import { geometryClasses, type GeometryClass } from './geometry';

/**
 * Deterministic evidence planning.
 *
 * The plan answers "what jobs need doing in this analysis?" before it answers
 * "which dataset is relevant?". Roles come from the parsed intent through a
 * fixed template table; datasets are then matched into those slots.
 *
 * Everything produced here is `system_inference`. It is a proposal, and the UI
 * must label it as one — it is not a statement by the data publisher.
 */

interface RoleTemplate {
  id: string;
  label: string;
  roleType: EvidenceRoleType;
  required: boolean;
  reason: string;
  /** Domain concepts whose catalogue terms identify a candidate. */
  concepts: string[];
  /** Geometry the role needs to do its job. */
  geometry?: GeometryClass | 'any';
  /** Only include the role when the intent mentions one of these concepts. */
  when?: string[];
  /**
   * Terms that disqualify a candidate outright. Used for domain distinctions
   * the concept vocabulary is too coarse to make — water-body temperature is
   * not air temperature, however similar the words are.
   */
  excludeTerms?: string[];
  /**
   * Set when we already know the catalogue cannot serve this role. The plan
   * still shows the slot — a missing input is part of the method.
   */
  externalSuggestion?: string;
}

const ROUTE_BACKBONE: RoleTemplate = {
  id: 'route_geometry',
  label: 'Route / path geometry',
  roleType: 'analysis_backbone',
  required: true,
  reason:
    'Every other measure is attached to a line network. Basel publishes street and cycle-route lines; a running-specific path network would come from OpenStreetMap.',
  concepts: ['network', 'cycling', 'walking'],
  geometry: 'line',
  externalSuggestion:
    'An OpenStreetMap foot/path network (Overpass or a routing engine), which Basel-Stadt does not publish.',
};

const TEMPLATES: Record<string, RoleTemplate[]> = {
  route_planner: [
    ROUTE_BACKBONE,
    {
      id: 'shade_exposure',
      label: 'Shade / canopy exposure',
      roleType: 'primary_measure',
      required: true,
      reason: 'Turns "prefers shade" into a measurable share of the route under tree cover.',
      concepts: ['shade'],
      geometry: 'any',
      when: ['shade', 'heat'],
    },
    {
      id: 'air_exposure',
      label: 'Air-quality exposure',
      roleType: 'primary_measure',
      required: true,
      reason: 'Turns "clean air" into a measured pollutant exposure along the route.',
      concepts: ['air_quality'],
      geometry: 'any',
      when: ['air_quality'],
    },
    {
      id: 'traffic_context',
      label: 'Traffic volume / speed context',
      roleType: 'context',
      required: false,
      reason: 'Traffic load and speed are the usual proxy for how stressful a segment feels.',
      concepts: ['traffic', 'speed'],
      when: ['traffic', 'speed', 'safety', 'noise'],
    },
    {
      id: 'water_access',
      label: 'Drinking-water points',
      roleType: 'context',
      required: false,
      reason: 'Amenity layer: fountains within a short distance of the route.',
      concepts: ['water_access'],
      geometry: 'point',
      when: ['water_access'],
    },
    {
      id: 'construction_constraint',
      label: 'Construction constraint',
      roleType: 'constraint',
      required: false,
      reason: 'Temporarily removes or penalises segments; it constrains the result rather than measuring it.',
      concepts: ['construction'],
      geometry: 'any',
      when: ['construction'],
    },
    {
      id: 'elevation_context',
      label: 'Elevation / effort',
      roleType: 'context',
      required: false,
      reason: 'Climb is a first-order determinant of effort on a running or cycling route.',
      concepts: ['elevation'],
      externalSuggestion: 'A terrain model (swisstopo swissALTI3D or an OpenStreetMap elevation service).',
    },
    {
      id: 'allergen_exposure',
      label: 'Pollen / allergen exposure',
      roleType: 'external_dependency',
      required: false,
      reason:
        'Proposed by the system, not requested: pollen is a standard comfort factor for outdoor exercise and is absent from this catalogue.',
      concepts: ['pollen'],
      externalSuggestion: 'MeteoSwiss or aha! Swiss Allergy Centre pollen forecast API.',
    },
  ],

  intervention_prioritisation: [
    {
      id: 'target_geography',
      label: 'Target geography',
      roleType: 'geography',
      required: true,
      reason: 'Prioritisation needs comparable units — streets, blocks or statistical areas — to rank.',
      concepts: ['geography', 'network'],
      geometry: 'any',
    },
    {
      id: 'heat_measure',
      label: 'Heat / temperature measure',
      roleType: 'primary_measure',
      required: true,
      reason:
        'Proposed by the system: shading interventions are prioritised against measured heat exposure, even when the question only mentions trees.',
      concepts: ['heat'],
      excludeTerms: ['grundwasser', 'gewässer', 'gartenb', 'wiese', 'birs', 'rhein'],
      when: ['heat', 'shade'],
    },
    {
      id: 'canopy_measure',
      label: 'Existing canopy / tree cover',
      roleType: 'primary_measure',
      required: true,
      reason: 'The intervention gap is the difference between current and desired tree cover.',
      concepts: ['shade'],
      when: ['shade', 'heat', 'green_space'],
    },
    {
      id: 'exposed_population',
      label: 'Exposed population',
      roleType: 'denominator',
      required: false,
      reason: 'Ranks by people affected rather than by area, which changes the answer substantially.',
      concepts: ['population'],
    },
    {
      id: 'surface_context',
      label: 'Surface / land-use context',
      roleType: 'context',
      required: false,
      reason: 'Sealed surface and building density explain why a place is hot and whether planting is feasible.',
      concepts: ['buildings', 'green_space'],
    },
    {
      id: 'surface_temperature',
      label: 'Land-surface temperature',
      roleType: 'validation',
      required: false,
      reason: 'Independent check on a modelled heat ranking.',
      concepts: ['heat'],
      excludeTerms: ['grundwasser', 'gewässer', 'gartenb', 'wiese', 'birs', 'rhein'],
      externalSuggestion: 'Landsat/Sentinel land-surface-temperature raster, or a cantonal climate-analysis map.',
    },
  ],

  risk_screening: [
    {
      id: 'screened_network',
      label: 'Network being screened',
      roleType: 'analysis_backbone',
      required: true,
      reason: 'Risk is scored per segment, so a line network defines the unit of analysis.',
      concepts: ['network', 'cycling', 'walking'],
      geometry: 'line',
    },
    {
      id: 'incident_measure',
      label: 'Recorded incidents',
      roleType: 'primary_measure',
      required: true,
      reason: 'Observed accidents are the only directly measured risk signal in the catalogue.',
      concepts: ['safety'],
      geometry: 'point',
    },
    {
      id: 'exposure_denominator',
      label: 'Exposure denominator',
      roleType: 'denominator',
      required: true,
      reason: 'Raw incident counts follow traffic volume; without counts the ranking measures popularity, not danger.',
      concepts: ['cycling', 'walking', 'traffic'],
    },
    {
      id: 'speed_context',
      label: 'Speed and traffic context',
      roleType: 'context',
      required: false,
      reason: 'Speed and motorised volume explain why a segment is uncomfortable even without incidents.',
      concepts: ['speed', 'traffic'],
    },
    {
      id: 'infrastructure_quality',
      label: 'Infrastructure quality',
      roleType: 'context',
      required: false,
      reason: 'Published suitability or comfort ratings for the network being screened.',
      concepts: ['cycling', 'network'],
    },
    {
      id: 'perceived_risk',
      label: 'Perceived risk / near misses',
      roleType: 'external_dependency',
      required: false,
      reason: '"Uncomfortable" is a perception; recorded collisions do not capture it.',
      concepts: [],
      externalSuggestion: 'A reporting platform such as Bikeable, or a local survey.',
    },
  ],

  access_gap_analysis: [
    {
      id: 'amenity_locations',
      label: 'Amenity locations',
      roleType: 'primary_measure',
      required: true,
      reason: 'The thing whose access is being measured.',
      concepts: ['water_access', 'green_space', 'seating'],
      geometry: 'any',
    },
    {
      id: 'demand_geography',
      label: 'Demand geography',
      roleType: 'geography',
      required: true,
      reason: 'Access is only meaningful relative to where people are.',
      concepts: ['geography', 'buildings'],
      geometry: 'any',
    },
    {
      id: 'population_denominator',
      label: 'Population denominator',
      roleType: 'denominator',
      required: false,
      reason: 'Converts "far from a fountain" into "how many people are far from a fountain".',
      concepts: ['population'],
    },
    {
      id: 'walking_network',
      label: 'Walking network',
      roleType: 'analysis_backbone',
      required: false,
      reason: 'Straight-line distance overstates access; a walkable network gives real catchments.',
      concepts: ['walking', 'network'],
      geometry: 'line',
    },
  ],

  impact_assessment: [
    {
      id: 'disruption_source',
      label: 'Disruption source',
      roleType: 'primary_measure',
      required: true,
      reason: 'The activity whose impact is being assessed, with its own time window.',
      concepts: ['construction'],
    },
    {
      id: 'affected_network',
      label: 'Affected network',
      roleType: 'analysis_backbone',
      required: true,
      reason: 'Impact propagates along the network the disruption sits on.',
      concepts: ['network', 'mobility'],
      geometry: 'line',
    },
    {
      id: 'mobility_measure',
      label: 'Mobility measurement',
      roleType: 'primary_measure',
      required: true,
      reason: 'Counts before, during and after the disruption are what make the impact observable.',
      concepts: ['traffic', 'cycling', 'walking'],
    },
    {
      id: 'baseline_validation',
      label: 'Baseline / control period',
      roleType: 'validation',
      required: false,
      reason: 'Separates the disruption effect from seasonal and weather variation.',
      concepts: ['traffic', 'mobility'],
    },
    {
      id: 'closure_geometry',
      label: 'Closure and detour geometry',
      roleType: 'external_dependency',
      required: false,
      reason: 'Impact needs the extent of each closure, not just that a project exists.',
      concepts: ['construction'],
      externalSuggestion: 'Traffic-management / detour geometry from the roadworks permit system.',
    },
  ],

  condition_assessment: [
    {
      id: 'assessment_sites',
      label: 'Sites being assessed',
      roleType: 'geography',
      required: true,
      reason: 'The locations whose conditions are being described.',
      concepts: ['schools', 'buildings', 'green_space'],
      geometry: 'any',
    },
    {
      id: 'air_condition',
      label: 'Air-quality condition',
      roleType: 'primary_measure',
      required: true,
      reason: 'Standard environmental indicator for outdoor conditions at a site.',
      concepts: ['air_quality'],
      geometry: 'any',
    },
    {
      id: 'noise_condition',
      label: 'Noise condition',
      roleType: 'primary_measure',
      required: false,
      reason: 'The second standard environmental indicator, and often the binding one near schools.',
      concepts: ['noise'],
    },
    {
      id: 'traffic_pressure',
      label: 'Traffic pressure',
      roleType: 'context',
      required: false,
      reason: 'Explains the measured exposure and points to an intervention.',
      concepts: ['traffic', 'speed'],
    },
    {
      id: 'green_context',
      label: 'Green / canopy context',
      roleType: 'context',
      required: false,
      reason: 'Shade and greenery are part of environmental conditions at a site.',
      concepts: ['shade', 'green_space'],
    },
    {
      id: 'site_level_measurement',
      label: 'Site-level measurement',
      roleType: 'external_dependency',
      required: false,
      reason: 'Cantonal stations describe the city, not one schoolyard; a site claim needs local measurement.',
      concepts: [],
      externalSuggestion: 'Dedicated sensors at the sites, or a modelled dispersion/noise map at street resolution.',
    },
  ],
};

/** One title-level concept hit is the minimum evidence for a proposal. */
const PROPOSAL_THRESHOLD = 14;
/**
 * A role we already believe needs an outside source has to be *convincingly*
 * matched before a catalogue dataset displaces that judgement.
 */
const EXTERNAL_ROLE_THRESHOLD = 26;
/** One hit per concept, so a compound German title cannot inflate its score. */
const TITLE_HIT = 14;
const TEXT_HIT = 4;
/**
 * A template lists its concepts most-important-first; later concepts are worth
 * a little less so the author's ordering actually decides close calls.
 */
const CONCEPT_DECAY = 4;
/**
 * How much of the title the match accounts for. "Schulstandorte" is about
 * schools; "Überwachung Luftqualität Sanierung Areal Walkeweg" merely mentions
 * an Areal. Rewarding that ratio keeps incidental mentions from winning.
 */
const SPECIFICITY_BONUS = 8;
const GEOMETRY_FIT = 12;
const WORKSPACE_BONUS = 30;
/**
 * A dataset already assigned to an earlier role is penalised so the plan
 * prefers distinct evidence per role, while still allowing genuine reuse.
 */
const REUSE_PENALTY = 20;
const MAX_CANDIDATES = 4;

export interface PlanOptions {
  /** Datasets the user put in the workspace; these outrank system proposals. */
  selectedIds?: string[];
}

export function buildEvidencePlan(
  intent: UseCaseIntent,
  datasets: DatasetRecord[],
  options: PlanOptions = {},
): EvidencePlan {
  const selected = new Set(options.selectedIds ?? []);
  const templates = templatesFor(intent);
  // Resolved in declaration order: required roles claim their dataset first.
  const assigned = new Set<string>();
  const roles = templates.map(template => {
    const role = resolveRole(template, datasets, selected, assigned);
    if (role.datasetId) assigned.add(role.datasetId);
    return role;
  });

  return {
    intent,
    roles,
    unresolved: roles.filter(role => role.required && !role.datasetId),
    externalDependencies: roles.filter(role => role.gap?.kind === 'not_in_catalogue'),
  };
}

/**
 * Pick the template set for the parsed intent, dropping roles whose triggering
 * concept was never mentioned. An unrecognised outcome falls back to a generic
 * plan built from the mentioned concepts rather than guessing a method.
 */
function templatesFor(intent: UseCaseIntent): RoleTemplate[] {
  const hints = new Set(intent.domainHints);
  const base = intent.desiredOutcome ? TEMPLATES[intent.desiredOutcome] : undefined;
  const templates = base ?? genericTemplates(intent);
  return templates.filter(template => !template.when || template.when.some(hint => hints.has(hint)));
}

/** Fallback plan: one context role per mentioned concept, plus a geography slot. */
function genericTemplates(intent: UseCaseIntent): RoleTemplate[] {
  const templates: RoleTemplate[] = [];
  if (intent.spatialNeed) {
    templates.push({
      id: 'target_geography',
      label: 'Target geography',
      roleType: 'geography',
      required: true,
      reason: 'The question is spatial, so results need a geographic unit to attach to.',
      concepts: ['geography', 'network'],
      geometry: 'any',
    });
  }
  for (const hint of intent.domainHints) {
    const concept = conceptById(hint);
    if (!concept) continue;
    templates.push({
      id: `${hint}_evidence`,
      label: concept.label,
      roleType: 'context',
      required: false,
      reason: `Mentioned in the question; no method template matched, so this is proposed as context only.`,
      concepts: [hint],
    });
  }
  return templates;
}

interface ScoredCandidate {
  datasetId: string;
  title: string;
  score: number;
  note: string;
  eligible: boolean;
}

function resolveRole(
  template: RoleTemplate,
  datasets: DatasetRecord[],
  selected: Set<string>,
  assigned: Set<string>,
): PlannedRole {
  const scored = datasets
    .map(dataset => scoreCandidate(template, dataset, selected, assigned))
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  const threshold =
    template.roleType === 'external_dependency' ? EXTERNAL_ROLE_THRESHOLD : PROPOSAL_THRESHOLD;
  const eligible = scored.filter(candidate => candidate.eligible && candidate.score >= threshold);
  const rejected = scored.filter(candidate => !candidate.eligible).slice(0, 2);
  const best = eligible[0];

  const role: PlannedRole = {
    id: template.id,
    label: template.label,
    roleType: template.roleType,
    datasetId: best?.datasetId,
    required: template.required,
    reason: template.reason,
    candidates: [...eligible.slice(0, MAX_CANDIDATES), ...rejected].map(
      ({ datasetId, title, score, note }) => ({ datasetId, title, score, note }),
    ),
    origin: 'system_inference',
  };

  if (!best) {
    role.gap = {
      kind: template.externalSuggestion || !scored.length ? 'not_in_catalogue' : 'no_candidate_selected',
      suggestion: template.externalSuggestion,
    };
  } else if (template.externalSuggestion) {
    // A catalogue dataset exists but the role was still flagged as externally
    // served; keep the suggestion visible rather than silently dropping it.
    role.gap = { kind: 'no_candidate_selected', suggestion: template.externalSuggestion };
  }

  return role;
}

function scoreCandidate(
  template: RoleTemplate,
  dataset: DatasetRecord,
  selected: Set<string>,
  assigned: Set<string>,
): ScoredCandidate {
  const title = dataset.title.toLowerCase();
  if (template.excludeTerms?.some(term => title.includes(term))) {
    return { datasetId: dataset.id, title: dataset.title, score: 0, note: '', eligible: false };
  }

  let score = 0;
  const matchedTerms: string[] = [];
  const titleTerms: string[] = [];

  // At most one hit per concept. Scoring per term would reward German compound
  // titles ("Strassen und Wege: Durchgangsstrassen") for saying one thing three
  // times.
  template.concepts.forEach((conceptId, index) => {
    const concept = conceptById(conceptId);
    if (!concept) return;
    const decay = index * CONCEPT_DECAY;
    const inTitle = concept.catalogueTerms.filter(term => matchesCatalogueTerm(title, term));
    const inText = concept.catalogueTerms.filter(term => matchesCatalogueTerm(dataset.searchText, term));
    if (inTitle.length) {
      score += Math.max(TITLE_HIT - decay, TEXT_HIT + 2);
      matchedTerms.push(...inTitle);
      titleTerms.push(...inTitle);
    } else if (inText.length) {
      score += Math.max(TEXT_HIT - index, 2);
      matchedTerms.push(...inText);
    }
  });

  // Reward how much of the title the match actually accounts for.
  const longestTitleTerm = titleTerms.reduce((longest, term) => Math.max(longest, term.length), 0);
  if (longestTitleTerm) {
    const specificity = longestTitleTerm / Math.max(title.length, 1);
    score += Math.min(SPECIFICITY_BONUS, Math.round(SPECIFICITY_BONUS * specificity * 2));
  }

  if (score === 0) {
    return { datasetId: dataset.id, title: dataset.title, score: 0, note: '', eligible: false };
  }

  let eligible = true;
  let note = matchedTerms.length ? `Matches ${[...new Set(matchedTerms)].slice(0, 3).join(', ')}.` : '';

  // Structural eligibility. These are the checks that stop a semantically
  // perfect title from being accepted as analytical evidence.
  if (!dataset.hasRecords || dataset.recordsCount === 0) {
    eligible = false;
    note = 'The catalogue publishes this dataset with no records, so it cannot support the role.';
  } else if (template.geometry && template.geometry !== 'any') {
    const classes = geometryClasses(dataset.characteristics.geometryTypes);
    if (!classes.length) {
      eligible = false;
      note = `No geometry is declared, so it cannot serve as ${template.label.toLowerCase()}.`;
    } else if (!classes.includes(template.geometry)) {
      eligible = false;
      note = `Declares ${classes.join('/')} geometry where this role needs ${template.geometry}.`;
    } else {
      score += GEOMETRY_FIT;
    }
  } else if (template.geometry === 'any') {
    if (dataset.characteristics.geospatial) score += GEOMETRY_FIT;
    else {
      eligible = false;
      note = 'No geometry is declared, so it cannot be placed on the map this role needs.';
    }
  }

  if (selected.has(dataset.id)) score += WORKSPACE_BONUS;
  else if (assigned.has(dataset.id)) score -= REUSE_PENALTY;

  return { datasetId: dataset.id, title: dataset.title, score, note, eligible };
}

/**
 * Deterministic evidence class for one dataset given a plan.
 *
 *   direct      fills a required role
 *   supporting  fills an optional role
 *   contextual  relevant to the question but not part of the method
 *   missing     never applies to a dataset; it describes an unfilled role
 */
export function classifyEvidence(
  datasetId: string,
  plan: EvidencePlan,
): { evidenceClass: EvidenceClass; roleIds: string[] } {
  const roles = plan.roles.filter(role => role.datasetId === datasetId);
  const roleIds = roles.map(role => role.id);
  if (roles.some(role => role.required)) return { evidenceClass: 'direct', roleIds };
  if (roles.length) return { evidenceClass: 'supporting', roleIds };
  return { evidenceClass: 'contextual', roleIds };
}
