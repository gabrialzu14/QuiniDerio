"use client";
import {useEffect,useRef,useState} from "react";
import {supabase} from "../lib/supabase";
import {bookmarkletCode,decodeFederationHash,planImport,type ImportPlan} from "../lib/federation-import";

/** Review and save data sent from a federation page with the "Enviar a QuiniDerio" bookmark. */
export default function FederationImport({onSaved}:{onSaved:()=>void}){
 const [plan,setPlan]=useState<ImportPlan|null>(null);
 const [kind,setKind]=useState<"cal"|"cla"|null>(null);
 const [status,setStatus]=useState<{kind:"ok"|"error",text:string}|null>(null);
 const [saving,setSaving]=useState(false);
 const [showHelp,setShowHelp]=useState(false);
 const [copied,setCopied]=useState(false);
 const link=useRef<HTMLAnchorElement>(null);
 const code=typeof window==="undefined"?"":bookmarkletCode(window.location.origin);

 useEffect(()=>{
  // React refuses javascript: URLs in JSX; set it directly so the link can be dragged to the bookmarks bar.
  if(link.current&&code)link.current.setAttribute("href",code);
 },[code,showHelp]);
 useEffect(()=>{
  const payload=decodeFederationHash(window.location.hash);
  if(!payload)return;
  setKind(payload.k);
  void (async()=>{
   const {data,error}=await supabase.from("quini_live_matches").select("round,team,opponent,is_home,scheduled_at,fixture_details,status").eq("status","scheduled");
   if(error){setPlan({team:null,error:"No se han podido cargar las jornadas pendientes."});return}
   setPlan(planImport(payload,(data||[]) as any));
  })();
 },[]);
 const close=()=>{setPlan(null);setKind(null);history.replaceState(history.state,"",window.location.pathname)};
 const save=async()=>{
  if(!plan||"error" in plan)return;
  setSaving(true);setStatus(null);
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw new Error("Vuelve a iniciar sesión.");
   const res=await fetch("/api/admin/live",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({round:plan.round,team:plan.team,action:"details",details:plan.details})});
   if(!res.ok){const json=await res.json().catch(()=>null);throw new Error(json?.message||"No se ha podido guardar.")}
   setStatus({kind:"ok",text:`${plan.team} · Jornada ${plan.round} actualizado con los datos de la federación.`});
   close();onSaved();
  }catch(e){setStatus({kind:"error",text:e instanceof Error?e.message:"No se ha podido guardar."})}
  finally{setSaving(false)}
 };
 const copy=async()=>{try{await navigator.clipboard.writeText(code);setCopied(true);setTimeout(()=>setCopied(false),2500)}catch{setCopied(false)}};

 return <section className="fedImport" aria-label="Datos de la federación">
  {status&&<p className={"fedImportStatus "+status.kind} role="status">{status.text}</p>}
  {plan&&<div className="fedImportCard">
   <header><small>{kind==="cal"?"JORNADA DE LA FEDERACIÓN":"CLASIFICACIÓN DE LA FEDERACIÓN"}</small>
    <h2>{"error" in plan?(plan.team||"Datos no reconocidos"):`${plan.team} · Jornada ${plan.round}`}</h2></header>
   {"error" in plan?<p className="fedImportError">{plan.error}</p>:plan.changes.length?<table className="fedImportTable">
    <thead><tr><th>Dato</th><th>Ahora</th><th>Federación</th></tr></thead>
    <tbody>{plan.changes.map(c=><tr key={c.field}><td>{c.label}</td><td>{c.from}</td><td><b>{c.to}</b></td></tr>)}</tbody>
   </table>:<p className="fedImportError">Todo coincide con la federación; no hay nada que cambiar.</p>}
   <div className="fedImportActions">
    {!("error" in plan)&&plan.changes.some(c=>c.field!=="note")&&<button type="button" className="primary" disabled={saving} onClick={save}>{saving?"Guardando…":"Guardar cambios"}</button>}
    <button type="button" onClick={close} disabled={saving}>Descartar</button>
   </div>
  </div>}
  <button type="button" className="fedImportHelpToggle" aria-expanded={showHelp} onClick={()=>setShowHelp(v=>!v)}>Botón "Enviar a QuiniDerio"</button>
  {showHelp&&<div className="fedImportHelp">
   <ol>
    <li>Pulsa <b>Copiar código</b>.</li>
    <li>En el navegador del móvil, guarda esta página en marcadores y edita ese marcador: pon de nombre <b>Enviar a QuiniDerio</b> y pega el código en la dirección (URL).</li>
    <li>En la federación, abre la <b>jornada</b> (para fecha, hora y campo) o la <b>clasificación</b> (para posiciones, puntos y forma) del equipo.</li>
    <li>Toca el marcador: se abre esta página con los datos para revisarlos y guardarlos.</li>
   </ol>
   <div className="fedImportActions">
    <button type="button" className="primary" onClick={copy}>{copied?"Código copiado":"Copiar código"}</button>
    <a ref={link} className="fedImportBookmark" onClick={e=>e.preventDefault()} title="En ordenador, arrástralo a la barra de marcadores">Enviar a QuiniDerio</a>
   </div>
   <p className="fedImportNote">Solo lee la tabla que tienes en pantalla en tu navegador; no lee los resultados de los partidos.</p>
  </div>}
 </section>;
}
