"use client";
import {useEffect} from "react";
import {pageScrollLocks} from "../lib/scroll-lock-manager.mjs";

/**
 * A single document scroller remains in place even while a modal is open.
 * Multiple overlays can overlap; each release only removes its own lock.
 * Never use body position:fixed or an artificial scrollTo during cleanup:
 * Android Chrome can retain the fixed page after dismissing a modal.
 */
export default function usePageScrollLock(open:boolean){
 useEffect(()=>{
  if(!open)return;
  return pageScrollLocks.acquire(document);
 },[open]);
}
