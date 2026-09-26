import { writeFileSync } from 'node:fs';
import { ICON_CATALOGUE, ICONS, icon, type IconName } from '../src/ui/icons';

const esc = (v: string) => v.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const total = Object.keys(ICONS).length;
const chip = (name: IconName, text: string, tone: string) => `<span class="chip ${tone}">${icon(name, { size: 16 })}${text}</span>`;

const context = `
<section class="context" aria-labelledby="ctx">
  <h2 id="ctx">In context</h2>
  <div class="ctx-grid">
    <figure class="ctx-rail">
      <div class="rail">
        <div class="rail-item on"><span class="rail-icon">${icon('discover')}</span>Discover</div>
        <div class="rail-item"><span class="rail-icon">${icon('build')}</span>Build</div>
        <div class="rail-item off"><span class="rail-icon">${icon('materialize')}</span>Materialize</div>
        <div class="rail-item"><span class="rail-icon">${icon('help')}</span>Help</div>
      </div>
      <figcaption>Side rail at 18px in the 48px hit target from DESIGN.md.</figcaption>
    </figure>
    <figure>
      <div class="chips">
        ${chip('evidence-direct', '2 direct', 'ev-direct')}${chip('evidence-supporting', '1 supporting', 'ev-supporting')}${chip('evidence-contextual', '3 context', 'ev-context')}${chip('evidence-missing', '2 missing roles', 'ev-missing')}
      </div>
      <figcaption>Evidence plan bar. Fill level carries the meaning, colour only reinforces it.</figcaption>
    </figure>
    <figure>
      <div class="relation">
        <div class="rel-row">${icon('rel-nearest', { size: 20 })}<span><b>Trees → cycle routes</b><small>nearest · 50 m</small></span>${chip('rejected', 'Rejected', 'st-bad')}</div>
        <div class="rel-row">${icon('rel-spatial-join', { size: 20 })}<span><b>Fountains → Tempo-30 zones</b><small>spatial join · contains</small></span>${chip('confirmed', 'Confirmed', 'st-good')}</div>
        <div class="rel-row">${icon('rel-resample', { size: 20 })}<span><b>Air quality → traffic counts</b><small>resample · hourly to daily</small></span>${chip('unchecked', 'Not yet run', 'st-idle')}</div>
      </div>
      <figcaption>Build relationships, using the demo pairs from the benchmark use cases.</figcaption>
    </figure>
  </div>
</section>`;

const groups = ICON_CATALOGUE.map(group => `
<section class="group" data-group="${esc(group.title)}">
  <header><h2>${esc(group.title)}</h2><p>${esc(group.note)}</p><span class="count">${group.icons.length}</span></header>
  <ul class="cells">${group.icons.map(entry => `
    <li><button class="cell" data-name="${entry.name}" data-search="${esc(`${entry.name} ${entry.label} ${entry.usage} ${group.title}`.toLowerCase())}" aria-label="Copy snippet for ${esc(entry.label)}">
      <span class="stage">${icon(entry.name, { size: 32 })}</span>
      <span class="label">${esc(entry.label)}</span>
      <code>${entry.name}</code>
      <span class="usage">${esc(entry.usage)}</span>
    </button></li>`).join('')}
  </ul>
</section>`).join('');

