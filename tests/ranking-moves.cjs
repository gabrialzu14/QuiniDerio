const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'..','app/lib/ranking-moves.ts'),'utf8');
const context={exports:{},Map,Math,Number};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const {rankingMoves}=context.exports;
const s=(user_id,round,hits)=>({user_id,round,hits});

// A overtakes B in jornada 2; C stays third.
let moves=rankingMoves([{user_id:'A',hits:10},{user_id:'B',hits:9},{user_id:'C',hits:8}],
 [s('A',1,5),s('B',1,6),s('C',1,2),s('A',2,5),s('B',2,3),s('C',2,6)]);
assert.equal(moves.get('A'),1,'A climbs one place');
assert.equal(moves.get('B'),-1,'B drops one place');
assert.equal(moves.get('C'),0,'C keeps its place');

// Players tied before and now keep the displayed order: no fake movement.
moves=rankingMoves([{user_id:'J',hits:22},{user_id:'M',hits:22}],[s('J',1,10),s('M',1,10),s('J',2,12),s('M',2,12)]);
assert.equal(moves.get('J'),0);assert.equal(moves.get('M'),0);

// Hits arrive as strings from some views; a newcomer without earlier rounds counts as 0.
moves=rankingMoves([{user_id:'N',hits:'7'},{user_id:'O',hits:'4'}],[s('O',1,'4'),s('N',2,'7')]);
assert.equal(moves.get('N'),1,'Newcomer with the latest round only climbs from last');
assert.equal(moves.get('O'),-1);

// Only one scored jornada: nothing to compare with.
assert.equal(rankingMoves([{user_id:'A',hits:3}],[s('A',1,3)]).size,0);
assert.equal(rankingMoves([],[]).size,0);
console.log('Passed ranking moves: overtakes, drops, ties without fake movement, string hits, newcomers and single-round seasons.');
