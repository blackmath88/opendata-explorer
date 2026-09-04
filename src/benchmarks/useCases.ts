import type { EvidenceRoleType, TemporalNeed } from '../types';

/**
 * Canonical use cases used both as clickable examples in the UI and as the
 * regression fixtures for intent parsing and evidence planning.
 *
 * Expectations are deliberately structural and semantic rather than numeric.
 * Asserting an exact relevance score would make the suite fail every time the
 * catalogue changes, which teaches nothing; asserting that "a required
 * analysis backbone with line geometry exists, and pollen is reported as a gap"
 * is the behaviour we actually care about.
 */
export interface RoleExpectation {
  /** Role slot id the plan must contain. */
  id: string;
  roleType: EvidenceRoleType;
  required: boolean;
  /**
   * `resolved`   a catalogue dataset must fill it
   * `gap`        no catalogue dataset may fill it
   * `either`     both outcomes are acceptable and the test only checks presence
   */
  expect: 'resolved' | 'gap' | 'either';
  /**
   * Case-insensitive pattern the resolved dataset's title must match. Written
   * as a pattern rather than a substring because Basel titles inflect
   * ("Unfall" / "Unfälle") and an exact string would be brittle for no gain.
   */
  titlePattern?: string;
}

export interface BenchmarkUseCase {
  id: string;
  label: string;
  prompt: string;
  expectedHints: string[];
  expectedOutcome: string;
  expectedSpatialNeed: boolean;
  expectedTemporalNeed?: TemporalNeed;
  expectedConstraints?: string[];
  roles: RoleExpectation[];
  /** Dataset titles a defensible shortlist should surface. */
  expectedShortlist: string[];
  /** Evidence the Basel catalogue is known not to hold. */
  knownGaps: string[];
}

