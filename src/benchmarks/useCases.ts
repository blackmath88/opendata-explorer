export interface UseCaseBenchmark {
  id: string;
  prompt: string;
  expectedDomains: string[];
  expectedSpatialNeed: boolean;
  expectedRoleIds: string[];
  expectedMissingRoleIds?: string[];
}

export const useCaseBenchmarks: UseCaseBenchmark[] = [
  {
    id:'running-comfort',
    prompt:'I want to build a running route planner that prefers shade and clean air, avoids heavy traffic, shows fountains and warns about construction.',
    expectedDomains:['mobility','environment','infrastructure'],
    expectedSpatialNeed:true,
    expectedRoleIds:['route-geometry','canopy','air-quality','traffic','water','construction'],
  },
  {
    id:'urban-heat',
    prompt:'Where should Basel prioritise trees or shade interventions to reduce heat exposure for pedestrians?',
    expectedDomains:['climate','environment','mobility'],
    expectedSpatialNeed:true,
    expectedRoleIds:['canopy'],
  },
  {
    id:'cycling',
    prompt:'Which data could help identify dangerous or uncomfortable cycling corridors with heavy traffic and poor air quality?',
    expectedDomains:['mobility','environment'],
    expectedSpatialNeed:true,
    expectedRoleIds:['route-geometry','air-quality','traffic'],
  },
  {
    id:'fountain-access',
    prompt:'Which neighbourhoods in Basel have poor access to public drinking fountains?',
    expectedDomains:['infrastructure','population'],
    expectedSpatialNeed:true,
    expectedRoleIds:['water'],
  },
  {
    id:'construction-mobility',
    prompt:'How can we understand the current combined impact of construction activity on mobility in Basel?',
    expectedDomains:['mobility','infrastructure'],
    expectedSpatialNeed:true,
    expectedRoleIds:['route-geometry','construction'],
  },
  {
    id:'school-environment',
    prompt:'Which environmental datasets could help assess heat, air quality and traffic conditions around schools?',
    expectedDomains:['environment','climate','infrastructure','mobility'],
    expectedSpatialNeed:true,
    expectedRoleIds:['air-quality','traffic'],
  },
];