const html = `<title>DataFit Icons</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
:root{
  --ground:#fcf9f2;--panel:#fbfaf7;--raised:#ffffff;--ink:#1c1c18;--ink-2:#414944;--muted:#6b716d;
  --border:#d9d5cc;--divider:#ece8df;--primary:#134333;--primary-2:#2d5b49;--wash:#dfe9e3;--on-primary:#ffffff;
  --good:#2d5b49;--good-bg:#dfe9e3;--bad:#7f443a;--bad-bg:#f4e3df;--warn:#8a5f2d;--idle:#5f5e5e;--idle-bg:#ece8df;
  --grid-line:rgba(19,67,51,.12);--focus:#2d5b49;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){color-scheme:dark;
  --ground:#121613;--panel:#181d1a;--raised:#1e2420;--ink:#ebe8e1;--ink-2:#c3cbc5;--muted:#9aa29d;
  --border:#2f3833;--divider:#252c28;--primary:#a0d1ba;--primary-2:#8cc3aa;--wash:#203029;--on-primary:#0f2219;
  --good:#a0d1ba;--good-bg:#203029;--bad:#e3a597;--bad-bg:#3a2522;--warn:#d9ad73;--idle:#aab1ac;--idle-bg:#252c28;
  --grid-line:rgba(160,209,186,.14);--focus:#a0d1ba;}}
:root[data-theme="dark"]{color-scheme:dark;
  --ground:#121613;--panel:#181d1a;--raised:#1e2420;--ink:#ebe8e1;--ink-2:#c3cbc5;--muted:#9aa29d;
  --border:#2f3833;--divider:#252c28;--primary:#a0d1ba;--primary-2:#8cc3aa;--wash:#203029;--on-primary:#0f2219;
  --good:#a0d1ba;--good-bg:#203029;--bad:#e3a597;--bad-bg:#3a2522;--warn:#d9ad73;--idle:#aab1ac;--idle-bg:#252c28;
  --grid-line:rgba(160,209,186,.14);--focus:#a0d1ba;}
*{box-sizing:border-box}
body{background:var(--ground);color:var(--ink);font:13px/1.45 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding-inline:24px;padding-block:32px 64px;display:flex;flex-direction:column;gap:28px}
@media (max-width:560px){.wrap{padding-inline:16px;padding-block:20px 48px}}
.top{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px 32px;align-items:end;padding-bottom:22px;border-bottom:1px solid var(--border)}
@media (max-width:760px){.top{grid-template-columns:1fr}}
.brand{display:flex;align-items:center;gap:12px}
.logo{width:32px;height:32px;border-radius:4px;background:var(--primary);color:var(--on-primary);display:grid;place-items:center;font-weight:700;font-size:13px}
h1{margin:0;font-size:22px;font-weight:650;letter-spacing:-.01em;text-wrap:balance}
.lede{margin:10px 0 0;max-width:62ch;color:var(--ink-2)}
.spec{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 0;padding:0;list-style:none}
.spec li{font:500 11px/1 "JetBrains Mono",ui-monospace,Menlo,monospace;color:var(--ink-2);background:var(--panel);border:1px solid var(--border);border-radius:999px;padding:6px 9px}
.spec b{color:var(--primary);font-weight:500}
.controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.seg{display:flex;border:1px solid var(--border);border-radius:9px;overflow:hidden;background:var(--panel)}
.seg button{border:0;border-right:1px solid var(--border);background:transparent;color:var(--ink-2);padding:7px 11px;font:500 11px/1 "JetBrains Mono",ui-monospace,monospace;cursor:pointer}
.seg button:last-child{border-right:0}
.seg button[aria-pressed="true"]{background:var(--primary-2);color:var(--on-primary)}
.toggle{display:flex;gap:7px;align-items:center;font-size:12px;color:var(--ink-2);cursor:pointer}
.toggle input{accent-color:var(--primary-2)}
.find{position:relative;display:flex;align-items:center}
.find svg{position:absolute;left:9px;color:var(--muted);pointer-events:none}
#filter{width:200px;max-width:100%;border:1px solid var(--border);background:var(--raised);color:var(--ink);border-radius:9px;padding:7px 10px 7px 32px;font:inherit;font-size:12px}
button:focus-visible,input:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
h2{margin:0;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-2)}
figure{margin:0;display:flex;flex-direction:column;gap:10px}
figcaption{font-size:11px;color:var(--muted);max-width:44ch}
.context{display:flex;flex-direction:column;gap:14px}
.ctx-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.3fr);gap:16px;align-items:start}
@media (max-width:960px){.ctx-grid{grid-template-columns:1fr 1fr}.ctx-grid figure:last-child{grid-column:1/-1}}
@media (max-width:560px){.ctx-grid{grid-template-columns:1fr}}
.ctx-grid>figure{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px}
.rail{display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap}.rail-item{width:64px}
.rail-item{display:flex;flex-direction:column;align-items:center;gap:5px;font-size:10px;color:var(--ink-2)}
.rail-icon{width:48px;height:48px;border-radius:8px;display:grid;place-items:center}
.rail-item.on{color:var(--primary)}.rail-item.on .rail-icon{background:var(--primary-2);color:var(--on-primary)}
.rail-item.off{opacity:.4}

.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px 5px 7px;border-radius:999px;font-size:11px;font-weight:500;border:1px solid var(--border);background:var(--raised);color:var(--ink-2);white-space:nowrap}
.ev-direct{color:var(--primary);border-color:transparent;background:var(--wash);font-weight:650}
.ev-supporting{color:var(--primary-2)}
.ev-missing{color:var(--warn);border-style:dashed}
.st-good{color:var(--good);background:var(--good-bg);border-color:transparent}
.st-bad{color:var(--bad);background:var(--bad-bg);border-color:transparent}
.st-idle{color:var(--idle);background:var(--idle-bg);border-color:transparent}
.relation{display:flex;flex-direction:column}
.rel-row{display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid var(--divider);color:var(--ink-2)}
.rel-row:first-child{padding-top:0}.rel-row:last-child{border-bottom:0}
.rel-row b{display:block;font-size:12px;font-weight:600;color:var(--ink)}
.rel-row small{font:400 10px/1.4 "JetBrains Mono",ui-monospace,monospace;color:var(--muted)}
.group{display:flex;flex-direction:column;gap:12px}
.group>header{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.group>header p{margin:0;font-size:12px;color:var(--muted);flex:1;min-width:0}
.count{font:500 10px/1 "JetBrains Mono",ui-monospace,monospace;color:var(--muted);font-variant-numeric:tabular-nums}
.cells{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:8px}
.cell{width:100%;height:100%;display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:12px 12px 13px;border:1px solid var(--border);border-radius:12px;background:var(--panel);color:var(--ink);text-align:left;font:inherit;cursor:pointer;transition:border-color .15s,background .15s}
.cell:hover{border-color:var(--primary-2);background:var(--raised)}
.stage{align-self:stretch;height:76px;margin-bottom:8px;display:grid;place-items:center;border-radius:8px;background:var(--ground);color:var(--ink)}
.cell:hover .stage{color:var(--primary)}
body.grid .stage svg{background-image:linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px);background-size:calc(100%/12) calc(100%/12);outline:1px solid var(--grid-line)}
.label{font-size:12.5px;font-weight:600}
.cell code{font:400 10.5px/1.3 "JetBrains Mono",ui-monospace,monospace;color:var(--primary-2)}
.usage{font-size:11px;color:var(--muted);line-height:1.35}
.cell.copied code::after{content:" · copied";color:var(--muted)}
.group[hidden],.cells li[hidden]{display:none}
.empty{color:var(--muted);font-size:12px}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
<div class="wrap">
  <div class="top">
    <div>
      <div class="brand"><div class="logo">DF</div><h1>DataFit Icons</h1></div>
      <p class="lede">${total} glyphs for the DataFit UI. They cover the Discover surface as it exists today and the Build vocabulary it still needs: relations, validation states and result types. Click an icon to copy its snippet.</p>
      <ul class="spec"><li>grid <b>24</b></li><li>stroke <b>1.5</b></li><li>render <b>18px</b></li><li>caps <b>round</b></li><li>colour <b>currentColor</b></li><li>source <b>src/ui/icons.ts</b></li></ul>
    </div>
    <div class="controls">
      <div class="seg" role="group" aria-label="Preview size"><button id="s18" data-size="18" aria-pressed="false">18</button><button id="s24" data-size="24" aria-pressed="false">24</button><button id="s32" data-size="32" aria-pressed="true">32</button><button id="s48" data-size="48" aria-pressed="false">48</button></div>
      <label class="toggle"><input id="grid" type="checkbox"> Grid</label>
      <div class="find">${icon('search', { size: 16 })}<input id="filter" type="search" placeholder="Filter icons" aria-label="Filter icons"></div>
    </div>
  </div>
  ${context}
  ${groups}
  <p class="empty" id="empty" hidden>No icon matches that filter.</p>
</div>
<script>
(function(){
  var svgs=document.querySelectorAll('.stage svg');
  function setSize(n){svgs.forEach(function(s){s.setAttribute('width',n);s.setAttribute('height',n)});document.querySelectorAll('.seg button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.size===String(n)))});try{localStorage.setItem('df-icon-size',n)}catch(e){}}
  document.querySelectorAll('.seg button').forEach(function(b){b.addEventListener('click',function(){setSize(b.dataset.size)})});
  var grid=document.getElementById('grid');
  grid.addEventListener('change',function(){document.body.classList.toggle('grid',grid.checked)});
  try{var saved=localStorage.getItem('df-icon-size');if(saved)setSize(saved)}catch(e){}
  var filter=document.getElementById('filter'),empty=document.getElementById('empty');
  filter.addEventListener('input',function(){var q=filter.value.trim().toLowerCase(),any=false;
    document.querySelectorAll('.group').forEach(function(g){var shown=0;g.querySelectorAll('.cells li').forEach(function(li){var hit=!q||li.firstElementChild.dataset.search.indexOf(q)>-1;li.hidden=!hit;if(hit)shown++});g.hidden=!shown;if(shown)any=true});
    empty.hidden=any});
  document.querySelectorAll('.cell').forEach(function(c){c.addEventListener('click',function(){
    var text="icon('"+c.dataset.name+"')";
    function done(){c.classList.add('copied');setTimeout(function(){c.classList.remove('copied')},1400)}
    try{navigator.clipboard.writeText(text).then(done,function(){})}catch(e){}
  })});
})();
</script>
`;
writeFileSync(process.argv[2], html);
console.log('wrote', process.argv[2], html.length);
