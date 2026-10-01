import {mkdir,writeFile} from 'node:fs/promises';
import {datasets} from './registry.js';
import {session,execute} from './db.js';
for(const d of datasets.values()){
 const all={};
 for(const fixture of d.tests){
  all[fixture.id]={};
  await session(d,async c=>{for(const q of d.questions){const result=await execute(c,q.sql);if(result.truncated)throw Error('Unexpected truncation');all[fixture.id][q.id]={columns:result.fields.map(f=>f.name),rows:result.rows};}},fixture);
 }
 await mkdir(new URL(`./datasets/${d.id}/expected/`,import.meta.url),{recursive:true});
 await writeFile(new URL(`./datasets/${d.id}/expected/results.json`,import.meta.url),JSON.stringify(all,null,2)+'\n');
 console.log(`${d.id}: verified execution of ${d.questions.length} references across ${d.tests.length} fixture(s).`);
}
