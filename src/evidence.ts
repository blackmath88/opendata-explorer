import type { DatasetMatch, EvidenceRole, UseCaseIntent } from './types';

interface RoleRule {
  id: string;
  label: string;
  roleType: EvidenceRole['roleType'];
  terms: string[];
  required: boolean;
  reason: string;
}

const ROLE_RULES: RoleRule[] = [
  { id:'route-geometry', label:'Route geometry', roleType:'analysis_backbone', terms:['route','street network','road network'], required:true, reason:'Provides the geometry against which route-level evidence is evaluated.' },
  { id:'canopy', label:'Shade / canopy', roleType:'primary_measure', terms:['canopy','tree canopy','shade','baumkron'], required:false, reason:'Directly measures or proxies shade exposure.' },
  { id:'air-quality', label:'Air quality', roleType:'primary_measure', terms:['air quality','pollution','no2','pm2.5','ozone','luft'], required:false, reason:'Measures environmental exposure relevant to health and comfort.' },
  { id:'traffic', label:'Traffic environment', roleType:'context', terms:['traffic','speed','verkehr','vehicle'], required:false, reason:'Adds road-stress and exposure context.' },
  { id:'water', label:'Water access', roleType:'context', terms:['fountain','water','brunnen'], required:false, reason:'Adds amenity access along a route or within an area.' },
  { id:'construction', label:'Construction / disruption', roleType:'constraint', terms:['construction','roadworks','baustell'], required:false, reason:'Constrains candidate routes or areas affected by active works.' },
  { id:'elevation', label:'Elevation / gradient', roleType:'context', terms:['elevation','height','gradient','slope','höhe'], required:false, reason:'Explains physical difficulty and terrain variation.' },
  { id:'pollen', label:'Pollen', roleType:'external_dependency', terms:['pollen'], required:false, reason:'Potential environmental exposure not guaranteed to exist in the source catalogue.' },
];

function searchable(match: DatasetMatch): string {
  const d=match.dataset;
  return [d.title,d.description,d.publisher,...d.themes,...d.keywords,...d.semantic.topics,...d.semantic.possibleUses].join(' ').toLowerCase();
}

function bestMatch(rule: RoleRule, matches: DatasetMatch[]): DatasetMatch | undefined {
  return matches
    .filter(m=>rule.terms.some(t=>searchable(m).includes(t)))
    .sort((a,b)=>b.relevance.score-a.relevance.score)[0];
}

export function buildEvidencePlan(intent: UseCaseIntent, matches: DatasetMatch[]): EvidenceRole[] {
  const text=intent.statement.toLowerCase();
  const relevantRules=ROLE_RULES.filter(rule=>rule.required || rule.terms.some(t=>text.includes(t)) || (rule.id==='route-geometry' && intent.spatialNeed));

  return relevantRules.map(rule=>{
    const match=bestMatch(rule,matches);
    if(match){
      const evidenceClass = rule.roleType==='primary_measure' || rule.roleType==='analysis_backbone' ? 'direct' : rule.roleType==='constraint' ? 'supporting' : 'contextual';
      return { id:rule.id,label:rule.label,roleType:rule.roleType,datasetId:match.dataset.id,required:rule.required,reason:rule.reason,evidenceClass,inferred:true };
    }
    return {
      id:rule.id,label:rule.label,roleType:rule.roleType==='external_dependency'?'external_dependency':'missing',required:rule.required,reason:`${rule.reason} No matching catalogue evidence was identified.`,evidenceClass:'missing',inferred:true,
    };
  });
}
