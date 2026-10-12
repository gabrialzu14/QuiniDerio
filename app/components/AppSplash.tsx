export default function AppSplash({ready}:{ready:boolean}){
  return <main className={"qdLaunch "+(ready?"is-ready":"")} role="status" aria-label="Cargando Quiniderio">
    <div className="qdLaunchEmblem" aria-hidden="true"><span>QD</span><i/></div>
    <b className="qdLaunchWordmark">QUINI<span>DE</span>RIO</b>
    <p>Juntos, cada jornada.</p>
    <div className="qdLaunchTrack" aria-hidden="true"><i/></div>
    <small>Preparando tu jornada…</small>
  </main>;
}
