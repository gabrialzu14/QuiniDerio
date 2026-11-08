const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'..','app/lib/live-minute.ts'),'utf8');
const context={exports:{},Date,Math,Number};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const {liveClock,halfLengthFor}=context.exports;
const start='2026-11-08T15:15:00Z',at=min=>Date.parse(start)+min*60000+30000;
const label=(team,min,started=start,scheduled=null)=>liveClock(team,started,scheduled,at(min))?.label??null;

assert.equal(halfLengthFor('Cadete B'),40);assert.equal(halfLengthFor('Derio A'),45);assert.equal(halfLengthFor('Juvenil A'),45);
// 45-minute halves.
assert.equal(label('Derio A',0),"1'");
assert.equal(label('Derio A',44),"45'");
assert.equal(label('Derio A',45),'Descanso');
assert.equal(label('Derio A',59),'Descanso');
assert.equal(label('Derio A',60),"46'");
assert.equal(label('Derio A',104),"90'");
assert.equal(label('Derio A',105),"90+'");
// Cadete: 40-minute halves.
assert.equal(label('Cadete B',39),"40'");
assert.equal(label('Cadete B',40),'Descanso');
assert.equal(label('Cadete B',55),"41'");
assert.equal(label('Cadete B',94),"80'");
assert.equal(label('Cadete B',95),"80+'");
// Falls back to the scheduled kickoff; nothing before kickoff or without a time.
assert.equal(label('Derio Fem',22,null,start),"23'");
assert.equal(liveClock('Derio A',start,null,Date.parse(start)-60000),null);
assert.equal(liveClock('Derio A',null,null,Date.now()),null);
console.log("Passed live minute: 45' and 40' halves, 15' break, stoppage time, scheduled fallback and pre-kickoff.");
