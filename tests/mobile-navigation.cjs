const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const path=require("node:path");

class MockStyle{
 constructor(){this.values=new Map()}
 getPropertyValue(k){return this.values.get(k)?.value||""}
 getPropertyPriority(k){return this.values.get(k)?.priority||""}
 setProperty(k,value,priority=""){this.values.set(k,{value:String(value),priority})}
 removeProperty(k){this.values.delete(k)}
}
class MockClassList{
 constructor(){this.classes=new Set()}
 contains(cls){return this.classes.has(cls)}
 add(cls){this.classes.add(cls)}
 remove(cls){this.classes.delete(cls)}
}
function documentFixture(){
 return {
  documentElement:{style:new MockStyle()},
  body:{style:new MockStyle(),classList:new MockClassList()}
 };
}
(async()=>{
 const {createScrollLockManager}=await import("../app/lib/scroll-lock-manager.mjs");
 const {PULL_THRESHOLD,canStartPull,pullDistance,shouldRefresh}=await import("../app/lib/mobile-gestures.mjs");
 {
  const doc=documentFixture(),locks=createScrollLockManager();
  doc.documentElement.style.setProperty("overflow-y","auto","important");
  doc.body.style.setProperty("overflow-y","visible");
  const first=locks.acquire(doc),second=locks.acquire(doc);
  assert.equal(locks.getCount(),2);
  assert.equal(doc.documentElement.style.getPropertyValue("overflow-y"),"hidden");
  assert.equal(doc.body.style.getPropertyValue("overflow-y"),"hidden");
  assert.equal(doc.body.style.getPropertyValue("position"),""); // Never fix body on Android.
  assert.equal(doc.body.classList.contains("qdModalOpen"),true);
  first();
  assert.equal(locks.getCount(),1);
  assert.equal(doc.body.style.getPropertyValue("overflow-y"),"hidden");
  first(); // Idempotent release: React strict-mode cleanup must not underflow.
  assert.equal(locks.getCount(),1);
  second();
  assert.equal(locks.getCount(),0);
  assert.equal(doc.documentElement.style.getPropertyValue("overflow-y"),"auto");
  assert.equal(doc.documentElement.style.getPropertyPriority("overflow-y"),"important");
  assert.equal(doc.body.style.getPropertyValue("overflow-y"),"visible");
  assert.equal(doc.body.classList.contains("qdModalOpen"),false);
 }
 {
  const doc=documentFixture(),locks=createScrollLockManager();
  doc.body.classList.add("qdModalOpen");
  const release=locks.acquire(doc);
  release();
  assert.equal(doc.body.classList.contains("qdModalOpen"),true,"Preexisting lock class must not be removed");
 }
 {
  const doc=documentFixture(),locks=createScrollLockManager();
  const old=locks.acquire(doc);old();
  const again=locks.acquire(doc);again();
  assert.equal(doc.body.classList.contains("qdModalOpen"),false,"Opening and dismissing a modal twice restores scroll");
 }
 assert.equal(canStartPull({scrollTop:0,blocked:false,interactive:false}),true);
 assert.equal(canStartPull({scrollTop:25,blocked:false,interactive:false}),false);
 assert.equal(canStartPull({scrollTop:0,blocked:true,interactive:false}),false);
 assert.equal(canStartPull({scrollTop:0,blocked:false,interactive:true}),false);
 assert.equal(canStartPull({scrollTop:0,blocked:false,interactive:false,horizontal:true}),false);
 assert.equal(pullDistance(0,0,0,-120),0,"Upward swipe scrolls normally");
 assert.equal(pullDistance(0,0,150,20),0,"Horizontal swipe must not refresh");
 assert.equal(pullDistance(0,0,0,50),50);
 assert.equal(shouldRefresh(PULL_THRESHOLD-1),false);
 assert.equal(shouldRefresh(PULL_THRESHOLD),true);
 const component=readFileSync(path.join(__dirname,"../app/components/PullToRefresh.tsx"),"utf8");
 assert.ok(component.includes('passive:true'),"Gesture listeners must remain passive");
 assert.ok(!component.includes("preventDefault()"),"Pulling cannot suppress native document scrolling");
 assert.ok(component.includes("removeEventListener"),"Unmount cleanup must release touch handlers");
 const navCss=readFileSync(path.join(__dirname,"../app/components/bottom-navigation.css"),"utf8");
 const navGeometry=navCss.slice(navCss.indexOf("2026-10-23 — Compact dock"));
 assert.match(navGeometry,/width: min\(calc\(100vw - 50px - env\(safe-area-inset-left\) - env\(safe-area-inset-right\)\), 405px\) !important/);
 assert.match(navGeometry,/bottom: calc\(34px \+ env\(safe-area-inset-bottom\)\) !important/);
 assert.match(navGeometry,/gap: var\(--qd-nav-gap\) !important/);
 assert.match(navGeometry,/width: calc\(\(100% - 2 \* var\(--qd-nav-inset\) - 4 \* var\(--qd-nav-gap\)\) \/ 5\) !important/);
 assert.match(navGeometry,/transform: translate3d\(calc\(var\(--active-index\) \* \(100% \+ var\(--qd-nav-gap\)\)\), 0, 0\) !important/);
 assert.match(navGeometry,/html\[data-nav="top"\]/);
 assert.doesNotMatch(navGeometry,/touch-action: none|pointer-events: none !important/);
 const lock=readFileSync(path.join(__dirname,"../app/components/usePageScrollLock.ts"),"utf8");
 assert.ok(!lock.includes('position","fixed"'),"The body must never be fixed by the modal lock");
 console.log("Passed: Android modal scroll cleanup, repeated overlays, pull gesture thresholds and passive listeners");
})().catch(err=>{console.error(err);process.exitCode=1});
