const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
const Module=require("node:module");
const originalLoad=Module._load;
require.extensions[".ts"]=(module,filename)=>module._compile(ts.transpileModule(
 fs.readFileSync(filename,"utf8"),
 {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}
).outputText,filename);
const {summarizePlayerPerformance}=require("../app/lib/player-performance.ts");
const matches=[
 ...Array.from({length:6},(_,i)=>({round:1,status:i===5?"suspended":"finished"})),
 ...Array.from({length:7},()=>({round:2,status:"finished"})),
 ...Array.from({length:7},(_,i)=>({round:3,status:i===6?"scheduled":"finished"}))
];
const scores=[
 {user_id:"one",round:1,hits:3,picks_count:5},
 {user_id:"one",round:2,hits:4,picks_count:7},
 {user_id:"one",round:3,hits:6,picks_count:6},
 {user_id:"two",round:1,hits:1,picks_count:2}
];
const one=summarizePlayerPerformance(scores,matches,"one");
assert.deepEqual(one,{percentage:58,pointsPerRound:3.5,hits:7,evaluatedPicks:12,completedRounds:2});
const zero=summarizePlayerPerformance(scores,matches,"none");
assert.deepEqual(zero,{percentage:null,pointsPerRound:0,hits:0,evaluatedPicks:0,completedRounds:2});
const none=summarizePlayerPerformance(scores,[{round:4,status:"scheduled"}],"one");
assert.deepEqual(none,{percentage:null,pointsPerRound:null,hits:0,evaluatedPicks:0,completedRounds:0});
const allSuspended=summarizePlayerPerformance(scores,[{round:1,status:"suspended"}],"one");
assert.equal(allSuspended.completedRounds,0);
console.log("Passed participant performance: finished-only hit rate, suspended fixture closure, zero-point rounds and partial exclusion.");

const sheet=fs.readFileSync(require("node:path").join(__dirname,"../app/components/PlayerRoundSheet.tsx"),"utf8");
const sheetStyles=fs.readFileSync(require("node:path").join(__dirname,"../app/components/player-round-sheet.css"),"utf8");
const header=sheet.slice(sheet.indexOf('<header className="qdPlayerRoundHeader">'),sheet.indexOf('<div ref={tabsRoot}'));
assert.match(header,/className="playerStatsIdentity"/);
assert.match(header,/className="qdPlayerSeasonMetrics"/);
assert.ok(header.indexOf('className="qdPlayerSeasonMetrics"')>header.indexOf('className="playerStatsIdentity"'));
assert.match(header,/qdPlayerStatAccuracy/);
assert.match(header,/qdPlayerStatAverage/);
assert.match(header,/<span>Acierto<\/span>/);
assert.match(header,/<small> Pts<\/small>/);
assert.match(header,/<span>Media<\/span>/);
assert.match(sheetStyles,/\.qdPlayerStatCard strong small/);
assert.match(sheetStyles,/@media\(max-width:390px\)/);
console.log("Passed QuiniDerio compact player season stat cards.");
