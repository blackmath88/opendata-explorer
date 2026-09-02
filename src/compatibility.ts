import type { CompatibilityAssessment, DatasetStructure } from './types';

function norm(s:string){return s.toLowerCase().replace(/[^a-z0-9]+/g,'');}
function evidenceLevel(a:DatasetStructure,b:DatasetStructure):CompatibilityAssessment['evidenceLevel']{
  if(a.observedFrom==='sample_records'&&b.observedFrom==='sample_records')return 'sample_validated';
  if(a.observedFrom!=='catalog_metadata'||b.observedFrom!=='catalog_metadata')return 'schema_observed';
  return 'metadata_only';
}

export function assessCompatibility(left:DatasetStructure,right:DatasetStructure):CompatibilityAssessment{
  const reasons:string[]=[];const warnings:string[]=[];
  const commonKeys:Array<{left:string;right:string}>=[];
  for(const l of left.candidateKeys){for(const r of right.candidateKeys){if(norm(l)===norm(r))commonKeys.push({left:l,right:r});}}
  const level=evidenceLevel(left,right);

  if(commonKeys.length){
    reasons.push(`Candidate key names align: ${commonKeys.map(k=>`${k.left} ↔ ${k.right}`).join(', ')}`);
    warnings.push('Key-name similarity is not value-level join validation.');
    return {leftDatasetId:left.datasetId,rightDatasetId:right.datasetId,relation:'direct_join',confidence:level==='sample_validated'?'high':'medium',reasons,warnings,candidateKeys:commonKeys,proposedOperation:'join',evidenceLevel:level};
  }

  if(left.geometry&&right.geometry){
    const a=left.geometry.type.toLowerCase(),b=right.geometry.type.toLowerCase();
    if((a.includes('point')&&b.includes('polygon'))||(b.includes('point')&&a.includes('polygon'))){
      reasons.push('One dataset is point-like and the other polygon-like.');
      return {leftDatasetId:left.datasetId,rightDatasetId:right.datasetId,relation:'spatial_join',confidence:'medium',reasons,warnings,proposedOperation:'within / spatial join',evidenceLevel:level};
    }
    if((a.includes('point')&&b.includes('line'))||(b.includes('point')&&a.includes('line'))){
      reasons.push('Point observations can be associated with line features by proximity.');
      warnings.push('Distance threshold and coordinate reference system must be verified.');
      return {leftDatasetId:left.datasetId,rightDatasetId:right.datasetId,relation:'nearest',confidence:'medium',reasons,warnings,proposedOperation:'nearest',evidenceLevel:level};
    }
    reasons.push(`Both datasets expose geometry (${left.geometry.type}, ${right.geometry.type}).`);
    return {leftDatasetId:left.datasetId,rightDatasetId:right.datasetId,relation:'spatial_join',confidence:'low',reasons,warnings:['Geometry presence alone does not prove a meaningful analytical join.'],proposedOperation:'inspect spatial overlap',evidenceLevel:level};
  }

  if(left.temporal&&right.temporal){
    reasons.push('Both datasets expose temporal fields.');
    const grains=[left.temporal.grain,right.temporal.grain].filter(Boolean);
    if(grains.length===2&&grains[0]!==grains[1]){
      warnings.push(`Temporal grain differs (${grains[0]} vs ${grains[1]}).`);
      return {leftDatasetId:left.datasetId,rightDatasetId:right.datasetId,relation:'resample_required',confidence:'medium',reasons,warnings,proposedOperation:'temporal resample / aggregate',evidenceLevel:level};
    }
  }

  return {leftDatasetId:left.datasetId,rightDatasetId:right.datasetId,relation:'unknown',confidence:'low',reasons:['No deterministic join signal was strong enough.'],warnings:['Do not infer compatibility from topical similarity alone.'],evidenceLevel:level};
}

export function assessWorkspaceCompatibility(structures:DatasetStructure[]):CompatibilityAssessment[]{
  const out:CompatibilityAssessment[]=[];
  for(let i=0;i<structures.length;i++)for(let j=i+1;j<structures.length;j++)out.push(assessCompatibility(structures[i],structures[j]));
  return out;
}
