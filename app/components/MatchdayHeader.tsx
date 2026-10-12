export default function MatchdayHeader({round}:{round:number}){
  return <section className="qdMatchdayHeading" aria-label="Inicio de Quiniderio">
    <div><p className="qdMatchdayEyebrow">QUINIDERIO · TEMPORADA 2026/27</p><h1>Tu jornada.<br/><span>Tu equipo.</span></h1></div>
    <span className="qdMatchdayBadge">JORNADA {String(round).padStart(2,"0")}<i aria-hidden="true"/></span>
  </section>;
}
