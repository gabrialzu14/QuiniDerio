"use client";
import {useEffect} from "react";

let locks=0;
let restore:(()=>void)|undefined;

// Nested dialogs share one lock and restore the page only after the last closes.
export default function usePageScrollLock(open:boolean){
  useEffect(()=>{
    if(!open)return;
    if(locks++===0){
      const html=document.documentElement,body=document.body;
      const y=window.scrollY;
      const properties:[HTMLElement,string,string][]=[
        [html,"overflow","hidden"],[body,"overflow","hidden"],
        [body,"position","fixed"],[body,"top",`-${y}px`],[body,"width","100%"],
      ];
      const previous=properties.map(([element,key])=>[element,key,element.style.getPropertyValue(key),element.style.getPropertyPriority(key)] as const);
      const hadClass=body.classList.contains("qdModalOpen");
      body.classList.add("qdModalOpen");
      properties.forEach(([element,key,value])=>element.style.setProperty(key,value,"important"));
      restore=()=>{
        previous.forEach(([element,key,value,priority])=>value?element.style.setProperty(key,value,priority):element.style.removeProperty(key));
        if(!hadClass)body.classList.remove("qdModalOpen");
        window.scrollTo({top:y,behavior:"instant"});
      };
    }
    return()=>{if(--locks===0){restore?.();restore=undefined;}};
  },[open]);
}
