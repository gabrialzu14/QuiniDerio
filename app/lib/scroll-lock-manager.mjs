/**
 * Single owner for background scroll locks. Unlike position:fixed on <body>,
 * locking overflow does not detach the document scroller on Android Chrome.
 * The previous inline styles are restored exactly after the final release.
 */
export function createScrollLockManager(){
  const owners=new Set();
  let restore=null;
  const getCount=()=>owners.size;
  function acquire(doc){
    if(owners.size===0){
      const html=doc.documentElement,body=doc.body;
      const entries=[[html,"overflow-y"],[body,"overflow-y"]];
      const prior=entries.map(([el,property])=>({
        el,property,value:el.style.getPropertyValue(property),
        priority:el.style.getPropertyPriority(property)
      }));
      const hadClass=body.classList.contains("qdModalOpen");
      body.classList.add("qdModalOpen");
      for(const {el,property} of prior)el.style.setProperty(property,"hidden","important");
      restore=()=>{
        for(const {el,property,value,priority} of prior)
          if(value)el.style.setProperty(property,value,priority);
          else el.style.removeProperty(property);
        if(!hadClass)body.classList.remove("qdModalOpen");
      };
    }
    const owner=Symbol("modal-scroll");
    owners.add(owner);
    let done=false;
    return ()=>{
      if(done)return;
      done=true;
      owners.delete(owner);
      if(owners.size===0){
        const release=restore;
        restore=null;
        release?.();
      }
    };
  }
  return {acquire,getCount};
}
export const pageScrollLocks=createScrollLockManager();
