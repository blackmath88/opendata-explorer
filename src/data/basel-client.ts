import type { CatalogState, DatasetRecord, DatasetStructure, FieldProfile } from '../types';
import { normalizeOdsDataset } from './normalize';
import { fallbackDatasets } from './fallback';

const API_BASE = 'https://data.bs.ch/api/explore/v2.1';
const PAGE_SIZE = 100;
const MAX_DATASETS = 1000;
const SAMPLE_SIZE = 5;

interface OdsCatalogResponse { total_count?: number; results?: unknown[]; }
interface OdsRecordsResponse { total_count?: number; results?: Record<string, unknown>[]; }

function api(path:string):URL { return new URL(`${API_BASE}${path}`); }
async function getJson<T>(url:URL):Promise<T>{
  const response=await fetch(url,{headers:{Accept:'application/json'}});
  if(!response.ok) throw new Error(`Basel OGD returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export async function loadBaselCatalog(): Promise<CatalogState> {
  try {
    const datasets: DatasetRecord[] = [];
    let offset = 0;
    let total = Infinity;
    while (offset < total && offset < MAX_DATASETS) {
      const url=api('/catalog/datasets');
      url.searchParams.set('limit',String(PAGE_SIZE));
      url.searchParams.set('offset',String(offset));
      url.searchParams.set('lang','en');
      const body=await getJson<OdsCatalogResponse>(url);
      const page=Array.isArray(body.results)?body.results:[];
      total=typeof body.total_count==='number'?body.total_count:page.length;
      datasets.push(...page.map(normalizeOdsDataset).filter((d):d is DatasetRecord=>Boolean(d)));
      if(page.length<PAGE_SIZE)break;
      offset+=PAGE_SIZE;
    }
    if(!datasets.length)throw new Error('Basel OGD catalogue returned no datasets');
    return {source:'live',loadedAt:new Date().toISOString(),datasets};
  } catch(error) {
    return {source:'fallback',loadedAt:new Date().toISOString(),datasets:fallbackDatasets,error:error instanceof Error?error.message:'Unknown catalogue error'};
  }
}

export async function getBaselDataset(id:string):Promise<DatasetRecord>{
  const url=api(`/catalog/datasets/${encodeURIComponent(id)}`);
  url.searchParams.set('lang','en');
  const raw=await getJson<unknown>(url);
  const dataset=normalizeOdsDataset(raw);
  if(!dataset)throw new Error(`Could not normalize Basel dataset ${id}`);
  return dataset;
}

function valueType(value:unknown):string|undefined{
  if(value===null||value===undefined)return undefined;
  if(Array.isArray(value))return 'array';
  if(typeof value==='object')return 'object';
  return typeof value;
}
function isGeoValue(value:unknown):boolean{
  if(!value||typeof value!=='object')return false;
  const v=value as Record<string,unknown>;
  if(typeof v.lat==='number'&&typeof v.lon==='number')return true;
  if(v.type==='Feature'||v.type==='Point'||v.type==='Polygon'||v.type==='MultiPolygon'||v.type==='LineString'||v.type==='MultiLineString')return true;
  return Boolean(v.geometry&&typeof v.geometry==='object');
}
function geometryTypeFrom(value:unknown):string|undefined{
  if(!value||typeof value!=='object')return undefined;
  const v=value as Record<string,unknown>;
  if(typeof v.lat==='number'&&typeof v.lon==='number')return 'Point';
  if(v.type==='Feature'&&v.geometry&&typeof v.geometry==='object')return String((v.geometry as Record<string,unknown>).type??'Geometry');
  return typeof v.type==='string'?v.type:undefined;
}
function looksTemporal(name:string,values:unknown[]):boolean{
  const n=name.toLowerCase();
  if(/date|datum|zeit|time|year|jahr|month|monat|quarter|quartal|beginn|ende|created|modified/.test(n))return true;
  return values.some(v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v));
}
function looksKey(name:string,values:unknown[]):boolean{
  const n=name.toLowerCase();
  if(/^(id|uuid|key)$/.test(n)||n.startsWith('id_')||n.endsWith('_id'))return true;
  const scalar=values.filter(v=>['string','number'].includes(typeof v));
  return scalar.length>1&&new Set(scalar.map(String)).size===scalar.length&&/code|nr|nummer|name/.test(n);
}

export async function inspectBaselDataset(id:string):Promise<DatasetStructure>{
  const url=api(`/catalog/datasets/${encodeURIComponent(id)}/records`);
  url.searchParams.set('lang','en');
  url.searchParams.set('limit',String(SAMPLE_SIZE));
  const body=await getJson<OdsRecordsResponse>(url);
  const rows=Array.isArray(body.results)?body.results:[];
  if(!rows.length)return {datasetId:id,fields:[],candidateKeys:[],recordCount:body.total_count,observedFrom:'catalog_metadata'};

  const names=[...new Set(rows.flatMap(row=>Object.keys(row)))];
  const fields:FieldProfile[]=names.map(name=>{
    const sampleValues=rows.map(row=>row[name]).filter(v=>v!==undefined&&v!==null).slice(0,3);
    const roleHints:string[]=[];
    if(sampleValues.some(isGeoValue)||/geo|shape|geometry|coordinate|lat|lon/.test(name.toLowerCase()))roleHints.push('geometry');
    if(looksTemporal(name,sampleValues))roleHints.push('temporal');
    if(looksKey(name,sampleValues))roleHints.push('candidate_key');
    return {name,type:valueType(sampleValues[0]),sampleValues,roleHints};
  });
  const geoField=fields.find(f=>f.roleHints?.includes('geometry'));
  const geoSample=geoField?.sampleValues?.find(isGeoValue);
  const temporalFields=fields.filter(f=>f.roleHints?.includes('temporal')).map(f=>f.name);
  const candidateKeys=fields.filter(f=>f.roleHints?.includes('candidate_key')).map(f=>f.name);

  return {
    datasetId:id,
    fields,
    geometry:geoField?{type:geometryTypeFrom(geoSample)??'Geometry'}:undefined,
    temporal:temporalFields.length?{fields:temporalFields}:undefined,
    candidateKeys,
    recordCount:body.total_count,
    observedFrom:'sample_records',
  };
}
