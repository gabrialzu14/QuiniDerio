export default function AppSplash({ready}:{ready:boolean}){
  return <main className={"qdLaunch "+(ready?"is-ready":"")} role="status" aria-label="Cargando Quiniderio">
    <div className="qdLaunchEmblem"><img src="/api/assets/branding/EscudoCarga.png" alt="Escudo del CD Derio" fetchPriority="high" decoding="async"/></div>
    <b className="qdLaunchWordmark qdWordmark"><span className="qd-quini">QUINI</span><span className="qd-de">DE</span><span className="qd-rio">RIO</span></b>
    <div className="qdLaunchScan" aria-hidden="true"/>
    <small>Cargando…</small>
  </main>;
}
