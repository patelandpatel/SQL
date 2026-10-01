import pg from 'pg';
import Cursor from 'pg-cursor';
const NUMERIC = new Set([20,21,23,700,701,1700]);
// Preserve large integers and numeric precision all the way to the comparison.
const types={getTypeParser:()=>value=>value};
export async function session(dataset, fn, fixture = dataset.tests[0]){
 const c=new pg.Client({host:'127.0.0.1',port:5432,database:fixture.database,user:dataset.user,connectionTimeoutMillis:2000,types,application_name:'SQL Practice Lab'});
 await c.connect();
 const deadline=setTimeout(()=>c.end().catch(()=>{}),12000);
 try{
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await c.query("SET LOCAL statement_timeout='5s'");
  await c.query("SET LOCAL work_mem='8MB'");
  await c.query('SELECT set_config($1,$2,true)', ['search_path', dataset.schema + ',pg_catalog']);
  return await fn(c);
 }finally{clearTimeout(deadline);await c.end();}
}
export async function execute(c,sql){
 if(typeof sql!=='string'||!sql.trim()||sql.length>30000)throw Error('Enter one SQL query (up to 30,000 characters).');
 // Cursor uses extended protocol: PostgreSQL rejects stacked statements.
 const start=performance.now();
 const cursor=c.query(new Cursor(sql,[],{rowMode:'array',types}));
 try{
  const rows=await cursor.read(1001);
  const fields=cursor._result.fields.map(f=>({name:f.name,type:f.dataTypeID,numeric:NUMERIC.has(f.dataTypeID)}));
  return {fields,rows:rows.slice(0,1000),truncated:rows.length>1000,elapsed:Math.round((performance.now()-start)*100)/100};
 }finally{await cursor.close().catch(()=>{});}
}
function numberKey(value){
 const m=String(value).match(/^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
 if(!m||(!m[2]&&!m[3]))return String(value);
 let digits=(m[2]+(m[3]||'')).replace(/^0+/,'');
 if(!digits)return '0';
 let exp=Number(m[4]||0)-(m[3]||'').length;
 while(digits.endsWith('0')){digits=digits.slice(0,-1);exp++;}
 return (m[1]==='-'?'-':'')+digits+'e'+exp;
}
export function compare(actual,expected){
 if(actual.truncated||expected.truncated)return {passed:false,message:'Result exceeds 1,000 rows. Add a limit or narrow your query before checking.'};
 if(JSON.stringify(actual.fields.map(f=>f.name))!==JSON.stringify(expected.fields.map(f=>f.name)))return {passed:false,message:'Column names or their order differ from the question contract.'};
 const keys=r=>r.rows.map(row=>JSON.stringify(row.map((v,i)=>v===null?['null']:r.fields[i].numeric?['number',numberKey(v)]:['text',v])));
 const a=keys(actual),b=keys(expected),counts=new Map();
 for(const k of b)counts.set(k,(counts.get(k)||0)+1);
 let extra=0;
 for(const k of a){if(counts.get(k)>0)counts.set(k,counts.get(k)-1);else extra++;}
 const missing=[...counts.values()].reduce((x,y)=>x+y,0);
 const ordered=JSON.stringify(a)===JSON.stringify(b);
 return {passed:!missing&&!extra&&ordered,valuesMatch:!missing&&!extra,ordered,missing,extra,message:missing||extra?`${missing} missing and ${extra} extra result rows. Check filters, NULLs, duplicates and rounding.`:!ordered?'Values match, but row order differs. Follow the requested ORDER BY.':'Matches the reference result, including column names and row order.'};
}
