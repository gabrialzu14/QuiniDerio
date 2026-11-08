const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const context = {exports: {}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/lib/first-coach-expulsion.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText, context);
const {FIRST_COACH_EXPULSION: notice, firstCoachNoticeState: state} = context.exports;
const coachChange = 'derio-a-aner-blanco-2026-11-07-v3';
const rows = Object.freeze([Object.freeze({announcement_id: coachChange})]);
assert.equal(state([], coachChange), 'waiting', 'The new notice cannot skip the coach-change notice');
assert.equal(state([{announcement_id: 'derio-a-aner-blanco-2026-11-07-v2'}], coachChange), 'waiting', 'An older coach notice does not bypass the current two-part notice');
assert.equal(state(rows, coachChange), 'ready', 'The complete coach-change acknowledgement unlocks the new notice');
assert.equal(state([{announcement_id: notice.announcementId}], coachChange), 'seen', 'A read notice stays read even when the preceding notice changes');
assert.equal(state([...rows, {announcement_id: notice.announcementId}], coachChange), 'seen', 'A confirmed notice never repeats on another device');
assert.equal(state([{announcement_id: 'unrelated-notice'}], coachChange), 'waiting', 'Other announcements cannot unlock the coach dismissal');
assert.equal(rows.length, 1, 'Queue checks never mutate the server response');
assert.equal(notice.name, 'PEIO GARCIA');
assert.equal(notice.team, 'Juvenil A');
assert.ok(notice.announcementId.length <= 100, 'The notice fits the existing acknowledgement constraint');
console.log('Passed first-coach notice: ordered delivery, current coach-change prerequisite, independent acknowledgement, no repetition or mutation.');
