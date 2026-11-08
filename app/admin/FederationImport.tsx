"use client";
import {useEffect,useRef,useState} from "react";
import {supabase} from "../lib/supabase";
import {bookmarkletCode,decodeFederationHash,planImport,planImportAll,type ImportPlan} from "../lib/federation-import";

type Ready=Extract<ImportPlan,{round:number}>;
const isReady=(p:ImportPlan):p is Ready=>!("error" in p);

/** Review and save the data loaded with the "Cargar jornada" bookmark on a federation website. */
export default function FederationImport({onSaved}:{onSaved:()=>void}){
 const [plans,setPlans]=useState<ImportPlan[]|null>(null);
 const [status,setStatus]=useState<{kind:"ok"|"error",text:string}|null>(null);
 const [saving,setSaving]=useState(false);
 const [showHelp,setShowHelp]=useState(false);
 const [copied,setCopied]=useState(false);
 const link=useRef<HTMLAnchorElement>(null);
 const code=typeof window==="undefined"?"":bookmarkletCode(window.location.origin,process.env.NEXT_PUBLIC_SUPABASE_URL||"",process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||"");

 useEffect(()=>{
  // React refuses javascript: URLs in JSX; set it directly so the link can be dragged to the bookmarks bar.
  if(link.current&&code)link.current.setAttribute("href",code);
 },[code,showHelp]);
 useEffect(()=>{
  const payload=decodeFederationHash(window.location.hash);
  if(!payload)return;
  void (async()=>{
   const {data,error}=await supabase.from("quini_live_matches").select("round,team,opponent,is_home,scheduled_at,fixture_details,status").eq("status","scheduled");
   if(error){setPlans([{team:null,error:"No se han podido cargar las jornadas pendientes."}]);return}
   const rows=(data||[]) as any[];
   setPlans(payload.k==="multi"?planImportAll(payload,rows):[planImport(payload,rows)]);
  })();
 },[]);
 const close=()=>{setPlans(null);history.replaceState(history.state,"",window.location.pathname)};
 const toSave=(plans||[]).filter(isReady).filter(p=>p.changes.some(c=>c.field!=="note"));
 const saveAll=async()=>{
  if(!toSave.length)return;
  setSaving(true);setStatus(null);
  const done:string[]=[],failed:string[]=[];
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw new Error("Vuelve a iniciar sesión.");
   for(const plan of toSave){
    const res=await fetch("/api/admin/live",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({round:plan.round,team:plan.team,action:"details",details:plan.details})});
    if(res.ok)done.push(plan.team);else{const json=await res.json().catch(()=>null);failed.push(`${plan.team} (${json?.message||"error"})`)}
   }
   setStatus(failed.length?{kind:"error",text:`Guardado: ${done.join(", ")||"nada"}. No guardado: ${failed.join(", ")}.`}:{kind:"ok",text:`Actualizado con la federación: ${done.join(", ")}.`});
   if(!failed.length)close();
   onSaved();
  }catch(e){setStatus({kind:"error",text:e instanceof Error?e.message:"No se ha podido guardar."})}
  finally{setSaving(false)}
 };
 const copy=async()=>{try{await navigator.clipboard.writeText(code);setCopied(true);setTimeout(()=>setCopied(false),2500)}catch{setCopied(false)}};

 return <section className="fedImport" aria-label="Datos de la federación">
  {status&&<p className={"fedImportStatus "+status.kind} role="status">{status.text}</p>}
  {plans&&<div className="fedImportCard">
   <header><small>DATOS DE LA FEDERACIÓN</small><h2>Cargar jornada</h2></header>
   {plans.map((plan,i)=>isReady(plan)?<div className="fedImportTeam" key={plan.team+plan.round}>
    <h3>{plan.team} · Jornada {plan.round}</h3>
    {plan.changes.length?<table className="fedImportTable">
     <thead><tr><th>Dato</th><th>Ahora</th><th>Federación</th></tr></thead>
     <tbody>{plan.changes.map(c=><tr key={c.field}><td>{c.label}</td><td>{c.from}</td><td><b>{c.to}</b></td></tr>)}</tbody>
    </table>:<p className="fedImportSame">Todo coincide con la federación.</p>}
   </div>:<p className="fedImportError" key={"e"+i}>{plan.error}</p>)}
   <div className="fedImportActions">
    {toSave.length>0&&<button type="button" className="primary" disabled={saving} onClick={saveAll}>{saving?"Guardando…":`Guardar todo (${toSave.length})`}</button>}
    <button type="button" onClick={close} disabled={saving}>Descartar</button>
   </div>
  </div>}
  <button type="button" className="fedImportHelpToggle" aria-expanded={showHelp} onClick={()=>setShowHelp(v=>!v)}>Botón "Cargar jornada"</button>
  {showHelp&&<div className="fedImportHelp">
   <ol>
    <li>Una sola vez: pulsa <b>Copiar código</b>, guarda cualquier página en favoritos y edita ese favorito: nombre <b>Cargar jornada</b> y, en la dirección (URL), pega el código.</li>
    <li>Cada semana, con la jornada ya creada aquí, abre la <a href="https://www.fvf-bff.eus/pnfg/" target="_blank" rel="noreferrer">Federación Vizcaína</a> y lanza el favorito <b>desde esa página</b>:
     <ul>
      <li><b>Chrome (Android o iPhone):</b> toca la barra de direcciones, escribe <b>Cargar jornada</b> y elige la sugerencia con la estrella. Abrirlo desde la lista de favoritos no funciona en Chrome.</li>
      <li><b>Safari (iPhone):</b> abre los favoritos (el libro) y toca <b>Cargar jornada</b>.</li>
     </ul></li>
    <li>Aparece abajo "Cargando…" y vuelve aquí con los datos: revisa y pulsa <b>Guardar todo</b>. Repite desde la <a href="https://www.euskadifutbol.eus/pnfg/" target="_blank" rel="noreferrer">Federación Vasca</a> (Derio A y Derio Fem).</li>
   </ol>
   <div className="fedImportActions">
    <button type="button" className="primary" onClick={copy}>{copied?"Código copiado":"Copiar código"}</button>
    <a ref={link} className="fedImportBookmark" onClick={e=>{e.preventDefault();setStatus({kind:"error",text:"Este botón no se pulsa aquí: guárdalo en favoritos y lánzalo desde la web de la federación (pasos 2 y 3)."})}} title="En ordenador, arrástralo a la barra de marcadores">Cargar jornada</a>
   </div>
   <p className="fedImportNote">Lo hace tu navegador al pulsarlo: lee el calendario y la clasificación de cada equipo y nunca los resultados de los partidos.</p>
  </div>}
 </section>;
}
