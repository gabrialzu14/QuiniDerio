const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/lib/coach-change.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const {normalizeCoachPredictions,currentCoachName,DERIO_COACH_CHANGE}=context.exports;
const original=Object.freeze({positions:Object.freeze({'Derio A':'7'}),firstCoach:'Nando Alonso',coachCards:'Nando Alonso',firstDelegate:'Gabri Alzueta',assistantCoachCards:'David Perez',extra:'Nando Alonso'});
const migrated=normalizeCoachPredictions(original);
assert.equal(migrated.firstCoach,'Aner Blanco');assert.equal(migrated.coachCards,'Aner Blanco');
assert.equal(original.firstCoach,'Nando Alonso','No mutation of cached input');
for(const key of Object.keys(original).filter(k=>!['firstCoach','coachCards'].includes(k)))assert.equal(migrated[key],original[key],'Unrelated choices and positions stay untouched');
assert.equal(normalizeCoachPredictions(migrated),migrated,'Repeated migration is idempotent');
const other={firstCoach:'Peio Garcia',coachCards:'Ibai Mateos'};
assert.equal(normalizeCoachPredictions(other),other,'Other coaches stay untouched');
assert.equal(currentCoachName('Nando Alonso'),'Aner Blanco');
assert.equal(currentCoachName('Aner Taranilla'),'Aner Taranilla','Do not confuse Aner with another staff member');
assert.equal(currentCoachName(''),'');
assert.equal(normalizeCoachPredictions({}).firstCoach,undefined,'Incomplete drafts remain incomplete');
for(const key of ['photo','photoLarge','previousPhoto'])assert.ok(fs.statSync('public'+DERIO_COACH_CHANGE[key]).size>0);
console.log('Passed coach continuity: both choices, immutable drafts, idempotence, other coaches/positions unchanged, versioned portraits.');

const {coachPredictionImpacts}=context.exports;
const input=[
 {user_id:'4',username:'Elena',season:{firstCoach:'Aner Blanco',coachCards:'Ibai Mateos'}},
 {user_id:'3',username:'Carlos',season:{firstCoach:'Peio Garcia',coachCards:'Aner Blanco'}},
 {user_id:'1',username:'Ana',has_profile_pic:true,season:{firstCoach:'Aner Blanco',coachCards:'Peio Garcia'}},
 {user_id:'2',username:'Bruno',season:{firstCoach:'Aner Blanco',coachCards:'Peio Garcia'}},
 {user_id:'5',username:'Diego',season:{firstCoach:'Aner Blanco',coachCards:'Peio Garcia'}},
 {user_id:'6',username:'Otro',season:{firstCoach:'Ibai Mateos',coachCards:'Peio Garcia',firstDelegate:'Aner Blanco'}},
 {user_id:'7',username:'Sin completar',season:null},
 {user_id:'8',username:'Mal formado',season:[]},
];
const before=JSON.stringify(input);
const impacts=coachPredictionImpacts(input);
assert.deepEqual(Array.from(impacts,p=>p.name),['Ana','Bruno','Carlos','Diego','Elena']);
assert.equal(impacts.reduce((sum,p)=>sum+p.changes.length,0),5);
assert.deepEqual(Array.from(impacts.find(p=>p.name==='Carlos').changes,c=>c.field),['coachCards']);
assert.equal(impacts.filter(p=>p.changes[0].field==='firstCoach').length,4);
assert.equal(impacts[0].hasProfilePic,true);
assert.equal(JSON.stringify(input),before,'Reading the notice must not write or mutate any predictions');
const both=coachPredictionImpacts([{user_id:'both',username:'Dos elecciones',season:{firstCoach:'Nando Alonso',coachCards:'Aner Blanco'}}]);
assert.equal(both.length,1);assert.equal(both[0].changes.length,2,'Group both affected choices under the same participant');
assert.equal(coachPredictionImpacts([{user_id:'no',username:'Sin cambios',season:{firstCoach:'Aner Taranilla',coachCards:'Nando'}}]).length,0);
assert.equal(impacts.find(p=>p.name==='Carlos').changes[0].cardColor,'yellow','Most cards uses the yellow card');
assert.equal(impacts.find(p=>p.name==='Ana').changes[0].cardColor,'red','First dismissal uses the red card');
assert.match(DERIO_COACH_CHANGE.announcementId,/-v3$/,'Reissue the clearer two-part notice without deleting earlier acknowledgements');
console.log('Passed impact detail: five participants, four first-dismissal choices, one most-cards choice, grouping, legacy names, unrelated fields, invalid drafts and reissue identity.');
