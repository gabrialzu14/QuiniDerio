const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'..','supabase/functions/federation-sync/parse.ts'),'utf8');
const context={exports:{},Intl,Date,Number,String};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const P=context.exports;

// Minimal copy of the federation jornada layout (two fixtures, one with Derio).
const match=(home,away,date,time,field)=>`<tr style="background-color: #ffffff00;">
 <td class=td_widget><div class=wrapper_widget><div class=font_widgetL> <h4> &nbsp; ${home} </h4> </div></div></td>
 <td><h4><strong><span class="wid2_resultado_cerrada ntype"><i class=fa-solid><style>#x:before{content:"4"}</style><span style="display:none;">5</span></i></span></strong></h4>
 <span class=horario> ${date} </span><br><span class=horario> ${time} </span></td>
 <td class=td_widget><div class=wrapper_widget2><div class=font_widgetV> <h4> ${away} </h4> </div></div></td></tr>
 <tr><td colspan=9><a href="/pnfg/NPcd/NFG_VisCampos?Codigo_Campo=1"> ${field} </a></td></tr></tbody>`;
const calendar=match('GALEA "B"','LEZAMA','07-11-2026','15:30','BOLUE 3')+match('SONDIKA &quot;B&quot;','DERIO "B"','07-11-2026','18:30','BASOZABAL 2');
const matches=P.parseCalendar(calendar);
assert.equal(matches.length,2);
assert.deepEqual({...matches[1]},{home:'SONDIKA "B"',away:'DERIO "B"',date:'07/11/2026',time:'18:30',field:'BASOZABAL 2'},'Teams, date, time and field are read from visible text');
const d=P.derioMatch(matches);
assert.equal(d.isHome,false);assert.equal(d.opponent,'SONDIKA "B"');
assert.deepEqual(Object.keys(matches[0]).sort(),['away','date','field','home','time'],'Only teams, date, time and field: the protected score is never read');

// Minimal standings table: position, team, points, ..., last results (G/E/P), sanction.
const row=(pos,team,pts,form)=>`<tr><td>&nbsp;</td><td> ${pos} </td><td><a> ${team} </a></td><td>${pts}</td><td>4</td><td>1</td><td>2</td><td>1</td><td>4</td><td>1</td><td>1</td><td>2</td><td>11</td><td>15</td><td> ${form.split('').map(c=>`&nbsp;<span title=x>${c}</span>`).join('')} </td><td>0&nbsp;</td></tr>`;
const standings=`<table><tr><th>Taldeak</th><th>Puntuak</th></tr>${row(1,'SONDIKA "B"',21,'GGGGG')}${row(12,'DERIO "B"',9,'EGGEP')}</table>`;
const rows=P.parseStandings(standings);
assert.equal(rows.length,2);
assert.deepEqual({...P.standingOf(rows,'DERIO "B"')},{position:12,team:'DERIO "B"',points:9,form:'EVVED'},'G/E/P become V/E/D, oldest first');
assert.equal(P.standingOf(rows,'Sondika  "b"').points,21,'Names match regardless of case and spacing');

assert.equal(P.displayName('EIBAR SAD, S.D. "C"'),'Eibar Sad C');
assert.equal(P.displayName('LEZAMA'),'Lezama');
assert.equal(P.kickoffIso('07/11/2026','18:30'),'2026-11-07T17:30:00.000Z','Winter time is UTC+1');
assert.equal(P.kickoffIso('04/10/2026','18:30'),'2026-10-04T16:30:00.000Z','Summer time is UTC+2');
assert.equal(P.kickoffIso('','18:30'),null);
console.log('Passed federation reader: fixtures by side, date/time/field, no scores, standings, form, names and Madrid time.');
