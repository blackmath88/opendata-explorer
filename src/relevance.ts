import type { DatasetMatch, DatasetRecord } from './types';

const STOP = new Set(['the','and','for','with','that','this','from','into','where','what','want','build','could','would','basel','data','dataset','datasets','ich','und','mit','die','der','das','ein','eine','für','von']);

const EXPANSIONS: Record<string,string[]> = {
  shade:['shade','canopy','tree','trees','baum','baumkronen','green'],
  hot:['heat','temperature','temperatur','climate','klima','canopy','shade'],
  heat:['temperature','temperatur','climate','klima','canopy','shade'],
  running:['route','sport','movement','pedestrian','traffic','fountain','air','elevation'],
  runner:['route','sport','pedestrian','traffic','fountain','air','elevation'],
  air:['air','luft','no2','pm2.5','ozone','ozon'],
  pollution:['air','luft','no2','pm2.5','ozone','traffic'],
  traffic:['traffic','verkehr','speed','geschwindigkeit','noise','lärm'],
  quiet:['noise','lärm','pedestrian','fussgänger','traffic'],
  water:['water','wasser','fountain','brunnen'],
  fountain:['fountain','brunnen','water','wasser'],
  construction:['construction','baustelle','works','bau'],
  cycling:['velo','bike','cycling','traffic','street'],
  walk:['pedestrian','fussgänger','public space','traffic'],
  elevation:['elevation','height','höhe','slope','steigung'],
};

function terms(input:string): string[] {
  const base = input.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu,' ').split(/\s+/).filter(t=>t.length>2&&!STOP.has(t));
  return [...new Set(base.flatMap(t=>[t,...(EXPANSIONS[t]??[])]))];
}

export function rankDatasets(query:string,datasets:DatasetRecord[]):DatasetMatch[]{
  const queryTerms=terms(query);
  return datasets.map(dataset=>{
    const title=dataset.title.toLowerCase();
    const haystack=[dataset.title,dataset.description,dataset.publisher,...dataset.themes,...dataset.keywords,...dataset.semantic.topics,...dataset.semantic.possibleUses,...dataset.semantic.possibleJoins].join(' ').toLowerCase();
    const matched=queryTerms.filter(term=>haystack.includes(term));
    let score=matched.reduce((sum,term)=>sum+(title.includes(term)?12:5),0);
    if(dataset.characteristics.geospatial && /where|route|street|area|location|map|räum|ort|strasse|weg/i.test(query)) score+=14;
    if(dataset.characteristics.timeSeries && /current|today|now|trend|time|aktuell|heute|verlauf/i.test(query)) score+=8;
    if(dataset.characteristics.realtime && /current|today|now|live|aktuell|heute/i.test(query)) score+=10;
    score=Math.min(100,score);
    const explanation=matched.length
      ? `Matches ${matched.slice(0,4).join(', ')}${dataset.characteristics.geospatial?' and can support spatial analysis':''}.`
      : 'No strong deterministic term match yet; keep as contextual catalogue evidence.';
    return {dataset,relevance:{score,matchedTerms:matched,explanation}};
  }).sort((a,b)=>b.relevance.score-a.relevance.score||a.dataset.title.localeCompare(b.dataset.title));
}
