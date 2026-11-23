"use client";
import {useState} from "react";

export type RoundScope=number|"all";

/** Follow the default view (the active round, or `fallback` when given) until the visitor deliberately chooses another. */
export default function useRoundScope(currentRound:number,initialScope?:RoundScope,fallback?:RoundScope){
 const [selection,setSelection]=useState<RoundScope|null>(()=>initialScope??null);
 const base=fallback??currentRound;
 const scope=selection??base;
 const selectScope=(next:RoundScope)=>setSelection(next===base?null:next);
 return [scope,selectScope] as const;
}