export const BENCHMARK_USE_CASES: BenchmarkUseCase[] = [
  {
    id: 'running',
    label: 'Running comfort',
    prompt:
      'Build a comfortable running route in Basel with shade, clean air, fountains, low traffic and sensible effort, and warn about construction.',
    expectedHints: ['running', 'network', 'shade', 'air_quality', 'traffic', 'construction', 'water_access'],
    expectedOutcome: 'route_planner',
    expectedSpatialNeed: true,
    expectedConstraints: ['avoid:traffic', 'prefer:shade', 'warn:construction'],
    roles: [
      { id: 'route_geometry', roleType: 'analysis_backbone', required: true, expect: 'either' },
      { id: 'shade_exposure', roleType: 'primary_measure', required: true, expect: 'resolved', titlePattern: 'baum' },
      { id: 'air_exposure', roleType: 'primary_measure', required: true, expect: 'resolved' },
      { id: 'traffic_context', roleType: 'context', required: false, expect: 'resolved' },
      { id: 'water_access', roleType: 'context', required: false, expect: 'resolved', titlePattern: 'brunnen' },
      { id: 'construction_constraint', roleType: 'constraint', required: false, expect: 'either' },
      { id: 'elevation_context', roleType: 'context', required: false, expect: 'gap' },
      { id: 'allergen_exposure', roleType: 'external_dependency', required: false, expect: 'gap' },
    ],
    expectedShortlist: ['Baumkataster', 'Brunnen', 'Luftqualität'],
    knownGaps: ['pollen', 'elevation model', 'running-specific path network'],
  },
  {
    id: 'urban_heat',
    label: 'Urban heat',
    prompt: 'Where would additional trees or shading interventions have the biggest impact?',
    expectedHints: ['shade'],
    expectedOutcome: 'intervention_prioritisation',
    expectedSpatialNeed: true,
    roles: [
      { id: 'target_geography', roleType: 'geography', required: true, expect: 'resolved' },
      { id: 'heat_measure', roleType: 'primary_measure', required: true, expect: 'resolved' },
      { id: 'canopy_measure', roleType: 'primary_measure', required: true, expect: 'resolved', titlePattern: 'baum' },
      { id: 'exposed_population', roleType: 'denominator', required: false, expect: 'either' },
      { id: 'surface_temperature', roleType: 'validation', required: false, expect: 'either' },
    ],
    expectedShortlist: ['Baumkataster', 'Klima'],
    knownGaps: ['land-surface temperature raster'],
  },
  {
    id: 'cycling_safety',
    label: 'Cycling safety',
    prompt: 'Which datasets could help identify dangerous or uncomfortable cycling corridors?',
    expectedHints: ['cycling', 'network', 'safety'],
    expectedOutcome: 'risk_screening',
    expectedSpatialNeed: true,
    roles: [
      { id: 'screened_network', roleType: 'analysis_backbone', required: true, expect: 'resolved' },
      { id: 'incident_measure', roleType: 'primary_measure', required: true, expect: 'resolved', titlePattern: 'unf(a|ä)ll' },
      { id: 'exposure_denominator', roleType: 'denominator', required: true, expect: 'resolved' },
      { id: 'perceived_risk', roleType: 'external_dependency', required: false, expect: 'gap' },
    ],
    expectedShortlist: ['Strassenverkehrsunfälle', 'Velo'],
    knownGaps: ['perceived risk / near-miss reports'],
  },
  {
    id: 'fountain_access',
    label: 'Public fountain access',
    prompt: 'Where is access to public fountains, benches or green spaces weakest?',
    expectedHints: ['water_access', 'green_space', 'seating'],
    expectedOutcome: 'access_gap_analysis',
    expectedSpatialNeed: true,
    roles: [
      { id: 'amenity_locations', roleType: 'primary_measure', required: true, expect: 'resolved', titlePattern: 'brunnen' },
      { id: 'demand_geography', roleType: 'geography', required: true, expect: 'resolved' },
      { id: 'population_denominator', roleType: 'denominator', required: false, expect: 'either' },
      { id: 'walking_network', roleType: 'analysis_backbone', required: false, expect: 'either' },
    ],
    expectedShortlist: ['Brunnen'],
    knownGaps: ['public benches inventory'],
  },
  {
    id: 'public_service_equity',
    label: 'Public-service access equity',
    prompt: 'Where is access to public fountains or green spaces weakest, especially for underserved neighbourhoods?',
    expectedHints: ['water_access', 'green_space'],
    expectedOutcome: 'access_gap_analysis',
    expectedSpatialNeed: true,
    roles: [
      { id: 'amenity_locations', roleType: 'primary_measure', required: true, expect: 'resolved', titlePattern: 'brunnen' },
      { id: 'demand_geography', roleType: 'geography', required: true, expect: 'resolved' },
      { id: 'population_denominator', roleType: 'denominator', required: false, expect: 'either' },
      { id: 'walking_network', roleType: 'analysis_backbone', required: false, expect: 'either' },
    ],
    expectedShortlist: ['Brunnen'],
    knownGaps: ['fine-grained population denominator', 'validated walking accessibility'],
  },
  {
    id: 'construction_mobility',
    label: 'Construction impact',
    prompt: 'How could we understand the combined impact of construction activity on mobility?',
    expectedHints: ['construction', 'mobility'],
    expectedOutcome: 'impact_assessment',
    expectedSpatialNeed: true,
    roles: [
      { id: 'disruption_source', roleType: 'primary_measure', required: true, expect: 'resolved' },
      { id: 'affected_network', roleType: 'analysis_backbone', required: true, expect: 'resolved' },
      { id: 'mobility_measure', roleType: 'primary_measure', required: true, expect: 'resolved' },
      { id: 'closure_geometry', roleType: 'external_dependency', required: false, expect: 'either' },
    ],
    expectedShortlist: ['Verkehrszähldaten'],
    knownGaps: ['closure and detour geometry'],
  },
  {
    id: 'school_conditions',
    label: 'School environment',
    prompt: 'Which environmental datasets could help assess conditions around schools?',
    expectedHints: ['schools'],
    expectedOutcome: 'condition_assessment',
    expectedSpatialNeed: true,
    roles: [
      { id: 'assessment_sites', roleType: 'geography', required: true, expect: 'resolved', titlePattern: 'schul' },
      { id: 'air_condition', roleType: 'primary_measure', required: true, expect: 'resolved' },
      { id: 'noise_condition', roleType: 'primary_measure', required: false, expect: 'either' },
      { id: 'site_level_measurement', roleType: 'external_dependency', required: false, expect: 'gap' },
    ],
    expectedShortlist: ['Schulstandorte'],
    knownGaps: ['school-site level measurement', 'Schulwegsicherheit datasets are published with zero records'],
  },
];
