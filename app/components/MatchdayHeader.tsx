export default function MatchdayHeader({round}:{round:number}){
  return <section className="qdMatchdayHeading" aria-label="Inicio de Quiniderio">
    <div><p className="qdMatchdayEyebrow">TEMPORADA 2026/27</p><h1>Jornada {round}</h1></div>
  </section>;
}
