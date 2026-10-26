const assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript"),Module=require("node:module");
require.extensions[".ts"]=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText,filename);
process.env.NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co";process.env.SUPABASE_SERVICE_ROLE_KEY="test-only";
const row={round:5,team:"Derio A",opponent:"Pasaia",is_home:false,status:"finished",home_score:2,away_score:1,yellow_cards:0,red_cards:0,fixture_details:{}};
const cards=[];
function db(){return {auth:{getUser:async token=>({data:{user:{email:token==="admin"?"gabrialzueta@gmail.com":"other@example.com"}}})},
 from(table){const s={filter:{},patch:null,head:false};const q={
 select(_col,opt){if(opt?.head)s.head=true;return q},
 eq(col,val){s.filter[col]=val;return q},
 single:async()=>({data:s.patch?{...row,...s.patch}:row,error:null}),
 insert:async record=>{assert.equal(table,"quini_match_cards");cards.push(record);return {error:null}},
 update(patch){assert.equal(table,"quini_live_matches");s.patch=patch;return q},
 then(ok,bad){if(table!=="quini_match_cards"||!s.head)throw Error("unexpected query");return Promise.resolve({count:cards.filter(c=>c.round===s.filter.round&&c.team===s.filter.team&&c.card_type===s.filter.card_type).length,error:null}).then(ok,bad)}
 };return q}}}
const orig=Module._load;Module._load=function(name,...args){if(name==="@supabase/supabase-js")return {createClient:()=>db()};return orig.call(this,name,...args)};
const {POST}=require("../app/api/admin/live/route.ts");
const req=(cardType="yellow",token="admin")=>new Request("http://localhost/api/admin/live",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({round:5,team:"Derio A",action:"addCard",person:"Nando Alonso",cardType})});
(async()=>{
 assert.equal((await POST(req("yellow","other"))).status,403);
 row.status="scheduled";assert.equal((await POST(req())).status,409);assert.equal(cards.length,0);
 row.status="suspended";assert.equal((await POST(req())).status,409);
 row.status="finished";
 const a=await POST(req());assert.equal(a.status,200);
 const yellow=await a.json();assert.equal(yellow.status,"finished");assert.equal(yellow.home_score,2);assert.equal(yellow.away_score,1);assert.equal(yellow.yellow_cards,1);
 const b=await POST(req("red"));assert.equal(b.status,200);const red=await b.json();assert.equal(red.status,"finished");assert.equal(red.red_cards,1);assert.equal(red.yellow_cards,1);
 row.status="live";assert.equal((await POST(req())).status,200);
 const page=fs.readFileSync(require.resolve("../app/admin/page.tsx"),"utf8");
 assert(!page.includes('className="adminSummary"'));
 assert.equal(page.split('disabled={locked||(m.status!=="live"&&m.status!=="finished")}').length-1,2);
 assert(page.includes("Puedes añadir o eliminar tarjetas sin reabrir el partido."));
 assert(page.includes('className="adminViewTabs"'));
 console.log("Passed: yellow/red after finished, score unchanged, scheduled/suspended restricted, summary removed, tabs retained.");
})().catch(e=>{console.error(e);process.exit(1)});
