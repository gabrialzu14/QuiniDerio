"use client";

/** Last-resort fallback when the root layout itself fails. */
export default function GlobalError({reset}:{error:Error&{digest?:string},reset:()=>void}){
 return <html lang="es"><body style={{margin:0,minHeight:"100dvh",display:"grid",placeItems:"center",background:"#061a3b",color:"#f1f5f9",fontFamily:"system-ui,sans-serif",textAlign:"center",padding:22}}>
  <section style={{maxWidth:360}}>
   <h1 style={{fontSize:24,margin:"0 0 10px"}}>QuiniDerio no ha podido cargar</h1>
   <p style={{color:"#9fb1c0",lineHeight:1.5,margin:"0 0 24px"}}>Comprueba tu conexión y vuelve a intentarlo.</p>
   <button type="button" onClick={()=>{try{reset()}catch{window.location.reload()}}} style={{width:"100%",minHeight:50,border:0,borderRadius:14,background:"#1670e8",color:"#fff",fontWeight:800,fontSize:16}}>Reintentar</button>
  </section>
 </body></html>;
}
