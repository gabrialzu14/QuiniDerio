"use client";
import {useEffect} from "react";

const LOCAL_KEYS=["quiniderio-player","quiniderio-picks","quiniderio-saved-rounds","quiniderio-federation-cache"];

/** Recoverable screen instead of the blank "Application error" page. */
export default function AppError({error,reset}:{error:Error&{digest?:string},reset:()=>void}){
 useEffect(()=>{console.error("QuiniDerio error",error)},[error]);
 // The launch overlay only fades once the app marks itself mounted.
 useEffect(()=>{document.body.classList.add("qd-mounted")},[]);
 const repair=()=>{
  // Cached copies are rebuilt from Supabase after signing in again.
  try{for(const key of LOCAL_KEYS)localStorage.removeItem(key)}catch{}
  window.location.reload();
 };
 return <main style={{minHeight:"100dvh",display:"grid",placeItems:"center",padding:"max(24px,env(safe-area-inset-top)) 22px max(24px,env(safe-area-inset-bottom))",background:"#061a3b",color:"#f1f5f9",fontFamily:"var(--font-inter),Inter,system-ui,sans-serif",textAlign:"center"}}>
  <section style={{maxWidth:360}}>
   <h1 style={{fontSize:24,margin:"0 0 10px"}}>Algo no ha ido bien</h1>
   <p style={{color:"#9fb1c0",lineHeight:1.5,margin:"0 0 24px"}}>No se ha podido mostrar esta pantalla. Tus pronósticos guardados no se han perdido.</p>
   <button type="button" onClick={reset} style={{width:"100%",minHeight:50,border:0,borderRadius:14,background:"#1670e8",color:"#fff",fontWeight:800,fontSize:16}}>Reintentar</button>
   <button type="button" onClick={repair} style={{width:"100%",minHeight:48,marginTop:10,border:"1px solid #ffffff26",borderRadius:14,background:"transparent",color:"#cbd5e1",fontWeight:700,fontSize:15}}>Reparar y recargar</button>
  </section>
 </main>;
}
