const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
// Tiny TS module loader for relative imports.
const cache={};
function load(file){
 const full=path.resolve(file.endsWith('.ts')?file:file+'.ts');
 if(cache[full])return cache[full].exports;
 const mod={exports:{}};cache[full]=mod;
 const out=ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(out,{exports:mod.exports,module:mod,require:p=>p.startsWith('.')?load(path.join(path.dirname(full),p)):require(p),Intl,Date,Number,String,JSON,URLSearchParams,Set,Map,Object,Array,Math,encodeURIComponent,decodeURIComponent});
 return mod.exports;
}
const F=load(path.join(__dirname,'..','app/lib/federation-import.ts'));

assert.equal(F.sameTeam('Eibar C','EIBAR SAD, S.D. "C"'),true);
assert.equal(F.sameTeam('CD Alegría','ALEGRIA, C.D.'),true);
assert.equal(F.sameTeam('Sondika B','SONDIKA "B"'),true);
assert.equal(F.sameTeam('Sondika B','SONDIKA "C"'),false,'The team letter must match');

const row=(round,team,fd)=>({round,team,opponent:fd.opponent||'Sondika B',is_home:false,scheduled_at:null,status:'scheduled',fixture_details:{teamLabel:team,opponent:fd.opponent||'Sondika B',date:'',time:'',venue:'',location:'',derioPosition:null,opponentPosition:null,derioPoints:null,opponentPoints:null,derioForm:'',opponentForm:'',...fd}});
const rows=[row(7,'Derio B',{federationRound:9}),row(8,'Derio B',{federationRound:10}),{...row(6,'Derio B',{federationRound:8}),status:'finished'}];

// Calendar of federation J9 -> QuiniDerio jornada 7.
const cal=F.planImport({k:'cal',g:'24109682',j:9,m:[{h:'GALEA "B"',a:'LEZAMA',d:'14-11-2026',t:'15:30',f:'BOLUE 3'},{h:'DERIO "B"',a:'SONDIKA "B"',d:'15-11-2026',t:'12:00',f:'IBAIONDO'}]},rows);
assert.equal(cal.round,7);assert.equal(cal.details.date,'15/11/2026');assert.equal(cal.details.time,'12:00');assert.equal(cal.details.venue,'Ibaiondo');
assert.equal(cal.details.federationOpponent,'SONDIKA "B"');
assert.deepEqual(cal.changes.map(c=>c.field).sort(),['date','federationOpponent','time','venue']);

// Standings after J8 -> context for J9 (QuiniDerio jornada 7); the rival is found by its federation name.
const withOpp=[{...rows[0],fixture_details:{...rows[0].fixture_details,federationOpponent:'SONDIKA "B"'}},rows[1]];
const cla=F.planImport({k:'cla',g:'24109682',j:8,r:[{p:1,n:'SONDIKA "B"',pt:21,fo:'GGGGG'},{p:12,n:'DERIO "B"',pt:9,fo:'EGGEP'}]},withOpp);
assert.equal(cla.round,7);
assert.equal(cla.details.derioPosition,12);assert.equal(cla.details.derioPoints,9);assert.equal(cla.details.derioForm,'EVVED');
assert.equal(cla.details.opponentPosition,1);assert.equal(cla.details.opponentForm,'VVVVV');

// Guard rails.
assert.match(F.planImport({k:'cal',g:'999',j:1,m:[]},rows).error,/ningún equipo/);
assert.match(F.planImport({k:'cal',g:'24109682',j:30,m:[{h:'DERIO "B"',a:'X',d:'',t:'',f:''}]},rows).error,/Crea antes la jornada/);
assert.equal(F.planImport({k:'cal',g:'24109682',j:8,m:[{h:'DERIO "B"',a:'X',d:'',t:'',f:''}]},rows).error!==undefined,true,'Finished jornadas are never changed');

// Hash decoding and bookmarklet target.
const payload=F.decodeFederationHash('#fed='+encodeURIComponent(JSON.stringify({k:'cla',g:'24109682',j:'8',r:[{p:'1',n:'A',pt:'3',fo:'G'}]})));
assert.equal(payload.j,8);assert.equal(payload.r[0].p,1);
assert.equal(F.decodeFederationHash('#fed=%7Bbad'),null);
const code=F.bookmarkletCode('https://quiniderio.vercel.app');
assert.ok(code.startsWith('javascript:'));
assert.match(decodeURIComponent(code),/https:\/\/quiniderio\.vercel\.app\/admin#fed=/);
assert.doesNotMatch(decodeURIComponent(code),/ntype|resultado/i,'The bookmarklet never reads scores');
console.log('Passed federation import: team matching, calendar and standings plans, finished jornadas untouched, hash decoding and bookmarklet.');
