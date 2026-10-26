const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
require.extensions[".ts"]=(module,filename)=>module._compile(
 ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020
 }}).outputText,filename);
const {buildRoundDefaults}=require("../app/lib/round-defaults.ts");
const make=(round,base,status,home,own,other,fed)=>({
 round,team:"Derio A",status,is_home:home,
 home_score:home?own:other,away_score:home?other:own,
 fixture_details:{derioPoints:base,derioForm:"VV",federationRound:fed}
});
const matches=[
 make(3,12,"finished",true,2,1,8),
 make(4,15,"finished",false,0,0,9)
];
const rows=buildRoundDefaults(matches,[],5);
assert.equal(rows["Derio A"].derioPoints,16,"win then draw adds three plus one, once");
assert.equal(rows["Derio A"].federationRound,10);
assert.equal(rows["Derio A"].restFederationRound,9);
assert.equal(rows["Derio A"].derioForm,"VVVE");
assert.equal(buildRoundDefaults(matches,[],5)["Derio A"].derioPoints,16,"idempotent");
const reopen=[matches[0],{...matches[1],status:"live"}];
assert.equal(buildRoundDefaults(reopen,[],5)["Derio A"].derioPoints,15,"reopened scores excluded");
const rest=buildRoundDefaults([matches[0]],[{round:4,team:"Derio A",federation_round:8}],5);
assert.equal(rest["Derio A"].federationRound,9,"a bye does not consume another played round");
assert.equal(rest["Derio A"].restFederationRound,8);
assert.equal(buildRoundDefaults([{...matches[0],fixture_details:{}}],[],5)["Derio A"].derioPoints,null,"do not invent historical standings");
assert.equal(buildRoundDefaults([{...matches[0],status:"suspended"}],[],5)["Derio A"].derioPoints,12,"suspension gives zero points");
console.log("Passed: cumulative league points, reopens, bye, no missing-baseline guesses.");
