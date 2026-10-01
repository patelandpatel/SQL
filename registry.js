import {readFile} from 'node:fs/promises';
const entries=JSON.parse(await readFile(new URL('./datasets/registry.json',import.meta.url),'utf8'));
export const datasets=new Map();
for(const d of entries){
 if(!/^[a-z][a-z0-9-]*$/.test(d.id)||datasets.has(d.id))throw Error('Invalid or duplicate dataset ID');
 for(const name of [d.schema,...d.tables])if(!/^[a-z_][a-z0-9_]*$/.test(name))throw Error('Unsafe configured identifier');
 d.questions=JSON.parse(await readFile(new URL(`./datasets/${d.id}/questions.json`,import.meta.url),'utf8'));
 datasets.set(d.id,d);
}
export function publicDataset(d){const {database,user,tests,questions,...info}=d;return {...info,questionCount:questions.length,tests:tests.map(({database,...t})=>t)};}
