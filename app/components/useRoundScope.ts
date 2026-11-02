"use client";
import {useState} from "react";

export type RoundScope=number|"all";

/** Follow the active round until the visitor deliberately chooses another view. */
export default function useRoundScope(currentRound:number,initialScope?:RoundScope){
 const [selection,setSelection]=useState<RoundScope|null>(()=>initialScope??null);
 const scope=selection??currentRound;
 const selectScope=(next:RoundScope)=>setSelection(next===currentRound?null:next);
 return [scope,selectScope] as const;
}
