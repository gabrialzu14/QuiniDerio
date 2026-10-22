const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
require.extensions[".ts"]=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {summarizeVotes,roundPosition,roundPotContribution}=require("../app/lib/engagement.ts");
assert.deepEqual(summarizeVotes(["1","1","X","2","invalid"]).counts,[2,1,1]);
assert.deepEqual(summarizeVotes(["1","1","X","2"]).percentages,[50,25,25]);
assert.deepEqual(summarizeVotes(["1","X","2"]).percentages,[34,33,33]);
assert.equal(summarizeVotes(["1","X","2"]).percentages.reduce((a,b)=>a+b,0),100);
assert.deepEqual(summarizeVotes([]).percentages,[0,0,0]);
assert.equal(summarizeVotes(["x","undefined"]).total,0);
const scores=[
 {user_id:"a",round:1,hits:5},{user_id:"b",round:1,hits:3},{user_id:"c",round:1,hits:3},
 {user_id:"a",round:2,hits:2},{user_id:"b",round:2,hits:6},{user_id:"c",round:2,hits:4}
];
assert.equal(roundPosition(scores,"a",1),1);
assert.equal(roundPosition(scores,"b",1),2);
assert.equal(roundPosition(scores,"a",2),2);
assert.equal(roundPosition(scores,"b",2),1);
assert.equal(roundPosition(scores,"a",2,true),3);
assert.equal(roundPosition(scores,"missing",2),null);
assert.equal(roundPotContribution(scores,"a",2,7),2);
assert.equal(roundPotContribution(scores,"c",2,7),1);
assert.equal(roundPotContribution(scores,"b",2,6),-3);
assert.equal(roundPotContribution(scores,"missing",2,7),null);
assert.equal(roundPotContribution(scores,"b",2,0),null);
const {makeTrendTimeline,trendStageProgress,TREND_ENTRANCE_MS}=require("../app/lib/vote-timeline.ts");
const timeline=makeTrendTimeline([62,25,13]);
assert.equal(TREND_ENTRANCE_MS,140);
assert.deepEqual(timeline.stages.map(stage=>stage.start),[140,970,1700]);
assert.deepEqual(timeline.stages.map(stage=>stage.end),[880,1610,2440]);
assert.equal(timeline.end,2440);
for(let i=1;i<3;i++)assert.ok(timeline.stages[i].start>timeline.stages[i-1].end,"Stages must never overlap");
for(const stage of timeline.stages){
 assert.equal(trendStageProgress(stage.start-50,stage),0);
 assert.equal(trendStageProgress(stage.start,stage),0);
 assert.ok(Math.abs(trendStageProgress(stage.start+stage.duration/2,stage)-.5)<1e-8);
 assert.equal(trendStageProgress(stage.end,stage),1);
 assert.equal(trendStageProgress(stage.end+100,stage),1);
 let last=0;
 for(let j=0;j<=100;j++){
  const value=trendStageProgress(stage.start+stage.duration*j/100,stage);
  assert.ok(value>=last-1e-9&&value<=1,"Each animation segment must grow monotonically");
  last=value;
 }
}
const withZero=makeTrendTimeline([0,60,40]);
assert.equal(withZero.stages[0].duration,0);
assert.equal(withZero.stages[1].start,140);
assert.equal(withZero.stages[2].start,870);
assert.equal(withZero.end,1610);
assert.equal(makeTrendTimeline([0,0,100]).stages[2].start,140);
assert.equal(makeTrendTimeline([100,0,0]).end,880);
console.log("Passed engagement: percentages, ranking, pot and sequential blue-white-red timeline.");

const {latestRoundSnapshot,recapSeenKey,FIRST_RECAP_ROUND}=require("../app/lib/round-recap.ts");
const fixtures={3:{a:{},b:{status:"rest"}},4:{a:{},b:{status:"rest"}},5:{a:{},b:{}},6:{a:{},b:{}}};
const ownScores=[{user_id:"a",round:3,hits:1},{user_id:"a",round:4,hits:1},{user_id:"a",round:5,hits:1},{user_id:"a",round:6,hits:2}];
const matches=[{round:3,team:"a",status:"finished"},{round:4,team:"a",status:"finished"},{round:5,team:"a",status:"final"},{round:5,team:"b",status:"finished"},{round:6,team:"a",status:"finished"},{round:6,team:"b",status:"scheduled"}];
assert.equal(FIRST_RECAP_ROUND,4);
assert.equal(latestRoundSnapshot(fixtures,matches,ownScores,"a",3),null,"Completed past rounds never launch a recap");
assert.equal(latestRoundSnapshot(fixtures,matches,ownScores,"a",6).round,5,"Next access finds the last eligible complete round");
assert.equal(latestRoundSnapshot(fixtures,matches,ownScores,"a",4).played,1,"Byes are not missing matches");
for(const status of ["scheduled","suspended","postponed","live"]){
 const pending=matches.map(m=>m.round===4?{...m,status}:m);
 assert.equal(latestRoundSnapshot(fixtures,pending,ownScores,"a",4),null,"Incomplete J4 must not fall back to completed J3");
}
assert.equal(latestRoundSnapshot(fixtures,matches.filter(m=>m.round!==4),ownScores,"a",4),null);
assert.equal(latestRoundSnapshot(fixtures,matches,ownScores,"a",4).round,4,"A complete J4 is eligible");
assert.equal(latestRoundSnapshot(fixtures,matches,ownScores,"nobody",6),null);
assert.notEqual(recapSeenKey("a",4),recapSeenKey("b",4));
assert.notEqual(recapSeenKey("a",4),recapSeenKey("a",5));
console.log("Passed recap: J4 launch boundary, no past-round fallback, latest completion, unresolved/missing matches, byes, participation and seen keys.");

const {roundNeedsRefresh}=require("../app/lib/live-window.ts");
const windowFixture={a:{date:"25/10/2026",time:"16:30"}};
const kickoff=Date.parse("2026-10-25T15:30:00Z");
assert.equal(roundNeedsRefresh(windowFixture,[],kickoff-16*60000),false);
assert.equal(roundNeedsRefresh(windowFixture,[],kickoff-14*60000),true);
assert.equal(roundNeedsRefresh(windowFixture,[{team:"a",status:"finished"}],kickoff),false);
assert.equal(roundNeedsRefresh(windowFixture,[{team:"a",status:"suspended"}],kickoff),false);
assert.equal(roundNeedsRefresh(windowFixture,[{team:"a",status:"live"}],kickoff+5*3600000),true);
assert.equal(roundNeedsRefresh(windowFixture,[],kickoff+5*3600000),false);
console.log("Passed live refresh window: Madrid kickoff/DST, early/late, final/suspended, live overtime.");
