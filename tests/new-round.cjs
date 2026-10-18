const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
require.extensions[".ts"]=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText,filename);

const {ROUND_TEAMS,parseNewRound}=require("../app/lib/new-round.ts");
const {mergeFixtures}=require("../app/lib/match-details.ts");
const {quizFixtures}=require("../app/lib/quiz-fixtures.ts");

const details=team=>({
 teamLabel:team,opponent:"Rival de prueba",date:"24/10/2026",time:"16:30",
 venue:"Ibaiondo",location:"Derio",derioPosition:null,opponentPosition:null,
 derioPoints:null,opponentPoints:null,derioForm:"VEVDV",opponentForm:"EDVVE",
 crest:"/api/assets/Escudos/example.webp?normalize=1",
 competition:"Liga Vasca",federationRound:4
});
const games=ROUND_TEAMS.map(team=>team==="Cadete B"?
 {team,status:"rest",competition:"Cadete",federationRound:4}:
 {team,status:"scheduled",is_home:false,details:details(team)});
const payload={round:4,games};
const parsed=parseNewRound(payload);
assert.equal(parsed.round,4);
assert.equal(parsed.games.length,7);
assert.equal(parsed.games.filter(g=>g.status==="scheduled").length,6);
assert.equal(parsed.games.find(g=>g.team==="Cadete B").status,"rest");
assert.equal(parsed.games.find(g=>g.team==="Derio B").details.crest,"/api/assets/Escudos/example.webp?normalize=1");
assert.equal(parsed.games.find(g=>g.team==="Derio A").scheduled_at,"2026-10-24T14:30:00.000Z");
const live=parsed.games.filter(g=>g.status==="scheduled").map(g=>({
 round:4,team:g.team,opponent:g.opponent,is_home:g.is_home,
 scheduled_at:g.scheduled_at,fixture_details:g.details
}));
const rest=[{round:4,team:"Cadete B",competition:"Cadete",federation_round:4}];
const merged=mergeFixtures(live,rest);
assert.equal(merged[4]["Derio B"].opponent,"Rival de prueba");
assert.equal(merged[4]["Derio A"].crest,"/api/assets/Escudos/example.webp?normalize=1");
assert.equal(merged[4]["Derio A"].federationRound,4);
assert.equal(merged[4]["Cadete B"].status,"rest");
assert.equal(merged[4]["Cadete B"].opponent,undefined);
assert.equal(quizFixtures[4],undefined,"Published source fixtures remain immutable");
assert.equal(quizFixtures[3]["Derio A"].opponent,"Touring","Earlier rounds cannot be overwritten");

assert.throws(()=>parseNewRound({...payload,games:games.slice(1)}),/siete/);
assert.throws(()=>parseNewRound({...payload,games:games.map((g,i)=>i===2?{...g,team:"Derio A"}:g)}),/duplicado/);
assert.throws(()=>parseNewRound({...payload,round:0}),/jornada/i);
assert.throws(()=>parseNewRound({...payload,games:games.map(g=>({...g,status:"rest"}))}),/al menos un partido/);
assert.throws(()=>parseNewRound({...payload,games:games.map((g,i)=>i===0?{...g,is_home:undefined}:g)}),/local o visitante/);
assert.throws(()=>parseNewRound({...payload,games:games.map((g,i)=>i===0?{...g,details:{...g.details,crest:"https://evil.example/crest.jpg"}}:g)}),/Escudo no válido/);
assert.throws(()=>parseNewRound({...payload,games:games.map((g,i)=>i===0?{...g,details:{...g.details,date:"31/02/2026"}}:g)}),/Fecha no válida/);
assert.throws(()=>parseNewRound({...payload,games:games.map((g,i)=>i===0?{...g,details:{...g.details,derioForm:"ABCDE"}}:g)}),/forma/i);
console.log("Passed: 7-club round creation, bye, crest validation, kickoff and immutable prior results.");
