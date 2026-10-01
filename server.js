import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {session,execute,compare} from './db.js';
import {datasets,publicDataset} from './registry.js';
const root=new URL('./',import.meta.url),port=Number(process.env.PORT||3000);
let active=0;
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
const publicFiles={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
const server=http.createServer(async(req,res)=>{
 try{
  const hosts=[`localhost:${port}`,`127.0.0.1:${port}`];
  if(!hosts.includes(req.headers.host))return send(res,403,{error:'Local connections only.'});
  if(req.headers.origin&&!hosts.some(h=>req.headers.origin===`http://${h}`))return send(res,403,{error:'Origin not allowed.'});
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
  const path=new URL(req.url,'http://localhost').pathname;
  if(req.method==='GET'&&publicFiles[path]){
   const file=publicFiles[path];res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-cache'});return res.end(await readFile(new URL('public/'+file,root)));
  }
  if(req.method==='GET'&&path==='/api/datasets')return send(res,200,[...datasets.values()].map(publicDataset));
  const match=path.match(/^\/api\/datasets\/([a-z0-9-]+)\/(questions|schema|run|check|expected|solution|explain)$/);
  const d=match&&datasets.get(match[1]),action=match?.[2];
  if(!d)return send(res,404,{error:'Unknown dataset or endpoint.'});
  if(req.method==='GET'&&action==='questions')return send(res,200,d.questions.map(({sql,note,steps,...q})=>q));
  if(req.method==='GET'&&action==='schema'){
   const result=await session(d,async c=>{
    const tables=[];
    for(const name of d.tables){
     const schema=await execute(c,`SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='${d.schema}' AND table_name='${name}' ORDER BY ordinal_position`);
     const count=await execute(c,`SELECT COUNT(*) AS rows FROM ${d.schema}.${name}`);
     // Small teaching datasets show complete input; Spotify stays schema-only initially.
     const sample=d.id==='spotify'?null:await execute(c,`SELECT * FROM ${d.schema}.${name} ORDER BY ${schema.rows.map((_,i)=>i+1).join(',')} LIMIT 30`);
     tables.push({name,qualifiedName:`${d.schema}.${name}`,columns:schema.rows,rowCount:Number(count.rows[0][0]),sample});
    }return {tables};
   });return send(res,200,result);
  }
  if(req.method!=='POST'||!['run','check','expected','solution','explain'].includes(action))return send(res,405,{error:'Method not allowed.'});
  if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required.'});
  let body='';for await(const chunk of req){body+=chunk;if(body.length>40000)return send(res,413,{error:'Query too long.'});}
  const input=JSON.parse(body),q=d.questions.find(q=>q.id===Number(input.id));
  if(!q)return send(res,400,{error:'Choose an exercise.'});
  if(action==='solution')return send(res,200,{sql:q.sql,note:q.note,steps:q.steps});
  const fixture=d.tests.find(t=>t.id===(input.fixture||'sample'));
  if(!fixture)return send(res,400,{error:'Unknown test case.'});
  if(active>=4)return send(res,429,{error:'Four queries are already running. Try again shortly.'});
  active++;
  try{
   if(action==='check'){
    let actual;const cases=[];
    for(const f of d.tests){
     try{const result=await session(d,async c=>{const a=await execute(c,input.sql);const e=await execute(c,q.sql);return {a,comparison:compare(a,e)};},f);
      if(f.id==='sample')actual=result.a;
      cases.push({id:f.id,name:f.name,...result.comparison});
     }catch(e){cases.push({id:f.id,name:f.name,passed:false,message:e.message});}
    }
    const passed=cases.every(c=>c.passed);
    return send(res,200,{...(actual||{fields:[],rows:[],elapsed:0,truncated:false}),check:{passed,cases,schemaReasoning:q.schemaReasoning,message:passed?`All ${cases.length} test case${cases.length===1?'':'s'} matched.`:`${cases.filter(c=>c.passed).length} of ${cases.length} test cases matched. See Test cases for details.`}});
   }
   const result=await session(d,async c=>{
    if(action==='expected')return execute(c,q.sql);
    if(action==='explain'){const r=await execute(c,'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+input.sql);return {plan:JSON.parse(r.rows[0][0])[0]};}
    return execute(c,input.sql);
   },fixture);send(res,200,result);
  }finally{active--;}
 }catch(e){send(res,400,{error:e.message,detail:e.detail||e.hint||null});}
});
server.listen(port,'127.0.0.1',()=>console.log(`SQL Practice Lab running at http://localhost:${port}`));
