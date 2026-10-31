const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=(p)=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const globals=read("app/globals.css");
const light=read("app/light-theme.css");
const quiniela=read("app/quiniela-visual.css");
const nav=read("app/components/bottom-navigation.css");
const page=read("app/page.tsx");
const admin=read("app/admin/admin.css");
function luma(hex){
  const n=hex.replace("#","");
  const c=[0,2,4].map(i=>parseInt(n.slice(i,i+2),16)/255);
  const v=c.map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
  return .2126*v[0]+.7152*v[1]+.0722*v[2];
}
function ratio(a,b){let x=luma(a),y=luma(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
const pairs=[
  ["Primary light text","#152e46","#ffffff"],
  ["Secondary light text","#4e647b","#ffffff"],
  ["My forecast","#123e66","#edf5fd"],
  ["Fixture date","#52647a","#ffffff"],
  ["All inactive pick labels","#edf5ff","#143b69"],
  ["Local active label","#ffffff","#176ed5"],
  ["Away active label","#ffffff","#c92949"],
  ["Navigation inactive","#365571","#e3f2fe"],
  ["Navigation active","#12528e","#e3f2fe"],
  ["Correct pick","#126343","#e3f5eb"]
];
for(const [label,ink,bg] of pairs){const cr=ratio(ink,bg);assert.ok(cr>=4.5,label+" fails text contrast: "+cr.toFixed(2));}
assert.match(globals,/html:not\(\[data-theme="light"\]\) \.predictionsPage \.matchRivalsPlayers \.currentPlayerPick>b/);
assert.match(light,/html\[data-theme="light"\] body\.qdModern \.predictionsPage \.matchRivalsPlayers li\.currentPlayerPick>b/);
assert.match(light,/--qd-light-secondary:#4e647b/);
assert.match(light,/\.matchRivalsCenter :is\(\.matchRivalsDate,\.matchRivalsVenue\)/);
assert.match(light,/\.pickResult\.hasPick\.predictionCorrect/);
assert.match(nav,/html\[data-theme="light"\] body \.dashboard \.liquidNav\.qdMotionNav button\.active small/);
assert.match(quiniela,/\.qdStadiumMatch \.oneXtwo\{\s*background:transparent!important/);
assert.match(quiniela,/button:not\(\[aria-pressed="true"\]\):is\(\.pick1,\.pickX,\.pick2\)\{[\s\S]*?background:#143b69!important/,"Unselected 1/X/2 must have the same neutral dark blue in light mode");
assert.match(quiniela,/button:not\(\[aria-pressed="true"\]\):is\(\.pick1,\.pickX,\.pick2\) :is\(b,small\)\{[\s\S]*?color:#edf5ff!important/,"Unselected labels must share the same ink");
assert.match(quiniela,/button\[aria-pressed="true"\]\.pick1\{[\s\S]*?background:#176ed5!important/);
assert.match(quiniela,/button\[aria-pressed="true"\]\.pickX\{[\s\S]*?background:#fff!important/);
assert.match(quiniela,/button\[aria-pressed="true"\]\.pick2\{[\s\S]*?background:#c92949!important/);
assert.match(quiniela,/\.oneXtwo button:disabled\{\s*opacity:1!important/);
for(const v of ["pick1","pickX","pick2"]){
  assert.match(quiniela,new RegExp('button\\[aria-pressed="true"\\]\\.'+v+'\\{'));

}
assert.match(page,/aria-pressed=\{currentPick===x\} className=\{currentPick===x\?"active pick"\+x:"pick"\+x\}/);
assert.doesNotMatch(light,/html:not\(\[data-theme="light"\]\)/);
assert.doesNotMatch(nav,/html:not\(\[data-theme="light"\]\) body \.dashboard \.liquidNav/);
assert.ok(admin.includes('html[data-theme="light"] body.qdModern .adminWorkspace button:disabled'));
assert.match(admin,/background:#eaf1f8!important/);
console.log("Passed light-theme contrast and 1/X/2, own-pick, navigation regression checks.");
