const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),Module=require('node:module');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='anon-test';
let failed=false,tableCalls=[];
const original=Module._load;Module._load=function(name,...args){
 if(name==='next/cache')return {unstable_cache:fn=>fn};
 if(name==='@supabase/supabase-js')return {createClient:(url,key)=>{assert.equal(key,'anon-test');return {from:table=>{
  tableCalls.push(table);let round=4;
  const result=()=>({error:failed?new Error('offline'):null,data:table==='quini_app_settings'?{active_round:4}:table==='quini_rest_fixtures'?[]:[{round,team:'Derio A',opponent:'Rival',is_home:true,scheduled_at:'2026-10-24T14:30:00Z',fixture_details:null,home_score:2,away_score:1,status:'live',updated_at:'2026-10-24T15:00:00Z'}]});
  const chain={select:()=>chain,eq:(key,value)=>{if(key==='round')round=value;return chain},single:async()=>result(),then:(resolve,reject)=>Promise.resolve(result()).then(resolve,reject)};return chain;
 }}}};
 return original.call(this,name,...args);
};
const {GET}=require('../app/api/widgets/route.ts');
const {NextRequest}=require('next/server');
const req=(q='',etag)=>new NextRequest('https://quiniderio.vercel.app/api/widgets'+q,{headers:etag?{'If-None-Match':etag}:{}});
(async()=>{
 const before=tableCalls.length;assert.equal((await GET(req('?round=999'))).status,400);assert.equal(tableCalls.length,before);
 assert.equal((await GET(req('?round=4abc'))).status,400);
 assert.equal((await GET(req('?round=5'))).status,404);
 const response=await GET(req());assert.equal(response.status,200);const data=await response.json();assert.equal(data.round,4);assert.equal(data.matches[0].homeScore,2);
 assert.deepEqual(Object.keys(data).sort(),['version','round','fetchedAt','sourceUpdatedAt','matches','url'].sort());
 assert.ok(response.headers.get('cache-control').includes('s-maxage=30'));
 // Freeze the clock so the same origin snapshot has the same ETag.
 const RealDate=Date;global.Date=class extends RealDate{constructor(...v){super(...(v.length?v:['2026-10-24T15:10:00Z']))}};
 const a=await GET(req());const b=await GET(req('',a.headers.get('etag')));assert.equal(b.status,304);global.Date=RealDate;
 const historical=await GET(req('?round=3'));assert.equal(historical.status,200);assert.equal((await historical.json()).round,3);
 failed=true;const error=await GET(req());assert.equal(error.status,503);assert.equal(error.headers.get('cache-control'),'no-store');
 assert.ok(tableCalls.every(t=>['quini_app_settings','quini_live_matches','quini_rest_fixtures'].includes(t)));
 console.log('Passed widget API: validation, active/historical/future rounds, anonymous-only data, ETag and offline errors.');
})().catch(e=>{console.error(e);process.exitCode=1});
