import test from 'node:test';
import assert from 'node:assert/strict';
import {datasets} from './registry.js';
import {session,execute,compare} from './db.js';
const diner=datasets.get('dannys-diner'),spotify=datasets.get('spotify');
test('all references and isolated fixtures',async()=>{
 for(const d of datasets.values())for(const f of d.tests)await session(d,async c=>{for(const q of d.questions){const a=await execute(c,q.sql);assert.equal(a.truncated,false);assert.equal(compare(a,a).passed,true);}},f);
});
test('dataset routing and schema isolation',async()=>{
 for(const d of datasets.values())for(const f of d.tests){const a=await session(d,c=>execute(c,'SELECT current_database() AS db'),f);assert.equal(a.rows[0][0],f.database);}
 await assert.rejects(session(spotify,c=>execute(c,'SELECT * FROM dannys_diner.sales')),/does not exist/);
 await assert.rejects(session(diner,c=>execute(c,'SELECT * FROM public.spotify')),/does not exist/);
});
test('writes, stacked statements and writable CTEs rejected',async()=>{
 for(const d of datasets.values()){
 const name=d.id==='spotify'?'public.spotify':'dannys_diner.sales';
 for(const query of [`DELETE FROM ${name}`,`DROP TABLE ${name}`,'SELECT 1; SELECT 2',`WITH x AS (DELETE FROM ${name} RETURNING *) SELECT * FROM x`])await assert.rejects(session(d,c=>execute(c,query)));
 }
});
test('timeout and result cap',async()=>{
 await assert.rejects(session(diner,c=>execute(c,'SELECT pg_sleep(6)')),/statement timeout/);
 const a=await session(diner,c=>execute(c,'SELECT generate_series(1,1200)'));assert.equal(a.truncated,true);assert.equal(a.rows.length,1000);
});
test('comparison preserves precision, duplicates, order and NULLs',()=>{
 const a={fields:[{name:'n',numeric:true}],rows:[['9007199254740993'],[null]],truncated:false};
 assert.equal(compare(a,{...a,rows:[['9007199254740993.00'],[null]]}).passed,true);
 for(const rows of [[['9007199254740992'],[null]],[['9007199254740993'],['0']],[...a.rows,...a.rows],[...a.rows].reverse()])assert.equal(compare(a,{...a,rows}).passed,false);
});
test('edge fixture detects incorrect ranking and welcome-week boundary',async()=>{
 const q=diner.questions[11],wrong=q.sql.replace('RANK()','DENSE_RANK()');
 const f=diner.tests[1];
 await session(diner,async c=>assert.equal(compare(await execute(c,wrong),await execute(c,q.sql)).passed,false),f);
 const reward=diner.questions[9];
 await session(diner,async c=>assert.equal(compare(await execute(c,reward.sql.replace('join_date+6','join_date+7')),await execute(c,reward.sql)).passed,false),f);
});
