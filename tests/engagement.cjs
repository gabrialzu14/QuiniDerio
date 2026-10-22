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
