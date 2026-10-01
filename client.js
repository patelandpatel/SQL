import {EditorView,basicSetup} from 'codemirror';
import {sql,PostgreSQL} from '@codemirror/lang-sql';
import {keymap} from '@codemirror/view';
import {Compartment} from '@codemirror/state';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let questions=[],schema=[],id=1,tab='question',busy=false,lastResult=null,dataset=null,library=[],suppressDraft=false,routeVersion=0;
const dialect=new Compartment();
let storeKey='',saved={drafts:{},history:{},solved:{}};
function loadSaved(d){
 storeKey='sql-practice-v2:'+d.id; saved={drafts:{},history:{},solved:{}};
 try{let text=localStorage.getItem(storeKey);
 if(!text&&d.id==='spotify')text=localStorage.getItem('spotify-sql-lab-v1');
 const raw=JSON.parse(text);if(raw&&raw.drafts&&raw.history&&raw.solved)saved=raw;
 }catch{}
 persist();
}
function persist(){try{localStorage.setItem(storeKey,JSON.stringify(saved));$('#saved').textContent='Draft saved locally';}catch{$('#saved').textContent='Storage full — draft not saved';}}
const starter='-- Write your query here.\n-- Run a selection, or run the whole editor.\n\n';
const editor=new EditorView({doc:starter,parent:$('#editor'),extensions:[basicSetup,EditorView.lineWrapping,dialect.of(sql({dialect:PostgreSQL})),EditorView.contentAttributes.of({'aria-label':'SQL editor'}),keymap.of([{key:'Mod-Enter',run:()=>{perform('run');return true;}}]),EditorView.updateListener.of(u=>{if(u.docChanged&&!suppressDraft&&dataset){saved.drafts[id]=u.state.doc.toString();persist();$('#line-count').textContent=`${u.state.doc.lines} lines`;}})]});
async function api(path,body){const r=await fetch('/api/datasets/'+dataset.id+'/'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const data=await r.json();if(!r.ok)throw Error(data.error+(data.detail?' — '+data.detail:''));return data;}
function question(){return questions.find(q=>q.id===id);}
function renderNav(){const filter=$('#search').value.toLowerCase();let group='';$('#questions').innerHTML=questions.filter(q=>(q.title+' '+q.id+' '+q.category).toLowerCase().includes(filter)).map(q=>{let html='';if(group!==q.category){group=q.category;html=`<div class="group-label">${esc(group)}</div>`;}return html+`<button class="q-item ${id===q.id?'active':''}" data-id="${q.id}" ${id===q.id?'aria-current="page"':''}><span class="num">${String(q.id).padStart(2,'0')}</span><span>${esc(q.title)}</span>${saved.solved[q.id]?'<span class="done">✓</span>':''}</button>`;}).join('')||'<p class="muted">No matching questions.</p>';$('#questions').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.id)));const n=Object.values(saved.solved).filter(Boolean).length;$('#progress-count').textContent=`${n} / ${questions.length}`;$('#progress').style.width=`${n/questions.length*100}%`;}
function table(result){return `<div class="output-table"><table><thead><tr>${result.fields.map(f=>`<th>${esc(f.name)}</th>`).join('')}</tr></thead><tbody>${result.rows.map(row=>`<tr>${row.map(v=>`<td class="${v===null?'null':''}">${v===null?'NULL':esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>${result.rows.length?'':'<p class="muted" style="padding:16px">Query returned 0 rows.</p>'}</div>`;}
function renderLeft(){const q=question();if(!q)return;$('#left-tabs').querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.dataset.tab===tab));const content=$('#question-content');
 if(tab==='question'){
  content.innerHTML=`<p>${esc(q.task)}</p><div class="callout">${q.schemaReasoning?'This is a schema-reasoning exercise. Explain what information is missing.':`Use <b>${esc(dataset.schema)}</b> tables. Match column names, rounding and ordering. Duplicates and NULLs matter.`}</div>${schema.map(t=>`<div class="table-label"><h3>${esc(t.name)} <span>Table schema</span></h3><span>${t.rowCount} rows</span></div><div class="schema-wrap"><table><thead><tr><th>Column name</th><th>Data type</th></tr></thead><tbody>${t.columns.map(c=>`<tr><td>${esc(c[0])}</td><td>${esc(c[1])}</td></tr>`).join('')}</tbody></table></div>${t.sample?`<details class="input-data"><summary>View ${esc(t.name)} input data</summary>${table(t.sample)}</details>`:''}`).join('')}<h3>Dataset notes</h3><p class="muted">${esc(dataset.about)}</p>${dataset.source?`<p><a href="${esc(dataset.source)}" target="_blank" rel="noopener">Original case study by Danny Ma ↗</a></p>`:''}<button id="expected">Reveal expected output</button>`;
  $('#expected').onclick=()=>perform('expected');
 }else if(tab==='tests'){
  const recent=(saved.history[id]||[])[0];
  content.innerHTML='<h3>Test your reasoning</h3><p class="muted">Check answer runs your SQL against every fixture. Expected outputs stay hidden until you reveal them.</p>'+dataset.tests.map(f=>{const result=recent?.cases?.find(c=>c.id===f.id);return `<div class="test-card"><h3>${esc(f.name)}</h3><p>${esc(f.description)}</p><div class="test-status">${result?`${result.passed?'✓ Passed':'↻ Needs review'} · ${esc(result.message)}`:'Not checked yet'}</div><div class="test-actions"><button data-run-fixture="${f.id}">Run this case</button><button data-expected-fixture="${f.id}">Reveal expected output</button></div></div>`;}).join('');
  content.querySelectorAll('[data-run-fixture]').forEach(b=>b.onclick=()=>perform('run',b.dataset.runFixture));
  content.querySelectorAll('[data-expected-fixture]').forEach(b=>b.onclick=()=>perform('expected',b.dataset.expectedFixture));
 }else if(tab==='solution'){
  content.innerHTML='<h3>Give your own approach a chance.</h3><p class="muted">The reference includes one valid query and review notes. There can be more than one correct way to solve a question.</p><button class="reveal" id="reveal">Reveal solution</button>';
  $('#reveal').onclick=async()=>{const current=id, currentDataset=dataset.id;try{const a=await api('solution',{id});if(id!==current||dataset?.id!==currentDataset||tab!=='solution')return;content.innerHTML=`<h3>How to approach it</h3><ol class="solution-steps">${a.steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol><h3>Reference solution</h3><pre class="solution-code">${esc(a.sql)}</pre><h3>Review notes</h3><p>${esc(a.note)}</p><button id="copy-solution">Copy solution</button>`;$('#copy-solution').onclick=async()=>{try{await navigator.clipboard.writeText(a.sql);$('#copy-solution').textContent='Copied';}catch{$('#copy-solution').textContent='Select the SQL above to copy';}};}catch(e){content.textContent=e.message;}};
 }else{
  const history=saved.history[id]||[];
  content.innerHTML='<h3>Your recent checks</h3><p class="muted">Saved on this browser. The latest 20 checks per question are retained.</p>'+ (history.length?history.map((h,i)=>`<div class="history-item"><strong>${h.passed?'✓ Matched':'↻ Needs review'}</strong> · ${esc(new Date(h.time).toLocaleString())}<p>${esc(h.message)}</p><details><summary>View submitted SQL</summary><pre>${esc(h.sql)}</pre></details><button data-restore="${i}">Restore draft</button></div>`).join(''):'<div class="callout">No submissions yet. Use Check answer after running your query.</div>');
  content.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:history[Number(b.dataset.restore)].sql}});editor.focus();});
 }
}
function resetOutput(){$('#output-label').textContent='Results';$('#result-meta').textContent='';$('#output-content').innerHTML='<div class="empty"><div class="empty-icon">⌁</div><h3>A little SQL. A lot to discover.</h3><p>Write a query above and run it.<br>Your results will appear right here.</p><span class="keycap">⌘ ↵</span></div>';lastResult=null;$('#export').disabled=true;}
function choose(next){if(busy)return;id=next;saved.current=id;persist();const draft=saved.drafts[id]??starter;editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:draft}});const q=question();$('#title').textContent=q.title;$('#difficulty').textContent=q.difficulty;$('#category').textContent=q.category;$('#position').textContent=String(id).padStart(2,'0')+' / '+questions.length;$('#previous').disabled=id===1;$('#next').disabled=id===questions.length;tab='question';renderNav();renderLeft();resetOutput();}
function setBusy(value){busy=value;['run','check','explain'].forEach(k=>$('#'+k).disabled=value);$('#run').textContent=value?'Running…':'▷ Run query';$('#previous').disabled=value||id===1;$('#next').disabled=value||id===questions.length;$('#editor').style.opacity=value?'.65':'1';}
async function perform(action,fixture='sample'){if(busy||!question())return;const selected=editor.state.sliceDoc(editor.state.selection.main.from,editor.state.selection.main.to);const text=action==='check'?editor.state.doc.toString():(selected.trim()?selected:editor.state.doc.toString());setBusy(true);lastResult=null;$('#export').disabled=true;$('#output-label').textContent=action==='expected'?'Expected output':action==='explain'?'Query plan':'Results';$('#result-meta').textContent='';$('#output-content').innerHTML='<div class="empty"><h3>Running against your PostgreSQL database…</h3></div>';
 try{
  const result=await api(action,{id,sql:text,fixture});
  if(action==='explain'){
   const p=result.plan;$('#output-content').innerHTML=`<div class="plan-stats"><div class="stat"><b>${esc(p['Execution Time'])} ms</b>Execution time</div><div class="stat"><b>${esc(p.Plan['Actual Rows'])}</b>Actual rows</div><div class="stat"><b>${esc(p.Plan['Node Type'])}</b>Root operation</div></div><div class="plan-details"><p class="muted">EXPLAIN ANALYZE executes your query. Node memory is not total query RAM; small timing differences on these teaching datasets are noisy.</p><details><summary>Full execution plan · buffers & memory</summary><pre>${esc(JSON.stringify(p,null,2))}</pre></details></div>`;
  }else{
   lastResult=result;$('#export').disabled=false;$('#result-meta').textContent=`${result.rows.length}${result.truncated?'+':''} rows · ${result.elapsed} ms round trip`;
   let notice=fixture!=='sample'?`<div class="notice">Test fixture: ${esc(dataset.tests.find(t=>t.id===fixture).name)}. Your main dataset is unchanged.</div>`:'';if(result.check){const c=result.check;notice=`<div class="notice ${c.passed?'':'error'}"><strong>${c.passed?'✓ Result matched':'Not quite yet'}</strong><br>${esc(c.message)}${c.schemaReasoning?'<br>This validates the metadata query only. Explain why the requested analysis cannot be answered; this question is not automatically marked solved.':'<br>A matching result on this dataset is not a proof of correctness for every possible input.'}</div>`;saved.history[id]=[{sql:text,time:Date.now(),passed:c.passed,message:c.message,cases:c.cases},...(saved.history[id]||[])].slice(0,20);if(c.passed&&!c.schemaReasoning)saved.solved[id]=true;persist();renderNav();if(tab==='history'||tab==='tests')renderLeft();}
   if(result.truncated)notice+='<div class="notice error">Showing the first 1,000 rows. Narrow the query for a complete comparison.</div>';
   $('#output-content').innerHTML=notice+table(result);
  }
 }catch(e){$('#output-content').innerHTML=`<div class="notice error"><strong>Query could not run</strong><br>${esc(e.message)}</div>`;if(action==='check'){saved.history[id]=[{sql:text,time:Date.now(),passed:false,message:e.message},...(saved.history[id]||[])].slice(0,20);persist();}}
 finally{setBusy(false);}
}
$('#search').oninput=renderNav;$('#previous').onclick=()=>choose(id-1);$('#next').onclick=()=>choose(id+1);$('#left-tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;renderLeft();});['run','check','explain'].forEach(action=>$('#'+action).onclick=()=>perform(action));
$('#export').onclick=()=>{if(!lastResult)return;const encode=v=>'"'+String(v===null?'\\N':v).replaceAll('"','""')+'"';const csv=[lastResult.fields.map(f=>f.name),...lastResult.rows].map(row=>row.map(encode).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`${dataset.id}-Q${String(id).padStart(2,'0')}-result.csv`;a.click();URL.revokeObjectURL(url);};
function renderLibrary(){
 $('#dataset-cards').innerHTML=library.map(d=>`<a class="dataset-card ${esc(d.color)}" href="#/dataset/${d.id}"><div class="card-top"><span class="dataset-icon">${esc(d.icon)}</span><span class="card-index">DATASET ${String(library.indexOf(d)+1).padStart(2,'0')}</span></div><h2>${esc(d.name)}</h2><h3>${esc(d.subtitle)}</h3><p>${esc(d.description)}</p><div class="tags">${d.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="card-bottom"><span>${d.questionCount} questions · ${d.tables.length} table${d.tables.length===1?'':'s'}</span><strong>Start learning ↗</strong></div></a>`).join('');
}
async function route(){
 if(busy){location.hash='#/dataset/'+dataset.id;return;}
 const version=++routeVersion;
 const match=location.hash.match(/^#\/dataset\/([a-z0-9-]+)$/);
 const next=match&&library.find(d=>d.id===match[1]);
 if(!next){dataset=null;$('#library').hidden=false;$('#learning').hidden=true;$('#brand-name').innerHTML='SQL <span>Practice Lab</span>';$('#connection').textContent='● Local learning workspace';document.title='SQL Practice Lab';return;}
 dataset=next;questions=[];schema=[];loadSaved(dataset);$('#library').hidden=true;$('#learning').hidden=false;$('#search').value='';$('#brand-name').textContent=dataset.name+' SQL Lab';$('#dataset-crumb').textContent=' / '+dataset.name;$('#database-label').textContent=dataset.id+' / '+dataset.schema;$('#title').textContent='Loading your workspace…';$('#connection').textContent='● Connecting…';$('#question-content').textContent='Loading schema and exercises…';$('#questions').innerHTML='';document.title=dataset.name+' · SQL Practice Lab';
 try{
  const [q,data]=await Promise.all([api('questions'),api('schema')]);if(version!==routeVersion)return;
  questions=q;schema=data.tables;$('#question-count').textContent=`${q.length} questions`;$('#connection').textContent='● Local database connected';$('#row-count').textContent=` · ${schema.reduce((n,t)=>n+t.rowCount,0)} rows`;
  const completion={};for(const t of schema){completion[t.name]=t.columns.map(c=>c[0]);completion[t.qualifiedName]=completion[t.name];}
  editor.dispatch({effects:dialect.reconfigure(sql({dialect:PostgreSQL,schema:completion}))});
  choose(questions.some(q=>q.id===saved.current)?saved.current:1);
 }catch(e){if(version!==routeVersion)return;$('#connection').textContent='● Database unavailable';$('#title').textContent='Could not connect';$('#question-content').innerHTML=`<p>${esc(e.message)}</p><p>Start PostgreSQL with <code>brew services start postgresql@17</code>, then reload.</p>`;}
}
$('#all-datasets').onclick=e=>{if(busy)e.preventDefault();};
window.addEventListener('hashchange',route);
async function init(){try{const r=await fetch('/api/datasets');if(!r.ok)throw Error('Could not load datasets');library=await r.json();renderLibrary();await route();}catch(e){$('#dataset-cards').textContent=e.message;}}
init();
