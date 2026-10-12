export default function AppSplash({ready}:{ready:boolean}){
  return <main className={"qdLaunch "+(ready?"is-ready":"")} role="status" aria-label="Cargando Quiniderio">
    <div className="qdLaunchEmblem"><img src="/api/assets/branding/EscudoCarga.png" alt="Escudo del CD Derio" fetchPriority="high" decoding="async"/><i aria-hidden="true"/></div>
    <b className="qdLaunchWordmark">QUINI<span>DE</span>RIO</b>
    <div className="qdLaunchTrack" aria-hidden="true"><i/></div>
    <small>Cargando…</small>
  </main>;
}
